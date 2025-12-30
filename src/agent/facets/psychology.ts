/**
 * Psychology Facet
 *
 * Computes psychological attributes for agents including:
 * - Big Five-inspired traits (riskTolerance, conscientiousness, noveltySeeking, agreeableness, authoritarianism)
 * - Ethics decomposition (ruleAdherence, harmAversion, missionUtilitarianism, loyaltyScope)
 * - Contradiction pairs (narrative-driving internal tensions)
 * - Red lines (hard limits the agent won't cross)
 * - Visibility profile (publicVisibility, paperTrail, digitalHygiene)
 * - Cover aptitude tags (plausible cover identities)
 */

import type { Fixed, Latents, AgentVocabV1, AgentGenerationTraceV1, ContradictionPair, HeightBand } from '../types';
import {
  makeRng,
  facetSeed,
  clampFixed01k,
  clampInt,
  weightedPick,
  uniqueStrings,
  pickKHybrid,
  traceSet,
  traceFacet,
} from '../utils';
import type { Aptitudes } from './aptitudes';
import type { PsychTraits } from './traits';

// ============================================================================
// Types
// ============================================================================

/** Input context for psychology computation */
export type PsychologyContext = {
  seed: string;
  vocab: AgentVocabV1;
  latents: Latents;
  aptitudes: Aptitudes;
  traits: PsychTraits;
  tierBand: 'elite' | 'middle' | 'mass';
  roleSeedTags: readonly string[];
  careerTrackTag: string;
  heightBand: HeightBand;
  trace?: AgentGenerationTraceV1;
};

export type LoyaltyScope = 'institution' | 'people' | 'ideals' | 'self';

/** Ethics decomposition - nuanced breakdown of principled behavior */
export type Ethics = {
  ruleAdherence: Fixed; // follows rules vs bends them
  harmAversion: Fixed; // cares about harm to others
  missionUtilitarianism: Fixed; // does dirty work if needed
  loyaltyScope: LoyaltyScope; // what they're loyal to
};

/** Visibility profile - how observable the agent is */
export type Visibility = {
  publicVisibility: Fixed;
  paperTrail: Fixed;
  digitalHygiene: Fixed;
};

/** Output result from psychology computation */
export type PsychologyResult = {
  ethics: Ethics;
  contradictions: ContradictionPair[];
  redLines: string[];
  visibility: Visibility;
  coverAptitudeTags: string[];
};

// ============================================================================
// Career-Based Cover Mappings
// ============================================================================

const COVER_BY_CAREER: Record<string, string[]> = {
  'foreign-service': ['diplomatic-staff', 'trade-delegate', 'consultant'],
  intelligence: ['consultant', 'freelancer', 'business-development'],
  military: ['logistics-contractor', 'consultant', 'trade-delegate'],
  journalism: ['journalist', 'freelancer', 'consultant'],
  engineering: ['engineer', 'consultant', 'business-development'],
  academia: ['academic', 'consultant', 'freelancer'],
  ngo: ['ngo-worker', 'aid-worker', 'freelancer'],
  'public-health': ['aid-worker', 'ngo-worker', 'consultant'],
  logistics: ['logistics-contractor', 'business-development', 'consultant'],
  politics: ['consultant', 'business-development', 'trade-delegate'],
  law: ['consultant', 'trade-delegate', 'business-development'],
  'corporate-ops': ['business-development', 'consultant', 'freelancer'],
  'organized-labor': ['ngo-worker', 'consultant', 'freelancer'],
  'civil-service': ['consultant', 'trade-delegate', 'diplomatic-staff'],
  finance: ['business-development', 'consultant', 'freelancer'],
};

// ============================================================================
// Helper Functions
// ============================================================================

function computeEthics(
  seed: string,
  latents: Latents,
  traits: PsychTraits,
  aptitudes: Aptitudes,
  trace?: AgentGenerationTraceV1,
): Ethics {
  const ethicsRng = makeRng(facetSeed(seed, 'ethics'));
  const principledness01 = latents.principledness / 1000;

  const ruleAdherence = clampFixed01k(
    0.45 * latents.principledness +
    0.30 * latents.institutionalEmbeddedness +
    0.15 * traits.conscientiousness +
    0.10 * ethicsRng.int(0, 1000),
  );

  const harmAversion = clampFixed01k(
    0.50 * aptitudes.empathy +
    0.25 * latents.principledness +
    0.15 * (1000 - latents.riskAppetite) +
    0.10 * ethicsRng.int(0, 1000),
  );

  const missionUtilitarianism = clampFixed01k(
    0.40 * latents.riskAppetite +
    0.25 * (1000 - latents.principledness) +
    0.20 * latents.opsecDiscipline +
    0.15 * ethicsRng.int(0, 1000),
  );

  const loyaltyScope = (() => {
    const scopeWeights: Array<{ item: LoyaltyScope; weight: number }> = [
      { item: 'institution', weight: 1 + 2.0 * (latents.institutionalEmbeddedness / 1000) },
      { item: 'people', weight: 1 + 2.0 * (aptitudes.empathy / 1000) },
      { item: 'ideals', weight: 1 + 2.0 * principledness01 },
      { item: 'self', weight: 1 + 1.5 * (1 - principledness01) + 0.8 * (latents.riskAppetite / 1000) },
    ];
    return weightedPick(ethicsRng, scopeWeights.map(s => ({ item: s.item, weight: s.weight }))) as LoyaltyScope;
  })();

  const ethics = { ruleAdherence, harmAversion, missionUtilitarianism, loyaltyScope };
  traceSet(trace, 'psych.ethics', ethics, {
    method: 'formula',
    dependsOn: { facet: 'ethics', latents: 'latentModel.values', aptitudes: 'aptitudes' },
  });

  return ethics;
}

function computeContradictions(
  latents: Latents,
  aptitudes: Aptitudes,
  ethics: Ethics,
  roleSeedTags: readonly string[],
  trace?: AgentGenerationTraceV1,
): ContradictionPair[] {
  const contradictions: ContradictionPair[] = [];

  const contradictionCandidates: Array<{
    trait1: string;
    trait2: string;
    tension: string;
    narrativeHook: string;
    condition: boolean;
  }> = [
    {
      trait1: 'harmAversion',
      trait2: 'missionUtilitarianism',
      tension: 'moral-injury-risk',
      narrativeHook: 'Cares about people but can rationalize harm for mission success',
      condition: ethics.harmAversion > 550 && ethics.missionUtilitarianism > 550,
    },
    {
      trait1: 'ruleAdherence',
      trait2: 'riskAppetite',
      tension: 'maverick-institutionalist',
      narrativeHook: 'Respects the system but constantly pushes its boundaries',
      condition: ethics.ruleAdherence > 550 && latents.riskAppetite > 550,
    },
    {
      trait1: 'publicness',
      trait2: 'opsecDiscipline',
      tension: 'spotlight-shadow',
      narrativeHook: 'Craves attention but knows discretion is survival',
      condition: latents.publicness > 550 && latents.opsecDiscipline > 550,
    },
    {
      trait1: 'empathy',
      trait2: 'deceptionAptitude',
      tension: 'compassionate-manipulator',
      narrativeHook: 'Genuinely understands people and uses that for leverage',
      condition: aptitudes.empathy > 550 && aptitudes.deceptionAptitude > 550,
    },
    {
      trait1: 'frugality',
      trait2: 'aestheticExpressiveness',
      tension: 'ascetic-aesthete',
      narrativeHook: 'Values simplicity but has expensive taste',
      condition: latents.frugality > 550 && latents.aestheticExpressiveness > 550,
    },
    {
      trait1: 'institutionalEmbeddedness',
      trait2: 'adaptability',
      tension: 'loyal-chameleon',
      narrativeHook: 'Devoted to the organization but could thrive anywhere',
      condition: latents.institutionalEmbeddedness > 550 && latents.adaptability > 550,
    },
    {
      trait1: 'socialBattery',
      trait2: 'opsecDiscipline',
      tension: 'social-introvert',
      narrativeHook: 'Excels at schmoozing but finds it exhausting',
      condition: latents.socialBattery > 550 && latents.opsecDiscipline > 550 && roleSeedTags.includes('operative'),
    },
  ];

  // First pass: collect all matching contradictions
  for (const candidate of contradictionCandidates) {
    if (candidate.condition) {
      contradictions.push({
        trait1: candidate.trait1,
        trait2: candidate.trait2,
        tension: candidate.tension,
        narrativeHook: candidate.narrativeHook,
      });
    }
  }

  // Guarantee at least 1-2 contradictions - everyone has internal tensions
  // If none matched strict criteria, use relaxed criteria or pick from universal tensions
  if (contradictions.length === 0) {
    // Universal contradictions that apply to most people
    const universalContradictions: ContradictionPair[] = [
      {
        trait1: 'security',
        trait2: 'freedom',
        tension: 'safety-adventure',
        narrativeHook: 'Craves stability but feels trapped by routine',
      },
      {
        trait1: 'authenticity',
        trait2: 'belonging',
        tension: 'self-vs-group',
        narrativeHook: 'Wants to be accepted but fears losing themselves',
      },
      {
        trait1: 'ambition',
        trait2: 'contentment',
        tension: 'striving-settling',
        narrativeHook: 'Driven to achieve more but unsure what "enough" looks like',
      },
      {
        trait1: 'independence',
        trait2: 'connection',
        tension: 'autonomy-intimacy',
        narrativeHook: 'Values self-reliance but needs close relationships',
      },
      {
        trait1: 'principle',
        trait2: 'pragmatism',
        tension: 'idealist-realist',
        narrativeHook: 'Holds strong values but knows the world requires compromise',
      },
    ];

    // Pick 1-2 based on a deterministic hash from latents
    const pickIndex = (latents.socialBattery + latents.riskAppetite) % universalContradictions.length;
    contradictions.push(universalContradictions[pickIndex]!);

    // 50% chance of a second contradiction
    if (latents.adaptability > 500) {
      const secondIndex = (pickIndex + 1 + (latents.frugality % 3)) % universalContradictions.length;
      if (secondIndex !== pickIndex) {
        contradictions.push(universalContradictions[secondIndex]!);
      }
    }
  }

  // Cap at 3 contradictions to avoid overwhelming
  const finalContradictions = contradictions.slice(0, 3);

  traceSet(trace, 'psych.contradictions', finalContradictions, {
    method: 'conditionalPairs',
    dependsOn: { facet: 'ethics', count: finalContradictions.length },
  });

  return finalContradictions;
}

function computeRedLines(
  seed: string,
  vocab: AgentVocabV1,
  latents: Latents,
  traits: PsychTraits,
  roleSeedTags: readonly string[],
  trace?: AgentGenerationTraceV1,
): string[] {
  const redLinePool = uniqueStrings(vocab.psych?.redLines ?? []);
  const roleRedLinePool = roleSeedTags.flatMap(r => vocab.psych?.redLineByRole?.[r] ?? []);

  traceFacet(trace, seed, 'red_lines');
  const redLineRng = makeRng(facetSeed(seed, 'red_lines'));

  const redLineCount = clampInt(
    1 + Math.round((traits.agreeableness + traits.conscientiousness + 0.60 * latents.principledness) / 1000),
    1,
    3,
  );

  const redLines = redLinePool.length
    ? pickKHybrid(redLineRng, uniqueStrings(roleRedLinePool), redLinePool, redLineCount, Math.min(redLineCount, 2))
    : redLineRng.pickK(['harm-to-civilians', 'torture', 'personal-corruption'] as const, redLineCount);

  traceSet(trace, 'identity.redLines', redLines, {
    method: 'hybridPickK',
    dependsOn: {
      facet: 'red_lines',
      redLineCount,
      rolePoolSize: roleRedLinePool.length,
      globalPoolSize: redLinePool.length,
    },
  });

  return redLines;
}

function computeVisibility(
  seed: string,
  latents: Latents,
  aptitudes: Aptitudes,
  heightBand: HeightBand,
  careerTrackTag: string,
  trace?: AgentGenerationTraceV1,
): Visibility {
  traceFacet(trace, seed, 'visibility');
  const visRng = makeRng(facetSeed(seed, 'visibility'));

  const heightVisibilityBias =
    heightBand === 'very_tall' ? 45 : heightBand === 'tall' ? 25 : heightBand === 'very_short' ? -20 : 0;
  const expressVisibilityBias = Math.round((latents.aestheticExpressiveness / 1000 - 0.5) * 40);

  const publicVisibility = clampFixed01k(
    0.64 * latents.publicness + 0.30 * visRng.int(0, 1000) + heightVisibilityBias + expressVisibilityBias,
  );

  const paperTrail = clampFixed01k(
    0.65 * latents.institutionalEmbeddedness +
    0.22 * latents.planningHorizon +
    0.13 * visRng.int(0, 1000) +
    (careerTrackTag === 'civil-service' || careerTrackTag === 'law' ? 80 : 0),
  );

  const digitalHygiene = clampFixed01k(
    0.50 * aptitudes.attentionControl +
    0.22 * latents.opsecDiscipline +
    0.18 * latents.techFluency +
    0.10 * latents.impulseControl +
    0.20 * visRng.int(0, 1000),
  );

  const visibility = { publicVisibility, paperTrail, digitalHygiene };
  traceSet(trace, 'visibility', visibility, {
    method: 'formula',
    dependsOn: { facet: 'visibility', latents: 'latentModel.values', aptitudes: 'aptitudes', careerTrackTag },
  });

  return visibility;
}

function computeCovers(
  seed: string,
  vocab: AgentVocabV1,
  latents: Latents,
  careerTrackTag: string,
  trace?: AgentGenerationTraceV1,
): string[] {
  traceFacet(trace, seed, 'covers');
  const coverRng = makeRng(facetSeed(seed, 'covers'));
  const coverPool = uniqueStrings(vocab.covers?.coverAptitudeTags ?? []);

  const public01 = latents.publicness / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;

  const coverForced: string[] = [];
  const addCover = (tag: string) => {
    if (!coverPool.includes(tag)) return;
    if (coverForced.includes(tag)) return;
    coverForced.push(tag);
  };

  for (const tag of COVER_BY_CAREER[careerTrackTag] ?? []) addCover(tag);
  if (public01 > 0.7) addCover('journalist');
  if (opsec01 > 0.7) addCover('consultant');

  const coverAptitudeTags = coverPool.length
    ? uniqueStrings([
        ...coverForced.slice(0, 2),
        ...coverRng.pickK(coverPool.filter(x => !coverForced.includes(x)), Math.max(0, 3 - coverForced.slice(0, 2).length)),
      ]).slice(0, 3)
    : coverRng.pickK(['consultant', 'ngo-worker', 'tourist'] as const, 3);

  traceSet(trace, 'covers.coverAptitudeTags', coverAptitudeTags, {
    method: 'forcedPlusPickK',
    dependsOn: { facet: 'covers', careerTrackTag, forced: coverForced.slice(0, 2), poolSize: coverPool.length },
  });

  return coverAptitudeTags;
}

// ============================================================================
// Main Computation
// ============================================================================

/**
 * Compute psychology attributes for an agent.
 *
 * This facet computes:
 * - Ethics: decomposed principled behavior (rule adherence, harm aversion, mission utilitarianism, loyalty scope)
 * - Contradictions: narrative-driving internal tensions from trait conflicts
 * - Red lines: hard limits the agent won't cross (role-influenced)
 * - Visibility: how observable the agent is (public visibility, paper trail, digital hygiene)
 * - Covers: plausible cover identities based on career and traits
 */
export function computePsychology(ctx: PsychologyContext): PsychologyResult {
  const {
    seed,
    vocab,
    latents,
    aptitudes,
    traits,
    roleSeedTags,
    careerTrackTag,
    heightBand,
    trace,
  } = ctx;

  // Ethics decomposition
  const ethics = computeEthics(seed, latents, traits, aptitudes, trace);

  // Contradiction pairs for story potential
  const contradictions = computeContradictions(latents, aptitudes, ethics, roleSeedTags, trace);

  // Red lines (hard limits)
  const redLines = computeRedLines(seed, vocab, latents, traits, roleSeedTags, trace);

  // Visibility profile
  const visibility = computeVisibility(seed, latents, aptitudes, heightBand, careerTrackTag, trace);

  // Cover aptitudes
  const coverAptitudeTags = computeCovers(seed, vocab, latents, careerTrackTag, trace);

  return {
    ethics,
    contradictions,
    redLines,
    visibility,
    coverAptitudeTags,
  };
}
