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

import type {
  Fixed,
  Latents,
  AgentVocabV1,
  AgentGenerationTraceV1,
  ContradictionPair,
  HeightBand,
  BaselineAffect,
  RegulationStyle,
  StressTell,
  RepairStyle,
  SelfStory,
  SocialMask,
} from '../types';
import {
  makeRng,
  facetSeed,
  clampFixed01k,
  clampInt,
  weightedPick,
  weightedPickKUnique,
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

/** Affect - emotional regulation and expression */
export type Affect = {
  baseline: BaselineAffect;
  regulationStyle: RegulationStyle;
  stressTells: StressTell[];
  repairStyle: RepairStyle;
};

/** Self-concept - internal narrative and social presentation */
export type SelfConceptResult = {
  selfStory: SelfStory;
  impostorRisk: Fixed;
  socialMask: SocialMask;
};

/** Knowledge & ignorance - what they know, miss, or misbelieve */
export type KnowledgeIgnoranceResult = {
  knowledgeStrengths: string[];
  knowledgeGaps: string[];
  falseBeliefs: string[];
  informationSources: string[];
  informationBarriers: string[];
};

/** Output result from psychology computation */
export type PsychologyResult = {
  ethics: Ethics;
  contradictions: ContradictionPair[];
  redLines: string[];
  visibility: Visibility;
  coverAptitudeTags: string[];
  affect: Affect;
  selfConcept: SelfConceptResult;
  knowledgeIgnorance: KnowledgeIgnoranceResult;
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

function computeAffect(
  seed: string,
  vocab: AgentVocabV1,
  latents: Latents,
  aptitudes: Aptitudes,
  trace?: AgentGenerationTraceV1,
): Affect {
  traceFacet(trace, seed, 'affect');
  const affectRng = makeRng(facetSeed(seed, 'affect'));

  // Baseline affect - influenced by social battery and empathy
  const baselinePool = vocab.affect?.baselineAffects ?? [
    'warm', 'flat', 'intense', 'guarded', 'mercurial', 'melancholic', 'anxious', 'cheerful',
  ];
  const baselineWeights = baselinePool.map(b => {
    let w = 1;
    if (b === 'warm' && aptitudes.empathy > 600) w += 2;
    if (b === 'flat' && latents.opsecDiscipline > 650) w += 2;
    if (b === 'intense' && latents.riskAppetite > 600) w += 2;
    if (b === 'guarded' && latents.opsecDiscipline > 550) w += 1.5;
    if (b === 'anxious' && latents.impulseControl < 400) w += 2;
    if (b === 'cheerful' && latents.socialBattery > 650) w += 2;
    if (b === 'mercurial' && latents.adaptability > 600 && latents.impulseControl < 500) w += 2;
    if (b === 'melancholic' && latents.socialBattery < 400) w += 1.5;
    if (b === 'numb' && latents.opsecDiscipline > 700 && latents.stressReactivity > 600) w += 2;
    if (b === 'irritable' && latents.stressReactivity > 650) w += 2;
    if (b === 'hopeful' && latents.principledness > 650) w += 2;
    if (b === 'restless' && latents.impulseControl < 450) w += 2;
    return { item: b as BaselineAffect, weight: w };
  });
  const baseline = weightedPick(affectRng, baselineWeights) as BaselineAffect;

  // Regulation style - how they handle emotions
  const regPool = vocab.affect?.regulationStyles ?? [
    'ruminates', 'suppresses', 'externalizes', 'reframes', 'compartmentalizes', 'avoids', 'seeks-support',
  ];
  const regWeights = regPool.map(r => {
    let w = 1;
    if (r === 'suppresses' && latents.opsecDiscipline > 600) w += 2;
    if (r === 'compartmentalizes' && aptitudes.attentionControl > 600) w += 2;
    if (r === 'seeks-support' && latents.socialBattery > 600) w += 2;
    if (r === 'ruminates' && latents.planningHorizon > 600) w += 1.5;
    if (r === 'externalizes' && latents.impulseControl < 400) w += 2;
    if (r === 'reframes' && latents.adaptability > 600) w += 2;
    if (r === 'avoids' && latents.riskAppetite < 400) w += 1.5;
    if (r === 'meditates' && latents.impulseControl > 600) w += 2;
    if (r === 'exercises' && latents.physicalConditioning > 600) w += 2;
    if (r === 'isolates' && latents.socialBattery < 400) w += 2;
    if (r === 'distracts' && latents.impulseControl < 400) w += 2;
    return { item: r as RegulationStyle, weight: w };
  });
  const regulationStyle = weightedPick(affectRng, regWeights) as RegulationStyle;

  // Stress tells - 1-3 observable stress indicators
  const tellPool = uniqueStrings(vocab.affect?.stressTells ?? [
    'overexplains', 'goes-quiet', 'snaps', 'jokes-deflect', 'micromanages',
    'withdraws', 'overeats', 'insomnia', 'hyperactive', 'cries-easily',
  ]);
  const forcedTells: StressTell[] = [];
  const addForcedTell = (tag: StressTell) => {
    if (!tellPool.includes(tag)) return;
    if (forcedTells.includes(tag)) return;
    forcedTells.push(tag);
  };
  if (latents.stressReactivity > 700) addForcedTell('insomnia');
  if (latents.opsecDiscipline > 700) addForcedTell('goes-quiet');
  if (latents.impulseControl < 350) addForcedTell('snaps');

  const tellWeights = tellPool.map(t => {
    let w = 1;
    if (t === 'jaw-clench' && latents.opsecDiscipline > 600) w += 1.5;
    if (t === 'pacing' && latents.stressReactivity > 600) w += 1.5;
    if (t === 'fidgeting' && latents.impulseControl < 450) w += 1.5;
    if (t === 'tunnel-vision' && latents.stressReactivity > 700) w += 1.5;
    if (t === 'cold-sweat' && latents.stressReactivity > 650) w += 1.5;
    return { item: t as StressTell, weight: w };
  });

  const tellCount = clampInt(1 + affectRng.int(0, 2), 1, 3);
  const finalCount = Math.max(tellCount, forcedTells.length);
  const remaining = tellWeights.filter(t => !forcedTells.includes(t.item));
  const remainingCount = Math.max(0, Math.min(remaining.length, finalCount - forcedTells.length));
  const stressTells = uniqueStrings([
    ...forcedTells,
    ...weightedPickKUnique(affectRng, remaining, remainingCount),
  ]).slice(0, finalCount) as StressTell[];

  // Repair style - how they fix relationships after conflict
  const repairPool = vocab.affect?.repairStyles ?? [
    'apologizes-fast', 'stonewalls', 'buys-gifts', 'explains-endlessly',
    'pretends-nothing-happened', 'seeks-mediation', 'writes-letters',
  ];
  const repairWeights = repairPool.map(r => {
    let w = 1;
    if (r === 'apologizes-fast' && aptitudes.empathy > 600) w += 2;
    if (r === 'stonewalls' && latents.opsecDiscipline > 650) w += 2;
    if (r === 'explains-endlessly' && latents.planningHorizon > 600) w += 1.5;
    if (r === 'pretends-nothing-happened' && latents.adaptability > 600) w += 1.5;
    if (r === 'seeks-mediation' && latents.institutionalEmbeddedness > 600) w += 2;
    if (r === 'gives-space' && latents.opsecDiscipline > 600) w += 1.5;
    if (r === 'humor' && latents.socialBattery > 600) w += 1.5;
    if (r === 'acts-of-service' && latents.institutionalEmbeddedness > 600) w += 1.5;
    return { item: r as RepairStyle, weight: w };
  });
  const repairStyle = weightedPick(affectRng, repairWeights) as RepairStyle;

  const affect = { baseline, regulationStyle, stressTells, repairStyle };
  traceSet(trace, 'psych.affect', affect, { method: 'weightedPick', dependsOn: { facet: 'affect' } });
  return affect;
}

function computeSelfConcept(
  seed: string,
  vocab: AgentVocabV1,
  latents: Latents,
  tierBand: 'elite' | 'middle' | 'mass',
  roleSeedTags: readonly string[],
  trace?: AgentGenerationTraceV1,
): SelfConceptResult {
  traceFacet(trace, seed, 'selfConcept');
  const selfRng = makeRng(facetSeed(seed, 'selfConcept'));

  // Self-story - the narrative they tell themselves about who they are
  const storyPool = vocab.selfConcept?.selfStories ?? [
    'self-made', 'wronged', 'caretaker', 'chosen', 'survivor', 'reformer',
    'outsider', 'loyalist', 'pragmatist', 'idealist',
  ];
  const storyWeights = storyPool.map(s => {
    let w = 1;
    if (s === 'self-made' && tierBand === 'elite' && latents.riskAppetite > 500) w += 2;
    if (s === 'survivor' && tierBand === 'mass') w += 2;
    if (s === 'loyalist' && latents.institutionalEmbeddedness > 650) w += 2;
    if (s === 'reformer' && latents.principledness > 650) w += 2;
    if (s === 'outsider' && latents.socialBattery < 400) w += 2;
    if (s === 'caretaker' && roleSeedTags.includes('organizer')) w += 2;
    if (s === 'pragmatist' && latents.adaptability > 600) w += 1.5;
    if (s === 'idealist' && latents.principledness > 600) w += 1.5;
    return { item: s as SelfStory, weight: w };
  });
  const selfStory = weightedPick(selfRng, storyWeights) as SelfStory;

  // Impostor risk - higher for elite with mass origins, lower for confident types
  let impostorBase = 400;
  if (tierBand === 'elite') impostorBase += 150;
  if (latents.socialBattery < 450) impostorBase += 100;
  if (latents.principledness > 600) impostorBase -= 80;
  if (roleSeedTags.includes('analyst')) impostorBase += 50;
  const impostorRisk = clampFixed01k(impostorBase + selfRng.int(-150, 150));

  // Social mask - the persona they present to the world
  const maskPool = vocab.selfConcept?.socialMasks ?? [
    'bureaucrat', 'charmer', 'patriot', 'cynic', 'true-believer', 'everyman',
    'intellectual', 'tough-guy', 'helper', 'rebel',
  ];
  const maskWeights = maskPool.map(m => {
    let w = 1;
    if (m === 'bureaucrat' && latents.institutionalEmbeddedness > 600) w += 2;
    if (m === 'charmer' && latents.socialBattery > 650) w += 2;
    if (m === 'intellectual' && roleSeedTags.includes('analyst')) w += 2;
    if (m === 'tough-guy' && roleSeedTags.includes('security')) w += 2;
    if (m === 'helper' && roleSeedTags.includes('organizer')) w += 2;
    if (m === 'rebel' && latents.riskAppetite > 650) w += 1.5;
    if (m === 'cynic' && latents.principledness < 400) w += 2;
    if (m === 'true-believer' && latents.principledness > 700) w += 2;
    if (m === 'everyman' && tierBand === 'mass') w += 1.5;
    if (m === 'patriot' && latents.institutionalEmbeddedness > 650) w += 1.5;
    return { item: m as SocialMask, weight: w };
  });
  const socialMask = weightedPick(selfRng, maskWeights) as SocialMask;

  const selfConcept = { selfStory, impostorRisk, socialMask };
  traceSet(trace, 'psych.selfConcept', selfConcept, { method: 'weightedPick', dependsOn: { facet: 'selfConcept' } });
  return selfConcept;
}

function computeKnowledgeIgnorance(
  seed: string,
  vocab: AgentVocabV1,
  trace?: AgentGenerationTraceV1,
): KnowledgeIgnoranceResult {
  const rng = makeRng(facetSeed(seed, 'knowledge-ignorance'));
  const strengthsPool = vocab.knowledgeIgnorance?.knowledgeStrengths ?? [];
  const gapsPool = vocab.knowledgeIgnorance?.knowledgeGaps ?? [];
  const falseBeliefsPool = vocab.knowledgeIgnorance?.falseBeliefs ?? [];
  const sourcesPool = vocab.knowledgeIgnorance?.informationSources ?? [];
  const barriersPool = vocab.knowledgeIgnorance?.informationBarriers ?? [];

  const knowledgeStrengths = uniqueStrings(
    strengthsPool.length ? rng.pickK(strengthsPool, rng.int(2, 4)) : [],
  );
  const knowledgeGaps = uniqueStrings(
    gapsPool.length ? rng.pickK(gapsPool, rng.int(2, 4)) : [],
  );
  const falseBeliefs = uniqueStrings(
    falseBeliefsPool.length ? rng.pickK(falseBeliefsPool, rng.int(2, 4)) : [],
  );
  const informationSources = uniqueStrings(
    sourcesPool.length ? rng.pickK(sourcesPool, rng.int(2, 4)) : [],
  );
  const informationBarriers = uniqueStrings(
    barriersPool.length ? rng.pickK(barriersPool, rng.int(2, 4)) : [],
  );

  const result = { knowledgeStrengths, knowledgeGaps, falseBeliefs, informationSources, informationBarriers };
  traceSet(trace, 'psych.knowledgeIgnorance', result, {
    method: 'pickK',
    dependsOn: { vocab: 'knowledgeIgnorance' },
  });
  return result;
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
 * - Affect: emotional baseline, regulation style, stress tells, repair style
 * - Self-concept: self-story, impostor risk, social mask
 */
export function computePsychology(ctx: PsychologyContext): PsychologyResult {
  const {
    seed,
    vocab,
    latents,
    aptitudes,
    traits,
    tierBand,
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

  // Affect - emotional regulation and expression
  const affect = computeAffect(seed, vocab, latents, aptitudes, trace);

  // Self-concept - internal narrative and social presentation
  const selfConcept = computeSelfConcept(seed, vocab, latents, tierBand, roleSeedTags, trace);

  // Knowledge & ignorance - what they know, miss, or misbelieve
  const knowledgeIgnorance = computeKnowledgeIgnorance(seed, vocab, trace);

  return {
    ethics,
    contradictions,
    redLines,
    visibility,
    coverAptitudeTags,
    affect,
    selfConcept,
    knowledgeIgnorance,
  };
}
