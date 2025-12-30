/**
 * Agent module exports
 *
 * This module provides a clean public API for the agent generation system.
 * The canonical source of truth for types is types.ts.
 */

// All type definitions (canonical source)
export * from './types';

// Utility functions
export {
  // RNG
  type Rng,
  makeRng,
  facetSeed,
  normalizeSeed,
  randomSeedString,
  fnv1a32,
  mulberry32,
  // Clamping
  clampInt,
  clampFixed01k,
  clampSigned01k,
  clamp01,
  band5From01k,
  // Weighted selection
  weightedPick,
  weightedPickKUnique,
  topKByScore,
  uniqueStrings,
  pickKHybrid,
  // Environment mixing
  type FoodEnvAxis,
  type FoodEnv01k,
  FOOD_ENV_AXES,
  normalizeFoodEnv01k,
  mixFoodEnv01k,
  type SecurityEnvAxis,
  type SecurityEnv01k,
  SECURITY_ENV_AXES,
  normalizeSecurityEnv01k,
  mixSecurityEnv01k,
  type CultureEnvAxis,
  type CultureEnv01k,
  CULTURE_ENV_AXES,
  normalizeCultureEnv01k,
  mixCultureEnv01k,
  normalizeWeights01k,
  normalizeWeights01kExact,
  mixWeights01k,
  // Geography
  EAST_ASIA_ISO3,
  deriveCultureFromContinent,
  // Tracing
  traceSet,
  traceFacet,
  // Formatting
  formatFixed01k,
  formatBand5,
} from './utils';

// Latent trait computation
export { computeLatents, type LatentsResult } from './latents';

// Main generator function
export { generateAgent } from './generator';

// Generator utilities (geography stages, validation, helpers)
// Note: pickFromWeightedMicroProfiles, ValidCountry, ClimateIndicators,
// MicroProfileEntry, PrimaryWeights are exported from ./facets/geography
export {
  initializeTrace,
  validateVocab,
  validateCountries,
  computeGeographyStage1,
  computeGeographyStage2,
  computeRoleSeedTags,
} from './generator';

// ─────────────────────────────────────────────────────────────────────────────
// Facet modules
// ─────────────────────────────────────────────────────────────────────────────

// Geography facet (origin, citizenship, current, culture environment)
export {
  computeGeography,
  pickFromWeightedMicroProfiles,
  type ValidCountry,
  type GeographyContext,
  type GeographyResult,
  type ClimateIndicators,
  type MicroProfileEntry,
  type PrimaryWeights,
} from './facets/geography';

// Identity facet (roles, names, languages, gender, orientation)
export {
  computeIdentity,
  type IdentityContext,
  type IdentityResult,
} from './facets/identity';

// Appearance facet (height, build, hair, eyes, voice, marks)
export {
  computeAppearance,
  type AppearanceContext,
  type AppearanceResult,
  type AppearanceCountryPriors,
} from './facets/appearance';

// Capabilities facet (aptitudes, traits, and skills)
export {
  // Main orchestrator
  computeCapabilities,
  type CapabilitiesContext,
  type CapabilitiesResult,
  // Sub-modules (for granular control)
  computeAptitudes,
  type Aptitudes,
  type AptitudeBias,
  type AptitudesContext,
  type AptitudesResult,
  computeTraits,
  type PsychTraits,
  computeSkills,
  type SkillEntry,
  type SkillBias,
  type SkillsContext,
  type SkillsResult,
} from './facets/capabilities';

// Psychology facet (ethics, contradictions, red lines, visibility)
export {
  computePsychology,
  type PsychologyContext,
  type PsychologyResult,
  type LoyaltyScope,
  type Ethics,
  type Visibility,
} from './facets/psychology';

// Preferences facet (food, media, fashion, routines)
export {
  computePreferences,
  type PreferencesContext,
  type PreferencesResult,
  type FoodPreferences,
  type MediaPreferences,
  type FashionPreferences,
  type RoutinesResult,
} from './facets/preferences';

// Social facet (urbanicity, diaspora, family, relationships, network)
export {
  computeSocial,
  type LeverageType,
  type SocialContext,
  type RelationshipEntry,
  type SocialResult,
} from './facets/social';

// Lifestyle facet (health, vices, logistics, spirituality, background)
export {
  computeLifestyle,
  type LifestyleContext,
  type LifestyleResult,
} from './facets/lifestyle';

// Narrative facet (timeline, minority status)
export {
  computeNarrative,
  type NarrativeContext,
  type NarrativeResult,
  type TimelineEvent,
  type MinorityStatus,
} from './facets/narrative';

// Simulation facet (deep sim preview: needs, mood, stress, break risk)
export {
  computeSimulation,
  type SimulationContext,
  type SimulationResult,
} from './facets/simulation';
