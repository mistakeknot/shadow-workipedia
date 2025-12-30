/**
 * Simulation Facet - Deep simulation preview state computation
 *
 * Computes the "day 0" deep-sim preview snapshot for an agent.
 * This is not a simulation tick; it's a deterministic initial state that includes:
 * - Needs (sleep, safety, belonging, autonomy, competence, purpose, comfort)
 * - Mood (baseline and current)
 * - Stress and fatigue levels
 * - Active thoughts (with source, valence, intensity)
 * - Break risk and likely break types
 */

import type {
  Fixed,
  Band5,
  NeedTag,
  ThoughtSource,
  DeepSimPreviewV1,
  AgentVocabV1,
  TierBand,
  Latents,
  AgentGenerationTraceV1,
} from '../types';

import {
  makeRng,
  facetSeed,
  fnv1a32,
  clampFixed01k,
  clampSigned01k,
  clampInt,
  band5From01k,
  uniqueStrings,
  traceSet,
  traceFacet,
} from '../utils';

// ============================================================================
// Types
// ============================================================================

export type SimulationContext = {
  seed: string;
  vocab: AgentVocabV1;

  // Latent traits
  latents: Latents;

  // Psychological traits (0-1000)
  traits: {
    riskTolerance: Fixed;
    conscientiousness: Fixed;
    noveltySeeking: Fixed;
    agreeableness: Fixed;
    authoritarianism: Fixed;
  };

  // Aptitudes
  aptitudes: {
    attentionControl: Fixed;
    deceptionAptitude: Fixed;
    [key: string]: Fixed;
  };

  // Vices (for relapse break risk)
  vices: Array<{
    vice: string;
    severity: Band5;
    triggers: string[];
  }>;

  // Health data
  health: {
    chronicConditionTags: string[];
    allergyTags: string[];
  };

  // Spirituality (for thought processing)
  spirituality: {
    affiliationTag: string;
    observanceLevel: string;
    practiceTypes: string[];
  };

  // Network role (for break type scoring)
  network: {
    role: string;
    factionAlignment: string | null;
    leverageType: string;
  };

  // Demographics
  tierBand: TierBand;
  age: number;

  // Derived 0-1 scores
  cosmo01: number;
  inst01: number;
  risk01: number;
  opsec01: number;
  public01: number;

  // Visibility metrics
  publicVisibility: Fixed;
  paperTrail: Fixed;
  digitalHygiene: Fixed;

  // Media metrics
  attentionResilience: Fixed;
  doomscrollingRisk: Fixed;
  statusSignaling: Fixed;

  // Security context
  securityPressure01k: Fixed;

  // Skills average (for competence need)
  averageSkillValue01k: Fixed;

  // Role context
  roleSeedTags: string[];
  careerTrackTag: string;

  // Location context
  homeCountryIso3: string;
  currentCountryIso3: string;

  // Routines
  recoveryRituals: string[];

  // Vice tendency (pre-computed)
  viceTendency: number;

  // Trace
  trace?: AgentGenerationTraceV1;
};

export type SimulationResult = DeepSimPreviewV1;

// ============================================================================
// Constants
// ============================================================================

const OFFLINE_RECOVERY_RITUALS = new Set([
  'phone-free hour',
  'long walk',
  'gym session',
  'run',
  'swim laps',
  'sauna',
  'stretch and mobility',
  'martial arts class',
  'stargazing',
  'visit a museum',
]);

const POSITIVE_THOUGHTS = new Set([
  'well_rested',
  'calm_focus',
  'safe_for_now',
  'felt_supported',
  'felt_appreciated',
  'quiet_pride',
  'competent_today',
  'found_a_rhythm',
  'public_praise',
  'bond_strengthened',
  'body_feels_strong',
]);

// ============================================================================
// Helper Functions
// ============================================================================

function thoughtSourceFor(tag: string): ThoughtSource {
  if (tag.startsWith('mission_') || tag === 'near_miss') return 'ops';
  if (tag.includes('watched') || tag.includes('scrutiny') || tag.includes('privacy_compromised')) return 'exposure';
  if (tag.includes('doomscroll') || tag.includes('outrage') || tag.includes('paranoia') || tag === 'spiraling') return 'media';
  if (tag.startsWith('argument_') || tag.includes('trust_') || tag.includes('bond_') || tag === 'broken_promise') return 'relationship';
  if (tag.includes('headache') || tag.includes('shoulders') || tag.includes('body_')) return 'health';
  return 'obligation';
}

function thoughtValenceFor(tag: string): number {
  if (POSITIVE_THOUGHTS.has(tag)) return 600;
  if (tag === 'mission_success') return 800;
  if (tag === 'mission_failure') return -900;
  if (tag === 'moral_disquiet' || tag === 'guilt_weight') return -650;
  if (tag.includes('embarrassment') || tag.includes('backlash') || tag.includes('ignored') || tag.includes('used')) return -700;
  if (tag.includes('slept') || tag.includes('restless') || tag.includes('spiraling') || tag.includes('ruminating')) return -550;
  if (tag.startsWith('needed_')) return -350;
  return -450;
}

// ============================================================================
// Main Computation
// ============================================================================

export function computeSimulation(ctx: SimulationContext): SimulationResult {
  const {
    seed,
    vocab,
    latents,
    traits,
    aptitudes,
    vices,
    spirituality,
    age,
    inst01,
    risk01,
    opsec01,
    public01,
    publicVisibility,
    paperTrail,
    attentionResilience,
    doomscrollingRisk,
    statusSignaling,
    securityPressure01k,
    averageSkillValue01k,
    roleSeedTags,
    careerTrackTag,
    homeCountryIso3,
    currentCountryIso3,
    recoveryRituals,
    viceTendency,
    trace,
  } = ctx;

  traceFacet(trace, seed, 'deep_sim_preview');
  const previewRng = makeRng(facetSeed(seed, 'deep_sim_preview'));
  const previewAbroad = currentCountryIso3 !== homeCountryIso3;
  const recoveryOffline = recoveryRituals.some(r => OFFLINE_RECOVERY_RITUALS.has(r));

  // Stable noise function for deterministic small variations
  const stableNoise = (key: string): number => {
    const n = fnv1a32(`${seed}::deep_sim_preview_noise::${key}`) >>> 0;
    return ((n / 0xffff_ffff) - 0.5) * 0.04; // [-0.02, +0.02]
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // BASELINE MOOD
  // ─────────────────────────────────────────────────────────────────────────────
  const baselineMood01k = clampSigned01k(
    -140 +
      420 * (traits.agreeableness / 1000) +
      220 * (traits.conscientiousness / 1000) +
      160 * (latents.socialBattery / 1000) -
      520 * (latents.stressReactivity / 1000) -
      220 * (doomscrollingRisk / 1000) +
      220 * (attentionResilience / 1000) +
      previewRng.int(-120, 120),
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // STRESS
  // ─────────────────────────────────────────────────────────────────────────────
  const stress01k = clampFixed01k(
    Math.round(
      240 +
        520 * (latents.stressReactivity / 1000) +
        240 * (1 - latents.impulseControl / 1000) +
        240 * public01 +
        260 * (securityPressure01k / 1000) +
        220 * (paperTrail / 1000) +
        200 * (doomscrollingRisk / 1000) -
        220 * opsec01 -
        140 * (attentionResilience / 1000) -
        140 * (latents.physicalConditioning / 1000) +
        (recoveryOffline ? -60 : 0) +
        previewRng.int(-90, 90),
    ),
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // FATIGUE
  // ─────────────────────────────────────────────────────────────────────────────
  const fatigue01k = clampFixed01k(
    Math.round(
      270 +
        200 * (1 - traits.conscientiousness / 1000) +
        200 * (doomscrollingRisk / 1000) +
        220 * (stress01k / 1000) +
        140 * (age / 100) -
        260 * (latents.physicalConditioning / 1000) -
        120 * (aptitudes.attentionControl / 1000) +
        (recoveryOffline ? -40 : 0) +
        previewRng.int(-80, 80),
    ),
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // NEEDS
  // ─────────────────────────────────────────────────────────────────────────────
  const needs01k: Record<NeedTag, Fixed> = {
    sleep: clampFixed01k(Math.round(720 - 0.55 * fatigue01k - 0.20 * stress01k + 120 * (traits.conscientiousness / 1000) + previewRng.int(-60, 60))),
    safety: clampFixed01k(
      Math.round(
        720 +
          220 * opsec01 -
          260 * public01 -
          170 * (paperTrail / 1000) -
          220 * (securityPressure01k / 1000) +
          previewRng.int(-70, 70),
      ),
    ),
    belonging: clampFixed01k(
      Math.round(
        640 +
          260 * (latents.socialBattery / 1000) +
          120 * (traits.agreeableness / 1000) -
          (previewAbroad ? 170 : 0) -
          160 * (stress01k / 1000) +
          previewRng.int(-70, 70),
      ),
    ),
    autonomy: clampFixed01k(
      Math.round(620 + 190 * (1 - inst01) + 120 * (latents.planningHorizon / 1000) - 120 * (paperTrail / 1000) + previewRng.int(-60, 60)),
    ),
    competence: clampFixed01k(
      Math.round(
        640 +
          0.22 * averageSkillValue01k +
          160 * (traits.conscientiousness / 1000) +
          80 * (latents.techFluency / 1000) -
          150 * (fatigue01k / 1000) -
          90 * (stress01k / 1000) +
          previewRng.int(-60, 60),
      ),
    ),
    purpose: clampFixed01k(
      Math.round(
        600 +
          240 * (latents.principledness / 1000) +
          120 * inst01 +
          (roleSeedTags.includes('organizer') ? 70 : 0) +
          (roleSeedTags.includes('diplomat') ? 40 : 0) -
          160 * (stress01k / 1000) +
          previewRng.int(-70, 70),
      ),
    ),
    comfort: clampFixed01k(
      Math.round(
        620 +
          100 * (traits.conscientiousness / 1000) +
          120 * (latents.frugality / 1000) +
          60 * (1 - risk01) -
          180 * (fatigue01k / 1000) +
          (recoveryOffline ? 40 : 0) +
          previewRng.int(-70, 70),
      ),
    ),
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // MOOD (needs-adjusted)
  // ─────────────────────────────────────────────────────────────────────────────
  const mood01k = clampSigned01k(
    baselineMood01k +
      0.22 * (needs01k.sleep - 600) +
      0.18 * (needs01k.safety - 600) +
      0.18 * (needs01k.belonging - 600) +
      0.10 * (needs01k.autonomy - 600) +
      0.14 * (needs01k.competence - 600) +
      0.18 * (needs01k.purpose - 600) +
      0.10 * (needs01k.comfort - 600) -
      0.70 * (stress01k - 500) -
      0.55 * (fatigue01k - 500),
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // THOUGHTS
  // ─────────────────────────────────────────────────────────────────────────────
  const thoughtScore = (tag: string): number => {
    const n = stableNoise(tag);
    let s = 0;

    // Sleep-related thoughts
    if (tag === 'well_rested') s += Math.max(0, (needs01k.sleep - 650) / 250);
    if (tag === 'slept_poorly' || tag === 'restless_night') s += Math.max(0, (600 - needs01k.sleep) / 260);

    // Stress/calm thoughts
    if (tag === 'on_edge') s += Math.max(0, (stress01k - 520) / 300);
    if (tag === 'calm_focus') s += Math.max(0, (520 - stress01k) / 320) + Math.max(0, (needs01k.competence - 650) / 300);

    // Safety/exposure thoughts
    if (tag === 'felt_watched' || tag === 'too_much_scrutiny' || tag === 'privacy_compromised') {
      s += Math.max(0, (620 - needs01k.safety) / 260) + 0.35 * public01 + 0.20 * (securityPressure01k / 1000);
    }
    if (tag === 'safe_for_now') s += Math.max(0, (needs01k.safety - 650) / 280) + 0.25 * opsec01;

    // Belonging thoughts
    if (tag === 'homesick' || tag === 'lonely_in_a_crowd' || tag === 'missed_a_friend') {
      s += Math.max(0, (620 - needs01k.belonging) / 260) + (previewAbroad ? 0.25 : 0) + 0.15 * (stress01k / 1000);
    }
    if (tag === 'felt_supported' || tag === 'felt_appreciated') {
      s += Math.max(0, (needs01k.belonging - 650) / 300) + 0.20 * (traits.agreeableness / 1000);
      // Religious community provides belonging
      if (spirituality.practiceTypes.includes('community-worship')) s += 0.12;
    }
    if (tag === 'felt_used' || tag === 'felt_ignored') s += Math.max(0, (650 - needs01k.autonomy) / 280) + 0.12 * inst01;

    // Work/bureaucracy thoughts
    if (tag === 'bureaucratic_grind' || tag === 'paperwork_backlog' || tag === 'meeting_fatigue') {
      s += 0.10 + 0.15 * inst01 + (careerTrackTag === 'civil-service' ? 0.35 : 0) + (careerTrackTag === 'corporate-ops' ? 0.10 : 0);
    }
    if (tag === 'deadline_pressure' || tag === 'uncertainty_spike' || tag === 'plans_disrupted' || tag === 'loss_of_control') {
      s += Math.max(0, (stress01k - 480) / 340) + 0.20 * (1 - latents.impulseControl / 1000) + 0.10 * (1 - latents.planningHorizon / 1000);
    }
    if (tag === 'routine_disrupted') s += Math.max(0, (fatigue01k - 520) / 360) + 0.15 * (traits.noveltySeeking / 1000);
    if (tag === 'found_a_rhythm') s += Math.max(0, (520 - fatigue01k) / 360) + 0.10 * (traits.conscientiousness / 1000);

    // Media/doomscrolling thoughts
    if (tag === 'doomscroll_fog' || tag === 'outrage_fatigue' || tag === 'paranoia_spike' || tag === 'spiraling') {
      s += 0.05 + 0.45 * (doomscrollingRisk / 1000) + 0.20 * (stress01k / 1000) - 0.20 * (attentionResilience / 1000);
    }

    // Moral/guilt thoughts - influenced by spirituality
    if (tag === 'moral_disquiet' || tag === 'guilt_weight') {
      s += 0.06 + 0.35 * (latents.principledness / 1000) + 0.15 * (latents.stressReactivity / 1000) - 0.12 * (traits.agreeableness / 1000);
      // Devout and observant agents experience stronger moral/guilt processing
      if (spirituality.observanceLevel === 'strict' || spirituality.observanceLevel === 'devout') s += 0.25;
      else if (spirituality.observanceLevel === 'observant') s += 0.15;
      else if (spirituality.observanceLevel === 'moderate') s += 0.08;
    }

    // Spirituality-influenced meaning need
    if (tag === 'needed_meaning') {
      if (spirituality.observanceLevel === 'strict' || spirituality.observanceLevel === 'devout') s += 0.18;
      else if (spirituality.observanceLevel === 'observant') s += 0.10;
    }

    // Status/competence thoughts
    if (tag === 'status_anxiety' || tag === 'imposter_syndrome') {
      s += 0.05 + 0.30 * (statusSignaling / 1000) + 0.25 * (publicVisibility / 1000) + 0.15 * (1 - needs01k.competence / 1000);
    }
    if (tag === 'quiet_pride' || tag === 'competent_today') {
      s += Math.max(0, (needs01k.purpose - 650) / 340) + Math.max(0, (needs01k.competence - 650) / 340);
    }

    // Public visibility thoughts
    if (tag === 'public_backlash') s += 0.05 + 0.40 * (publicVisibility / 1000);
    if (tag === 'public_embarrassment') s += 0.05 + 0.30 * (publicVisibility / 1000);

    // Body/health thoughts
    if (tag === 'tension_headache' || tag === 'stiff_shoulders') s += 0.05 + 0.35 * (stress01k / 1000) + 0.20 * (fatigue01k / 1000);
    if (tag === 'body_feels_strong') s += 0.05 + 0.30 * (latents.physicalConditioning / 1000) + Math.max(0, (needs01k.sleep - 650) / 360);

    // Need-specific thoughts
    if (tag.startsWith('needed_')) {
      const needTag = tag.replace(/^needed_/, '');
      if (needTag === 'company') s += Math.max(0, (620 - needs01k.belonging) / 300) + 0.20 * (latents.socialBattery / 1000);
      if (needTag === 'silence') s += Math.max(0, (stress01k - 520) / 340) + 0.20 * (1 - latents.socialBattery / 1000);
      if (needTag === 'control') s += Math.max(0, (620 - needs01k.autonomy) / 300) + 0.20 * (1 - latents.impulseControl / 1000);
      if (needTag === 'meaning') s += Math.max(0, (620 - needs01k.purpose) / 300) + 0.20 * (latents.principledness / 1000);
      if (needTag === 'walk') s += Math.max(0, (fatigue01k - 520) / 360) + 0.10 * (1 - latents.physicalConditioning / 1000);
    }

    // Role-flavored baseline thoughts
    if (roleSeedTags.includes('media') && (tag === 'too_much_scrutiny' || tag === 'public_backlash')) s += 0.25;
    if ((roleSeedTags.includes('operative') || roleSeedTags.includes('security')) && (tag === 'on_edge' || tag === 'loss_of_control' || tag === 'felt_watched')) s += 0.20;
    if (roleSeedTags.includes('analyst') && (tag === 'ruminating' || tag === 'imposter_syndrome')) s += 0.15;

    return Math.max(0, s + n);
  };

  const thoughtPool = uniqueStrings(vocab.deepSimPreview?.thoughtTags ?? []);
  const thoughtCount = clampInt(3 + previewRng.int(0, 2), 2, 6);
  const scoredThoughts = thoughtPool.map(tag => ({ tag, score: thoughtScore(tag) }));
  let chosenThoughtTags = scoredThoughts
    .filter(x => x.score > 0.10)
    .sort((a, b) => (b.score - a.score) || a.tag.localeCompare(b.tag))
    .slice(0, thoughtCount)
    .map(x => x.tag);
  if (!chosenThoughtTags.length) {
    chosenThoughtTags = scoredThoughts.sort((a, b) => (b.score - a.score) || a.tag.localeCompare(b.tag)).slice(0, 3).map(x => x.tag);
  }

  const thoughts = chosenThoughtTags.slice(0, thoughtCount).map((tag) => {
    const sc = thoughtScore(tag);
    const intensity01k = clampFixed01k(Math.round(220 + 760 * sc));
    const tagRng = makeRng(fnv1a32(`${seed}::deep_sim_preview::thought::${tag}`));
    const expiresDay = clampInt(tagRng.int(2, 8), 1, 30);
    return { tag, source: thoughtSourceFor(tag), valence: thoughtValenceFor(tag), intensity01k, expiresDay };
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // BREAK RISK
  // ─────────────────────────────────────────────────────────────────────────────
  const breakRisk01k = clampFixed01k(
    Math.round(
      120 +
        0.55 * stress01k +
        0.45 * fatigue01k +
        0.25 * Math.max(0, 600 - needs01k.safety) +
        0.18 * Math.max(0, 600 - needs01k.sleep) +
        0.18 * Math.max(0, 600 - needs01k.purpose) +
        220 * (1 - latents.impulseControl / 1000) +
        160 * (latents.stressReactivity / 1000) +
        120 * (latents.riskAppetite / 1000) +
        120 * viceTendency -
        140 * opsec01 -
        120 * (traits.conscientiousness / 1000) +
        previewRng.int(-90, 90),
    ),
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // BREAK TYPES
  // ─────────────────────────────────────────────────────────────────────────────
  const breakTypeScore = (type: string): number => {
    const n = stableNoise(`break:${type}`);
    const safetyDef = Math.max(0, 650 - needs01k.safety) / 650;
    const belongDef = Math.max(0, 650 - needs01k.belonging) / 650;
    const purposeDef = Math.max(0, 650 - needs01k.purpose) / 650;
    const stress = stress01k / 1000;
    const fatigue = fatigue01k / 1000;
    const impulseLo = 1 - latents.impulseControl / 1000;
    const opsecLo = 1 - opsec01;

    if (type === 'withdrawal') return Math.max(0, 0.15 + 0.45 * belongDef + 0.30 * fatigue + 0.25 * (1 - latents.socialBattery / 1000) + n);
    if (type === 'panic') return Math.max(0, 0.15 + 0.55 * safetyDef + 0.45 * stress + 0.25 * impulseLo + n);
    if (type === 'rage') return Math.max(0, 0.10 + 0.50 * fatigue + 0.35 * stress + 0.30 * (1 - traits.agreeableness / 1000) + 0.10 * impulseLo + n);
    if (type === 'confession_leak') return Math.max(0, 0.08 + 0.55 * safetyDef + 0.25 * (publicVisibility / 1000) + 0.25 * opsecLo + 0.20 * stress + n);
    if (type === 'sabotage') return Math.max(0, 0.08 + 0.50 * purposeDef + 0.35 * stress + 0.20 * impulseLo + 0.15 * (aptitudes.deceptionAptitude / 1000) + n);
    if (type === 'defection_attempt') return Math.max(0, 0.06 + 0.55 * safetyDef + 0.45 * purposeDef + 0.25 * (latents.cosmopolitanism / 1000) + 0.15 * risk01 + n);
    // Relapse break type - weighted by vice severity
    if (type === 'relapse') {
      const maxViceSeverity = vices.length > 0
        ? Math.max(...vices.map(v => {
            const severityMap: Record<Band5, number> = { very_low: 0.2, low: 0.4, medium: 0.6, high: 0.8, very_high: 1.0 };
            return severityMap[v.severity] ?? 0.5;
          }))
        : 0;
      return Math.max(0, 0.05 + 0.40 * maxViceSeverity + 0.25 * stress + 0.20 * fatigue + n);
    }
    // Default fallback
    return Math.max(0, 0.05 + 0.30 * stress + 0.30 * fatigue + n);
  };

  const breakTypesPool = uniqueStrings(vocab.deepSimPreview?.breakTypes ?? []);
  const breakTypesTopK = breakTypesPool
    .map(type => ({ type, score: breakTypeScore(type) }))
    .sort((a, b) => (b.score - a.score) || a.type.localeCompare(b.type))
    .slice(0, 2)
    .map(x => x.type);

  // ─────────────────────────────────────────────────────────────────────────────
  // RESULT
  // ─────────────────────────────────────────────────────────────────────────────
  const deepSimPreview: DeepSimPreviewV1 = {
    version: 1,
    day0: 0,
    needs01k,
    baselineMood01k,
    mood01k,
    stress01k,
    fatigue01k,
    thoughts,
    breakRisk01k,
    breakRiskBand: band5From01k(breakRisk01k),
    breakTypesTopK,
  };

  traceSet(trace, 'deepSimPreview', deepSimPreview, {
    method: 'facetSeededSnapshot',
    dependsOn: {
      facet: 'deep_sim_preview',
      abroad: previewAbroad,
      recoveryOffline,
      securityPressure01k,
      publicVisibility,
      paperTrail,
      digitalHygiene: ctx.digitalHygiene,
    },
  });

  return deepSimPreview;
}
