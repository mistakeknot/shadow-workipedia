/**
 * Lifestyle Facet - Health, vices, logistics, and life circumstances
 *
 * Handles:
 * - Health (chronic conditions, allergies)
 * - Vices (substance/behavioral issues with triggers)
 * - Logistics (identity kit items)
 * - Neurodivergence (indicator tags, coping strategies)
 * - Spirituality (affiliation, observance, practices)
 * - Background (adversity, resilience)
 * - Mobility (passport access, travel frequency)
 */

import type {
  Fixed,
  Band5,
  TierBand,
  AgentVocabV1,
  AgentPriorsV1,
  Latents,
  AgentGenerationTraceV1,
} from '../types';

import {
  makeRng,
  facetSeed,
  clampFixed01k,
  band5From01k,
  weightedPick,
  weightedPickKUnique,
  uniqueStrings,
  traceSet,
  traceFacet,
} from '../utils';

// ============================================================================
// Types
// ============================================================================

export type LifestyleContext = {
  seed: string;
  vocab: AgentVocabV1;
  priors?: AgentPriorsV1;

  // Demographics
  age: number;
  tierBand: TierBand;
  homeCountryIso3: string;
  homeCulture: string;
  cohortBucketStartYear: number;

  // Latents (full model)
  latents: Latents;

  // Derived 0-1 scores
  cosmo01: number;
  inst01: number;
  risk01: number;
  opsec01: number;
  public01: number;

  // Traits (0-1000)
  traits: {
    riskTolerance: Fixed;
    conscientiousness: Fixed;
    noveltySeeking: Fixed;
    agreeableness: Fixed;
    authoritarianism: Fixed;
  };

  // Aptitudes
  aptitudes: {
    endurance: Fixed;
    attentionControl: Fixed;
    [key: string]: Fixed;
  };

  // Career/role context
  roleSeedTags: string[];
  careerTrackTag: string;

  // Country priors bucket (for background adversity)
  countryPriorsBucket?: {
    securityEnvironment01k?: Partial<Record<'conflict' | 'stateViolence' | 'militarization', Fixed>>;
    mobility01k?: Partial<Record<'passportAccess' | 'travelFrequency', Fixed>>;
  };

  // Food preferences (for vice restrictions)
  restrictions: string[];

  // Visibility scores (for stress/vice calculations)
  publicVisibility: Fixed;
  paperTrail: Fixed;
  attentionResilience: Fixed;
  doomscrollingRisk: Fixed;

  // Security environment
  securityPressure01k: Fixed;
  conflictEnv01k: Fixed;
  stateViolenceEnv01k: Fixed;

  // Vice tendency (pre-computed)
  viceTendency: number;

  // Travel score for logistics (pre-computed)
  travelScore: Fixed;

  // Trace
  trace?: AgentGenerationTraceV1;
};

export type LifestyleResult = {
  health: {
    chronicConditionTags: string[];
    allergyTags: string[];
  };
  vices: Array<{
    vice: string;
    severity: Band5;
    triggers: string[];
  }>;
  logistics: {
    identityKit: Array<{ item: string; security: Band5; compromised: boolean }>;
  };
  neurodivergence: {
    indicatorTags: string[];
    copingStrategies: string[];
  };
  spirituality: {
    tradition: string;
    affiliationTag: string;
    observanceLevel: string;
    practiceTypes: string[];
  };
  background: {
    adversityTags: string[];
    resilienceIndicators: string[];
  };
  mobility: {
    passportAccessBand: Band5;
    mobilityTag: string;
    travelFrequencyBand: Band5;
  };
};

// ============================================================================
// Main computation
// ============================================================================

export function computeLifestyle(ctx: LifestyleContext): LifestyleResult {
  const { seed, vocab, age, traits, aptitudes, viceTendency, trace } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // SPIRITUALITY (computed first for Correlate #7: Religiosity ↔ Vices)
  // ─────────────────────────────────────────────────────────────────────────────
  // Must be computed before vices to inform vice restrictions
  const spirituality = computeSpirituality(ctx);

  // ─────────────────────────────────────────────────────────────────────────────
  // HEALTH (Correlate #2: Tier ↔ Health/Chronic Conditions)
  // ─────────────────────────────────────────────────────────────────────────────
  // Elite tier has better healthcare access → lower chronic condition rates
  // Mass tier faces environmental/occupational health risks → higher rates
  traceFacet(trace, seed, 'health');
  const healthRng = makeRng(facetSeed(seed, 'health'));
  const chronicPool = uniqueStrings(vocab.health?.chronicConditionTags ?? []);
  const allergyPool = uniqueStrings(vocab.health?.allergyTags ?? []);
  const endurance01 = aptitudes.endurance / 1000;

  // Tier-based health modifier: elite has better healthcare, mass has more exposure
  const tierHealthModifier = ctx.tierBand === 'elite' ? -0.15 : ctx.tierBand === 'mass' ? 0.12 : 0;
  const chronicChance = Math.min(0.65, Math.max(0.04,
    age / 210 +
    0.10 * (1 - endurance01) +
    0.10 * viceTendency +
    tierHealthModifier
  ));
  const chronicConditionTags = chronicPool.length && healthRng.next01() < chronicChance
    ? healthRng.pickK(chronicPool, healthRng.int(1, 2))
    : [];
  const allergyChance = 0.22 + 0.10 * (traits.agreeableness / 1000);
  const allergyTags = allergyPool.length && healthRng.next01() < allergyChance
    ? healthRng.pickK(allergyPool, 1)
    : [];
  traceSet(trace, 'health', { chronicConditionTags, allergyTags }, {
    method: 'probabilisticPickK',
    dependsOn: { facet: 'health', age, endurance01, viceTendency, chronicChance, allergyChance, tierBand: ctx.tierBand, chronicPoolSize: chronicPool.length, allergyPoolSize: allergyPool.length },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // VICES (Correlate #7: Religiosity ↔ Vices)
  // ─────────────────────────────────────────────────────────────────────────────
  // Pass spirituality observance level to influence vice selection
  const vices = computeVices(ctx, spirituality.observanceLevel);

  // ─────────────────────────────────────────────────────────────────────────────
  // LOGISTICS
  // ─────────────────────────────────────────────────────────────────────────────
  const identityKit = computeLogistics(ctx);

  // ─────────────────────────────────────────────────────────────────────────────
  // NEURODIVERGENCE
  // ─────────────────────────────────────────────────────────────────────────────
  const neurodivergence = computeNeurodivergence(ctx);

  // ─────────────────────────────────────────────────────────────────────────────
  // BACKGROUND
  // ─────────────────────────────────────────────────────────────────────────────
  const background = computeBackground(ctx);

  // ─────────────────────────────────────────────────────────────────────────────
  // MOBILITY
  // ─────────────────────────────────────────────────────────────────────────────
  const mobility = computeMobility(ctx);

  return {
    health: { chronicConditionTags, allergyTags },
    vices,
    logistics: { identityKit },
    neurodivergence,
    spirituality,
    background,
    mobility,
  };
}

// ============================================================================
// Vice computation (Correlate #7: Religiosity ↔ Vices)
// ============================================================================

function computeVices(ctx: LifestyleContext, observanceLevel: string): LifestyleResult['vices'] {
  const {
    seed,
    vocab,
    tierBand,
    latents,
    cosmo01,
    inst01,
    risk01,
    opsec01,
    public01,
    traits,
    restrictions,
    publicVisibility,
    paperTrail,
    attentionResilience,
    doomscrollingRisk,
    securityPressure01k,
    conflictEnv01k,
    stateViolenceEnv01k,
    viceTendency,
    trace,
  } = ctx;

  traceFacet(trace, seed, 'vices');
  const vicesRng = makeRng(facetSeed(seed, 'vices'));

  if (!vocab.vices.vicePool.length) throw new Error('Agent vocab missing: vices.vicePool');
  if (!vocab.vices.triggers.length) throw new Error('Agent vocab missing: vices.triggers');

  // Stress load calculation
  const stressLoad01k = clampFixed01k(
    0.30 * securityPressure01k +
      0.22 * publicVisibility +
      0.20 * paperTrail +
      0.20 * (1000 - attentionResilience) +
      0.08 * latents.stressReactivity +
      0.10 * vicesRng.int(0, 1000),
  );
  if (trace) trace.derived.stressLoad01k = stressLoad01k;

  // Vice tendency modulated by conflict environment AND support/resilience
  const conflictViceBoost = 0.08 * (conflictEnv01k / 1000) + 0.06 * (stateViolenceEnv01k / 1000);
  const resilienceBuffer = 0.04 * (traits.agreeableness / 1000) + 0.03 * inst01;
  const adjustedViceTendency = Math.min(1, Math.max(0, viceTendency + conflictViceBoost - resilienceBuffer));
  let viceCount = adjustedViceTendency > 0.78 ? 2 : adjustedViceTendency > 0.42 ? 1 : (vicesRng.next01() < 0.22 ? 1 : 0);
  if (stressLoad01k > 750 && viceCount < 2) viceCount += 1;
  // High conflict environments: increased vice probability BUT offset by high conscientiousness
  const conflictViceChance = Math.max(0, 0.25 - 0.15 * (traits.conscientiousness / 1000));
  if (conflictEnv01k > 500 && viceCount < 2 && vicesRng.next01() < conflictViceChance) viceCount += 1;

  // ─────────────────────────────────────────────────────────────────────────────
  // RELIGIOSITY ↔ VICES CORRELATE
  // ─────────────────────────────────────────────────────────────────────────────
  // High religious observance → fewer vices and specific restrictions
  // Strict: very unlikely to have vices, strong substance restrictions
  // Observant: reduced vices, some substance restrictions
  // Moderate: mild reduction in vice tendency
  const religiousViceReduction = (() => {
    if (observanceLevel === 'strict') return 0.7; // 70% reduction
    if (observanceLevel === 'observant') return 0.4; // 40% reduction
    if (observanceLevel === 'moderate') return 0.15; // 15% reduction
    return 0; // none, cultural: no reduction
  })();
  // Reduce vice count based on religiosity
  if (religiousViceReduction > 0 && viceCount > 0 && vicesRng.next01() < religiousViceReduction) {
    viceCount = Math.max(0, viceCount - 1);
  }

  const bannedVices = new Set<string>();
  if (restrictions.includes('no alcohol')) bannedVices.add('alcohol');
  if (restrictions.includes('no caffeine')) bannedVices.add('caffeine');
  // Religious bans on specific substances/behaviors
  if (observanceLevel === 'strict' || observanceLevel === 'observant') {
    bannedVices.add('alcohol');
    bannedVices.add('gambling');
    if (observanceLevel === 'strict') {
      bannedVices.add('stims'); // No stimulant drugs for strictly observant
      bannedVices.add('nicotine');
    }
  }

  const viceWeights = vocab.vices.vicePool.map((v) => {
    const key = v.toLowerCase();
    let w = 1;
    if (key === 'doomscrolling' || key === 'compulsive news') w += 2.2 * (1 - opsec01) + 1.3 * public01;
    if (key === 'gambling' || key === 'risk-taking') w += 2.0 * risk01;
    if (key === 'workaholism' || key === 'caffeine') w += 1.6 * inst01 + (tierBand === 'elite' ? 0.6 : 0);
    if (key === 'shopping') w += 0.9 * (1 - traits.conscientiousness / 1000);
    if (key === 'nicotine') w += 0.6 * (1 - traits.conscientiousness / 1000);
    if (key === 'stims') w += 1.0 * risk01 + 0.7 * (1 - traits.conscientiousness / 1000);
    if (key === 'alcohol') w += 0.9 * (1 - traits.agreeableness / 1000) + 0.6 * (1 - opsec01);
    if (key === 'doomscrolling' || key === 'compulsive news') w += 1.2 * (doomscrollingRisk / 1000);
    if (key === 'shopping') w += 0.9 * (1 - latents.frugality / 1000);
    if (key === 'alcohol' || key === 'stims') w += 0.8 * (stressLoad01k / 1000) + 0.5 * (1 - latents.impulseControl / 1000);
    if (key === 'binge watching') w += 0.8 * (doomscrollingRisk / 1000) + 0.4 * (stressLoad01k / 1000);
    if (key === 'online arguing') w += 0.9 * public01 + 0.7 * (1 - traits.agreeableness / 1000);
    if (key === 'late-night snacking') w += 0.8 * (stressLoad01k / 1000) + 0.6 * (1 - latents.impulseControl / 1000);
    if (key === 'gaming marathons') w += 0.6 * (traits.noveltySeeking / 1000) + 0.5 * (1 - traits.conscientiousness / 1000);
    if (key === 'overtraining') w += 0.8 * (latents.physicalConditioning / 1000) + 0.4 * (1 - latents.impulseControl / 1000);
    if (key === 'perfectionism') w += 0.8 * (traits.conscientiousness / 1000) + 0.4 * inst01;
    if (key === 'doom spending') w += 1.0 * (1 - latents.frugality / 1000) + 0.4 * (stressLoad01k / 1000);
    if (key === 'collecting gadgets') w += 0.8 * (latents.techFluency / 1000) + 0.5 * (1 - latents.frugality / 1000);
    if (key === 'impulse travel') w += 0.9 * cosmo01 + 0.5 * (latents.adaptability / 1000) + 0.4 * (1 - latents.impulseControl / 1000);
    if (key === 'social media posting') w += 1.1 * public01 + 0.6 * (1 - opsec01);
    if (bannedVices.has(key)) w = 0;
    return { item: v, weight: w };
  });
  if (trace) trace.derived.viceWeightsTop = [...viceWeights].sort((a, b) => (b.weight - a.weight) || a.item.localeCompare(b.item)).slice(0, 10);

  const viceRepairRng = makeRng(facetSeed(seed, 'vices_repair'));
  const pickReplacementVice = (exclude: Set<string>): string | null => {
    const pool = viceWeights.filter(x => x.weight > 0 && !exclude.has(x.item.toLowerCase()));
    if (!pool.length) return null;
    return weightedPick(viceRepairRng, pool);
  };

  const selectedVicesRaw = weightedPickKUnique(vicesRng, viceWeights, viceCount);
  const selectedVices = (() => {
    const out: string[] = [];
    const exclude = new Set<string>();
    for (const v of selectedVicesRaw) {
      const key = v.toLowerCase();
      if (!bannedVices.has(key) && !exclude.has(key)) {
        out.push(v);
        exclude.add(key);
        continue;
      }
      const repl = pickReplacementVice(exclude);
      if (repl) {
        out.push(repl);
        exclude.add(repl.toLowerCase());
      }
    }
    return out;
  })();

  const requiredAny = (haystack: string[], group: string[]) => group.some(t => haystack.includes(t));
  const pickFromGroup = (group: string[]): string | null => {
    const avail = group.filter(t => vocab.vices.triggers.includes(t));
    if (!avail.length) return null;
    return avail[viceRepairRng.int(0, avail.length - 1)]!;
  };
  const viceTriggerRepairs: Array<{ vice: string; rule: string; added: string }> = [];

  const vices = selectedVices.map((vice) => {
    const base = vicesRng.int(100, 950);
    const bias = Math.round(
      190 * (1 - opsec01) +
        160 * risk01 +
        120 * public01 +
        140 * (stressLoad01k / 1000) +
        60 * (latents.stressReactivity / 1000),
    );
    const severityValue = clampFixed01k(base + bias);
    let triggers = uniqueStrings(vicesRng.pickK(vocab.vices.triggers, vicesRng.int(1, 3)));
    const ensureOneOf = (group: string[], rule: string) => {
      if (requiredAny(triggers, group)) return;
      const picked = pickFromGroup(group);
      if (!picked) return;
      triggers = uniqueStrings([picked, ...triggers]).slice(0, 3);
      viceTriggerRepairs.push({ vice, rule, added: picked });
    };

    if (publicVisibility > 700) ensureOneOf(['public backlash', 'humiliation', 'unexpected scrutiny', 'social comparison'], 'publicVisibility');
    if (securityPressure01k > 600) ensureOneOf(['fear', 'mission failure', 'loss of control', 'security scare'], 'securityPressure');
    if (paperTrail > 650) ensureOneOf(['deadline pressure', 'uncertainty', 'paperwork backlog', 'bureaucratic gridlock'], 'paperTrail');
    return { vice, severity: band5From01k(severityValue), triggers };
  });
  if (trace && viceTriggerRepairs.length) trace.derived.viceTriggerRepairs = viceTriggerRepairs;
  traceSet(trace, 'vices', vices, {
    method: 'weightedPickKUnique+repairs+severityFormula',
    dependsOn: { facet: 'vices', viceTendency, viceCount, stressLoad01k, opsec01, risk01, public01, bannedVices: [...bannedVices] },
  });

  return vices;
}

// ============================================================================
// Logistics computation
// ============================================================================

function computeLogistics(ctx: LifestyleContext): LifestyleResult['logistics']['identityKit'] {
  const {
    seed,
    vocab,
    tierBand,
    latents,
    opsec01,
    inst01,
    risk01,
    public01,
    cosmo01,
    roleSeedTags,
    careerTrackTag,
    travelScore,
    traits,
    trace,
  } = ctx;

  traceFacet(trace, seed, 'logistics');
  const logisticsRng = makeRng(facetSeed(seed, 'logistics'));

  if (!vocab.logistics.identityKitItems.length) throw new Error('Agent vocab missing: logistics.identityKitItems');

  const kitWeights = vocab.logistics.identityKitItems.map((item) => {
    const key = item.toLowerCase();
    let w = 1;
    if (key.includes('burner') || key.includes('encrypted') || key.includes('dead drop') || key.includes('lockpick') || key.includes('lock pick')) {
      w += 2.2 * opsec01 + (roleSeedTags.includes('operative') ? 0.7 : 0) + (careerTrackTag === 'intelligence' ? 0.6 : 0);
    }
    if (key.includes('passport') || key.includes('visa')) w += 1.6 * (travelScore / 1000) + 0.6 * cosmo01;
    if (key.includes('laptop') || key.includes('phone')) w += 0.7 + 0.4 * opsec01;
    if (key.includes('press') || key.includes('camera')) w += 1.6 * public01 + (roleSeedTags.includes('media') ? 0.8 : 0);
    if (key.includes('cash') || key.includes('currency')) w += 0.7 * risk01 + 0.3 * (1 - opsec01);
    if (key.includes('security key') || key.includes('privacy screen') || key.includes('rfid') || key.includes('hotspot')) {
      w += 1.3 * (latents.techFluency / 1000) + 0.4 * opsec01;
    }
    if (key.includes('business card') || key.includes('invitation') || key.includes('itinerary')) w += 0.7 * inst01 + 0.6 * public01;
    if (key.includes('adapter') || key.includes('charging')) w += 0.4 + 0.6 * (travelScore / 1000);
    if (key.includes('keepsake')) w += 0.2 * (traits.agreeableness / 1000);
    return { item, weight: w };
  });
  if (trace) {
    trace.derived.identityKitWeightsTop = [...kitWeights].sort((a, b) => (b.weight - a.weight) || a.item.localeCompare(b.item)).slice(0, 8);
  }

  let pickedKitItems = weightedPickKUnique(logisticsRng, kitWeights, 5);
  const identityKitRepairs: Array<{ rule: string; removed: string | null; added: string }> = [];

  const pickKitCandidate = (cands: string[]): string | null => {
    const available = cands.filter(c => vocab.logistics.identityKitItems.includes(c));
    if (!available.length) return null;
    return available[logisticsRng.int(0, available.length - 1)]!;
  };

  const roleKitCandidates: Array<{ role: string; candidates: string[] }> = [
    { role: 'media', candidates: ['press credential', 'camera', 'audio recorder', 'contacts card'] },
    { role: 'operative', candidates: ['burner phone', 'encrypted drive', 'spare SIMs', 'lock pick set'] },
    { role: 'security', candidates: ['encrypted drive', 'burner phone', 'first aid pouch', 'lock pick set'] },
    { role: 'diplomat', candidates: ['passport set', 'cover documents', 'business cards', 'invitation letter'] },
    { role: 'technocrat', candidates: ['laptop', 'USB security key', 'privacy screen', 'analog notebook'] },
    { role: 'analyst', candidates: ['laptop', 'analog notebook', 'USB security key', 'contacts card'] },
    { role: 'organizer', candidates: ['contacts card', 'analog notebook', 'cash stash'] },
  ];

  for (const rc of roleKitCandidates) {
    if (!roleSeedTags.includes(rc.role)) continue;
    const desired = pickKitCandidate(rc.candidates);
    if (!desired) continue;
    if (pickedKitItems.includes(desired)) continue;
    const weightByItem = new Map(kitWeights.map(x => [x.item, x.weight]));
    const removable = [...pickedKitItems]
      .map(item => ({ item, w: weightByItem.get(item) ?? 0 }))
      .sort((a, b) => (a.w - b.w) || a.item.localeCompare(b.item));
    const removed = removable[0]?.item ?? null;
    pickedKitItems = uniqueStrings([desired, ...pickedKitItems.filter(x => x !== removed)]).slice(0, 5);
    identityKitRepairs.push({ rule: `roleSignature:${rc.role}`, removed, added: desired });
    break;
  }

  if (trace && identityKitRepairs.length) trace.derived.identityKitRepairs = identityKitRepairs;

  const kitItems = pickedKitItems.map((item) => {
    const key = item.toLowerCase();
    const itemBias =
      (key.includes('burner') || key.includes('encrypted') ? 90 : 0) +
      (key.includes('passport') || key.includes('visa') ? 40 : 0) +
      (key.includes('keepsake') ? -80 : 0);
    const securityScore = clampFixed01k(
      0.45 * latents.opsecDiscipline +
        0.20 * latents.institutionalEmbeddedness +
        0.15 * traits.conscientiousness +
        0.20 * logisticsRng.int(0, 1000) +
        itemBias +
        (tierBand === 'elite' ? 40 : 0),
    );
    const security = band5From01k(securityScore);
    return { item, security, compromised: false };
  });
  traceSet(trace, 'logistics.identityKit', kitItems, {
    method: 'weightedPickKUnique+repairs+formula',
    dependsOn: { facet: 'logistics', opsec01, public01, risk01, travelScore, careerTrackTag, tierBand, identityKitRepairs },
  });

  return kitItems;
}

// ============================================================================
// Neurodivergence computation
// ============================================================================

function computeNeurodivergence(ctx: LifestyleContext): LifestyleResult['neurodivergence'] {
  const { seed, vocab, tierBand, latents, traits, aptitudes, trace } = ctx;

  traceFacet(trace, seed, 'neurodivergence');
  const neuroRng = makeRng(facetSeed(seed, 'neurodivergence'));
  const neuroIndicators = vocab.neurodivergence?.indicatorTags ?? ['neurotypical'];
  const neuroCoping = vocab.neurodivergence?.copingStrategies ?? [];

  // Base probability of non-neurotypical: ~15-25% depending on traits
  const neuroVarianceChance = 0.15 + 0.10 * (aptitudes.attentionControl < 500 ? 1 : 0);
  const isNeurotypical = neuroRng.next01() > neuroVarianceChance;

  let indicatorTags: string[];
  let copingStrategies: string[];

  if (isNeurotypical) {
    indicatorTags = ['neurotypical'];
    copingStrategies = [];
  } else {
    // Pick 1-2 indicators (not neurotypical)
    const nonTypicalIndicators = neuroIndicators.filter(t => t !== 'neurotypical');
    const indicatorWeights = nonTypicalIndicators.map(tag => {
      let w = 1;
      if (tag === 'hyperfocus-prone') w += 0.5 * (aptitudes.attentionControl / 1000);
      if (tag === 'adhd-traits') w += 0.4 * (1 - aptitudes.attentionControl / 1000);
      if (tag === 'pattern-recognition-strength') w += 0.3 * ((aptitudes as Record<string, Fixed>).cognitiveSpeed ?? 500) / 1000;
      if (tag === 'sensory-sensitivity') w += 0.3 * (latents.stressReactivity / 1000);
      if (tag === 'anxiety-processing') w += 0.4 * (latents.stressReactivity / 1000);
      // ASD traits correlate with processing style, not empathy deficits
      if (tag === 'asd-traits') w += 0.3 * (aptitudes.attentionControl / 1000) + 0.15 * (latents.stressReactivity / 1000);
      return { item: tag, weight: w };
    });
    indicatorTags = weightedPickKUnique(neuroRng, indicatorWeights, neuroRng.int(1, 2));

    // Pick 1-3 coping strategies
    if (neuroCoping.length > 0) {
      const copingWeights = neuroCoping.map(tag => {
        let w = 1;
        if (tag === 'routine-dependent' && traits.conscientiousness > 600) w += 0.5;
        if (tag === 'list-maker' && traits.conscientiousness > 500) w += 0.4;
        if (tag === 'noise-cancelling' && indicatorTags.includes('sensory-sensitivity')) w += 0.8;
        if (tag === 'fidget-user' && indicatorTags.includes('adhd-traits')) w += 0.6;
        if (tag === 'medication-managed') w += 0.3 * (tierBand === 'elite' ? 1.5 : 1);
        return { item: tag, weight: w };
      });
      copingStrategies = weightedPickKUnique(neuroRng, copingWeights, neuroRng.int(1, 3));
    } else {
      copingStrategies = [];
    }
  }
  traceSet(trace, 'neurodivergence', { indicatorTags, copingStrategies }, {
    method: 'weighted',
    dependsOn: { aptitudes: 'partial', latents: 'partial', traits: 'partial' },
  });

  return { indicatorTags, copingStrategies };
}

// ============================================================================
// Spirituality computation
// ============================================================================

// Culture → tradition affinity mappings (which traditions are common in which cultures)
const CULTURE_TRADITION_AFFINITIES: Record<string, string[]> = {
  'Hesper': ['solarian-catholic', 'solarian-orthodox', 'solarian-protestant', 'humanist-secular'],
  'Aram': ['lunarian-sunni', 'lunarian-shia', 'lunarian-sufi', 'covenant-orthodox', 'druze', 'alevi'],
  'Mero': ['solarian-catholic', 'solarian-protestant', 'lunarian-sunni', 'animist', 'ancestor-reverent'],
  'Solis-South': ['dharmic-vedantic', 'dharmic-shaiva', 'dharmic-vaishnava', 'lunarian-sunni', 'khalsan', 'tirthic', 'awakened-theravada'],
  'Solis-East': ['awakened-mahayana', 'awakened-zen', 'harmonist', 'wayfarer', 'kami-path', 'ancestor-reverent'],
  'Pelag': ['solarian-catholic', 'solarian-protestant', 'animist', 'ancestor-reverent'],
  'Athar-West': ['solarian-catholic', 'solarian-protestant', 'solarian-evangelical', 'humanist-secular', 'animist'],
  'Global': ['humanist-secular', 'solarian-catholic', 'lunarian-sunni', 'awakened-mahayana'],
};

// Non-religious/secular affiliations that use 'none' tradition
const SECULAR_AFFILIATIONS = new Set(['secular', 'atheist', 'agnostic', 'humanist-secular']);
// Traditions that are inherently secular and cannot have religious observance levels
const SECULAR_TRADITIONS = new Set(['humanist-secular', 'philosophical-materialist', 'atheist', 'agnostic', 'none']);

function computeSpirituality(ctx: LifestyleContext): LifestyleResult['spirituality'] {
  const { seed, vocab, age, traits, homeCulture, trace } = ctx;

  traceFacet(trace, seed, 'spirituality');
  const spiritRng = makeRng(facetSeed(seed, 'spirituality'));
  const traditions = vocab.spirituality?.traditions ?? ['none'];
  const affiliations = vocab.spirituality?.affiliationTags ?? ['secular'];
  const observances = vocab.spirituality?.observanceLevels ?? ['none', 'cultural', 'moderate'];
  const practices = vocab.spirituality?.practiceTypes ?? [];

  // Step 1: Pick affiliation first (determines if religious or not)
  const affiliationWeights = affiliations.map(tag => {
    let w = 1;
    if (tag === 'secular' || tag === 'atheist' || tag === 'agnostic') {
      w += 0.3 * (1 - traits.authoritarianism / 1000);
      w += 0.2 * (age < 40 ? 1 : 0);
    }
    if (tag === 'practicing-religious' || tag === 'devout') {
      w += 0.4 * (traits.authoritarianism / 1000);
      w += 0.3 * (age > 50 ? 1 : 0);
      w += 0.2 * (traits.conscientiousness / 1000);
    }
    if (tag === 'culturally-religious') w += 0.5;
    if (tag === 'spiritual-not-religious') w += 0.3 * (traits.noveltySeeking / 1000);
    if (tag === 'lapsed') w += 0.2 * (age > 30 && age < 50 ? 1 : 0);
    return { item: tag, weight: w };
  });
  const affiliationTag = weightedPick(spiritRng, affiliationWeights);

  // Step 2: Pick tradition based on affiliation and culture
  let tradition = 'none';
  if (!SECULAR_AFFILIATIONS.has(affiliationTag)) {
    const cultureAffinities = CULTURE_TRADITION_AFFINITIES[homeCulture] ?? CULTURE_TRADITION_AFFINITIES['Global'];
    const traditionWeights = traditions.map((t: string) => {
      // Skip 'none' and secular traditions for religious affiliations
      if (t === 'none') return { item: t, weight: 0 };
      if (SECULAR_TRADITIONS.has(t)) return { item: t, weight: 0 }; // Can't have secular tradition with religious affiliation
      let w = 1;
      // Boost traditions that match culture
      if (cultureAffinities?.includes(t)) w += 5;
      // Slight boost for more common traditions globally
      if (t.startsWith('solarian-') || t.startsWith('lunarian-')) w += 0.5;
      // Seekers and spiritual-not-religious favor non-mainstream
      if (affiliationTag === 'seeker' || affiliationTag === 'spiritual-not-religious') {
        if (t === 'nature-spiritual' || t === 'animist' || t === 'syncretic') w += 2;
      }
      // Convert favors traditions different from culture norm
      if (affiliationTag === 'convert' && !cultureAffinities?.includes(t)) w += 1;
      return { item: t, weight: w };
    }).filter((tw: { item: string; weight: number }) => tw.weight > 0);

    if (traditionWeights.length > 0) {
      tradition = weightedPick(spiritRng, traditionWeights);
    }
  }

  // Step 3: Observance level (coherent with affiliation AND tradition)
  const observanceWeights = observances.map(level => {
    let w = 1;
    // HARD CONSTRAINTS
    // Secular affiliations or secular traditions cannot have religious observance
    if (SECULAR_AFFILIATIONS.has(affiliationTag) && level !== 'none') return { item: level, weight: 0 };
    if (SECULAR_TRADITIONS.has(tradition) && level !== 'none') return { item: level, weight: 0 };
    // Non-secular traditions must have at least cultural observance (can't claim a tradition and have no observance)
    if (!SECULAR_TRADITIONS.has(tradition) && tradition !== 'none' && level === 'none') return { item: level, weight: 0 };
    if (affiliationTag === 'lapsed' && !['none', 'cultural'].includes(level)) return { item: level, weight: 0 };
    if (affiliationTag === 'spiritual-not-religious' && level === 'strict') return { item: level, weight: 0 };
    if (affiliationTag === 'spiritual-not-religious' && level === 'ultra-orthodox') return { item: level, weight: 0 };
    if (affiliationTag === 'devout' && level === 'none') return { item: level, weight: 0 };
    if (affiliationTag === 'fundamentalist' && !['strict', 'ultra-orthodox'].includes(level)) return { item: level, weight: 0 };

    // Soft weights
    if (affiliationTag === 'devout' && level === 'strict') w += 2;
    if (affiliationTag === 'devout' && level === 'observant') w += 1.5;
    if (affiliationTag === 'fundamentalist' && level === 'ultra-orthodox') w += 3;
    if (affiliationTag === 'practicing-religious' && level === 'observant') w += 1.5;
    if (affiliationTag === 'practicing-religious' && level === 'moderate') w += 1;
    if (affiliationTag === 'culturally-religious' && level === 'cultural') w += 2;
    if (affiliationTag === 'progressive-religious' && level === 'moderate') w += 1.5;
    if (affiliationTag === 'lapsed' && level === 'none') w += 1.5;
    if (SECULAR_AFFILIATIONS.has(affiliationTag) && level === 'none') w += 3;
    return { item: level, weight: w };
  });
  const observanceLevel = weightedPick(spiritRng, observanceWeights);

  // Step 4: Practices (based on observance)
  let practiceTypes: string[] = [];
  if (practices.length > 0 && observanceLevel !== 'none') {
    const practiceCount = observanceLevel === 'ultra-orthodox' ? spiritRng.int(3, 5) :
                          observanceLevel === 'strict' ? spiritRng.int(2, 4) :
                          observanceLevel === 'observant' ? spiritRng.int(1, 3) :
                          observanceLevel === 'moderate' ? spiritRng.int(1, 2) :
                          spiritRng.int(0, 1);
    if (practiceCount > 0) {
      practiceTypes = spiritRng.pickK(practices, Math.min(practiceCount, practices.length));
    }
  }

  traceSet(trace, 'spirituality', { tradition, affiliationTag, observanceLevel, practiceTypes }, {
    method: 'weighted',
    dependsOn: { age, traits: 'partial', homeCulture },
  });

  return { tradition, affiliationTag, observanceLevel, practiceTypes };
}

// ============================================================================
// Background computation
// ============================================================================

function computeBackground(ctx: LifestyleContext): LifestyleResult['background'] {
  const { seed, vocab, tierBand, homeCountryIso3, cohortBucketStartYear, priors, traits, opsec01, trace } = ctx;

  traceFacet(trace, seed, 'background');
  const bgRng = makeRng(facetSeed(seed, 'background'));
  const adversities = vocab.background?.adversityTags ?? ['stable-upbringing'];
  const resiliencePool = vocab.background?.resilienceIndicators ?? [];

  // Adversity probability influenced by country security environment
  const securityEnv = priors?.countries?.[homeCountryIso3]?.buckets?.[String(cohortBucketStartYear)]?.securityEnvironment01k;
  const conflictLevel = (securityEnv as Record<string, Fixed> | undefined)?.conflict ?? 200;
  const stateViolence = (securityEnv as Record<string, Fixed> | undefined)?.stateViolence ?? 200;
  const adversityBaseChance = 0.20 + 0.30 * (conflictLevel / 1000) + 0.20 * (stateViolence / 1000);

  const adversityWeights = adversities.map(tag => {
    let w = 1;
    if (tag === 'stable-upbringing') w += 2 * (1 - adversityBaseChance);
    if (tag === 'conflict-exposure') w += 1.5 * (conflictLevel / 1000);
    if (tag === 'displacement-survivor' || tag === 'refugee-background') w += 1.2 * (conflictLevel / 1000);
    if (tag === 'persecution-survivor') w += 0.8 * (stateViolence / 1000);
    if (tag === 'economic-hardship-history') w += 0.5;
    if (tag === 'family-instability') w += 0.4;
    if (tag === 'loss-of-parent') w += 0.3;
    return { item: tag, weight: w };
  });

  // Pick 1-2 adversity tags
  const adversityTags = weightedPickKUnique(bgRng, adversityWeights, bgRng.int(1, 2));

  // Resilience indicators - pick if there's adversity beyond stable-upbringing
  let resilienceIndicators: string[] = [];
  const hasSignificantAdversity = adversityTags.some(t => t !== 'stable-upbringing');
  if (hasSignificantAdversity && resiliencePool.length > 0) {
    const resilienceWeights = resiliencePool.map(tag => {
      let w = 1;
      if (tag === 'high-adaptability') w += 0.4 * (traits.noveltySeeking / 1000);
      if (tag === 'compartmentalization-skill') w += 0.5 * opsec01;
      if (tag === 'therapy-history') w += 0.3 * (tierBand === 'elite' ? 1.5 : 1);
      if (tag === 'support-network-strong') w += 0.3 * (traits.agreeableness / 1000);
      return { item: tag, weight: w };
    });
    resilienceIndicators = weightedPickKUnique(bgRng, resilienceWeights, bgRng.int(1, 2));
  }
  traceSet(trace, 'background', { adversityTags, resilienceIndicators }, {
    method: 'weighted',
    dependsOn: { homeCountryIso3, securityEnv: 'partial', traits: 'partial' },
  });

  return { adversityTags, resilienceIndicators };
}

// ============================================================================
// Mobility computation
// ============================================================================

function computeMobility(ctx: LifestyleContext): LifestyleResult['mobility'] {
  const { seed, vocab, tierBand, cosmo01, inst01, public01, latents, roleSeedTags, countryPriorsBucket, trace } = ctx;

  traceFacet(trace, seed, 'mobility');
  const mobilityRng = makeRng(facetSeed(seed, 'mobility'));
  const mobilityTags = uniqueStrings(vocab.mobility?.mobilityTags ?? []);

  const mobilityTag = (() => {
    const pool = mobilityTags.length ? mobilityTags : ['low-mobility', 'regional-travel', 'frequent-flyer', 'nomadic'];
    const weights = pool.map((t) => {
      let w = 1;
      if (cosmo01 > 0.7 && ['frequent-flyer', 'nomadic'].includes(t)) w += 2.0;
      if (cosmo01 < 0.35 && t === 'low-mobility') w += 2.2;
      if ((latents.adaptability / 1000) > 0.7 && ['frequent-flyer', 'nomadic'].includes(t)) w += 1.2;
      if ((latents.adaptability / 1000) < 0.35 && t === 'low-mobility') w += 0.6;
      if (roleSeedTags.includes('diplomat') && ['frequent-flyer', 'nomadic'].includes(t)) w += 2.0;
      if (roleSeedTags.includes('operative') && t === 'nomadic') w += 1.5;
      return { item: t, weight: w };
    });
    return weightedPick(mobilityRng, weights);
  })();

  const passportModelScoreRaw = clampFixed01k(
    (tierBand === 'elite' ? 160 : tierBand === 'mass' ? -80 : 0) +
      520 * cosmo01 +
      480 * inst01 +
      mobilityRng.int(0, 1000) * 0.25,
  );
  const passportEnv = countryPriorsBucket?.mobility01k?.passportAccess;
  const passportScore = passportEnv != null
    ? clampFixed01k(0.45 * passportEnv + 0.55 * passportModelScoreRaw)
    : passportModelScoreRaw;
  const passportAccessBand = band5From01k(passportScore);

  const travelModelScoreRaw = clampFixed01k(
    650 * cosmo01 +
      220 * public01 +
      180 * (latents.adaptability / 1000) +
      (roleSeedTags.includes('diplomat') ? 220 : 0) +
      (roleSeedTags.includes('operative') ? 140 : 0) +
      mobilityRng.int(0, 1000) * 0.20,
  );
  const travelEnv = countryPriorsBucket?.mobility01k?.travelFrequency;
  const travelScore = travelEnv != null
    ? clampFixed01k(0.50 * travelEnv + 0.50 * travelModelScoreRaw)
    : travelModelScoreRaw;
  const travelFrequencyBand = band5From01k(travelScore);

  traceSet(trace, 'mobility', { mobilityTag, passportAccessBand, travelFrequencyBand }, {
    method: 'weightedPick+env+formula',
    dependsOn: { facet: 'mobility', tierBand, cosmo01, inst01, public01, roleSeedTags, passportEnv: passportEnv ?? null, travelEnv: travelEnv ?? null },
  });

  return { passportAccessBand, mobilityTag, travelFrequencyBand };
}
