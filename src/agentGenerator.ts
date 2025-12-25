export type TierBand = 'elite' | 'middle' | 'mass';

export type Band5 = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export type Fixed = number; // fixed-point int, typically 0..1000

export type HeightBand = 'very_short' | 'short' | 'average' | 'tall' | 'very_tall';

export type AgentPriorsV1 = {
  version: 1;
  generatedAtIso: string;
  buckets: number[];
  countries: Record<
    string,
    {
      iso3: string;
      buckets: Record<
        string,
        {
          cohortBucketStartYear: number;
          indicators?: Record<string, unknown>;
          languages01k?: Record<string, Fixed>;
          foodEnvironment01k?: Partial<
            Record<
              | 'meat'
              | 'dairy'
              | 'seafood'
              | 'spice'
              | 'sweets'
              | 'friedOily'
              | 'caffeine'
              | 'streetFood'
              | 'fineDining'
              | 'plantForward',
              Fixed
            >
          >;
          appearance?: { heightBandWeights01k?: Partial<Record<HeightBand, Fixed>> };
          mediaEnvironment01k?: Partial<Record<'print' | 'radio' | 'tv' | 'social' | 'closed', Fixed>>;
          educationTrackWeights?: Record<string, number>;
          careerTrackWeights?: Record<string, number>;
          mobility01k?: Partial<Record<'passportAccess' | 'travelFrequency', Fixed>>;
        }
      >;
    }
  >;
};

type CultureProfileV1 = {
  weights?: {
    namesPrimaryWeight?: number;
    languagesPrimaryWeight?: number;
    foodPrimaryWeight?: number;
    mediaPrimaryWeight?: number;
    fashionPrimaryWeight?: number;
  };
  identity?: {
    firstNames?: string[];
    lastNames?: string[];
    languages?: string[];
  };
  preferences?: {
    food?: {
      comfortFoods?: string[];
      ritualDrinks?: string[];
    };
    media?: {
      genres?: string[];
    };
    fashion?: {
      styleTags?: string[];
    };
  };
};

export type AgentVocabV1 = {
  version: 1;
  identity: {
    tierBands: TierBand[];
    homeCultures: string[];
    roleSeedTags: string[];
    firstNames: string[];
    lastNames: string[];
    languages: string[];
    educationTracks?: string[];
    careerTracks?: string[];
  };
  appearance: {
    heightBands: HeightBand[];
    buildTags: string[];
    hairColors: string[];
    hairTextures: string[];
    eyeColors: string[];
    voiceTags: string[];
    distinguishingMarks: string[];
  };
  capabilities: {
    skillKeys: string[];
    roleSkillBumps: Record<string, Record<string, number>>;
  };
  preferences: {
    food: {
      comfortFoods: string[];
      dislikes: string[];
      restrictions: string[];
      ritualDrinks: string[];
    };
    media: {
      genres: string[];
      platforms: string[];
    };
    fashion: {
      styleTags: string[];
    };
  };
  routines: {
    chronotypes: string[];
    recoveryRituals: string[];
  };
  vices: {
    vicePool: string[];
    triggers: string[];
  };
  logistics: {
    identityKitItems: string[];
  };
  psych?: {
    redLines?: string[];
    redLineByRole?: Record<string, string[]>;
  };
  visibility?: {
    publicRoleTags?: string[];
    stealthRoleTags?: string[];
  };
  health?: {
    chronicConditionTags?: string[];
    allergyTags?: string[];
  };
  covers?: {
    coverAptitudeTags?: string[];
  };
  mobility?: {
    mobilityTags?: string[];
    passportAccessBands?: Band5[];
  };
  cultureProfiles?: Record<string, CultureProfileV1>;
};

export type GeneratedAgent = {
  version: 1;
  id: string;
  seed: string;
  createdAtIso: string;

  generationTrace?: AgentGenerationTraceV1;

  identity: {
    name: string;
    homeCountryIso3: string;
    citizenshipCountryIso3: string;
    currentCountryIso3: string;
    homeCulture: string;
    birthYear: number;
    tierBand: TierBand;
    roleSeedTags: string[];
    languages: string[];
    languageProficiencies: Array<{ language: string; proficiencyBand: Band5 }>;
    educationTrackTag: string;
    careerTrackTag: string;
    redLines: string[];
  };

  appearance: {
    heightBand: HeightBand;
    buildTag: string;
    hair: { color: string; texture: string };
    eyes: { color: string };
    voiceTag: string;
    distinguishingMarks: string[];
  };

  capabilities: {
    aptitudes: {
      strength: Fixed;
      endurance: Fixed;
      dexterity: Fixed;
      reflexes: Fixed;
      handEyeCoordination: Fixed;

      cognitiveSpeed: Fixed;
      attentionControl: Fixed;
      workingMemory: Fixed;
      riskCalibration: Fixed;

      charisma: Fixed;
      empathy: Fixed;
      assertiveness: Fixed;
      deceptionAptitude: Fixed;
    };
    skills: Record<string, { value: Fixed; xp: Fixed; lastUsedDay: number | null }>;
  };

  preferences: {
    food: {
      comfortFoods: string[];
      dislikes: string[];
      restrictions: string[];
      ritualDrink: string;
    };
    media: {
      platformDiet: Record<string, Fixed>;
      genreTopK: string[];
      attentionResilience: Fixed;
      doomscrollingRisk: Fixed;
      epistemicHygiene: Fixed;
    };
    fashion: {
      styleTags: string[];
      formality: Fixed;
      conformity: Fixed;
      statusSignaling: Fixed;
    };
  };

  psych: {
    traits: {
      riskTolerance: Fixed;
      conscientiousness: Fixed;
      noveltySeeking: Fixed;
      agreeableness: Fixed;
      authoritarianism: Fixed;
    };
  };

  visibility: {
    publicVisibility: Fixed;
    paperTrail: Fixed;
    digitalHygiene: Fixed;
  };

  health: {
    chronicConditionTags: string[];
    allergyTags: string[];
  };

  covers: {
    coverAptitudeTags: string[];
  };

  mobility: {
    passportAccessBand: Band5;
    mobilityTag: string;
    travelFrequencyBand: Band5;
  };

  routines: {
    chronotype: string;
    sleepWindow: string;
    recoveryRituals: string[];
  };

  vices: Array<{
    vice: string;
    severity: Band5;
    triggers: string[];
  }>;

  logistics: {
    identityKit: Array<{ item: string; security: Band5; compromised: boolean }>;
  };
};

export type GenerateAgentInput = {
  vocab: AgentVocabV1;
  countries: { iso3: string; shadow: string; continent?: string }[];
  priors?: AgentPriorsV1;
  seed: string;
  birthYear?: number;
  tierBand?: TierBand;
  roleSeedTags?: string[];
  includeTrace?: boolean;
};

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampFixed01k(value: number): Fixed {
  return clampInt(value, 0, 1000);
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

type Rng = {
  nextU32: () => number;
  next01: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  pickK: <T>(items: readonly T[], k: number) => T[];
};

function weightedPick(rng: Rng, items: Array<{ item: string; weight: number }>): string {
  const cleaned = items
    .map(({ item, weight }) => ({ item, weight: Number.isFinite(weight) ? Math.max(0, weight) : 0 }))
    .filter(x => x.item && x.weight > 0);
  if (!cleaned.length) return rng.pick(items.map(x => x.item).filter(Boolean));
  const total = cleaned.reduce((s, x) => s + x.weight, 0);
  let r = rng.next01() * total;
  for (const x of cleaned) {
    r -= x.weight;
    if (r <= 0) return x.item;
  }
  return cleaned[cleaned.length - 1]!.item;
}

function weightedPickKUnique(rng: Rng, items: Array<{ item: string; weight: number }>, k: number): string[] {
  const out: string[] = [];
  const remaining = new Map<string, number>();
  for (const it of items) {
    if (!it.item) continue;
    remaining.set(it.item, (remaining.get(it.item) ?? 0) + Math.max(0, it.weight));
  }
  while (out.length < k && remaining.size > 0) {
    const picked = weightedPick(rng, [...remaining.entries()].map(([item, weight]) => ({ item, weight })));
    out.push(picked);
    remaining.delete(picked);
  }
  return out;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed: number): Rng {
  const next = mulberry32(seed);
  return {
    nextU32: () => (next() * 0x1_0000_0000) >>> 0,
    next01: () => next(),
    int: (min, max) => {
      const a = Math.ceil(min);
      const b = Math.floor(max);
      return a + Math.floor(next() * (b - a + 1));
    },
    pick: (items) => items[Math.floor(next() * items.length)]!,
    pickK: (items, k) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy.slice(0, Math.max(0, Math.min(k, copy.length)));
    },
  };
}

function facetSeed(seed: string, facet: string): number {
  return fnv1a32(`${seed}::${facet}`);
}

function normalizeSeed(seed: string): string {
  return seed.trim().replace(/\s+/g, ' ').slice(0, 200);
}

export function randomSeedString(): string {
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    cryptoObj.getRandomValues(bytes);
    let n = 0n;
    for (const b of bytes) n = (n << 8n) | BigInt(b);
    return n.toString(36);
  }

  // Fallback for contexts where WebCrypto isn't available (e.g. some file:// environments).
  const a = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
  const b = Date.now().toString(36);
  return `${a}${b}`;
}

function band5From01k(value: Fixed): Band5 {
  if (value < 200) return 'very_low';
  if (value < 400) return 'low';
  if (value < 600) return 'medium';
  if (value < 800) return 'high';
  return 'very_high';
}

function topKByScore(items: readonly string[], score: (item: string) => number, k: number): string[] {
  return [...items]
    .map(item => ({ item, score: score(item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, k))
    .map(x => x.item);
}

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function uniqueStrings(items: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function pickKHybrid(rng: Rng, primary: readonly string[], fallback: readonly string[], k: number, primaryCount: number): string[] {
  const primaryK = Math.max(0, Math.min(k, primaryCount));
  const fallbackK = Math.max(0, k - primaryK);
  const a = primary.length ? rng.pickK(primary, primaryK) : [];
  const b = fallback.length ? rng.pickK(fallback, fallbackK) : [];
  return uniqueStrings([...a, ...b]).slice(0, k);
}

type FoodEnvAxis =
  | 'meat'
  | 'dairy'
  | 'seafood'
  | 'spice'
  | 'sweets'
  | 'friedOily'
  | 'caffeine'
  | 'streetFood'
  | 'fineDining'
  | 'plantForward';

type FoodEnv01k = Record<FoodEnvAxis, Fixed>;

const FOOD_ENV_AXES: readonly FoodEnvAxis[] = [
  'meat',
  'dairy',
  'seafood',
  'spice',
  'sweets',
  'friedOily',
  'caffeine',
  'streetFood',
  'fineDining',
  'plantForward',
];

function normalizeFoodEnv01k(env: Partial<Record<FoodEnvAxis, Fixed>> | null | undefined): FoodEnv01k | null {
  if (!env || typeof env !== 'object') return null;
  let hasAny = false;
  const out: Record<string, Fixed> = {};
  for (const axis of FOOD_ENV_AXES) {
    const v = Number(env[axis]);
    if (Number.isFinite(v)) {
      hasAny = true;
      out[axis] = clampFixed01k(v);
    } else {
      out[axis] = 500;
    }
  }
  return hasAny ? (out as FoodEnv01k) : null;
}

function mixFoodEnv01k(parts: Array<{ env: FoodEnv01k; weight: number }>): FoodEnv01k {
  const cleaned = parts.map(p => ({ env: p.env, weight: Number.isFinite(p.weight) ? Math.max(0, p.weight) : 0 })).filter(p => p.weight > 0);
  if (!cleaned.length) {
    return Object.fromEntries(FOOD_ENV_AXES.map(a => [a, 500])) as FoodEnv01k;
  }
  const total = cleaned.reduce((s, p) => s + p.weight, 0);
  const out: Record<string, Fixed> = {};
  for (const axis of FOOD_ENV_AXES) {
    let acc = 0;
    for (const p of cleaned) acc += (p.env[axis] / 1000) * p.weight;
    out[axis] = clampFixed01k((acc / total) * 1000);
  }
  return out as FoodEnv01k;
}

function deriveCultureFromShadowContinent(continent: string | undefined): string {
  const token = (continent ?? '').trim();
  if (!token) return 'Global';
  const shadowContinentToCulture: Record<string, string> = {
    Pelag: 'Oceania',
    Mero: 'Sub‑Saharan Africa',
    Aram: 'MENA',
    Solis: 'South Asia',
    Hesper: 'Europe',
    Athar: 'Europe',
    Verd: 'Americas',
  };
  return shadowContinentToCulture[token] ?? 'Global';
}

type Latents = {
  cosmopolitanism: Fixed;
  publicness: Fixed;
  opsecDiscipline: Fixed;
  institutionalEmbeddedness: Fixed;
  riskAppetite: Fixed;
};

export type AgentGenerationTraceV1 = {
  version: 1;
  normalizedSeed: string;
  facetSeeds: Record<string, number>;
  latents: {
    values: Latents;
    raw: Record<keyof Latents, Fixed>;
    tierBias: Record<keyof Latents, number>;
    roleBias: Record<keyof Latents, number>;
  };
  derived: Record<string, unknown>;
  fields: Record<string, { value: unknown; method?: string; dependsOn?: Record<string, unknown> }>;
};

function traceSet(
  trace: AgentGenerationTraceV1 | undefined,
  path: string,
  value: unknown,
  meta?: { method?: string; dependsOn?: Record<string, unknown> },
) {
  if (!trace) return;
  trace.fields[path] = { value, ...(meta ?? {}) };
}

function traceFacet(trace: AgentGenerationTraceV1 | undefined, seed: string, facet: string) {
  if (!trace) return;
  trace.facetSeeds[facet] = facetSeed(seed, facet);
}

function computeLatents(seed: string, tierBand: TierBand, roleSeedTags: readonly string[]) {
  const rng = makeRng(facetSeed(seed, 'latents'));
  const tierCosmoBias = tierBand === 'elite' ? 160 : tierBand === 'mass' ? -120 : 0;
  const tierPublicBias = tierBand === 'elite' ? 120 : tierBand === 'mass' ? -40 : 0;
  const tierInstBias = tierBand === 'elite' ? 120 : 0;

  const role = new Set(roleSeedTags);
  const cosmoRoleBias = (role.has('diplomat') ? 220 : 0) + (role.has('media') ? 80 : 0) + (role.has('operative') ? 140 : 0) + (role.has('technocrat') ? 60 : 0);
  const publicRoleBias = (role.has('media') ? 320 : 0) + (role.has('diplomat') ? 220 : 0) - (role.has('operative') ? 240 : 0) - (role.has('security') ? 120 : 0);
  const opsecRoleBias = (role.has('operative') ? 320 : 0) + (role.has('security') ? 220 : 0) - (role.has('media') ? 220 : 0);
  const instRoleBias = (role.has('technocrat') ? 200 : 0) + (role.has('diplomat') ? 160 : 0) + (role.has('analyst') ? 120 : 0) + (role.has('organizer') ? 80 : 0);
  const riskRoleBias = (role.has('operative') ? 180 : 0) + (role.has('security') ? 120 : 0) + (role.has('organizer') ? 80 : 0) - (role.has('diplomat') ? 40 : 0);

  const raw: Record<keyof Latents, Fixed> = {
    cosmopolitanism: clampFixed01k(rng.int(0, 1000)),
    publicness: clampFixed01k(rng.int(0, 1000)),
    opsecDiscipline: clampFixed01k(rng.int(0, 1000)),
    institutionalEmbeddedness: clampFixed01k(rng.int(0, 1000)),
    riskAppetite: clampFixed01k(rng.int(0, 1000)),
  };

  const tierBias: Record<keyof Latents, number> = {
    cosmopolitanism: tierCosmoBias,
    publicness: tierPublicBias,
    opsecDiscipline: 0,
    institutionalEmbeddedness: tierInstBias,
    riskAppetite: 0,
  };

  const roleBias: Record<keyof Latents, number> = {
    cosmopolitanism: cosmoRoleBias,
    publicness: publicRoleBias,
    opsecDiscipline: opsecRoleBias,
    institutionalEmbeddedness: instRoleBias,
    riskAppetite: riskRoleBias,
  };

  const values: Latents = {
    cosmopolitanism: clampFixed01k(raw.cosmopolitanism + tierBias.cosmopolitanism + roleBias.cosmopolitanism),
    publicness: clampFixed01k(raw.publicness + tierBias.publicness + roleBias.publicness),
    opsecDiscipline: clampFixed01k(raw.opsecDiscipline + tierBias.opsecDiscipline + roleBias.opsecDiscipline),
    institutionalEmbeddedness: clampFixed01k(raw.institutionalEmbeddedness + tierBias.institutionalEmbeddedness + roleBias.institutionalEmbeddedness),
    riskAppetite: clampFixed01k(raw.riskAppetite + tierBias.riskAppetite + roleBias.riskAppetite),
  };

  return { values, raw, tierBias, roleBias };
}

export function generateAgent(input: GenerateAgentInput): GeneratedAgent {
  const seed = normalizeSeed(input.seed);
  const trace: AgentGenerationTraceV1 | undefined = input.includeTrace
    ? {
        version: 1,
        normalizedSeed: seed,
        facetSeeds: {},
        latents: {
          values: { cosmopolitanism: 0, publicness: 0, opsecDiscipline: 0, institutionalEmbeddedness: 0, riskAppetite: 0 },
          raw: { cosmopolitanism: 0, publicness: 0, opsecDiscipline: 0, institutionalEmbeddedness: 0, riskAppetite: 0 },
          tierBias: { cosmopolitanism: 0, publicness: 0, opsecDiscipline: 0, institutionalEmbeddedness: 0, riskAppetite: 0 },
          roleBias: { cosmopolitanism: 0, publicness: 0, opsecDiscipline: 0, institutionalEmbeddedness: 0, riskAppetite: 0 },
        },
        derived: {},
        fields: {},
      }
    : undefined;

  traceFacet(trace, seed, 'base');
  const base = makeRng(facetSeed(seed, 'base'));

  const birthYear = clampInt(input.birthYear ?? base.int(1960, 2006), 1800, 2525);
  traceSet(trace, 'identity.birthYear', birthYear, { method: input.birthYear != null ? 'override' : 'rng', dependsOn: { facet: 'base' } });
  const vocab = input.vocab;
  if (vocab.version !== 1) throw new Error(`Unsupported agent vocab version: ${String((vocab as { version?: unknown }).version)}`);
  if (!vocab.identity.tierBands.length) throw new Error('Agent vocab missing: identity.tierBands');
  if (!vocab.identity.homeCultures.length) throw new Error('Agent vocab missing: identity.homeCultures');
  if (!vocab.identity.roleSeedTags.length) throw new Error('Agent vocab missing: identity.roleSeedTags');
  if (!vocab.identity.firstNames.length || !vocab.identity.lastNames.length) throw new Error('Agent vocab missing: identity name pools');
  if (!vocab.identity.languages.length) throw new Error('Agent vocab missing: identity.languages');

  const tierBand: TierBand = input.tierBand ?? base.pick(vocab.identity.tierBands as readonly TierBand[]);
  traceSet(trace, 'identity.tierBand', tierBand, { method: input.tierBand ? 'override' : 'rng', dependsOn: { facet: 'base', poolSize: vocab.identity.tierBands.length } });

  const countries = input.countries;
  const validCountries = countries.filter((c) => typeof c.iso3 === 'string' && c.iso3.trim().length === 3);
  if (!validCountries.length) throw new Error('Agent country map missing: no ISO3 entries');
  traceFacet(trace, seed, 'origin');
  const originRng = makeRng(facetSeed(seed, 'origin'));
  const origin = originRng.pick(validCountries);
  const homeCountryIso3 = origin.iso3.trim().toUpperCase();
  const homeCulture = deriveCultureFromShadowContinent(origin.continent);
  traceSet(trace, 'identity.homeCountryIso3', homeCountryIso3, { method: 'pick', dependsOn: { facet: 'origin', poolSize: validCountries.length, continent: origin.continent ?? null } });
  traceSet(trace, 'identity.homeCulture', homeCulture, { method: 'deriveCultureFromShadowContinent', dependsOn: { continent: origin.continent ?? null } });

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
  const roleSeedTags = (input.roleSeedTags?.length ? input.roleSeedTags : base.pickK(vocab.identity.roleSeedTags, 2))
    .slice(0, 4);
  traceSet(trace, 'identity.roleSeedTags', roleSeedTags, { method: input.roleSeedTags?.length ? 'override' : 'rng', dependsOn: { facet: 'base', poolSize: vocab.identity.roleSeedTags.length } });

  traceFacet(trace, seed, 'latents');
  const latentModel = computeLatents(seed, tierBand, roleSeedTags);
  const latents = latentModel.values;
  if (trace) trace.latents = latentModel;
  const cosmo01 = latents.cosmopolitanism / 1000;
  const public01 = latents.publicness / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const inst01 = latents.institutionalEmbeddedness / 1000;
  const risk01 = latents.riskAppetite / 1000;
  traceSet(trace, 'latents.values', latents, { method: 'computeLatents', dependsOn: { tierBand, roleSeedTags } });

  const cultureCountries = validCountries.filter((c) => deriveCultureFromShadowContinent(c.continent) === homeCulture);
  traceFacet(trace, seed, 'citizenship');
  const citizenshipRng = makeRng(facetSeed(seed, 'citizenship'));
  const citizenshipFlip = Math.min(
    0.65,
    0.05 + 0.35 * cosmo01 + (roleSeedTags.includes('diplomat') ? 0.12 : 0) + (roleSeedTags.includes('operative') ? 0.06 : 0),
  );
  const citizenshipOrigin = (citizenshipRng.next01() < citizenshipFlip && cultureCountries.length)
    ? citizenshipRng.pick(cultureCountries)
    : origin;
  const citizenshipCountryIso3 = citizenshipOrigin.iso3.trim().toUpperCase();
  traceSet(trace, 'identity.citizenshipCountryIso3', citizenshipCountryIso3, { method: 'probabilisticPick', dependsOn: { facet: 'citizenship', citizenshipFlip, cultureCountryPoolSize: cultureCountries.length } });

  traceFacet(trace, seed, 'current_country');
  const currentRng = makeRng(facetSeed(seed, 'current_country'));
  const roleAbroad =
    (roleSeedTags.includes('diplomat') ? 0.22 : 0) +
    (roleSeedTags.includes('media') ? 0.06 : 0) +
    (roleSeedTags.includes('technocrat') ? 0.05 : 0) +
    (roleSeedTags.includes('operative') ? 0.12 : 0);
  const abroadChance = Math.min(0.88, 0.06 + 0.55 * cosmo01 + roleAbroad);
  const abroad = currentRng.next01() < abroadChance;
  const currentCandidatePool = cultureCountries.length ? cultureCountries : validCountries;
  const abroadPool = currentCandidatePool.filter(c => c.iso3.trim().toUpperCase() !== homeCountryIso3);
  const currentPick = abroad
    ? currentRng.pick(abroadPool.length ? abroadPool : currentCandidatePool)
    : origin;
  const currentCountryIso3 = currentPick.iso3.trim().toUpperCase();
  traceSet(trace, 'identity.currentCountryIso3', currentCountryIso3, { method: 'probabilisticPick', dependsOn: { facet: 'current_country', abroadChance, abroad, poolSize: (abroad ? (abroadPool.length || currentCandidatePool.length) : 1) } });

  const culture = vocab.cultureProfiles?.[homeCulture];
  const cultureWeights = culture?.weights ?? {};
  // Hybrid model: higher cosmopolitanism → more global mixing (lower primary weights).
  const namesPrimaryWeight = clamp01((cultureWeights.namesPrimaryWeight ?? 0.75) - 0.45 * cosmo01, 0.75);
  const languagesPrimaryWeight = clamp01((cultureWeights.languagesPrimaryWeight ?? 0.85) - 0.45 * cosmo01, 0.85);
  const foodPrimaryWeight = clamp01((cultureWeights.foodPrimaryWeight ?? 0.7) - 0.25 * cosmo01, 0.7);
  const mediaPrimaryWeight = clamp01((cultureWeights.mediaPrimaryWeight ?? 0.7) - 0.35 * cosmo01, 0.7);
  const fashionPrimaryWeight = clamp01((cultureWeights.fashionPrimaryWeight ?? 0.6) - 0.30 * cosmo01, 0.6);
  if (trace) {
    trace.derived.primaryWeights = { namesPrimaryWeight, languagesPrimaryWeight, foodPrimaryWeight, mediaPrimaryWeight, fashionPrimaryWeight };
    trace.derived.homeCultureProfilePresent = !!culture;
  }

  traceFacet(trace, seed, 'identity_tracks');
  const identityRng = makeRng(facetSeed(seed, 'identity_tracks'));
  const educationTracks = uniqueStrings(vocab.identity.educationTracks ?? []);
  const careerTracks = uniqueStrings(vocab.identity.careerTracks ?? []);

  const careerNudges: Record<string, string> = {
    diplomat: 'foreign-service',
    operative: 'intelligence',
    security: 'military',
    media: 'journalism',
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
  traceSet(trace, 'identity.careerTrackTag', careerTrackTag, { method: 'weightedPick', dependsOn: { facet: 'identity_tracks', roleNudgedCareer: roleNudgedCareer ?? null, inst01, risk01 } });

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
  traceSet(trace, 'identity.educationTrackTag', educationTrackTag, { method: 'weightedPick', dependsOn: { facet: 'identity_tracks', tierBand, careerTrackTag, inst01 } });

  traceFacet(trace, seed, 'name');
  const nameRng = makeRng(facetSeed(seed, 'name'));
  const cultureFirst = culture?.identity?.firstNames ?? [];
  const cultureLast = culture?.identity?.lastNames ?? [];
  const useCultureFirst = cultureFirst.length > 0 && nameRng.next01() < namesPrimaryWeight;
  const useCultureLast = cultureLast.length > 0 && nameRng.next01() < namesPrimaryWeight;
  const firstName = nameRng.pick(useCultureFirst ? cultureFirst : vocab.identity.firstNames);
  const lastName = nameRng.pick(useCultureLast ? cultureLast : vocab.identity.lastNames);
  const name = `${firstName} ${lastName}`;
  traceSet(trace, 'identity.name', name, { method: 'hybridPick', dependsOn: { facet: 'name', namesPrimaryWeight, useCultureFirst, useCultureLast, cultureFirstPoolSize: cultureFirst.length, cultureLastPoolSize: cultureLast.length } });

  traceFacet(trace, seed, 'languages');
  const langRng = makeRng(facetSeed(seed, 'languages'));
  const cultureLangs = uniqueStrings(culture?.identity?.languages ?? []);
  const baseLangs = uniqueStrings(vocab.identity.languages);
  const unionLangs = uniqueStrings([...cultureLangs, ...baseLangs]);
  const getLanguageEnv01k = (iso3: string): Record<string, Fixed> | null => {
    const bucket = input.priors?.countries?.[iso3]?.buckets?.[String(cohortBucketStartYear)];
    const env = bucket?.languages01k;
    return env && typeof env === 'object' ? (env as Record<string, Fixed>) : null;
  };
  const homeLangEnv01k = getLanguageEnv01k(homeCountryIso3);
  const citizenshipLangEnv01k = citizenshipCountryIso3 !== homeCountryIso3 ? getLanguageEnv01k(citizenshipCountryIso3) : null;
  const currentLangEnv01k = currentCountryIso3 !== homeCountryIso3 ? getLanguageEnv01k(currentCountryIso3) : null;

  const maxHomeWeight = homeLangEnv01k ? Math.max(0, ...Object.values(homeLangEnv01k).map(Number)) : null;
  const homeDiversity01 = maxHomeWeight != null ? clamp01(1 - maxHomeWeight / 1000, 0) : 0;

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
      ? Object.entries(env).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 8).map(([language, weight01k]) => ({ language, weight01k: Number(weight01k) }))
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
  traceSet(trace, 'identity.languageProficiencies', languageProficiencies, { method: 'env+perLanguageBand', dependsOn: { facet: 'language_proficiency', tierBand, cosmo01 } });

  traceFacet(trace, seed, 'appearance');
  const appearanceRng = makeRng(facetSeed(seed, 'appearance'));
  if (!vocab.appearance.heightBands.length) throw new Error('Agent vocab missing: appearance.heightBands');
  if (!vocab.appearance.buildTags.length) throw new Error('Agent vocab missing: appearance.buildTags');
  if (!vocab.appearance.hairColors.length || !vocab.appearance.hairTextures.length) throw new Error('Agent vocab missing: appearance hair pools');
  if (!vocab.appearance.eyeColors.length) throw new Error('Agent vocab missing: appearance.eyeColors');
  if (!vocab.appearance.voiceTags.length) throw new Error('Agent vocab missing: appearance.voiceTags');

  const heightBand = (() => {
    const pool = vocab.appearance.heightBands as readonly HeightBand[];
    const priors = countryPriorsBucket?.appearance?.heightBandWeights01k;
    if (!priors) return appearanceRng.pick(pool);
    const weights = pool.map((b) => ({ item: b, weight: Number(priors[b] ?? 0) || 0 }));
    return weightedPick(appearanceRng, weights) as HeightBand;
  })();
  const buildTag = appearanceRng.pick(vocab.appearance.buildTags);
  const hair = { color: appearanceRng.pick(vocab.appearance.hairColors), texture: appearanceRng.pick(vocab.appearance.hairTextures) };
  const eyes = { color: appearanceRng.pick(vocab.appearance.eyeColors) };
  const voiceTag = appearanceRng.pick(vocab.appearance.voiceTags);
  const distinguishingMarks = appearanceRng.pickK(vocab.appearance.distinguishingMarks, appearanceRng.int(0, 2));
  traceSet(trace, 'appearance', { heightBand, buildTag, hair, eyes, voiceTag, distinguishingMarks }, { method: 'pick', dependsOn: { facet: 'appearance' } });

  traceFacet(trace, seed, 'capabilities');
  const capRng = makeRng(facetSeed(seed, 'capabilities'));
  const physical = capRng.int(200, 900);
  const coordination = capRng.int(200, 900);
  const cognitive = capRng.int(200, 900);
  const social = capRng.int(200, 900);

  const aptitudes = {
    strength: clampFixed01k(0.75 * physical + 0.25 * capRng.int(0, 1000) - (tierBand === 'elite' ? 30 : 0)),
    endurance: clampFixed01k(0.70 * physical + 0.30 * capRng.int(0, 1000)),
    dexterity: clampFixed01k(0.60 * coordination + 0.40 * capRng.int(0, 1000)),
    reflexes: clampFixed01k(0.75 * coordination + 0.25 * capRng.int(0, 1000)),
    handEyeCoordination: clampFixed01k(0.80 * coordination + 0.20 * capRng.int(0, 1000)),

    cognitiveSpeed: clampFixed01k(0.70 * cognitive + 0.30 * capRng.int(0, 1000)),
    attentionControl: clampFixed01k(0.55 * cognitive + 0.45 * capRng.int(0, 1000)),
    workingMemory: clampFixed01k(0.65 * cognitive + 0.35 * capRng.int(0, 1000)),
    riskCalibration: clampFixed01k(0.45 * cognitive + 0.55 * capRng.int(0, 1000)),

    charisma: clampFixed01k(0.75 * social + 0.25 * capRng.int(0, 1000)),
    empathy: clampFixed01k(0.55 * social + 0.45 * capRng.int(0, 1000)),
    assertiveness: clampFixed01k(0.50 * social + 0.50 * capRng.int(0, 1000)),
    deceptionAptitude: clampFixed01k(0.40 * social + 0.60 * capRng.int(0, 1000)),
  };
  traceSet(trace, 'capabilities.aptitudes', aptitudes, { method: 'formula', dependsOn: { facet: 'capabilities', physical, coordination, cognitive, social, tierBand } });

  traceFacet(trace, seed, 'psych_traits');
  const traitRng = makeRng(facetSeed(seed, 'psych_traits'));
  const traits = {
    riskTolerance: clampFixed01k(0.35 * (1000 - aptitudes.riskCalibration) + 0.35 * latents.riskAppetite + 0.30 * traitRng.int(0, 1000)),
    conscientiousness: clampFixed01k(0.55 * aptitudes.attentionControl + 0.25 * latents.opsecDiscipline + 0.20 * traitRng.int(0, 1000)),
    noveltySeeking: clampFixed01k(0.55 * aptitudes.cognitiveSpeed + 0.25 * latents.cosmopolitanism + 0.20 * traitRng.int(0, 1000)),
    agreeableness: clampFixed01k(0.65 * aptitudes.empathy + 0.15 * (1000 - latents.riskAppetite) + 0.20 * traitRng.int(0, 1000)),
    authoritarianism: clampFixed01k(0.55 * aptitudes.assertiveness + 0.25 * latents.institutionalEmbeddedness + 0.20 * traitRng.int(0, 1000)),
  };
  traceSet(trace, 'psych.traits', traits, { method: 'formula', dependsOn: { facet: 'psych_traits', latents: latentModel.values, aptitudes } });

  // Shared derived: vice tendency used by vices, health, and some media/routines.
  const viceTendency = 0.35 * risk01 + 0.25 * (1 - opsec01) + 0.25 * (1 - traits.conscientiousness / 1000) + 0.15 * (public01);
  if (trace) trace.derived.viceTendency = viceTendency;

  const redLinePool = uniqueStrings(vocab.psych?.redLines ?? []);
  const roleRedLinePool = roleSeedTags.flatMap(r => vocab.psych?.redLineByRole?.[r] ?? []);
  traceFacet(trace, seed, 'red_lines');
  const redLineRng = makeRng(facetSeed(seed, 'red_lines'));
  const redLineCount = clampInt(1 + Math.round((traits.agreeableness + traits.conscientiousness) / 1000), 1, 3);
  const redLines = redLinePool.length
    ? pickKHybrid(redLineRng, uniqueStrings(roleRedLinePool), redLinePool, redLineCount, Math.min(redLineCount, 2))
    : redLineRng.pickK(['harm-to-civilians', 'torture', 'personal-corruption'] as const, redLineCount);
  traceSet(trace, 'identity.redLines', redLines, { method: 'hybridPickK', dependsOn: { facet: 'red_lines', redLineCount, rolePoolSize: roleRedLinePool.length, globalPoolSize: redLinePool.length } });

  traceFacet(trace, seed, 'visibility');
  const visRng = makeRng(facetSeed(seed, 'visibility'));
  const publicVisibility = clampFixed01k(0.70 * latents.publicness + 0.30 * visRng.int(0, 1000));
  const paperTrail = clampFixed01k(
    0.65 * latents.institutionalEmbeddedness +
      0.35 * visRng.int(0, 1000) +
      (careerTrackTag === 'civil-service' || careerTrackTag === 'law' ? 80 : 0),
  );
  const digitalHygiene = clampFixed01k(
    0.50 * aptitudes.attentionControl +
      0.30 * latents.opsecDiscipline +
      0.20 * visRng.int(0, 1000),
  );
  traceSet(trace, 'visibility', { publicVisibility, paperTrail, digitalHygiene }, { method: 'formula', dependsOn: { facet: 'visibility', latents: latentModel.values, aptitudes, careerTrackTag } });

  traceFacet(trace, seed, 'health');
  const healthRng = makeRng(facetSeed(seed, 'health'));
  const chronicPool = uniqueStrings(vocab.health?.chronicConditionTags ?? []);
  const allergyPool = uniqueStrings(vocab.health?.allergyTags ?? []);
  const age = clampInt(new Date().getFullYear() - birthYear, 0, 120);
  const endurance01 = aptitudes.endurance / 1000;
  const chronicChance = Math.min(0.65, Math.max(0.04, age / 210 + 0.10 * (1 - endurance01) + 0.10 * viceTendency));
  const chronicConditionTags = chronicPool.length && healthRng.next01() < chronicChance ? healthRng.pickK(chronicPool, healthRng.int(0, 1)) : [];
  const allergyChance = 0.22 + 0.10 * (traits.agreeableness / 1000);
  const allergyTags = allergyPool.length && healthRng.next01() < allergyChance ? healthRng.pickK(allergyPool, 1) : [];
  traceSet(trace, 'health', { chronicConditionTags, allergyTags }, { method: 'probabilisticPickK', dependsOn: { facet: 'health', age, endurance01, viceTendency, chronicChance, allergyChance, chronicPoolSize: chronicPool.length, allergyPoolSize: allergyPool.length } });

  traceFacet(trace, seed, 'covers');
  const coverRng = makeRng(facetSeed(seed, 'covers'));
  const coverPool = uniqueStrings(vocab.covers?.coverAptitudeTags ?? []);
  const coverForced: string[] = [];
  const addCover = (tag: string) => {
    if (!coverPool.includes(tag)) return;
    if (coverForced.includes(tag)) return;
    coverForced.push(tag);
  };
  const coverByCareer: Record<string, string[]> = {
    'foreign-service': ['diplomatic-staff', 'trade-delegate', 'consultant'],
    intelligence: ['consultant', 'freelancer', 'business-development'],
    military: ['logistics-contractor', 'consultant', 'trade-delegate'],
    journalism: ['journalist', 'freelancer', 'consultant'],
    engineering: ['engineer', 'consultant', 'business-development'],
    academia: ['academic', 'consultant', 'freelancer'],
    ngo: ['ngo-worker', 'aid-worker', 'freelancer'],
    'public-health': ['aid-worker', 'ngo-worker', 'consultant'],
    logistics: ['logistics-contractor', 'business-development', 'consultant'],
    politics: ['consultant', 'business-development', 'trade-delegate'],
    law: ['consultant', 'trade-delegate', 'business-development'],
    'corporate-ops': ['business-development', 'consultant', 'freelancer'],
    'organized-labor': ['ngo-worker', 'consultant', 'freelancer'],
    'civil-service': ['consultant', 'trade-delegate', 'diplomatic-staff'],
    finance: ['business-development', 'consultant', 'freelancer'],
  };
  for (const tag of coverByCareer[careerTrackTag] ?? []) addCover(tag);
  if (public01 > 0.7) addCover('journalist');
  if (opsec01 > 0.7) addCover('consultant');
  const coverAptitudeTags = coverPool.length
    ? uniqueStrings([
        ...coverForced.slice(0, 2),
        ...coverRng.pickK(coverPool.filter(x => !coverForced.includes(x)), Math.max(0, 3 - coverForced.slice(0, 2).length)),
      ]).slice(0, 3)
    : coverRng.pickK(['consultant', 'ngo-worker', 'tourist'] as const, 3);
  traceSet(trace, 'covers.coverAptitudeTags', coverAptitudeTags, { method: 'forcedPlusPickK', dependsOn: { facet: 'covers', careerTrackTag, forced: coverForced.slice(0, 2), poolSize: coverPool.length } });

  traceFacet(trace, seed, 'mobility');
  const mobilityRng = makeRng(facetSeed(seed, 'mobility'));
  const mobilityTags = uniqueStrings(vocab.mobility?.mobilityTags ?? []);
  const mobilityTag = (() => {
    const pool = mobilityTags.length ? mobilityTags : ['low-mobility', 'regional-travel', 'frequent-flyer', 'nomadic'];
    const weights = pool.map((t) => {
      let w = 1;
      if (cosmo01 > 0.7 && ['frequent-flyer', 'nomadic'].includes(t)) w += 2.0;
      if (cosmo01 < 0.35 && t === 'low-mobility') w += 2.2;
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
      (roleSeedTags.includes('diplomat') ? 220 : 0) +
      (roleSeedTags.includes('operative') ? 140 : 0) +
      mobilityRng.int(0, 1000) * 0.20,
  );
  const travelEnv = countryPriorsBucket?.mobility01k?.travelFrequency;
  const travelScore = travelEnv != null
    ? clampFixed01k(0.50 * travelEnv + 0.50 * travelModelScoreRaw)
    : travelModelScoreRaw;
  const travelFrequencyBand = band5From01k(travelScore);
  traceSet(trace, 'mobility', { mobilityTag, passportAccessBand, travelFrequencyBand }, { method: 'weightedPick+env+formula', dependsOn: { facet: 'mobility', tierBand, cosmo01, inst01, public01, roleSeedTags, passportEnv: passportEnv ?? null, travelEnv: travelEnv ?? null } });

  traceFacet(trace, seed, 'skills');
  const skillRng = makeRng(facetSeed(seed, 'skills'));
  const skillTrace: Record<string, unknown> = {};

  if (!vocab.capabilities.skillKeys.length) throw new Error('Agent vocab missing: capabilities.skillKeys');

  const skills: GeneratedAgent['capabilities']['skills'] = Object.fromEntries(
    vocab.capabilities.skillKeys.map((k) => {
      const noise = clampFixed01k(skillRng.int(0, 1000));
      const careerBonus =
        (careerTrackTag === 'military' && ['shooting', 'tradecraft', 'surveillance', 'driving'].includes(k) ? 120 : 0) +
        (careerTrackTag === 'intelligence' && ['tradecraft', 'surveillance', 'shooting', 'driving', 'legalOps'].includes(k) ? 140 : 0) +
        (careerTrackTag === 'foreign-service' && ['negotiation', 'bureaucracy', 'mediaHandling', 'driving'].includes(k) ? 120 : 0) +
        (careerTrackTag === 'journalism' && ['mediaHandling', 'surveillance', 'negotiation'].includes(k) ? 120 : 0) +
        (careerTrackTag === 'law' && ['legalOps', 'bureaucracy', 'negotiation'].includes(k) ? 140 : 0) +
        (careerTrackTag === 'public-health' && ['firstAid', 'bureaucracy', 'negotiation'].includes(k) ? 120 : 0) +
        (careerTrackTag === 'finance' && ['financeOps', 'bureaucracy', 'negotiation'].includes(k) ? 120 : 0) +
        (careerTrackTag === 'logistics' && ['driving', 'tradecraft', 'bureaucracy'].includes(k) ? 120 : 0);

      const tierBonus = tierBand === 'elite' ? 60 : tierBand === 'mass' ? -20 : 0;

      const baseTerms: Record<string, Fixed> = {};
      const add = (name: string, value: Fixed) => {
        baseTerms[name] = value;
      };

      // Skills are derived from a few aptitudes + latent factors, plus per-skill noise for variety.
      let value: Fixed;
      switch (k) {
        case 'driving': {
          add('dexterity', aptitudes.dexterity);
          add('handEyeCoordination', aptitudes.handEyeCoordination);
          add('attentionControl', aptitudes.attentionControl);
          add('riskTolerance', traits.riskTolerance);
          add('travelScore', travelScore);
          value = clampFixed01k(
            0.22 * aptitudes.dexterity +
              0.22 * aptitudes.handEyeCoordination +
              0.20 * aptitudes.attentionControl +
              0.12 * traits.riskTolerance +
              0.12 * travelScore +
              0.12 * noise +
              careerBonus +
              tierBonus,
          );
          break;
        }
        case 'shooting': {
          add('reflexes', aptitudes.reflexes);
          add('handEyeCoordination', aptitudes.handEyeCoordination);
          add('attentionControl', aptitudes.attentionControl);
          add('opsecDiscipline', latents.opsecDiscipline);
          value = clampFixed01k(
            0.26 * aptitudes.reflexes +
              0.24 * aptitudes.handEyeCoordination +
              0.18 * aptitudes.attentionControl +
              0.12 * latents.opsecDiscipline +
              0.20 * noise +
              careerBonus +
              tierBonus,
          );
          break;
        }
        case 'surveillance': {
          add('cognitiveSpeed', aptitudes.cognitiveSpeed);
          add('attentionControl', aptitudes.attentionControl);
          add('workingMemory', aptitudes.workingMemory);
          add('opsecDiscipline', latents.opsecDiscipline);
          value = clampFixed01k(
            0.22 * aptitudes.cognitiveSpeed +
              0.22 * aptitudes.attentionControl +
              0.18 * aptitudes.workingMemory +
              0.18 * latents.opsecDiscipline +
              0.20 * noise +
              careerBonus,
          );
          break;
        }
        case 'tradecraft': {
          add('opsecDiscipline', latents.opsecDiscipline);
          add('deceptionAptitude', aptitudes.deceptionAptitude);
          add('riskAppetite', latents.riskAppetite);
          add('workingMemory', aptitudes.workingMemory);
          value = clampFixed01k(
            0.28 * latents.opsecDiscipline +
              0.22 * aptitudes.deceptionAptitude +
              0.12 * latents.riskAppetite +
              0.18 * aptitudes.workingMemory +
              0.20 * noise +
              careerBonus +
              (roleSeedTags.includes('operative') ? 90 : 0),
          );
          break;
        }
        case 'firstAid': {
          add('workingMemory', aptitudes.workingMemory);
          add('attentionControl', aptitudes.attentionControl);
          add('conscientiousness', traits.conscientiousness);
          value = clampFixed01k(
            0.25 * aptitudes.workingMemory +
              0.20 * aptitudes.attentionControl +
              0.25 * traits.conscientiousness +
              0.30 * noise +
              careerBonus +
              tierBonus,
          );
          break;
        }
        case 'negotiation': {
          add('charisma', aptitudes.charisma);
          add('empathy', aptitudes.empathy);
          add('workingMemory', aptitudes.workingMemory);
          add('publicness', latents.publicness);
          value = clampFixed01k(
            0.30 * aptitudes.charisma +
              0.20 * aptitudes.empathy +
              0.18 * aptitudes.workingMemory +
              0.12 * latents.publicness +
              0.20 * noise +
              careerBonus +
              tierBonus,
          );
          break;
        }
        case 'mediaHandling': {
          add('publicness', latents.publicness);
          add('charisma', aptitudes.charisma);
          add('attentionControl', aptitudes.attentionControl);
          add('opsecDiscipline', latents.opsecDiscipline);
          value = clampFixed01k(
            0.30 * latents.publicness +
              0.20 * aptitudes.charisma +
              0.18 * aptitudes.attentionControl +
              0.12 * (1000 - latents.opsecDiscipline) +
              0.20 * noise +
              careerBonus +
              (roleSeedTags.includes('media') ? 90 : 0),
          );
          break;
        }
        case 'bureaucracy': {
          add('institutionalEmbeddedness', latents.institutionalEmbeddedness);
          add('workingMemory', aptitudes.workingMemory);
          add('conscientiousness', traits.conscientiousness);
          value = clampFixed01k(
            0.28 * latents.institutionalEmbeddedness +
              0.22 * aptitudes.workingMemory +
              0.18 * traits.conscientiousness +
              0.32 * noise +
              careerBonus +
              tierBonus,
          );
          break;
        }
        case 'financeOps': {
          add('workingMemory', aptitudes.workingMemory);
          add('cognitiveSpeed', aptitudes.cognitiveSpeed);
          add('conscientiousness', traits.conscientiousness);
          value = clampFixed01k(
            0.24 * aptitudes.workingMemory +
              0.20 * aptitudes.cognitiveSpeed +
              0.18 * traits.conscientiousness +
              0.38 * noise +
              careerBonus +
              tierBonus,
          );
          break;
        }
        case 'legalOps': {
          add('workingMemory', aptitudes.workingMemory);
          add('attentionControl', aptitudes.attentionControl);
          add('institutionalEmbeddedness', latents.institutionalEmbeddedness);
          value = clampFixed01k(
            0.24 * aptitudes.workingMemory +
              0.20 * aptitudes.attentionControl +
              0.18 * latents.institutionalEmbeddedness +
              0.38 * noise +
              careerBonus +
              tierBonus,
          );
          break;
        }
        default: {
          // Generic skill: primarily cognitive + attention + some noise.
          add('cognitiveSpeed', aptitudes.cognitiveSpeed);
          add('attentionControl', aptitudes.attentionControl);
          add('workingMemory', aptitudes.workingMemory);
          value = clampFixed01k(
            0.22 * aptitudes.cognitiveSpeed +
              0.22 * aptitudes.attentionControl +
              0.18 * aptitudes.workingMemory +
              0.38 * noise +
              careerBonus,
          );
          break;
        }
      }

      // Mild floor/ceiling for readability.
      value = clampFixed01k(clampInt(value, 90, 940));

      const xp = clampFixed01k(clampInt(Math.round((value / 1000) * 520) + skillRng.int(0, 180), 0, 500));
      skillTrace[k] = { noise, baseTerms, careerBonus, tierBonus, baseValue: value, xp };
      return [k, { value, xp, lastUsedDay: null }];
    }),
  ) as GeneratedAgent['capabilities']['skills'];

  // Role seed nudges (bounded)
  const bump = (key: string, delta: number) => {
    const entry = skills[key];
    if (!entry) return;
    entry.value = clampFixed01k(entry.value + delta);
  };

  for (const tag of roleSeedTags) {
    const bumps = vocab.capabilities.roleSkillBumps[tag];
    if (!bumps) continue;
    for (const [skillKey, delta] of Object.entries(bumps)) bump(skillKey, delta);
  }
  if (trace) trace.derived.skillTrace = skillTrace;
  traceSet(trace, 'capabilities.skills', skills, { method: 'derived+roleBumps', dependsOn: { facet: 'skills', roleSeedTags, careerTrackTag, tierBand } });

  traceFacet(trace, seed, 'preferences');
  const prefsRng = makeRng(facetSeed(seed, 'preferences'));
  if (!vocab.preferences.food.comfortFoods.length) throw new Error('Agent vocab missing: preferences.food.comfortFoods');
  if (!vocab.preferences.food.dislikes.length) throw new Error('Agent vocab missing: preferences.food.dislikes');
  if (!vocab.preferences.food.restrictions.length) throw new Error('Agent vocab missing: preferences.food.restrictions');
  if (!vocab.preferences.food.ritualDrinks.length) throw new Error('Agent vocab missing: preferences.food.ritualDrinks');

  const getFoodEnv01k = (iso3: string): FoodEnv01k | null => {
    const bucket = input.priors?.countries?.[iso3]?.buckets?.[String(cohortBucketStartYear)];
    return normalizeFoodEnv01k(bucket?.foodEnvironment01k as Partial<Record<FoodEnvAxis, Fixed>> | null | undefined);
  };
  const homeFoodEnv01k = getFoodEnv01k(homeCountryIso3);
  const citizenshipFoodEnv01k = citizenshipCountryIso3 !== homeCountryIso3 ? getFoodEnv01k(citizenshipCountryIso3) : null;
  const currentFoodEnv01k = currentCountryIso3 !== homeCountryIso3 ? getFoodEnv01k(currentCountryIso3) : null;

  const foodEnv01k = homeFoodEnv01k
    ? mixFoodEnv01k([
        { env: homeFoodEnv01k, weight: 1 },
        ...(citizenshipFoodEnv01k ? [{ env: citizenshipFoodEnv01k, weight: 0.10 + 0.25 * cosmo01 }] : []),
        ...(currentFoodEnv01k ? [{ env: currentFoodEnv01k, weight: 0.15 + 0.35 * cosmo01 + (abroad ? 0.15 : 0) }] : []),
      ])
    : null;

  const topAxes = (env: FoodEnv01k | null) =>
    env
      ? [...FOOD_ENV_AXES]
          .map(axis => ({ axis, value01k: env[axis] }))
          .sort((a, b) => b.value01k - a.value01k)
          .slice(0, 5)
      : null;
  if (trace) {
    trace.derived.foodEnv = {
      home: topAxes(homeFoodEnv01k),
      citizenship: topAxes(citizenshipFoodEnv01k),
      current: topAxes(currentFoodEnv01k),
      blended: topAxes(foodEnv01k),
    };
  }

  const axis01 = (axis: FoodEnvAxis, fallback: number) => (foodEnv01k ? foodEnv01k[axis] / 1000 : fallback);

  const cultureComfort = uniqueStrings(culture?.preferences?.food?.comfortFoods ?? []);
  const cultureDrinks = uniqueStrings(culture?.preferences?.food?.ritualDrinks ?? []);

  const allRestrictionsPool = uniqueStrings(vocab.preferences.food.restrictions);
  let restrictions: string[] = [];
  const forcedRestrictions: Array<{ restriction: string; reason: string }> = [];
  const ensureRestriction = (restriction: string, reason: string) => {
    if (!restriction.trim()) return;
    if (restrictions.includes(restriction)) return;
    restrictions.push(restriction);
    forcedRestrictions.push({ restriction, reason });
  };

  const arabicMass01 = (() => {
    const home = (homeLangEnv01k?.Arabic ?? 0) / 1000;
    const citizenship = citizenshipLangEnv01k ? (citizenshipLangEnv01k.Arabic ?? 0) / 1000 : 0;
    const current = currentLangEnv01k ? (currentLangEnv01k.Arabic ?? 0) / 1000 : 0;
    return clamp01(home + 0.35 * cosmo01 * citizenship + 0.45 * cosmo01 * current, 0);
  })();
  const hebrewMass01 = (() => {
    const home = (homeLangEnv01k?.Hebrew ?? 0) / 1000;
    const citizenship = citizenshipLangEnv01k ? (citizenshipLangEnv01k.Hebrew ?? 0) / 1000 : 0;
    const current = currentLangEnv01k ? (currentLangEnv01k.Hebrew ?? 0) / 1000 : 0;
    return clamp01(home + 0.35 * cosmo01 * citizenship + 0.45 * cosmo01 * current, 0);
  })();

  const restrictionWeight = (restriction: string): number => {
    const r = restriction.toLowerCase();
    let w = 1;
    if (r === 'vegetarian') w += 2.2 * axis01('plantForward', 0.45) - 1.5 * axis01('meat', 0.45);
    if (r === 'pescatarian') w += 1.4 * axis01('seafood', 0.35) - 0.9 * axis01('meat', 0.45);
    if (r === 'low sugar') w += 0.8 + 1.4 * (1 - axis01('sweets', 0.45));
    if (r === 'low sodium') w += 0.9 + 0.6 * (1 - axis01('friedOily', 0.45));
    if (r === 'halal') w += 0.6 + 2.8 * arabicMass01;
    if (r === 'kosher') w += 0.6 + 2.8 * hebrewMass01;
    if (r === 'no alcohol') w += 0.7 + 0.6 * (1 - viceTendency);
    if (r === 'lactose-sensitive') w += 0.4 + 0.6 * (1 - axis01('dairy', 0.45));
    if (r === 'gluten-sensitive') w += 0.4 + 0.4 * (1 - axis01('streetFood', 0.45));
    if (r === 'nut allergy') w += 0.3;
    if (r === 'shellfish allergy') w += 0.3;
    return Math.max(0.05, w);
  };

  const baseRestrictionCount = prefsRng.int(0, 1);
  restrictions = allRestrictionsPool.length
    ? weightedPickKUnique(
        prefsRng,
        allRestrictionsPool.map(item => ({ item, weight: restrictionWeight(item) })),
        baseRestrictionCount,
      )
    : [];

  // Enforce health/allergy → restriction consistency (vocab-aligned when possible).
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

    // Restrictions/health: avoid direct contradictions where possible.
    if (hasRestriction('vegetarian') && likelyMeat(item)) w *= 0.15;
    if (hasRestriction('pescatarian') && likelyMeat(item)) w *= 0.35;
    if ((hasRestriction('lactose-sensitive') || allergyTags.includes('dairy')) && likelyDairy(item)) w *= 0.25;
    if ((hasRestriction('gluten-sensitive') || allergyTags.includes('gluten')) && likelyGluten(item)) w *= 0.25;
    if ((hasRestriction('shellfish allergy') || allergyTags.includes('shellfish')) && likelySeafood(item)) w *= 0.35;
    if (hasRestriction('low sugar') && (s.includes('dessert') || s.includes('pastr'))) w *= 0.35;
    return Math.max(0.05, w);
  };
  const comfortFoods = weightedPickKUnique(prefsRng, comfortPool.map(item => ({ item, weight: comfortWeight(item) })), 2);

  const drinkPool = uniqueStrings([...cultureDrinks, ...vocab.preferences.food.ritualDrinks]);
  const drinkWeight = (drink: string): number => {
    const s = drink.toLowerCase();
    let w = 1;
    if (cultureDrinks.includes(drink)) w += 0.9 + 1.8 * foodPrimaryWeight;

    const caffeinated = s.includes('coffee') || s.includes('espresso') || s.includes('mate');
    const teaish = s.includes('tea');
    const sweetish = s.includes('cocoa');
    const hydrating = s.includes('water') || s.includes('seltzer');

    if (foodEnv01k) {
      if (caffeinated) w += 2.2 * axis01('caffeine', 0.5);
      if (teaish) w += 1.2 * (0.6 + 0.4 * axis01('caffeine', 0.4));
      if (sweetish) w += 1.2 * axis01('sweets', 0.5);
      if (hydrating) w += 0.7 + 0.8 * (1 - axis01('caffeine', 0.45));
    }

    // Health consistency: insomnia/migraine usually pushes away from caffeine.
    if (caffeinated && chronicConditionTags.includes('insomnia')) w *= 0.25;
    if (caffeinated && chronicConditionTags.includes('migraine')) w *= 0.55;
    if (hasRestriction('low sugar') && sweetish) w *= 0.35;
    return Math.max(0.05, w);
  };
  const ritualDrink = weightedPickKUnique(prefsRng, drinkPool.map(item => ({ item, weight: drinkWeight(item) })), 1)[0]!;

  const dislikePool = uniqueStrings(vocab.preferences.food.dislikes);
  const dislikeWeight = (item: string): number => {
    const s = item.toLowerCase();
    let w = 1;
    if ((hasRestriction('lactose-sensitive') || allergyTags.includes('dairy')) && s.includes('dairy')) w += 5;
    if (hasRestriction('low sugar') && (s.includes('sweet') || s.includes('sweet drinks'))) w += 3;
    if (hasRestriction('low sodium') && s.includes('salty')) w += 3;
    if ((hasRestriction('shellfish allergy') || allergyTags.includes('shellfish')) && s.includes('raw fish')) w += 3;
    if ((hasRestriction('vegetarian') || hasRestriction('pescatarian')) && s.includes('red meat')) w += 1.5;
    if (foodEnv01k && s.includes('very spicy')) w += 1.6 * axis01('spice', 0.5);
    if (foodEnv01k && s.includes('oily')) w += 1.4 * axis01('friedOily', 0.5);
    if (foodEnv01k && s.includes('carbonated')) w += 0.8 * (1 - axis01('sweets', 0.5));
    return Math.max(0.05, w);
  };
  let dislikes = dislikePool.length
    ? weightedPickKUnique(prefsRng, dislikePool.map(item => ({ item, weight: dislikeWeight(item) })), prefsRng.int(1, 3))
    : [];

  const forcedDislikes: Array<{ dislike: string; reason: string }> = [];
  const ensureDislike = (dislike: string, reason: string) => {
    if (!dislikePool.includes(dislike)) return;
    if (dislikes.includes(dislike)) return;
    dislikes.push(dislike);
    forcedDislikes.push({ dislike, reason });
  };

  if (allergyTags.includes('dairy')) ensureDislike('dairy', 'allergy:dairy');
  if (allergyTags.includes('shellfish')) ensureDislike('raw fish', 'allergy:shellfish');
  if (chronicConditionTags.includes('hypertension')) ensureDislike('very salty', 'chronic:hypertension');
  dislikes = uniqueStrings(dislikes).slice(0, 3);

  const incompatibleComfort = (item: string): boolean => {
    if (hasRestriction('vegetarian') && likelyMeat(item)) return true;
    if ((hasRestriction('lactose-sensitive') || allergyTags.includes('dairy')) && likelyDairy(item)) return true;
    if ((hasRestriction('gluten-sensitive') || allergyTags.includes('gluten')) && likelyGluten(item)) return true;
    if ((hasRestriction('shellfish allergy') || allergyTags.includes('shellfish')) && likelySeafood(item)) return true;
    return false;
  };

  const fixupRng = makeRng(facetSeed(seed, 'preferences_food_fixup'));
  const fixups: Array<{ removed: string; replacement: string | null }> = [];
  const replacementPool = comfortPool.filter(c => !incompatibleComfort(c));
  const replaceIfNeeded = () => {
    for (let i = 0; i < comfortFoods.length; i++) {
      const cur = comfortFoods[i]!;
      if (!incompatibleComfort(cur)) continue;
      const candidates = replacementPool.filter(c => !comfortFoods.includes(c));
      const replacement = candidates.length ? candidates[fixupRng.int(0, candidates.length - 1)]! : null;
      fixups.push({ removed: cur, replacement });
      if (replacement) comfortFoods[i] = replacement;
    }
  };
  replaceIfNeeded();

  traceSet(
    trace,
    'preferences.food',
    { comfortFoods, dislikes, restrictions, ritualDrink },
    {
      method: 'env+consistency',
      dependsOn: {
        facet: 'preferences',
        foodPrimaryWeight,
        cultureComfortPoolSize: cultureComfort.length,
        cultureDrinksPoolSize: cultureDrinks.length,
        forcedRestrictions,
        forcedDislikes,
        fixups,
      },
    },
  );

  if (!vocab.preferences.media.genres.length) throw new Error('Agent vocab missing: preferences.media.genres');
  if (!vocab.preferences.media.platforms.length) throw new Error('Agent vocab missing: preferences.media.platforms');
  const cultureGenres = uniqueStrings(culture?.preferences?.media?.genres ?? []);
  const genreTopK = cultureGenres.length && prefsRng.next01() < mediaPrimaryWeight
    ? pickKHybrid(prefsRng, cultureGenres, vocab.preferences.media.genres, 5, 3)
    : prefsRng.pickK(vocab.preferences.media.genres, 5);
  traceSet(trace, 'preferences.media.genreTopK', genreTopK, { method: 'hybridPickK', dependsOn: { facet: 'preferences', mediaPrimaryWeight, cultureGenrePoolSize: cultureGenres.length, globalGenrePoolSize: vocab.preferences.media.genres.length } });
  const platformDietRaw = vocab.preferences.media.platforms.map((p) => {
    const key = p.toLowerCase();
    const envBase = (() => {
      const env = countryPriorsBucket?.mediaEnvironment01k;
      if (!env) return 200;
      const v = env[key as 'print' | 'radio' | 'tv' | 'social' | 'closed'];
      return typeof v === 'number' && Number.isFinite(v) ? v : 200;
    })();
    let bias = 0;
    if (key === 'closed') bias += Math.round(70 * opsec01);
    if (key === 'social') bias += Math.round(65 * public01) - Math.round(40 * opsec01);
    if (key === 'tv') bias += Math.round(30 * public01);
    if (key === 'print') bias += Math.round(45 * inst01);
    if (key === 'radio') bias += Math.round(30 * inst01);
    const w = Math.max(1, Math.round(envBase * 0.9) + prefsRng.int(0, 220) + bias * 6);
    return { p, w, envBase };
  });
  const totalW = platformDietRaw.reduce((s, x) => s + x.w, 0);
  const platformDiet: Record<string, Fixed> = Object.fromEntries(platformDietRaw.map(({ p, w }) => [p, clampInt((w / totalW) * 1000, 0, 1000)]));
  if (trace) trace.derived.platformDietRaw = platformDietRaw.map(({ p, w, envBase }) => ({ p, w, envBase }));
  traceSet(trace, 'preferences.media.platformDiet', platformDiet, { method: 'env+weightedNormalize', dependsOn: { facet: 'preferences', public01, opsec01, inst01, env: countryPriorsBucket?.mediaEnvironment01k ?? null } });

  // Media/cognition traits should correlate with attention, OPSEC, and publicness.
  const attentionResilience = clampFixed01k(
    0.42 * aptitudes.attentionControl +
      0.22 * traits.conscientiousness +
      0.12 * aptitudes.workingMemory +
      0.10 * (1000 - latents.publicness) +
      0.14 * prefsRng.int(0, 1000),
  );
  const doomscrollingRisk = clampFixed01k(
    0.30 * latents.publicness +
      0.22 * (1000 - latents.opsecDiscipline) +
      0.22 * (1000 - traits.conscientiousness) +
      0.10 * traits.noveltySeeking +
      0.16 * prefsRng.int(0, 1000),
  );
  const epistemicHygiene = clampFixed01k(
    0.28 * aptitudes.workingMemory +
      0.20 * aptitudes.attentionControl +
      0.20 * latents.institutionalEmbeddedness +
      0.20 * latents.opsecDiscipline +
      0.12 * prefsRng.int(0, 1000),
  );
  traceSet(trace, 'preferences.media.metrics', { attentionResilience, doomscrollingRisk, epistemicHygiene }, { method: 'formula', dependsOn: { facet: 'preferences', aptitudes, traits, latents: latentModel.values } });

  traceFacet(trace, seed, 'fashion');
  const fashionRng = makeRng(facetSeed(seed, 'fashion'));
  if (!vocab.preferences.fashion.styleTags.length) throw new Error('Agent vocab missing: preferences.fashion.styleTags');
  const cultureStyle = uniqueStrings(culture?.preferences?.fashion?.styleTags ?? []);
  let styleTags = cultureStyle.length && fashionRng.next01() < fashionPrimaryWeight
    ? pickKHybrid(fashionRng, cultureStyle, vocab.preferences.fashion.styleTags, 3, 2)
    : fashionRng.pickK(vocab.preferences.fashion.styleTags, 3);
  // Enforce a little coherence with visibility/opsec/institutional factors.
  const stylePool = uniqueStrings([...cultureStyle, ...vocab.preferences.fashion.styleTags]);
  const forced: string[] = [];
  const addForced = (tag: string) => {
    if (!stylePool.includes(tag)) return;
    if (forced.includes(tag)) return;
    forced.push(tag);
  };
  if (public01 > 0.7) {
    addForced('formal');
    addForced('tailored');
  }
  if (opsec01 > 0.7) {
    addForced('utilitarian');
    addForced('techwear');
  }
  if (inst01 > 0.7) {
    addForced('classic');
    addForced('minimalist');
  }
  if (tierBand === 'elite') addForced('formal');
  for (const tag of forced.slice(0, 2)) {
    if (styleTags.includes(tag)) continue;
    styleTags = uniqueStrings([tag, ...styleTags]).slice(0, 3);
  }
  traceSet(trace, 'preferences.fashion.styleTags', styleTags, { method: 'pickK+forced', dependsOn: { facet: 'fashion', fashionPrimaryWeight, cultureStylePoolSize: cultureStyle.length, forced: forced.slice(0, 2) } });
  const formality = clampFixed01k(
    0.36 * latents.publicness +
      0.32 * latents.institutionalEmbeddedness +
      0.18 * fashionRng.int(0, 1000) +
      (tierBand === 'elite' ? 90 : tierBand === 'mass' ? -40 : 0),
  );
  const conformity = clampFixed01k(
    0.38 * latents.institutionalEmbeddedness +
      0.22 * traits.conscientiousness +
      0.16 * (1000 - traits.noveltySeeking) +
      0.24 * fashionRng.int(0, 1000),
  );
  const statusSignaling = clampFixed01k(
    0.34 * latents.publicness +
      0.26 * (tierBand === 'elite' ? 920 : tierBand === 'middle' ? 600 : 420) +
      0.14 * (1000 - latents.opsecDiscipline) +
      0.26 * fashionRng.int(0, 1000),
  );
  traceSet(trace, 'preferences.fashion.metrics', { formality, conformity, statusSignaling, forced: forced.slice(0, 2) }, { method: 'formula+forcedTags', dependsOn: { facet: 'fashion', latents: latentModel.values, traits, tierBand } });

  traceFacet(trace, seed, 'routines');
  const routinesRng = makeRng(facetSeed(seed, 'routines'));
  if (!vocab.routines.chronotypes.length) throw new Error('Agent vocab missing: routines.chronotypes');
  if (!vocab.routines.recoveryRituals.length) throw new Error('Agent vocab missing: routines.recoveryRituals');
  const chronotypeWeights = vocab.routines.chronotypes.map((t) => {
    const key = t.toLowerCase();
    let w = 1;
    if (key === 'early') w += 1.4 * (traits.conscientiousness / 1000) + 0.6 * (clampInt(new Date().getFullYear() - birthYear, 0, 120) / 120);
    if (key === 'night') w += 1.2 * (traits.noveltySeeking / 1000) + 0.7 * (latents.riskAppetite / 1000);
    if (key === 'standard') w += 0.7;
    if (careerTrackTag === 'journalism' && key === 'night') w += 0.6;
    if (careerTrackTag === 'civil-service' && key === 'early') w += 0.4;
    return { item: t, weight: w };
  });
  const chronotype = weightedPick(routinesRng, chronotypeWeights);
  const sleepWindow = chronotype === 'early' ? '22:00–06:00' : chronotype === 'night' ? '02:00–10:00' : '00:00–08:00';
  const ritualWeights = vocab.routines.recoveryRituals.map((r) => {
    const key = r.toLowerCase();
    let w = 1;
    if (key.includes('gym') || key.includes('run') || key.includes('cardio')) w += 1.2 * (aptitudes.endurance / 1000) + 0.3 * (traits.conscientiousness / 1000);
    if (key.includes('meditation') || key.includes('breath')) w += 0.8 * (traits.conscientiousness / 1000) + 0.8 * ((1000 - aptitudes.attentionControl) / 1000);
    if (key.includes('sleep') || key.includes('nap')) w += 0.6 * ((1000 - aptitudes.endurance) / 1000);
    if (key.includes('reading') || key.includes('journal')) w += 0.7 * (aptitudes.workingMemory / 1000);
    if (key.includes('walk')) w += 0.4 * (aptitudes.endurance / 1000);
    if (key.includes('music')) w += 0.4 * (traits.agreeableness / 1000);
    return { item: r, weight: w };
  });
  const recoveryRituals = weightedPickKUnique(routinesRng, ritualWeights, 2);
  traceSet(trace, 'routines', { chronotype, sleepWindow, recoveryRituals }, { method: 'weightedPick+weightedPickKUnique', dependsOn: { facet: 'routines', traits, aptitudes, careerTrackTag } });

  traceFacet(trace, seed, 'vices');
  const vicesRng = makeRng(facetSeed(seed, 'vices'));
  if (!vocab.vices.vicePool.length) throw new Error('Agent vocab missing: vices.vicePool');
  if (!vocab.vices.triggers.length) throw new Error('Agent vocab missing: vices.triggers');
  const viceCount = viceTendency > 0.78 ? 2 : viceTendency > 0.42 ? 1 : (vicesRng.next01() < 0.22 ? 1 : 0);
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
    return { item: v, weight: w };
  });
  if (trace) trace.derived.viceWeightsTop = [...viceWeights].sort((a, b) => b.weight - a.weight).slice(0, 10);
  const selectedVices = weightedPickKUnique(vicesRng, viceWeights, viceCount);
  const vices = selectedVices.map((vice) => {
    const base = vicesRng.int(100, 950);
    const bias = Math.round(220 * (1 - opsec01) + 180 * risk01 + 120 * public01);
    const severityValue = clampFixed01k(base + bias);
    const triggers = vicesRng.pickK(vocab.vices.triggers, vicesRng.int(1, 3));
    return { vice, severity: band5From01k(severityValue), triggers };
  });
  traceSet(trace, 'vices', vices, { method: 'weightedPickKUnique+severityFormula', dependsOn: { facet: 'vices', viceTendency, viceCount, opsec01, risk01, public01 } });

  traceFacet(trace, seed, 'logistics');
  const logisticsRng = makeRng(facetSeed(seed, 'logistics'));
  if (!vocab.logistics.identityKitItems.length) throw new Error('Agent vocab missing: logistics.identityKitItems');
  const kitWeights = vocab.logistics.identityKitItems.map((item) => {
    const key = item.toLowerCase();
    let w = 1;
    if (key.includes('burner') || key.includes('encrypted') || key.includes('dead drop') || key.includes('lockpick')) {
      w += 2.2 * opsec01 + (roleSeedTags.includes('operative') ? 0.7 : 0) + (careerTrackTag === 'intelligence' ? 0.6 : 0);
    }
    if (key.includes('passport') || key.includes('visa')) w += 1.6 * (travelScore / 1000) + 0.6 * cosmo01;
    if (key.includes('laptop') || key.includes('phone')) w += 0.7 + 0.4 * opsec01;
    if (key.includes('press') || key.includes('camera')) w += 1.6 * public01 + (roleSeedTags.includes('media') ? 0.8 : 0);
    if (key.includes('cash') || key.includes('currency')) w += 0.7 * risk01 + 0.3 * (1 - opsec01);
    if (key.includes('keepsake')) w += 0.2 * (traits.agreeableness / 1000);
    return { item, weight: w };
  });
  if (trace) {
    trace.derived.identityKitWeightsTop = [...kitWeights].sort((a, b) => b.weight - a.weight).slice(0, 8);
  }
  const pickedKitItems = weightedPickKUnique(logisticsRng, kitWeights, 5);
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
  traceSet(trace, 'logistics.identityKit', kitItems, { method: 'weightedPickKUnique+formula', dependsOn: { facet: 'logistics', opsec01, public01, risk01, travelScore, careerTrackTag, tierBand } });

  const id = fnv1a32(`${seed}::${birthYear}::${homeCountryIso3}::${tierBand}`).toString(16);
  traceSet(trace, 'id', id, { method: 'fnv1a32', dependsOn: { normalizedSeed: seed, birthYear, homeCountryIso3, tierBand } });

  return {
    version: 1,
    id,
    seed,
    createdAtIso: new Date().toISOString(),
    generationTrace: trace,
    identity: {
      name,
      homeCountryIso3,
      citizenshipCountryIso3,
      currentCountryIso3,
      homeCulture,
      birthYear,
      tierBand,
      roleSeedTags,
      languages,
      languageProficiencies,
      educationTrackTag,
      careerTrackTag,
      redLines,
    },
    appearance: {
      heightBand,
      buildTag,
      hair,
      eyes,
      voiceTag,
      distinguishingMarks,
    },
    capabilities: {
      aptitudes,
      skills,
    },
    preferences: {
      food: { comfortFoods, dislikes, restrictions, ritualDrink },
      media: {
        platformDiet,
        genreTopK,
        attentionResilience,
        doomscrollingRisk,
        epistemicHygiene,
      },
      fashion: { styleTags, formality, conformity, statusSignaling },
    },
    psych: { traits },
    visibility: { publicVisibility, paperTrail, digitalHygiene },
    health: { chronicConditionTags, allergyTags },
    covers: { coverAptitudeTags },
    mobility: { passportAccessBand, mobilityTag, travelFrequencyBand },
    routines: {
      chronotype,
      sleepWindow,
      recoveryRituals,
    },
    vices,
    logistics: {
      identityKit: kitItems,
    },
  };
}

export function formatFixed01k(value: Fixed): string {
  const pct = clampInt((value / 1000) * 100, 0, 100);
  return `${pct}%`;
}

export function formatBand5(value: Fixed): Band5 {
  return band5From01k(value);
}

export function topGenres(agent: GeneratedAgent): string[] {
  const genres = agent.preferences.media.genreTopK;
  return topKByScore(genres, (g) => fnv1a32(`${agent.seed}::genre::${g}`), Math.min(5, genres.length));
}
