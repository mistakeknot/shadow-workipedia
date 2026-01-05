/**
 * Preferences Facet - Food, Media, Fashion, and Routines
 *
 * Computes agent preferences influenced by:
 * - Microculture profiles (weighted picks)
 * - Country priors (food/media environments)
 * - Latent traits (frugality, aestheticExpressiveness, socialBattery)
 * - Health conditions and allergies
 */

import type {
  Fixed, TierBand, AgentVocabV1, AgentGenerationTraceV1, CultureProfileV1,
} from '../types';
import {
  type Rng,
  makeRng,
  facetSeed,
  clampFixed01k,
  weightedPick,
  weightedPickKUnique,
  uniqueStrings,
  pickKHybrid,
  type FoodEnv01k,
  type FoodEnvAxis,
  FOOD_ENV_AXES,
  normalizeFoodEnv01k,
  mixFoodEnv01k,
  normalizeWeights01kExact,
  traceSet,
  traceFacet,
} from '../utils';
import type { MicroProfileEntry, ClimateIndicators, PrimaryWeights } from './geography';
import { pickFromWeightedMicroProfiles } from './geography';
import type { Aptitudes } from './aptitudes';
import type { PsychTraits } from './traits';

// ============================================================================
// Types
// ============================================================================

export type PreferencesContext = {
  seed: string;
  vocab: AgentVocabV1;
  trace?: AgentGenerationTraceV1;
  tierBand: TierBand;
  latents: {
    publicness: Fixed;
    opsecDiscipline: Fixed;
    institutionalEmbeddedness: Fixed;
    stressReactivity: Fixed;
    impulseControl: Fixed;
    aestheticExpressiveness: Fixed;
    frugality: Fixed;
    socialBattery: Fixed;
    riskAppetite: Fixed;
    adaptability: Fixed;
    physicalConditioning: Fixed;
  };
  traits: PsychTraits;
  aptitudes: Aptitudes;
  age: number;
  // Geography-derived
  homeCountryIso3: string;
  citizenshipCountryIso3: string;
  currentCountryIso3: string;
  abroad: boolean;
  cosmo01: number;
  cultureTraditionalism01: number;
  cultureMediaOpenness01: number;
  primaryWeights: PrimaryWeights;
  climateIndicators: ClimateIndicators;
  // Culture profiles
  macroCulture: CultureProfileV1 | null;
  microProfiles: MicroProfileEntry[];
  // Country priors
  countryPriorsBucket: {
    foodEnvironment01k?: Partial<Record<FoodEnvAxis, Fixed>>;
    mediaEnvironment01k?: Partial<Record<'print' | 'radio' | 'tv' | 'social' | 'closed', Fixed>>;
    languages01k?: Record<string, Fixed>;
  } | undefined;
  homeLangEnv01k: Record<string, Fixed> | null;
  citizenshipLangEnv01k: Record<string, Fixed> | null;
  currentLangEnv01k: Record<string, Fixed> | null;
  cohortBucketStartYear: number;
  // Health inputs
  chronicConditionTags: string[];
  allergyTags: string[];
  // Career/role inputs
  careerTrackTag: string;
  roleSeedTags: readonly string[];
  // Visibility metrics
  publicVisibility: Fixed;
  paperTrail: Fixed;
  securityPressure01k: Fixed;
  // Vice tendency (for no-alcohol weighting)
  viceTendency: number;
};

export type FoodPreferences = {
  comfortFoods: string[];
  dislikes: string[];
  restrictions: string[];
  ritualDrink: string;
};

export type MediaPreferences = {
  platformDiet: Record<string, Fixed>;
  genreTopK: string[];
  attentionResilience: Fixed;
  doomscrollingRisk: Fixed;
  epistemicHygiene: Fixed;
};

export type FashionPreferences = {
  styleTags: string[];
  formality: Fixed;
  conformity: Fixed;
  statusSignaling: Fixed;
};

export type RoutinesResult = {
  chronotype: string;
  sleepWindow: string;
  recoveryRituals: string[];
};

export type HobbiesPreferences = {
  primary: string[];
  secondary: string[];
  categories: string[];
};

export type EnvironmentPreferences = {
  temperature: string;
  weatherMood: string;
};

export type LivingSpacePreferences = {
  roomPreferences: string[];
  comfortItems: string[];
};

export type AestheticsPreferences = {
  colorPalette: string;
  patternPreference: string;
  lightingPreference: string;
  visualComplexityPreference: string;
  decorPreferences: string[];
  architectureStyle: string;
  soundscape: string;
  noiseTolerancePreference: string;
  texturePreference: string;
  materialPreference: string;
  touchPreference: string;
  scentAttraction: string;
  scentAversion: string;
};

export type ArtisticPreferences = {
  mediums: string[];
  specializations: string[];
  themes: string[];
  inspirationSource: string;
  expressionDriver: string;
  practiceRhythm: string;
  sharingStyle: string;
  workspacePreference: string;
  learningMode: string;
  challenge: string;
};

export type SocialPreferences = {
  groupStyle: string;
  communicationMethod: string;
  boundary: string;
  emotionalSharing: string;
};

export type WorkPreferences = {
  preferredOperations: string[];
  avoidedOperations: string[];
};

export type EquipmentPreferences = {
  weaponPreference: string;
  gearPreferences: string[];
};

export type QuirksPreferences = {
  luckyItem: string;
  rituals: string[];
  petPeeves: string[];
  mustHaves: string[];
};

export type TimePreferences = {
  dailyRhythm: string;
  planningStyle: string;
};

export type PreferencesResult = {
  food: FoodPreferences;
  media: MediaPreferences;
  fashion: FashionPreferences;
  hobbies: HobbiesPreferences;
  routines: RoutinesResult;
  environment: EnvironmentPreferences;
  livingSpace: LivingSpacePreferences;
  aesthetics: AestheticsPreferences;
  artistic: ArtisticPreferences;
  social: SocialPreferences;
  work: WorkPreferences;
  equipment: EquipmentPreferences;
  quirks: QuirksPreferences;
  time: TimePreferences;
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Get food environment for a country from priors */
function getFoodEnv01k(
  priors: PreferencesContext['countryPriorsBucket'],
  iso3: string,
  cohortBucketStartYear: number,
  allPriors?: { countries?: Record<string, { buckets?: Record<string, { foodEnvironment01k?: Partial<Record<FoodEnvAxis, Fixed>> }> }> },
): FoodEnv01k | null {
  // Try the provided bucket first
  if (priors?.foodEnvironment01k) {
    return normalizeFoodEnv01k(priors.foodEnvironment01k);
  }
  // Fallback to looking up in all priors
  const bucket = allPriors?.countries?.[iso3]?.buckets?.[String(cohortBucketStartYear)];
  return normalizeFoodEnv01k(bucket?.foodEnvironment01k ?? null);
}

// ============================================================================
// Food Preferences Computation
// ============================================================================

function computeFoodPreferences(ctx: PreferencesContext, rng: Rng): FoodPreferences {
  const {
    vocab, trace, cosmo01, primaryWeights,
    homeCountryIso3, citizenshipCountryIso3, currentCountryIso3, abroad,
    macroCulture, microProfiles, countryPriorsBucket, cohortBucketStartYear,
    chronicConditionTags, allergyTags, homeLangEnv01k, citizenshipLangEnv01k, currentLangEnv01k, viceTendency,
    latents,
  } = ctx;

  const { foodPrimaryWeight } = primaryWeights;

  // Validate required vocab
  if (!vocab.preferences.food.comfortFoods.length) throw new Error('Agent vocab missing: preferences.food.comfortFoods');
  if (!vocab.preferences.food.dislikes.length) throw new Error('Agent vocab missing: preferences.food.dislikes');
  if (!vocab.preferences.food.restrictions.length) throw new Error('Agent vocab missing: preferences.food.restrictions');
  if (!vocab.preferences.food.ritualDrinks.length) throw new Error('Agent vocab missing: preferences.food.ritualDrinks');

  // Build blended food environment
  const homeFoodEnv01k = getFoodEnv01k(countryPriorsBucket, homeCountryIso3, cohortBucketStartYear);
  const citizenshipFoodEnv01k = citizenshipCountryIso3 !== homeCountryIso3 ? getFoodEnv01k(countryPriorsBucket, citizenshipCountryIso3, cohortBucketStartYear) : null;
  const currentFoodEnv01k = currentCountryIso3 !== homeCountryIso3 ? getFoodEnv01k(countryPriorsBucket, currentCountryIso3, cohortBucketStartYear) : null;

  const foodEnv01k = homeFoodEnv01k
    ? mixFoodEnv01k([
        { env: homeFoodEnv01k, weight: 1 },
        ...(citizenshipFoodEnv01k ? [{ env: citizenshipFoodEnv01k, weight: 0.10 + 0.25 * cosmo01 }] : []),
        ...(currentFoodEnv01k ? [{ env: currentFoodEnv01k, weight: 0.15 + 0.35 * cosmo01 + (abroad ? 0.15 : 0) }] : []),
      ])
    : null;

  const topAxes = (env: FoodEnv01k | null) =>
    env ? [...FOOD_ENV_AXES].map(axis => ({ axis, value01k: env[axis] })).sort((a, b) => b.value01k - a.value01k).slice(0, 5) : null;
  if (trace) {
    trace.derived.foodEnv = { home: topAxes(homeFoodEnv01k), citizenship: topAxes(citizenshipFoodEnv01k), current: topAxes(currentFoodEnv01k), blended: topAxes(foodEnv01k) };
  }

  const axis01 = (axis: FoodEnvAxis, fallback: number) => (foodEnv01k ? foodEnv01k[axis] / 1000 : fallback);

  // Weight-faithful microculture food picks
  const microComfortFoods = pickFromWeightedMicroProfiles(rng, microProfiles, p => p.preferences?.food?.comfortFoods, 5);
  const microRitualDrinks = pickFromWeightedMicroProfiles(rng, microProfiles, p => p.preferences?.food?.ritualDrinks, 3);
  const cultureComfort = uniqueStrings([...(macroCulture?.preferences?.food?.comfortFoods ?? []), ...microComfortFoods]);
  const cultureDrinks = uniqueStrings([...(macroCulture?.preferences?.food?.ritualDrinks ?? []), ...microRitualDrinks]);

  // Restrictions logic
  const allRestrictionsPool = uniqueStrings(vocab.preferences.food.restrictions);
  let restrictions: string[] = [];
  const forcedRestrictions: Array<{ restriction: string; reason: string }> = [];
  const ensureRestriction = (restriction: string, reason: string) => {
    if (!restriction.trim() || restrictions.includes(restriction)) return;
    restrictions.push(restriction);
    forcedRestrictions.push({ restriction, reason });
  };

  // Spirituality observance preview for dietary decisions
  const spiritPreviewRng = makeRng(facetSeed(ctx.seed, 'spirituality'));
  const isDevoutLean = ctx.traits.authoritarianism > 600 || (ctx.traits.conscientiousness > 650 && ctx.age > 45);
  const spiritualityObservancePreview = isDevoutLean && spiritPreviewRng.next01() < 0.5 ? 'observant' : 'low';
  const observanceMultiplier = spiritualityObservancePreview === 'observant' ? 2.0 : 0.4;

  // Language mass for religious dietary rules
  const arabicMass01 = (() => {
    const home = (homeLangEnv01k?.ar ?? 0) / 1000;
    const citizenship = citizenshipLangEnv01k ? (citizenshipLangEnv01k.ar ?? 0) / 1000 : 0;
    const current = currentLangEnv01k ? (currentLangEnv01k.ar ?? 0) / 1000 : 0;
    return Math.max(0, Math.min(1, home + 0.35 * cosmo01 * citizenship + 0.45 * cosmo01 * current));
  })();
  const hebrewMass01 = (() => {
    const home = (homeLangEnv01k?.he ?? 0) / 1000;
    const citizenship = citizenshipLangEnv01k ? (citizenshipLangEnv01k.he ?? 0) / 1000 : 0;
    const current = currentLangEnv01k ? (currentLangEnv01k.he ?? 0) / 1000 : 0;
    return Math.max(0, Math.min(1, home + 0.35 * cosmo01 * citizenship + 0.45 * cosmo01 * current));
  })();

  const restrictionWeight = (restriction: string): number => {
    const r = restriction.toLowerCase();
    let w = 1;
    if (r === 'vegetarian') w += 2.2 * axis01('plantForward', 0.45) - 1.5 * axis01('meat', 0.45);
    if (r === 'vegan') w += 2.6 * axis01('plantForward', 0.45) - 1.6 * axis01('meat', 0.45) - 0.8 * axis01('dairy', 0.45);
    if (r === 'pescatarian') w += 1.4 * axis01('seafood', 0.35) - 0.9 * axis01('meat', 0.45);
    if (r === 'no seafood') w += 0.7 + 1.2 * (1 - axis01('seafood', 0.45));
    if (r === 'spice-sensitive') w += 0.7 + 1.8 * (1 - axis01('spice', 0.45));
    if (r === 'low sugar') w += 0.8 + 1.4 * (1 - axis01('sweets', 0.45));
    if (r === 'no added sugar') w += 0.8 + 1.4 * (1 - axis01('sweets', 0.45));
    if (r === 'low sodium') w += 0.9 + 0.6 * (1 - axis01('friedOily', 0.45));
    if (r === 'halal') w += (0.3 + 2.0 * arabicMass01) * observanceMultiplier;
    if (r === 'kosher') w += (0.3 + 2.0 * hebrewMass01) * observanceMultiplier;
    if (r === 'no pork') w += (0.3 + 1.5 * arabicMass01 + 0.8 * hebrewMass01) * observanceMultiplier;
    if (r === 'no beef') w += (0.2 + 0.3 * hebrewMass01) * observanceMultiplier;
    if (r === 'no alcohol') w += 0.7 + 0.6 * (1 - viceTendency);
    if (r === 'no caffeine') w += 0.7 + 1.2 * (1 - axis01('caffeine', 0.45)) + (chronicConditionTags.includes('insomnia') ? 0.8 : 0);
    if (r === 'lactose-sensitive') w += 0.4 + 0.6 * (1 - axis01('dairy', 0.45));
    if (r === 'gluten-sensitive') w += 0.4 + 0.4 * (1 - axis01('streetFood', 0.45));
    if (r === 'nut allergy') w += 0.3;
    if (r === 'shellfish allergy') w += 0.3;
    if (r === 'egg-free') w += 0.25;
    return Math.max(0.05, w);
  };

  const baseRestrictionCount = rng.int(0, 1);
  restrictions = allRestrictionsPool.length
    ? weightedPickKUnique(rng, allRestrictionsPool.map(item => ({ item, weight: restrictionWeight(item) })), baseRestrictionCount)
    : [];

  // Enforce health/allergy → restriction consistency
  if (allergyTags.includes('nuts')) ensureRestriction('nut allergy', 'allergy:nuts');
  if (allergyTags.includes('dairy')) ensureRestriction('lactose-sensitive', 'allergy:dairy');
  if (allergyTags.includes('gluten')) ensureRestriction('gluten-sensitive', 'allergy:gluten');
  if (allergyTags.includes('shellfish')) ensureRestriction('shellfish allergy', 'allergy:shellfish');
  if (chronicConditionTags.includes('hypertension')) ensureRestriction('low sodium', 'chronic:hypertension');

  restrictions = uniqueStrings(restrictions).filter(r => allRestrictionsPool.includes(r) || forcedRestrictions.some(f => f.restriction === r));

  const hasRestriction = (r: string) => restrictions.includes(r);
  const likelyGluten = (s: string) => /\b(noodle|flatbread|dumpling|pastr(y|ies)|bread|sandwich)\b/i.test(s);
  const likelyDairy = (s: string) => /\b(dairy|cheese|cocoa|dessert|pastr(y|ies))\b/i.test(s);
  const likelyMeat = (s: string) => /\b(meat|meats|grilled)\b/i.test(s);
  const likelySeafood = (s: string) => /\b(seafood|raw fish)\b/i.test(s);

  // Comfort foods selection
  const comfortPool = uniqueStrings([...cultureComfort, ...vocab.preferences.food.comfortFoods]);
  const frugal01 = latents.frugality / 1000;
  const comfortWeight = (item: string): number => {
    const s = item.toLowerCase();
    let w = 1;
    if (cultureComfort.includes(item)) w += 0.9 + 1.8 * foodPrimaryWeight;
    if (foodEnv01k) {
      if (s.includes('street')) w += 2.2 * axis01('streetFood', 0.5);
      if (s.includes('fine')) w += 2.2 * axis01('fineDining', 0.5);
      if (s.includes('spicy')) w += 2.2 * axis01('spice', 0.5);
      if (s.includes('dessert') || s.includes('pastr')) w += 2.1 * axis01('sweets', 0.5);
      if (s.includes('late-night') || s.includes('snack')) w += 1.2 * axis01('friedOily', 0.5) + 0.8 * axis01('streetFood', 0.5);
      if (s.includes('seafood')) w += 2.0 * axis01('seafood', 0.4);
      if (s.includes('meat') || s.includes('grilled')) w += 2.0 * axis01('meat', 0.4);
      if (s.includes('vegetarian') || s.includes('salad')) w += 1.8 * axis01('plantForward', 0.4);
    }
    if (s.includes('fine') || s.includes('gourmet') || s.includes('luxury') || s.includes('premium') || s.includes('steak') || s.includes('restaurant')) {
      w += 1.2 * (1 - frugal01) - 0.6 * frugal01;
    }
    if (s.includes('street') || s.includes('home') || s.includes('simple') || s.includes('leftover') || s.includes('staple')) {
      w += 0.8 * frugal01;
    }
    if (hasRestriction('vegetarian') && likelyMeat(item)) w *= 0.15;
    if (hasRestriction('vegan') && (likelyMeat(item) || likelyDairy(item))) w *= 0.12;
    if (hasRestriction('pescatarian') && likelyMeat(item)) w *= 0.35;
    if (hasRestriction('no seafood') && likelySeafood(item)) w *= 0.15;
    if (hasRestriction('spice-sensitive') && s.includes('spicy')) w *= 0.20;
    if ((hasRestriction('lactose-sensitive') || allergyTags.includes('dairy')) && likelyDairy(item)) w *= 0.25;
    if ((hasRestriction('gluten-sensitive') || allergyTags.includes('gluten')) && likelyGluten(item)) w *= 0.25;
    if ((hasRestriction('shellfish allergy') || allergyTags.includes('shellfish')) && likelySeafood(item)) w *= 0.35;
    if (hasRestriction('low sugar') && (s.includes('dessert') || s.includes('pastr'))) w *= 0.35;
    if (hasRestriction('no added sugar') && (s.includes('dessert') || s.includes('pastr') || s.includes('sweet'))) w *= 0.25;
    return Math.max(0.05, w);
  };
  const comfortFoods = weightedPickKUnique(rng, comfortPool.map(item => ({ item, weight: comfortWeight(item) })), 2);

  // Ritual drinks selection
  const drinkPool = uniqueStrings([...cultureDrinks, ...vocab.preferences.food.ritualDrinks]);
  const drinkWeight = (drink: string): number => {
    const s = drink.toLowerCase();
    let w = 1;
    if (cultureDrinks.includes(drink)) w += 0.9 + 1.8 * foodPrimaryWeight;
    const caffeinated = s.includes('coffee') || s.includes('espresso') || s.includes('mate') || s.includes('matcha') || s.includes('energy');
    const teaish = s.includes('tea') || s.includes('matcha');
    const sweetish = s.includes('cocoa') || s.includes('hot chocolate');
    const hydrating = s.includes('water') || s.includes('seltzer');
    if (foodEnv01k) {
      if (caffeinated) w += 2.2 * axis01('caffeine', 0.5);
      if (teaish) w += 1.2 * (0.6 + 0.4 * axis01('caffeine', 0.4));
      if (sweetish) w += 1.2 * axis01('sweets', 0.5);
      if (hydrating) w += 0.7 + 0.8 * (1 - axis01('caffeine', 0.45));
    }
    if (caffeinated && chronicConditionTags.includes('insomnia')) w *= 0.25;
    if (caffeinated && chronicConditionTags.includes('migraine')) w *= 0.55;
    if (hasRestriction('no caffeine') && caffeinated) w *= 0.15;
    if (hasRestriction('low sugar') && sweetish) w *= 0.35;
    if (hasRestriction('no added sugar') && sweetish) w *= 0.30;
    return Math.max(0.05, w);
  };
  const ritualDrink = weightedPickKUnique(rng, drinkPool.map(item => ({ item, weight: drinkWeight(item) })), 1)[0] ?? '';

  // Dislikes selection
  const dislikePool = uniqueStrings(vocab.preferences.food.dislikes);
  const dislikeWeight = (item: string): number => {
    const s = item.toLowerCase();
    let w = 1;
    if ((hasRestriction('lactose-sensitive') || allergyTags.includes('dairy')) && s.includes('dairy')) w += 5;
    if (hasRestriction('low sugar') && (s.includes('sweet') || s.includes('sweet drinks'))) w += 3;
    if (hasRestriction('low sodium') && s.includes('salty')) w += 3;
    if ((hasRestriction('shellfish allergy') || allergyTags.includes('shellfish')) && s.includes('raw fish')) w += 3;
    if ((hasRestriction('vegetarian') || hasRestriction('pescatarian')) && s.includes('red meat')) w += 1.5;
    if (foodEnv01k && s.includes('very spicy')) w += 1.6 * (1 - axis01('spice', 0.5));
    if (foodEnv01k && s.includes('oily')) w += 1.4 * (1 - axis01('friedOily', 0.5));
    if (foodEnv01k && s.includes('carbonated')) w += 0.8 * (1 - axis01('sweets', 0.5));
    return Math.max(0.05, w);
  };
  let dislikes = dislikePool.length ? weightedPickKUnique(rng, dislikePool.map(item => ({ item, weight: dislikeWeight(item) })), rng.int(1, 3)) : [];

  const forcedDislikes: Array<{ dislike: string; reason: string }> = [];
  const ensureDislike = (dislike: string, reason: string) => {
    if (!dislikePool.includes(dislike) || dislikes.includes(dislike)) return;
    dislikes.push(dislike);
    forcedDislikes.push({ dislike, reason });
  };

  if (allergyTags.includes('dairy')) ensureDislike('dairy', 'allergy:dairy');
  if (allergyTags.includes('shellfish')) ensureDislike('raw fish', 'allergy:shellfish');
  if (chronicConditionTags.includes('hypertension')) ensureDislike('very salty', 'chronic:hypertension');
  dislikes = uniqueStrings(dislikes).slice(0, 3);

  // Fixup incompatible comfort foods
  const incompatibleComfort = (item: string): boolean => {
    if (hasRestriction('vegetarian') && likelyMeat(item)) return true;
    if (hasRestriction('vegan') && (likelyMeat(item) || likelyDairy(item))) return true;
    if ((hasRestriction('lactose-sensitive') || allergyTags.includes('dairy')) && likelyDairy(item)) return true;
    if ((hasRestriction('gluten-sensitive') || allergyTags.includes('gluten')) && likelyGluten(item)) return true;
    if ((hasRestriction('shellfish allergy') || allergyTags.includes('shellfish')) && likelySeafood(item)) return true;
    if (hasRestriction('no seafood') && likelySeafood(item)) return true;
    return false;
  };

  const fixupRng = makeRng(facetSeed(ctx.seed, 'preferences_food_fixup'));
  const fixups: Array<{ removed: string; replacement: string | null }> = [];
  const replacementPool = comfortPool.filter(c => !incompatibleComfort(c));
  for (let i = 0; i < comfortFoods.length; i++) {
    const cur = comfortFoods[i]!;
    if (!incompatibleComfort(cur)) continue;
    const candidates = replacementPool.filter(c => !comfortFoods.includes(c));
    const replacement = candidates.length ? candidates[fixupRng.int(0, candidates.length - 1)]! : null;
    fixups.push({ removed: cur, replacement });
    if (replacement) comfortFoods[i] = replacement;
  }

  traceSet(trace, 'preferences.food', { comfortFoods, dislikes, restrictions, ritualDrink }, {
    method: 'env+consistency', dependsOn: { facet: 'preferences', foodPrimaryWeight, cultureComfortPoolSize: cultureComfort.length, cultureDrinksPoolSize: cultureDrinks.length, forcedRestrictions, forcedDislikes, fixups },
  });

  return { comfortFoods, dislikes, restrictions, ritualDrink };
}

// ============================================================================
// Media Preferences Computation
// ============================================================================

function computeMediaPreferences(ctx: PreferencesContext, rng: Rng): MediaPreferences {
  const { vocab, trace, latents, traits, aptitudes, primaryWeights, macroCulture, microProfiles, countryPriorsBucket, cultureMediaOpenness01 } = ctx;
  const { mediaPrimaryWeight } = primaryWeights;
  const public01 = latents.publicness / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const inst01 = latents.institutionalEmbeddedness / 1000;

  if (!vocab.preferences.media.genres.length) throw new Error('Agent vocab missing: preferences.media.genres');
  if (!vocab.preferences.media.platforms.length) throw new Error('Agent vocab missing: preferences.media.platforms');

  // Genre selection with microculture influence
  const microGenres = pickFromWeightedMicroProfiles(rng, microProfiles, p => p.preferences?.media?.genres, 4);
  const cultureGenres = uniqueStrings([...(macroCulture?.preferences?.media?.genres ?? []), ...microGenres]);
  const genreTopK = cultureGenres.length && rng.next01() < mediaPrimaryWeight
    ? pickKHybrid(rng, cultureGenres, vocab.preferences.media.genres, 5, 3)
    : rng.pickK(vocab.preferences.media.genres, 5);
  traceSet(trace, 'preferences.media.genreTopK', genreTopK, { method: 'hybridPickK', dependsOn: { facet: 'preferences', mediaPrimaryWeight, cultureGenrePoolSize: cultureGenres.length, globalGenrePoolSize: vocab.preferences.media.genres.length } });

  // Platform diet with country priors
  const platformDietRaw = vocab.preferences.media.platforms.map((p) => {
    const key = p.toLowerCase();
    const envBase = (() => {
      const env = countryPriorsBucket?.mediaEnvironment01k;
      if (!env) return 200;
      const v = env[key as 'print' | 'radio' | 'tv' | 'social' | 'closed'];
      return typeof v === 'number' && Number.isFinite(v) ? v : 200;
    })();
    let bias = 0;
    if (key === 'closed') bias += Math.round(70 * opsec01) + Math.round(70 * (1 - cultureMediaOpenness01));
    if (key === 'social') bias += Math.round(65 * public01) - Math.round(40 * opsec01) + Math.round(25 * cultureMediaOpenness01);
    if (key === 'tv') bias += Math.round(30 * public01);
    if (key === 'print') bias += Math.round(45 * inst01);
    if (key === 'radio') bias += Math.round(30 * inst01);
    const w = Math.max(1, Math.round(envBase * 0.9) + rng.int(0, 220) + bias * 6);
    return { p, w, envBase };
  });
  const platformDietWeights = Object.fromEntries(platformDietRaw.map(({ p, w }) => [p, w]));
  let platformDiet: Record<string, Fixed> = normalizeWeights01kExact(platformDietWeights);
  const platformDietRepairs: Array<{ rule: string; before: Record<string, Fixed>; after: Record<string, Fixed> }> = [];
  const applyPlatformDietRepair = (rule: string, mutate: (d: Record<string, Fixed>) => void) => {
    const before = { ...platformDiet };
    const next = { ...platformDiet };
    mutate(next);
    platformDiet = next;
    platformDietRepairs.push({ rule, before, after: { ...platformDiet } });
  };

  if (opsec01 > 0.75) {
    applyPlatformDietRepair('opsecCapSocialAndPreferClosed', (d) => {
      const social = d.social ?? 0;
      const closed = d.closed ?? 0;
      if (social > 250) {
        const delta = social - 250;
        d.social = 250;
        d.closed = clampFixed01k(closed + delta);
      }
      if ((d.closed ?? 0) < (d.social ?? 0)) {
        const delta = (d.social ?? 0) - (d.closed ?? 0);
        d.closed = clampFixed01k((d.closed ?? 0) + delta);
        d.social = clampFixed01k((d.social ?? 0) - delta);
      }
    });
  }

  if (trace) trace.derived.platformDietRaw = platformDietRaw.map(({ p, w, envBase }) => ({ p, w, envBase }));
  if (trace && platformDietRepairs.length) trace.derived.platformDietRepairs = platformDietRepairs;
  traceSet(trace, 'preferences.media.platformDiet', platformDiet, { method: 'env+weightedNormalizeExact+repairs', dependsOn: { facet: 'preferences', public01, opsec01, inst01, env: countryPriorsBucket?.mediaEnvironment01k ?? null, platformDietRepairs } });

  // Media/cognition traits
  const attentionResilience = clampFixed01k(
    0.42 * aptitudes.attentionControl + 0.22 * traits.conscientiousness + 0.12 * aptitudes.workingMemory +
    0.10 * (1000 - latents.publicness) + 0.08 * latents.impulseControl + 0.06 * rng.int(0, 1000),
  );
  const doomscrollingRisk = clampFixed01k(
    0.30 * latents.publicness + 0.22 * (1000 - latents.opsecDiscipline) + 0.18 * (1000 - traits.conscientiousness) +
    0.10 * traits.noveltySeeking + 0.10 * (1000 - latents.impulseControl) + 0.06 * latents.stressReactivity + 0.04 * rng.int(0, 1000),
  );
  const epistemicHygiene = clampFixed01k(
    0.28 * aptitudes.workingMemory + 0.20 * aptitudes.attentionControl + 0.20 * latents.institutionalEmbeddedness +
    0.20 * latents.opsecDiscipline + 0.12 * rng.int(0, 1000),
  );
  traceSet(trace, 'preferences.media.metrics', { attentionResilience, doomscrollingRisk, epistemicHygiene }, { method: 'formula', dependsOn: { facet: 'preferences', aptitudes, traits, latents } });

  return { platformDiet, genreTopK, attentionResilience, doomscrollingRisk, epistemicHygiene };
}

// ============================================================================
// Fashion Preferences Computation
// ============================================================================

function computeFashionPreferences(ctx: PreferencesContext, _rng: Rng): FashionPreferences {
  const { seed, vocab, trace, tierBand, latents, traits, primaryWeights, macroCulture, microProfiles, cultureTraditionalism01 } = ctx;
  const { fashionPrimaryWeight } = primaryWeights;
  const public01 = latents.publicness / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const inst01 = latents.institutionalEmbeddedness / 1000;

  traceFacet(trace, seed, 'fashion');
  const fashionRng = makeRng(facetSeed(seed, 'fashion'));

  if (!vocab.preferences.fashion.styleTags.length) throw new Error('Agent vocab missing: preferences.fashion.styleTags');

  // Style tags with microculture influence
  const microStyleTags = pickFromWeightedMicroProfiles(fashionRng, microProfiles, p => p.preferences?.fashion?.styleTags, 3);
  const cultureStyle = uniqueStrings([...(macroCulture?.preferences?.fashion?.styleTags ?? []), ...microStyleTags]);
  let styleTags = cultureStyle.length && fashionRng.next01() < fashionPrimaryWeight
    ? pickKHybrid(fashionRng, cultureStyle, vocab.preferences.fashion.styleTags, 3, 2)
    : fashionRng.pickK(vocab.preferences.fashion.styleTags, 3);

  // Enforce coherence with visibility/opsec/institutional factors
  const stylePool = uniqueStrings([...cultureStyle, ...vocab.preferences.fashion.styleTags]);
  const forced: string[] = [];
  const addForced = (tag: string) => {
    if (stylePool.includes(tag) && !forced.includes(tag)) forced.push(tag);
  };
  if (public01 > 0.7) { addForced('formal'); addForced('tailored'); }
  if (opsec01 > 0.7) { addForced('utilitarian'); addForced('techwear'); }
  if (inst01 > 0.7) { addForced('classic'); addForced('minimalist'); }
  if (cultureTraditionalism01 > 0.72) { addForced('classic'); addForced('formal'); addForced('traditional'); }
  if (tierBand === 'elite') addForced('formal');
  for (const tag of forced.slice(0, 2)) {
    if (!styleTags.includes(tag)) styleTags = uniqueStrings([tag, ...styleTags]).slice(0, 3);
  }

  // High OPSEC + low public: avoid attention-grabbing styles
  if (opsec01 > 0.75 && public01 < 0.45) {
    const forbidden = new Set(['maximalist', 'colorful', 'avant-garde', 'punk', 'goth']);
    const replacements = ['monochrome', 'utilitarian', 'workwear', 'minimalist'];
    for (const bad of forbidden) {
      if (!styleTags.includes(bad)) continue;
      const replacement = replacements.find(r => stylePool.includes(r) && !styleTags.includes(r));
      styleTags = uniqueStrings([...(replacement ? [replacement] : []), ...styleTags.filter(t => t !== bad)]).slice(0, 3);
    }
  }
  traceSet(trace, 'preferences.fashion.styleTags', styleTags, { method: 'pickK+forced', dependsOn: { facet: 'fashion', fashionPrimaryWeight, cultureStylePoolSize: cultureStyle.length, forced: forced.slice(0, 2) } });

  // Fashion metrics
  const formality = clampFixed01k(
    0.36 * latents.publicness + 0.32 * latents.institutionalEmbeddedness + 0.18 * fashionRng.int(0, 1000) +
    (tierBand === 'elite' ? 90 : tierBand === 'mass' ? -40 : 0),
  );
  const conformity = clampFixed01k(
    0.38 * latents.institutionalEmbeddedness + 0.22 * traits.conscientiousness +
    0.16 * (1000 - traits.noveltySeeking) + 0.24 * fashionRng.int(0, 1000),
  );
  const statusSignaling = clampFixed01k(
    0.34 * latents.publicness + 0.26 * (tierBand === 'elite' ? 920 : tierBand === 'middle' ? 600 : 420) +
    0.14 * (1000 - latents.opsecDiscipline) + 0.10 * latents.aestheticExpressiveness +
    0.26 * fashionRng.int(0, 1000) - 0.12 * latents.frugality,
  );
  traceSet(trace, 'preferences.fashion.metrics', { formality, conformity, statusSignaling, forced: forced.slice(0, 2) }, { method: 'formula+forcedTags', dependsOn: { facet: 'fashion', latents, traits, tierBand } });

  return { styleTags, formality, conformity, statusSignaling };
}

// ============================================================================
// Routines Computation
// ============================================================================

function computeRoutines(ctx: PreferencesContext, _rng: Rng, doomscrollingRisk: Fixed): RoutinesResult {
  const { seed, vocab, trace, latents, traits, aptitudes, age, careerTrackTag, roleSeedTags, chronicConditionTags, climateIndicators } = ctx;

  traceFacet(trace, seed, 'routines');
  const routinesRng = makeRng(facetSeed(seed, 'routines'));

  if (!vocab.routines.chronotypes.length) throw new Error('Agent vocab missing: routines.chronotypes');
  if (!vocab.routines.recoveryRituals.length) throw new Error('Agent vocab missing: routines.recoveryRituals');

  // Enhanced chronotype selection
  const stressReactivity01 = latents.stressReactivity / 1000;
  const adapt01 = latents.adaptability / 1000;
  const chronotypeWeights = vocab.routines.chronotypes.map((t) => {
    const key = t.toLowerCase();
    let w = 1;
    if (key === 'early' || key === 'ultra-early') {
      w += 1.4 * (traits.conscientiousness / 1000) + 0.6 * (age / 120);
      if (key === 'ultra-early') w -= 0.5;
    }
    if (key === 'night') w += 1.2 * (traits.noveltySeeking / 1000) + 0.7 * (latents.riskAppetite / 1000);
    if (key === 'standard') w += 0.7;
    if (key === 'variable') { w += 1.0 * stressReactivity01 + 0.4 * (1 - traits.conscientiousness / 1000) + 0.8 * adapt01; }
    if (key === 'biphasic') { w += 0.8 * climateIndicators.hot01 + 0.3 * (age / 120); }
    if (key === 'flex-shift') { w += 1.0 * (careerTrackTag === 'logistics' ? 1 : 0) + 0.6 * (roleSeedTags.includes('operative') ? 1 : 0) + 0.8 * adapt01; }
    if (key === 'rotating') { w += 1.2 * (careerTrackTag === 'military' ? 1 : 0) + 0.8 * (careerTrackTag === 'public-health' ? 1 : 0) + 0.5 * (roleSeedTags.includes('security') ? 1 : 0); }
    if (key === 'standard') { w += 0.5 * (1 - adapt01); }
    if (careerTrackTag === 'journalism' && key === 'night') w += 0.6;
    if (careerTrackTag === 'civil-service' && key === 'early') w += 0.4;
    const hasInsomnia = chronicConditionTags.some(c => c.toLowerCase().includes('insomnia') || c.toLowerCase().includes('sleep'));
    if (hasInsomnia && (key === 'early' || key === 'ultra-early')) w *= 0.5;
    if (hasInsomnia && key === 'variable') w += 0.8;
    return { item: t, weight: Math.max(0.1, w) };
  });
  const chronotype = weightedPick(routinesRng, chronotypeWeights);

  // Sleep window based on chronotype
  const sleepWindow = (() => {
    switch (chronotype.toLowerCase()) {
      case 'early': return '22:00-06:00';
      case 'ultra-early': return '20:30-04:30';
      case 'night': return '02:00-10:00';
      case 'biphasic': return '00:00-06:00 + 14:00-15:30';
      case 'flex-shift': return 'varies by assignment';
      case 'rotating': return 'shift-dependent';
      case 'variable': return 'inconsistent';
      default: return '00:00-08:00';
    }
  })();

  // Recovery rituals with weighted selection
  const ritualWeights = vocab.routines.recoveryRituals.map((r) => {
    const key = r.toLowerCase();
    let w = 1;
    if (key.includes('gym') || key.includes('run') || key.includes('cardio')) {
      w += 1.2 * (aptitudes.endurance / 1000) + 0.3 * (traits.conscientiousness / 1000) + 0.6 * (latents.physicalConditioning / 1000);
    }
    if (key.includes('meditation') || key.includes('breath')) w += 0.8 * (traits.conscientiousness / 1000) + 0.8 * ((1000 - aptitudes.attentionControl) / 1000);
    if (key.includes('sleep') || key.includes('nap')) w += 0.6 * ((1000 - aptitudes.endurance) / 1000);
    if (key.includes('reading') || key.includes('journal')) w += 0.7 * (aptitudes.workingMemory / 1000);
    if (key.includes('walk')) w += 0.4 * (aptitudes.endurance / 1000);
    if (key.includes('music')) w += 0.4 * (traits.agreeableness / 1000);
    if (key.includes('call') || key.includes('cafe') || key.includes('cook') || key.includes('board game') || key.includes('movie')) {
      w += 0.9 * (latents.socialBattery / 1000);
    }
    if (key.includes('phone-free') || key.includes('offline') || key.includes('gardening') || key.includes('clean')) {
      w += 0.5 * (doomscrollingRisk / 1000) + 0.35 * (latents.stressReactivity / 1000);
    }
    return { item: r, weight: w };
  });
  const weightByRitual = new Map(ritualWeights.map(({ item, weight }) => [item, weight]));
  let recoveryRituals = weightedPickKUnique(routinesRng, ritualWeights, 2);

  // Repair logic for ensuring appropriate recovery rituals
  const routinesRepairs: Array<{ rule: string; removed: string | null; added: string }> = [];
  const repairRng = makeRng(facetSeed(seed, 'routines_repair'));
  const hasAny = (cands: string[]) => cands.some(c => recoveryRituals.includes(c));
  const pickCand = (cands: string[]) => {
    const available = cands.filter(c => vocab.routines.recoveryRituals.includes(c));
    return available.length ? available[repairRng.int(0, available.length - 1)]! : null;
  };
  const replaceOne = (added: string, rule: string) => {
    if (recoveryRituals.includes(added)) return;
    const candidates = [...recoveryRituals].map((r) => ({ r, w: weightByRitual.get(r) ?? 0 })).sort((a, b) => (a.w - b.w) || a.r.localeCompare(b.r));
    const removed = candidates[0]?.r ?? null;
    recoveryRituals = uniqueStrings([added, ...recoveryRituals.filter(r => r !== removed)]).slice(0, 2);
    routinesRepairs.push({ rule, removed, added });
  };

  const socialSet = ['call a friend', 'cook a meal', 'board game night', 'movie night', 'cafe hour'];
  const soloSet = ['journaling', 'long walk', 'reading fiction', 'meditation', 'tea ritual', 'quiet music', 'gardening', 'clean the workspace'];
  const offlineSet = ['phone-free hour', 'long walk', 'gym session', 'sauna', 'gardening', 'clean the workspace', 'stretching'];

  if ((latents.socialBattery / 1000) > 0.65 && !hasAny(socialSet)) {
    const c = pickCand(socialSet);
    if (c) replaceOne(c, 'ensureSocialRecovery');
  }
  if ((latents.socialBattery / 1000) < 0.35 && !hasAny(soloSet)) {
    const c = pickCand(soloSet);
    if (c) replaceOne(c, 'ensureSoloRecovery');
  }
  if ((doomscrollingRisk / 1000) > 0.7 && !hasAny(offlineSet)) {
    const c = pickCand(offlineSet);
    if (c) replaceOne(c, 'ensureOfflineRecovery');
  }

  if (trace && routinesRepairs.length) trace.derived.routinesRepairs = routinesRepairs;
  traceSet(trace, 'routines', { chronotype, sleepWindow, recoveryRituals }, { method: 'weightedPick+weightedPickKUnique+repairs', dependsOn: { facet: 'routines', traits, aptitudes, careerTrackTag, routinesRepairs } });

  return { chronotype, sleepWindow, recoveryRituals };
}

// ============================================================================
// Hobbies Computation
// ============================================================================

const HOBBY_CATEGORIES = ['physical', 'creative', 'intellectual', 'technical', 'social', 'outdoor', 'culinary'] as const;

function computeHobbies(ctx: PreferencesContext, rng: Rng): HobbiesPreferences {
  const { vocab, trace, traits, latents, age, tierBand } = ctx;
  const hobbiesVocab = vocab.preferences?.hobbies;

  // Fallback if no hobbies in vocab
  if (!hobbiesVocab) {
    return { primary: [], secondary: [], categories: [] };
  }

  // Determine number of hobbies based on age, tier, and social battery
  // Younger and higher social battery = more hobbies
  const baseCount = age < 30 ? 4 : age < 50 ? 3 : 2;
  const socialBonus = latents.socialBattery > 600 ? 1 : 0;
  const totalHobbies = baseCount + socialBonus + (tierBand === 'elite' ? 1 : 0);

  // Weight hobby categories based on personality
  const categoryWeights = HOBBY_CATEGORIES.map(cat => {
    let w = 10;

    // Physical hobbies influenced by riskAppetite and novelty
    if (cat === 'physical') {
      if (latents.riskAppetite > 600) w += 5;
      if (age < 40) w += 3;
    }
    // Creative hobbies influenced by aesthetic expressiveness
    if (cat === 'creative') {
      if (latents.aestheticExpressiveness > 600) w += 8;
    }
    // Intellectual hobbies influenced by conscientiousness
    if (cat === 'intellectual') {
      if (traits.conscientiousness > 600) w += 5;
      if (age > 40) w += 3;
    }
    // Technical hobbies influenced by novelty seeking
    if (cat === 'technical') {
      if (traits.noveltySeeking > 600) w += 5;
    }
    // Social hobbies influenced by social battery and agreeableness
    if (cat === 'social') {
      if (latents.socialBattery > 600) w += 8;
      if (traits.agreeableness > 600) w += 3;
    }
    // Outdoor hobbies influenced by risk appetite
    if (cat === 'outdoor') {
      if (latents.riskAppetite > 500) w += 5;
    }
    // Culinary hobbies - universal appeal with slight creativity boost
    if (cat === 'culinary') {
      if (latents.aestheticExpressiveness > 500) w += 3;
    }

    return { item: cat, weight: w };
  });

  // Pick 2-3 primary categories
  const numCategories = Math.min(3, Math.max(2, Math.floor(totalHobbies / 2)));
  const chosenCategories = weightedPickKUnique(rng, categoryWeights, numCategories);

  // Pick hobbies from chosen categories
  const allHobbies: string[] = [];
  for (const cat of chosenCategories) {
    const catHobbies = hobbiesVocab[cat as keyof typeof hobbiesVocab] ?? [];
    if (catHobbies.length > 0) {
      const pickCount = Math.min(2, catHobbies.length);
      const picked = rng.pickK(catHobbies, pickCount);
      allHobbies.push(...picked);
    }
  }

  // Split into primary (top 2-3) and secondary (rest)
  // allHobbies is already randomly picked, so we can just slice
  const primaryCount = Math.min(3, Math.ceil(allHobbies.length / 2));
  const primary = allHobbies.slice(0, primaryCount);
  const secondary = allHobbies.slice(primaryCount);

  traceSet(trace, 'hobbies', { primary, secondary, categories: chosenCategories }, {
    method: 'weightedPickKUnique+rng.pickK',
    dependsOn: { facet: 'hobbies', age, tierBand, socialBattery: latents.socialBattery },
  });

  return { primary, secondary, categories: chosenCategories };
}

// ============================================================================
// Extended Preferences (Environment, Social, Work, Quirks, Time)
// ============================================================================

function pickKBounded(rng: Rng, pool: string[], min: number, max: number): string[] {
  if (!pool.length) return [];
  const upper = Math.min(max, pool.length);
  const lower = Math.min(min, upper);
  const count = lower === upper ? upper : rng.int(lower, upper);
  return rng.pickK(pool, count);
}

function computeEnvironmentPreferences(ctx: PreferencesContext, rng: Rng): EnvironmentPreferences {
  const { vocab, trace } = ctx;
  const env = vocab.preferences.environment;
  if (!env?.temperatureTags?.length) throw new Error('Agent vocab missing: preferences.environment.temperatureTags');
  if (!env?.weatherMoodTags?.length) throw new Error('Agent vocab missing: preferences.environment.weatherMoodTags');

  const temperature = rng.pick(env.temperatureTags);
  const weatherMood = rng.pick(env.weatherMoodTags);

  traceSet(trace, 'preferences.environment', { temperature, weatherMood }, {
    method: 'rng.pick',
    dependsOn: { facet: 'preferences', temperaturePoolSize: env.temperatureTags.length, weatherMoodPoolSize: env.weatherMoodTags.length },
  });

  return { temperature, weatherMood };
}

function computeLivingSpacePreferences(ctx: PreferencesContext, rng: Rng): LivingSpacePreferences {
  const { vocab, trace } = ctx;
  const living = vocab.preferences.livingSpace;
  if (!living?.roomPreferenceTags?.length) throw new Error('Agent vocab missing: preferences.livingSpace.roomPreferenceTags');
  if (!living?.comfortItemTags?.length) throw new Error('Agent vocab missing: preferences.livingSpace.comfortItemTags');

  const roomPreferences = pickKBounded(rng, living.roomPreferenceTags, 1, 2);
  const comfortItems = pickKBounded(rng, living.comfortItemTags, 1, 2);

  traceSet(trace, 'preferences.livingSpace', { roomPreferences, comfortItems }, {
    method: 'rng.pickK',
    dependsOn: { facet: 'preferences', roomPoolSize: living.roomPreferenceTags.length, comfortPoolSize: living.comfortItemTags.length },
  });

  return { roomPreferences, comfortItems };
}

function computeAestheticsPreferences(ctx: PreferencesContext, rng: Rng): AestheticsPreferences {
  const { vocab, trace, latents, roleSeedTags, tierBand } = ctx;
  const aesthetics = vocab.preferences.aesthetics;
  if (!aesthetics?.colorPalettes?.length) throw new Error('Agent vocab missing: preferences.aesthetics.colorPalettes');
  if (!aesthetics?.patternPreferences?.length) throw new Error('Agent vocab missing: preferences.aesthetics.patternPreferences');
  if (!aesthetics?.lightingPreferences?.length) throw new Error('Agent vocab missing: preferences.aesthetics.lightingPreferences');
  if (!aesthetics?.visualComplexityPreferences?.length) throw new Error('Agent vocab missing: preferences.aesthetics.visualComplexityPreferences');
  if (!aesthetics?.decorPreferences?.length) throw new Error('Agent vocab missing: preferences.aesthetics.decorPreferences');
  if (!aesthetics?.architectureStyles?.length) throw new Error('Agent vocab missing: preferences.aesthetics.architectureStyles');
  if (!aesthetics?.soundscapes?.length) throw new Error('Agent vocab missing: preferences.aesthetics.soundscapes');
  if (!aesthetics?.noiseTolerancePreferences?.length) throw new Error('Agent vocab missing: preferences.aesthetics.noiseTolerancePreferences');
  if (!aesthetics?.texturePreferences?.length) throw new Error('Agent vocab missing: preferences.aesthetics.texturePreferences');
  if (!aesthetics?.materialPreferences?.length) throw new Error('Agent vocab missing: preferences.aesthetics.materialPreferences');
  if (!aesthetics?.touchPreferences?.length) throw new Error('Agent vocab missing: preferences.aesthetics.touchPreferences');
  if (!aesthetics?.scentAttractions?.length) throw new Error('Agent vocab missing: preferences.aesthetics.scentAttractions');
  if (!aesthetics?.scentAversions?.length) throw new Error('Agent vocab missing: preferences.aesthetics.scentAversions');

  const aesthetic01 = latents.aestheticExpressiveness / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const frugal01 = latents.frugality / 1000;
  const social01 = latents.socialBattery / 1000;
  const public01 = latents.publicness / 1000;

  const pickWeighted = (pool: string[], weightFn: (item: string) => number): string => (
    weightedPick(rng, pool.map(item => ({ item, weight: weightFn(item) }))) as string
  );
  const pickKWeighted = (pool: string[], count: number, weightFn: (item: string) => number): string[] => {
    const bounded = Math.max(1, Math.min(count, pool.length));
    return weightedPickKUnique(rng, pool.map(item => ({ item, weight: weightFn(item) })), bounded);
  };

  const colorPalette = pickWeighted(aesthetics.colorPalettes, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('monochrome') || lower.includes('muted') || lower.includes('cool')) w += 0.8 * opsec01 + 0.6 * frugal01;
    if (lower.includes('neon') || lower.includes('high-contrast')) w += 1.0 * aesthetic01 + 0.5 * public01;
    if (lower.includes('warm') || lower.includes('amber')) w += 0.4 * social01;
    return w;
  });

  const patternPreference = pickWeighted(aesthetics.patternPreferences, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('solids') || lower.includes('minimal')) w += 0.7 * opsec01 + 0.6 * frugal01;
    if (lower.includes('chaotic') || lower.includes('color-block')) w += 0.9 * aesthetic01;
    if (lower.includes('traditional')) w += tierBand === 'elite' ? 0.3 : 0.6;
    return w;
  });

  const lightingPreference = pickWeighted(aesthetics.lightingPreferences, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('dim') || lower.includes('candle')) w += 0.9 * opsec01;
    if (lower.includes('bright') || lower.includes('natural')) w += 0.6 * social01 + 0.4 * (1 - opsec01);
    if (lower.includes('task')) w += 0.5 * frugal01;
    return w;
  });

  const visualComplexityPreference = pickWeighted(aesthetics.visualComplexityPreferences, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('minimal') || lower.includes('orderly')) w += 0.8 * (1 - aesthetic01) + 0.6 * frugal01;
    if (lower.includes('maximal') || lower.includes('chaotic')) w += 0.9 * aesthetic01;
    return w;
  });

  const decorPreferences = pickKWeighted(aesthetics.decorPreferences, 2, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('art') || lower.includes('plants') || lower.includes('textiles')) w += 0.8 * aesthetic01;
    if (lower.includes('maps') || lower.includes('weapons')) w += roleSeedTags.includes('operative') ? 0.7 : 0.2;
    if (lower.includes('clean')) w += 0.6 * frugal01 + 0.4 * opsec01;
    return w;
  });

  const architectureStyle = pickWeighted(aesthetics.architectureStyles, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('brutalist') || lower.includes('industrial')) w += 0.6 * opsec01;
    if (lower.includes('traditional') || lower.includes('vernacular')) w += 0.6 * frugal01;
    if (lower.includes('art-deco') || lower.includes('modern')) w += 0.6 * aesthetic01 + 0.4 * public01;
    return w;
  });

  const soundscape = pickWeighted(aesthetics.soundscapes, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('silence')) w += 0.8 * opsec01 + 0.6 * (1 - social01);
    if (lower.includes('city') || lower.includes('coffee')) w += 0.8 * social01;
    if (lower.includes('rain')) w += 0.4;
    return w;
  });

  const noiseTolerancePreference = pickWeighted(aesthetics.noiseTolerancePreferences, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('quiet')) w += 0.7 * opsec01 + 0.6 * (1 - social01);
    if (lower.includes('buzz') || lower.includes('noise')) w += 0.7 * social01;
    return w;
  });

  const texturePreference = pickWeighted(aesthetics.texturePreferences, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('soft')) w += 0.6 * aesthetic01;
    if (lower.includes('rough')) w += 0.3 * frugal01;
    return w;
  });

  const materialPreference = pickWeighted(aesthetics.materialPreferences, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('polymer') || lower.includes('carbon')) w += 0.5 * frugal01;
    if (lower.includes('steel') || lower.includes('brass')) w += 0.5 * public01;
    return w;
  });

  const touchPreference = pickWeighted(aesthetics.touchPreferences, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('hugger') || lower.includes('casual')) w += 0.8 * social01;
    if (lower.includes('no-touch') || lower.includes('professional')) w += 0.7 * (1 - social01) + 0.4 * opsec01;
    return w;
  });

  const scentAttraction = rng.pick(aesthetics.scentAttractions);
  const scentAversion = rng.pick(aesthetics.scentAversions);

  const result: AestheticsPreferences = {
    colorPalette,
    patternPreference,
    lightingPreference,
    visualComplexityPreference,
    decorPreferences,
    architectureStyle,
    soundscape,
    noiseTolerancePreference,
    texturePreference,
    materialPreference,
    touchPreference,
    scentAttraction,
    scentAversion,
  };

  traceSet(trace, 'preferences.aesthetics', result, {
    method: 'weightedPick+pickK',
    dependsOn: { facet: 'preferences', aestheticExpressiveness: latents.aestheticExpressiveness },
  });

  return result;
}

function computeArtisticPreferences(ctx: PreferencesContext, rng: Rng): ArtisticPreferences {
  const { vocab, trace, latents, roleSeedTags, tierBand } = ctx;
  const artistic = vocab.preferences.artistic;
  if (!artistic?.mediums?.length) throw new Error('Agent vocab missing: preferences.artistic.mediums');
  if (!artistic?.specializations?.length) throw new Error('Agent vocab missing: preferences.artistic.specializations');
  if (!artistic?.themes?.length) throw new Error('Agent vocab missing: preferences.artistic.themes');
  if (!artistic?.inspirationSources?.length) throw new Error('Agent vocab missing: preferences.artistic.inspirationSources');
  if (!artistic?.expressionDrivers?.length) throw new Error('Agent vocab missing: preferences.artistic.expressionDrivers');
  if (!artistic?.practiceRhythms?.length) throw new Error('Agent vocab missing: preferences.artistic.practiceRhythms');
  if (!artistic?.sharingStyles?.length) throw new Error('Agent vocab missing: preferences.artistic.sharingStyles');
  if (!artistic?.workspacePreferences?.length) throw new Error('Agent vocab missing: preferences.artistic.workspacePreferences');
  if (!artistic?.learningModes?.length) throw new Error('Agent vocab missing: preferences.artistic.learningModes');
  if (!artistic?.challenges?.length) throw new Error('Agent vocab missing: preferences.artistic.challenges');

  const aesthetic01 = latents.aestheticExpressiveness / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const social01 = latents.socialBattery / 1000;
  const public01 = latents.publicness / 1000;
  const stress01 = latents.stressReactivity / 1000;
  const frugal01 = latents.frugality / 1000;
  const physical01 = latents.physicalConditioning / 1000;
  const cosmo01 = ctx.cosmo01;
  const abroad = ctx.abroad;

  const pickWeighted = (pool: string[], weightFn: (item: string) => number): string => (
    weightedPick(rng, pool.map(item => ({ item, weight: weightFn(item) }))) as string
  );

  const mediumWeights = artistic.mediums.map((item) => {
    const lower = item.toLowerCase();
    let w = 1 + 0.8 * aesthetic01;
    if (lower.includes('journaling') || lower.includes('letters')) w += 0.8 * opsec01;
    if (lower.includes('photography') || lower.includes('sketch') || lower.includes('painting')) w += 0.6 * aesthetic01;
    if (lower.includes('music') || lower.includes('dance') || lower.includes('theater')) w += 0.6 * social01;
    if (lower.includes('culinary')) w += 0.4 * social01;
    if (lower.includes('wood') || lower.includes('metal') || lower.includes('textile')) w += 0.4 * (tierBand === 'mass' ? 1 : 0.5);
    return { item, weight: w };
  });
  const mediums = weightedPickKUnique(rng, mediumWeights, Math.min(2, mediumWeights.length));

  const specializationWeights = artistic.specializations.map((item) => {
    const lower = item.toLowerCase();
    let w = 1 + 0.6 * aesthetic01;
    if (lower.includes('war') || lower.includes('combat') || lower.includes('battle')) w += 0.6 * stress01 + (roleSeedTags.includes('operative') ? 0.4 : 0);
    if (lower.includes('portrait') || lower.includes('people') || lower.includes('love')) w += 0.5 * social01;
    if (lower.includes('code') || lower.includes('encrypted')) w += 0.5 * opsec01;
    if (lower.includes('abstract') || lower.includes('surreal') || lower.includes('generative')) w += 0.5 * aesthetic01;
    if (lower.includes('knife') || lower.includes('metal') || lower.includes('wood')) w += 0.3 * physical01;
    return { item, weight: w };
  });
  const specializations = weightedPickKUnique(rng, specializationWeights, Math.min(2, specializationWeights.length));

  const themeWeights = artistic.themes.map((item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('war') || lower.includes('violence') || lower.includes('aftermath')) w += 0.6 * stress01 + (roleSeedTags.includes('operative') ? 0.4 : 0);
    if (lower.includes('identity') || lower.includes('heritage') || lower.includes('diaspora')) w += 0.6 * cosmo01 + (abroad ? 0.4 : 0);
    if (lower.includes('love') || lower.includes('connection') || lower.includes('family')) w += 0.5 * social01;
    if (lower.includes('loss') || lower.includes('grief')) w += 0.6 * stress01;
    return { item, weight: w };
  });
  const themes = weightedPickKUnique(rng, themeWeights, Math.min(2, themeWeights.length));

  const inspirationSource = pickWeighted(artistic.inspirationSources, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('memory') || lower.includes('mission')) w += 0.6 * stress01;
    if (lower.includes('environment') || lower.includes('light')) w += 0.6 * aesthetic01;
    if (lower.includes('people')) w += 0.6 * social01;
    return w;
  });

  const expressionDriver = pickWeighted(artistic.expressionDrivers, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('grief') || lower.includes('guilt')) w += 0.7 * stress01;
    if (lower.includes('quiet-joy') || lower.includes('hope')) w += 0.4 * (1 - stress01);
    if (lower.includes('identity')) w += 0.4 * aesthetic01;
    return w;
  });

  const practiceRhythm = pickWeighted(artistic.practiceRhythms, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('late-night')) w += 0.5 * stress01;
    if (lower.includes('pre-dawn')) w += 0.4 * (1 - stress01);
    if (lower.includes('mission')) w += roleSeedTags.includes('operative') ? 0.6 : 0.2;
    return w;
  });

  const sharingStyle = pickWeighted(artistic.sharingStyles, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('private') || lower.includes('never')) w += 0.8 * opsec01;
    if (lower.includes('trusted')) w += 0.5 * social01;
    if (lower.includes('public')) w += 0.6 * public01;
    if (lower.includes('anonymous')) w += 0.4 * opsec01 + 0.3 * public01;
    return w;
  });

  const workspacePreference = pickWeighted(artistic.workspacePreferences, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('portable') || lower.includes('improvised')) w += roleSeedTags.includes('operative') ? 0.7 : 0.2;
    if (lower.includes('hidden')) w += 0.6 * opsec01;
    if (lower.includes('dedicated')) w += 0.5 * (tierBand === 'elite' ? 1 : 0.4);
    if (lower.includes('outdoor')) w += 0.4 * (1 - opsec01);
    return w;
  });

  const learningMode = pickWeighted(artistic.learningModes, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('self') || lower.includes('youtube') || lower.includes('library')) w += 0.6 * opsec01 + 0.4 * frugal01;
    if (lower.includes('formal') || lower.includes('degree') || lower.includes('workshop')) w += 0.5 * public01;
    if (lower.includes('mentor') || lower.includes('critique') || lower.includes('peer')) w += 0.6 * social01;
    if (lower.includes('online')) w += 0.4 * opsec01;
    return w;
  });

  const challenge = pickWeighted(artistic.challenges, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('security') || lower.includes('exposure') || lower.includes('visibility')) w += 0.7 * opsec01 + 0.4 * public01;
    if (lower.includes('time') || lower.includes('exhaustion') || lower.includes('fatigue')) w += 0.6 * stress01;
    if (lower.includes('resource') || lower.includes('cost')) w += 0.6 * frugal01;
    if (lower.includes('vulnerability') || lower.includes('rejection') || lower.includes('perfection')) w += 0.5 * stress01;
    if (lower.includes('physical')) w += 0.5 * (1 - physical01);
    return w;
  });

  const result: ArtisticPreferences = {
    mediums,
    specializations,
    themes,
    inspirationSource,
    expressionDriver,
    practiceRhythm,
    sharingStyle,
    workspacePreference,
    learningMode,
    challenge,
  };

  traceSet(trace, 'preferences.artistic', result, {
    method: 'weightedPick+pickK',
    dependsOn: { facet: 'preferences', aestheticExpressiveness: latents.aestheticExpressiveness },
  });

  return result;
}

function computeSocialPreferences(ctx: PreferencesContext, rng: Rng): SocialPreferences {
  const { vocab, trace } = ctx;
  const social = vocab.preferences.social;
  if (!social?.groupStyleTags?.length) throw new Error('Agent vocab missing: preferences.social.groupStyleTags');
  if (!social?.communicationMethodTags?.length) throw new Error('Agent vocab missing: preferences.social.communicationMethodTags');
  if (!social?.boundaryTags?.length) throw new Error('Agent vocab missing: preferences.social.boundaryTags');
  if (!social?.emotionalSharingTags?.length) throw new Error('Agent vocab missing: preferences.social.emotionalSharingTags');

  const groupStyle = rng.pick(social.groupStyleTags);
  const communicationMethod = rng.pick(social.communicationMethodTags);
  const boundary = rng.pick(social.boundaryTags);
  const emotionalSharing = rng.pick(social.emotionalSharingTags);

  traceSet(trace, 'preferences.social', { groupStyle, communicationMethod, boundary, emotionalSharing }, {
    method: 'rng.pick',
    dependsOn: {
      facet: 'preferences',
      groupPoolSize: social.groupStyleTags.length,
      commsPoolSize: social.communicationMethodTags.length,
      boundaryPoolSize: social.boundaryTags.length,
      sharingPoolSize: social.emotionalSharingTags.length,
    },
  });

  return { groupStyle, communicationMethod, boundary, emotionalSharing };
}

function computeWorkPreferences(ctx: PreferencesContext, rng: Rng): WorkPreferences {
  const { vocab, trace } = ctx;
  const work = vocab.preferences.work;
  if (!work?.preferredOperationTags?.length) throw new Error('Agent vocab missing: preferences.work.preferredOperationTags');
  if (!work?.avoidedOperationTags?.length) throw new Error('Agent vocab missing: preferences.work.avoidedOperationTags');

  const preferredOperations = pickKBounded(rng, work.preferredOperationTags, 1, 2);
  const avoidedOperations = pickKBounded(rng, work.avoidedOperationTags, 1, 2);

  traceSet(trace, 'preferences.work', { preferredOperations, avoidedOperations }, {
    method: 'rng.pickK',
    dependsOn: { facet: 'preferences', preferredPoolSize: work.preferredOperationTags.length, avoidedPoolSize: work.avoidedOperationTags.length },
  });

  return { preferredOperations, avoidedOperations };
}

function computeEquipmentPreferences(ctx: PreferencesContext, rng: Rng): EquipmentPreferences {
  const { vocab, trace } = ctx;
  const equipment = vocab.preferences.equipment;
  if (!equipment?.weaponPreferenceTags?.length) throw new Error('Agent vocab missing: preferences.equipment.weaponPreferenceTags');
  if (!equipment?.gearPreferenceTags?.length) throw new Error('Agent vocab missing: preferences.equipment.gearPreferenceTags');

  const weaponPreference = rng.pick(equipment.weaponPreferenceTags);
  const gearPreferences = pickKBounded(rng, equipment.gearPreferenceTags, 1, 2);

  traceSet(trace, 'preferences.equipment', { weaponPreference, gearPreferences }, {
    method: 'rng.pick+pickK',
    dependsOn: { facet: 'preferences', weaponPoolSize: equipment.weaponPreferenceTags.length, gearPoolSize: equipment.gearPreferenceTags.length },
  });

  return { weaponPreference, gearPreferences };
}

function computeQuirksPreferences(ctx: PreferencesContext, rng: Rng): QuirksPreferences {
  const { vocab, trace } = ctx;
  const quirks = vocab.preferences.quirks;
  if (!quirks?.luckyItemTags?.length) throw new Error('Agent vocab missing: preferences.quirks.luckyItemTags');
  if (!quirks?.ritualTags?.length) throw new Error('Agent vocab missing: preferences.quirks.ritualTags');
  if (!quirks?.petPeeveTags?.length) throw new Error('Agent vocab missing: preferences.quirks.petPeeveTags');
  if (!quirks?.mustHaveTags?.length) throw new Error('Agent vocab missing: preferences.quirks.mustHaveTags');

  const luckyItem = rng.pick(quirks.luckyItemTags);
  const rituals = pickKBounded(rng, quirks.ritualTags, 1, 2);
  const petPeeves = pickKBounded(rng, quirks.petPeeveTags, 1, 2);
  const mustHaves = pickKBounded(rng, quirks.mustHaveTags, 1, 2);

  traceSet(trace, 'preferences.quirks', { luckyItem, rituals, petPeeves, mustHaves }, {
    method: 'rng.pick+pickK',
    dependsOn: {
      facet: 'preferences',
      luckyPoolSize: quirks.luckyItemTags.length,
      ritualPoolSize: quirks.ritualTags.length,
      peevePoolSize: quirks.petPeeveTags.length,
      mustHavePoolSize: quirks.mustHaveTags.length,
    },
  });

  return { luckyItem, rituals, petPeeves, mustHaves };
}

function computeTimePreferences(ctx: PreferencesContext, rng: Rng): TimePreferences {
  const { vocab, trace } = ctx;
  const time = vocab.preferences.time;
  if (!time?.dailyRhythmTags?.length) throw new Error('Agent vocab missing: preferences.time.dailyRhythmTags');
  if (!time?.planningStyleTags?.length) throw new Error('Agent vocab missing: preferences.time.planningStyleTags');

  const dailyRhythm = rng.pick(time.dailyRhythmTags);
  const planningStyle = rng.pick(time.planningStyleTags);

  traceSet(trace, 'preferences.time', { dailyRhythm, planningStyle }, {
    method: 'rng.pick',
    dependsOn: { facet: 'preferences', rhythmPoolSize: time.dailyRhythmTags.length, planningPoolSize: time.planningStyleTags.length },
  });

  return { dailyRhythm, planningStyle };
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Compute all preferences for an agent.
 *
 * Preferences are influenced by:
 * - Country priors (food/media environments)
 * - Culture profiles (macro and micro)
 * - Latent traits (publicness, opsec, aestheticExpressiveness, etc.)
 * - Health conditions and allergies
 * - Career and role
 */
export function computePreferences(ctx: PreferencesContext): PreferencesResult {
  traceFacet(ctx.trace, ctx.seed, 'preferences');
  const prefsRng = makeRng(facetSeed(ctx.seed, 'preferences'));

  const food = computeFoodPreferences(ctx, prefsRng);
  const media = computeMediaPreferences(ctx, prefsRng);
  const fashion = computeFashionPreferences(ctx, prefsRng);
  const hobbies = computeHobbies(ctx, prefsRng);
  const routines = computeRoutines(ctx, prefsRng, media.doomscrollingRisk);
  const environment = computeEnvironmentPreferences(ctx, prefsRng);
  const livingSpace = computeLivingSpacePreferences(ctx, prefsRng);
  const aesthetics = computeAestheticsPreferences(ctx, prefsRng);
  const artistic = computeArtisticPreferences(ctx, prefsRng);
  const social = computeSocialPreferences(ctx, prefsRng);
  const work = computeWorkPreferences(ctx, prefsRng);
  const equipment = computeEquipmentPreferences(ctx, prefsRng);
  const quirks = computeQuirksPreferences(ctx, prefsRng);
  const time = computeTimePreferences(ctx, prefsRng);

  return {
    food,
    media,
    fashion,
    hobbies,
    routines,
    environment,
    livingSpace,
    aesthetics,
    artistic,
    social,
    work,
    equipment,
    quirks,
    time,
  };
}
