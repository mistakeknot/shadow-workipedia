/**
 * Geography Facet - Agent origin, citizenship, and current country computation
 *
 * Handles socioeconomic origin/mobility, country selection, culture environment
 * blending, climate indicators, and microculture profile mixing.
 */

import type {
  TierBand, Fixed, SocioeconomicMobility, AgentVocabV1,
  AgentPriorsV1, AgentGenerationTraceV1, CultureProfileV1,
} from '../types';
import {
  makeRng, facetSeed, weightedPick, traceSet, traceFacet,
  deriveCultureFromContinent, clamp01, normalizeCultureEnv01k,
  mixCultureEnv01k, mixWeights01k, CultureEnv01k, CultureEnvAxis, Rng,
} from '../utils';

// ============================================================================
// Types
// ============================================================================

export type ValidCountry = { shadow: string; iso3: string; continent?: string };

export type GeographyContext = {
  seed: string;
  vocab: AgentVocabV1;
  countries: Array<{ iso3?: unknown; shadow?: unknown; continent?: unknown }>;
  priors?: AgentPriorsV1;
  tierBand: TierBand;
  birthYear: number;
  trace?: AgentGenerationTraceV1;
  homeCountryIso3?: string;
  citizenshipCountryIso3?: string;
  currentCountryIso3?: string;
  roleSeedTags: string[];
  cosmo01: number;
  adaptability01k: number;
  curiosityBandwidth01k: number;
};

export type ClimateIndicators = { hot01: number; coastal01: number; cold01: number };

export type MicroProfileEntry = { id: string; weight01k: number; profile: CultureProfileV1 };

export type PrimaryWeights = {
  namesPrimaryWeight: number;
  languagesPrimaryWeight: number;
  foodPrimaryWeight: number;
  mediaPrimaryWeight: number;
  fashionPrimaryWeight: number;
};

export type GeographyResult = {
  homeCountryIso3: string;
  citizenshipCountryIso3: string;
  currentCountryIso3: string;
  homeCulture: string;
  originTierBand: TierBand;
  socioeconomicMobility: SocioeconomicMobility;
  cohortBucketStartYear: number;
  countryPriorsBucket: AgentPriorsV1['countries'][string]['buckets'][string] | undefined;
  climateIndicators: ClimateIndicators;
  homeCultureEnv01k: CultureEnv01k | null;
  citizenshipCultureEnv01k: CultureEnv01k | null;
  currentCultureEnv01k: CultureEnv01k | null;
  cultureEnv01k: CultureEnv01k | null;
  cultureCosmo01: number;
  cultureTraditionalism01: number;
  cultureMediaOpenness01: number;
  mixing01: number;
  primaryWeights: PrimaryWeights;
  microProfiles: MicroProfileEntry[];
  microWeights01k: Record<string, Fixed> | null;
  microTop: Array<{ profileId: string; weight01k: number }>;
  microFirstNames: string[];
  microMaleFirstNames: string[];
  microFemaleFirstNames: string[];
  microLastNames: string[];
  microLanguages: string[];
  validCountries: ValidCountry[];
  cultureCountries: ValidCountry[];
  abroad: boolean;
};

// ============================================================================
// Helpers
// ============================================================================

function uniqueStrings(items: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.trim();
    if (key && !seen.has(key)) { seen.add(key); out.push(key); }
  }
  return out;
}

// ============================================================================
// Main Computation
// ============================================================================

export function computeGeography(ctx: GeographyContext): GeographyResult {
  const { seed, vocab, priors, tierBand, birthYear, trace, roleSeedTags, cosmo01 } = ctx;

  // Socioeconomic origin + mobility
  traceFacet(trace, seed, 'socioeconomic');
  const socioRng = makeRng(facetSeed(seed, 'socioeconomic'));
  const originTierWeights: Record<TierBand, Array<{ item: TierBand; weight: number }>> = {
    elite: [{ item: 'elite', weight: 0.55 }, { item: 'middle', weight: 0.35 }, { item: 'mass', weight: 0.10 }],
    middle: [{ item: 'elite', weight: 0.12 }, { item: 'middle', weight: 0.65 }, { item: 'mass', weight: 0.23 }],
    mass: [{ item: 'elite', weight: 0.03 }, { item: 'middle', weight: 0.18 }, { item: 'mass', weight: 0.79 }],
  };
  const originTierBand = weightedPick(socioRng, originTierWeights[tierBand]) as TierBand;
  const tierRank = { elite: 2, middle: 1, mass: 0 };
  const diff = tierRank[tierBand] - tierRank[originTierBand];
  const socioeconomicMobility: SocioeconomicMobility = diff > 0 ? 'upward' : diff < 0 ? 'downward' : 'stable';
  traceSet(trace, 'identity.originTierBand', originTierBand, { method: 'weightedPick', dependsOn: { tierBand } });
  traceSet(trace, 'identity.socioeconomicMobility', socioeconomicMobility, { method: 'derived', dependsOn: { tierBand, originTierBand } });

  // Country validation
  const validCountries = ctx.countries
    .map(c => ({
      shadow: String((c as { shadow?: unknown }).shadow ?? '').trim(),
      iso3: String((c as { iso3?: unknown }).iso3 ?? '').trim().toUpperCase(),
      continent: (c as { continent?: unknown }).continent ? String((c as { continent?: unknown }).continent).trim() : undefined,
    }))
    .filter((c) => c.shadow && c.iso3.length === 3)
    .sort((a, b) => a.iso3.localeCompare(b.iso3));
  if (!validCountries.length) throw new Error('Agent country map missing: no ISO3 entries');

  // Home country (origin)
  traceFacet(trace, seed, 'origin');
  const originRng = makeRng(facetSeed(seed, 'origin'));
  const forcedHomeIso3 = (ctx.homeCountryIso3 ?? '').trim().toUpperCase();
  const origin = forcedHomeIso3
    ? validCountries.find(c => c.iso3 === forcedHomeIso3) ?? originRng.pick(validCountries)
    : originRng.pick(validCountries);
  const homeCountryIso3 = origin.iso3;
  const homeCulture = deriveCultureFromContinent(origin.continent, homeCountryIso3);
  traceSet(trace, 'identity.homeCountryIso3', homeCountryIso3, {
    method: forcedHomeIso3 ? 'overrideOrFallbackPick' : 'pick',
    dependsOn: { facet: 'origin', poolSize: validCountries.length, continent: origin.continent ?? null, forcedHomeIso3: forcedHomeIso3 || null },
  });
  traceSet(trace, 'identity.homeCulture', homeCulture, { method: 'deriveCultureFromContinent', dependsOn: { continent: origin.continent ?? null, iso3: homeCountryIso3 } });

  // Country priors bucket
  const cohortBucketStartYear = Math.floor(birthYear / 10) * 10;
  const countryPriorsBucket = priors?.countries?.[homeCountryIso3]?.buckets?.[String(cohortBucketStartYear)];
  if (trace) {
    trace.derived.countryPriors = { homeCountryIso3, cohortBucketStartYear, hasPriors: !!countryPriorsBucket, indicators: countryPriorsBucket?.indicators ?? null };
  }

  // Climate indicators from food environment
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

  // Culture countries (same macro-culture as home)
  const cultureCountries = validCountries.filter((c) => deriveCultureFromContinent(c.continent, c.iso3) === homeCulture);

  // Citizenship country
  traceFacet(trace, seed, 'citizenship');
  const citizenshipRng = makeRng(facetSeed(seed, 'citizenship'));
  const citizenshipFlip = Math.min(0.65, 0.05 + 0.35 * cosmo01 + (roleSeedTags.includes('diplomat') ? 0.12 : 0) + (roleSeedTags.includes('operative') ? 0.06 : 0));
  const citizenshipOrigin = (citizenshipRng.next01() < citizenshipFlip && cultureCountries.length) ? citizenshipRng.pick(cultureCountries) : origin;
  const forcedCitizenshipIso3 = (ctx.citizenshipCountryIso3 ?? '').trim().toUpperCase();
  const citizenshipCountryIso3 = forcedCitizenshipIso3
    ? validCountries.find(c => c.iso3 === forcedCitizenshipIso3)?.iso3 ?? citizenshipOrigin.iso3
    : citizenshipOrigin.iso3;
  traceSet(trace, 'identity.citizenshipCountryIso3', citizenshipCountryIso3, {
    method: forcedCitizenshipIso3 ? 'overrideOrFallbackPick' : 'probabilisticPick',
    dependsOn: { facet: 'citizenship', citizenshipFlip, cultureCountryPoolSize: cultureCountries.length, forcedCitizenshipIso3: forcedCitizenshipIso3 || null },
  });

  // Current country
  traceFacet(trace, seed, 'current_country');
  const currentRng = makeRng(facetSeed(seed, 'current_country'));
  const roleAbroad = (roleSeedTags.includes('diplomat') ? 0.22 : 0) + (roleSeedTags.includes('media') ? 0.06 : 0) +
    (roleSeedTags.includes('technocrat') ? 0.05 : 0) + (roleSeedTags.includes('operative') ? 0.12 : 0);
  const abroadChance = Math.min(0.88, 0.06 + 0.55 * cosmo01 + 0.15 * (ctx.adaptability01k / 1000) + 0.05 * (ctx.curiosityBandwidth01k / 1000) + roleAbroad);
  const abroad = currentRng.next01() < abroadChance;
  const currentCandidatePool = cultureCountries.length ? cultureCountries : validCountries;
  const abroadPool = currentCandidatePool.filter(c => c.iso3 !== homeCountryIso3);
  const currentPick = abroad ? currentRng.pick(abroadPool.length ? abroadPool : currentCandidatePool) : origin;
  const forcedCurrentIso3 = (ctx.currentCountryIso3 ?? '').trim().toUpperCase();
  const currentCountryIso3 = forcedCurrentIso3
    ? validCountries.find(c => c.iso3 === forcedCurrentIso3)?.iso3 ?? currentPick.iso3
    : currentPick.iso3;
  traceSet(trace, 'identity.currentCountryIso3', currentCountryIso3, {
    method: forcedCurrentIso3 ? 'overrideOrFallbackPick' : 'probabilisticPick',
    dependsOn: { facet: 'current_country', abroadChance, abroad, poolSize: abroad ? (abroadPool.length || currentCandidatePool.length) : 1, forcedCurrentIso3: forcedCurrentIso3 || null },
  });

  // Culture environment blending
  const macroCulture = vocab.cultureProfiles?.[homeCulture];
  const macroCultureWeights = macroCulture?.weights ?? {};
  const getCultureEnv01k = (iso3: string): CultureEnv01k | null => {
    const bucket = priors?.countries?.[iso3]?.buckets?.[String(cohortBucketStartYear)];
    return normalizeCultureEnv01k(bucket?.cultureEnvironment01k as Partial<Record<CultureEnvAxis, Fixed>> | null | undefined);
  };
  const homeCultureEnv01k = getCultureEnv01k(homeCountryIso3);
  const citizenshipCultureEnv01k = citizenshipCountryIso3 !== homeCountryIso3 ? getCultureEnv01k(citizenshipCountryIso3) : null;
  const currentCultureEnv01k = currentCountryIso3 !== homeCountryIso3 ? getCultureEnv01k(currentCountryIso3) : null;
  const cultureEnv01k = homeCultureEnv01k
    ? mixCultureEnv01k([
        { env: homeCultureEnv01k, weight: 1 },
        ...(citizenshipCultureEnv01k ? [{ env: citizenshipCultureEnv01k, weight: 0.10 + 0.25 * cosmo01 }] : []),
        ...(currentCultureEnv01k ? [{ env: currentCultureEnv01k, weight: 0.15 + 0.35 * cosmo01 + (abroad ? 0.15 : 0) }] : []),
      ])
    : null;

  const cultureCosmo01 = clamp01((cultureEnv01k?.cosmopolitanism ?? 450) / 1000, 0.45);
  const cultureTraditionalism01 = clamp01((cultureEnv01k?.traditionalism ?? 520) / 1000, 0.52);
  const cultureMediaOpenness01 = clamp01((cultureEnv01k?.mediaOpenness ?? 650) / 1000, 0.65);
  const mixing01 = clamp01(0.55 * cosmo01 + 0.45 * cultureCosmo01, 0.5);

  // Primary weights (hybrid model for culture blending)
  const namesPrimaryWeight = clamp01((macroCultureWeights.namesPrimaryWeight ?? 0.75) - 0.55 * mixing01 + 0.10 * cultureTraditionalism01, 0.75);
  const languagesPrimaryWeight = clamp01((macroCultureWeights.languagesPrimaryWeight ?? 0.85) - 0.45 * mixing01 + 0.06 * cultureTraditionalism01, 0.85);
  const foodPrimaryWeight = clamp01((macroCultureWeights.foodPrimaryWeight ?? 0.7) - 0.25 * mixing01 + 0.12 * cultureTraditionalism01, 0.7);
  const mediaPrimaryWeight = clamp01((macroCultureWeights.mediaPrimaryWeight ?? 0.7) - 0.35 * mixing01 - 0.10 * cultureMediaOpenness01 + 0.04 * cultureTraditionalism01, 0.7);
  const fashionPrimaryWeight = clamp01((macroCultureWeights.fashionPrimaryWeight ?? 0.6) - 0.30 * mixing01 + 0.10 * cultureTraditionalism01, 0.6);

  // Microculture profile mixing
  const getMicroCultureWeights01k = (iso3: string): Record<string, Fixed> | null => {
    const bucket = priors?.countries?.[iso3]?.buckets?.[String(cohortBucketStartYear)];
    const weights = bucket?.cultureProfileWeights01k;
    return weights && typeof weights === 'object' ? (weights as Record<string, Fixed>) : null;
  };
  const homeMicroWeights01k = getMicroCultureWeights01k(homeCountryIso3);
  const citizenshipMicroWeights01k = citizenshipCountryIso3 !== homeCountryIso3 ? getMicroCultureWeights01k(citizenshipCountryIso3) : null;
  const currentMicroWeights01k = currentCountryIso3 !== homeCountryIso3 ? getMicroCultureWeights01k(currentCountryIso3) : null;
  const microWeights01k = homeMicroWeights01k
    ? mixWeights01k([
        { weights: homeMicroWeights01k, weight: 1 },
        ...(citizenshipMicroWeights01k ? [{ weights: citizenshipMicroWeights01k, weight: 0.10 + 0.25 * cosmo01 }] : []),
        ...(currentMicroWeights01k ? [{ weights: currentMicroWeights01k, weight: 0.15 + 0.35 * cosmo01 + (abroad ? 0.15 : 0) }] : []),
      ])
    : null;
  const microTop = microWeights01k
    ? Object.entries(microWeights01k)
        .map(([profileId, weight01k]) => ({ profileId, weight01k: Number(weight01k) }))
        .filter(x => x.profileId && Number.isFinite(x.weight01k) && x.weight01k > 0)
        .sort((a, b) => (b.weight01k - a.weight01k) || a.profileId.localeCompare(b.profileId))
        .slice(0, 6)
    : [];
  const microProfiles = microTop
    .map(({ profileId, weight01k }) => ({ id: profileId, weight01k, profile: vocab.microCultureProfiles?.[profileId] }))
    .filter((x): x is MicroProfileEntry => !!x.profile);
  const microFirstNames = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.firstNames ?? []));
  const microMaleFirstNames = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.maleFirstNames ?? []));
  const microFemaleFirstNames = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.femaleFirstNames ?? []));
  const microLastNames = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.lastNames ?? []));
  const microLanguages = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.languages ?? []));

  if (trace) {
    trace.derived.primaryWeights = { namesPrimaryWeight, languagesPrimaryWeight, foodPrimaryWeight, mediaPrimaryWeight, fashionPrimaryWeight };
    trace.derived.cultureEnv = { home: homeCultureEnv01k, citizenship: citizenshipCultureEnv01k, current: currentCultureEnv01k, blended: cultureEnv01k, mixing01 };
    trace.derived.microCultureProfilesTop = microTop;
    trace.derived.homeCultureProfilePresent = !!macroCulture;
  }

  return {
    homeCountryIso3, citizenshipCountryIso3, currentCountryIso3, homeCulture,
    originTierBand, socioeconomicMobility, cohortBucketStartYear, countryPriorsBucket,
    climateIndicators, homeCultureEnv01k, citizenshipCultureEnv01k, currentCultureEnv01k, cultureEnv01k,
    cultureCosmo01, cultureTraditionalism01, cultureMediaOpenness01, mixing01,
    primaryWeights: { namesPrimaryWeight, languagesPrimaryWeight, foodPrimaryWeight, mediaPrimaryWeight, fashionPrimaryWeight },
    microProfiles, microWeights01k, microTop, microFirstNames, microMaleFirstNames, microFemaleFirstNames, microLastNames, microLanguages,
    validCountries, cultureCountries, abroad,
  };
}

// ============================================================================
// Utility: Weight-Faithful Microculture Item Picking
// ============================================================================

/** Pick items from microculture profiles according to their weights. */
export function pickFromWeightedMicroProfiles<T>(
  rng: Rng, microProfiles: MicroProfileEntry[], getItems: (p: CultureProfileV1) => readonly T[] | undefined, count: number,
): T[] {
  if (microProfiles.length === 0 || count <= 0) return [];
  const results: T[] = [];
  const pickProfile = (): MicroProfileEntry => {
    const total = microProfiles.reduce((s, p) => s + p.weight01k, 0);
    let r = rng.next01() * total;
    for (const p of microProfiles) { r -= p.weight01k; if (r <= 0) return p; }
    return microProfiles[0]!;
  };
  for (let i = 0; i < count * 3 && results.length < count; i++) {
    const picked = pickProfile();
    const items = getItems(picked.profile) ?? [];
    if (items.length) { const item = rng.pick(items as T[]); if (!results.includes(item)) results.push(item); }
  }
  return results;
}
