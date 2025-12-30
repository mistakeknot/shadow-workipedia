/**
 * Agent generator orchestrator.
 *
 * This module orchestrates all facet modules to produce a complete GeneratedAgent.
 * The flow matches the original agentGenerator.ts data dependencies:
 *
 * 1. Base setup (seed, birth year, tier, countries)
 * 2. Geography Stage 1 (origin, citizenship, current - before latents)
 * 3. Role seed tags (needed for latents)
 * 4. Latents computation
 * 5. Geography Stage 2 (culture blending - uses latents)
 * 6. Identity (names, languages, gender, tracks)
 * 7. Appearance
 * 8. Capabilities (aptitudes, traits, skills)
 * 9. Psychology (ethics, contradictions, visibility)
 * 10. Preferences (food, media, fashion, routines)
 * 11. Social (family, relationships, network)
 * 12. Lifestyle (health, vices, spirituality)
 * 13. Narrative (timeline, minority status)
 * 14. Simulation (deep sim preview)
 */

import type {
  GenerateAgentInput,
  GeneratedAgent,
  AgentGenerationTraceV1,
  TierBand,
  SocioeconomicMobility,
  Latents,
  CultureProfileV1,
  Fixed,
  EliteCompensator,
  OrgType,
  GradeBand,
  ClearanceBand,
  FunctionalSpecialization,
  ConflictStyle,
  EpistemicStyle,
  SocialEnergy,
  RiskPosture,
  WritingStyle,
  BriefingStyle,
  ConfidenceCalibration,
  CultureAxes,
  EthnolinguisticHeritage,
  RegionalSocialization,
  InstitutionalCulture,
  // New facet types
  GoalType,
  FearType,
  AttachmentStyle,
  DebtLevel,
  IncomeStability,
  SecretType,
  SecretSeverity,
  HumorStyle,
  PressureResponse,
  GaitStyle,
  EyeContactPattern,
  NervousHabit,
} from './types';

import {
  makeRng,
  facetSeed,
  clamp01,
  clampFixed01k,
  traceSet,
  traceFacet,
  weightedPick,
  weightedPickKUnique,
  band5From01k,
  deriveCultureFromContinent,
  normalizeCultureEnv01k,
  mixCultureEnv01k,
  mixWeights01k,
  uniqueStrings,
  type Rng,
  type CultureEnv01k,
  type CultureEnvAxis,
} from './utils';

import { computeLatents } from './latents';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ValidCountry = { shadow: string; iso3: string; continent?: string; population?: number };

type ClimateIndicators = { hot01: number; coastal01: number; cold01: number };

type MicroProfileEntry = { id: string; weight01k: number; profile: CultureProfileV1 };

type PrimaryWeights = {
  namesPrimaryWeight: number;
  languagesPrimaryWeight: number;
  foodPrimaryWeight: number;
  mediaPrimaryWeight: number;
  fashionPrimaryWeight: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Trace initialization
// ─────────────────────────────────────────────────────────────────────────────

function initializeTrace(seed: string, includeTrace: boolean): AgentGenerationTraceV1 | undefined {
  if (!includeTrace) return undefined;

  const emptyLatents: Latents = {
    cosmopolitanism: 0,
    publicness: 0,
    opsecDiscipline: 0,
    institutionalEmbeddedness: 0,
    riskAppetite: 0,
    stressReactivity: 0,
    impulseControl: 0,
    techFluency: 0,
    socialBattery: 0,
    aestheticExpressiveness: 0,
    frugality: 0,
    curiosityBandwidth: 0,
    adaptability: 0,
    planningHorizon: 0,
    principledness: 0,
    physicalConditioning: 0,
  };

  return {
    version: 1,
    normalizedSeed: seed,
    facetSeeds: {},
    latents: {
      values: { ...emptyLatents },
      raw: { ...emptyLatents },
      tierBias: { ...emptyLatents },
      roleBias: { ...emptyLatents },
    },
    derived: {},
    fields: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

function validateVocab(vocab: GenerateAgentInput['vocab']): void {
  if (vocab.version !== 1) {
    throw new Error(`Unsupported agent vocab version: ${String((vocab as { version?: unknown }).version)}`);
  }
  if (!vocab.identity.tierBands.length) throw new Error('Agent vocab missing: identity.tierBands');
  if (!vocab.identity.homeCultures.length) throw new Error('Agent vocab missing: identity.homeCultures');
  if (!vocab.identity.roleSeedTags.length) throw new Error('Agent vocab missing: identity.roleSeedTags');
  if (!vocab.identity.firstNames.length || !vocab.identity.lastNames.length) {
    throw new Error('Agent vocab missing: identity name pools');
  }
  if (!vocab.identity.languages.length) throw new Error('Agent vocab missing: identity.languages');
  if (!vocab.deepSimPreview?.needTags?.length) throw new Error('Agent vocab missing: deepSimPreview.needTags');
  if (!vocab.deepSimPreview?.thoughtTags?.length) throw new Error('Agent vocab missing: deepSimPreview.thoughtTags');
  if (!vocab.deepSimPreview?.breakTypes?.length) throw new Error('Agent vocab missing: deepSimPreview.breakTypes');
}

function validateCountries(
  countries: Array<{ iso3?: unknown; shadow?: unknown; continent?: unknown; population?: unknown }>,
): ValidCountry[] {
  const validCountries = countries
    .map(c => ({
      shadow: String((c as { shadow?: unknown }).shadow ?? '').trim(),
      iso3: String((c as { iso3?: unknown }).iso3 ?? '').trim().toUpperCase(),
      continent: (c as { continent?: unknown }).continent
        ? String((c as { continent?: unknown }).continent).trim()
        : undefined,
      population: typeof (c as { population?: unknown }).population === 'number'
        ? (c as { population: number }).population
        : undefined,
    }))
    .filter(c => c.shadow && c.iso3.length === 3)
    .sort((a, b) => a.iso3.localeCompare(b.iso3));

  if (!validCountries.length) throw new Error('Agent country map missing: no ISO3 entries');
  return validCountries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Population-weighted country selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select a country using population weighting for realistic distribution.
 * Countries with higher populations are proportionally more likely to be selected.
 * Falls back to uniform selection if no population data is available.
 */
function pickCountryByPopulation(rng: Rng, countries: ValidCountry[]): ValidCountry {
  // Check if we have population data
  const countriesWithPop = countries.filter(c => c.population && c.population > 0);
  if (countriesWithPop.length === 0) {
    // Fallback to uniform selection if no population data
    return rng.pick(countries);
  }

  // Population-weighted selection (manual implementation since weightedPick is string-only)
  const totalPop = countriesWithPop.reduce((sum, c) => sum + (c.population ?? 0), 0);
  let r = rng.next01() * totalPop;
  for (const country of countriesWithPop) {
    r -= country.population ?? 0;
    if (r <= 0) return country;
  }
  // Fallback to last country (shouldn't happen but satisfies type checker)
  return countriesWithPop[countriesWithPop.length - 1]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geography Stage 1: Country selection (before latents)
// ─────────────────────────────────────────────────────────────────────────────

function computeGeographyStage1(
  seed: string,
  tierBand: TierBand,
  birthYear: number,
  validCountries: ValidCountry[],
  input: GenerateAgentInput,
  trace: AgentGenerationTraceV1 | undefined,
) {
  // Socioeconomic origin + mobility
  traceFacet(trace, seed, 'socioeconomic');
  const socioRng = makeRng(facetSeed(seed, 'socioeconomic'));
  const originTierWeights: Record<TierBand, Array<{ item: TierBand; weight: number }>> = {
    elite: [
      { item: 'elite', weight: 0.55 },
      { item: 'middle', weight: 0.35 },
      { item: 'mass', weight: 0.10 },
    ],
    middle: [
      { item: 'elite', weight: 0.12 },
      { item: 'middle', weight: 0.65 },
      { item: 'mass', weight: 0.23 },
    ],
    mass: [
      { item: 'elite', weight: 0.03 },
      { item: 'middle', weight: 0.18 },
      { item: 'mass', weight: 0.79 },
    ],
  };
  const originTierBand = weightedPick(socioRng, originTierWeights[tierBand]) as TierBand;
  const tierRank = { elite: 2, middle: 1, mass: 0 };
  const diff = tierRank[tierBand] - tierRank[originTierBand];
  const socioeconomicMobility: SocioeconomicMobility = diff > 0 ? 'upward' : diff < 0 ? 'downward' : 'stable';
  traceSet(trace, 'identity.originTierBand', originTierBand, { method: 'weightedPick', dependsOn: { tierBand } });
  traceSet(trace, 'identity.socioeconomicMobility', socioeconomicMobility, {
    method: 'derived',
    dependsOn: { tierBand, originTierBand },
  });

  // Origin country - use population-weighted selection for realistic distribution
  // This means ~35% of agents will be from China/India, ~4% from USA, etc.
  traceFacet(trace, seed, 'origin');
  const originRng = makeRng(facetSeed(seed, 'origin'));
  const forcedHomeIso3 = (input.homeCountryIso3 ?? '').trim().toUpperCase();
  const origin = forcedHomeIso3
    ? validCountries.find(c => c.iso3.trim().toUpperCase() === forcedHomeIso3) ?? pickCountryByPopulation(originRng, validCountries)
    : pickCountryByPopulation(originRng, validCountries);
  const homeCountryIso3 = origin.iso3.trim().toUpperCase();
  const homeCulture = deriveCultureFromContinent(origin.continent, homeCountryIso3);
  traceSet(trace, 'identity.homeCountryIso3', homeCountryIso3, {
    method: forcedHomeIso3 ? 'overrideOrFallbackPick' : 'populationWeightedPick',
    dependsOn: {
      facet: 'origin',
      poolSize: validCountries.length,
      continent: origin.continent ?? null,
      forcedHomeIso3: forcedHomeIso3 || null,
      population: origin.population ?? null,
    },
  });
  traceSet(trace, 'identity.homeCulture', homeCulture, {
    method: 'deriveCultureFromContinent',
    dependsOn: { continent: origin.continent ?? null, iso3: homeCountryIso3 },
  });

  const cohortBucketStartYear = Math.floor(birthYear / 10) * 10;
  const countryPriorsBucket = input.priors?.countries?.[homeCountryIso3]?.buckets?.[String(cohortBucketStartYear)];
  if (trace) {
    trace.derived.countryPriors = {
      homeCountryIso3,
      cohortBucketStartYear,
      hasPriors: !!countryPriorsBucket,
      indicators: countryPriorsBucket?.indicators ?? null,
    };
  }

  // Climate indicators
  const homeFoodEnvEarly = countryPriorsBucket?.foodEnvironment01k;
  const climateIndicators: ClimateIndicators = (() => {
    if (!homeFoodEnvEarly) return { hot01: 0.5, coastal01: 0.5, cold01: 0.5 };
    const spice01 = (Number(homeFoodEnvEarly.spice) || 500) / 1000;
    const street01 = (Number(homeFoodEnvEarly.streetFood) || 500) / 1000;
    const seafood01 = (Number(homeFoodEnvEarly.seafood) || 500) / 1000;
    const fine01 = (Number(homeFoodEnvEarly.fineDining) || 500) / 1000;
    const meat01 = (Number(homeFoodEnvEarly.meat) || 500) / 1000;
    const dairy01 = (Number(homeFoodEnvEarly.dairy) || 500) / 1000;
    return {
      hot01: Math.min(1, 0.4 * spice01 + 0.35 * street01 + 0.25 * (1 - dairy01)),
      coastal01: Math.min(1, 0.55 * seafood01 + 0.25 * fine01 + 0.20 * street01),
      cold01: Math.min(1, 0.35 * meat01 + 0.40 * dairy01 + 0.25 * (1 - spice01)),
    };
  })();
  if (trace) trace.derived.climateIndicators = climateIndicators;

  // Culture countries for citizenship/current selection
  const cultureCountries = validCountries.filter(c => deriveCultureFromContinent(c.continent, c.iso3) === homeCulture);

  return {
    originTierBand,
    socioeconomicMobility,
    homeCountryIso3,
    homeCulture,
    cohortBucketStartYear,
    countryPriorsBucket,
    climateIndicators,
    cultureCountries,
    origin,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Geography Stage 2: Citizenship, current, culture blending (after latents)
// ─────────────────────────────────────────────────────────────────────────────

function computeGeographyStage2(
  seed: string,
  cosmo01: number,
  adaptability01: number,
  curiosity01: number,
  roleSeedTags: string[],
  stage1: ReturnType<typeof computeGeographyStage1>,
  validCountries: ValidCountry[],
  input: GenerateAgentInput,
  trace: AgentGenerationTraceV1 | undefined,
) {
  const { homeCountryIso3, homeCulture, cohortBucketStartYear, cultureCountries, origin } = stage1;
  const vocab = input.vocab;

  // Citizenship
  traceFacet(trace, seed, 'citizenship');
  const citizenshipRng = makeRng(facetSeed(seed, 'citizenship'));
  const citizenshipFlip = Math.min(
    0.65,
    0.05 +
      0.35 * cosmo01 +
      (roleSeedTags.includes('diplomat') ? 0.12 : 0) +
      (roleSeedTags.includes('operative') ? 0.06 : 0),
  );
  const citizenshipOrigin =
    citizenshipRng.next01() < citizenshipFlip && cultureCountries.length
      ? citizenshipRng.pick(cultureCountries)
      : origin;
  const forcedCitizenshipIso3 = (input.citizenshipCountryIso3 ?? '').trim().toUpperCase();
  const citizenshipCountryIso3 = forcedCitizenshipIso3
    ? validCountries.find(c => c.iso3.trim().toUpperCase() === forcedCitizenshipIso3)?.iso3.trim().toUpperCase() ??
      citizenshipOrigin.iso3.trim().toUpperCase()
    : citizenshipOrigin.iso3.trim().toUpperCase();
  traceSet(trace, 'identity.citizenshipCountryIso3', citizenshipCountryIso3, {
    method: forcedCitizenshipIso3 ? 'overrideOrFallbackPick' : 'probabilisticPick',
    dependsOn: {
      facet: 'citizenship',
      citizenshipFlip,
      cultureCountryPoolSize: cultureCountries.length,
      forcedCitizenshipIso3: forcedCitizenshipIso3 || null,
    },
  });

  // Current country
  traceFacet(trace, seed, 'current_country');
  const currentRng = makeRng(facetSeed(seed, 'current_country'));
  const roleAbroad =
    (roleSeedTags.includes('diplomat') ? 0.22 : 0) +
    (roleSeedTags.includes('media') ? 0.06 : 0) +
    (roleSeedTags.includes('technocrat') ? 0.05 : 0) +
    (roleSeedTags.includes('operative') ? 0.12 : 0);
  const abroadChance = Math.min(0.88, 0.06 + 0.55 * cosmo01 + 0.15 * adaptability01 + 0.05 * curiosity01 + roleAbroad);
  const abroad = currentRng.next01() < abroadChance;
  const currentCandidatePool = cultureCountries.length ? cultureCountries : validCountries;
  const abroadPool = currentCandidatePool.filter(c => c.iso3.trim().toUpperCase() !== homeCountryIso3);
  const currentPick = abroad ? currentRng.pick(abroadPool.length ? abroadPool : currentCandidatePool) : origin;
  const forcedCurrentIso3 = (input.currentCountryIso3 ?? '').trim().toUpperCase();
  const currentCountryIso3 = forcedCurrentIso3
    ? validCountries.find(c => c.iso3.trim().toUpperCase() === forcedCurrentIso3)?.iso3.trim().toUpperCase() ??
      currentPick.iso3.trim().toUpperCase()
    : currentPick.iso3.trim().toUpperCase();
  traceSet(trace, 'identity.currentCountryIso3', currentCountryIso3, {
    method: forcedCurrentIso3 ? 'overrideOrFallbackPick' : 'probabilisticPick',
    dependsOn: {
      facet: 'current_country',
      abroadChance,
      abroad,
      poolSize: abroad ? abroadPool.length || currentCandidatePool.length : 1,
      forcedCurrentIso3: forcedCurrentIso3 || null,
    },
  });

  // Culture environment blending
  const macroCulture = vocab.cultureProfiles?.[homeCulture];
  const macroCultureWeights = macroCulture?.weights ?? {};

  const getCultureEnv01k = (iso3: string): CultureEnv01k | null => {
    const bucket = input.priors?.countries?.[iso3]?.buckets?.[String(cohortBucketStartYear)];
    return normalizeCultureEnv01k(bucket?.cultureEnvironment01k as Partial<Record<CultureEnvAxis, Fixed>> | null | undefined);
  };
  const homeCultureEnv01k = getCultureEnv01k(homeCountryIso3);
  const citizenshipCultureEnv01k = citizenshipCountryIso3 !== homeCountryIso3 ? getCultureEnv01k(citizenshipCountryIso3) : null;
  const currentCultureEnv01k = currentCountryIso3 !== homeCountryIso3 ? getCultureEnv01k(currentCountryIso3) : null;
  const cultureEnv01k = homeCultureEnv01k
    ? mixCultureEnv01k([
        { env: homeCultureEnv01k, weight: 1 },
        ...(citizenshipCultureEnv01k ? [{ env: citizenshipCultureEnv01k, weight: 0.1 + 0.25 * cosmo01 }] : []),
        ...(currentCultureEnv01k ? [{ env: currentCultureEnv01k, weight: 0.15 + 0.35 * cosmo01 + (abroad ? 0.15 : 0) }] : []),
      ])
    : null;

  const cultureCosmo01 = clamp01((cultureEnv01k?.cosmopolitanism ?? 450) / 1000, 0.45);
  const cultureTraditionalism01 = clamp01((cultureEnv01k?.traditionalism ?? 520) / 1000, 0.52);
  const cultureMediaOpenness01 = clamp01((cultureEnv01k?.mediaOpenness ?? 650) / 1000, 0.65);
  const mixing01 = clamp01(0.55 * cosmo01 + 0.45 * cultureCosmo01, 0.5);

  // Primary weights
  const namesPrimaryWeight = clamp01(
    (macroCultureWeights.namesPrimaryWeight ?? 0.75) - 0.55 * mixing01 + 0.1 * cultureTraditionalism01,
    0.75,
  );
  const languagesPrimaryWeight = clamp01(
    (macroCultureWeights.languagesPrimaryWeight ?? 0.85) - 0.45 * mixing01 + 0.06 * cultureTraditionalism01,
    0.85,
  );
  const foodPrimaryWeight = clamp01(
    (macroCultureWeights.foodPrimaryWeight ?? 0.7) - 0.25 * mixing01 + 0.12 * cultureTraditionalism01,
    0.7,
  );
  const mediaPrimaryWeight = clamp01(
    (macroCultureWeights.mediaPrimaryWeight ?? 0.7) - 0.35 * mixing01 - 0.1 * cultureMediaOpenness01 + 0.04 * cultureTraditionalism01,
    0.7,
  );
  const fashionPrimaryWeight = clamp01(
    (macroCultureWeights.fashionPrimaryWeight ?? 0.6) - 0.3 * mixing01 + 0.1 * cultureTraditionalism01,
    0.6,
  );
  const primaryWeights: PrimaryWeights = {
    namesPrimaryWeight,
    languagesPrimaryWeight,
    foodPrimaryWeight,
    mediaPrimaryWeight,
    fashionPrimaryWeight,
  };

  // Microculture weights blending
  const getMicroCultureWeights01k = (iso3: string): Record<string, Fixed> | null => {
    const bucket = input.priors?.countries?.[iso3]?.buckets?.[String(cohortBucketStartYear)];
    const weights = bucket?.cultureProfileWeights01k;
    return weights && typeof weights === 'object' ? (weights as Record<string, Fixed>) : null;
  };
  const homeMicroWeights01k = getMicroCultureWeights01k(homeCountryIso3);
  const citizenshipMicroWeights01k =
    citizenshipCountryIso3 !== homeCountryIso3 ? getMicroCultureWeights01k(citizenshipCountryIso3) : null;
  const currentMicroWeights01k =
    currentCountryIso3 !== homeCountryIso3 ? getMicroCultureWeights01k(currentCountryIso3) : null;
  const microWeights01k = homeMicroWeights01k
    ? mixWeights01k([
        { weights: homeMicroWeights01k, weight: 1 },
        ...(citizenshipMicroWeights01k ? [{ weights: citizenshipMicroWeights01k, weight: 0.1 + 0.25 * cosmo01 }] : []),
        ...(currentMicroWeights01k
          ? [{ weights: currentMicroWeights01k, weight: 0.15 + 0.35 * cosmo01 + (abroad ? 0.15 : 0) }]
          : []),
      ])
    : null;
  const microTop = microWeights01k
    ? Object.entries(microWeights01k)
        .map(([profileId, weight01k]) => ({ profileId, weight01k: Number(weight01k) }))
        .filter(x => x.profileId && Number.isFinite(x.weight01k) && x.weight01k > 0)
        .sort((a, b) => b.weight01k - a.weight01k || a.profileId.localeCompare(b.profileId))
        .slice(0, 6)
    : [];

  const microProfiles: MicroProfileEntry[] = microTop
    .map(({ profileId, weight01k }) => ({
      id: profileId,
      weight01k,
      profile: vocab.microCultureProfiles?.[profileId],
    }))
    .filter((x): x is MicroProfileEntry => !!x.profile);

  // Unioned pools for names/languages
  const microFirstNames = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.firstNames ?? []));
  const microMaleFirstNames = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.maleFirstNames ?? []));
  const microFemaleFirstNames = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.femaleFirstNames ?? []));
  const microLastNames = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.lastNames ?? []));
  const microLanguages = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.languages ?? []));

  if (trace) {
    trace.derived.primaryWeights = primaryWeights;
    trace.derived.cultureEnv = {
      home: homeCultureEnv01k,
      citizenship: citizenshipCultureEnv01k,
      current: currentCultureEnv01k,
      blended: cultureEnv01k,
      mixing01,
    };
    trace.derived.microCultureProfilesTop = microTop;
    trace.derived.homeCultureProfilePresent = !!macroCulture;
  }

  return {
    citizenshipCountryIso3,
    currentCountryIso3,
    abroad,
    homeCultureEnv01k,
    citizenshipCultureEnv01k,
    currentCultureEnv01k,
    cultureEnv01k,
    cultureCosmo01,
    cultureTraditionalism01,
    cultureMediaOpenness01,
    mixing01,
    primaryWeights,
    microWeights01k,
    microTop,
    microProfiles,
    microFirstNames,
    microMaleFirstNames,
    microFemaleFirstNames,
    microLastNames,
    microLanguages,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Weight-faithful microculture item picking
// ─────────────────────────────────────────────────────────────────────────────

function pickFromWeightedMicroProfiles<T>(
  rng: Rng,
  microProfiles: MicroProfileEntry[],
  getItems: (p: CultureProfileV1) => readonly T[] | undefined,
  count: number,
): T[] {
  if (microProfiles.length === 0 || count <= 0) return [];
  const results: T[] = [];
  const pickProfile = (): MicroProfileEntry => {
    const total = microProfiles.reduce((s, p) => s + p.weight01k, 0);
    let r = rng.next01() * total;
    for (const p of microProfiles) {
      r -= p.weight01k;
      if (r <= 0) return p;
    }
    return microProfiles[0]!;
  };
  for (let i = 0; i < count * 3 && results.length < count; i++) {
    const picked = pickProfile();
    const items = getItems(picked.profile) ?? [];
    if (items.length) {
      const item = rng.pick(items as T[]);
      if (!results.includes(item)) results.push(item);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Role Seed Tags (computed before latents)
// ─────────────────────────────────────────────────────────────────────────────

export function computeRoleSeedTags(
  seed: string,
  vocab: GenerateAgentInput['vocab'],
  inputRoleSeedTags: string[] | undefined,
  trace: AgentGenerationTraceV1 | undefined,
): string[] {
  const baseRng = makeRng(facetSeed(seed, 'base'));
  const roleSeedTags = (inputRoleSeedTags?.length ? inputRoleSeedTags : baseRng.pickK(vocab.identity.roleSeedTags, 2))
    .slice(0, 4);
  traceSet(trace, 'identity.roleSeedTags', roleSeedTags, {
    method: inputRoleSeedTags?.length ? 'override' : 'rng',
    dependsOn: { facet: 'base', poolSize: vocab.identity.roleSeedTags.length },
  });
  return roleSeedTags;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

import { computeIdentity } from './facets/identity';
import { computeAppearance } from './facets/appearance';
import { computeCapabilities } from './facets/capabilities';
import { computePsychology } from './facets/psychology';
import { computePreferences } from './facets/preferences';
import { computeSocial } from './facets/social';
import { computeLifestyle } from './facets/lifestyle';
import { computeNarrative } from './facets/narrative';
import { computeSimulation } from './facets/simulation';
import {
  normalizeSecurityEnv01k,
  type SecurityEnvAxis,
  type SecurityEnv01k,
} from './utils';

/**
 * Generate a complete agent from input parameters.
 *
 * This orchestrator calls facet modules in dependency order:
 * 1. Base setup (birth year, tier, countries)
 * 2. Role seed tags
 * 3. Geography Stage 1 (origin, mobility)
 * 4. Latents
 * 5. Geography Stage 2 (citizenship, current, culture)
 * 6. Identity (tracks, names, languages, gender)
 * 7. Appearance
 * 8. Capabilities (aptitudes, traits, skills)
 * 9. Psychology (ethics, contradictions, visibility)
 * 10. Preferences (food, media, fashion, routines)
 * 11. Social (family, relationships, network)
 * 12. Lifestyle (health, vices, spirituality)
 * 13. Narrative (timeline, minority status)
 * 14. Simulation (deep sim preview)
 */
export function generateAgent(input: GenerateAgentInput): GeneratedAgent {
  const seed = input.seed;
  const trace = initializeTrace(seed, input.includeTrace ?? false);

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 1: Base setup
  // ─────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'base');
  const baseRng = makeRng(facetSeed(seed, 'base'));

  const birthYear = input.birthYear ?? baseRng.int(1960, 2006);
  const asOfYear = input.asOfYear ?? 2025;
  const age = Math.max(0, Math.min(120, asOfYear - birthYear));

  validateVocab(input.vocab);
  const vocab = input.vocab;

  // Age-weighted tier selection using REALISTIC global wealth/status distribution
  // Target: ~5% elite, ~25% middle, ~70% mass (varies by age)
  // Based on Credit Suisse Global Wealth Report + social mobility research
  const tierBand: TierBand = input.tierBand ?? ((): TierBand => {
    // Realistic tier weights by age bracket
    // Young: almost no elites (only inherited wealth/status)
    // Peak: 45-64 has highest elite concentration
    // Elderly: mixed (wealthy retirees + fixed-income majority)
    let eliteWeight: number;
    let middleWeight: number;
    let massWeight: number;

    if (age < 25) {
      // Under 25: Elite nearly impossible except inheritance
      eliteWeight = 0.005;
      middleWeight = 0.15;
      massWeight = 0.845;
    } else if (age < 35) {
      // 25-34: Early career, very few elite
      eliteWeight = 0.02;
      middleWeight = 0.22;
      massWeight = 0.76;
    } else if (age < 45) {
      // 35-44: Career building, some achieve elite
      eliteWeight = 0.05;
      middleWeight = 0.28;
      massWeight = 0.67;
    } else if (age < 55) {
      // 45-54: Peak earning years
      eliteWeight = 0.08;
      middleWeight = 0.30;
      massWeight = 0.62;
    } else if (age < 65) {
      // 55-64: Accumulated wealth/status peak
      eliteWeight = 0.10;
      middleWeight = 0.32;
      massWeight = 0.58;
    } else {
      // 65+: Mixed - some wealthy retirees, many on fixed income
      eliteWeight = 0.08;
      middleWeight = 0.28;
      massWeight = 0.64;
    }

    const tierWeights = [
      { item: 'elite', weight: eliteWeight },
      { item: 'middle', weight: middleWeight },
      { item: 'mass', weight: massWeight },
    ];
    return weightedPick(baseRng, tierWeights) as TierBand;
  })();
  traceSet(trace, 'identity.tierBand', tierBand, {
    method: input.tierBand ? 'override' : 'age-weighted',
    dependsOn: { facet: 'base', age },
  });

  const validCountries = validateCountries(input.countries);

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 2: Role seed tags (needed for latents)
  // ─────────────────────────────────────────────────────────────────────────
  const roleSeedTags = computeRoleSeedTags(seed, vocab, input.roleSeedTags, trace);

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 3: Geography Stage 1 (before latents)
  // ─────────────────────────────────────────────────────────────────────────
  const geoStage1 = computeGeographyStage1(seed, tierBand, birthYear, validCountries, input, trace);

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 4: Latents
  // ─────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'latents');
  const latentModel = computeLatents(seed, tierBand, roleSeedTags);
  const latents = latentModel.values;
  if (trace) trace.latents = latentModel;
  traceSet(trace, 'latents.values', latents, { method: 'computeLatents', dependsOn: { tierBand, roleSeedTags } });

  // Derived latent values (0-1 normalized)
  const cosmo01 = latents.cosmopolitanism / 1000;
  const public01 = latents.publicness / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const inst01 = latents.institutionalEmbeddedness / 1000;
  const risk01 = latents.riskAppetite / 1000;

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 5: Geography Stage 2 (after latents)
  // ─────────────────────────────────────────────────────────────────────────
  const geoStage2 = computeGeographyStage2(
    seed,
    cosmo01,
    latents.adaptability / 1000,
    latents.curiosityBandwidth / 1000,
    roleSeedTags,
    geoStage1,
    validCountries,
    input,
    trace,
  );

  // Security environment
  const getSecurityEnv01k = (iso3: string): SecurityEnv01k | null => {
    const bucket = input.priors?.countries?.[iso3]?.buckets?.[String(geoStage1.cohortBucketStartYear)];
    return normalizeSecurityEnv01k(bucket?.securityEnvironment01k as Partial<Record<SecurityEnvAxis, Fixed>> | null | undefined);
  };
  const homeSecurityEnv01k = getSecurityEnv01k(geoStage1.homeCountryIso3);
  const currentSecurityEnv01k = getSecurityEnv01k(geoStage2.currentCountryIso3);
  const securityEnv01k = homeSecurityEnv01k ?? currentSecurityEnv01k;

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 6: Identity
  // ─────────────────────────────────────────────────────────────────────────
  const identityResult = computeIdentity({
    seed,
    vocab,
    priors: input.priors,
    homeCountryIso3: geoStage1.homeCountryIso3,
    citizenshipCountryIso3: geoStage2.citizenshipCountryIso3,
    currentCountryIso3: geoStage2.currentCountryIso3,
    homeCulture: geoStage1.homeCulture,
    age,
    birthYear,
    asOfYear,
    tierBand,
    latents,
    cosmo01,
    inst01,
    risk01,
    opsec01,
    macroCulture: vocab.cultureProfiles?.[geoStage1.homeCulture],
    microFirstNames: geoStage2.microFirstNames,
    microMaleFirstNames: geoStage2.microMaleFirstNames,
    microFemaleFirstNames: geoStage2.microFemaleFirstNames,
    microLastNames: geoStage2.microLastNames,
    microLanguages: geoStage2.microLanguages,
    namesPrimaryWeight: geoStage2.primaryWeights.namesPrimaryWeight,
    languagesPrimaryWeight: geoStage2.primaryWeights.languagesPrimaryWeight,
    cultureTraditionalism01: geoStage2.cultureTraditionalism01,
    microProfiles: geoStage2.microProfiles.map(p => ({ id: p.id, weight01k: p.weight01k })),
    countryPriorsBucket: geoStage1.countryPriorsBucket,
    cohortBucketStartYear: geoStage1.cohortBucketStartYear,
    inputRoleSeedTags: input.roleSeedTags,
    trace,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 7: Appearance
  // ─────────────────────────────────────────────────────────────────────────
  const appearanceResult = computeAppearance({
    seed,
    vocab,
    latents,
    countryPriors: geoStage1.countryPriorsBucket?.appearance
      ? { appearance: geoStage1.countryPriorsBucket.appearance }
      : null,
    age,
    careerTrackTag: identityResult.careerTrackTag,
    roleSeedTags,
    public01,
    opsec01,
    trace,
  });

  // Compute travelScore for capabilities (before calling computeCapabilities)
  // This is needed for skill weightings and uses mobility data
  traceFacet(trace, seed, 'mobility_early');
  const mobilityRng = makeRng(facetSeed(seed, 'mobility'));
  const travelModelScoreRaw = clampFixed01k(
    650 * cosmo01 +
      220 * public01 +
      180 * (latents.adaptability / 1000) +
      (roleSeedTags.includes('diplomat') ? 220 : 0) +
      (roleSeedTags.includes('operative') ? 140 : 0) +
      mobilityRng.int(0, 1000) * 0.20,
  );
  const travelEnv = geoStage1.countryPriorsBucket?.mobility01k?.travelFrequency;
  const travelScore = travelEnv != null
    ? clampFixed01k(0.50 * travelEnv + 0.50 * travelModelScoreRaw)
    : travelModelScoreRaw;

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 8: Capabilities (aptitudes, traits, skills)
  // ─────────────────────────────────────────────────────────────────────────
  const capabilitiesResult = computeCapabilities({
    seed,
    vocab,
    latents,
    roleSeedTags,
    tierBand,
    buildTag: appearanceResult.buildTag,
    heightBand: appearanceResult.heightBand,
    voiceTag: appearanceResult.voiceTag,
    careerTrackTag: identityResult.careerTrackTag,
    securityEnv01k,
    travelScore,
    trace,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 9: Psychology
  // ─────────────────────────────────────────────────────────────────────────
  const psychologyResult = computePsychology({
    seed,
    vocab,
    latents,
    aptitudes: capabilitiesResult.aptitudes,
    traits: capabilitiesResult.traits,
    tierBand,
    roleSeedTags,
    careerTrackTag: identityResult.careerTrackTag,
    heightBand: appearanceResult.heightBand,
    trace,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Compute derived: vice tendency (used by preferences, lifestyle, simulation)
  // ─────────────────────────────────────────────────────────────────────────
  const viceTendency =
    0.30 * risk01 +
    0.22 * (1 - opsec01) +
    0.20 * (1 - capabilitiesResult.traits.conscientiousness / 1000) +
    0.12 * public01 +
    0.08 * (latents.stressReactivity / 1000) +
    0.08 * (1 - latents.impulseControl / 1000);
  if (trace) trace.derived.viceTendency = viceTendency;

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 10: Preferences
  // ─────────────────────────────────────────────────────────────────────────
  // Get language environments for preferences
  const getLanguageEnv01k = (iso3: string): Record<string, Fixed> | null => {
    const bucket = input.priors?.countries?.[iso3]?.buckets?.[String(geoStage1.cohortBucketStartYear)];
    const env = bucket?.languages01k;
    return env && typeof env === 'object' ? (env as Record<string, Fixed>) : null;
  };
  const homeLangEnv01k = getLanguageEnv01k(geoStage1.homeCountryIso3);
  const citizenshipLangEnv01k = geoStage2.citizenshipCountryIso3 !== geoStage1.homeCountryIso3
    ? getLanguageEnv01k(geoStage2.citizenshipCountryIso3)
    : null;
  const currentLangEnv01k = geoStage2.currentCountryIso3 !== geoStage1.homeCountryIso3
    ? getLanguageEnv01k(geoStage2.currentCountryIso3)
    : null;

  const preferencesResult = computePreferences({
    seed,
    vocab,
    trace,
    tierBand,
    latents: {
      publicness: latents.publicness,
      opsecDiscipline: latents.opsecDiscipline,
      institutionalEmbeddedness: latents.institutionalEmbeddedness,
      stressReactivity: latents.stressReactivity,
      impulseControl: latents.impulseControl,
      aestheticExpressiveness: latents.aestheticExpressiveness,
      frugality: latents.frugality,
      socialBattery: latents.socialBattery,
      riskAppetite: latents.riskAppetite,
    },
    traits: capabilitiesResult.traits,
    aptitudes: capabilitiesResult.aptitudes,
    age,
    homeCountryIso3: geoStage1.homeCountryIso3,
    citizenshipCountryIso3: geoStage2.citizenshipCountryIso3,
    currentCountryIso3: geoStage2.currentCountryIso3,
    abroad: geoStage2.abroad,
    cosmo01,
    cultureTraditionalism01: geoStage2.cultureTraditionalism01,
    cultureMediaOpenness01: geoStage2.cultureMediaOpenness01,
    primaryWeights: geoStage2.primaryWeights,
    climateIndicators: geoStage1.climateIndicators,
    macroCulture: vocab.cultureProfiles?.[geoStage1.homeCulture] ?? null,
    microProfiles: geoStage2.microProfiles,
    countryPriorsBucket: geoStage1.countryPriorsBucket ? {
      foodEnvironment01k: geoStage1.countryPriorsBucket.foodEnvironment01k,
      mediaEnvironment01k: geoStage1.countryPriorsBucket.mediaEnvironment01k,
      languages01k: geoStage1.countryPriorsBucket.languages01k,
    } : undefined,
    homeLangEnv01k,
    citizenshipLangEnv01k,
    currentLangEnv01k,
    cohortBucketStartYear: geoStage1.cohortBucketStartYear,
    // Health inputs - need to compute these early or pass defaults
    chronicConditionTags: [],
    allergyTags: [],
    // Career/role inputs
    careerTrackTag: identityResult.careerTrackTag,
    roleSeedTags,
    // Visibility metrics - compute early approximations
    publicVisibility: psychologyResult.visibility.publicVisibility,
    paperTrail: psychologyResult.visibility.paperTrail,
    securityPressure01k: securityEnv01k?.conflict ?? 200 as Fixed,
    // Vice tendency (computed above)
    viceTendency,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 11: Social
  // ─────────────────────────────────────────────────────────────────────────
  const socialResult = computeSocial({
    seed,
    vocab,
    latents,
    tierBand,
    age,
    roleSeedTags,
    trace,
    homeCountryIso3: geoStage1.homeCountryIso3,
    currentCountryIso3: geoStage2.currentCountryIso3,
    securityPressure01k: securityEnv01k?.conflict,
    cosmo01,
    opsec01,
    inst01,
    principledness01: latents.principledness / 1000,
    aptitudes: {
      deceptionAptitude: capabilitiesResult.aptitudes.deceptionAptitude,
      cognitiveSpeed: capabilitiesResult.aptitudes.cognitiveSpeed,
      empathy: capabilitiesResult.aptitudes.empathy,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 12: Lifestyle
  // ─────────────────────────────────────────────────────────────────────────
  const lifestyleResult = computeLifestyle({
    seed,
    vocab,
    priors: input.priors,
    age,
    tierBand,
    homeCountryIso3: geoStage1.homeCountryIso3,
    cohortBucketStartYear: geoStage1.cohortBucketStartYear,
    latents,
    cosmo01,
    inst01,
    risk01,
    opsec01,
    public01,
    traits: capabilitiesResult.traits,
    aptitudes: {
      endurance: capabilitiesResult.aptitudes.endurance,
      attentionControl: capabilitiesResult.aptitudes.attentionControl,
    },
    roleSeedTags,
    careerTrackTag: identityResult.careerTrackTag,
    countryPriorsBucket: geoStage1.countryPriorsBucket,
    restrictions: preferencesResult.food.restrictions,
    publicVisibility: psychologyResult.visibility.publicVisibility,
    paperTrail: psychologyResult.visibility.paperTrail,
    attentionResilience: preferencesResult.media.attentionResilience,
    doomscrollingRisk: preferencesResult.media.doomscrollingRisk,
    securityPressure01k: geoStage1.countryPriorsBucket?.securityEnvironment01k?.conflict ?? 500 as Fixed,
    conflictEnv01k: geoStage1.countryPriorsBucket?.securityEnvironment01k?.conflict ?? 500 as Fixed,
    stateViolenceEnv01k: geoStage1.countryPriorsBucket?.securityEnvironment01k?.stateViolence ?? 500 as Fixed,
    viceTendency,
    travelScore,
    trace,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 13: Narrative
  // ─────────────────────────────────────────────────────────────────────────
  const narrativeResult = computeNarrative({
    seed,
    vocab,
    age,
    birthYear,
    homeCountryIso3: geoStage1.homeCountryIso3,
    currentCountryIso3: geoStage2.currentCountryIso3,
    tierBand,
    originTierBand: geoStage1.originTierBand,
    educationTrackTag: identityResult.educationTrackTag,
    careerTrackTag: identityResult.careerTrackTag,
    roleSeedTags,
    homeCulture: geoStage1.homeCulture,
    languages: identityResult.languages,
    spiritualityAffiliationTag: lifestyleResult.spirituality.affiliationTag,
    backgroundAdversityTags: lifestyleResult.background.adversityTags,
    urbanicity: socialResult.geography.urbanicity,
    originRegion: socialResult.geography.originRegion,
    diasporaStatus: socialResult.geography.diasporaStatus,
    trace,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 14: Simulation (deep sim preview)
  // ─────────────────────────────────────────────────────────────────────────
  // Compute average skill value for competence need
  const skillValues = Object.values(capabilitiesResult.skills).map(s => s.value);
  const averageSkillValue01k = skillValues.length > 0
    ? clampFixed01k(skillValues.reduce((a, b) => a + b, 0) / skillValues.length)
    : 500 as Fixed;

  const simulationResult = computeSimulation({
    seed,
    vocab,
    latents,
    traits: capabilitiesResult.traits,
    aptitudes: {
      attentionControl: capabilitiesResult.aptitudes.attentionControl,
      deceptionAptitude: capabilitiesResult.aptitudes.deceptionAptitude,
    },
    vices: lifestyleResult.vices,
    health: lifestyleResult.health,
    spirituality: lifestyleResult.spirituality,
    network: socialResult.network,
    tierBand,
    age,
    cosmo01,
    inst01,
    risk01,
    opsec01,
    public01,
    publicVisibility: psychologyResult.visibility.publicVisibility,
    paperTrail: psychologyResult.visibility.paperTrail,
    digitalHygiene: psychologyResult.visibility.digitalHygiene,
    attentionResilience: preferencesResult.media.attentionResilience,
    doomscrollingRisk: preferencesResult.media.doomscrollingRisk,
    statusSignaling: preferencesResult.fashion.statusSignaling,
    securityPressure01k: geoStage1.countryPriorsBucket?.securityEnvironment01k?.conflict ?? 500 as Fixed,
    averageSkillValue01k,
    roleSeedTags,
    careerTrackTag: identityResult.careerTrackTag,
    homeCountryIso3: geoStage1.homeCountryIso3,
    currentCountryIso3: geoStage2.currentCountryIso3,
    recoveryRituals: preferencesResult.routines.recoveryRituals,
    viceTendency,
    trace,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 15: Elite Compensators (not in facets - compute inline)
  // ─────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'compensators');
  const eliteCompensators: EliteCompensator[] = [];
  if (tierBand === 'elite') {
    const avgAptitude = (
      capabilitiesResult.aptitudes.cognitiveSpeed +
      capabilitiesResult.aptitudes.attentionControl +
      capabilitiesResult.aptitudes.workingMemory +
      capabilitiesResult.aptitudes.charisma +
      capabilitiesResult.aptitudes.empathy +
      capabilitiesResult.aptitudes.assertiveness
    ) / 6;

    if (avgAptitude < 550) {
      const compensatorRng = makeRng(facetSeed(seed, 'compensators'));
      const compensatorPool: Array<{ item: EliteCompensator; weight: number }> = [
        { item: 'patronage', weight: 1.5 + 1.0 * (geoStage1.originTierBand === 'elite' ? 1 : 0) },
        { item: 'dynasty', weight: 1.0 + 2.0 * (geoStage1.originTierBand === 'elite' && geoStage1.socioeconomicMobility === 'stable' ? 1 : 0) },
        { item: 'institutional-protection', weight: 1.0 + 1.5 * inst01 },
        { item: 'media-shield', weight: 0.8 + 1.5 * (latents.publicness / 1000) },
        { item: 'political-cover', weight: 0.8 + 1.2 * (roleSeedTags.includes('diplomat') || roleSeedTags.includes('technocrat') ? 1 : 0) },
        { item: 'wealth-buffer', weight: 1.2 + 0.8 * (1 - latents.frugality / 1000) },
      ];
      const compensatorCount = avgAptitude < 400 ? 3 : avgAptitude < 500 ? 2 : 1;
      const picked = weightedPickKUnique(compensatorRng, compensatorPool, compensatorCount) as EliteCompensator[];
      eliteCompensators.push(...picked);
    }
  }
  traceSet(trace, 'eliteCompensators', eliteCompensators, { method: 'conditionalWeightedPick', dependsOn: { tierBand } });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 16: Institution (not in facets - compute inline)
  // ─────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'institution');
  const instRng = makeRng(facetSeed(seed, 'institution'));
  const orgTypes = vocab.institution?.orgTypes ?? ['foreign-ministry', 'interior-ministry', 'defense', 'intel-agency', 'regulator', 'think-tank', 'party-apparatus', 'state-enterprise', 'ngo', 'private-security', 'media-outlet', 'academia', 'corporate', 'international-org'];
  const gradeBands = vocab.institution?.gradeBands ?? ['junior', 'mid-level', 'senior', 'executive', 'political-appointee'];
  const clearanceBands = vocab.institution?.clearanceBands ?? ['none', 'basic', 'secret', 'top-secret', 'compartmented'];
  const functionalSpecs = vocab.institution?.functionalSpecializations ?? ['regional-desk', 'intel-analysis', 'humint-ops', 'political-officer'];

  const orgTypeWeights = orgTypes.map(o => {
    let w = 1;
    if (o === 'intel-agency' && identityResult.careerTrackTag === 'intelligence') w = 50;
    if (o === 'foreign-ministry' && identityResult.careerTrackTag === 'foreign-service') w = 50;
    if (o === 'defense' && identityResult.careerTrackTag === 'military') w = 40;
    if (o === 'academia' && identityResult.careerTrackTag === 'academia') w = 50;
    if (o === 'ngo' && identityResult.careerTrackTag === 'ngo') w = 50;
    if (o === 'corporate' && identityResult.careerTrackTag === 'corporate-ops') w = 40;
    if (o === 'media-outlet' && identityResult.careerTrackTag === 'journalism') w = 50;
    if (o === 'think-tank' && roleSeedTags.includes('analyst')) w = 15;
    if (o === 'private-security' && roleSeedTags.includes('security')) w = 15;
    return { item: o as OrgType, weight: w };
  });
  const orgType = weightedPick(instRng, orgTypeWeights) as OrgType;

  const gradeWeights = gradeBands.map(g => {
    let w = 1;
    if (g === 'junior' && age < 30) w = 20;
    if (g === 'mid-level' && age >= 30 && age < 45) w = 25;
    if (g === 'senior' && age >= 40 && tierBand !== 'mass') w = 20;
    if (g === 'executive' && age >= 50 && tierBand === 'elite') w = 15;
    if (g === 'political-appointee' && tierBand === 'elite' && roleSeedTags.includes('diplomat')) w = 10;
    return { item: g as GradeBand, weight: w };
  });
  const gradeBand = weightedPick(instRng, gradeWeights) as GradeBand;

  const clearanceWeights = clearanceBands.map(c => {
    let w = 1;
    const isSecurityOrg = ['intel-agency', 'defense', 'interior-ministry'].includes(orgType);
    if (c === 'compartmented' && isSecurityOrg && gradeBand === 'senior') w = 20;
    if (c === 'top-secret' && isSecurityOrg) w = 25;
    if (c === 'secret' && isSecurityOrg) w = 30;
    if (c === 'basic' && !isSecurityOrg) w = 20;
    if (c === 'none' && (orgType === 'ngo' || orgType === 'media-outlet')) w = 30;
    return { item: c as ClearanceBand, weight: w };
  });
  const clearanceBand = weightedPick(instRng, clearanceWeights) as ClearanceBand;

  const specWeights = functionalSpecs.map(s => {
    let w = 1;
    if (roleSeedTags.includes('analyst') && ['intel-analysis', 'regional-desk', 'energy-policy', 'cyber-policy'].includes(s)) w = 10;
    if (roleSeedTags.includes('diplomat') && ['political-officer', 'economic-officer', 'public-diplomacy', 'protocol'].includes(s)) w = 10;
    if (roleSeedTags.includes('operative') && ['humint-ops', 'counterintel', 'security-ops'].includes(s)) w = 10;
    if (roleSeedTags.includes('technocrat') && ['finance-policy', 'cyber-policy', 'it-security'].includes(s)) w = 8;
    return { item: s as FunctionalSpecialization, weight: w };
  });
  const functionalSpecialization = weightedPick(instRng, specWeights) as FunctionalSpecialization;

  const yearsInService = Math.max(0, age - 22 - instRng.int(0, 5));
  const coverStatus: 'official' | 'non-official' | 'none' = roleSeedTags.includes('operative')
    ? (instRng.next01() < 0.4 ? 'non-official' : 'official')
    : 'none';

  traceSet(trace, 'institution', { orgType, gradeBand, clearanceBand, functionalSpecialization, yearsInService, coverStatus }, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 17: Personality (not in facets - compute inline)
  // ─────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'personality');
  const persRng = makeRng(facetSeed(seed, 'personality'));
  const conflictStyles = vocab.personality?.conflictStyles ?? ['avoidant', 'accommodating', 'competing', 'compromising', 'collaborative'];
  const epistemicStyles = vocab.personality?.epistemicStyles ?? ['data-driven', 'narrative-driven', 'authority-driven', 'intuitive', 'consensus-seeking'];
  const socialEnergyTags = vocab.personality?.socialEnergyTags ?? ['introvert', 'ambivert', 'extrovert'];
  const riskPostures = vocab.personality?.riskPostures ?? ['risk-averse', 'risk-neutral', 'risk-seeking', 'context-dependent'];

  const conflictWeights = conflictStyles.map(c => {
    let w = 1;
    if (c === 'avoidant' && capabilitiesResult.traits.agreeableness > 600) w = 3;
    if (c === 'competing' && capabilitiesResult.aptitudes.assertiveness > 600) w = 3;
    if (c === 'collaborative' && capabilitiesResult.traits.agreeableness > 500 && capabilitiesResult.aptitudes.empathy > 500) w = 3;
    if (c === 'compromising') w = 2;
    return { item: c as ConflictStyle, weight: w };
  });
  const conflictStyle = weightedPick(persRng, conflictWeights) as ConflictStyle;

  const epistemicWeights = epistemicStyles.map(e => {
    let w = 1;
    if (e === 'data-driven' && roleSeedTags.includes('analyst')) w = 5;
    if (e === 'narrative-driven' && (roleSeedTags.includes('media') || roleSeedTags.includes('diplomat'))) w = 4;
    if (e === 'authority-driven' && capabilitiesResult.traits.authoritarianism > 600) w = 3;
    if (e === 'intuitive' && roleSeedTags.includes('operative')) w = 3;
    if (e === 'consensus-seeking' && roleSeedTags.includes('organizer')) w = 4;
    return { item: e as EpistemicStyle, weight: w };
  });
  const epistemicStyle = weightedPick(persRng, epistemicWeights) as EpistemicStyle;

  // Wire socialEnergy to latents.socialBattery (0-1000 scale)
  // Low socialBattery (0-333) → introvert, Mid (334-666) → ambivert, High (667-1000) → extrovert
  const socialBattery01k = latents.socialBattery;
  const socialWeights = socialEnergyTags.map(s => {
    let w = 1;
    // Primary influence: latent socialBattery
    if (s === 'introvert') w = Math.max(1, 10 - socialBattery01k / 100); // Higher weight when socialBattery low
    if (s === 'extrovert') w = Math.max(1, socialBattery01k / 100);       // Higher weight when socialBattery high
    if (s === 'ambivert') w = 5; // Base weight for middle option
    // Secondary influence: role tags (additive, not replacement)
    if (s === 'introvert' && roleSeedTags.includes('analyst')) w += 2;
    if (s === 'extrovert' && (roleSeedTags.includes('diplomat') || roleSeedTags.includes('media'))) w += 2;
    return { item: s as SocialEnergy, weight: w };
  });
  const socialEnergy = weightedPick(persRng, socialWeights) as SocialEnergy;

  // Wire riskPosture to latents.riskAppetite (0-1000 scale)
  // Low riskAppetite (0-333) → risk-averse, Mid (334-666) → risk-neutral/context-dependent, High (667-1000) → risk-seeking
  const riskAppetite01k = latents.riskAppetite;
  const riskWeights = riskPostures.map(r => {
    let w = 1;
    // Primary influence: latent riskAppetite
    if (r === 'risk-averse') w = Math.max(1, 10 - riskAppetite01k / 100);  // Higher weight when riskAppetite low
    if (r === 'risk-seeking') w = Math.max(1, riskAppetite01k / 100);       // Higher weight when riskAppetite high
    if (r === 'risk-neutral') w = 4;  // Base weight for neutral
    if (r === 'context-dependent') w = 3; // Slightly less than neutral
    // Secondary influences: traits and roles (additive)
    if (r === 'risk-averse' && capabilitiesResult.traits.conscientiousness > 600) w += 2;
    if (r === 'risk-seeking' && roleSeedTags.includes('operative') && capabilitiesResult.traits.riskTolerance > 600) w += 3;
    return { item: r as RiskPosture, weight: w };
  });
  const riskPosture = weightedPick(persRng, riskWeights) as RiskPosture;

  traceSet(trace, 'personality', { conflictStyle, epistemicStyle, socialEnergy, riskPosture }, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 18: Work Style (not in facets - compute inline)
  // ─────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'workStyle');
  const workRng = makeRng(facetSeed(seed, 'workStyle'));
  const writingStyles = vocab.workStyle?.writingStyles ?? ['terse', 'verbose', 'structured', 'freeform', 'hedged', 'assertive'];
  const briefingStyles = vocab.workStyle?.briefingStyles ?? ['slides', 'memos', 'verbal', 'data-heavy', 'narrative'];
  const confidenceCalibrations = vocab.workStyle?.confidenceCalibrations ?? ['overconfident', 'underconfident', 'well-calibrated', 'variable'];

  const writingWeights = writingStyles.map(w => {
    let weight = 1;
    if (w === 'terse' && roleSeedTags.includes('operative')) weight = 3;
    if (w === 'structured' && roleSeedTags.includes('analyst')) weight = 4;
    if (w === 'hedged' && roleSeedTags.includes('analyst')) weight = 2;
    if (w === 'assertive' && roleSeedTags.includes('diplomat')) weight = 2;
    return { item: w as WritingStyle, weight };
  });
  const writingStyle = weightedPick(workRng, writingWeights) as WritingStyle;

  const briefingWeights = briefingStyles.map(b => {
    let w = 1;
    if (b === 'slides' && age < 40) w = 3;
    if (b === 'memos' && roleSeedTags.includes('analyst')) w = 4;
    if (b === 'verbal' && roleSeedTags.includes('operative')) w = 3;
    if (b === 'data-heavy' && epistemicStyle === 'data-driven') w = 4;
    if (b === 'narrative' && epistemicStyle === 'narrative-driven') w = 4;
    return { item: b as BriefingStyle, weight: w };
  });
  const briefingStyle = weightedPick(workRng, briefingWeights) as BriefingStyle;

  const calibrationWeights = confidenceCalibrations.map(c => {
    let w = 1;
    if (c === 'overconfident' && tierBand === 'elite') w = 2;
    if (c === 'well-calibrated' && age > 40) w = 3;
    if (c === 'underconfident' && age < 30) w = 2;
    if (c === 'variable') w = 2;
    return { item: c as ConfidenceCalibration, weight: w };
  });
  const confidenceCalibration = weightedPick(workRng, calibrationWeights) as ConfidenceCalibration;

  const jargonDensity = band5From01k(workRng.int(200, 800) as Fixed);
  const meetingTolerance = band5From01k(
    clampFixed01k(
      500 +
        (socialEnergy === 'extrovert' ? 200 : socialEnergy === 'introvert' ? -200 : 0) +
        (roleSeedTags.includes('diplomat') ? 150 : 0) +
        workRng.int(-100, 100)
    )
  );

  traceSet(trace, 'workStyle', { writingStyle, briefingStyle, confidenceCalibration, jargonDensity, meetingTolerance }, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 19: Culture Axes (not in facets - compute inline)
  // ─────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'culture');
  const cultureRng = makeRng(facetSeed(seed, 'culture'));

  // Extract geography data we need
  const urbanicity = socialResult.geography.urbanicity;
  const diasporaStatus = socialResult.geography.diasporaStatus;

  // Ethnolinguistic heritage - based on home culture with some variation
  const ethnicTags = vocab.cultureAxes?.ethnolinguisticTags ?? [
    'anglo-american', 'western-european', 'eastern-european', 'scandinavian',
    'han-chinese', 'korean', 'japanese', 'southeast-asian', 'south-asian',
    'middle-eastern', 'north-african', 'sub-saharan-african', 'latin-american',
    'mixed-heritage', 'third-culture'
  ];
  const ethnicWeights = ethnicTags.map(tag => {
    let w = 1;
    // This is simplified - ideally would use homeCulture to derive weights
    // 'native' means not diaspora; any other status indicates some migration/diaspora
    if (tag === 'third-culture' && diasporaStatus !== 'native' && cosmo01 > 0.6) w = 15;
    if (tag === 'mixed-heritage' && diasporaStatus !== 'native') w = 8;
    return { item: tag as EthnolinguisticHeritage, weight: w };
  });
  const ethnolinguisticHeritage = weightedPick(cultureRng, ethnicWeights) as EthnolinguisticHeritage;

  // Regional socialization
  const regionalTags = vocab.cultureAxes?.regionalTags ?? [
    'global-city-core', 'global-city-periphery', 'national-capital', 'secondary-city',
    'small-town', 'rural-agricultural', 'rural-remote', 'diplomatic-circuit',
    'military-base', 'expat-compound', 'diaspora-enclave', 'diaspora-assimilated',
    'diaspora-bicultural', 'returnee'
  ];
  const regionalWeights = regionalTags.map(tag => {
    let w = 1;
    // Map Urbanicity values: 'capital'/'megacity' for urban, 'secondary-city' for semi-urban
    if (tag === 'global-city-core' && (urbanicity === 'capital' || urbanicity === 'megacity') && tierBand === 'elite') w = 30;
    if (tag === 'global-city-periphery' && (urbanicity === 'capital' || urbanicity === 'megacity') && tierBand === 'middle') w = 25;
    if (tag === 'national-capital' && urbanicity === 'capital') w = 15;
    if (tag === 'secondary-city' && urbanicity === 'secondary-city') w = 20;
    if (tag === 'small-town' && urbanicity === 'small-town') w = 30;
    if (tag === 'rural-agricultural' && urbanicity === 'rural') w = 25;
    if (tag === 'rural-remote' && urbanicity === 'rural') w = 10;
    if (tag === 'diplomatic-circuit' && identityResult.careerTrackTag === 'foreign-service') w = 40;
    if (tag === 'military-base' && identityResult.careerTrackTag === 'military') w = 30;
    if (tag === 'expat-compound' && diasporaStatus === 'expat') w = 40;
    // Map DiasporaStatus: 'diaspora-child' represents diaspora generations
    if (tag === 'diaspora-enclave' && diasporaStatus === 'diaspora-child') w = 35;
    if (tag === 'diaspora-assimilated' && diasporaStatus === 'diaspora-child') w = 30;
    if (tag === 'diaspora-bicultural' && diasporaStatus !== 'native') w = 20;
    // No 'returnee' in DiasporaStatus type - could be internal-migrant returning
    if (tag === 'returnee' && diasporaStatus === 'internal-migrant') w = 25;
    return { item: tag as RegionalSocialization, weight: w };
  });
  const regionalSocialization = weightedPick(cultureRng, regionalWeights) as RegionalSocialization;

  // Institutional culture
  const institutionalTags = vocab.cultureAxes?.institutionalTags ?? [
    'military-enlisted', 'military-officer', 'intelligence', 'diplomatic-service', 'civil-service',
    'academic', 'corporate-finance', 'corporate-tech', 'ngo-humanitarian', 'journalist', 'think-tank'
  ];
  const institutionalWeights = institutionalTags.map(tag => {
    let w = 1;
    if (tag === 'military-officer' && identityResult.careerTrackTag === 'military' && gradeBand !== 'junior') w = 40;
    if (tag === 'military-enlisted' && identityResult.careerTrackTag === 'military' && gradeBand === 'junior') w = 40;
    if (tag === 'intelligence' && identityResult.careerTrackTag === 'intelligence') w = 50;
    if (tag === 'diplomatic-service' && identityResult.careerTrackTag === 'foreign-service') w = 50;
    if (tag === 'civil-service' && identityResult.careerTrackTag === 'civil-service') w = 40;
    if (tag === 'academic' && identityResult.careerTrackTag === 'academia') w = 50;
    if (tag === 'ngo-humanitarian' && identityResult.careerTrackTag === 'ngo') w = 40;
    if (tag === 'journalist' && identityResult.careerTrackTag === 'journalism') w = 50;
    if (tag === 'think-tank' && roleSeedTags.includes('analyst') && orgType === 'think-tank') w = 40;
    if (tag === 'corporate-finance' && orgType === 'corporate' && roleSeedTags.includes('technocrat')) w = 30;
    if (tag === 'corporate-tech' && orgType === 'corporate' && roleSeedTags.includes('analyst')) w = 25;
    return { item: tag as InstitutionalCulture, weight: w };
  });
  const institutionalCulture = weightedPick(cultureRng, institutionalWeights) as InstitutionalCulture;

  // Culture axis weights
  // 'native' = not diaspora, 'diaspora-child' = later generations more assimilated
  const baseEthnicWeight = diasporaStatus === 'native' ? 700 : (diasporaStatus === 'diaspora-child' ? 400 : 550);
  const baseRegionalWeight = 500;
  const baseInstitutionalWeight = yearsInService > 10 ? 700 : (yearsInService > 5 ? 550 : 400);

  const cultureWeights = {
    ethnolinguistic: clampFixed01k(baseEthnicWeight + cultureRng.int(-150, 150)),
    regional: clampFixed01k(baseRegionalWeight + cultureRng.int(-200, 200)),
    institutional: clampFixed01k(baseInstitutionalWeight + cultureRng.int(-150, 150)),
  };

  const cultureAxes: CultureAxes = {
    ethnolinguistic: ethnolinguisticHeritage,
    regional: regionalSocialization,
    institutional: institutionalCulture,
    weights: cultureWeights,
  };

  traceSet(trace, 'culture', cultureAxes, { method: 'weighted', dependsOn: { homeCulture: geoStage1.homeCulture, urbanicity, diasporaStatus, careerTrackTag: identityResult.careerTrackTag, orgType, yearsInService } });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 15: New Facets (motivations, attachment, economics, secrets, etc.)
  // ─────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'new_facets');
  const newFacetsRng = makeRng(facetSeed(seed, 'new_facets'));

  // --- Motivations & Goals ---
  const goalTypes: GoalType[] = ['career', 'financial', 'relational', 'creative', 'legacy', 'security', 'freedom', 'mastery', 'recognition', 'service'];
  const fearTypes: FearType[] = ['failure', 'exposure', 'abandonment', 'loss-of-control', 'irrelevance', 'poverty', 'violence', 'humiliation', 'betrayal', 'mortality'];

  // Primary goal influenced by tier, career, and latents
  const primaryGoalWeights = goalTypes.map(g => {
    let w = 1;
    if (g === 'financial' && tierBand === 'mass') w += 3;
    if (g === 'security' && tierBand === 'mass') w += 2;
    if (g === 'legacy' && tierBand === 'elite') w += 3;
    if (g === 'recognition' && latents.publicness > 600) w += 2;
    if (g === 'mastery' && roleSeedTags.includes('analyst')) w += 2;
    if (g === 'career' && age < 40) w += 2;
    if (g === 'relational' && socialResult.family.maritalStatus === 'single') w += 1;
    if (g === 'freedom' && latents.institutionalEmbeddedness < 400) w += 2;
    if (g === 'service' && latents.principledness > 700) w += 2;
    return { item: g, weight: w };
  });
  const primaryGoal = weightedPick(newFacetsRng, primaryGoalWeights) as GoalType;

  // Secondary goals (1-2, different from primary)
  const remainingGoals = goalTypes.filter(g => g !== primaryGoal);
  const numSecondary = newFacetsRng.int(1, 3);
  const secondaryGoals = weightedPickKUnique(newFacetsRng, remainingGoals.map(g => ({ item: g, weight: 1 })), numSecondary) as GoalType[];

  // Fears influenced by background and psychology
  const fearWeights = fearTypes.map(f => {
    let w = 1;
    if (f === 'exposure' && roleSeedTags.includes('operative')) w += 3;
    if (f === 'poverty' && geoStage1.originTierBand === 'mass') w += 2;
    if (f === 'abandonment' && lifestyleResult.background.adversityTags.includes('family-instability')) w += 2;
    if (f === 'failure' && latents.principledness > 600) w += 2;
    if (f === 'irrelevance' && age > 50) w += 2;
    if (f === 'violence' && lifestyleResult.background.adversityTags.some(t => t.includes('conflict') || t.includes('violence'))) w += 2;
    if (f === 'humiliation' && latents.publicness > 500) w += 1;
    if (f === 'betrayal' && narrativeResult.timeline.some(e => e.type === 'betrayal')) w += 3;
    return { item: f, weight: w };
  });
  const fears = weightedPickKUnique(newFacetsRng, fearWeights, newFacetsRng.int(1, 3)) as FearType[];

  // Core need narrative
  const coreNeedTemplates = [
    `To prove ${primaryGoal === 'recognition' ? 'their worth' : primaryGoal === 'mastery' ? 'their competence' : 'themselves'}`,
    `To find ${primaryGoal === 'relational' ? 'connection' : primaryGoal === 'security' ? 'stability' : 'meaning'}`,
    `To escape ${fears[0] === 'poverty' ? 'scarcity' : fears[0] === 'failure' ? 'mediocrity' : 'the past'}`,
    `To build something ${primaryGoal === 'legacy' ? 'lasting' : primaryGoal === 'creative' ? 'original' : 'real'}`,
  ];
  const coreNeed = newFacetsRng.pick(coreNeedTemplates);

  const motivations = { primaryGoal, secondaryGoals, fears, coreNeed };
  traceSet(trace, 'motivations', motivations, { method: 'weighted', dependsOn: { tierBand, roleSeedTags, age } });

  // --- Attachment Style ---
  const attachmentStyles: AttachmentStyle[] = ['secure', 'anxious-preoccupied', 'dismissive-avoidant', 'fearful-avoidant'];
  const attachmentWeights = attachmentStyles.map(a => {
    let w = 1;
    // ~50% secure in general population
    if (a === 'secure') w = 10;
    if (a === 'anxious-preoccupied') w = 4;
    if (a === 'dismissive-avoidant') w = 4;
    if (a === 'fearful-avoidant') w = 2;
    // Adversity increases insecure attachment
    if (a !== 'secure' && lifestyleResult.background.adversityTags.length > 0) w += 2;
    // Operatives trend avoidant
    if ((a === 'dismissive-avoidant' || a === 'fearful-avoidant') && roleSeedTags.includes('operative')) w += 2;
    return { item: a, weight: w };
  });
  const attachmentStyle = weightedPick(newFacetsRng, attachmentWeights) as AttachmentStyle;
  traceSet(trace, 'attachmentStyle', attachmentStyle, { method: 'weighted', dependsOn: { adversity: lifestyleResult.background.adversityTags.length, roleSeedTags } });

  // --- Economics ---
  const debtLevels: DebtLevel[] = ['none', 'manageable', 'strained', 'crushing', 'default'];
  const debtWeights = debtLevels.map(d => {
    let w = 1;
    if (d === 'none' && tierBand === 'elite') w = 10;
    if (d === 'manageable' && tierBand === 'middle') w = 8;
    if (d === 'strained' && tierBand === 'mass') w = 5;
    if (d === 'crushing' && tierBand === 'mass') w = 2;
    if (d === 'default') w = 0.5; // rare
    if (d === 'none' && tierBand === 'mass') w = 2;
    if (d === 'manageable' && tierBand === 'elite') w = 3;
    return { item: d, weight: w };
  });
  const debtLevel = weightedPick(newFacetsRng, debtWeights) as DebtLevel;

  const incomeStabilities: IncomeStability[] = ['unstable', 'variable', 'stable', 'guaranteed', 'independent'];
  const incomeWeights = incomeStabilities.map(i => {
    let w = 1;
    if (i === 'guaranteed' && (orgType.includes('ministry') || orgType === 'intel-agency')) w = 8;
    if (i === 'stable' && orgType === 'corporate') w = 6;
    if (i === 'independent' && tierBand === 'elite') w = 5;
    if (i === 'variable' && orgType === 'ngo' || orgType === 'media-outlet') w = 4;
    if (i === 'unstable' && tierBand === 'mass' && age < 30) w = 3;
    return { item: i, weight: w };
  });
  const incomeStability = weightedPick(newFacetsRng, incomeWeights) as IncomeStability;

  // Financial anxiety based on debt and income
  let financialAnxiety01k = 300; // baseline
  if (debtLevel === 'crushing') financialAnxiety01k += 400;
  if (debtLevel === 'strained') financialAnxiety01k += 200;
  if (incomeStability === 'unstable') financialAnxiety01k += 200;
  if (tierBand === 'elite') financialAnxiety01k -= 200;
  if (latents.frugality > 700) financialAnxiety01k -= 100;
  financialAnxiety01k = clampFixed01k(financialAnxiety01k + newFacetsRng.int(-100, 100));

  const spendingStyles = ['frugal', 'measured', 'generous', 'impulsive', 'status-driven'] as const;
  const spendingWeights = spendingStyles.map(s => {
    let w = 1;
    if (s === 'frugal' && latents.frugality > 600) w += 4;
    if (s === 'measured' && latents.impulseControl > 500) w += 3;
    if (s === 'impulsive' && latents.impulseControl < 400) w += 3;
    if (s === 'status-driven' && tierBand === 'elite') w += 2;
    if (s === 'generous' && latents.socialBattery > 600) w += 2;
    return { item: s, weight: w };
  });
  const spendingStyle = weightedPick(newFacetsRng, spendingWeights) as typeof spendingStyles[number];

  const economics = { debtLevel, incomeStability, financialAnxiety01k, spendingStyle };
  traceSet(trace, 'economics', economics, { method: 'weighted', dependsOn: { tierBand, orgType, latents: { frugality: latents.frugality } } });

  // --- Secrets ---
  const secretTypes: SecretType[] = ['identity', 'relationship', 'financial', 'health', 'criminal', 'political', 'professional', 'family', 'addiction', 'belief'];
  const secretSeverities: SecretSeverity[] = ['embarrassing', 'damaging', 'career-ending', 'criminal', 'life-threatening'];
  const knownByOptions = ['no-one', 'partner', 'family', 'close-friends', 'employer', 'public'];

  // Most people have 0-2 secrets
  const numSecrets = newFacetsRng.next01() < 0.3 ? 0 : newFacetsRng.int(1, 3);
  const secrets: Array<{ type: SecretType; severity: SecretSeverity; knownBy: string[]; narrativeHook: string }> = [];

  for (let i = 0; i < numSecrets; i++) {
    const secretTypeWeights = secretTypes.map(s => {
      let w = 1;
      if (s === 'relationship' && socialResult.family.maritalStatus !== 'single') w += 2;
      if (s === 'financial' && debtLevel === 'crushing') w += 3;
      if (s === 'addiction' && lifestyleResult.vices.length > 0) w += 2;
      if (s === 'identity' && roleSeedTags.includes('operative')) w += 3;
      if (s === 'political' && roleSeedTags.includes('analyst')) w += 1;
      return { item: s, weight: w };
    });
    const secretType = weightedPick(newFacetsRng, secretTypeWeights) as SecretType;

    const severityWeights = secretSeverities.map(s => {
      let w = 1;
      if (s === 'embarrassing') w = 5;
      if (s === 'damaging') w = 3;
      if (s === 'career-ending') w = 1.5;
      if (s === 'criminal') w = 0.5;
      if (s === 'life-threatening') w = 0.2;
      return { item: s, weight: w };
    });
    const severity = weightedPick(newFacetsRng, severityWeights) as SecretSeverity;

    // Who knows - more severe = fewer people know
    const knownByCount = severity === 'life-threatening' ? 0 : severity === 'criminal' ? newFacetsRng.int(0, 1) : newFacetsRng.int(0, 3);
    const knownBy = knownByCount === 0 ? ['no-one'] : weightedPickKUnique(newFacetsRng, knownByOptions.slice(1).map(k => ({ item: k, weight: 1 })), knownByCount);

    const narrativeHooks: Record<SecretType, string[]> = {
      'identity': ['Has a hidden past identity', 'Not who they claim to be', 'Conceals their true origins'],
      'relationship': ['Maintains a secret affair', 'Has an estranged family member', 'Secret unrequited feelings'],
      'financial': ['Hidden debts', 'Unexplained wealth source', 'Secret gambling losses'],
      'health': ['Conceals a diagnosis', 'Secret addiction', 'Hidden disability'],
      'criminal': ['Past crime never caught', 'Ongoing illegal activity', 'Covered up an incident'],
      'political': ['Secret political beliefs', 'Hidden party membership', 'Covert activism'],
      'professional': ['Fabricated credentials', 'Covered up a failure', 'Secret side business'],
      'family': ['Hidden family scandal', 'Secret child', 'Concealed family history'],
      'addiction': ['Hidden substance use', 'Secret behavioral addiction', 'Concealed recovery status'],
      'belief': ['Secret religious conversion', 'Hidden atheism', 'Concealed philosophical views'],
    };
    const narrativeHook = newFacetsRng.pick(narrativeHooks[secretType]);

    secrets.push({ type: secretType, severity, knownBy, narrativeHook });
  }
  traceSet(trace, 'secrets', secrets, { method: 'random', dependsOn: { numSecrets } });

  // --- Humor Style ---
  const humorStyles: HumorStyle[] = ['dry-wit', 'self-deprecating', 'observational', 'dark', 'slapstick', 'wordplay', 'deadpan', 'none'];
  const humorWeights = humorStyles.map(h => {
    let w = 1;
    if (h === 'dry-wit' && latents.opsecDiscipline > 500) w += 2;
    if (h === 'self-deprecating' && latents.socialBattery > 400 && latents.socialBattery < 700) w += 2;
    if (h === 'dark' && roleSeedTags.includes('operative')) w += 2;
    if (h === 'observational' && roleSeedTags.includes('analyst')) w += 2;
    if (h === 'none' && latents.socialBattery < 300) w += 2;
    if (h === 'deadpan' && conflictStyle === 'avoidant') w += 1;
    if (h === 'wordplay' && identityResult.languageProficiencies.length > 1) w += 1;
    return { item: h, weight: w };
  });
  const humorStyle = weightedPick(newFacetsRng, humorWeights) as HumorStyle;
  traceSet(trace, 'humorStyle', humorStyle, { method: 'weighted', dependsOn: { socialBattery: latents.socialBattery, roleSeedTags } });

  // --- Pressure Response ---
  const pressureResponses: PressureResponse[] = ['freezes', 'deliberates', 'delegates', 'rushes', 'thrives', 'avoids'];
  const pressureWeights = pressureResponses.map(p => {
    let w = 1;
    if (p === 'thrives' && roleSeedTags.includes('operative')) w += 3;
    if (p === 'deliberates' && roleSeedTags.includes('analyst')) w += 3;
    if (p === 'freezes' && latents.stressReactivity > 700) w += 3;
    if (p === 'rushes' && latents.impulseControl < 400) w += 2;
    if (p === 'delegates' && gradeBand === 'senior' || gradeBand === 'executive') w += 2;
    if (p === 'avoids' && conflictStyle === 'avoidant') w += 2;
    return { item: p, weight: w };
  });
  const pressureResponse = weightedPick(newFacetsRng, pressureWeights) as PressureResponse;
  traceSet(trace, 'pressureResponse', pressureResponse, { method: 'weighted', dependsOn: { stressReactivity: latents.stressReactivity, roleSeedTags } });

  // --- Physical Presence ---
  const gaitStyles: GaitStyle[] = ['brisk', 'measured', 'slouching', 'military', 'graceful', 'heavy', 'nervous'];
  const gaitWeights = gaitStyles.map(g => {
    let w = 1;
    if (g === 'military' && (orgType === 'defense' || roleSeedTags.includes('operative'))) w += 4;
    if (g === 'brisk' && latents.physicalConditioning > 600) w += 2;
    if (g === 'graceful' && appearanceResult.buildTag === 'slim') w += 2;
    if (g === 'heavy' && appearanceResult.buildTag === 'heavy') w += 3;
    if (g === 'nervous' && latents.stressReactivity > 600) w += 2;
    if (g === 'slouching' && age > 50) w += 1;
    if (g === 'measured' && latents.opsecDiscipline > 600) w += 2;
    return { item: g, weight: w };
  });
  const gait = weightedPick(newFacetsRng, gaitWeights) as GaitStyle;

  const eyePatterns: EyeContactPattern[] = ['steady', 'avoidant', 'intense', 'darting', 'warm', 'cold'];
  const eyeWeights = eyePatterns.map(e => {
    let w = 1;
    if (e === 'steady' && latents.opsecDiscipline > 600) w += 2;
    if (e === 'avoidant' && socialEnergy === 'introvert') w += 3;
    if (e === 'intense' && roleSeedTags.includes('operative')) w += 2;
    if (e === 'warm' && capabilitiesResult.aptitudes.empathy > 600) w += 2;
    if (e === 'cold' && capabilitiesResult.aptitudes.empathy < 400) w += 2;
    if (e === 'darting' && latents.stressReactivity > 700) w += 2;
    return { item: e, weight: w };
  });
  const eyeContact = weightedPick(newFacetsRng, eyeWeights) as EyeContactPattern;

  const nervousHabitOptions: NervousHabit[] = ['nail-biting', 'hair-touching', 'fidgeting', 'pacing', 'throat-clearing', 'lip-biting', 'pen-clicking', 'leg-bouncing', 'none'];
  const nervousHabitWeights = nervousHabitOptions.map(n => {
    let w = 1;
    if (n === 'none' && latents.opsecDiscipline > 700) w += 5;
    if (n === 'none' && latents.stressReactivity < 400) w += 3;
    if (n !== 'none' && latents.stressReactivity > 500) w += 2;
    return { item: n, weight: w };
  });
  const numHabits = newFacetsRng.next01() < 0.4 ? 0 : newFacetsRng.int(1, 3);
  const nervousHabits = numHabits === 0 ? ['none' as NervousHabit] : weightedPickKUnique(newFacetsRng, nervousHabitWeights.filter(w => w.item !== 'none'), numHabits) as NervousHabit[];

  const personalSpacePrefs = ['close', 'normal', 'distant'] as const;
  const spaceWeights = personalSpacePrefs.map(s => {
    let w = 1;
    if (s === 'close' && latents.socialBattery > 600) w += 2;
    if (s === 'distant' && socialEnergy === 'introvert') w += 3;
    if (s === 'distant' && latents.opsecDiscipline > 600) w += 1;
    return { item: s, weight: w };
  });
  const personalSpacePref = weightedPick(newFacetsRng, spaceWeights) as typeof personalSpacePrefs[number];

  const gestureFrequency = band5From01k(clampFixed01k(latents.socialBattery + newFacetsRng.int(-200, 200)));

  const physicalPresence = { gait, eyeContact, nervousHabits, personalSpacePref, gestureFrequency };
  traceSet(trace, 'physicalPresence', physicalPresence, { method: 'weighted', dependsOn: { physicalConditioning: latents.physicalConditioning, stressReactivity: latents.stressReactivity } });

  // --- Deception Skill ---
  // Based on aptitude + practice (operatives get bonus)
  const baseDeception = capabilitiesResult.aptitudes.deceptionAptitude;
  const lyingAbility = clampFixed01k(baseDeception + (roleSeedTags.includes('operative') ? 150 : 0) + newFacetsRng.int(-100, 100));
  const tellAwareness = clampFixed01k(baseDeception * 0.8 + latents.opsecDiscipline * 0.2 + newFacetsRng.int(-50, 50));
  const detectsLies = clampFixed01k(capabilitiesResult.aptitudes.empathy * 0.5 + baseDeception * 0.3 + newFacetsRng.int(-100, 100));

  const deceptionSkill = { lyingAbility, tellAwareness, detectsLies };
  traceSet(trace, 'deceptionSkill', deceptionSkill, { method: 'computed', dependsOn: { deceptionAptitude: baseDeception, roleSeedTags } });

  // ─────────────────────────────────────────────────────────────────────────
  // Assemble final agent
  // ─────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'created_at');
  const createdAtIso = new Date().toISOString();

  const agent: GeneratedAgent = {
    version: 1,
    id: seed,
    seed,
    createdAtIso,
    generationTrace: trace,
    deepSimPreview: simulationResult,

    identity: {
      name: identityResult.name,
      homeCountryIso3: geoStage1.homeCountryIso3,
      citizenshipCountryIso3: geoStage2.citizenshipCountryIso3,
      currentCountryIso3: geoStage2.currentCountryIso3,
      homeCulture: geoStage1.homeCulture,
      birthYear,
      tierBand,
      originTierBand: geoStage1.originTierBand,
      socioeconomicMobility: geoStage1.socioeconomicMobility,
      roleSeedTags,
      languages: identityResult.languages,
      languageProficiencies: identityResult.languageProficiencies,
      educationTrackTag: identityResult.educationTrackTag,
      careerTrackTag: identityResult.careerTrackTag,
      redLines: psychologyResult.redLines,
    },

    culture: cultureAxes,

    appearance: {
      heightBand: appearanceResult.heightBand,
      buildTag: appearanceResult.buildTag,
      hair: appearanceResult.hair,
      eyes: appearanceResult.eyes,
      voiceTag: appearanceResult.voiceTag,
      distinguishingMarks: appearanceResult.distinguishingMarks,
    },

    capabilities: {
      aptitudes: capabilitiesResult.aptitudes,
      skills: capabilitiesResult.skills,
    },

    preferences: {
      food: preferencesResult.food,
      media: preferencesResult.media,
      fashion: preferencesResult.fashion,
    },

    psych: {
      traits: capabilitiesResult.traits,
      ethics: psychologyResult.ethics,
      contradictions: psychologyResult.contradictions,
    },

    network: socialResult.network,
    eliteCompensators,
    visibility: psychologyResult.visibility,
    health: lifestyleResult.health,
    covers: {
      coverAptitudeTags: psychologyResult.coverAptitudeTags,
    },
    mobility: lifestyleResult.mobility,
    routines: preferencesResult.routines,
    vices: lifestyleResult.vices,
    logistics: lifestyleResult.logistics,
    neurodivergence: lifestyleResult.neurodivergence,
    spirituality: lifestyleResult.spirituality,
    background: lifestyleResult.background,
    gender: {
      identityTag: identityResult.genderIdentityTag,
      pronounSet: identityResult.genderPronounSet,
    },
    orientation: {
      orientationTag: identityResult.orientationTag,
      outnessLevel: identityResult.outnessLevel,
    },
    naming: {
      structure: identityResult.nameStructure,
      honorificStyle: identityResult.honorificStyle,
      callSign: identityResult.callSign,
      aliases: identityResult.aliases,
      romanizedName: identityResult.romanizedName,
    },
    geography: {
      originRegion: socialResult.geography.originRegion,
      urbanicity: socialResult.geography.urbanicity,
      diasporaStatus: socialResult.geography.diasporaStatus,
    },
    family: socialResult.family,
    relationships: socialResult.relationships,
    institution: {
      orgType,
      gradeBand,
      clearanceBand,
      functionalSpecialization,
      yearsInService,
      coverStatus,
    },
    personality: {
      conflictStyle,
      epistemicStyle,
      socialEnergy,
      riskPosture,
    },
    workStyle: {
      writingStyle,
      briefingStyle,
      confidenceCalibration,
      jargonDensity,
      meetingTolerance,
    },
    timeline: narrativeResult.timeline,
    minorityStatus: narrativeResult.minorityStatus,

    // === NEW FACETS ===
    motivations,
    attachmentStyle,
    economics,
    secrets,
    humorStyle,
    pressureResponse,
    physicalPresence,
    deceptionSkill,
  };

  return agent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

// Helper types
export { type MicroProfileEntry, type PrimaryWeights, type ClimateIndicators, type ValidCountry };

// Utility functions (for use by agentGenerator.ts or future orchestrator)
export {
  initializeTrace,
  validateVocab,
  validateCountries,
  computeGeographyStage1,
  computeGeographyStage2,
  pickFromWeightedMicroProfiles,
};
// Note: computeRoleSeedTags is already exported inline

// Re-export computeLatents for convenience
export { computeLatents };
