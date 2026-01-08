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
  cuisineFavorites: string[];
  tastePreference: string;
  texturePreference: string;
  temperaturePreference: string;
  spiceTolerance: string;
  portionPreference: string;
  specificLoves: string[];
  absoluteHates: string[];
  conditionalPreferences: string[];
  dislikes: string[];
  restrictions: string[];
  ritualDrink: string;
  caffeineHabit: string;
  alcoholPreference: string;
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
  spaceType: string;
  decorStyle: string;
  organizationStyle: string;
  securityHabit: string;
  visitorPolicy: string;
  lightPreference: string;
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
    roleSeedTags, latents, traits, age,
  } = ctx;

  const { foodPrimaryWeight } = primaryWeights;

  // Validate required vocab
  if (!vocab.preferences.food.comfortFoods.length) throw new Error('Agent vocab missing: preferences.food.comfortFoods');
  if (!vocab.preferences.food.cuisineFavorites.length) throw new Error('Agent vocab missing: preferences.food.cuisineFavorites');
  if (!vocab.preferences.food.tastePreferences.length) throw new Error('Agent vocab missing: preferences.food.tastePreferences');
  if (!vocab.preferences.food.texturePreferences.length) throw new Error('Agent vocab missing: preferences.food.texturePreferences');
  if (!vocab.preferences.food.temperaturePreferences.length) throw new Error('Agent vocab missing: preferences.food.temperaturePreferences');
  if (!vocab.preferences.food.spiceTolerance.length) throw new Error('Agent vocab missing: preferences.food.spiceTolerance');
  if (!vocab.preferences.food.portionPreferences.length) throw new Error('Agent vocab missing: preferences.food.portionPreferences');
  if (!vocab.preferences.food.specificLoves.length) throw new Error('Agent vocab missing: preferences.food.specificLoves');
  if (!vocab.preferences.food.absoluteHates.length) throw new Error('Agent vocab missing: preferences.food.absoluteHates');
  if (!vocab.preferences.food.conditionalPreferences.length) throw new Error('Agent vocab missing: preferences.food.conditionalPreferences');
  if (!vocab.preferences.food.dislikes.length) throw new Error('Agent vocab missing: preferences.food.dislikes');
  if (!vocab.preferences.food.restrictions.length) throw new Error('Agent vocab missing: preferences.food.restrictions');
  if (!vocab.preferences.food.ritualDrinks.length) throw new Error('Agent vocab missing: preferences.food.ritualDrinks');
  if (!vocab.preferences.food.caffeineHabits.length) throw new Error('Agent vocab missing: preferences.food.caffeineHabits');
  if (!vocab.preferences.food.alcoholPreferences.length) throw new Error('Agent vocab missing: preferences.food.alcoholPreferences');

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

  // Correlate #HL4: Religiosity ↔ Dietary Restrictions (positive)
  // Religiosity is computed in spirituality (lifestyle facet) which runs AFTER preferences.
  // Use a better proxy that correlates with actual religiosity:
  // - Authoritarianism correlates with religious observance
  // - Age predicts religiosity (older = more religious)
  // - Institutional embeddedness correlates with traditional values
  // - Low risk appetite correlates with conservative religious observance
  const authoritarianism01 = ctx.traits.authoritarianism / 1000;
  const conscientiousness01 = ctx.traits.conscientiousness / 1000;
  const instEmbed01 = ctx.latents.institutionalEmbeddedness / 1000;
  const riskAverse01 = 1 - ctx.latents.riskAppetite / 1000;
  const ageNorm01 = Math.min(1, ctx.age / 80); // Normalize age 0-80
  // Improved proxy with stronger correlation to actual religiosity
  const religiosityProxy01 = Math.min(1, Math.max(0,
    0.30 * authoritarianism01 +
    0.20 * instEmbed01 +
    0.20 * riskAverse01 +
    0.15 * ageNorm01 +
    0.10 * conscientiousness01 +
    0.05 // base
  ));
  // Higher proxy = stronger observance of religious dietary rules
  // Scale from 0.2 (low proxy) to 3.0 (high proxy) - wider range for stronger effect
  const observanceMultiplier = 0.2 + 2.8 * religiosityProxy01;

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
    // Religious abstinence from alcohol (Islam, some Christian, Mormon, etc.)
    if (r === 'no alcohol') w += 0.7 + 0.6 * (1 - viceTendency) + 1.5 * religiosityProxy01;
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

  const frugal01 = latents.frugality / 1000;
  const stress01 = latents.stressReactivity / 1000;
  const public01 = latents.publicness / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const social01 = latents.socialBattery / 1000;
  const risk01 = latents.riskAppetite / 1000;
  const physical01 = latents.physicalConditioning / 1000;

  // Comfort foods selection
  // DC-NOVELTY-COMFORT: High noveltySeeking → adventurous comfort foods
  const novelty01 = traits.noveltySeeking / 1000;
  const comfortPool = uniqueStrings([...cultureComfort, ...vocab.preferences.food.comfortFoods]);
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
    // DC-NOVELTY-COMFORT: High noveltySeeking → adventurous/exotic comfort foods
    // Match vocabulary items: sushi, dumplings, pho, fermented, street food, spicy, ethnic cuisines
    const adventurousFoods = s.includes('sushi') || s.includes('dumpling') || s.includes('pho') ||
        s.includes('curry') || s.includes('thai') || s.includes('korean') || s.includes('vietnamese') ||
        s.includes('ethiopian') || s.includes('fermented') || s.includes('street food') ||
        s.includes('street noodle') || s.includes('spicy') || s.includes('fusion') ||
        s.includes('tapas') || s.includes('ceviche') || s.includes('dim sum') || s.includes('ramen') ||
        s.includes('exotic') || s.includes('unusual') || s.includes('adventur') ||
        s.includes('rare') || s.includes('unique') || s.includes('offal') ||
        s.includes('insect') || s.includes('strange') || s.includes('experimental');
    if (adventurousFoods) {
      w += 2.5 * novelty01; // High novelty seeking → adventurous foods (strengthened)
      if (traits.noveltySeeking > 700) w += 1.8; // Extra boost for very high novelty seeking
    }
    // Traditional/familiar comfort foods - preferred by low novelty seekers
    // Match vocabulary: home cooking, comfort noodles, hearty soups, baked breads, stews
    const traditionalFoods = s.includes('home') || s.includes('comfort') || s.includes('hearty') ||
        s.includes('baked') || s.includes('stew') || s.includes('soup') && !s.includes('pho') ||
        s.includes('casserole') || s.includes('roast') || s.includes('porridge') ||
        s.includes('classic') || s.includes('tradition') || s.includes('familiar') ||
        s.includes('childhood') || s.includes('grandma') || s.includes('mom') || s.includes('nostalgic');
    if (traditionalFoods) {
      w += 2.2 * (1 - novelty01); // Low novelty seeking → familiar foods (strengthened)
    }
    // DC-ELITE-DINING: Elite → Dining Preference
    // If tier == "elite", dining preference weighted toward fine dining/private chef
    // Rationale: Elite have refined tastes
    if (s.includes('fine') || s.includes('gourmet') || s.includes('luxury') || s.includes('premium') || s.includes('steak') || s.includes('restaurant') ||
        s.includes('chef') || s.includes('tasting') || s.includes('omakase') || s.includes('michelin') || s.includes('exclusive')) {
      w += 1.2 * (1 - frugal01) - 0.6 * frugal01;
      if (ctx.tierBand === 'elite') w += 2.0; // DC-ELITE-DINING: Elite prefer fine dining
    }
    if (s.includes('street') || s.includes('home') || s.includes('simple') || s.includes('leftover') || s.includes('staple') ||
        s.includes('budget') || s.includes('cheap') || s.includes('fast food')) {
      w += 0.8 * frugal01;
      if (ctx.tierBand === 'elite') w *= 0.4; // DC-ELITE-DINING: Elite avoid cheap food
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

  // Favorite cuisines selection
  const cuisinePool = uniqueStrings(vocab.preferences.food.cuisineFavorites);
  const cuisineWeight = (item: string): number => {
    const s = item.toLowerCase();
    let w = 1 + 0.2 * cosmo01;
    if (foodEnv01k) {
      if (s.includes('street') || s.includes('taco')) w += 1.4 * axis01('streetFood', 0.5);
      if (s.includes('fine') || s.includes('osteria')) w += 1.1 * axis01('fineDining', 0.5);
      if (s.includes('spicy') || s.includes('szechuan') || s.includes('thai') || s.includes('curry')) w += 1.4 * axis01('spice', 0.5);
      if (s.includes('japanese') || s.includes('sushi') || s.includes('pho')) w += 1.1 * axis01('seafood', 0.4);
      if (s.includes('mediterranean') || s.includes('levantine') || s.includes('ethiopian')) w += 0.9 * axis01('plantForward', 0.4);
      if (s.includes('korean') || s.includes('bbq') || s.includes('north-african')) w += 0.9 * axis01('meat', 0.4);
      if (s.includes('italian')) w += 0.6 * axis01('dairy', 0.4);
    }
    if (s.includes('street') || s.includes('taco')) w += 0.6 * frugal01;
    if (s.includes('fine') || s.includes('osteria')) w += 0.6 * (1 - frugal01);
    return Math.max(0.05, w);
  };
  // Correlate #NEW6: Cosmopolitanism ↔ Dietary Adventurousness (positive)
  // High cosmopolitanism → more diverse cuisine preferences (2-3 cuisines)
  // Low cosmopolitanism → limited cuisine exploration (0-1 cuisines)
  const cuisineCount = cuisinePool.length
    ? (cosmo01 > 0.65 ? (rng.next01() < 0.6 ? 3 : 2) : // High cosmo: 2-3 cuisines
       cosmo01 < 0.35 ? (rng.next01() < 0.4 ? 1 : 0) : // Low cosmo: 0-1 cuisines
       (rng.next01() < 0.35 + 0.35 * cosmo01 ? 2 : 1)) // Mid: original logic
    : 0;
  const cuisineFavorites = cuisineCount
    ? weightedPickKUnique(rng, cuisinePool.map(item => ({ item, weight: cuisineWeight(item) })), cuisineCount)
    : [];

  const tastePreference = weightedPick(rng, vocab.preferences.food.tastePreferences.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (foodEnv01k) {
      if (s.includes('sweet')) w += 1.2 * axis01('sweets', 0.5);
      if (s.includes('salty')) w += 0.8 * axis01('friedOily', 0.5);
      if (s.includes('sour')) w += 0.7 * (1 - axis01('sweets', 0.5));
      if (s.includes('bitter')) w += 0.6 * (1 - axis01('sweets', 0.5));
      if (s.includes('umami')) w += 1.1 * axis01('meat', 0.5) + 0.6 * axis01('seafood', 0.4);
    }
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  const texturePreference = weightedPick(rng, vocab.preferences.food.texturePreferences.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('crunch') || s.includes('crisp')) w += 0.4 * (1 - frugal01);
    if (s.includes('smooth') || s.includes('creamy')) w += 0.5 * (1 - stress01);
    if (s.includes('chewy')) w += 0.4 * stress01;
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  const temperaturePreference = weightedPick(rng, vocab.preferences.food.temperaturePreferences.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('hot')) w += 0.6 * ctx.climateIndicators.cold01 + 0.2 * (1 - ctx.climateIndicators.hot01);
    if (s.includes('cold')) w += 0.6 * ctx.climateIndicators.hot01;
    if (s.includes('contrast')) w += 0.3 * cosmo01 + 0.2 * public01;
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  // DC-STRESS-SPICE: Stress → Spice Tolerance
  // If stressReactivity > 750, reduce spice tolerance preference
  // Rationale: Stress reduces adventurous eating
  const highStress = latents.stressReactivity > 750;
  const spiceTolerance = weightedPick(rng, vocab.preferences.food.spiceTolerance.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (foodEnv01k) {
      if (s.includes('averse')) {
        w += 1.0 * (1 - axis01('spice', 0.5));
        if (highStress) w += 1.2; // DC-STRESS-SPICE: High stress → prefer spice-averse
      }
      if (s.includes('mild')) {
        w += 0.7 * (1 - axis01('spice', 0.5));
        if (highStress) w += 0.8; // DC-STRESS-SPICE: High stress → prefer mild
      }
      if (s.includes('medium')) w += 0.5;
      if (s.includes('hot')) {
        w += 1.0 * axis01('spice', 0.5);
        if (highStress) w *= 0.5; // DC-STRESS-SPICE: High stress → avoid hot
      }
      if (s.includes('fiend')) {
        w += 1.4 * axis01('spice', 0.5) + 0.4 * risk01;
        if (highStress) w *= 0.3; // DC-STRESS-SPICE: High stress → avoid spice fiend
      }
    }
    if (hasRestriction('spice-sensitive') && !s.includes('averse')) w *= 0.2;
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  // DC-AGE-PORTION: Age → Portion Size
  // If age > 65, reduce portion size preference toward moderate/small
  // Rationale: Elderly eat less
  const isElderly = age > 65;
  const portionPreference = weightedPick(rng, vocab.preferences.food.portionPreferences.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('small') || s.includes('grazing')) {
      w += 0.6 * (1 - frugal01) + 0.3 * (1 - physical01);
      if (isElderly) w += 1.5; // DC-AGE-PORTION: Elderly prefer smaller portions
    }
    if (s.includes('moderate') || s.includes('regular') || s.includes('standard')) {
      if (isElderly) w += 0.8; // DC-AGE-PORTION: Elderly accept moderate portions
    }
    if (s.includes('hearty') || s.includes('big') || s.includes('large')) {
      w += 0.7 * physical01 + 0.5 * frugal01;
      if (isElderly) w *= 0.3; // DC-AGE-PORTION: Elderly avoid large portions
    }
    if (s.includes('strict')) w += 0.5 * opsec01 + 0.3 * (1 - stress01);
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  const loveCount = rng.int(2, 4);
  const specificLoves = weightedPickKUnique(
    rng,
    vocab.preferences.food.specificLoves.map(item => ({ item, weight: 1 + 0.4 * stress01 })),
    Math.min(loveCount, vocab.preferences.food.specificLoves.length),
  );

  const absoluteHates = weightedPickKUnique(
    rng,
    vocab.preferences.food.absoluteHates.map(item => ({ item, weight: 1 + 0.3 * stress01 })),
    Math.min(2, vocab.preferences.food.absoluteHates.length),
  );

  const conditionalPreferences = weightedPickKUnique(
    rng,
    vocab.preferences.food.conditionalPreferences.map((item) => {
      const s = item.toLowerCase();
      let w = 1;
      if (s.includes('stress')) w += 0.7 * stress01;
      if (s.includes('mission')) w += roleSeedTags.includes('operative') ? 0.8 : 0.3;
      if (s.includes('public')) w += 0.5 * public01;
      if (s.includes('private')) w += 0.4 * opsec01;
      return { item, weight: Math.max(0.05, w) };
    }),
    Math.min(2, vocab.preferences.food.conditionalPreferences.length),
  );

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

  // Caffeine habit selection
  // DC-AGE-CAFFEINE: Age affects caffeine habits
  // When age > 50, weight 'moderate' or 'low' caffeine options
  const caffeine01 = axis01('caffeine', 0.5);
  const isOlder = age > 50;
  const caffeineHabit = weightedPick(rng, vocab.preferences.food.caffeineHabits.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    const caffeinated = s.includes('coffee') || s.includes('espresso') || s.includes('cold-brew') || s.includes('energy');
    const teaish = s.includes('tea');
    const highCaffeine = s.includes('heavy') || s.includes('addict') || s.includes('high') || s.includes('multiple') || s.includes('constant') || s.includes('energy');
    const lowModCaffeine = s.includes('moderate') || s.includes('light') || s.includes('occasional') || s.includes('single') || s.includes('one');
    // DC-AGE-CAFFEINE: Older agents prefer moderate/low caffeine
    if (isOlder) {
      if (highCaffeine) w *= 0.4; // Reduce heavy caffeine for older agents
      if (lowModCaffeine || teaish) w += 0.8; // Boost moderate/tea for older agents
      if (s.includes('no-caffeine') || s.includes('decaf')) w += 0.5; // More likely to go decaf
    }
    if (s.includes('no-caffeine') || s.includes('decaf')) w += 1.2 * (1 - caffeine01);
    if (caffeinated) w += 0.7 * caffeine01 + 0.4 * stress01;
    if (teaish) w += 0.5 * (1 - stress01) + 0.3 * caffeine01;
    if (s.includes('energy')) {
      w += 0.6 * stress01 + 0.5 * viceTendency;
      if (isOlder) w *= 0.3; // DC-AGE-CAFFEINE: Strongly reduce energy drinks for older agents
    }
    if (s.includes('brand')) w += 0.4 * public01 + 0.2 * opsec01;
    if (hasRestriction('no caffeine') && !(s.includes('no-caffeine') || s.includes('decaf'))) w *= 0.15;
    if (caffeinated && (chronicConditionTags.includes('insomnia') || chronicConditionTags.includes('migraine'))) w *= 0.35;
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  // Alcohol preference selection
  const alcoholPreference = weightedPick(rng, vocab.preferences.food.alcoholPreferences.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    const abstain = s.includes('no-alcohol') || s.includes('abstain');
    if (abstain) w += 1.3 * (1 - viceTendency) + (hasRestriction('no alcohol') ? 2.0 : 0);
    if (s.includes('social')) w += 0.6 * social01 + 0.4 * (1 - viceTendency);
    if (s.includes('scotch') || s.includes('wine')) w += 0.5 * (1 - frugal01) + 0.3 * public01;
    if (s.includes('beer')) w += 0.5 * frugal01;
    if (s.includes('vodka') || s.includes('whiskey')) w += 0.7 * viceTendency + 0.4 * stress01;
    if (hasRestriction('no alcohol') && !abstain) w *= 0.12;
    return { item, weight: Math.max(0.05, w) };
  })) as string;

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

  traceSet(trace, 'preferences.food', {
    comfortFoods,
    cuisineFavorites,
    tastePreference,
    texturePreference,
    temperaturePreference,
    spiceTolerance,
    portionPreference,
    specificLoves,
    absoluteHates,
    conditionalPreferences,
    caffeineHabit,
    alcoholPreference,
    dislikes,
    restrictions,
    ritualDrink,
  }, {
    method: 'env+consistency', dependsOn: { facet: 'preferences', foodPrimaryWeight, cultureComfortPoolSize: cultureComfort.length, cultureDrinksPoolSize: cultureDrinks.length, forcedRestrictions, forcedDislikes, fixups },
  });

  return {
    comfortFoods,
    cuisineFavorites,
    tastePreference,
    texturePreference,
    temperaturePreference,
    spiceTolerance,
    portionPreference,
    specificLoves,
    absoluteHates,
    conditionalPreferences,
    caffeineHabit,
    alcoholPreference,
    dislikes,
    restrictions,
    ritualDrink,
  };
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
  const social01 = latents.socialBattery / 1000;

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
    // Correlate #NEW8: Social Battery ↔ Media Platform Type (positive for social, negative for solitary)
    // High social battery → social media platforms; low social battery → print/closed (solitary)
    if (key === 'closed') bias += Math.round(70 * opsec01) + Math.round(70 * (1 - cultureMediaOpenness01)) + Math.round(40 * (1 - social01));
    if (key === 'social') bias += Math.round(65 * public01) - Math.round(40 * opsec01) + Math.round(25 * cultureMediaOpenness01) + Math.round(50 * social01);
    if (key === 'tv') bias += Math.round(30 * public01) + Math.round(15 * social01);
    if (key === 'print') bias += Math.round(45 * inst01) + Math.round(30 * (1 - social01));
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

  // DC-AGE-TECH: Age → Platform Preference
  // If age > 60, reduce TikTok/new platform weights; increase traditional media
  // Rationale: Older people prefer traditional media
  if (ctx.age > 60) {
    applyPlatformDietRepair('DC-AGE-TECH-elderlyPreferTraditional', (d) => {
      // Reduce social media for elderly (TikTok, Instagram, etc. are in 'social')
      const social = d.social ?? 0;
      if (social > 150) {
        const delta = Math.round((social - 150) * 0.6); // Reduce by 60% of excess
        d.social = clampFixed01k(social - delta);
        // Redistribute to traditional media: print > tv > radio
        d.print = clampFixed01k((d.print ?? 0) + Math.round(delta * 0.5));
        d.tv = clampFixed01k((d.tv ?? 0) + Math.round(delta * 0.35));
        d.radio = clampFixed01k((d.radio ?? 0) + Math.round(delta * 0.15));
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
  // DC-IMPULSE: Low impulseControl → high doomscrolling risk
  // When impulseControl < 350, increase risk score significantly
  const lowImpulseBonus = latents.impulseControl < 350 ? 150 : 0; // Extra risk if very low impulse control
  const doomscrollingRisk = clampFixed01k(
    0.28 * latents.publicness + 0.20 * (1000 - latents.opsecDiscipline) + 0.16 * (1000 - traits.conscientiousness) +
    0.10 * traits.noveltySeeking + 0.16 * (1000 - latents.impulseControl) + // DC-IMPULSE: Increased weight from 0.10 to 0.16
    0.06 * latents.stressReactivity + 0.04 * rng.int(0, 1000) + lowImpulseBonus,
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
  const { seed, vocab, trace, tierBand, latents, traits, primaryWeights, macroCulture, microProfiles, cultureTraditionalism01, careerTrackTag, roleSeedTags } = ctx;
  const { fashionPrimaryWeight } = primaryWeights;
  const public01 = latents.publicness / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const inst01 = latents.institutionalEmbeddedness / 1000;

  // PG-OPERATIVE-VIS: Check if career is intelligence/security related
  const isOperativeCareer = careerTrackTag === 'intelligence' || careerTrackTag === 'security' ||
    careerTrackTag === 'military' || careerTrackTag === 'espionage' ||
    roleSeedTags.includes('operative') || roleSeedTags.includes('intelligence') ||
    roleSeedTags.includes('security') || roleSeedTags.includes('spy');

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
  // PG-OPERATIVE-VIS: Operative careers → blending/understated aesthetics
  if (isOperativeCareer) { addForced('understated'); addForced('conventional'); addForced('neutral'); }
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

  // PG-OPERATIVE-VIS: Operative careers → blending aesthetics
  // Intelligence/security careers require understated/conventional styles to blend in
  if (isOperativeCareer) {
    const operativeForbidden = new Set(['maximalist', 'colorful', 'avant-garde', 'punk', 'goth', 'flashy', 'loud', 'statement', 'eccentric']);
    const operativeReplacements = ['understated', 'conventional', 'neutral', 'plain', 'classic', 'minimalist'];
    for (const bad of operativeForbidden) {
      if (!styleTags.includes(bad)) continue;
      const replacement = operativeReplacements.find(r => stylePool.includes(r) && !styleTags.includes(r));
      styleTags = uniqueStrings([...(replacement ? [replacement] : []), ...styleTags.filter(t => t !== bad)]).slice(0, 3);
    }
  }
  traceSet(trace, 'preferences.fashion.styleTags', styleTags, { method: 'pickK+forced+PG-OPERATIVE-VIS', dependsOn: { facet: 'fashion', fashionPrimaryWeight, cultureStylePoolSize: cultureStyle.length, forced: forced.slice(0, 2), isOperativeCareer } });

  // Fashion metrics
  // PG-FRUGAL-FASHION: Frugal elite still maintains formality
  // If frugality > 700 && tierBand === 'elite', ensure fashion formality >= 'business-casual' (min 500)
  const baseFormalityRaw = 0.36 * latents.publicness + 0.32 * latents.institutionalEmbeddedness + 0.18 * fashionRng.int(0, 1000) +
    (tierBand === 'elite' ? 90 : tierBand === 'mass' ? -40 : 0);
  // PG-FRUGAL-FASHION: Frugal elite must still dress formally (min 500 = business-casual)
  const formalityFloor = (tierBand === 'elite' && latents.frugality > 700) ? 500 : 0;
  const formality = clampFixed01k(Math.max(baseFormalityRaw, formalityFloor));
  // Correlate #NEW16: Agreeableness ↔ Aesthetic Conformity (positive)
  // Agreeable people dress conventionally to maintain social harmony; disagreeable prefer nonconformist aesthetics
  const conformity = clampFixed01k(
    0.32 * latents.institutionalEmbeddedness + 0.18 * traits.conscientiousness +
    0.14 * (1000 - traits.noveltySeeking) + 0.16 * traits.agreeableness +
    0.20 * fashionRng.int(0, 1000),
  );
  // Correlate #NEW7: Frugality ↔ Fashion StatusSignaling (negative)
  // Frugal people avoid status signaling through fashion; wasteful people dress for attention
  // Strengthened from -0.12 to -0.22 for stronger correlation
  const statusSignaling = clampFixed01k(
    0.34 * latents.publicness + 0.26 * (tierBand === 'elite' ? 920 : tierBand === 'middle' ? 600 : 420) +
    0.14 * (1000 - latents.opsecDiscipline) + 0.10 * latents.aestheticExpressiveness +
    0.24 * fashionRng.int(0, 1000) - 0.22 * latents.frugality,
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
  // DC-CHRONO: High conscientiousness → early chronotype
  // When conscientiousness > 700, weight 'early-bird' variants more heavily
  const stressReactivity01 = latents.stressReactivity / 1000;
  const adapt01 = latents.adaptability / 1000;
  const conscientious01 = traits.conscientiousness / 1000;
  const chronotypeWeights = vocab.routines.chronotypes.map((t) => {
    const key = t.toLowerCase();
    let w = 1;
    if (key === 'early' || key === 'ultra-early' || key.includes('early-bird') || key.includes('morning')) {
      w += 1.4 * conscientious01 + 0.6 * (age / 120);
      // DC-CHRONO: Extra boost for high conscientiousness (>700)
      if (traits.conscientiousness > 700) w += 1.2;
      if (key === 'ultra-early') w -= 0.5;
    }
    if (key === 'night' || key.includes('owl') || key.includes('late')) {
      w += 1.2 * (traits.noveltySeeking / 1000) + 0.7 * (latents.riskAppetite / 1000);
      // DC-CHRONO: Reduce night owl for high conscientiousness
      if (traits.conscientiousness > 700) w *= 0.4;
    }
    if (key === 'standard') w += 0.7;
    if (key === 'variable') { w += 1.0 * stressReactivity01 + 0.4 * (1 - conscientious01) + 0.8 * adapt01; }
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
  // Correlate #NEW14: Stress Reactivity ↔ Coping Ritual Count (positive)
  // High stress reactivity → more elaborate coping mechanisms (2-3 rituals)
  // Low stress reactivity → fewer rituals needed (1-2 rituals)
  const stressRitualCount = stressReactivity01 > 0.65 ? 3 : stressReactivity01 < 0.35 ? 1 : 2;
  const weightByRitual = new Map(ritualWeights.map(({ item, weight }) => [item, weight]));
  let recoveryRituals = weightedPickKUnique(routinesRng, ritualWeights, stressRitualCount);

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
  let totalHobbies = baseCount + socialBonus + (tierBand === 'elite' ? 1 : 0);

  // DC-FRUGAL-HOBBY: Frugality → Hobby Count
  // If frugality > 800, cap hobby count at 3
  // Rationale: Frugal people limit expensive hobbies
  if (latents.frugality > 800 && totalHobbies > 3) {
    totalHobbies = 3;
  }

  // Weight hobby categories based on personality
  const inst01 = latents.institutionalEmbeddedness / 1000;
  const categoryWeights = HOBBY_CATEGORIES.map(cat => {
    let w = 10;

    // Correlate #NEW23: Institutional Embeddedness ↔ Hobby Conformity (positive)
    // Embedded people prefer mainstream/socially acceptable hobbies; non-embedded prefer fringe
    // Mainstream: intellectual, social, culinary (conventional, socially acceptable)
    // Fringe: creative, technical (unconventional, niche interests)
    // Physical and outdoor are neutral
    const isMainstream = cat === 'intellectual' || cat === 'social' || cat === 'culinary';
    const isFringe = cat === 'creative' || cat === 'technical';
    // Stronger multiplicative factors for clear separation
    if (isMainstream) {
      w *= (0.6 + 2.4 * inst01); // Low embedded: 0.6x, High embedded: 3.0x
    }
    if (isFringe) {
      w *= (0.5 + 2.0 * (1 - inst01)); // High embedded: 0.5x, Low embedded: 2.5x
    }

    // Physical hobbies influenced by riskAppetite, conditioning, and age
    // Correlate #B3: Physical Conditioning ↔ Active Hobbies (positive) - STRENGTHENED
    if (cat === 'physical') {
      const conditioning01 = latents.physicalConditioning / 1000;
      w *= (0.4 + 1.6 * conditioning01); // Low conditioning = 0.4x, high = 2x
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
    // Outdoor hobbies influenced by risk appetite and conditioning
    // Correlate #B3: Physical Conditioning ↔ Active Hobbies (positive) - STRENGTHENED
    // DC-RURAL-HOBBY: Urbanicity → Hobby Type (approximated using climate indicators)
    // NOTE: urbanicity not in PreferencesContext - using coastal01 as proxy
    // (rural areas often non-coastal; low coastal01 suggests inland/rural environments)
    // If fully implemented with urbanicity == "rural", hobbies weighted toward outdoor/nature-based
    if (cat === 'outdoor') {
      const conditioning01 = latents.physicalConditioning / 1000;
      w *= (0.5 + 1.2 * conditioning01); // Low conditioning = 0.5x, high = 1.7x
      if (latents.riskAppetite > 500) w += 5;
      // DC-RURAL-HOBBY: Low coastal01 (inland areas) → more outdoor hobbies
      // Rationale: Rural people have outdoor hobbies
      const coastal01 = ctx.climateIndicators.coastal01;
      if (coastal01 < 0.3) w += 5; // Inland/rural areas → outdoor hobbies
    }
    // Culinary hobbies - universal appeal with slight creativity boost
    if (cat === 'culinary') {
      if (latents.aestheticExpressiveness > 500) w += 3;
    }
    // DC-RURAL-HOBBY: Additional weighting for physical hobbies in rural contexts
    if (cat === 'physical') {
      const coastal01 = ctx.climateIndicators.coastal01;
      if (coastal01 < 0.3) w += 3; // Inland/rural areas → physical outdoor activities
    }

    return { item: cat, weight: w };
  });

  // Pick 2-3 primary categories
  const numCategories = Math.min(3, Math.max(2, Math.floor(totalHobbies / 2)));
  let chosenCategories = weightedPickKUnique(rng, categoryWeights, numCategories);

  // ═══════════════════════════════════════════════════════════════════════════
  // DETERMINISTIC GUARANTEE for #B3: Physical Conditioning ↔ Active Hobbies
  // High conditioning agents MUST have at least one physical/outdoor hobby
  // Low conditioning agents should NOT have physical hobbies
  // ═══════════════════════════════════════════════════════════════════════════
  const conditioning01 = latents.physicalConditioning / 1000;
  const hasActiveCategory = chosenCategories.includes('physical') || chosenCategories.includes('outdoor');

  if (conditioning01 > 0.65 && !hasActiveCategory) {
    // High conditioning without active hobby: force add physical or outdoor
    const activeCategory = rng.next01() < 0.6 ? 'physical' : 'outdoor';
    chosenCategories = [activeCategory, ...chosenCategories.slice(0, numCategories - 1)];
  } else if (conditioning01 < 0.35 && hasActiveCategory) {
    // Low conditioning with active hobby: replace with sedentary category
    const sedentaryOptions = ['intellectual', 'creative', 'technical', 'culinary'];
    const replacement = rng.pick(sedentaryOptions);
    chosenCategories = chosenCategories.map(c =>
      (c === 'physical' || c === 'outdoor') ? replacement : c
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Plausibility Gate PG6: Operative Role → No Social Hobbies
  // Operatives avoid public-facing hobbies that could expose their identity.
  // Social hobbies (e.g., "social media influencing", "public speaking",
  // "community organizing") are replaced with private/technical/physical hobbies.
  // ═══════════════════════════════════════════════════════════════════════════
  const isOperative = ctx.roleSeedTags.includes('operative');
  if (isOperative && chosenCategories.includes('social')) {
    // Replace social category with safe alternatives for operative cover
    const operativeSafeCategories = ['technical', 'physical', 'intellectual', 'outdoor'];
    // Pick a replacement that isn't already chosen
    const available = operativeSafeCategories.filter(c => !chosenCategories.includes(c));
    const replacement = available.length > 0 ? rng.pick(available) : 'technical';
    chosenCategories = chosenCategories.map(c => c === 'social' ? replacement : c);
  }

  // DC-IMPULSE-GAMBLING: Low Impulse → Gambling Risk
  // If impulseControl < 300, increase gambling/betting hobby probability
  // Rationale: Low impulse control risks gambling
  const lowImpulseControl = latents.impulseControl < 300;

  // Pick hobbies from chosen categories
  const allHobbies: string[] = [];
  for (const cat of chosenCategories) {
    const catHobbies = hobbiesVocab[cat as keyof typeof hobbiesVocab] ?? [];
    if (catHobbies.length > 0) {
      const pickCount = Math.min(2, catHobbies.length);
      // DC-IMPULSE-GAMBLING: Weight gambling-adjacent hobbies for low impulse control
      const hobbyWeights = catHobbies.map((hobby) => {
        const h = hobby.toLowerCase();
        let w = 1;
        // Gambling-adjacent hobbies (card games, poker, betting sports, horse racing, etc.)
        const isGamblingAdjacent = h.includes('poker') || h.includes('card') || h.includes('casino') ||
          h.includes('betting') || h.includes('gambl') || h.includes('horse racing') ||
          h.includes('slots') || h.includes('dice') || h.includes('blackjack') ||
          h.includes('fantasy sports') || h.includes('sports betting') || h.includes('trading');
        if (isGamblingAdjacent && lowImpulseControl) {
          w += 3.0; // DC-IMPULSE-GAMBLING: Strong boost for low impulse control
        }
        return { item: hobby, weight: w };
      });
      const picked = weightedPickKUnique(rng, hobbyWeights, pickCount);
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
  const { vocab, trace, latents, traits, tierBand, roleSeedTags, age } = ctx;
  const living = vocab.preferences.livingSpace;
  if (!living?.roomPreferenceTags?.length) throw new Error('Agent vocab missing: preferences.livingSpace.roomPreferenceTags');
  if (!living?.comfortItemTags?.length) throw new Error('Agent vocab missing: preferences.livingSpace.comfortItemTags');
  if (!living?.spaceTypes?.length) throw new Error('Agent vocab missing: preferences.livingSpace.spaceTypes');
  if (!living?.decorStyles?.length) throw new Error('Agent vocab missing: preferences.livingSpace.decorStyles');
  if (!living?.organizationStyles?.length) throw new Error('Agent vocab missing: preferences.livingSpace.organizationStyles');
  if (!living?.securityHabits?.length) throw new Error('Agent vocab missing: preferences.livingSpace.securityHabits');
  if (!living?.visitorPolicies?.length) throw new Error('Agent vocab missing: preferences.livingSpace.visitorPolicies');
  if (!living?.lightPreferences?.length) throw new Error('Agent vocab missing: preferences.livingSpace.lightPreferences');

  const roomPreferences = pickKBounded(rng, living.roomPreferenceTags, 1, 2);

  // DC-OPSEC-COLLECTION: Opsec → Collection Type (via comfort items)
  // If opsecDiscipline > 750, collection types exclude identifying/trackable items
  // Rationale: Security-minded avoid traceable collections
  const highOpsec = latents.opsecDiscipline > 750;
  const comfortItemWeights = living.comfortItemTags.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    // Identifying/trackable items that leave paper trails or can be used to identify the owner
    const isTraceable = s.includes('photo') || s.includes('diploma') || s.includes('award') ||
      s.includes('trophy') || s.includes('certificate') || s.includes('memento') ||
      s.includes('souvenir') || s.includes('collectible') || s.includes('collection') ||
      s.includes('memorabilia') || s.includes('personal') || s.includes('family') ||
      s.includes('heirloom') || s.includes('antique') || s.includes('art piece') ||
      s.includes('signed') || s.includes('autograph') || s.includes('rare');
    // Generic/non-identifying items preferred by high opsec
    const isGeneric = s.includes('blanket') || s.includes('pillow') || s.includes('plant') ||
      s.includes('book') || s.includes('lamp') || s.includes('rug') || s.includes('candle') ||
      s.includes('cushion') || s.includes('generic') || s.includes('utilitarian');
    if (isTraceable && highOpsec) {
      w *= 0.15; // DC-OPSEC-COLLECTION: High opsec avoids traceable items
    }
    if (isGeneric && highOpsec) {
      w += 1.5; // DC-OPSEC-COLLECTION: High opsec prefers generic items
    }
    return { item, weight: Math.max(0.05, w) };
  });
  const comfortItems = weightedPickKUnique(rng, comfortItemWeights, Math.min(2, living.comfortItemTags.length));

  const opsec01 = latents.opsecDiscipline / 1000;
  const stress01 = latents.stressReactivity / 1000;
  const public01 = latents.publicness / 1000;
  const social01 = latents.socialBattery / 1000;
  const frugal01 = latents.frugality / 1000;
  const aesthetic01 = latents.aestheticExpressiveness / 1000;
  const conscientious01 = traits.conscientiousness / 1000;
  const isOperative = roleSeedTags.includes('operative') || roleSeedTags.includes('security');

  const pickWeighted = (pool: string[], weightFn: (item: string) => number): string => (
    weightedPick(rng, pool.map(item => ({ item, weight: weightFn(item) }))) as string
  );

  // DC-SPACE-TYPE: High opsecDiscipline → private space preference
  // When opsecDiscipline > 700, weight 'private' spaces more heavily
  const spaceType = pickWeighted(living.spaceTypes, (item) => {
    const s = item.toLowerCase();
    let w = 1;
    // Private/secure space options
    if (s.includes('private') || s.includes('secure') || s.includes('isolated') ||
        s.includes('solo') || s.includes('single') || s.includes('own')) {
      w += 1.5 * opsec01; // High opsec → private space
      if (latents.opsecDiscipline > 700) w += 1.2; // DC-SPACE-TYPE: Extra boost for high opsec
    }
    if (s.includes('operational') || s.includes('bolt')) w += 0.7 * opsec01 + (isOperative ? 0.6 : 0);
    if (s.includes('deep-cover')) w += 0.6 * public01 + 0.3 * (tierBand === 'elite' ? 1 : 0);
    if (s.includes('studio')) w += 0.5 * (age < 30 ? 1 : 0.3) + 0.3 * frugal01;
    // Shared/communal spaces - reduce for high opsec
    if (s.includes('shared') || s.includes('communal') || s.includes('roommate') ||
        s.includes('open') || s.includes('co-living')) {
      w += 0.6 * social01 + 0.4 * (tierBand === 'mass' ? 1 : 0.2);
      if (latents.opsecDiscipline > 700) w *= 0.3; // DC-SPACE-TYPE: Strongly reduce for high opsec
    }
    if (s.includes('family')) w += 0.5 * (age > 35 ? 1 : 0.2) + 0.3 * public01;
    if (s.includes('hotel')) w += 0.6 * (isOperative ? 1 : 0.2);
    if (s.includes('barracks') || s.includes('dorm')) {
      w += 0.5 * (tierBand === 'mass' ? 1 : 0.2);
      if (latents.opsecDiscipline > 700) w *= 0.4; // Reduce for high opsec
    }
    if (s.includes('mission')) w += 0.6 * (isOperative ? 1 : 0.1);
    return Math.max(0.05, w);
  });

  const decorStyle = pickWeighted(living.decorStyles, (item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('minimal') || s.includes('sterile') || s.includes('monochrome')) w += 0.7 * opsec01 + 0.5 * conscientious01;
    if (s.includes('cozy') || s.includes('keepsakes')) w += 0.6 * (1 - opsec01) + 0.4 * social01;
    if (s.includes('cultural')) w += 0.6 * aesthetic01;
    if (s.includes('chaotic')) w += 0.5 * stress01 + 0.3 * (1 - conscientious01);
    if (s.includes('mismatched')) w += 0.4 * frugal01;
    return Math.max(0.05, w);
  });

  const organizationStyle = pickWeighted(living.organizationStyles, (item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('obsessive')) w += 0.9 * conscientious01 + 0.4 * opsec01;
    if (s.includes('selective')) w += 0.6 * conscientious01;
    if (s.includes('mess')) w += 0.7 * (1 - conscientious01) + 0.4 * stress01;
    if (s.includes('cyclic')) w += 0.5 * stress01;
    if (s.includes('tool')) w += 0.4 * opsec01 + 0.3 * (isOperative ? 1 : 0);
    return Math.max(0.05, w);
  });

  const securityHabit = pickWeighted(living.securityHabits, (item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('hair') || s.includes('powder') || s.includes('item-placement')) w += 0.7 * opsec01;
    if (s.includes('motion') || s.includes('camera')) w += 0.6 * opsec01 + 0.3 * public01;
    if (s.includes('burn-bag') || s.includes('go-bag')) w += 0.6 * opsec01 + 0.4 * stress01;
    return Math.max(0.05, w);
  });

  const visitorPolicy = pickWeighted(living.visitorPolicies, (item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('no-visitors')) w += 0.8 * opsec01;
    if (s.includes('trusted')) w += 0.6 * social01;
    if (s.includes('cover')) w += 0.5 * public01 + 0.3 * opsec01;
    if (s.includes('open')) w += 0.6 * social01 + 0.4 * (1 - opsec01);
    if (s.includes('professional')) w += 0.4 * opsec01 + 0.2 * conscientious01;
    return Math.max(0.05, w);
  });

  // DC-STRESS-LIGHT: High stressReactivity → warm lighting preference
  // When stressReactivity > 700, weight 'warm'/'dim' lighting options
  const lightPreference = pickWeighted(living.lightPreferences, (item) => {
    const s = item.toLowerCase();
    let w = 1;
    // DC-STRESS-LIGHT: Warm/dim lighting preferred by high stress agents
    if (s.includes('warm') || s.includes('dim') || s.includes('soft') || s.includes('amber') ||
        s.includes('candl') || s.includes('cozy') || s.includes('gentle') || s.includes('low')) {
      w += 1.5 * stress01; // High stress → warm lighting
      if (latents.stressReactivity > 700) w += 1.2; // Extra boost for very high stress
    }
    // Harsh/bright lighting - less preferred by high stress agents
    if (s.includes('bright') || s.includes('natural')) {
      w += 0.6 * (1 - stress01) + 0.3 * social01;
      if (latents.stressReactivity > 700) w *= 0.5; // DC-STRESS-LIGHT: Reduce bright for high stress
    }
    if (s.includes('fluorescent') || s.includes('harsh') || s.includes('clinical')) {
      if (latents.stressReactivity > 700) w *= 0.3; // Strongly avoid harsh lighting
    }
    if (s.includes('dark') || s.includes('artificial')) w += 0.6 * stress01 + 0.5 * opsec01;
    if (s.includes('views')) w += 0.4 * public01 + 0.2 * (1 - opsec01);
    if (s.includes('avoided')) w += 0.5 * opsec01;
    return Math.max(0.05, w);
  });

  // Deterministic Cap DC5: Conscientiousness ↔ Living Space Organization
  // High conscientiousness (>0.75) cannot have "mess" or "cyclic" - must have "obsessive" or "selective"
  // Low conscientiousness (<0.30) cannot have "obsessive"
  let gatedOrganizationStyle = organizationStyle;
  const orgLower = organizationStyle.toLowerCase();
  if (conscientious01 > 0.75 && (orgLower.includes('mess') || orgLower.includes('cyclic'))) {
    // High conscientious agents cannot be messy - force to selective (less extreme than obsessive)
    gatedOrganizationStyle = living.organizationStyles.find(s => s.toLowerCase().includes('selective'))
      ?? living.organizationStyles.find(s => s.toLowerCase().includes('obsessive'))
      ?? organizationStyle;
    traceSet(trace, 'preferences.livingSpace.DC5', {
      original: organizationStyle,
      forced: gatedOrganizationStyle,
      reason: 'high conscientiousness (>0.75) incompatible with mess/cyclic organization',
    }, { method: 'gate' });
  } else if (conscientious01 < 0.30 && orgLower.includes('obsessive')) {
    // Low conscientious agents cannot be obsessively organized - force to selective or cyclic
    gatedOrganizationStyle = living.organizationStyles.find(s => s.toLowerCase().includes('selective'))
      ?? living.organizationStyles.find(s => s.toLowerCase().includes('cyclic'))
      ?? organizationStyle;
    traceSet(trace, 'preferences.livingSpace.DC5', {
      original: organizationStyle,
      forced: gatedOrganizationStyle,
      reason: 'low conscientiousness (<0.30) incompatible with obsessive organization',
    }, { method: 'gate' });
  }

  traceSet(trace, 'preferences.livingSpace', {
    roomPreferences,
    comfortItems,
    spaceType,
    decorStyle,
    organizationStyle: gatedOrganizationStyle,
    securityHabit,
    visitorPolicy,
    lightPreference,
  }, {
    method: 'weightedPick+pickK+DC5',
    dependsOn: { facet: 'preferences', roomPoolSize: living.roomPreferenceTags.length, comfortPoolSize: living.comfortItemTags.length },
  });

  return {
    roomPreferences,
    comfortItems,
    spaceType,
    decorStyle,
    organizationStyle: gatedOrganizationStyle,
    securityHabit,
    visitorPolicy,
    lightPreference,
  };
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

  // DC-SOCIAL-SHARING: Social Battery → Sharing Style
  // If socialBattery < 300, creative sharing weighted toward private/anonymous
  // Rationale: Introverts share privately
  const veryIntroverted = latents.socialBattery < 300;
  const sharingStyle = pickWeighted(artistic.sharingStyles, (item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('private') || lower.includes('never')) {
      w += 0.8 * opsec01;
      if (veryIntroverted) w += 2.0; // DC-SOCIAL-SHARING: Strong boost for introverts
    }
    if (lower.includes('trusted')) w += 0.5 * social01;
    if (lower.includes('public')) {
      w += 0.6 * public01;
      if (veryIntroverted) w *= 0.2; // DC-SOCIAL-SHARING: Strongly reduce public for introverts
    }
    if (lower.includes('anonymous')) {
      w += 0.4 * opsec01 + 0.3 * public01;
      if (veryIntroverted) w += 1.5; // DC-SOCIAL-SHARING: Introverts prefer anonymous
    }
    // PR5: Social battery correlates with sharing style - high battery favors public/collaborative,
    // low battery favors private/solitary artistic expression
    if (lower.includes('public') || lower.includes('collaborat') || lower.includes('communit') || lower.includes('gallery') || lower.includes('perform')) {
      w += 0.5 * social01;
      if (veryIntroverted) w *= 0.25; // DC-SOCIAL-SHARING: Reduce collaborative for introverts
    }
    if (lower.includes('private') || lower.includes('solo') || lower.includes('personal') || lower.includes('journal') || lower.includes('never'))
      w += 0.4 * (1 - social01);
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
  const { vocab, trace, latents, traits } = ctx;
  const social = vocab.preferences.social;
  if (!social?.groupStyleTags?.length) throw new Error('Agent vocab missing: preferences.social.groupStyleTags');
  if (!social?.communicationMethodTags?.length) throw new Error('Agent vocab missing: preferences.social.communicationMethodTags');
  if (!social?.boundaryTags?.length) throw new Error('Agent vocab missing: preferences.social.boundaryTags');
  if (!social?.emotionalSharingTags?.length) throw new Error('Agent vocab missing: preferences.social.emotionalSharingTags');

  const social01 = latents.socialBattery / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const agree01 = traits.agreeableness / 1000;

  // DC-SOCIAL-GROUP: socialBattery correlates with group style preference
  // Low battery → listener-observer, silent-when-needed
  // High battery → group-banter, storyteller
  const groupStyle = weightedPick(rng, social.groupStyleTags.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    // Low social battery styles
    if (s === 'listener-observer' || s === 'silent-when-needed') {
      w += 2.5 * (1 - social01); // Low social battery → prefer quiet/observer
    }
    // High social battery styles
    if (s === 'group-banter' || s === 'storyteller') {
      w += 2.5 * social01; // High social battery → prefer active participation
    }
    // Neutral middle option
    if (s === 'one-on-one') {
      w += 1.0; // Moderate preference regardless of battery
    }
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  // DC-SOCIAL-COMM: Low socialBattery → async communication preference
  // When socialBattery < 350, weight 'text'/'email' over 'call'/'video'
  const communicationMethod = weightedPick(rng, social.communicationMethodTags.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('text') || s.includes('email') || s.includes('message') || s.includes('async')) {
      w += 1.8 * (1 - social01); // Low social battery → async comms
      if (latents.socialBattery < 350) w += 1.2; // Extra boost for very low battery
    }
    if (s.includes('call') || s.includes('phone') || s.includes('video') || s.includes('face')) {
      w += 1.5 * social01; // High social battery → sync comms
      if (latents.socialBattery < 350) w *= 0.35; // Reduce if low battery
    }
    if (s.includes('in-person') || s.includes('meeting')) {
      w += 1.2 * social01;
    }
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  // DC-BOUNDARY: opsecDiscipline correlates with personal boundary strength
  // Low opsec → hugger, proximity-trust (open boundaries)
  // High opsec → touch-averse, strict-touch-norms (closed boundaries)
  const boundary = weightedPick(rng, social.boundaryTags.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    // Strong/closed boundaries (high opsec)
    if (s === 'touch-averse' || s === 'strict-touch-norms') {
      w += 2.5 * opsec01; // High opsec → closed boundaries
    }
    // Open boundaries (low opsec)
    if (s === 'hugger' || s === 'proximity-trust') {
      w += 2.5 * (1 - opsec01); // Low opsec → open boundaries
    }
    // Neutral middle option
    if (s === 'professional-distance') {
      w += 1.0; // Moderate preference
    }
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  // DC-EMOTIONAL: High agreeableness → open emotional sharing
  // Tags: emotions-classified (1), actions-not-words (2), opens-up-when-drunk (3), overshares-deflect (4), radical-honesty (5)
  const emotionalSharing = weightedPick(rng, social.emotionalSharingTags.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    // High openness tags - high agreeableness preference
    if (s === 'radical-honesty' || s === 'overshares-deflect') {
      w += 2.5 * agree01; // High agreeableness → open sharing
      if (traits.agreeableness > 700) w += 2.0; // Extra boost for high agreeableness
    }
    // Low openness tags - low agreeableness preference
    if (s === 'emotions-classified' || s === 'actions-not-words') {
      w += 2.0 * (1 - agree01); // Low agreeableness → guarded
      w += 1.0 * opsec01; // High opsec also → guarded
      if (traits.agreeableness > 700) w *= 0.2; // Strongly reduce if high agreeableness
    }
    // Moderate option - slight preference from everyone
    if (s === 'opens-up-when-drunk') {
      w += 0.8; // Neutral/moderate option
    }
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  traceSet(trace, 'preferences.social', { groupStyle, communicationMethod, boundary, emotionalSharing }, {
    method: 'weightedPick+DC-SOCIAL-GROUP+DC-SOCIAL-COMM+DC-BOUNDARY+DC-EMOTIONAL',
    dependsOn: {
      facet: 'preferences',
      groupPoolSize: social.groupStyleTags.length,
      commsPoolSize: social.communicationMethodTags.length,
      boundaryPoolSize: social.boundaryTags.length,
      sharingPoolSize: social.emotionalSharingTags.length,
      socialBattery: latents.socialBattery,
      opsecDiscipline: latents.opsecDiscipline,
      agreeableness: traits.agreeableness,
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
  const { vocab, trace, latents } = ctx;
  const equipment = vocab.preferences.equipment;
  if (!equipment?.weaponPreferenceTags?.length) throw new Error('Agent vocab missing: preferences.equipment.weaponPreferenceTags');
  if (!equipment?.gearPreferenceTags?.length) throw new Error('Agent vocab missing: preferences.equipment.gearPreferenceTags');

  const risk01 = latents.riskAppetite / 1000;

  // DC-RISK-EQUIP: High riskAppetite → assertive weapon preference
  // Actual vocab tags: glock-19, knives, distance-weapons, improvised, non-lethal
  const weaponPreference = weightedPick(rng, equipment.weaponPreferenceTags.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    // Most assertive options - high risk appetite
    if (s === 'glock-19' || s === 'knives') {
      w += 2.5 * risk01; // High risk appetite → assertive weapons
      if (latents.riskAppetite > 700) w += 2.0;
    }
    // Least assertive - low risk appetite
    if (s === 'non-lethal' || s === 'improvised') {
      w += 2.0 * (1 - risk01); // Low risk appetite → non-lethal/improvised
      if (latents.riskAppetite > 700) w *= 0.3;
    }
    // Middle ground
    if (s === 'distance-weapons') {
      w += 0.8; // Neutral option
    }
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  const gearPreferences = pickKBounded(rng, equipment.gearPreferenceTags, 1, 2);

  traceSet(trace, 'preferences.equipment', { weaponPreference, gearPreferences }, {
    method: 'weightedPick+pickK+DC-RISK-EQUIP',
    dependsOn: {
      facet: 'preferences',
      weaponPoolSize: equipment.weaponPreferenceTags.length,
      gearPoolSize: equipment.gearPreferenceTags.length,
      riskAppetite: latents.riskAppetite,
    },
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
  const { vocab, trace, traits } = ctx;
  const time = vocab.preferences.time;
  if (!time?.dailyRhythmTags?.length) throw new Error('Agent vocab missing: preferences.time.dailyRhythmTags');
  if (!time?.planningStyleTags?.length) throw new Error('Agent vocab missing: preferences.time.planningStyleTags');

  const conscientious01 = traits.conscientiousness / 1000;

  // DC-CONSC-ROUTINE: Conscientiousness → Routine Rigidity
  // If conscientiousness > 800, daily routine weighted toward rigid/structured
  // Rationale: Conscientious people have strict routines
  const veryConscientious = traits.conscientiousness > 800;
  const dailyRhythm = weightedPick(rng, time.dailyRhythmTags.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('rigid') || s.includes('strict') || s.includes('fixed') || s.includes('consistent') ||
        s.includes('structured') || s.includes('regular') || s.includes('routine') || s.includes('clockwork')) {
      w += 1.8 * conscientious01; // High conscientiousness → rigid routine
      if (veryConscientious) w += 2.0; // DC-CONSC-ROUTINE: Extra boost for very high conscientiousness
    }
    if (s.includes('flexible') || s.includes('variable') || s.includes('spontaneous') || s.includes('casual') ||
        s.includes('loose') || s.includes('relaxed') || s.includes('fluid') || s.includes('adaptive')) {
      w += 1.5 * (1 - conscientious01); // Low conscientiousness → flexible routine
      if (veryConscientious) w *= 0.2; // DC-CONSC-ROUTINE: Strongly reduce if very conscientious
    }
    if (s.includes('chaotic') || s.includes('random') || s.includes('unpredictable')) {
      w += 1.2 * (1 - conscientious01);
      if (veryConscientious) w *= 0.1; // DC-CONSC-ROUTINE: Nearly impossible if very conscientious
    }
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  // DC-PLANNING: conscientiousness correlates with planning style (target r ~ +0.25)
  // Low conscientiousness → improvise, last-minute
  // High conscientiousness → minute-planned, contingency-heavy
  const planningStyle = weightedPick(rng, time.planningStyleTags.map((item) => {
    const s = item.toLowerCase();
    let w = 0.5; // Lower base weight to strengthen correlation effect
    // Structured planning (high conscientiousness)
    if (s === 'minute-planned' || s === 'contingency-heavy' || s.includes('plan') || s.includes('schedul')) {
      w = 0.3 + 4.0 * conscientious01; // Strongly favor with high conscientiousness
    }
    // Unstructured planning (low conscientiousness)
    if (s === 'improvise' || s === 'last-minute' || s === 'spontaneous' || s.includes('wing')) {
      w = 0.3 + 4.0 * (1 - conscientious01); // Strongly favor with low conscientiousness
    }
    // Neutral middle option
    if (s === 'flexible-structure' || s === 'adaptive' || s === 'balanced') {
      w = 1.5; // Slight preference as fallback
    }
    return { item, weight: Math.max(0.05, w) };
  })) as string;

  traceSet(trace, 'preferences.time', { dailyRhythm, planningStyle }, {
    method: 'rng.pick+weightedPick+DC-PLANNING',
    dependsOn: {
      facet: 'preferences',
      rhythmPoolSize: time.dailyRhythmTags.length,
      planningPoolSize: time.planningStyleTags.length,
      conscientiousness: traits.conscientiousness,
    },
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
