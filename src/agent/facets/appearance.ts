/**
 * Appearance Facet
 *
 * Computes physical appearance attributes for agents including:
 * - Height band (with country-specific priors)
 * - Build tag
 * - Hair (color and texture)
 * - Eye color
 * - Voice tag (with career correlations)
 * - Distinguishing marks
 */

import type { Fixed, HeightBand, Latents, AgentVocabV1, AgentGenerationTraceV1 } from '../types';
import {
  type Rng,
  makeRng,
  facetSeed,
  clampInt,
  weightedPick,
  uniqueStrings,
  traceSet,
  traceFacet,
} from '../utils';

// ============================================================================
// Types
// ============================================================================

/** Country priors bucket for appearance (subset of full country priors) */
export type AppearanceCountryPriors = {
  appearance?: {
    heightBandWeights01k?: Partial<Record<HeightBand, Fixed>>;
  };
};

/** Input context for appearance computation */
export type AppearanceContext = {
  seed: string;
  vocab: AgentVocabV1;
  latents: Latents;
  countryPriors: AppearanceCountryPriors | null;
  trace?: AgentGenerationTraceV1;
  // Derived values from identity facet
  age: number;
  careerTrackTag: string;
  roleSeedTags: readonly string[];
  // Derived values from latents (normalized 0-1)
  public01: number;
  opsec01: number;
  // Culture for appearance correlations
  homeCulture: string;
};

/** Output result from appearance computation */
export type AppearanceResult = {
  heightBand: HeightBand;
  heightCm: number;
  heightIn: number;
  buildTag: string;
  weightKg: number;
  weightLb: number;
  hair: { color: string; texture: string };
  eyes: { color: string };
  voiceTag: string;
  distinguishingMarks: string[];
};

// ============================================================================
// Voice Tag Configuration
// ============================================================================

const VOICE_BIASES = {
  military: ['commanding', 'clipped', 'precise', 'booming', 'authoritative', 'crisp'],
  journalism: ['warm', 'storyteller', 'bright', 'animated', 'engaging', 'articulate'],
  academia: ['teacherly', 'measured', 'dry-humored', 'thoughtful', 'deliberate', 'scholarly'],
  intelligence: ['soft-spoken', 'measured', 'deadpan', 'neutral', 'calm', 'unremarkable'],
  operative: ['calm', 'measured', 'murmured', 'low', 'controlled', 'quiet'],
  'foreign-service': ['smooth', 'diplomatic', 'polished', 'refined', 'measured', 'reassuring'],
} as const;

const PUBLIC_VOICES = ['warm', 'engaging', 'animated', 'bright', 'charismatic'];
const OPSEC_VOICES = ['soft-spoken', 'quiet', 'murmured', 'unremarkable', 'neutral'];

// ============================================================================
// Height/Weight Ranges
// ============================================================================

const HEIGHT_BAND_CM: Record<HeightBand, { min: number; max: number }> = {
  very_short: { min: 145, max: 159 },
  short: { min: 160, max: 169 },
  average: { min: 170, max: 179 },
  tall: { min: 180, max: 189 },
  very_tall: { min: 190, max: 205 },
};

const BUILD_BMI_RANGES: Record<string, { min: number; max: number }> = {
  lean: { min: 19, max: 22 },
  slim: { min: 18, max: 21 },
  wiry: { min: 18, max: 21 },
  lanky: { min: 17.5, max: 20.5 },
  'long-limbed': { min: 19, max: 22 },
  "runner's build": { min: 18.5, max: 21.5 },
  athletic: { min: 21, max: 24.5 },
  muscular: { min: 23, max: 27 },
  brawny: { min: 25, max: 30 },
  'broad-shouldered': { min: 23, max: 27 },
  'barrel-chested': { min: 24, max: 30 },
  sturdy: { min: 23, max: 27 },
  solid: { min: 24, max: 28 },
  stocky: { min: 24.5, max: 30 },
  compact: { min: 23, max: 28 },
  curvy: { min: 23, max: 29 },
  heavyset: { min: 27, max: 33 },
  'soft-built': { min: 24, max: 30 },
  sinewy: { min: 21, max: 25 },
  graceful: { min: 19.5, max: 23 },
};

function pickHeightCm(rng: Rng, band: HeightBand): number {
  const range = HEIGHT_BAND_CM[band] ?? HEIGHT_BAND_CM.average;
  return rng.int(range.min, range.max);
}

function pickWeightKg(rng: Rng, buildTag: string, heightCm: number): number {
  const range = BUILD_BMI_RANGES[buildTag] ?? { min: 21, max: 26 };
  const bmi = range.min + rng.next01() * (range.max - range.min);
  const heightM = heightCm / 100;
  let weightKg = Math.round(bmi * heightM * heightM);
  const minKg = Math.ceil(range.min * heightM * heightM);
  const maxKg = Math.floor(range.max * heightM * heightM);
  if (weightKg < minKg) weightKg = minKg;
  if (weightKg > maxKg) weightKg = maxKg;
  return weightKg;
}

// ============================================================================
// Culture-Appearance Distributions
// ============================================================================

/**
 * Culture-based appearance weight modifiers for hair/eye color.
 * Keys match Shadow Work micro-culture profile IDs (without "profile:" prefix).
 * Values are additive weights (not probabilities).
 * Cultures not listed use uniform distribution.
 *
 * Format: { hairColors: { color: weight }, eyeColors: { color: weight }, hairTextures: { texture: weight } }
 */
const CULTURE_APPEARANCE_WEIGHTS: Record<string, {
  hairColors?: Record<string, number>;
  eyeColors?: Record<string, number>;
  hairTextures?: Record<string, number>;
}> = {
  // Nordic (Scandinavian) - norrenic
  norrenic: {
    hairColors: { blonde: 4, 'light-brown': 2, 'dark-brown': 1, red: 1.5, 'strawberry-blonde': 2 },
    eyeColors: { blue: 4, green: 2, 'blue-green': 2, gray: 2, hazel: 1, brown: 0.5 },
    hairTextures: { straight: 3, wavy: 2, curly: 0.5 },
  },

  // Germanic (German/Austrian/Swiss German) - teutonic
  teutonic: {
    hairColors: { blonde: 2, 'light-brown': 2, 'dark-brown': 2, red: 1, 'strawberry-blonde': 1 },
    eyeColors: { blue: 3, green: 2, 'blue-green': 2, gray: 1.5, hazel: 1, brown: 1 },
    hairTextures: { straight: 2.5, wavy: 2, curly: 0.5 },
  },

  // Anglo (British/American/Australian English-speaking) - alvionic
  alvionic: {
    hairColors: { blonde: 1.5, 'light-brown': 2, 'dark-brown': 2, red: 1.5, auburn: 1.5, 'strawberry-blonde': 1 },
    eyeColors: { blue: 2.5, green: 2, 'blue-green': 1.5, gray: 1, hazel: 1.5, brown: 1.5 },
    hairTextures: { straight: 2, wavy: 2, curly: 1 },
  },

  // French - gallicene
  gallicene: {
    hairColors: { 'dark-brown': 3, 'light-brown': 2, black: 1.5, auburn: 1 },
    eyeColors: { brown: 2.5, hazel: 2.5, blue: 2, green: 2 },
    hairTextures: { wavy: 2.5, straight: 2, curly: 1.5 },
  },

  // Spanish/Latin European - castillaran
  castillaran: {
    hairColors: { 'dark-brown': 3, black: 2, 'light-brown': 1.5, auburn: 1 },
    eyeColors: { brown: 3, hazel: 2, green: 1.5, 'dark-brown': 2 },
    hairTextures: { wavy: 2.5, straight: 2, curly: 1.5 },
  },

  // Portuguese/Brazilian - lusitanic
  lusitanic: {
    hairColors: { 'dark-brown': 3, black: 2, 'light-brown': 1.5 },
    eyeColors: { brown: 3, hazel: 2, green: 1.5, 'dark-brown': 2 },
    hairTextures: { wavy: 2.5, curly: 2, straight: 2 },
  },

  // Slavic (Russian/Ukrainian/Polish) - slavonic
  slavonic: {
    hairColors: { 'dark-brown': 2, 'light-brown': 2, blonde: 1.5, black: 1, auburn: 1 },
    eyeColors: { blue: 2, gray: 2, green: 1.5, hazel: 1.5, brown: 2 },
    hairTextures: { straight: 2.5, wavy: 2, curly: 0.5 },
  },

  // Greek/Mediterranean - helladic
  helladic: {
    hairColors: { black: 3, 'dark-brown': 3, 'light-brown': 1 },
    eyeColors: { brown: 3.5, 'dark-brown': 2.5, hazel: 2, green: 0.5 },
    hairTextures: { wavy: 2.5, curly: 2, straight: 1.5 },
  },

  // Illyric (Balkan) - illyric
  illyric: {
    hairColors: { 'dark-brown': 2.5, black: 2, 'light-brown': 1.5, auburn: 0.5 },
    eyeColors: { brown: 2.5, hazel: 2, green: 1.5, blue: 1, gray: 1 },
    hairTextures: { wavy: 2, straight: 2, curly: 1.5 },
  },

  // Chinese - tianlongic
  tianlongic: {
    hairColors: { black: 5, 'dark-brown': 1 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2 },
    hairTextures: { straight: 4, wavy: 0.5 },
  },

  // Japanese - kamikuran
  kamikuran: {
    hairColors: { black: 5, 'dark-brown': 1 },
    eyeColors: { brown: 4, 'dark-brown': 3 },
    hairTextures: { straight: 4, wavy: 0.5 },
  },

  // Korean - haedongic
  haedongic: {
    hairColors: { black: 5, 'dark-brown': 0.5 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 1 },
    hairTextures: { straight: 4.5, wavy: 0.3 },
  },

  // South Asian (Indian subcontinent) - bharatic
  bharatic: {
    hairColors: { black: 4, 'dark-brown': 2 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2, hazel: 0.5 },
    hairTextures: { straight: 2, wavy: 2.5, curly: 1.5 },
  },

  // Dravidian South Asian - sindhukan
  sindhukan: {
    hairColors: { black: 5, 'dark-brown': 1 },
    eyeColors: { 'dark-brown': 4, black: 3, brown: 2 },
    hairTextures: { wavy: 2.5, curly: 2, straight: 1.5 },
  },

  // Southeast Asian (Indonesian/Malaysian) - nusantaran
  nusantaran: {
    hairColors: { black: 4.5, 'dark-brown': 1.5 },
    eyeColors: { brown: 3.5, 'dark-brown': 3, black: 2 },
    hairTextures: { straight: 3.5, wavy: 1.5 },
  },

  // Arabic - aramaic
  aramaic: {
    hairColors: { black: 4, 'dark-brown': 2 },
    eyeColors: { brown: 3.5, 'dark-brown': 2.5, hazel: 1.5, green: 0.5 },
    hairTextures: { wavy: 2.5, curly: 2, straight: 1.5 },
  },

  // Persian - parsic
  parsic: {
    hairColors: { black: 3.5, 'dark-brown': 2.5, 'light-brown': 1 },
    eyeColors: { brown: 3, 'dark-brown': 2, hazel: 2, green: 1, blue: 0.5 },
    hairTextures: { wavy: 2.5, curly: 2, straight: 2 },
  },

  // Turkish - anatolian
  anatolian: {
    hairColors: { black: 3, 'dark-brown': 3, 'light-brown': 1.5 },
    eyeColors: { brown: 3, hazel: 2, 'dark-brown': 2, green: 1, blue: 0.5 },
    hairTextures: { straight: 2.5, wavy: 2, curly: 1 },
  },

  // Levantine (Lebanese/Syrian) - levantic
  levantic: {
    hairColors: { black: 3.5, 'dark-brown': 3 },
    eyeColors: { brown: 3, hazel: 2.5, green: 1.5, 'dark-brown': 2 },
    hairTextures: { wavy: 2.5, straight: 2, curly: 1.5 },
  },

  // Gulf Arab - khalijic
  khalijic: {
    hairColors: { black: 4.5, 'dark-brown': 1.5 },
    eyeColors: { 'dark-brown': 3.5, brown: 3, black: 2 },
    hairTextures: { wavy: 2.5, curly: 2, straight: 2 },
  },

  // Egyptian - deshretine
  deshretine: {
    hairColors: { black: 4, 'dark-brown': 2 },
    eyeColors: { brown: 3.5, 'dark-brown': 2.5, hazel: 1.5 },
    hairTextures: { wavy: 2.5, curly: 2, straight: 1.5 },
  },

  // East African - sawahili
  sawahili: {
    hairColors: { black: 5, 'dark-brown': 0.5 },
    eyeColors: { 'dark-brown': 4, black: 3, brown: 2 },
    hairTextures: { curly: 3, coily: 2.5, 'kinky-coily': 2, wavy: 1 },
  },

  // West African - oduwan
  oduwan: {
    hairColors: { black: 5 },
    eyeColors: { 'dark-brown': 4, black: 3, brown: 2 },
    hairTextures: { 'kinky-coily': 4, coily: 3, curly: 1 },
  },

  // Sahel - sahelian
  sahelian: {
    hairColors: { black: 5 },
    eyeColors: { 'dark-brown': 4, black: 3, brown: 2 },
    hairTextures: { 'kinky-coily': 3.5, coily: 3, curly: 1.5 },
  },

  // Southern African - khoiveldic
  khoiveldic: {
    hairColors: { black: 5 },
    eyeColors: { 'dark-brown': 4, black: 3, brown: 2 },
    hairTextures: { 'kinky-coily': 4, coily: 3, curly: 1 },
  },

  // North African Berber - tamazight
  tamazight: {
    hairColors: { black: 3.5, 'dark-brown': 2.5 },
    eyeColors: { brown: 3, 'dark-brown': 2.5, hazel: 2, green: 1 },
    hairTextures: { wavy: 2.5, curly: 2, straight: 1.5 },
  },

  // Puntic (Horn of Africa) - puntic
  puntic: {
    hairColors: { black: 5, 'dark-brown': 0.5 },
    eyeColors: { 'dark-brown': 4, brown: 3, black: 2 },
    hairTextures: { curly: 3.5, coily: 2.5, wavy: 1.5 },
  },

  // Latin American (Western Hemisphere Spanish) - vesperic
  vesperic: {
    hairColors: { black: 3, 'dark-brown': 3, 'light-brown': 1.5 },
    eyeColors: { brown: 3.5, 'dark-brown': 2, hazel: 1.5, green: 0.5 },
    hairTextures: { straight: 2, wavy: 2.5, curly: 1.5 },
  },

  // Sarmatian (Central Asian steppes) - sarmatian
  sarmatian: {
    hairColors: { black: 3, 'dark-brown': 3, 'light-brown': 1.5 },
    eyeColors: { brown: 3, hazel: 2, 'dark-brown': 2, blue: 0.5 },
    hairTextures: { straight: 3, wavy: 2 },
  },

  // Indigenous North American - turtleic
  turtleic: {
    hairColors: { black: 4.5, 'dark-brown': 1.5 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2 },
    hairTextures: { straight: 4, wavy: 1 },
  },

  // Mexican-American - chicanic
  chicanic: {
    hairColors: { black: 3.5, 'dark-brown': 3, 'light-brown': 1 },
    eyeColors: { brown: 3.5, 'dark-brown': 2.5, hazel: 1.5, green: 0.5 },
    hairTextures: { straight: 2.5, wavy: 2.5, curly: 1 },
  },

  // African American - afro-alvionic
  'afro-alvionic': {
    hairColors: { black: 4, 'dark-brown': 2 },
    eyeColors: { 'dark-brown': 3.5, brown: 3, black: 2, hazel: 0.5 },
    hairTextures: { 'kinky-coily': 3, coily: 2.5, curly: 2, wavy: 1 },
  },

  // Afro-Brazilian - afro-lusitanic
  'afro-lusitanic': {
    hairColors: { black: 3.5, 'dark-brown': 2.5 },
    eyeColors: { brown: 3, 'dark-brown': 3, hazel: 1.5, green: 0.5 },
    hairTextures: { curly: 3, coily: 2.5, wavy: 1.5, 'kinky-coily': 1.5 },
  },

  // Québécois - laurentian
  laurentian: {
    hairColors: { 'dark-brown': 2.5, 'light-brown': 2, blonde: 1.5, auburn: 1 },
    eyeColors: { blue: 2.5, hazel: 2, brown: 2, green: 1.5 },
    hairTextures: { wavy: 2, straight: 2.5, curly: 1 },
  },

  // Cosmopolitan (global/mixed) - cosmopolitan
  cosmopolitan: {
    // Uniform distribution - no modifications
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Additional cultures (added for comprehensive coverage)
  // ─────────────────────────────────────────────────────────────────────────

  // Aestic (Baltic: Lithuanian, Latvian, Estonian)
  aestic: {
    hairColors: { blonde: 2, 'light-brown': 2.5, 'dark-brown': 2, auburn: 1 },
    eyeColors: { blue: 3, gray: 2, green: 2, hazel: 1.5, brown: 1 },
    hairTextures: { straight: 3, wavy: 2 },
  },

  // Antillean (Caribbean: Jamaican, Haitian, Cuban)
  antillean: {
    hairColors: { black: 4, 'dark-brown': 2 },
    eyeColors: { 'dark-brown': 3.5, brown: 3, black: 2 },
    hairTextures: { 'kinky-coily': 3, coily: 2.5, curly: 2 },
  },

  // Antillean-Gallicene (French Caribbean)
  'antillean-gallicene': {
    hairColors: { black: 4, 'dark-brown': 2 },
    eyeColors: { brown: 3, 'dark-brown': 3, hazel: 1.5 },
    hairTextures: { 'kinky-coily': 2.5, coily: 2.5, curly: 2 },
  },

  // Ashantic (Akan/Ghanaian West African)
  ashantic: {
    hairColors: { black: 5 },
    eyeColors: { 'dark-brown': 4, black: 3, brown: 2 },
    hairTextures: { 'kinky-coily': 4, coily: 3 },
  },

  // Boeric (Afrikaner/Dutch South African)
  boeric: {
    hairColors: { blonde: 2, 'light-brown': 2, 'dark-brown': 2.5, auburn: 1 },
    eyeColors: { blue: 2.5, green: 2, hazel: 2, brown: 1.5 },
    hairTextures: { straight: 2.5, wavy: 2 },
  },

  // Bohemic (Czech/Slovak Central European)
  bohemic: {
    hairColors: { 'dark-brown': 2.5, 'light-brown': 2, blonde: 1.5, auburn: 1 },
    eyeColors: { blue: 2, gray: 2, hazel: 2, brown: 2, green: 1.5 },
    hairTextures: { straight: 2.5, wavy: 2 },
  },

  // Cushitic (Ethiopian/Somali/Eritrean)
  cushitic: {
    hairColors: { black: 5, 'dark-brown': 0.5 },
    eyeColors: { 'dark-brown': 4, brown: 3, black: 2 },
    hairTextures: { curly: 3.5, coily: 2.5, wavy: 1.5 },
  },

  // Dacian (Romanian/Moldovan)
  dacian: {
    hairColors: { 'dark-brown': 3, black: 2, 'light-brown': 1.5 },
    eyeColors: { brown: 3, hazel: 2, green: 1.5, blue: 1 },
    hairTextures: { straight: 2.5, wavy: 2, curly: 1 },
  },

  // Dravidic (South Indian Tamil/Malayalam)
  dravidic: {
    hairColors: { black: 5, 'dark-brown': 1 },
    eyeColors: { 'dark-brown': 4, black: 3, brown: 2 },
    hairTextures: { wavy: 2.5, curly: 2.5, straight: 1.5 },
  },

  // Fulanic (Fulani/Peul Sahel)
  fulanic: {
    hairColors: { black: 5 },
    eyeColors: { 'dark-brown': 4, black: 3, brown: 2 },
    hairTextures: { curly: 3, coily: 2.5, wavy: 2 },
  },

  // Gangetic (North Indian Hindi belt)
  gangetic: {
    hairColors: { black: 4, 'dark-brown': 2 },
    eyeColors: { brown: 4, 'dark-brown': 3, hazel: 1, black: 1 },
    hairTextures: { straight: 2.5, wavy: 2.5, curly: 1 },
  },

  // Gorkhalic (Nepali/Himalayan)
  gorkhalic: {
    hairColors: { black: 4.5, 'dark-brown': 1.5 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2 },
    hairTextures: { straight: 3.5, wavy: 1.5 },
  },

  // Hannic (Han Chinese majority)
  hannic: {
    hairColors: { black: 5, 'dark-brown': 1 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2 },
    hairTextures: { straight: 4.5, wavy: 0.5 },
  },

  // Hyperborean (Russian far north/Siberian)
  hyperborean: {
    hairColors: { black: 3, 'dark-brown': 2.5, 'light-brown': 1.5, blonde: 1 },
    eyeColors: { brown: 3, 'dark-brown': 2, gray: 2, blue: 1 },
    hairTextures: { straight: 4, wavy: 1 },
  },

  // Kartvelian (Georgian/Caucasian)
  kartvelian: {
    hairColors: { black: 3.5, 'dark-brown': 3 },
    eyeColors: { brown: 3, hazel: 2.5, 'dark-brown': 2, green: 1 },
    hairTextures: { wavy: 2.5, curly: 2, straight: 2 },
  },

  // Kedaric (Afghan/Pashto)
  kedaric: {
    hairColors: { black: 3.5, 'dark-brown': 3 },
    eyeColors: { brown: 3, hazel: 2, 'dark-brown': 2, green: 1, blue: 0.5 },
    hairTextures: { wavy: 2.5, curly: 2, straight: 2 },
  },

  // Khalkhan (Mongolian)
  khalkhan: {
    hairColors: { black: 5, 'dark-brown': 1 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2 },
    hairTextures: { straight: 4.5, wavy: 0.5 },
  },

  // Magyric (Hungarian)
  magyric: {
    hairColors: { 'dark-brown': 3, 'light-brown': 2, black: 1.5, blonde: 1 },
    eyeColors: { brown: 2.5, blue: 2, hazel: 2, green: 1.5, gray: 1 },
    hairTextures: { straight: 2.5, wavy: 2, curly: 1 },
  },

  // Maharlikan (Filipino)
  maharlikan: {
    hairColors: { black: 4.5, 'dark-brown': 1.5 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2 },
    hairTextures: { straight: 3.5, wavy: 1.5 },
  },

  // Mascarene (Mauritius/Réunion/Seychelles creole)
  mascarene: {
    hairColors: { black: 3.5, 'dark-brown': 2.5, 'light-brown': 1 },
    eyeColors: { brown: 3, 'dark-brown': 2.5, hazel: 2, green: 0.5 },
    hairTextures: { curly: 3, wavy: 2, coily: 1.5 },
  },

  // Melakan (Malay Malaysian)
  melakan: {
    hairColors: { black: 4.5, 'dark-brown': 1.5 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2 },
    hairTextures: { straight: 3.5, wavy: 1.5 },
  },

  // Oceanic (Pacific Islander/Polynesian)
  oceanic: {
    hairColors: { black: 4, 'dark-brown': 2 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2 },
    hairTextures: { wavy: 3, curly: 2.5, straight: 1 },
  },

  // Pelagic-Pidgin (mixed Pacific)
  'pelagic-pidgin': {
    hairColors: { black: 3.5, 'dark-brown': 2.5, 'light-brown': 1 },
    eyeColors: { brown: 3.5, 'dark-brown': 3, hazel: 1.5 },
    hairTextures: { wavy: 2.5, curly: 2.5, straight: 1.5 },
  },

  // Post-Severnyan (post-Soviet Central Asian)
  'post-severnyan': {
    hairColors: { black: 3, 'dark-brown': 3, 'light-brown': 1.5 },
    eyeColors: { brown: 3, hazel: 2, 'dark-brown': 2, blue: 1 },
    hairTextures: { straight: 3, wavy: 2 },
  },

  // Siamic (Thai/Lao Southeast Asian)
  siamic: {
    hairColors: { black: 4.5, 'dark-brown': 1.5 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2 },
    hairTextures: { straight: 4, wavy: 1 },
  },

  // Sogdian (Uzbek/Tajik Central Asian)
  sogdian: {
    hairColors: { black: 3, 'dark-brown': 3, 'light-brown': 1.5 },
    eyeColors: { brown: 3, hazel: 2.5, 'dark-brown': 2, green: 1 },
    hairTextures: { straight: 2.5, wavy: 2.5 },
  },

  // Tawantinsuyan (Andean/Quechua/Aymara)
  tawantinsuyan: {
    hairColors: { black: 4.5, 'dark-brown': 1.5 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2 },
    hairTextures: { straight: 4, wavy: 1 },
  },

  // Wolofic (Wolof/Senegalese West African)
  wolofic: {
    hairColors: { black: 5 },
    eyeColors: { 'dark-brown': 4, black: 3, brown: 2 },
    hairTextures: { 'kinky-coily': 4, coily: 3 },
  },

  // Yuehai (Cantonese Southern Chinese)
  yuehai: {
    hairColors: { black: 5, 'dark-brown': 1 },
    eyeColors: { brown: 4, 'dark-brown': 3, black: 2 },
    hairTextures: { straight: 4.5, wavy: 0.5 },
  },

  // Zagwenic (Ethiopian Amharic)
  zagwenic: {
    hairColors: { black: 5, 'dark-brown': 0.5 },
    eyeColors: { 'dark-brown': 4, brown: 3, black: 2 },
    hairTextures: { curly: 3.5, coily: 2.5, wavy: 1.5 },
  },

  // Default fallback
  Global: {
    // No modifications - uses uniform distribution
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function selectHeightBand(rng: Rng, vocab: AgentVocabV1, priors: AppearanceCountryPriors | null): HeightBand {
  const pool = vocab.appearance.heightBands as readonly HeightBand[];
  const priorsWeights = priors?.appearance?.heightBandWeights01k;

  if (!priorsWeights) {
    return rng.pick(pool);
  }

  const weights = pool.map((b) => ({
    item: b,
    weight: Number(priorsWeights[b] ?? 0) || 0,
  }));

  return weightedPick(rng, weights) as HeightBand;
}

/**
 * Get culture appearance weights, with fallback to Global/uniform
 */
function getCultureWeights(homeCulture: string): {
  hairColors?: Record<string, number>;
  eyeColors?: Record<string, number>;
  hairTextures?: Record<string, number>;
} {
  return CULTURE_APPEARANCE_WEIGHTS[homeCulture] ?? CULTURE_APPEARANCE_WEIGHTS['Global'] ?? {};
}

function selectHairColor(
  rng: Rng,
  hairColors: readonly string[],
  age: number,
  express01: number,
  public01: number,
  homeCulture: string,
): string {
  const grayish = (s: string) => {
    const k = s.toLowerCase();
    return k.includes('gray') || k.includes('silver') || k.includes('salt') || k.includes('white');
  };
  const dyed = (s: string) => s.toLowerCase().includes('dyed');
  const cultureWeights = getCultureWeights(homeCulture).hairColors ?? {};

  const weights = hairColors.map((c) => {
    const cKey = c.toLowerCase();
    // Start with culture-based weight or base of 1
    let w = cultureWeights[cKey] ?? cultureWeights[c] ?? 1;

    // Gray/silver hair more likely with age
    if (grayish(c)) {
      w += age >= 50 ? 0.8 + 2.0 * (age / 120) : -0.7;
      if (age <= 25) w *= 0.25;
    }

    // Dyed hair correlates with expressiveness and public visibility
    if (dyed(c)) {
      w += 0.25 + 0.9 * express01 + 0.35 * public01;
    }

    return { item: c, weight: Math.max(0.05, w) };
  });

  return weightedPick(rng, weights);
}

function selectHairTexture(
  rng: Rng,
  hairTextures: readonly string[],
  homeCulture: string,
): string {
  const cultureWeights = getCultureWeights(homeCulture).hairTextures ?? {};

  const weights = hairTextures.map((t) => {
    const tKey = t.toLowerCase();
    const w = cultureWeights[tKey] ?? cultureWeights[t] ?? 1;
    return { item: t, weight: Math.max(0.05, w) };
  });

  return weightedPick(rng, weights);
}

function selectEyeColor(
  rng: Rng,
  eyeColors: readonly string[],
  homeCulture: string,
): string {
  const cultureWeights = getCultureWeights(homeCulture).eyeColors ?? {};

  const weights = eyeColors.map((c) => {
    const cKey = c.toLowerCase();
    const w = cultureWeights[cKey] ?? cultureWeights[c] ?? 1;
    return { item: c, weight: Math.max(0.05, w) };
  });

  return weightedPick(rng, weights);
}

function selectVoiceTag(
  rng: Rng,
  voiceTags: readonly string[],
  careerTrackTag: string,
  roleSeedTags: readonly string[],
  public01: number,
  opsec01: number,
  express01: number,
): string {
  const weights = voiceTags.map((v) => {
    const key = v.toLowerCase();
    let w = 1;

    // Career-based voice biases
    const careerVoices = VOICE_BIASES[careerTrackTag as keyof typeof VOICE_BIASES];
    if (careerVoices && careerVoices.some((cv) => key.includes(cv))) {
      w += careerTrackTag === 'intelligence' ? 1.6 : 1.4;
    }

    // Operative role has strongest voice bias
    if (roleSeedTags.includes('operative') && VOICE_BIASES.operative.some((ov) => key.includes(ov))) {
      w += 1.8;
    }

    // Public visibility -> more expressive voices
    if (public01 > 0.6 && PUBLIC_VOICES.some((pv) => key.includes(pv))) {
      w += 0.6 * public01;
    }

    // Aesthetic expressiveness -> more distinctive/expressive voices
    if (express01 > 0.6 && PUBLIC_VOICES.some((pv) => key.includes(pv))) {
      w += 0.5 * express01;
    }

    // High OPSEC -> quieter, less distinctive voices
    if (opsec01 > 0.6 && OPSEC_VOICES.some((ov) => key.includes(ov))) {
      w += 0.5 * opsec01;
    }

    return { item: v, weight: Math.max(0.1, w) };
  });

  return weightedPick(rng, weights);
}

function selectDistinguishingMarks(
  rng: Rng,
  markPool: readonly string[],
  express01: number,
  public01: number,
  opsec01: number,
): string[] {
  // High OPSEC agents avoid distinguishing marks
  // Public figures may have more (they're noticed anyway)
  const baseMax = opsec01 > 0.7 ? 1 : public01 > 0.7 ? 3 : 2;
  const maxMarks = clampInt(baseMax + (express01 > 0.75 ? 1 : 0), 0, 3);

  const count = rng.int(0, maxMarks);
  return uniqueStrings(rng.pickK(markPool, count));
}

// ============================================================================
// Main Computation
// ============================================================================

/**
 * Compute appearance attributes for an agent.
 *
 * Uses country priors for height band when available.
 * Correlates hair/eye color with culture (ethnicity-appearance correlation).
 * Correlates hair color with age and expressiveness.
 * Correlates voice with career track and visibility.
 * Limits distinguishing marks for high-OPSEC agents.
 */
export function computeAppearance(ctx: AppearanceContext): AppearanceResult {
  const { seed, vocab, latents, countryPriors, trace, age, careerTrackTag, roleSeedTags, public01, opsec01, homeCulture } = ctx;

  // Validate required vocab
  if (!vocab.appearance.heightBands.length) throw new Error('Agent vocab missing: appearance.heightBands');
  if (!vocab.appearance.buildTags.length) throw new Error('Agent vocab missing: appearance.buildTags');
  if (!vocab.appearance.hairColors.length || !vocab.appearance.hairTextures.length) {
    throw new Error('Agent vocab missing: appearance hair pools');
  }
  if (!vocab.appearance.eyeColors.length) throw new Error('Agent vocab missing: appearance.eyeColors');
  if (!vocab.appearance.voiceTags.length) throw new Error('Agent vocab missing: appearance.voiceTags');

  traceFacet(trace, seed, 'appearance');
  const rng = makeRng(facetSeed(seed, 'appearance'));

  const express01 = latents.aestheticExpressiveness / 1000;

  // Height band with country priors
  const heightBand = selectHeightBand(rng, vocab, countryPriors);
  const heightCm = pickHeightCm(rng, heightBand);
  const heightIn = Math.round(heightCm / 2.54);

  // Build tag - uniform selection (avoids cultural stereotypes)
  const buildTag = rng.pick(vocab.appearance.buildTags);
  const weightKg = pickWeightKg(rng, buildTag, heightCm);
  const weightLb = Math.round(weightKg * 2.20462);

  // Hair color/texture with culture + age + expressiveness correlations
  const hairColor = selectHairColor(rng, vocab.appearance.hairColors, age, express01, public01, homeCulture);
  const hairTexture = selectHairTexture(rng, vocab.appearance.hairTextures, homeCulture);
  const hair = {
    color: hairColor,
    texture: hairTexture,
  };

  // Eye color with culture correlation
  const eyes = { color: selectEyeColor(rng, vocab.appearance.eyeColors, homeCulture) };

  // Voice tag with career and visibility correlations
  const voiceTag = selectVoiceTag(rng, vocab.appearance.voiceTags, careerTrackTag, roleSeedTags, public01, opsec01, express01);

  // Distinguishing marks (limited for OPSEC)
  const distinguishingMarks = selectDistinguishingMarks(
    rng,
    vocab.appearance.distinguishingMarks,
    express01,
    public01,
    opsec01,
  );

  traceSet(
    trace,
    'appearance',
    { heightBand, heightCm, heightIn, buildTag, weightKg, weightLb, hair, eyes, voiceTag, distinguishingMarks },
    {
      method: 'pick+weights',
      dependsOn: { facet: 'appearance', age, express01, opsec01, public01, homeCulture },
    },
  );

  return { heightBand, heightCm, heightIn, buildTag, weightKg, weightLb, hair, eyes, voiceTag, distinguishingMarks };
}
