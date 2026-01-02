import type { AgentVocabV1, Band5, Latents, PersonalityFacetScore, PersonalityQuirkSelection } from './types';
import type { Aptitudes } from './facets/aptitudes';
import type { PsychTraits } from './facets/traits';
import type { Ethics } from './facets/psychology';
import { facetSeed, makeRng, weightedPick, weightedPickKUnique } from './utils';

type PersonalityFacetContext = {
  latents: Latents;
  aptitudes: Aptitudes;
  traits: PsychTraits;
  ethics: Ethics;
  motivationalDrivers: string[];
  spiritualityLevel: string;
  decisionMaking: string;
};

type QuirkContext = {
  facets: PersonalityFacetScore[];
  latents: Latents;
  aptitudes: Aptitudes;
  traits: PsychTraits;
  ethics: Ethics;
};

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const bandFromScore = (score: number): Band5 => {
  if (score <= 20) return 'very_low';
  if (score <= 40) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'high';
  return 'very_high';
};

const scoreFrom01k = (value01k: number, rng: ReturnType<typeof makeRng>, jitter = 6): number => {
  const base = value01k / 10;
  const noise = rng.int(-jitter, jitter);
  return clampScore(base + noise);
};

const mix01k = (values: number[]): number => {
  if (!values.length) return 500;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
};

const spiritualityScore = (level: string): number => {
  switch (level) {
    case 'none':
    case 'secular':
      return 10;
    case 'low':
      return 30;
    case 'moderate':
      return 55;
    case 'high':
      return 70;
    case 'devout':
    case 'strict':
      return 90;
    default:
      return 50;
  }
};

const loyaltyScopeScore = (scope: Ethics['loyaltyScope']): number => {
  if (scope === 'self') return 30;
  if (scope === 'people') return 75;
  if (scope === 'ideals') return 80;
  return 70; // institution default
};

const lowerKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const computeFacetScore = (
  facetName: string,
  ctx: PersonalityFacetContext,
  rng: ReturnType<typeof makeRng>,
): number => {
  const key = lowerKey(facetName);
  const { latents, aptitudes, traits, ethics, motivationalDrivers } = ctx;
  const baseMap: Record<string, number> = {
    bravery: traits.riskTolerance,
    'stress tolerance': 1000 - latents.stressReactivity,
    confidence: mix01k([aptitudes.assertiveness, aptitudes.charisma, traits.riskTolerance]),
    gregariousness: latents.socialBattery,
    empathy: aptitudes.empathy,
    trust: mix01k([traits.agreeableness, 1000 - latents.opsecDiscipline]),
    humor: mix01k([aptitudes.charisma, latents.aestheticExpressiveness]),
    curiosity: latents.curiosityBandwidth,
    'analytical thinking': mix01k([aptitudes.workingMemory, aptitudes.attentionControl, aptitudes.cognitiveSpeed]),
    creativity: mix01k([latents.aestheticExpressiveness, traits.noveltySeeking]),
    memory: aptitudes.workingMemory,
    honesty: ethics.ruleAdherence,
    compassion: mix01k([aptitudes.empathy, ethics.harmAversion]),
    justice: mix01k([ethics.ruleAdherence, latents.principledness]),
    loyalty: mix01k([ethics.ruleAdherence, loyaltyScopeScore(ethics.loyaltyScope) * 10]),
    diligence: traits.conscientiousness,
    perfectionism: mix01k([traits.conscientiousness, latents.planningHorizon]),
    organization: mix01k([traits.conscientiousness, latents.planningHorizon]),
    patience: latents.impulseControl,
    'anger management': mix01k([latents.impulseControl, 1000 - latents.stressReactivity]),
    'anxiety level': latents.stressReactivity,
    'emotional expression': latents.publicness,
    optimism: mix01k([1000 - latents.stressReactivity, latents.principledness]),
    'pain tolerance': mix01k([aptitudes.endurance, latents.physicalConditioning]),
    'sensory sensitivity': aptitudes.attentionControl,
    'physical energy': mix01k([aptitudes.endurance, latents.physicalConditioning]),
    'risk taking': latents.riskAppetite,
    'tradition respect': mix01k([latents.institutionalEmbeddedness, 1000 - traits.noveltySeeking]),
    'cultural pride': mix01k([1000 - latents.cosmopolitanism, latents.principledness]),
    adaptability: latents.adaptability,
    spirituality: spiritualityScore(ctx.spiritualityLevel) * 10,
    'leadership drive': mix01k([aptitudes.assertiveness, aptitudes.charisma, latents.publicness]),
    'authority respect': mix01k([traits.authoritarianism, latents.institutionalEmbeddedness]),
    responsibility: mix01k([traits.conscientiousness, ethics.ruleAdherence]),
    'decision making': mix01k([latents.planningHorizon, traits.conscientiousness, aptitudes.cognitiveSpeed]),
  };

  let value01k = baseMap[key];
  if (value01k == null) {
    value01k = mix01k([rng.int(200, 800), rng.int(200, 800)]);
  }

  // Leadership drive gets a nudge from power/achievement drivers.
  if (key === 'leadership drive') {
    const driverBoost = motivationalDrivers.includes('power') || motivationalDrivers.includes('achievement') || motivationalDrivers.includes('recognition');
    if (driverBoost) value01k = Math.min(1000, value01k + 120);
  }

  return scoreFrom01k(value01k, rng);
};

export function computePersonalityFacets(
  seed: string,
  vocab: AgentVocabV1,
  ctx: PersonalityFacetContext,
): PersonalityFacetScore[] {
  const facets = vocab.personality?.facetNames ?? [];
  if (!facets.length) return [];
  const rng = makeRng(facetSeed(seed, 'personality_facets'));
  return facets.map((name) => {
    const score = computeFacetScore(name, ctx, rng);
    return { name, score, band: bandFromScore(score) };
  });
}

export function computeTraitTriad(
  seed: string,
  vocab: AgentVocabV1,
  ctx: PersonalityFacetContext,
): string[] {
  const traitNames = vocab.personality?.traitNames ?? [];
  if (!traitNames.length) return [];
  const rng = makeRng(facetSeed(seed, 'personality_trait_triad'));

  const drivers = new Set(ctx.motivationalDrivers);
  const signals = {
    ambition: drivers.has('power') || drivers.has('achievement') || drivers.has('recognition') ? 1 : 0,
    affiliation: drivers.has('affiliation') || drivers.has('belonging') ? 1 : 0,
    purpose: drivers.has('purpose') || drivers.has('justice') ? 1 : 0,
    autonomy: drivers.has('autonomy') ? 1 : 0,
    mastery: drivers.has('mastery') ? 1 : 0,
    risk: ctx.latents.riskAppetite / 1000,
    caution: 1 - ctx.latents.riskAppetite / 1000,
    stress: ctx.latents.stressReactivity / 1000,
    curiosity: ctx.latents.curiosityBandwidth / 1000,
    creativity: ctx.latents.aestheticExpressiveness / 1000,
    secrecy: ctx.latents.opsecDiscipline / 1000,
    tradition: ctx.latents.institutionalEmbeddedness / 1000,
    frugality: ctx.latents.frugality / 1000,
    principled: ctx.latents.principledness / 1000,
    empathy: ctx.aptitudes.empathy / 1000,
    charisma: ctx.aptitudes.charisma / 1000,
    conscientious: ctx.traits.conscientiousness / 1000,
    agreeable: ctx.traits.agreeableness / 1000,
    authoritarian: ctx.traits.authoritarianism / 1000,
  };

  const weights = traitNames.map((trait) => {
    const name = trait.toLowerCase();
    let w = 1;

    if (name.includes('ambitious')) w += 4 * signals.ambition;
    if (name.includes('greedy') || name.includes('material')) w += 3 * (1 - signals.frugality);
    if (name.includes('idealistic')) w += 3 * signals.principled;
    if (name.includes('hedonistic')) w += 2.5 * (1 - signals.frugality) + 1.5 * (1 - signals.conscientious);
    if (name.includes('vengeful')) w += 2.5 * signals.stress + 1.5 * (1 - signals.agreeable);
    if (name.includes('curious')) w += 3 * signals.curiosity;
    if (name.includes('patriotic')) w += 2.5 * signals.tradition;
    if (name.includes('secretive')) w += 2.5 * signals.secrecy;
    if (name.includes('artistic')) w += 2.5 * signals.creativity;
    if (name.includes('survivalist')) w += 2.5 * signals.caution + 1.5 * signals.stress;
    if (name.includes('revolutionary') || name.includes('radical')) w += 2.5 * (1 - signals.authoritarian) + 1.5 * signals.risk;
    if (name.includes('exploitative')) w += 2.5 * (1 - signals.agreeable);
    if (name.includes('loyal')) w += ctx.ethics.loyaltyScope === 'self' ? 0.6 : 2.2;
    if (name.includes('compassionate')) w += 2.5 * ((ctx.ethics.harmAversion + ctx.aptitudes.empathy) / 2000);
    if (name.includes('pragmatic') || name.includes('cynical')) w += 1.8 * (1 - signals.principled);
    if (name.includes('disciplined') || name.includes('methodical') || name.includes('organized')) w += 2.0 * signals.conscientious;
    if (name.includes('charismatic')) w += 2.5 * signals.charisma;
    if (name.includes('paranoid')) w += 2.0 * signals.secrecy;
    if (name.includes('optimistic')) w += 2.0 * (1 - signals.stress);
    if (name.includes('pessimistic') || name.includes('nihilistic')) w += 2.0 * signals.stress;
    if (name.includes('reckless')) w += 2.5 * signals.risk + 1.0 * (1 - signals.conscientious);
    if (name.includes('cautious')) w += 2.5 * signals.caution;
    if (name.includes('social') || name.includes('communal')) w += 1.5 * signals.affiliation;

    return { item: trait, weight: Math.max(0.2, w) };
  });

  const pickCount = Math.min(3, traitNames.length);
  return weightedPickKUnique(rng, weights, pickCount) as string[];
}

const buildFacetScoreMap = (facets: PersonalityFacetScore[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const facet of facets) {
    map.set(lowerKey(facet.name), facet.score);
  }
  return map;
};

const lookupTraitScore = (name: string, ctx: QuirkContext, facetMap: Map<string, number>): number | null => {
  const key = lowerKey(name);
  if (facetMap.has(key)) return facetMap.get(key) ?? null;
  if (key === 'anxiety') return facetMap.get('anxiety level') ?? null;
  if (key === 'charisma') return ctx.aptitudes.charisma / 10;
  if (key === 'deception') return ctx.aptitudes.deceptionAptitude / 10;
  if (key === 'honesty') return facetMap.get('honesty') ?? null;
  if (key === 'intelligence') {
    return mix01k([ctx.aptitudes.cognitiveSpeed, ctx.aptitudes.workingMemory, ctx.aptitudes.attentionControl]) / 10;
  }
  if (key === 'wisdom') return mix01k([ctx.traits.conscientiousness, ctx.latents.principledness]) / 10;
  if (key === 'fear') {
    const bravery = facetMap.get('bravery');
    return bravery != null ? 100 - bravery : null;
  }
  if (key === 'moral courage') {
    return mix01k([ctx.traits.riskTolerance, ctx.latents.principledness]) / 10;
  }
  if (key === 'aggression') return mix01k([ctx.aptitudes.assertiveness, ctx.latents.riskAppetite]) / 10;
  if (key === 'confidence') return facetMap.get('confidence') ?? null;
  if (key === 'perfectionism') return facetMap.get('perfectionism') ?? null;
  if (key === 'cleanliness') return facetMap.get('organization') ?? ctx.traits.conscientiousness / 10;
  if (key === 'social need') return facetMap.get('gregariousness') ?? ctx.latents.socialBattery / 10;
  if (key === 'ruthlessness') {
    const value01k = 0.6 * ctx.ethics.missionUtilitarianism + 0.4 * (1000 - ctx.ethics.harmAversion);
    return value01k / 10;
  }
  return null;
};

export function selectQuirkCombination(
  seed: string,
  vocab: AgentVocabV1,
  ctx: QuirkContext,
): PersonalityQuirkSelection | null {
  const combos = vocab.personality?.quirkCombinations ?? [];
  if (!combos.length) return null;

  const facetMap = buildFacetScoreMap(ctx.facets);
  const eligible = combos.filter((combo) => {
    const rules = combo.traits ?? [];
    if (!rules.length) return false;
    return rules.every((rule) => {
      const score = lookupTraitScore(rule.name, ctx, facetMap);
      if (score == null) return false;
      if (rule.min != null && score < rule.min) return false;
      if (rule.max != null && score > rule.max) return false;
      return true;
    });
  });

  if (!eligible.length) return null;
  const rng = makeRng(facetSeed(seed, 'personality_quirk_combo'));
  const weights = eligible.map((combo) => {
    const weight = 1 + (combo.traits?.length ?? 0) * 0.5;
    return { item: combo.name, weight };
  });
  const pickedName = weightedPick(rng, weights);
  const picked = eligible.find(combo => combo.name === pickedName) ?? eligible[0];
  const manifestations = picked.manifestations ?? [];
  const pickedCount = Math.min(3, manifestations.length);
  const shuffled = manifestations.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return {
    name: picked.name,
    category: picked.category,
    manifestations: shuffled.slice(0, pickedCount),
  };
}
