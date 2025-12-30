/**
 * Identity Facet - Core identity attributes for agent generation
 *
 * Handles:
 * - Role seed tags selection
 * - Education and career tracks
 * - Name generation (first name, last name, full name)
 * - Languages and proficiency
 * - Gender identity and pronouns
 * - Sexual orientation and outness
 * - Naming structure, honorifics, call signs, aliases
 */

import type {
  Fixed,
  Band5,
  TierBand,
  AgentVocabV1,
  AgentPriorsV1,
  CultureProfileV1,
  Latents,
  AgentGenerationTraceV1,
  NameStructure,
  HonorificStyle,
  SexualOrientation,
  OutnessLevel,
} from '../types';

import {
  makeRng,
  facetSeed,
  clampFixed01k,
  clamp01,
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

export type IdentityContext = {
  seed: string;
  vocab: AgentVocabV1;
  priors?: AgentPriorsV1;

  // Country context
  homeCountryIso3: string;
  citizenshipCountryIso3: string;
  currentCountryIso3: string;
  homeCulture: string;

  // Demographics
  age: number;
  birthYear: number;
  asOfYear: number;
  tierBand: TierBand;

  // Latents
  latents: Latents;
  cosmo01: number;
  inst01: number;
  risk01: number;
  opsec01: number;

  // Culture context
  macroCulture: CultureProfileV1 | undefined;
  microFirstNames: string[];
  microMaleFirstNames: string[];
  microFemaleFirstNames: string[];
  microLastNames: string[];
  microLanguages: string[];
  namesPrimaryWeight: number;
  languagesPrimaryWeight: number;
  cultureTraditionalism01: number;
  microProfiles: Array<{ id: string; weight01k: number }>;

  // Environment data
  countryPriorsBucket?: {
    languages01k?: Record<string, Fixed>;
    educationTrackWeights?: Record<string, number>;
    careerTrackWeights?: Record<string, number>;
  };
  cohortBucketStartYear: number;

  // Override inputs
  inputRoleSeedTags?: string[];

  // Trace
  trace?: AgentGenerationTraceV1;
};

export type IdentityResult = {
  // Core identity
  roleSeedTags: string[];
  educationTrackTag: string;
  careerTrackTag: string;
  effectiveBirthYear: number;

  // Name
  firstName: string;
  lastName: string;
  name: string;

  // Languages
  languages: string[];
  languageProficiencies: Array<{ language: string; proficiencyBand: Band5 }>;

  // Gender
  genderIdentityTag: string;
  genderPronounSet: string;

  // Orientation
  orientationTag: SexualOrientation;
  outnessLevel: OutnessLevel;

  // Naming system
  nameStructure: NameStructure;
  honorificStyle: HonorificStyle;
  callSign: string | null;
  aliases: string[];
  romanizedName: string | null;
};

// ============================================================================
// Main computation
// ============================================================================

export function computeIdentity(ctx: IdentityContext): IdentityResult {
  const {
    seed,
    vocab,
    priors,
    homeCountryIso3,
    citizenshipCountryIso3,
    currentCountryIso3,
    homeCulture,
    age,
    birthYear,
    asOfYear,
    tierBand,
    cosmo01,
    inst01,
    risk01,
    macroCulture,
    microFirstNames,
    microMaleFirstNames,
    microFemaleFirstNames,
    microLastNames,
    microLanguages,
    namesPrimaryWeight,
    languagesPrimaryWeight,
    cultureTraditionalism01,
    microProfiles,
    countryPriorsBucket,
    cohortBucketStartYear,
    inputRoleSeedTags,
    trace,
  } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // ROLE SEED TAGS
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'base');
  const baseRng = makeRng(facetSeed(seed, 'base'));
  const roleSeedTags = (inputRoleSeedTags?.length ? inputRoleSeedTags : baseRng.pickK(vocab.identity.roleSeedTags, 2))
    .slice(0, 4);
  traceSet(trace, 'identity.roleSeedTags', roleSeedTags, {
    method: inputRoleSeedTags?.length ? 'override' : 'rng',
    dependsOn: { facet: 'base', poolSize: vocab.identity.roleSeedTags.length },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EDUCATION & CAREER TRACKS
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'identity_tracks');
  const identityRng = makeRng(facetSeed(seed, 'identity_tracks'));

  const educationTracks = uniqueStrings(vocab.identity.educationTracks ?? []);
  const careerTracks = uniqueStrings(vocab.identity.careerTracks ?? []);

  // Career track nudges based on role
  const careerNudges: Record<string, string> = {
    diplomat: 'foreign-service',
    media: 'journalism',
    operative: 'intelligence',
    security: 'military',
    technocrat: 'engineering',
    analyst: 'academia',
    organizer: 'organized-labor',
    logistics: 'logistics',
  };

  const roleNudgedCareer = roleSeedTags.map(r => careerNudges[r]).find(Boolean);
  const careerTrackTag = (() => {
    if (careerTracks.length === 0) return roleNudgedCareer ?? 'civil-service';
    if (roleNudgedCareer && careerTracks.includes(roleNudgedCareer)) return roleNudgedCareer;
    const weights = careerTracks.map((t) => {
      let w = 1;
      if (inst01 > 0.65 && ['civil-service', 'foreign-service', 'law', 'military', 'politics', 'public-health'].includes(t)) w += 2.2;
      if (inst01 < 0.35 && ['ngo', 'journalism', 'corporate-ops', 'academia'].includes(t)) w += 1.7;
      if (risk01 > 0.65 && ['intelligence', 'military', 'politics'].includes(t)) w += 1.3;
      if (roleNudgedCareer === t) w += 3.0;

      // Age-based career appropriateness
      if (age < 30) {
        if (['politics', 'civil-service'].includes(t)) w *= 0.6;
        if (['military', 'journalism', 'intelligence'].includes(t)) w += 0.4;
      }
      if (age > 50) {
        if (['academia', 'civil-service', 'politics', 'foreign-service'].includes(t)) w += 0.5;
        if (['military'].includes(t)) w *= 0.7;
      }

      const env = countryPriorsBucket?.careerTrackWeights?.[t];
      if (typeof env === 'number' && Number.isFinite(env) && env > 0) w *= env;
      return { item: t, weight: w };
    });
    const picked = weightedPick(identityRng, weights);
    if (trace) {
      trace.derived.careerTrackWeightsTop = [...weights]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8);
    }
    return picked;
  })();
  traceSet(trace, 'identity.careerTrackTag', careerTrackTag, {
    method: 'weightedPick',
    dependsOn: { facet: 'identity_tracks', roleNudgedCareer: roleNudgedCareer ?? null, inst01, risk01 },
  });

  const educationTrackTag = (() => {
    const pool = educationTracks.length ? educationTracks : ['secondary', 'undergraduate', 'graduate', 'trade-certification'];
    const weights = pool.map((t) => {
      let w = 1;
      if (tierBand === 'elite' && ['graduate', 'doctorate'].includes(t)) w += 2.2;
      if (tierBand === 'mass' && ['secondary', 'trade-certification', 'self-taught'].includes(t)) w += 1.8;
      if (careerTrackTag === 'military' && t === 'military-academy') w += 3.0;
      if (careerTrackTag === 'civil-service' && t === 'civil-service-track') w += 2.4;
      if (inst01 > 0.65 && ['graduate', 'civil-service-track'].includes(t)) w += 1.2;
      const env = countryPriorsBucket?.educationTrackWeights?.[t];
      if (typeof env === 'number' && Number.isFinite(env) && env > 0) w *= env;
      return { item: t, weight: w };
    });
    const picked = weightedPick(identityRng, weights);
    if (trace) {
      trace.derived.educationTrackWeightsTop = [...weights]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8);
    }
    return picked;
  })();
  traceSet(trace, 'identity.educationTrackTag', educationTrackTag, {
    method: 'weightedPick',
    dependsOn: { facet: 'identity_tracks', tierBand, careerTrackTag, inst01 },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EDUCATION-BASED AGE FLOOR
  // ─────────────────────────────────────────────────────────────────────────────
  const educationAgeFloors: Record<string, number> = {
    'secondary': 18,
    'trade-certification': 20,
    'undergraduate': 22,
    'graduate': 26,
    'doctorate': 30,
    'military-academy': 22,
    'civil-service-track': 24,
    'self-taught': 18,
  };
  const ageFloor = educationAgeFloors[educationTrackTag] ?? 18;

  let adjustedAge = age;
  let adjustedBirthYear = birthYear;
  if (age < ageFloor) {
    adjustedAge = ageFloor;
    adjustedBirthYear = asOfYear - ageFloor;
    if (trace) {
      trace.derived.ageFloorAdjustment = {
        originalAge: age,
        originalBirthYear: birthYear,
        ageFloor,
        adjustedAge,
        adjustedBirthYear,
        reason: `${educationTrackTag} requires minimum age ${ageFloor}`,
      };
    }
  }
  void adjustedAge;
  const effectiveBirthYear = adjustedBirthYear;

  // ─────────────────────────────────────────────────────────────────────────────
  // GENDER IDENTITY (moved early for gendered name selection)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'gender');
  const genderRng = makeRng(facetSeed(seed, 'gender'));
  const genderIdentities = vocab.gender?.identityTags ?? ['cisgender-man', 'cisgender-woman'];
  const pronounOptions = vocab.gender?.pronounSets ?? ['he-him', 'she-her', 'they-them'];

  // Two-spirit culture gating
  const indigenousAmericanCountries = new Set([
    'USA', 'CAN',
    'MEX', 'GTM', 'HND', 'SLV', 'NIC', 'CRI', 'PAN',
    'COL', 'VEN', 'ECU', 'PER', 'BOL', 'CHL', 'ARG', 'PRY',
    'BRA',
  ]);
  const isIndigenousAmericanCulture =
    homeCulture === 'Americas' ||
    indigenousAmericanCountries.has(homeCountryIso3) ||
    microProfiles.some(p =>
      p.id.includes('andean') ||
      p.id.includes('caribbean')
    );

  // Realistic gender identity distribution based on population studies:
  // ~98-99% cisgender, ~0.5-1% transgender, ~0.5-1% non-binary/other
  // (Williams Institute, Pew Research 2022)
  const genderIdentityWeights = genderIdentities.map(tag => {
    let w = 0.1; // Base weight for rare identities
    // Cisgender: ~98% combined (~49% each)
    if (tag === 'cisgender-man' || tag === 'cisgender-woman') w = 490;
    // Transgender: ~0.5% each
    if (tag === 'transgender-man' || tag === 'transgender-woman') w = 2.5;
    // Non-binary/other: ~0.5% combined
    if (tag === 'non-binary' || tag === 'genderqueer' || tag === 'agender' || tag === 'gender-fluid') w = 0.6;
    // Cultural context matters
    if (tag === 'two-spirit' && !isIndigenousAmericanCulture) w = 0;
    if (tag === 'undisclosed') w = 0.3;
    return { item: tag, weight: w };
  });
  const genderIdentityTag = weightedPick(genderRng, genderIdentityWeights);

  const pronounWeights = pronounOptions.map(pset => {
    let w = 1;
    if (genderIdentityTag === 'cisgender-man' && pset === 'he-him') w = 100;
    if (genderIdentityTag === 'cisgender-woman' && pset === 'she-her') w = 100;
    if (genderIdentityTag === 'transgender-man' && pset === 'he-him') w = 50;
    if (genderIdentityTag === 'transgender-woman' && pset === 'she-her') w = 50;
    if (genderIdentityTag === 'non-binary' && pset === 'they-them') w = 30;
    if (genderIdentityTag === 'non-binary' && (pset === 'he-they' || pset === 'she-they')) w = 15;
    if (genderIdentityTag === 'genderqueer' && pset === 'they-them') w = 25;
    if (genderIdentityTag === 'agender' && pset === 'they-them') w = 30;
    if (genderIdentityTag === 'gender-fluid' && pset === 'any-pronouns') w = 25;
    if (genderIdentityTag === 'two-spirit' && pset === 'they-them') w = 15;
    if (genderIdentityTag === 'undisclosed') w = 1;
    return { item: pset, weight: w };
  });
  const genderPronounSet = weightedPick(genderRng, pronounWeights);
  traceSet(trace, 'gender', { identityTag: genderIdentityTag, pronounSet: genderPronounSet }, { method: 'weighted' });

  // Determine if we should use male or female name pool
  const useMaleNames = genderIdentityTag === 'cisgender-man' || genderIdentityTag === 'transgender-man';
  const useFemaleNames = genderIdentityTag === 'cisgender-woman' || genderIdentityTag === 'transgender-woman';

  // ─────────────────────────────────────────────────────────────────────────────
  // NAME GENERATION
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'name');
  const nameRng = makeRng(facetSeed(seed, 'name'));
  // Use gendered name pools when available, fall back to generic firstNames
  const macroMaleFirst = macroCulture?.identity?.maleFirstNames ?? [];
  const macroFemaleFirst = macroCulture?.identity?.femaleFirstNames ?? [];
  const macroFirst = useMaleNames && macroMaleFirst.length > 0
    ? macroMaleFirst
    : useFemaleNames && macroFemaleFirst.length > 0
      ? macroFemaleFirst
      : macroCulture?.identity?.firstNames ?? [];
  const macroLast = macroCulture?.identity?.lastNames ?? [];
  const microStrength01 = microProfiles.length ? clamp01(microProfiles[0]!.weight01k / 1000, 0) : 0;
  // Select gendered micro pools
  const effectiveMicroFirstNames = useMaleNames && microMaleFirstNames.length > 0
    ? microMaleFirstNames
    : useFemaleNames && microFemaleFirstNames.length > 0
      ? microFemaleFirstNames
      : microFirstNames;

  const pickNameFromPools = (pools: Array<{ label: string; items: string[]; weight: number }>, fallbackPool: string[]) => {
    const chosen = weightedPick(nameRng, pools.map(p => ({ item: p.label, weight: p.items.length ? p.weight : 0 })));
    const pool = pools.find(p => p.label === chosen)?.items ?? [];
    const usable = pool.length ? pool : fallbackPool;
    return nameRng.pick(usable);
  };

  const macroW = namesPrimaryWeight * (0.55 + 0.20 * cultureTraditionalism01);
  const microW = namesPrimaryWeight * 0.45 * (0.35 + 0.65 * microStrength01);
  const globalW = Math.max(0.05, 1 - Math.min(0.95, macroW + microW));

  // Select gendered global pool when available
  const globalMaleFirst = (vocab.identity as { maleFirstNames?: string[] }).maleFirstNames ?? [];
  const globalFemaleFirst = (vocab.identity as { femaleFirstNames?: string[] }).femaleFirstNames ?? [];
  const effectiveGlobalFirst = useMaleNames && globalMaleFirst.length > 0
    ? globalMaleFirst
    : useFemaleNames && globalFemaleFirst.length > 0
      ? globalFemaleFirst
      : vocab.identity.firstNames;

  const firstName = pickNameFromPools(
    [
      { label: 'macro', items: macroFirst, weight: macroW },
      { label: 'micro', items: effectiveMicroFirstNames, weight: microW },
      { label: 'global', items: effectiveGlobalFirst, weight: globalW },
    ],
    vocab.identity.firstNames,
  );
  const lastName = pickNameFromPools(
    [
      { label: 'macro', items: macroLast, weight: macroW },
      { label: 'micro', items: microLastNames, weight: microW },
      { label: 'global', items: vocab.identity.lastNames, weight: globalW },
    ],
    vocab.identity.lastNames,
  );
  const name = `${firstName} ${lastName}`;
  traceSet(trace, 'identity.name', name, {
    method: 'macro+micro+global',
    dependsOn: {
      facet: 'name',
      namesPrimaryWeight,
      genderIdentityTag,
      macroFirstPoolSize: macroFirst.length,
      microFirstPoolSize: effectiveMicroFirstNames.length,
      macroLastPoolSize: macroLast.length,
      microLastPoolSize: microLastNames.length,
      microStrength01,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // LANGUAGES & PROFICIENCY
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'languages');
  const langRng = makeRng(facetSeed(seed, 'languages'));
  const cultureLangs = uniqueStrings([...(macroCulture?.identity?.languages ?? []), ...microLanguages]);
  const baseLangs = uniqueStrings(vocab.identity.languages);
  const unionLangs = uniqueStrings([...cultureLangs, ...baseLangs]);

  const getLanguageEnv01k = (iso3: string): Record<string, Fixed> | null => {
    const bucket = priors?.countries?.[iso3]?.buckets?.[String(cohortBucketStartYear)];
    const env = bucket?.languages01k;
    return env && typeof env === 'object' ? (env as Record<string, Fixed>) : null;
  };

  const homeLangEnv01k = getLanguageEnv01k(homeCountryIso3);
  const citizenshipLangEnv01k = citizenshipCountryIso3 !== homeCountryIso3 ? getLanguageEnv01k(citizenshipCountryIso3) : null;
  const currentLangEnv01k = currentCountryIso3 !== homeCountryIso3 ? getLanguageEnv01k(currentCountryIso3) : null;

  const maxHomeWeight = homeLangEnv01k ? Math.max(0, ...Object.values(homeLangEnv01k).map(Number)) : null;
  const homeDiversity01 = maxHomeWeight != null ? clamp01(1 - maxHomeWeight / 1000, 0) : 0;
  const abroad = currentCountryIso3 !== homeCountryIso3;

  const desiredLanguageCount = Math.max(
    1,
    Math.min(
      3,
      1 +
        (cosmo01 > 0.45 ? 1 : 0) +
        (cosmo01 > 0.78 ? 1 : 0) +
        (homeDiversity01 > 0.40 ? 1 : 0) +
        (careerTrackTag === 'foreign-service' ? 1 : 0) +
        (educationTrackTag === 'graduate' || educationTrackTag === 'doctorate' ? 1 : 0),
    ),
  );
  const languageCount = Math.max(1, Math.min(3, desiredLanguageCount));

  const topEnv = (env: Record<string, Fixed> | null) =>
    env
      ? Object.entries(env)
          .sort((a, b) => (Number(b[1]) - Number(a[1])) || String(a[0]).localeCompare(String(b[0])))
          .slice(0, 8)
          .map(([language, weight01k]) => ({ language, weight01k: Number(weight01k) }))
      : null;

  if (trace) {
    trace.derived.languageEnv = {
      home: topEnv(homeLangEnv01k),
      citizenship: topEnv(citizenshipLangEnv01k),
      current: topEnv(currentLangEnv01k),
      homeDiversity01,
    };
  }

  const languages: string[] = [];
  if (homeLangEnv01k) {
    const citFactor = citizenshipLangEnv01k ? 0.10 + 0.25 * cosmo01 : 0;
    const curFactor = currentLangEnv01k ? 0.15 + 0.35 * cosmo01 + (abroad ? 0.15 : 0) : 0;
    const cultureBoost = 60 * languagesPrimaryWeight;

    const primaryWeights = baseLangs.map((language) => {
      let w = 1 + (homeLangEnv01k[language] ?? 0);
      if (citizenshipLangEnv01k) w += (citizenshipLangEnv01k[language] ?? 0) * citFactor;
      if (currentLangEnv01k) w += (currentLangEnv01k[language] ?? 0) * curFactor;
      if (cultureLangs.includes(language)) w += cultureBoost;
      return { item: language, weight: w };
    });
    const primaryLanguage = weightedPick(langRng, primaryWeights);
    languages.push(primaryLanguage);

    const remainingWeights = baseLangs
      .filter(l => !languages.includes(l))
      .map((language) => {
        let w = 1 + (homeLangEnv01k[language] ?? 0);
        if (citizenshipLangEnv01k) w += (citizenshipLangEnv01k[language] ?? 0) * (0.20 + 0.30 * cosmo01);
        if (currentLangEnv01k) w += (currentLangEnv01k[language] ?? 0) * (0.25 + 0.35 * cosmo01 + (abroad ? 0.20 : 0));
        if (cultureLangs.includes(language)) w += 40;
        return { item: language, weight: w };
      });
    const remaining = Math.max(0, languageCount - languages.length);
    languages.push(...weightedPickKUnique(langRng, remainingWeights, remaining));

    traceSet(trace, 'identity.languages', languages, {
      method: 'env+weightedPickKUnique',
      dependsOn: { facet: 'languages', languageCount, homeCountryIso3, citizenshipCountryIso3, currentCountryIso3, cosmo01, homeDiversity01 },
    });
  } else {
    const useCulturePrimaryLanguage = cultureLangs.length > 0 && langRng.next01() < languagesPrimaryWeight;
    languages.push(langRng.pick(useCulturePrimaryLanguage ? cultureLangs : baseLangs));
    const remaining = Math.max(0, languageCount - languages.length);
    languages.push(...langRng.pickK(unionLangs.filter(l => !languages.includes(l)), remaining));
    traceSet(trace, 'identity.languages', languages, {
      method: 'hybridPickK',
      dependsOn: { facet: 'languages', languagesPrimaryWeight, useCulturePrimaryLanguage, languageCount, cultureLangPoolSize: cultureLangs.length, baseLangPoolSize: baseLangs.length },
    });
  }

  // Language proficiency
  traceFacet(trace, seed, 'language_proficiency');
  const proficiencyRng = makeRng(facetSeed(seed, 'language_proficiency'));
  const languageProficiencies = languages.map((language, idx) => {
    const isPrimary = idx === 0;
    const envSupport01 = Math.max(
      (homeLangEnv01k?.[language] ?? 0) / 1000,
      (citizenshipLangEnv01k?.[language] ?? 0) / 1000,
      (currentLangEnv01k?.[language] ?? 0) / 1000,
    );
    const score = isPrimary
      ? 980
      : tierBand === 'elite'
        ? clampFixed01k(proficiencyRng.int(420, 980) + Math.round(envSupport01 * 220) + Math.round(cosmo01 * 120))
        : tierBand === 'middle'
          ? clampFixed01k(proficiencyRng.int(300, 950) + Math.round(envSupport01 * 200) + Math.round(cosmo01 * 100))
          : clampFixed01k(proficiencyRng.int(220, 900) + Math.round(envSupport01 * 180) + Math.round(cosmo01 * 80));
    const band: Band5 = band5From01k(score);
    return { language, proficiencyBand: band };
  });
  traceSet(trace, 'identity.languageProficiencies', languageProficiencies, {
    method: 'env+perLanguageBand',
    dependsOn: { facet: 'language_proficiency', tierBand, cosmo01 },
  });

  // (Gender identity was moved earlier for gendered name selection)

  // ─────────────────────────────────────────────────────────────────────────────
  // SEXUAL ORIENTATION & OUTNESS
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'orientation');
  const orientationRng = makeRng(facetSeed(seed, 'orientation'));
  const orientationTags = vocab.orientation?.orientationTags ?? ['straight', 'gay', 'lesbian', 'bisexual', 'pansexual', 'asexual', 'queer', 'questioning', 'undisclosed'];
  const outnessLevels = vocab.orientation?.outnessLevels ?? ['closeted', 'selectively-out', 'out-to-friends', 'professionally-out', 'publicly-out'];

  const orientationWeights = orientationTags.map(tag => {
    let w = 1;
    if (tag === 'straight') w = 90;
    if (tag === 'undisclosed') w = 5;
    if ((tag === 'bisexual' || tag === 'pansexual') && age < 35) w = 1.5;
    return { item: tag, weight: w };
  });
  const orientationTag = weightedPick(orientationRng, orientationWeights) as SexualOrientation;

  const outnessWeights = outnessLevels.map(level => {
    let w = 1;
    if (orientationTag === 'straight' || orientationTag === 'undisclosed') {
      if (level === 'publicly-out') w = 100;
      else w = 0;
    } else {
      if (level === 'closeted') w = 20;
      if (level === 'selectively-out') w = 25;
      if (level === 'out-to-friends') w = 30;
      if (level === 'professionally-out') w = 15;
      if (level === 'publicly-out') w = 10;
      if (tierBand === 'elite' && level === 'closeted') w *= 1.5;
      if (age < 35 && (level === 'professionally-out' || level === 'publicly-out')) w *= 1.5;
    }
    return { item: level, weight: w };
  });
  const outnessLevel = weightedPick(orientationRng, outnessWeights) as OutnessLevel;
  traceSet(trace, 'orientation', { orientationTag, outnessLevel }, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────────
  // NAMING SYSTEM
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'naming');
  const namingRng = makeRng(facetSeed(seed, 'naming'));
  const namingStructures = vocab.naming?.structureTags ?? ['western', 'eastern-family-first', 'patronymic', 'matronymic', 'single-name', 'clan-name', 'compound-surname'];
  const honorificStyles = vocab.naming?.honorificStyles ?? ['title-first', 'given-name', 'surname', 'patronymic', 'teknonym', 'none'];
  const callSignPrefixes = vocab.naming?.callSignPrefixes ?? ['shadow', 'ghost', 'eagle', 'wolf'];

  const nameStructureWeights: Array<{ item: NameStructure; weight: number }> = namingStructures.map(s => {
    let w = 1;
    if (s === 'eastern-family-first' && ['sinitic', 'japanese', 'korean', 'vietnamese'].some(c => homeCulture.toLowerCase().includes(c))) w = 50;
    if (s === 'patronymic' && ['arab', 'gulf', 'levant', 'iranian', 'icelandic', 'caucasus'].some(c => homeCulture.toLowerCase().includes(c))) w = 30;
    if (s === 'western' && !['sinitic', 'japanese', 'korean', 'vietnamese'].some(c => homeCulture.toLowerCase().includes(c))) w = 40;
    if (s === 'compound-surname' && ['hispanic', 'luso', 'iberian'].some(c => homeCulture.toLowerCase().includes(c))) w = 25;
    return { item: s as NameStructure, weight: w };
  });
  const nameStructure = weightedPick(namingRng, nameStructureWeights) as NameStructure;

  const honorificWeights = honorificStyles.map(h => {
    let w = 1;
    if (h === 'surname' && tierBand === 'elite') w = 3;
    if (h === 'given-name' && age < 35) w = 2;
    if (h === 'title-first' && ['elite', 'middle'].includes(tierBand)) w = 2;
    return { item: h as HonorificStyle, weight: w };
  });
  const honorificStyle = weightedPick(namingRng, honorificWeights) as HonorificStyle;

  // Call sign for operatives/security types
  const hasCallSign = roleSeedTags.some(r => ['operative', 'security', 'technocrat'].includes(r)) && namingRng.next01() < 0.3;
  const callSign = hasCallSign
    ? `${callSignPrefixes[namingRng.int(0, callSignPrefixes.length - 1)]}-${namingRng.int(10, 99)}`
    : null;

  // Aliases
  const aliasCount = roleSeedTags.includes('operative') ? namingRng.int(1, 3) : (namingRng.next01() < 0.2 ? 1 : 0);
  const aliases: string[] = [];
  for (let i = 0; i < aliasCount; i++) {
    const aliasFirstName = vocab.identity.firstNames[namingRng.int(0, vocab.identity.firstNames.length - 1)];
    const aliasLastName = vocab.identity.lastNames[namingRng.int(0, vocab.identity.lastNames.length - 1)];
    aliases.push(`${aliasFirstName} ${aliasLastName}`);
  }

  // Romanized name for non-Latin scripts
  const needsRomanization = ['sinitic', 'japanese', 'korean', 'arabic', 'cyrillic', 'hellenic', 'hindi', 'thai'].some(
    c => homeCulture.toLowerCase().includes(c)
  );
  const romanizedName = needsRomanization ? name : null;

  traceSet(trace, 'naming', { nameStructure, honorificStyle, callSign, aliases }, { method: 'cultural' });

  return {
    roleSeedTags,
    educationTrackTag,
    careerTrackTag,
    effectiveBirthYear,
    firstName,
    lastName,
    name,
    languages,
    languageProficiencies,
    genderIdentityTag,
    genderPronounSet,
    orientationTag,
    outnessLevel,
    nameStructure,
    honorificStyle,
    callSign,
    aliases,
    romanizedName,
  };
}
