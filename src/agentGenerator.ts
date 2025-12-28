export type TierBand = 'elite' | 'middle' | 'mass';

export type Band5 = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export type Fixed = number; // fixed-point int, typically 0..1000

export type HeightBand = 'very_short' | 'short' | 'average' | 'tall' | 'very_tall';

export type NeedTag = 'sleep' | 'safety' | 'belonging' | 'autonomy' | 'competence' | 'purpose' | 'comfort';

export type ThoughtSource = 'ops' | 'exposure' | 'media' | 'relationship' | 'health' | 'obligation';

export type DeepSimPreviewV1 = {
  version: 1;
  day0: number;
  needs01k: Record<NeedTag, Fixed>;
  baselineMood01k: number; // -1000..+1000
  mood01k: number; // -1000..+1000
  stress01k: Fixed;
  fatigue01k: Fixed;
  thoughts: Array<{ tag: string; source: ThoughtSource; valence: number; intensity01k: Fixed; expiresDay: number }>;
  breakRisk01k: Fixed;
  breakRiskBand: Band5;
  breakTypesTopK: string[];
};

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
          cultureEnvironment01k?: Partial<Record<'cosmopolitanism' | 'traditionalism' | 'mediaOpenness', Fixed>>;
          cultureProfileWeights01k?: Record<string, Fixed>;
          securityEnvironment01k?: Partial<Record<'conflict' | 'stateViolence' | 'militarization', Fixed>>;
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
  deepSimPreview?: {
    needTags?: string[];
    thoughtTags?: string[];
    breakTypes?: string[];
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
  neurodivergence?: {
    indicatorTags?: string[];
    copingStrategies?: string[];
  };
  spirituality?: {
    affiliationTags?: string[];
    observanceLevels?: string[];
    practiceTypes?: string[];
  };
  background?: {
    adversityTags?: string[];
    resilienceIndicators?: string[];
  };
  gender?: {
    identityTags?: string[];
    pronounSets?: string[];
  };
  cultureProfiles?: Record<string, CultureProfileV1>;
  microCultureProfiles?: Record<string, CultureProfileV1>;
};

export type SocioeconomicMobility = 'upward' | 'stable' | 'downward';

export type NetworkRole = 'isolate' | 'peripheral' | 'connector' | 'hub' | 'broker' | 'gatekeeper';

export type ContradictionPair = {
  trait1: string;
  trait2: string;
  tension: string;
  narrativeHook: string;
};

export type EliteCompensator = 'patronage' | 'dynasty' | 'institutional-protection' | 'media-shield' | 'political-cover' | 'wealth-buffer';

export type GeneratedAgent = {
  version: 1;
  id: string;
  seed: string;
  createdAtIso: string;

  generationTrace?: AgentGenerationTraceV1;
  deepSimPreview: DeepSimPreviewV1;

  identity: {
    name: string;
    homeCountryIso3: string;
    citizenshipCountryIso3: string;
    currentCountryIso3: string;
    homeCulture: string;
    birthYear: number;
    tierBand: TierBand;
    originTierBand: TierBand; // NEW: where they came from
    socioeconomicMobility: SocioeconomicMobility; // NEW: trajectory
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
    // Decomposed principledness (Oracle recommendation)
    ethics: {
      ruleAdherence: Fixed; // follows rules vs bends them
      harmAversion: Fixed; // cares about harm to others
      missionUtilitarianism: Fixed; // does dirty work if needed
      loyaltyScope: 'institution' | 'people' | 'ideals' | 'self';
    };
    contradictions: ContradictionPair[]; // Oracle: story-engine tensions
  };

  // NEW: Network position (Oracle recommendation)
  network: {
    role: NetworkRole;
    factionAlignment: string | null;
    leverageType: 'favors' | 'information' | 'money' | 'ideology' | 'care';
  };

  // NEW: Elite compensators (Oracle recommendation)
  eliteCompensators: EliteCompensator[];

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

  neurodivergence: {
    indicatorTags: string[];
    copingStrategies: string[];
  };

  spirituality: {
    affiliationTag: string;
    observanceLevel: string;
    practiceTypes: string[];
  };

  background: {
    adversityTags: string[];
    resilienceIndicators: string[];
  };

  gender: {
    identityTag: string;
    pronounSet: string;
  };
};

export type GenerateAgentInput = {
  vocab: AgentVocabV1;
  countries: { iso3: string; shadow: string; continent?: string }[];
  priors?: AgentPriorsV1;
  seed: string;
  birthYear?: number;
  asOfYear?: number;
  tierBand?: TierBand;
  roleSeedTags?: string[];
  homeCountryIso3?: string;
  citizenshipCountryIso3?: string;
  currentCountryIso3?: string;
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
  const out: string[] = [];
  for (let i = 0; i < 14; i++) out.push(Math.floor(Math.random() * 36).toString(36));
  return out.join('');
}

function band5From01k(value: Fixed): Band5 {
  if (value < 200) return 'very_low';
  if (value < 400) return 'low';
  if (value < 600) return 'medium';
  if (value < 800) return 'high';
  return 'very_high';
}

function clampSigned01k(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1000, Math.min(1000, Math.round(value)));
}

function topKByScore(items: readonly string[], score: (item: string) => number, k: number): string[] {
  return [...items]
    .map(item => ({ item, score: score(item) }))
    .sort((a, b) => (b.score - a.score) || a.item.localeCompare(b.item))
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

type SecurityEnvAxis = 'conflict' | 'stateViolence' | 'militarization';

type SecurityEnv01k = Record<SecurityEnvAxis, Fixed>;

const SECURITY_ENV_AXES: readonly SecurityEnvAxis[] = ['conflict', 'stateViolence', 'militarization'];

function normalizeSecurityEnv01k(env: Partial<Record<SecurityEnvAxis, Fixed>> | null | undefined): SecurityEnv01k | null {
  if (!env || typeof env !== 'object') return null;
  let hasAny = false;
  const out: Record<string, Fixed> = {};
  const defaults: SecurityEnv01k = { conflict: 0, stateViolence: 0, militarization: 150 };
  for (const axis of SECURITY_ENV_AXES) {
    const v = Number(env[axis]);
    if (Number.isFinite(v)) {
      hasAny = true;
      out[axis] = clampFixed01k(v);
    } else {
      out[axis] = defaults[axis];
    }
  }
  return hasAny ? (out as SecurityEnv01k) : null;
}

function mixSecurityEnv01k(parts: Array<{ env: SecurityEnv01k; weight: number }>): SecurityEnv01k {
  const cleaned = parts
    .map(p => ({ env: p.env, weight: Number.isFinite(p.weight) ? Math.max(0, p.weight) : 0 }))
    .filter(p => p.weight > 0);
  if (!cleaned.length) return { conflict: 0, stateViolence: 0, militarization: 150 };
  const total = cleaned.reduce((s, p) => s + p.weight, 0);
  const out: Record<string, Fixed> = {};
  for (const axis of SECURITY_ENV_AXES) {
    let acc = 0;
    for (const p of cleaned) acc += (p.env[axis] / 1000) * p.weight;
    out[axis] = clampFixed01k((acc / total) * 1000);
  }
  return out as SecurityEnv01k;
}

type CultureEnvAxis = 'cosmopolitanism' | 'traditionalism' | 'mediaOpenness';

type CultureEnv01k = Record<CultureEnvAxis, Fixed>;

const CULTURE_ENV_AXES: readonly CultureEnvAxis[] = ['cosmopolitanism', 'traditionalism', 'mediaOpenness'];

function normalizeCultureEnv01k(env: Partial<Record<CultureEnvAxis, Fixed>> | null | undefined): CultureEnv01k | null {
  if (!env || typeof env !== 'object') return null;
  let hasAny = false;
  const out: Record<string, Fixed> = {};
  const defaults: CultureEnv01k = { cosmopolitanism: 450, traditionalism: 520, mediaOpenness: 650 };
  for (const axis of CULTURE_ENV_AXES) {
    const v = Number(env[axis]);
    if (Number.isFinite(v)) {
      hasAny = true;
      out[axis] = clampFixed01k(v);
    } else {
      out[axis] = defaults[axis];
    }
  }
  return hasAny ? (out as CultureEnv01k) : null;
}

function mixCultureEnv01k(parts: Array<{ env: CultureEnv01k; weight: number }>): CultureEnv01k {
  const cleaned = parts
    .map(p => ({ env: p.env, weight: Number.isFinite(p.weight) ? Math.max(0, p.weight) : 0 }))
    .filter(p => p.weight > 0);
  if (!cleaned.length) return { cosmopolitanism: 450, traditionalism: 520, mediaOpenness: 650 };
  const total = cleaned.reduce((s, p) => s + p.weight, 0);
  const out: Record<string, Fixed> = {};
  for (const axis of CULTURE_ENV_AXES) {
    let acc = 0;
    for (const p of cleaned) acc += (p.env[axis] / 1000) * p.weight;
    out[axis] = clampFixed01k((acc / total) * 1000);
  }
  return out as CultureEnv01k;
}

function normalizeWeights01k(raw: Record<string, number>): Record<string, Fixed> {
  const entries = Object.entries(raw).map(([k, v]) => [k, Number.isFinite(v) ? Math.max(0, v) : 0] as const);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return {};
  const out: Record<string, Fixed> = {};
  for (const [k, v] of entries) out[k] = clampFixed01k((v / total) * 1000);
  return out;
}

function normalizeWeights01kExact(raw: Record<string, number>): Record<string, Fixed> {
  const entries = Object.entries(raw)
    .map(([k, v]) => [k, Number.isFinite(v) ? Math.max(0, v) : 0] as const)
    .filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return {};

  const scaled = entries.map(([k, v]) => {
    const s = (v / total) * 1000;
    const base = Math.floor(s);
    return { k, scaled: s, base, frac: s - base };
  });
  const sumBase = scaled.reduce((s, x) => s + x.base, 0);
  let remaining = 1000 - sumBase;

  const order = [...scaled].sort((a, b) => (b.frac - a.frac) || a.k.localeCompare(b.k));
  const addByKey = new Map<string, number>();
  for (let i = 0; i < order.length && remaining > 0; i++) {
    const k = order[i]!.k;
    addByKey.set(k, (addByKey.get(k) ?? 0) + 1);
    remaining -= 1;
    if (i === order.length - 1) i = -1;
  }

  const out: Record<string, Fixed> = {};
  for (const x of scaled) {
    out[x.k] = clampFixed01k(x.base + (addByKey.get(x.k) ?? 0));
  }
  return out;
}

function mixWeights01k(parts: Array<{ weights: Record<string, Fixed>; weight: number }>): Record<string, Fixed> {
  const cleaned = parts
    .map(p => ({ weights: p.weights, weight: Number.isFinite(p.weight) ? Math.max(0, p.weight) : 0 }))
    .filter(p => p.weight > 0);
  if (!cleaned.length) return {};
  const acc: Record<string, number> = {};
  for (const p of cleaned) {
    for (const [k, v01k] of Object.entries(p.weights ?? {})) {
      const v = Number(v01k);
      if (!Number.isFinite(v) || v <= 0) continue;
      acc[k] = (acc[k] ?? 0) + (v / 1000) * p.weight;
    }
  }
  return normalizeWeights01k(acc);
}

// East Asian countries that should map to 'East Asia' macro-culture instead of 'South Asia'
const EAST_ASIA_ISO3 = new Set([
  'CHN', 'JPN', 'KOR', 'TWN', 'MNG', 'PRK', 'HKG', 'MAC', // Core East Asia
  'VNM', 'THA', 'LAO', 'KHM', 'MMR', // Mainland Southeast Asia
  'IDN', 'MYS', 'SGP', 'BRN', 'TLS', 'PHL', // Maritime Southeast Asia
]);

/**
 * Derives a macro-culture region from a continent name.
 * Accepts real-world continent names (preferred) or legacy shadow names for backwards compatibility.
 * Shadow names should only be used at the display layer, not in data.
 */
function deriveCultureFromContinent(continent: string | undefined, iso3?: string): string {
  // ISO3-based override for East Asia (some continent designations cover both South and East Asia)
  if (iso3 && EAST_ASIA_ISO3.has(iso3.toUpperCase())) {
    return 'East Asia';
  }
  const token = (continent ?? '').trim();
  if (!token) return 'Global';

  // Real-world continent names (preferred input format)
  const realWorldToCulture: Record<string, string> = {
    'Americas': 'Americas',
    'North America': 'Americas',
    'South America': 'Americas',
    'Central America': 'Americas',
    'Europe': 'Europe',
    'MENA': 'MENA',
    'Middle East': 'MENA',
    'North Africa': 'MENA',
    'Sub-Saharan Africa': 'Sub-Saharan Africa',
    'Sub‑Saharan Africa': 'Sub-Saharan Africa', // Non-breaking hyphen variant
    'Africa': 'Sub-Saharan Africa',
    'South Asia': 'South Asia',
    'East Asia': 'East Asia',
    'Southeast Asia': 'East Asia',
    'Asia': 'South Asia', // Fallback for generic "Asia"
    'Oceania': 'Oceania',
    'Pacific': 'Oceania',
    'Australia': 'Oceania',
  };

  // Check real-world names first (case-insensitive)
  const normalizedToken = token.toLowerCase();
  for (const [key, value] of Object.entries(realWorldToCulture)) {
    if (key.toLowerCase() === normalizedToken) {
      return value;
    }
  }

  // Legacy shadow continent names (for backwards compatibility only)
  const shadowContinentToCulture: Record<string, string> = {
    Pelag: 'Oceania',
    Mero: 'Sub-Saharan Africa',
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
  stressReactivity: Fixed;
  impulseControl: Fixed;
  techFluency: Fixed;
  socialBattery: Fixed;
  aestheticExpressiveness: Fixed;
  frugality: Fixed;
  curiosityBandwidth: Fixed;
  adaptability: Fixed;
  planningHorizon: Fixed;
  principledness: Fixed;
  physicalConditioning: Fixed;
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

  // ─────────────────────────────────────────────────────────────────────────────
  // TIER STEREOTYPE MEDIATORS (Oracle/Claude P1 recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  // Add individual variation to tier biases to break stereotypes.
  // A "mediator" value of 0.5 applies full bias; values toward 0 or 1 attenuate it.
  // This creates variance: some elites aren't cosmopolitan; some mass are.
  const tierMediator = rng.next01(); // 0-1, centered around 0.5
  const tierBiasScale = 0.3 + 1.4 * tierMediator; // Range: 0.3 to 1.7 (some attenuation, some amplification)

  // Raw tier biases before mediation
  const rawTierCosmoBias = tierBand === 'elite' ? 160 : tierBand === 'mass' ? -120 : 0;
  const rawTierPublicBias = tierBand === 'elite' ? 120 : tierBand === 'mass' ? -40 : 0;
  const rawTierInstBias = tierBand === 'elite' ? 120 : 0;
  const rawTierTechBias = tierBand === 'elite' ? 40 : tierBand === 'mass' ? -40 : 0;
  const rawTierExpressBias = tierBand === 'elite' ? 80 : tierBand === 'mass' ? -20 : 0;
  const rawTierFrugalBias = tierBand === 'elite' ? -120 : tierBand === 'mass' ? 120 : 0;
  const rawTierPlanBias = tierBand === 'elite' ? 60 : tierBand === 'mass' ? -20 : 0;
  const rawTierStressBias = tierBand === 'elite' ? -60 : tierBand === 'mass' ? 60 : 0;

  // Apply mediator: some individuals conform to tier stereotypes, others don't
  const tierCosmoBias = Math.round(rawTierCosmoBias * tierBiasScale);
  const tierPublicBias = Math.round(rawTierPublicBias * tierBiasScale);
  const tierInstBias = Math.round(rawTierInstBias * tierBiasScale);
  const tierTechBias = Math.round(rawTierTechBias * tierBiasScale);
  const tierExpressBias = Math.round(rawTierExpressBias * tierBiasScale);
  const tierFrugalBias = Math.round(rawTierFrugalBias * tierBiasScale);
  const tierPlanBias = Math.round(rawTierPlanBias * tierBiasScale);
  const tierStressBias = Math.round(rawTierStressBias * tierBiasScale);

  const role = new Set(roleSeedTags);
  const cosmoRoleBias = (role.has('diplomat') ? 220 : 0) + (role.has('media') ? 80 : 0) + (role.has('operative') ? 140 : 0) + (role.has('technocrat') ? 60 : 0);
  const publicRoleBias = (role.has('media') ? 320 : 0) + (role.has('diplomat') ? 220 : 0) - (role.has('operative') ? 240 : 0) - (role.has('security') ? 120 : 0);
  const opsecRoleBias = (role.has('operative') ? 320 : 0) + (role.has('security') ? 220 : 0) - (role.has('media') ? 220 : 0);
  const instRoleBias = (role.has('technocrat') ? 200 : 0) + (role.has('diplomat') ? 160 : 0) + (role.has('analyst') ? 120 : 0) + (role.has('organizer') ? 80 : 0);
  const riskRoleBias = (role.has('operative') ? 180 : 0) + (role.has('security') ? 120 : 0) + (role.has('organizer') ? 80 : 0) - (role.has('diplomat') ? 40 : 0);
  const stressRoleBias =
    (role.has('operative') ? 100 : 0) +
    (role.has('security') ? 120 : 0) +
    (role.has('media') ? 80 : 0) +
    (role.has('diplomat') ? 40 : 0);
  const impulseRoleBias =
    (role.has('analyst') ? 120 : 0) +
    (role.has('technocrat') ? 80 : 0) -
    (role.has('media') ? 60 : 0) -
    (role.has('operative') ? 20 : 0);
  const techRoleBias =
    (role.has('technocrat') ? 220 : 0) +
    (role.has('analyst') ? 180 : 0) +
    (role.has('operative') ? 80 : 0) +
    (role.has('security') ? 60 : 0) +
    (role.has('media') ? 40 : 0);
  const socialBatteryRoleBias =
    (role.has('diplomat') ? 220 : 0) +
    (role.has('media') ? 200 : 0) +
    (role.has('organizer') ? 180 : 0) -
    (role.has('analyst') ? 140 : 0) -
    (role.has('technocrat') ? 60 : 0) -
    (role.has('operative') ? 40 : 0);
  const expressRoleBias =
    (role.has('media') ? 200 : 0) +
    (role.has('organizer') ? 80 : 0) +
    (role.has('diplomat') ? 60 : 0) -
    (role.has('security') ? 140 : 0) -
    (role.has('operative') ? 80 : 0) -
    (role.has('analyst') ? 20 : 0);
  const frugalRoleBias =
    (role.has('organizer') ? 60 : 0) +
    (role.has('analyst') ? 20 : 0) -
    (role.has('media') ? 20 : 0);
  const curiosityRoleBias =
    (role.has('analyst') ? 180 : 0) +
    (role.has('technocrat') ? 120 : 0) +
    (role.has('media') ? 100 : 0) +
    (role.has('diplomat') ? 60 : 0);
  const adaptabilityRoleBias =
    (role.has('diplomat') ? 200 : 0) +
    (role.has('operative') ? 160 : 0) +
    (role.has('organizer') ? 100 : 0) +
    (role.has('security') ? 80 : 0) -
    (role.has('analyst') ? 40 : 0);
  const planningRoleBias =
    (role.has('technocrat') ? 200 : 0) +
    (role.has('analyst') ? 180 : 0) +
    (role.has('organizer') ? 100 : 0) -
    (role.has('media') ? 80 : 0) -
    (role.has('operative') ? 20 : 0);
  const principledRoleBias =
    (role.has('organizer') ? 120 : 0) +
    (role.has('security') ? 120 : 0) +
    (role.has('diplomat') ? 40 : 0) -
    (role.has('operative') ? 40 : 0) -
    (role.has('media') ? 20 : 0);
  const conditioningRoleBias =
    (role.has('security') ? 220 : 0) +
    (role.has('operative') ? 120 : 0) -
    (role.has('media') ? 40 : 0) -
    (role.has('analyst') ? 60 : 0) -
    (role.has('technocrat') ? 20 : 0);

  const raw: Record<keyof Latents, Fixed> = {
    cosmopolitanism: clampFixed01k(rng.int(0, 1000)),
    publicness: clampFixed01k(rng.int(0, 1000)),
    opsecDiscipline: clampFixed01k(rng.int(0, 1000)),
    institutionalEmbeddedness: clampFixed01k(rng.int(0, 1000)),
    riskAppetite: clampFixed01k(rng.int(0, 1000)),
    stressReactivity: clampFixed01k(rng.int(0, 1000)),
    impulseControl: clampFixed01k(rng.int(0, 1000)),
    techFluency: clampFixed01k(rng.int(0, 1000)),
    socialBattery: clampFixed01k(rng.int(0, 1000)),
    aestheticExpressiveness: clampFixed01k(rng.int(0, 1000)),
    frugality: clampFixed01k(rng.int(0, 1000)),
    curiosityBandwidth: clampFixed01k(rng.int(0, 1000)),
    adaptability: clampFixed01k(rng.int(0, 1000)),
    planningHorizon: clampFixed01k(rng.int(0, 1000)),
    principledness: clampFixed01k(rng.int(0, 1000)),
    physicalConditioning: clampFixed01k(rng.int(0, 1000)),
  };

  const tierBias: Record<keyof Latents, number> = {
    cosmopolitanism: tierCosmoBias,
    publicness: tierPublicBias,
    opsecDiscipline: 0,
    institutionalEmbeddedness: tierInstBias,
    riskAppetite: 0,
    stressReactivity: tierStressBias,
    impulseControl: 0,
    techFluency: tierTechBias,
    socialBattery: 0,
    aestheticExpressiveness: tierExpressBias,
    frugality: tierFrugalBias,
    curiosityBandwidth: tierTechBias,
    adaptability: 0,
    planningHorizon: tierPlanBias,
    principledness: 0,
    physicalConditioning: 0,
  };

  const roleBias: Record<keyof Latents, number> = {
    cosmopolitanism: cosmoRoleBias,
    publicness: publicRoleBias,
    opsecDiscipline: opsecRoleBias,
    institutionalEmbeddedness: instRoleBias,
    riskAppetite: riskRoleBias,
    stressReactivity: stressRoleBias,
    impulseControl: impulseRoleBias,
    techFluency: techRoleBias,
    socialBattery: socialBatteryRoleBias,
    aestheticExpressiveness: expressRoleBias,
    frugality: frugalRoleBias,
    curiosityBandwidth: curiosityRoleBias,
    adaptability: adaptabilityRoleBias,
    planningHorizon: planningRoleBias,
    principledness: principledRoleBias,
    physicalConditioning: conditioningRoleBias,
  };

  const values: Latents = {
    cosmopolitanism: clampFixed01k(raw.cosmopolitanism + tierBias.cosmopolitanism + roleBias.cosmopolitanism),
    publicness: clampFixed01k(raw.publicness + tierBias.publicness + roleBias.publicness),
    opsecDiscipline: clampFixed01k(raw.opsecDiscipline + tierBias.opsecDiscipline + roleBias.opsecDiscipline),
    institutionalEmbeddedness: clampFixed01k(raw.institutionalEmbeddedness + tierBias.institutionalEmbeddedness + roleBias.institutionalEmbeddedness),
    riskAppetite: clampFixed01k(raw.riskAppetite + tierBias.riskAppetite + roleBias.riskAppetite),
    stressReactivity: clampFixed01k(raw.stressReactivity + tierBias.stressReactivity + roleBias.stressReactivity),
    impulseControl: clampFixed01k(raw.impulseControl + tierBias.impulseControl + roleBias.impulseControl),
    techFluency: clampFixed01k(raw.techFluency + tierBias.techFluency + roleBias.techFluency),
    socialBattery: clampFixed01k(raw.socialBattery + tierBias.socialBattery + roleBias.socialBattery),
    aestheticExpressiveness: clampFixed01k(raw.aestheticExpressiveness + tierBias.aestheticExpressiveness + roleBias.aestheticExpressiveness),
    frugality: clampFixed01k(raw.frugality + tierBias.frugality + roleBias.frugality),
    curiosityBandwidth: clampFixed01k(raw.curiosityBandwidth + tierBias.curiosityBandwidth + roleBias.curiosityBandwidth),
    adaptability: clampFixed01k(raw.adaptability + tierBias.adaptability + roleBias.adaptability),
    planningHorizon: clampFixed01k(raw.planningHorizon + tierBias.planningHorizon + roleBias.planningHorizon),
    principledness: clampFixed01k(raw.principledness + tierBias.principledness + roleBias.principledness),
    physicalConditioning: clampFixed01k(raw.physicalConditioning + tierBias.physicalConditioning + roleBias.physicalConditioning),
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
	          values: {
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
	          },
	          raw: {
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
	          },
	          tierBias: {
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
	          },
	          roleBias: {
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
	          },
	        },
	        derived: {},
	        fields: {},
	      }
	    : undefined;

  traceFacet(trace, seed, 'base');
  const base = makeRng(facetSeed(seed, 'base'));

	  const birthYear = clampInt(input.birthYear ?? base.int(1960, 2006), 1800, 2525);
	  traceSet(trace, 'identity.birthYear', birthYear, { method: input.birthYear != null ? 'override' : 'rng', dependsOn: { facet: 'base' } });
	  const asOfYear = clampInt(input.asOfYear ?? 2025, 1800, 2525);
	  traceSet(trace, 'identity.asOfYear', asOfYear, { method: input.asOfYear != null ? 'override' : 'default', dependsOn: { default: 2025 } });
	  const age = clampInt(asOfYear - birthYear, 0, 120);
	  traceSet(trace, 'identity.age', age, { method: 'asOfYearMinusBirthYear', dependsOn: { asOfYear, birthYear } });
	  const vocab = input.vocab;
  if (vocab.version !== 1) throw new Error(`Unsupported agent vocab version: ${String((vocab as { version?: unknown }).version)}`);
  if (!vocab.identity.tierBands.length) throw new Error('Agent vocab missing: identity.tierBands');
  if (!vocab.identity.homeCultures.length) throw new Error('Agent vocab missing: identity.homeCultures');
  if (!vocab.identity.roleSeedTags.length) throw new Error('Agent vocab missing: identity.roleSeedTags');
  if (!vocab.identity.firstNames.length || !vocab.identity.lastNames.length) throw new Error('Agent vocab missing: identity name pools');
  if (!vocab.identity.languages.length) throw new Error('Agent vocab missing: identity.languages');
  if (!vocab.deepSimPreview?.needTags?.length) throw new Error('Agent vocab missing: deepSimPreview.needTags');
  if (!vocab.deepSimPreview?.thoughtTags?.length) throw new Error('Agent vocab missing: deepSimPreview.thoughtTags');
  if (!vocab.deepSimPreview?.breakTypes?.length) throw new Error('Agent vocab missing: deepSimPreview.breakTypes');

	  const tierBand: TierBand = input.tierBand ?? base.pick(vocab.identity.tierBands as readonly TierBand[]);
	  traceSet(trace, 'identity.tierBand', tierBand, { method: input.tierBand ? 'override' : 'rng', dependsOn: { facet: 'base', poolSize: vocab.identity.tierBands.length } });

  // ─────────────────────────────────────────────────────────────────────────────
  // SOCIOECONOMIC ORIGIN + MOBILITY (Oracle/Claude recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  // Origin tier: where they came from (distinct from current tier)
  // Mobility: trajectory between origin and current
  traceFacet(trace, seed, 'socioeconomic');
  const socioRng = makeRng(facetSeed(seed, 'socioeconomic'));

  // Most people have stable class; upward/downward mobility is less common
  // Elite current tier: likely elite or middle origin (privilege persists)
  // Mass current tier: likely mass origin (harder to climb)
  // Middle current tier: most varied origins
  const originTierWeights: Record<TierBand, Array<{ item: TierBand; weight: number }>> = {
    elite: [
      { item: 'elite', weight: 0.55 },   // dynasty/inherited
      { item: 'middle', weight: 0.35 },  // climbed up
      { item: 'mass', weight: 0.10 },    // rare rags-to-riches
    ],
    middle: [
      { item: 'elite', weight: 0.12 },   // fallen/downward
      { item: 'middle', weight: 0.65 },  // stable middle
      { item: 'mass', weight: 0.23 },    // climbed up
    ],
    mass: [
      { item: 'elite', weight: 0.03 },   // rare fall
      { item: 'middle', weight: 0.18 },  // slight decline
      { item: 'mass', weight: 0.79 },    // stable mass
    ],
  };
  const originTierBand = weightedPick(socioRng, originTierWeights[tierBand]) as TierBand;

  // Derive mobility from origin vs current
  const socioeconomicMobility: SocioeconomicMobility = (() => {
    const tierRank = { elite: 2, middle: 1, mass: 0 };
    const diff = tierRank[tierBand] - tierRank[originTierBand];
    if (diff > 0) return 'upward';
    if (diff < 0) return 'downward';
    return 'stable';
  })();
  traceSet(trace, 'identity.originTierBand', originTierBand, { method: 'weightedPick', dependsOn: { tierBand } });
  traceSet(trace, 'identity.socioeconomicMobility', socioeconomicMobility, { method: 'derived', dependsOn: { tierBand, originTierBand } });

	  const countries = input.countries;
	  const validCountries = countries
	    .map(c => ({
	      shadow: String((c as { shadow?: unknown }).shadow ?? '').trim(),
	      iso3: String((c as { iso3?: unknown }).iso3 ?? '').trim().toUpperCase(),
	      continent: (c as { continent?: unknown }).continent ? String((c as { continent?: unknown }).continent).trim() : undefined,
	    }))
	    .filter((c) => c.shadow && c.iso3.length === 3)
	    .sort((a, b) => a.iso3.localeCompare(b.iso3));
	  if (!validCountries.length) throw new Error('Agent country map missing: no ISO3 entries');
  traceFacet(trace, seed, 'origin');
  const originRng = makeRng(facetSeed(seed, 'origin'));
  const forcedHomeIso3 = (input.homeCountryIso3 ?? '').trim().toUpperCase();
  const origin = forcedHomeIso3
    ? validCountries.find(c => c.iso3.trim().toUpperCase() === forcedHomeIso3) ?? originRng.pick(validCountries)
    : originRng.pick(validCountries);
  const homeCountryIso3 = origin.iso3.trim().toUpperCase();
  const homeCulture = deriveCultureFromContinent(origin.continent, homeCountryIso3);
  traceSet(trace, 'identity.homeCountryIso3', homeCountryIso3, { method: forcedHomeIso3 ? 'overrideOrFallbackPick' : 'pick', dependsOn: { facet: 'origin', poolSize: validCountries.length, continent: origin.continent ?? null, forcedHomeIso3: forcedHomeIso3 || null } });
  traceSet(trace, 'identity.homeCulture', homeCulture, { method: 'deriveCultureFromContinent', dependsOn: { continent: origin.continent ?? null, iso3: homeCountryIso3 } });

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

  // ─────────────────────────────────────────────────────────────────────────────
  // CLIMATE INDICATOR DERIVATION (from food environment)
  // ─────────────────────────────────────────────────────────────────────────────
  // Derive climate indicators from food environment axes:
  // - spice + streetFood → hot climate
  // - seafood + fineDining → coastal climate
  // - meat + dairy → cold/temperate climate
  const homeFoodEnvEarly = countryPriorsBucket?.foodEnvironment01k;
  const climateIndicators = (() => {
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

  const cultureCountries = validCountries.filter((c) => deriveCultureFromContinent(c.continent, c.iso3) === homeCulture);
  traceFacet(trace, seed, 'citizenship');
  const citizenshipRng = makeRng(facetSeed(seed, 'citizenship'));
  const citizenshipFlip = Math.min(
    0.65,
    0.05 + 0.35 * cosmo01 + (roleSeedTags.includes('diplomat') ? 0.12 : 0) + (roleSeedTags.includes('operative') ? 0.06 : 0),
  );
  const citizenshipOrigin = (citizenshipRng.next01() < citizenshipFlip && cultureCountries.length)
    ? citizenshipRng.pick(cultureCountries)
    : origin;
  const forcedCitizenshipIso3 = (input.citizenshipCountryIso3 ?? '').trim().toUpperCase();
  const citizenshipCountryIso3 = forcedCitizenshipIso3
    ? validCountries.find(c => c.iso3.trim().toUpperCase() === forcedCitizenshipIso3)?.iso3.trim().toUpperCase() ?? citizenshipOrigin.iso3.trim().toUpperCase()
    : citizenshipOrigin.iso3.trim().toUpperCase();
  traceSet(trace, 'identity.citizenshipCountryIso3', citizenshipCountryIso3, { method: forcedCitizenshipIso3 ? 'overrideOrFallbackPick' : 'probabilisticPick', dependsOn: { facet: 'citizenship', citizenshipFlip, cultureCountryPoolSize: cultureCountries.length, forcedCitizenshipIso3: forcedCitizenshipIso3 || null } });

  traceFacet(trace, seed, 'current_country');
  const currentRng = makeRng(facetSeed(seed, 'current_country'));
	  const roleAbroad =
	    (roleSeedTags.includes('diplomat') ? 0.22 : 0) +
	    (roleSeedTags.includes('media') ? 0.06 : 0) +
	    (roleSeedTags.includes('technocrat') ? 0.05 : 0) +
	    (roleSeedTags.includes('operative') ? 0.12 : 0);
	  const abroadChance = Math.min(
	    0.88,
	    0.06 +
	      0.55 * cosmo01 +
	      0.15 * (latents.adaptability / 1000) +
	      0.05 * (latents.curiosityBandwidth / 1000) +
	      roleAbroad,
	  );
	  const abroad = currentRng.next01() < abroadChance;
  const currentCandidatePool = cultureCountries.length ? cultureCountries : validCountries;
  const abroadPool = currentCandidatePool.filter(c => c.iso3.trim().toUpperCase() !== homeCountryIso3);
  const currentPick = abroad
    ? currentRng.pick(abroadPool.length ? abroadPool : currentCandidatePool)
    : origin;
  const forcedCurrentIso3 = (input.currentCountryIso3 ?? '').trim().toUpperCase();
  const currentCountryIso3 = forcedCurrentIso3
    ? validCountries.find(c => c.iso3.trim().toUpperCase() === forcedCurrentIso3)?.iso3.trim().toUpperCase() ?? currentPick.iso3.trim().toUpperCase()
    : currentPick.iso3.trim().toUpperCase();
  traceSet(trace, 'identity.currentCountryIso3', currentCountryIso3, { method: forcedCurrentIso3 ? 'overrideOrFallbackPick' : 'probabilisticPick', dependsOn: { facet: 'current_country', abroadChance, abroad, poolSize: (abroad ? (abroadPool.length || currentCandidatePool.length) : 1), forcedCurrentIso3: forcedCurrentIso3 || null } });

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
        ...(citizenshipCultureEnv01k ? [{ env: citizenshipCultureEnv01k, weight: 0.10 + 0.25 * cosmo01 }] : []),
        ...(currentCultureEnv01k ? [{ env: currentCultureEnv01k, weight: 0.15 + 0.35 * cosmo01 + (abroad ? 0.15 : 0) }] : []),
      ])
    : null;

  const cultureCosmo01 = clamp01((cultureEnv01k?.cosmopolitanism ?? 450) / 1000, 0.45);
  const cultureTraditionalism01 = clamp01((cultureEnv01k?.traditionalism ?? 520) / 1000, 0.52);
  const cultureMediaOpenness01 = clamp01((cultureEnv01k?.mediaOpenness ?? 650) / 1000, 0.65);
  const mixing01 = clamp01(0.55 * cosmo01 + 0.45 * cultureCosmo01, 0.5);

  // Hybrid model: higher mixing → more global blending; higher traditionalism → stronger culture-primary.
  const namesPrimaryWeight = clamp01(
    (macroCultureWeights.namesPrimaryWeight ?? 0.75) - 0.55 * mixing01 + 0.10 * cultureTraditionalism01,
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
    (macroCultureWeights.mediaPrimaryWeight ?? 0.7) - 0.35 * mixing01 - 0.10 * cultureMediaOpenness01 + 0.04 * cultureTraditionalism01,
    0.7,
  );
  const fashionPrimaryWeight = clamp01(
    (macroCultureWeights.fashionPrimaryWeight ?? 0.6) - 0.30 * mixing01 + 0.10 * cultureTraditionalism01,
    0.6,
  );

  const getMicroCultureWeights01k = (iso3: string): Record<string, Fixed> | null => {
    const bucket = input.priors?.countries?.[iso3]?.buckets?.[String(cohortBucketStartYear)];
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
    .map(({ profileId, weight01k }) => ({
      id: profileId,
      weight01k,
      profile: vocab.microCultureProfiles?.[profileId],
    }))
    .filter((x): x is { id: string; weight01k: number; profile: CultureProfileV1 } => !!x.profile);

  // Weight-faithful microculture item picking:
  // Sample a profile according to weights, then pick from that profile's items.
  // This ensures high-weight profiles contribute more items than low-weight ones.
  const pickFromWeightedMicroProfiles = <T>(
    rng: Rng,
    getItems: (p: CultureProfileV1) => readonly T[] | undefined,
    count: number,
  ): T[] => {
    if (microProfiles.length === 0 || count <= 0) return [];
    const results: T[] = [];
    // Local weighted pick for profile objects (since weightedPick only works with strings)
    const pickProfile = (): typeof microProfiles[0] => {
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
  };

  // Unioned pools for names/languages (still use flat union, then weighted selection later)
  const microFirstNames = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.firstNames ?? []));
  const microLastNames = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.lastNames ?? []));
  const microLanguages = uniqueStrings(microProfiles.flatMap(x => x.profile.identity?.languages ?? []));
  // Food/media/fashion use pickFromWeightedMicroProfiles() where they're used

  if (trace) {
    trace.derived.primaryWeights = { namesPrimaryWeight, languagesPrimaryWeight, foodPrimaryWeight, mediaPrimaryWeight, fashionPrimaryWeight };
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

      // Age-based career appropriateness:
      // - Young (< 30): field roles, journalism, military favored
      // - Middle (30-50): most careers equally accessible
      // - Senior (> 50): advisory, politics, academia, civil-service favored
      if (age < 30) {
        if (['politics', 'civil-service'].includes(t)) w *= 0.6; // harder to reach high positions young
        if (['military', 'journalism', 'intelligence'].includes(t)) w += 0.4; // field-active roles
      }
      if (age > 50) {
        if (['academia', 'civil-service', 'politics', 'foreign-service'].includes(t)) w += 0.5; // advisory roles
        if (['military'].includes(t)) w *= 0.7; // physical demands
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

  // ─────────────────────────────────────────────────────────────────────────────
  // EDUCATION-BASED AGE FLOOR (Oracle/Claude P0 recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  // Enforce minimum ages for education levels to prevent implausible combinations
  // like 22-year-old doctorate holders or 19-year-old graduate degree holders.
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

  // Adjust age/birthYear if agent is too young for their education
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
  // Use adjusted values from here on
  // effectiveAge available for future age-dependent features
  void adjustedAge;
  const effectiveBirthYear = adjustedBirthYear;

  traceFacet(trace, seed, 'name');
  const nameRng = makeRng(facetSeed(seed, 'name'));
  const macroFirst = macroCulture?.identity?.firstNames ?? [];
  const macroLast = macroCulture?.identity?.lastNames ?? [];
  const microStrength01 = microTop.length ? clamp01(microTop[0]!.weight01k / 1000, 0) : 0;

  const pickNameFromPools = (pools: Array<{ label: string; items: string[]; weight: number }>, fallbackPool: string[]) => {
    const chosen = weightedPick(nameRng, pools.map(p => ({ item: p.label, weight: p.items.length ? p.weight : 0 })));
    const pool = pools.find(p => p.label === chosen)?.items ?? [];
    const usable = pool.length ? pool : fallbackPool;
    return nameRng.pick(usable);
  };

  const macroW = namesPrimaryWeight * (0.55 + 0.20 * cultureTraditionalism01);
  const microW = namesPrimaryWeight * 0.45 * (0.35 + 0.65 * microStrength01);
  const globalW = Math.max(0.05, 1 - Math.min(0.95, macroW + microW));

  const firstName = pickNameFromPools(
    [
      { label: 'macro', items: macroFirst, weight: macroW },
      { label: 'micro', items: microFirstNames, weight: microW },
      { label: 'global', items: vocab.identity.firstNames, weight: globalW },
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
  traceSet(trace, 'identity.name', name, { method: 'macro+micro+global', dependsOn: { facet: 'name', namesPrimaryWeight, macroFirstPoolSize: macroFirst.length, microFirstPoolSize: microFirstNames.length, macroLastPoolSize: macroLast.length, microLastPoolSize: microLastNames.length, microStrength01 } });

  traceFacet(trace, seed, 'languages');
  const langRng = makeRng(facetSeed(seed, 'languages'));
  const cultureLangs = uniqueStrings([...(macroCulture?.identity?.languages ?? []), ...microLanguages]);
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
	  // Body build selected uniformly (no climate-based correlations to avoid cultural stereotypes)
	  const buildTag = appearanceRng.pick(vocab.appearance.buildTags);
	  const express01 = latents.aestheticExpressiveness / 1000;
	  const hairColor = (() => {
	    const grayish = (s: string) => {
	      const k = s.toLowerCase();
	      return k.includes('gray') || k.includes('silver') || k.includes('salt') || k.includes('white');
	    };
	    const dyed = (s: string) => s.toLowerCase().includes('dyed');
	    const weights = vocab.appearance.hairColors.map((c) => {
	      let w = 1;
	      if (grayish(c)) {
	        w += age >= 50 ? 0.8 + 2.0 * (age / 120) : -0.7;
	        if (age <= 25) w *= 0.25;
	      }
	      if (dyed(c)) w += 0.25 + 0.9 * express01 + 0.35 * public01;
	      return { item: c, weight: Math.max(0.05, w) };
	    });
	    return weightedPick(appearanceRng, weights);
	  })();
	  const hair = { color: hairColor, texture: appearanceRng.pick(vocab.appearance.hairTextures) };
	  const eyes = { color: appearanceRng.pick(vocab.appearance.eyeColors) };
	  // Voice tag with career correlations:
	  // - military → commanding/clipped/precise
	  // - journalism → warm/storyteller/bright
	  // - academia → teacherly/measured/dry-humored
	  // - intelligence → soft-spoken/measured/deadpan
	  // - operatives → calm/measured/murmured
	  const voiceTag = (() => {
	    const militaryVoices = ['commanding', 'clipped', 'precise', 'booming', 'authoritative', 'crisp'];
	    const journalismVoices = ['warm', 'storyteller', 'bright', 'animated', 'engaging', 'articulate'];
	    const academiaVoices = ['teacherly', 'measured', 'dry-humored', 'thoughtful', 'deliberate', 'scholarly'];
	    const intelligenceVoices = ['soft-spoken', 'measured', 'deadpan', 'neutral', 'calm', 'unremarkable'];
	    const operativeVoices = ['calm', 'measured', 'murmured', 'low', 'controlled', 'quiet'];
	    const diplomatVoices = ['smooth', 'diplomatic', 'polished', 'refined', 'measured', 'reassuring'];

	    const weights = vocab.appearance.voiceTags.map((v) => {
	      const key = v.toLowerCase();
	      let w = 1;

	      // Career-based voice biases
	      if (careerTrackTag === 'military' && militaryVoices.some(mv => key.includes(mv))) w += 1.5;
	      if (careerTrackTag === 'journalism' && journalismVoices.some(jv => key.includes(jv))) w += 1.3;
	      if (careerTrackTag === 'academia' && academiaVoices.some(av => key.includes(av))) w += 1.4;
	      if (careerTrackTag === 'intelligence' && intelligenceVoices.some(iv => key.includes(iv))) w += 1.6;
	      if (roleSeedTags.includes('operative') && operativeVoices.some(ov => key.includes(ov))) w += 1.8;
	      if (careerTrackTag === 'foreign-service' && diplomatVoices.some(dv => key.includes(dv))) w += 1.4;

	      // Public visibility → more expressive voices
	      if (public01 > 0.6 && ['warm', 'engaging', 'animated', 'bright', 'charismatic'].some(pv => key.includes(pv))) {
	        w += 0.6 * public01;
	      }
	      // High OPSEC → quieter, less distinctive voices
	      if (opsec01 > 0.6 && ['soft-spoken', 'quiet', 'murmured', 'unremarkable', 'neutral'].some(ov => key.includes(ov))) {
	        w += 0.5 * opsec01;
	      }

	      return { item: v, weight: Math.max(0.1, w) };
	    });
	    return weightedPick(appearanceRng, weights);
	  })();
	  const distinguishingMarksMax = (() => {
	    const baseMax = opsec01 > 0.7 ? 1 : public01 > 0.7 ? 3 : 2;
	    return clampInt(baseMax + (express01 > 0.75 ? 1 : 0), 0, 3);
	  })();
	  const distinguishingMarks = uniqueStrings(
	    appearanceRng.pickK(vocab.appearance.distinguishingMarks, appearanceRng.int(0, distinguishingMarksMax)),
	  );
	  traceSet(
	    trace,
	    'appearance',
	    { heightBand, buildTag, hair, eyes, voiceTag, distinguishingMarks },
	    { method: 'pick+weights', dependsOn: { facet: 'appearance', age, express01, opsec01, public01 } },
	  );

  traceFacet(trace, seed, 'capabilities');
  const capRng = makeRng(facetSeed(seed, 'capabilities'));
  const physical = capRng.int(200, 900);
  const coordination = capRng.int(200, 900);
  const cognitive = capRng.int(200, 900);
  const social = capRng.int(200, 900);

	  let aptitudes = {
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
	  const aptitudeBiases: Array<{ key: keyof typeof aptitudes; delta: number; reason: string }> = [];
	  const bumpApt = (key: keyof typeof aptitudes, delta: number, reason: string) => {
	    if (!delta) return;
	    aptitudes = { ...aptitudes, [key]: clampFixed01k(aptitudes[key] + delta) };
	    aptitudeBiases.push({ key, delta, reason });
	  };

	  const conditioning01 = latents.physicalConditioning / 1000;
	  const conditioningDelta = Math.round((conditioning01 - 0.5) * 80);
	  bumpApt('strength', conditioningDelta, 'physicalConditioning');
	  bumpApt('endurance', Math.round((conditioning01 - 0.5) * 70), 'physicalConditioning');

	  const buildKey = buildTag.toLowerCase();
	  const muscular = ['muscular', 'athletic', 'broad-shouldered', 'brawny', 'barrel-chested', 'sturdy', 'solid'];
	  const wiry = ['wiry', 'lean', 'lanky', 'long-limbed', "runner's build", 'graceful', 'sinewy'];
	  if (muscular.includes(buildKey)) {
	    bumpApt('strength', capRng.int(20, 60), `build:${buildTag}`);
	    bumpApt('endurance', capRng.int(10, 40), `build:${buildTag}`);
	  } else if (wiry.includes(buildKey)) {
	    bumpApt('dexterity', capRng.int(10, 40), `build:${buildTag}`);
	    bumpApt('handEyeCoordination', capRng.int(10, 30), `build:${buildTag}`);
	    bumpApt('endurance', capRng.int(5, 25), `build:${buildTag}`);
	  } else if (['heavyset', 'stocky', 'compact', 'curvy'].includes(buildKey)) {
	    bumpApt('strength', capRng.int(5, 30), `build:${buildTag}`);
	    bumpApt('endurance', -capRng.int(0, 20), `build:${buildTag}`);
	  }

	  if (heightBand === 'tall' || heightBand === 'very_tall') bumpApt('strength', capRng.int(0, 25), `height:${heightBand}`);
	  if (heightBand === 'very_short') bumpApt('strength', -capRng.int(0, 15), `height:${heightBand}`);

	  if (voiceTag === 'commanding') {
	    bumpApt('assertiveness', capRng.int(20, 50), `voice:${voiceTag}`);
	    bumpApt('charisma', capRng.int(10, 30), `voice:${voiceTag}`);
	  }
	  if (voiceTag === 'warm') bumpApt('empathy', capRng.int(10, 40), `voice:${voiceTag}`);
	  if (voiceTag === 'fast-talking') {
	    bumpApt('charisma', capRng.int(10, 30), `voice:${voiceTag}`);
	    bumpApt('attentionControl', -capRng.int(0, 20), `voice:${voiceTag}`);
	  }

	  if (trace) trace.derived.aptitudeBiases = aptitudeBiases;
	  traceSet(trace, 'capabilities.aptitudes', aptitudes, { method: 'formula+appearanceLatents', dependsOn: { facet: 'capabilities', physical, coordination, cognitive, social, tierBand, buildTag, heightBand, voiceTag, conditioning01, aptitudeBiases } });

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

  // ─────────────────────────────────────────────────────────────────────────────
  // ETHICS DECOMPOSITION (Oracle/Claude P2 recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  // Decompose "principledness" into nuanced ethics dimensions:
  // - ruleAdherence: follows rules vs bends them
  // - harmAversion: cares about harm to others
  // - missionUtilitarianism: does dirty work if needed
  // - loyaltyScope: what they're loyal to
  const ethicsRng = makeRng(facetSeed(seed, 'ethics'));
  const principledness01 = latents.principledness / 1000;
  const ethics = {
    ruleAdherence: clampFixed01k(
      0.45 * latents.principledness +
      0.30 * latents.institutionalEmbeddedness +
      0.15 * traits.conscientiousness +
      0.10 * ethicsRng.int(0, 1000)
    ),
    harmAversion: clampFixed01k(
      0.50 * aptitudes.empathy +
      0.25 * latents.principledness +
      0.15 * (1000 - latents.riskAppetite) +
      0.10 * ethicsRng.int(0, 1000)
    ),
    missionUtilitarianism: clampFixed01k(
      0.40 * latents.riskAppetite +
      0.25 * (1000 - latents.principledness) +
      0.20 * latents.opsecDiscipline +
      0.15 * ethicsRng.int(0, 1000)
    ),
    loyaltyScope: (() => {
      type LoyaltyScope = 'institution' | 'people' | 'ideals' | 'self';
      const scopeWeights: Array<{ item: LoyaltyScope; weight: number }> = [
        { item: 'institution', weight: 1 + 2.0 * (latents.institutionalEmbeddedness / 1000) },
        { item: 'people', weight: 1 + 2.0 * (aptitudes.empathy / 1000) },
        { item: 'ideals', weight: 1 + 2.0 * principledness01 },
        { item: 'self', weight: 1 + 1.5 * (1 - principledness01) + 0.8 * (latents.riskAppetite / 1000) },
      ];
      return weightedPick(ethicsRng, scopeWeights) as LoyaltyScope;
    })(),
  };
  traceSet(trace, 'psych.ethics', ethics, { method: 'formula', dependsOn: { facet: 'ethics', latents: latentModel.values, aptitudes } });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONTRADICTION PAIRS (Oracle P2 recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  // Generate narrative-driving internal contradictions for story potential.
  // Look for traits that are both high or opposing values that create tension.
  const contradictions: ContradictionPair[] = [];
  const contradictionCandidates: Array<{
    trait1: string;
    trait2: string;
    tension: string;
    narrativeHook: string;
    condition: boolean;
  }> = [
    {
      trait1: 'harmAversion',
      trait2: 'missionUtilitarianism',
      tension: 'moral-injury-risk',
      narrativeHook: 'Cares about people but can rationalize harm for mission success',
      condition: ethics.harmAversion > 550 && ethics.missionUtilitarianism > 550,
    },
    {
      trait1: 'ruleAdherence',
      trait2: 'riskAppetite',
      tension: 'maverick-institutionalist',
      narrativeHook: 'Respects the system but constantly pushes its boundaries',
      condition: ethics.ruleAdherence > 550 && latents.riskAppetite > 550,
    },
    {
      trait1: 'publicness',
      trait2: 'opsecDiscipline',
      tension: 'spotlight-shadow',
      narrativeHook: 'Craves attention but knows discretion is survival',
      condition: latents.publicness > 550 && latents.opsecDiscipline > 550,
    },
    {
      trait1: 'empathy',
      trait2: 'deceptionAptitude',
      tension: 'compassionate-manipulator',
      narrativeHook: 'Genuinely understands people and uses that for leverage',
      condition: aptitudes.empathy > 550 && aptitudes.deceptionAptitude > 550,
    },
    {
      trait1: 'frugality',
      trait2: 'aestheticExpressiveness',
      tension: 'ascetic-aesthete',
      narrativeHook: 'Values simplicity but has expensive taste',
      condition: latents.frugality > 550 && latents.aestheticExpressiveness > 550,
    },
    {
      trait1: 'institutionalEmbeddedness',
      trait2: 'adaptability',
      tension: 'loyal-chameleon',
      narrativeHook: 'Devoted to the organization but could thrive anywhere',
      condition: latents.institutionalEmbeddedness > 550 && latents.adaptability > 550,
    },
    {
      trait1: 'socialBattery',
      trait2: 'opsecDiscipline',
      tension: 'social-introvert',
      narrativeHook: 'Excels at schmoozing but finds it exhausting',
      condition: latents.socialBattery > 550 && latents.opsecDiscipline > 550 && roleSeedTags.includes('operative'),
    },
  ];
  for (const candidate of contradictionCandidates) {
    if (candidate.condition) {
      contradictions.push({
        trait1: candidate.trait1,
        trait2: candidate.trait2,
        tension: candidate.tension,
        narrativeHook: candidate.narrativeHook,
      });
    }
  }
  traceSet(trace, 'psych.contradictions', contradictions, { method: 'conditionalPairs', dependsOn: { facet: 'ethics', count: contradictions.length } });

  // ─────────────────────────────────────────────────────────────────────────────
  // NETWORK POSITION (Oracle P3 recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  // Generate network role based on traits and role seeds.
  const networkRng = makeRng(facetSeed(seed, 'network'));
  const networkRoleWeights: Array<{ item: NetworkRole; weight: number }> = [
    { item: 'isolate', weight: 1 + 2.0 * (1 - latents.socialBattery / 1000) + (opsec01 > 0.7 ? 1.5 : 0) },
    { item: 'peripheral', weight: 1.5 + 0.8 * (1 - latents.publicness / 1000) },
    { item: 'connector', weight: 1 + 2.5 * cosmo01 + (roleSeedTags.includes('diplomat') ? 2.0 : 0) },
    { item: 'hub', weight: 0.5 + 2.0 * (latents.socialBattery / 1000) + (roleSeedTags.includes('media') ? 1.5 : 0) },
    { item: 'broker', weight: 0.5 + 2.0 * (aptitudes.deceptionAptitude / 1000) + (roleSeedTags.includes('operative') ? 1.5 : 0) },
    { item: 'gatekeeper', weight: 0.5 + 2.0 * inst01 + (roleSeedTags.includes('security') ? 2.0 : 0) },
  ];
  const networkRole = weightedPick(networkRng, networkRoleWeights) as NetworkRole;

  const factionAlignment = (() => {
    // Operatives and security types are less likely to have public faction alignment
    if (roleSeedTags.includes('operative') || roleSeedTags.includes('security')) {
      return networkRng.next01() < 0.3 ? null : null; // 70% no faction
    }
    // Others might have faction alignment based on institutional embeddedness
    if (networkRng.next01() < 0.4 + 0.3 * inst01) {
      const factions = ['reform', 'establishment', 'progressive', 'conservative', 'pragmatist', 'idealist'];
      return networkRng.pick(factions);
    }
    return null;
  })();

  const leverageWeights: Array<{ item: 'favors' | 'information' | 'money' | 'ideology' | 'care'; weight: number }> = [
    { item: 'favors', weight: 1 + 1.5 * (latents.socialBattery / 1000) },
    { item: 'information', weight: 1 + 2.0 * (aptitudes.cognitiveSpeed / 1000) + (roleSeedTags.includes('analyst') ? 2.0 : 0) },
    { item: 'money', weight: 0.5 + 2.0 * (tierBand === 'elite' ? 1 : tierBand === 'middle' ? 0.5 : 0.2) },
    { item: 'ideology', weight: 1 + 2.0 * principledness01 + (roleSeedTags.includes('organizer') ? 1.5 : 0) },
    { item: 'care', weight: 1 + 2.0 * (aptitudes.empathy / 1000) },
  ];
  type LeverageType = 'favors' | 'information' | 'money' | 'ideology' | 'care';
  const leverageType = weightedPick(networkRng, leverageWeights) as LeverageType;

  const network = { role: networkRole, factionAlignment, leverageType };
  traceSet(trace, 'network', network, { method: 'weightedPick', dependsOn: { facet: 'network', roleSeedTags, latents: latentModel.values } });

  // ─────────────────────────────────────────────────────────────────────────────
  // ELITE COMPENSATORS (Oracle P2 recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  // Elite tier agents with low aptitudes need narrative explanation for their position.
  // These are the mechanisms that keep underperforming elites in power.
  const eliteCompensators: EliteCompensator[] = [];
  if (tierBand === 'elite') {
    const avgAptitude = (
      aptitudes.cognitiveSpeed + aptitudes.attentionControl + aptitudes.workingMemory +
      aptitudes.charisma + aptitudes.empathy + aptitudes.assertiveness
    ) / 6;

    // Only add compensators if aptitudes are below elite expectations
    if (avgAptitude < 550) {
      const compensatorRng = makeRng(facetSeed(seed, 'compensators'));
      const compensatorPool: Array<{ item: EliteCompensator; weight: number }> = [
        { item: 'patronage', weight: 1.5 + 1.0 * (originTierBand === 'elite' ? 1 : 0) },
        { item: 'dynasty', weight: 1.0 + 2.0 * (originTierBand === 'elite' && socioeconomicMobility === 'stable' ? 1 : 0) },
        { item: 'institutional-protection', weight: 1.0 + 1.5 * inst01 },
        { item: 'media-shield', weight: 0.8 + 1.5 * (latents.publicness / 1000) },
        { item: 'political-cover', weight: 0.8 + 1.2 * (roleSeedTags.includes('diplomat') || roleSeedTags.includes('technocrat') ? 1 : 0) },
        { item: 'wealth-buffer', weight: 1.2 + 0.8 * (1 - latents.frugality / 1000) },
      ];
      // More compensators for lower aptitude
      const compensatorCount = avgAptitude < 400 ? 3 : avgAptitude < 500 ? 2 : 1;
      const picked = weightedPickKUnique(compensatorRng, compensatorPool, compensatorCount) as EliteCompensator[];
      eliteCompensators.push(...picked);
    }
  }
  traceSet(trace, 'eliteCompensators', eliteCompensators, { method: 'conditionalWeightedPick', dependsOn: { tierBand, avgAptitude: tierBand === 'elite' } });

  // Shared derived: vice tendency used by vices, health, and some media/routines.
	  const viceTendency =
	    0.30 * risk01 +
	    0.22 * (1 - opsec01) +
	    0.20 * (1 - traits.conscientiousness / 1000) +
	    0.12 * public01 +
	    0.08 * (latents.stressReactivity / 1000) +
	    0.08 * (1 - latents.impulseControl / 1000);
	  if (trace) trace.derived.viceTendency = viceTendency;

  const redLinePool = uniqueStrings(vocab.psych?.redLines ?? []);
	  const roleRedLinePool = roleSeedTags.flatMap(r => vocab.psych?.redLineByRole?.[r] ?? []);
	  traceFacet(trace, seed, 'red_lines');
	  const redLineRng = makeRng(facetSeed(seed, 'red_lines'));
	  const redLineCount = clampInt(
	    1 + Math.round((traits.agreeableness + traits.conscientiousness + 0.60 * latents.principledness) / 1000),
	    1,
	    3,
	  );
	  const redLines = redLinePool.length
	    ? pickKHybrid(redLineRng, uniqueStrings(roleRedLinePool), redLinePool, redLineCount, Math.min(redLineCount, 2))
	    : redLineRng.pickK(['harm-to-civilians', 'torture', 'personal-corruption'] as const, redLineCount);
	  traceSet(trace, 'identity.redLines', redLines, { method: 'hybridPickK', dependsOn: { facet: 'red_lines', redLineCount, rolePoolSize: roleRedLinePool.length, globalPoolSize: redLinePool.length } });

	  traceFacet(trace, seed, 'visibility');
	  const visRng = makeRng(facetSeed(seed, 'visibility'));
	  const heightVisibilityBias =
	    heightBand === 'very_tall' ? 45 : heightBand === 'tall' ? 25 : heightBand === 'very_short' ? -20 : 0;
	  const expressVisibilityBias = Math.round((latents.aestheticExpressiveness / 1000 - 0.5) * 40);
	  const publicVisibility = clampFixed01k(
	    0.64 * latents.publicness + 0.30 * visRng.int(0, 1000) + heightVisibilityBias + expressVisibilityBias,
	  );
	  const paperTrail = clampFixed01k(
	    0.65 * latents.institutionalEmbeddedness +
	      0.22 * latents.planningHorizon +
	      0.13 * visRng.int(0, 1000) +
	      (careerTrackTag === 'civil-service' || careerTrackTag === 'law' ? 80 : 0),
	  );
	  const digitalHygiene = clampFixed01k(
	    0.50 * aptitudes.attentionControl +
	      0.22 * latents.opsecDiscipline +
	      0.18 * latents.techFluency +
	      0.10 * latents.impulseControl +
	      0.20 * visRng.int(0, 1000),
	  );
	  traceSet(trace, 'visibility', { publicVisibility, paperTrail, digitalHygiene }, { method: 'formula', dependsOn: { facet: 'visibility', latents: latentModel.values, aptitudes, careerTrackTag } });

	  traceFacet(trace, seed, 'health');
	  const healthRng = makeRng(facetSeed(seed, 'health'));
	  const chronicPool = uniqueStrings(vocab.health?.chronicConditionTags ?? []);
	  const allergyPool = uniqueStrings(vocab.health?.allergyTags ?? []);
	  const endurance01 = aptitudes.endurance / 1000;
	  const chronicChance = Math.min(0.65, Math.max(0.04, age / 210 + 0.10 * (1 - endurance01) + 0.10 * viceTendency));
	  // When triggered, always pick at least 1 condition (int(1,2) = 1 or 2)
	  const chronicConditionTags = chronicPool.length && healthRng.next01() < chronicChance ? healthRng.pickK(chronicPool, healthRng.int(1, 2)) : [];
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
  traceSet(trace, 'mobility', { mobilityTag, passportAccessBand, travelFrequencyBand }, { method: 'weightedPick+env+formula', dependsOn: { facet: 'mobility', tierBand, cosmo01, inst01, public01, roleSeedTags, passportEnv: passportEnv ?? null, travelEnv: travelEnv ?? null } });

  const getSecurityEnv01k = (iso3: string): SecurityEnv01k | null => {
    const bucket = input.priors?.countries?.[iso3]?.buckets?.[String(cohortBucketStartYear)];
    return normalizeSecurityEnv01k(bucket?.securityEnvironment01k as Partial<Record<SecurityEnvAxis, Fixed>> | null | undefined);
  };
  const homeSecurityEnv01k = getSecurityEnv01k(homeCountryIso3);
  const citizenshipSecurityEnv01k = citizenshipCountryIso3 !== homeCountryIso3 ? getSecurityEnv01k(citizenshipCountryIso3) : null;
  const currentSecurityEnv01k = currentCountryIso3 !== homeCountryIso3 ? getSecurityEnv01k(currentCountryIso3) : null;

  const securityEnv01k = homeSecurityEnv01k
    ? mixSecurityEnv01k([
        { env: homeSecurityEnv01k, weight: 1 },
        ...(citizenshipSecurityEnv01k ? [{ env: citizenshipSecurityEnv01k, weight: 0.10 + 0.25 * cosmo01 }] : []),
        ...(currentSecurityEnv01k ? [{ env: currentSecurityEnv01k, weight: 0.15 + 0.35 * cosmo01 + (abroad ? 0.15 : 0) }] : []),
      ])
    : null;

  if (trace) {
    trace.derived.securityEnv = {
      home: homeSecurityEnv01k,
      citizenship: citizenshipSecurityEnv01k,
      current: currentSecurityEnv01k,
      blended: securityEnv01k,
    };
  }

  const securityAxis01k = (axis: SecurityEnvAxis, fallback01k: Fixed) => (securityEnv01k ? securityEnv01k[axis] : fallback01k);
  const conflictEnv01k = securityAxis01k('conflict', 0);
  const stateViolenceEnv01k = securityAxis01k('stateViolence', 0);
  const militarizationEnv01k = securityAxis01k('militarization', 150);
  const securityPressure01k = clampFixed01k(
    0.45 * conflictEnv01k + 0.35 * stateViolenceEnv01k + 0.20 * militarizationEnv01k,
  );
  if (trace) trace.derived.securityPressure01k = securityPressure01k;

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
          add('securityPressure', securityPressure01k);
          value = clampFixed01k(
            0.26 * aptitudes.reflexes +
              0.24 * aptitudes.handEyeCoordination +
              0.18 * aptitudes.attentionControl +
              0.12 * latents.opsecDiscipline +
              0.08 * securityPressure01k +
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
          add('stateViolenceEnv', stateViolenceEnv01k);
          value = clampFixed01k(
            0.22 * aptitudes.cognitiveSpeed +
              0.22 * aptitudes.attentionControl +
              0.18 * aptitudes.workingMemory +
              0.18 * latents.opsecDiscipline +
              0.06 * stateViolenceEnv01k +
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
          add('conflictEnv', conflictEnv01k);
          value = clampFixed01k(
            0.28 * latents.opsecDiscipline +
              0.22 * aptitudes.deceptionAptitude +
              0.12 * latents.riskAppetite +
              0.18 * aptitudes.workingMemory +
              0.06 * conflictEnv01k +
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
          add('stateViolenceEnv', stateViolenceEnv01k);
          value = clampFixed01k(
            0.25 * aptitudes.workingMemory +
              0.20 * aptitudes.attentionControl +
              0.25 * traits.conscientiousness +
              0.06 * stateViolenceEnv01k +
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
	  const voiceSkillBiases: Array<{ skill: string; delta: number; reason: string }> = [];
	  const bumpVoice = (skill: string, delta: number, reason: string) => {
	    if (!skills[skill]) return;
	    bump(skill, delta);
	    voiceSkillBiases.push({ skill, delta, reason });
	  };
	  if (voiceTag === 'commanding') {
	    bumpVoice('negotiation', skillRng.int(10, 40), 'voice:commanding');
	    bumpVoice('mediaHandling', skillRng.int(0, 20), 'voice:commanding');
	  }
	  if (voiceTag === 'warm') bumpVoice('negotiation', skillRng.int(0, 20), 'voice:warm');
	  if (voiceTag === 'fast-talking') bumpVoice('mediaHandling', skillRng.int(5, 30), 'voice:fast-talking');
	  if (trace && voiceSkillBiases.length) trace.derived.voiceSkillBiases = voiceSkillBiases;
	  if (trace) trace.derived.skillTrace = skillTrace;
	  traceSet(trace, 'capabilities.skills', skills, { method: 'derived+roleBumps+voiceBumps', dependsOn: { facet: 'skills', roleSeedTags, careerTrackTag, tierBand, voiceTag, voiceSkillBiases } });

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

  // Weight-faithful microculture food picks (uses profile weights, not flat union)
  const microComfortFoods = pickFromWeightedMicroProfiles(prefsRng, p => p.preferences?.food?.comfortFoods, 5);
  const microRitualDrinks = pickFromWeightedMicroProfiles(prefsRng, p => p.preferences?.food?.ritualDrinks, 3);
  const cultureComfort = uniqueStrings([...(macroCulture?.preferences?.food?.comfortFoods ?? []), ...microComfortFoods]);
  const cultureDrinks = uniqueStrings([...(macroCulture?.preferences?.food?.ritualDrinks ?? []), ...microRitualDrinks]);

  const allRestrictionsPool = uniqueStrings(vocab.preferences.food.restrictions);
  let restrictions: string[] = [];
  const forcedRestrictions: Array<{ restriction: string; reason: string }> = [];
  const ensureRestriction = (restriction: string, reason: string) => {
    if (!restriction.trim()) return;
    if (restrictions.includes(restriction)) return;
    restrictions.push(restriction);
    forcedRestrictions.push({ restriction, reason });
  };

  // Preview observance for dietary decisions (full spirituality generated later)
  // This uses the same seed to maintain determinism
  const spiritualityObservancePreview = (() => {
    const spiritPreviewRng = makeRng(facetSeed(seed, 'spirituality'));
    // Simplified affiliation check: devout/practicing → observant, else → low
    const isDevoutLean = traits.authoritarianism > 600 || (traits.conscientiousness > 650 && age > 45);
    return isDevoutLean && spiritPreviewRng.next01() < 0.5 ? 'observant' : 'low';
  })();
  const observanceMultiplier = spiritualityObservancePreview === 'observant' ? 2.0 : 0.4;

  const arabicMass01 = (() => {
    const home = (homeLangEnv01k?.ar ?? 0) / 1000;
    const citizenship = citizenshipLangEnv01k ? (citizenshipLangEnv01k.ar ?? 0) / 1000 : 0;
    const current = currentLangEnv01k ? (currentLangEnv01k.ar ?? 0) / 1000 : 0;
    return clamp01(home + 0.35 * cosmo01 * citizenship + 0.45 * cosmo01 * current, 0);
  })();
  const hebrewMass01 = (() => {
    const home = (homeLangEnv01k?.he ?? 0) / 1000;
    const citizenship = citizenshipLangEnv01k ? (citizenshipLangEnv01k.he ?? 0) / 1000 : 0;
    const current = currentLangEnv01k ? (currentLangEnv01k.he ?? 0) / 1000 : 0;
    return clamp01(home + 0.35 * cosmo01 * citizenship + 0.45 * cosmo01 * current, 0);
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
	    // Religious dietary laws now tied to spirituality observance, not just language
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
  const comfortFoods = weightedPickKUnique(prefsRng, comfortPool.map(item => ({ item, weight: comfortWeight(item) })), 2);

  const drinkPool = uniqueStrings([...cultureDrinks, ...vocab.preferences.food.ritualDrinks]);
  const drinkWeight = (drink: string): number => {
    const s = drink.toLowerCase();
    let w = 1;
    if (cultureDrinks.includes(drink)) w += 0.9 + 1.8 * foodPrimaryWeight;

	    const caffeinated =
	      s.includes('coffee') ||
	      s.includes('espresso') ||
	      s.includes('mate') ||
	      s.includes('matcha') ||
	      s.includes('energy');
	    const teaish = s.includes('tea') || s.includes('matcha');
	    const sweetish = s.includes('cocoa') || s.includes('hot chocolate');
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
	    if (hasRestriction('no caffeine') && caffeinated) w *= 0.15;
	    if (hasRestriction('low sugar') && sweetish) w *= 0.35;
	    if (hasRestriction('no added sugar') && sweetish) w *= 0.30;
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
	    if (foodEnv01k && s.includes('very spicy')) w += 1.6 * (1 - axis01('spice', 0.5));
	    if (foodEnv01k && s.includes('oily')) w += 1.4 * (1 - axis01('friedOily', 0.5));
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
	    if (hasRestriction('vegan') && (likelyMeat(item) || likelyDairy(item))) return true;
	    if ((hasRestriction('lactose-sensitive') || allergyTags.includes('dairy')) && likelyDairy(item)) return true;
	    if ((hasRestriction('gluten-sensitive') || allergyTags.includes('gluten')) && likelyGluten(item)) return true;
	    if ((hasRestriction('shellfish allergy') || allergyTags.includes('shellfish')) && likelySeafood(item)) return true;
	    if (hasRestriction('no seafood') && likelySeafood(item)) return true;
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
  // Weight-faithful microculture genre picks
  const microGenres = pickFromWeightedMicroProfiles(prefsRng, p => p.preferences?.media?.genres, 4);
  const cultureGenres = uniqueStrings([...(macroCulture?.preferences?.media?.genres ?? []), ...microGenres]);
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
    if (key === 'closed') bias += Math.round(70 * opsec01) + Math.round(70 * (1 - cultureMediaOpenness01));
    if (key === 'social') bias += Math.round(65 * public01) - Math.round(40 * opsec01) + Math.round(25 * cultureMediaOpenness01);
    if (key === 'tv') bias += Math.round(30 * public01);
    if (key === 'print') bias += Math.round(45 * inst01);
    if (key === 'radio') bias += Math.round(30 * inst01);
	    const w = Math.max(1, Math.round(envBase * 0.9) + prefsRng.int(0, 220) + bias * 6);
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

  // Media/cognition traits should correlate with attention, OPSEC, and publicness.
	  const attentionResilience = clampFixed01k(
	    0.42 * aptitudes.attentionControl +
	      0.22 * traits.conscientiousness +
	      0.12 * aptitudes.workingMemory +
	      0.10 * (1000 - latents.publicness) +
	      0.08 * latents.impulseControl +
	      0.06 * prefsRng.int(0, 1000),
	  );
	  const doomscrollingRisk = clampFixed01k(
	    0.30 * latents.publicness +
	      0.22 * (1000 - latents.opsecDiscipline) +
	      0.18 * (1000 - traits.conscientiousness) +
	      0.10 * traits.noveltySeeking +
	      0.10 * (1000 - latents.impulseControl) +
	      0.06 * latents.stressReactivity +
	      0.04 * prefsRng.int(0, 1000),
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
  // Weight-faithful microculture style picks
  const microStyleTags = pickFromWeightedMicroProfiles(fashionRng, p => p.preferences?.fashion?.styleTags, 3);
  const cultureStyle = uniqueStrings([...(macroCulture?.preferences?.fashion?.styleTags ?? []), ...microStyleTags]);
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
  if (cultureTraditionalism01 > 0.72) {
    addForced('classic');
    addForced('formal');
    addForced('traditional');
  }
	  if (tierBand === 'elite') addForced('formal');
	  for (const tag of forced.slice(0, 2)) {
	    if (styleTags.includes(tag)) continue;
	    styleTags = uniqueStrings([tag, ...styleTags]).slice(0, 3);
	  }

	  if (opsec01 > 0.75 && public01 < 0.45) {
	    const forbidden = new Set(['maximalist', 'colorful', 'avant-garde', 'punk', 'goth']);
	    const replacements = ['monochrome', 'utilitarian', 'workwear', 'minimalist'];
	    for (const bad of forbidden) {
	      if (!styleTags.includes(bad)) continue;
	      const replacement = replacements.find(r => stylePool.includes(r) && !styleTags.includes(r));
	      styleTags = uniqueStrings([
	        ...(replacement ? [replacement] : []),
	        ...styleTags.filter(t => t !== bad),
	      ]).slice(0, 3);
	    }
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
	      0.10 * latents.aestheticExpressiveness +
	      0.26 * fashionRng.int(0, 1000) -
	      0.12 * latents.frugality,
	  );
  traceSet(trace, 'preferences.fashion.metrics', { formality, conformity, statusSignaling, forced: forced.slice(0, 2) }, { method: 'formula+forcedTags', dependsOn: { facet: 'fashion', latents: latentModel.values, traits, tierBand } });

  traceFacet(trace, seed, 'routines');
  const routinesRng = makeRng(facetSeed(seed, 'routines'));
  if (!vocab.routines.chronotypes.length) throw new Error('Agent vocab missing: routines.chronotypes');
  if (!vocab.routines.recoveryRituals.length) throw new Error('Agent vocab missing: routines.recoveryRituals');
	  // Enhanced chronotype selection with stress, climate, career correlations
	  // Use stressReactivity as proxy for stress level (stressLoad01k not yet available)
	  const stressReactivity01 = latents.stressReactivity / 1000;
	  const chronotypeWeights = vocab.routines.chronotypes.map((t) => {
	    const key = t.toLowerCase();
	    let w = 1;
	    // Base chronotypes
	    if (key === 'early' || key === 'ultra-early') {
	      w += 1.4 * (traits.conscientiousness / 1000) + 0.6 * (age / 120);
	      if (key === 'ultra-early') w -= 0.5; // less common variant
	    }
	    if (key === 'night') w += 1.2 * (traits.noveltySeeking / 1000) + 0.7 * (latents.riskAppetite / 1000);
	    if (key === 'standard') w += 0.7;

	    // New chronotypes with correlations
	    if (key === 'variable') {
	      w += 1.0 * stressReactivity01; // High stress reactivity → irregular sleep
	      w += 0.4 * (1 - traits.conscientiousness / 1000);
	    }
	    if (key === 'biphasic') {
	      w += 0.8 * climateIndicators.hot01; // Hot climate → siesta culture
	      w += 0.3 * (age / 120); // Older → more likely
	    }
	    if (key === 'flex-shift') {
	      w += 1.0 * (careerTrackTag === 'logistics' ? 1 : 0);
	      w += 0.6 * (roleSeedTags.includes('operative') ? 1 : 0);
	    }
	    if (key === 'rotating') {
	      w += 1.2 * (careerTrackTag === 'military' ? 1 : 0);
	      w += 0.8 * (careerTrackTag === 'public-health' ? 1 : 0);
	      w += 0.5 * (roleSeedTags.includes('security') ? 1 : 0);
	    }

	    // Career-based adjustments
	    if (careerTrackTag === 'journalism' && key === 'night') w += 0.6;
	    if (careerTrackTag === 'civil-service' && key === 'early') w += 0.4;

	    // Health condition impacts - insomnia makes regular schedules harder
	    const hasInsomnia = chronicConditionTags.some(c =>
	      c.toLowerCase().includes('insomnia') || c.toLowerCase().includes('sleep')
	    );
	    if (hasInsomnia && (key === 'early' || key === 'ultra-early')) w *= 0.5;
	    if (hasInsomnia && key === 'variable') w += 0.8;

	    return { item: t, weight: Math.max(0.1, w) };
	  });
	  const chronotype = weightedPick(routinesRng, chronotypeWeights);

	  // Enhanced sleep windows for all chronotypes
	  const sleepWindow = (() => {
	    switch (chronotype.toLowerCase()) {
	      case 'early': return '22:00–06:00';
	      case 'ultra-early': return '20:30–04:30';
	      case 'night': return '02:00–10:00';
	      case 'biphasic': return '00:00–06:00 + 14:00–15:30';
	      case 'flex-shift': return 'varies by assignment';
	      case 'rotating': return 'shift-dependent';
	      case 'variable': return 'inconsistent';
	      default: return '00:00–08:00';
	    }
	  })();
	  const ritualWeights = vocab.routines.recoveryRituals.map((r) => {
	    const key = r.toLowerCase();
	    let w = 1;
	    if (key.includes('gym') || key.includes('run') || key.includes('cardio')) w += 1.2 * (aptitudes.endurance / 1000) + 0.3 * (traits.conscientiousness / 1000);
	    if (key.includes('meditation') || key.includes('breath')) w += 0.8 * (traits.conscientiousness / 1000) + 0.8 * ((1000 - aptitudes.attentionControl) / 1000);
	    if (key.includes('sleep') || key.includes('nap')) w += 0.6 * ((1000 - aptitudes.endurance) / 1000);
	    if (key.includes('reading') || key.includes('journal')) w += 0.7 * (aptitudes.workingMemory / 1000);
	    if (key.includes('walk')) w += 0.4 * (aptitudes.endurance / 1000);
	    if (key.includes('music')) w += 0.4 * (traits.agreeableness / 1000);
	    if (key.includes('call') || key.includes('café') || key.includes('cook') || key.includes('board game') || key.includes('movie')) {
	      w += 0.9 * (latents.socialBattery / 1000);
	    }
	    if (key.includes('phone-free') || key.includes('offline') || key.includes('gardening') || key.includes('clean')) {
	      w += 0.5 * (doomscrollingRisk / 1000) + 0.35 * (latents.stressReactivity / 1000);
	    }
	    return { item: r, weight: w };
	  });
	  const weightByRitual = new Map(ritualWeights.map(({ item, weight }) => [item, weight]));
	  let recoveryRituals = weightedPickKUnique(routinesRng, ritualWeights, 2);
	  const routinesRepairs: Array<{ rule: string; removed: string | null; added: string }> = [];
	  const repairRng = makeRng(facetSeed(seed, 'routines_repair'));
	  const hasAny = (cands: string[]) => cands.some(c => recoveryRituals.includes(c));
	  const pickCand = (cands: string[]) => {
	    const available = cands.filter(c => vocab.routines.recoveryRituals.includes(c));
	    if (!available.length) return null;
	    return available[repairRng.int(0, available.length - 1)]!;
	  };
	  const replaceOne = (added: string, rule: string) => {
	    if (recoveryRituals.includes(added)) return;
	    const candidates = [...recoveryRituals]
	      .map((r) => ({ r, w: weightByRitual.get(r) ?? 0 }))
	      .sort((a, b) => (a.w - b.w) || a.r.localeCompare(b.r));
	    const removed = candidates[0]?.r ?? null;
	    recoveryRituals = uniqueStrings([added, ...recoveryRituals.filter(r => r !== removed)]).slice(0, 2);
	    routinesRepairs.push({ rule, removed, added });
	  };

	  const socialSet = ['call a friend', 'cook a meal', 'board game night', 'movie night', 'café hour'];
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

	  traceFacet(trace, seed, 'vices');
	  const vicesRng = makeRng(facetSeed(seed, 'vices'));
	  if (!vocab.vices.vicePool.length) throw new Error('Agent vocab missing: vices.vicePool');
	  if (!vocab.vices.triggers.length) throw new Error('Agent vocab missing: vices.triggers');
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
	  // - High conflict/violence → increased vice tendency (coping mechanism)
	  // - BUT also high support/resilience → decreased vice tendency (Oracle review fix)
	  const conflictViceBoost = 0.08 * (conflictEnv01k / 1000) + 0.06 * (stateViolenceEnv01k / 1000);
	  // Resilience and community reduce conflict's vice impact
	  const resilienceBuffer = 0.04 * (traits.agreeableness / 1000) + 0.03 * (inst01);
	  const adjustedViceTendency = Math.min(1, Math.max(0, viceTendency + conflictViceBoost - resilienceBuffer));
	  let viceCount = adjustedViceTendency > 0.78 ? 2 : adjustedViceTendency > 0.42 ? 1 : (vicesRng.next01() < 0.22 ? 1 : 0);
	  if (stressLoad01k > 750 && viceCount < 2) viceCount += 1;
	  // High conflict environments: increased vice probability BUT offset by high conscientiousness
	  const conflictViceChance = Math.max(0, 0.25 - 0.15 * (traits.conscientiousness / 1000));
	  if (conflictEnv01k > 500 && viceCount < 2 && vicesRng.next01() < conflictViceChance) viceCount += 1;

	  const bannedVices = new Set<string>();
	  if (restrictions.includes('no alcohol')) bannedVices.add('alcohol');
	  if (restrictions.includes('no caffeine')) bannedVices.add('caffeine');

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
	  traceSet(trace, 'vices', vices, { method: 'weightedPickKUnique+repairs+severityFormula', dependsOn: { facet: 'vices', viceTendency, viceCount, stressLoad01k, opsec01, risk01, public01, bannedVices: [...bannedVices] } });

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
  traceSet(trace, 'logistics.identityKit', kitItems, { method: 'weightedPickKUnique+repairs+formula', dependsOn: { facet: 'logistics', opsec01, public01, risk01, travelScore, careerTrackTag, tierBand, identityKitRepairs } });

  // ─────────────────────────────────────────────────────────────────────────────
  // NEURODIVERGENCE
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'neurodivergence');
  const neuroRng = makeRng(facetSeed(seed, 'neurodivergence'));
  const neuroIndicators = vocab.neurodivergence?.indicatorTags ?? ['neurotypical'];
  const neuroCoping = vocab.neurodivergence?.copingStrategies ?? [];

  // Base probability of non-neurotypical: ~15-25% depending on traits
  const neuroVarianceChance = 0.15 + 0.10 * (aptitudes.attentionControl < 500 ? 1 : 0);
  const isNeurotypical = neuroRng.next01() > neuroVarianceChance;

  let neuroIndicatorTags: string[];
  let neuroCopingStrategies: string[];

  if (isNeurotypical) {
    neuroIndicatorTags = ['neurotypical'];
    neuroCopingStrategies = [];
  } else {
    // Pick 1-2 indicators (not neurotypical)
    const nonTypicalIndicators = neuroIndicators.filter(t => t !== 'neurotypical');
    const indicatorWeights = nonTypicalIndicators.map(tag => {
      let w = 1;
      // Correlations with aptitudes and traits
      if (tag === 'hyperfocus-prone') w += 0.5 * (aptitudes.attentionControl / 1000);
      if (tag === 'adhd-traits') w += 0.4 * (1 - aptitudes.attentionControl / 1000);
      if (tag === 'pattern-recognition-strength') w += 0.3 * (aptitudes.cognitiveSpeed / 1000);
      if (tag === 'sensory-sensitivity') w += 0.3 * (latents.stressReactivity / 1000);
      if (tag === 'anxiety-processing') w += 0.4 * (latents.stressReactivity / 1000);
      // ASD traits correlate with processing style, not empathy deficits (stereotype fix)
      if (tag === 'asd-traits') w += 0.3 * (aptitudes.attentionControl / 1000) + 0.15 * (latents.stressReactivity / 1000);
      return { item: tag, weight: w };
    });
    neuroIndicatorTags = weightedPickKUnique(neuroRng, indicatorWeights, neuroRng.int(1, 2));

    // Pick 1-3 coping strategies
    if (neuroCoping.length > 0) {
      const copingWeights = neuroCoping.map(tag => {
        let w = 1;
        if (tag === 'routine-dependent' && traits.conscientiousness > 600) w += 0.5;
        if (tag === 'list-maker' && traits.conscientiousness > 500) w += 0.4;
        if (tag === 'noise-cancelling' && neuroIndicatorTags.includes('sensory-sensitivity')) w += 0.8;
        if (tag === 'fidget-user' && neuroIndicatorTags.includes('adhd-traits')) w += 0.6;
        if (tag === 'medication-managed') w += 0.3 * (tierBand === 'elite' ? 1.5 : 1);
        return { item: tag, weight: w };
      });
      neuroCopingStrategies = weightedPickKUnique(neuroRng, copingWeights, neuroRng.int(1, 3));
    } else {
      neuroCopingStrategies = [];
    }
  }
  traceSet(trace, 'neurodivergence', { indicatorTags: neuroIndicatorTags, copingStrategies: neuroCopingStrategies }, { method: 'weighted', dependsOn: { aptitudes: 'partial', latents: 'partial', traits: 'partial' } });

  // ─────────────────────────────────────────────────────────────────────────────
  // SPIRITUALITY
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'spirituality');
  const spiritRng = makeRng(facetSeed(seed, 'spirituality'));
  const affiliations = vocab.spirituality?.affiliationTags ?? ['secular'];
  const observances = vocab.spirituality?.observanceLevels ?? ['none', 'cultural', 'moderate'];
  const practices = vocab.spirituality?.practiceTypes ?? [];

  // Affiliation influenced by age, conscientiousness, authoritarianism
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
    if (tag === 'culturally-religious') w += 0.5; // Common baseline
    if (tag === 'spiritual-not-religious') w += 0.3 * (traits.noveltySeeking / 1000);
    if (tag === 'lapsed') w += 0.2 * (age > 30 && age < 50 ? 1 : 0);
    return { item: tag, weight: w };
  });
  const spiritualityAffiliationTag = weightedPick(spiritRng, affiliationWeights);

  // Observance level correlates with affiliation
  const observanceWeights = observances.map(level => {
    let w = 1;
    if (spiritualityAffiliationTag === 'devout' && level === 'strict') w += 2;
    if (spiritualityAffiliationTag === 'devout' && level === 'observant') w += 1.5;
    if (spiritualityAffiliationTag === 'practicing-religious' && level === 'observant') w += 1.5;
    if (spiritualityAffiliationTag === 'practicing-religious' && level === 'moderate') w += 1;
    if (spiritualityAffiliationTag === 'culturally-religious' && level === 'cultural') w += 2;
    if (spiritualityAffiliationTag === 'lapsed' && level === 'none') w += 1.5;
    if (['secular', 'atheist', 'agnostic'].includes(spiritualityAffiliationTag) && level === 'none') w += 3;
    return { item: level, weight: w };
  });
  const spiritualityObservanceLevel = weightedPick(spiritRng, observanceWeights);

  // Practices - pick 0-3 based on observance
  let spiritualityPracticeTypes: string[] = [];
  if (practices.length > 0 && spiritualityObservanceLevel !== 'none') {
    const practiceCount = spiritualityObservanceLevel === 'strict' ? spiritRng.int(2, 4) :
                          spiritualityObservanceLevel === 'observant' ? spiritRng.int(1, 3) :
                          spiritualityObservanceLevel === 'moderate' ? spiritRng.int(1, 2) :
                          spiritRng.int(0, 1);
    if (practiceCount > 0) {
      spiritualityPracticeTypes = spiritRng.pickK(practices, Math.min(practiceCount, practices.length));
    }
  }
  traceSet(trace, 'spirituality', { affiliationTag: spiritualityAffiliationTag, observanceLevel: spiritualityObservanceLevel, practiceTypes: spiritualityPracticeTypes }, { method: 'weighted', dependsOn: { age, traits: 'partial' } });

  // ─────────────────────────────────────────────────────────────────────────────
  // BACKGROUND
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'background');
  const bgRng = makeRng(facetSeed(seed, 'background'));
  const adversities = vocab.background?.adversityTags ?? ['stable-upbringing'];
  const resiliencePool = vocab.background?.resilienceIndicators ?? [];

  // Adversity probability influenced by country security environment
  const securityEnv = input.priors?.countries?.[homeCountryIso3]?.buckets?.[String(cohortBucketStartYear)]?.securityEnvironment01k;
  const conflictLevel = securityEnv?.conflict ?? 200;
  const stateViolence = securityEnv?.stateViolence ?? 200;
  const adversityBaseChance = 0.20 + 0.30 * (conflictLevel / 1000) + 0.20 * (stateViolence / 1000);

  const adversityWeights = adversities.map(tag => {
    let w = 1;
    if (tag === 'stable-upbringing') w += 2 * (1 - adversityBaseChance);
    if (tag === 'conflict-exposure') w += 1.5 * (conflictLevel / 1000);
    if (tag === 'displacement-survivor' || tag === 'refugee-background') w += 1.2 * (conflictLevel / 1000);
    if (tag === 'persecution-survivor') w += 0.8 * (stateViolence / 1000);
    if (tag === 'economic-hardship-history') w += 0.5; // common
    if (tag === 'family-instability') w += 0.4;
    if (tag === 'loss-of-parent') w += 0.3;
    return { item: tag, weight: w };
  });

  // Pick 1-2 adversity tags (could include stable-upbringing)
  const backgroundAdversityTags = weightedPickKUnique(bgRng, adversityWeights, bgRng.int(1, 2));

  // Resilience indicators - pick if there's adversity beyond stable-upbringing
  let backgroundResilienceIndicators: string[] = [];
  const hasSignificantAdversity = backgroundAdversityTags.some(t => t !== 'stable-upbringing');
  if (hasSignificantAdversity && resiliencePool.length > 0) {
    const resilienceWeights = resiliencePool.map(tag => {
      let w = 1;
      if (tag === 'high-adaptability') w += 0.4 * (traits.noveltySeeking / 1000);
      if (tag === 'compartmentalization-skill') w += 0.5 * (opsec01);
      if (tag === 'therapy-history') w += 0.3 * (tierBand === 'elite' ? 1.5 : 1);
      if (tag === 'support-network-strong') w += 0.3 * (traits.agreeableness / 1000);
      return { item: tag, weight: w };
    });
    backgroundResilienceIndicators = weightedPickKUnique(bgRng, resilienceWeights, bgRng.int(1, 2));
  }
  traceSet(trace, 'background', { adversityTags: backgroundAdversityTags, resilienceIndicators: backgroundResilienceIndicators }, { method: 'weighted', dependsOn: { homeCountryIso3, securityEnv: 'partial', traits: 'partial' } });

  // ─────────────────────────────────────────────────────────────────────────────
  // GENDER
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'gender');
  const genderRng = makeRng(facetSeed(seed, 'gender'));
  const genderIdentities = vocab.gender?.identityTags ?? ['cisgender-man', 'cisgender-woman'];
  const pronounOptions = vocab.gender?.pronounSets ?? ['he-him', 'she-her', 'they-them'];

  // Gender distribution: ~95% cisgender, ~5% other identities
  // With weight 50 for each cis identity vs 1 for others: 100/107.5 ≈ 93%
  // ─────────────────────────────────────────────────────────────────────────────
  // TWO-SPIRIT CULTURE GATING (Oracle/Claude P1 recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  // Two-spirit is a specific Indigenous American identity - not a synonym for non-binary.
  // Gate to countries with significant Indigenous populations and cultural continuity.
  // This list includes nations where Two-Spirit identity has documented cultural presence.
  const indigenousAmericanCountries = new Set([
    'USA', 'CAN', // North America - Navajo nádleehí, Lakota winkte, etc.
    'MEX', 'GTM', 'HND', 'SLV', 'NIC', 'CRI', 'PAN', // Central America - Maya, Aztec traditions
    'COL', 'VEN', 'ECU', 'PER', 'BOL', 'CHL', 'ARG', 'PRY', // South America - Andean, Guarani, Mapuche
    'BRA', // Brazil has distinct Indigenous traditions (though terminology differs)
  ]);
  // Two-spirit is a specifically Indigenous American/First Nations concept
  // Check culture region plus micro-culture profiles for relevant traditions
  const isIndigenousAmericanCulture =
    homeCulture === 'Americas' ||
    indigenousAmericanCountries.has(homeCountryIso3) || // Fallback for unmapped countries
    microProfiles.some(p =>
      p.id.includes('andean') || // Andean cultures have third-gender traditions
      p.id.includes('caribbean') // Some Caribbean Indigenous influences
    );
  const genderIdentityWeights = genderIdentities.map(tag => {
    let w = 1;
    if (tag === 'cisgender-man' || tag === 'cisgender-woman') w = 50; // Matches ~95% cis target
    if (tag === 'undisclosed') w = 0.3; // Rare - only for those who prefer privacy
    // Two-spirit only available for Indigenous American cultural backgrounds
    if (tag === 'two-spirit' && !isIndigenousAmericanCulture) w = 0;
    return { item: tag, weight: w };
  });
  const genderIdentityTag = weightedPick(genderRng, genderIdentityWeights);

  // Pronouns correlate with identity
  const pronounWeights = pronounOptions.map(pset => {
    let w = 1;
    if (genderIdentityTag === 'cisgender-man' && pset === 'he-him') w = 20;
    if (genderIdentityTag === 'cisgender-woman' && pset === 'she-her') w = 20;
    if (genderIdentityTag === 'transgender-man' && pset === 'he-him') w = 15;
    if (genderIdentityTag === 'transgender-woman' && pset === 'she-her') w = 15;
    if (genderIdentityTag === 'non-binary' && pset === 'they-them') w = 10;
    if (genderIdentityTag === 'non-binary' && (pset === 'he-they' || pset === 'she-they')) w = 5;
    if (genderIdentityTag === 'genderqueer' && pset === 'they-them') w = 8;
    if (genderIdentityTag === 'agender' && pset === 'they-them') w = 10;
    if (genderIdentityTag === 'gender-fluid' && pset === 'any-pronouns') w = 8;
    if (genderIdentityTag === 'two-spirit' && pset === 'they-them') w = 5;
    if (genderIdentityTag === 'undisclosed') w = 1; // Equal weights for undisclosed
    return { item: pset, weight: w };
  });
  const genderPronounSet = weightedPick(genderRng, pronounWeights);
  traceSet(trace, 'gender', { identityTag: genderIdentityTag, pronounSet: genderPronounSet }, { method: 'weighted' });

  traceFacet(trace, seed, 'deep_sim_preview');
  const previewRng = makeRng(facetSeed(seed, 'deep_sim_preview'));
  const previewAbroad = currentCountryIso3 !== homeCountryIso3;
  const recoveryOffline = recoveryRituals.some(r =>
    [
      'phone-free hour',
      'long walk',
      'gym session',
      'run',
      'swim laps',
      'sauna',
      'stretch and mobility',
      'martial arts class',
      'stargazing',
      'visit a museum',
    ].includes(r),
  );

  const stableNoise = (key: string): number => {
    const n = fnv1a32(`${seed}::deep_sim_preview_noise::${key}`) >>> 0;
    return ((n / 0xffff_ffff) - 0.5) * 0.04; // [-0.02, +0.02]
  };

  const skillValues = Object.values(skills).map(s => s.value);
  const averageSkillValue01k = skillValues.length
    ? clampFixed01k(Math.round(skillValues.reduce((a, b) => a + b, 0) / skillValues.length))
    : 500;

  // Snapshot "day 0" deep-sim preview. This is not a simulation tick; it's a deterministic initial state.
  const baselineMood01k = clampSigned01k(
    -140 +
      420 * (traits.agreeableness / 1000) +
      220 * (traits.conscientiousness / 1000) +
      160 * (latents.socialBattery / 1000) -
      520 * (latents.stressReactivity / 1000) -
      220 * (doomscrollingRisk / 1000) +
      220 * (attentionResilience / 1000) +
      previewRng.int(-120, 120),
  );

  const stress01k = clampFixed01k(
    Math.round(
      240 +
        520 * (latents.stressReactivity / 1000) +
        240 * (1 - latents.impulseControl / 1000) +
        240 * public01 +
        260 * (securityPressure01k / 1000) +
        220 * (paperTrail / 1000) +
        200 * (doomscrollingRisk / 1000) -
        220 * opsec01 -
        140 * (attentionResilience / 1000) -
        140 * (latents.physicalConditioning / 1000) +
        (recoveryOffline ? -60 : 0) +
        previewRng.int(-90, 90),
    ),
  );

  const fatigue01k = clampFixed01k(
    Math.round(
      270 +
        200 * (1 - traits.conscientiousness / 1000) +
        200 * (doomscrollingRisk / 1000) +
        220 * (stress01k / 1000) +
        140 * (age / 100) -
        260 * (latents.physicalConditioning / 1000) -
        120 * (aptitudes.attentionControl / 1000) +
        (recoveryOffline ? -40 : 0) +
        previewRng.int(-80, 80),
    ),
  );

  const needs01k: Record<NeedTag, Fixed> = {
    sleep: clampFixed01k(Math.round(720 - 0.55 * fatigue01k - 0.20 * stress01k + 120 * (traits.conscientiousness / 1000) + previewRng.int(-60, 60))),
    safety: clampFixed01k(
      Math.round(
        720 +
          220 * opsec01 -
          260 * public01 -
          170 * (paperTrail / 1000) -
          220 * (securityPressure01k / 1000) +
          previewRng.int(-70, 70),
      ),
    ),
    belonging: clampFixed01k(
      Math.round(
        640 +
          260 * (latents.socialBattery / 1000) +
          120 * (traits.agreeableness / 1000) -
          (previewAbroad ? 170 : 0) -
          160 * (stress01k / 1000) +
          previewRng.int(-70, 70),
      ),
    ),
    autonomy: clampFixed01k(
      Math.round(620 + 190 * (1 - inst01) + 120 * (latents.planningHorizon / 1000) - 120 * (paperTrail / 1000) + previewRng.int(-60, 60)),
    ),
    competence: clampFixed01k(
      Math.round(
        640 +
          0.22 * averageSkillValue01k +
          160 * (traits.conscientiousness / 1000) +
          80 * (latents.techFluency / 1000) -
          150 * (fatigue01k / 1000) -
          90 * (stress01k / 1000) +
          previewRng.int(-60, 60),
      ),
    ),
    purpose: clampFixed01k(
      Math.round(
        600 +
          240 * (latents.principledness / 1000) +
          120 * inst01 +
          (roleSeedTags.includes('organizer') ? 70 : 0) +
          (roleSeedTags.includes('diplomat') ? 40 : 0) -
          160 * (stress01k / 1000) +
          previewRng.int(-70, 70),
      ),
    ),
    comfort: clampFixed01k(
      Math.round(
        620 +
          100 * (traits.conscientiousness / 1000) +
          120 * (latents.frugality / 1000) +
          60 * (1 - risk01) -
          180 * (fatigue01k / 1000) +
          (recoveryOffline ? 40 : 0) +
          previewRng.int(-70, 70),
      ),
    ),
  };

  const mood01k = clampSigned01k(
    baselineMood01k +
      0.22 * (needs01k.sleep - 600) +
      0.18 * (needs01k.safety - 600) +
      0.18 * (needs01k.belonging - 600) +
      0.10 * (needs01k.autonomy - 600) +
      0.14 * (needs01k.competence - 600) +
      0.18 * (needs01k.purpose - 600) +
      0.10 * (needs01k.comfort - 600) -
      0.70 * (stress01k - 500) -
      0.55 * (fatigue01k - 500),
  );

  const thoughtSourceFor = (tag: string): ThoughtSource => {
    if (tag.startsWith('mission_') || tag === 'near_miss') return 'ops';
    if (tag.includes('watched') || tag.includes('scrutiny') || tag.includes('privacy_compromised')) return 'exposure';
    if (tag.includes('doomscroll') || tag.includes('outrage') || tag.includes('paranoia') || tag === 'spiraling') return 'media';
    if (tag.startsWith('argument_') || tag.includes('trust_') || tag.includes('bond_') || tag === 'broken_promise') return 'relationship';
    if (tag.includes('headache') || tag.includes('shoulders') || tag.includes('body_')) return 'health';
    if (tag.includes('paperwork') || tag.includes('deadline') || tag.includes('meeting') || tag.includes('backlog') || tag.includes('routine_disrupted')) return 'obligation';
    return 'obligation';
  };

  const positiveThoughts = new Set([
    'well_rested',
    'calm_focus',
    'safe_for_now',
    'felt_supported',
    'felt_appreciated',
    'quiet_pride',
    'competent_today',
    'found_a_rhythm',
    'public_praise',
    'bond_strengthened',
    'body_feels_strong',
  ]);
  const thoughtValenceFor = (tag: string): number => {
    if (positiveThoughts.has(tag)) return 600;
    if (tag === 'mission_success') return 800;
    if (tag === 'mission_failure') return -900;
    if (tag === 'moral_disquiet' || tag === 'guilt_weight') return -650;
    if (tag.includes('embarrassment') || tag.includes('backlash') || tag.includes('ignored') || tag.includes('used')) return -700;
    if (tag.includes('slept') || tag.includes('restless') || tag.includes('spiraling') || tag.includes('ruminating')) return -550;
    if (tag.startsWith('needed_')) return -350;
    return -450;
  };

  const thoughtScore = (tag: string): number => {
    const n = stableNoise(tag);
    const t = tag;
    let s = 0;

    if (t === 'well_rested') s += Math.max(0, (needs01k.sleep - 650) / 250);
    if (t === 'slept_poorly' || t === 'restless_night') s += Math.max(0, (600 - needs01k.sleep) / 260);
    if (t === 'on_edge') s += Math.max(0, (stress01k - 520) / 300);
    if (t === 'calm_focus') s += Math.max(0, (520 - stress01k) / 320) + Math.max(0, (needs01k.competence - 650) / 300);

    if (t === 'felt_watched' || t === 'too_much_scrutiny' || t === 'privacy_compromised') {
      s += Math.max(0, (620 - needs01k.safety) / 260) + 0.35 * public01 + 0.20 * (securityPressure01k / 1000);
    }
    if (t === 'safe_for_now') s += Math.max(0, (needs01k.safety - 650) / 280) + 0.25 * opsec01;

    if (t === 'homesick' || t === 'lonely_in_a_crowd' || t === 'missed_a_friend') {
      s += Math.max(0, (620 - needs01k.belonging) / 260) + (previewAbroad ? 0.25 : 0) + 0.15 * (stress01k / 1000);
    }
    if (t === 'felt_supported' || t === 'felt_appreciated') s += Math.max(0, (needs01k.belonging - 650) / 300) + 0.20 * (traits.agreeableness / 1000);
    if (t === 'felt_used' || t === 'felt_ignored') s += Math.max(0, (650 - needs01k.autonomy) / 280) + 0.12 * inst01;

    if (t === 'bureaucratic_grind' || t === 'paperwork_backlog' || t === 'meeting_fatigue') {
      s += 0.10 + 0.15 * inst01 + (careerTrackTag === 'civil-service' ? 0.35 : 0) + (careerTrackTag === 'corporate-ops' ? 0.10 : 0);
    }
    if (t === 'deadline_pressure' || t === 'uncertainty_spike' || t === 'plans_disrupted' || t === 'loss_of_control') {
      s += Math.max(0, (stress01k - 480) / 340) + 0.20 * (1 - latents.impulseControl / 1000) + 0.10 * (1 - latents.planningHorizon / 1000);
    }
    if (t === 'routine_disrupted') s += Math.max(0, (fatigue01k - 520) / 360) + 0.15 * (traits.noveltySeeking / 1000);
    if (t === 'found_a_rhythm') s += Math.max(0, (520 - fatigue01k) / 360) + 0.10 * (traits.conscientiousness / 1000);

    if (t === 'doomscroll_fog' || t === 'outrage_fatigue' || t === 'paranoia_spike' || t === 'spiraling') {
      s += 0.05 + 0.45 * (doomscrollingRisk / 1000) + 0.20 * (stress01k / 1000) - 0.20 * (attentionResilience / 1000);
    }
    if (t === 'moral_disquiet' || t === 'guilt_weight') {
      s += 0.06 + 0.35 * (latents.principledness / 1000) + 0.15 * (latents.stressReactivity / 1000) - 0.12 * (traits.agreeableness / 1000);
      // ─── RELIGIOUS OBSERVANCE TO THOUGHTS (Oracle/Claude P3 recommendation) ───
      // Devout and observant agents experience stronger moral/guilt processing
      if (spiritualityObservanceLevel === 'strict' || spiritualityObservanceLevel === 'devout') s += 0.25;
      else if (spiritualityObservanceLevel === 'observant') s += 0.15;
      else if (spiritualityObservanceLevel === 'moderate') s += 0.08;
    }

    // Spirituality also influences related thoughts
    if (t === 'needed_meaning') {
      if (spiritualityObservanceLevel === 'strict' || spiritualityObservanceLevel === 'devout') s += 0.18;
      else if (spiritualityObservanceLevel === 'observant') s += 0.10;
    }
    if (t === 'felt_supported' || t === 'felt_appreciated') {
      // Religious community provides belonging
      if (spiritualityPracticeTypes.includes('community-worship')) s += 0.12;
    }

    if (t === 'status_anxiety' || t === 'imposter_syndrome') {
      s += 0.05 + 0.30 * (statusSignaling / 1000) + 0.25 * (publicVisibility / 1000) + 0.15 * (1 - needs01k.competence / 1000);
    }
    if (t === 'quiet_pride' || t === 'competent_today') {
      s += Math.max(0, (needs01k.purpose - 650) / 340) + Math.max(0, (needs01k.competence - 650) / 340);
    }

    if (t === 'public_backlash') s += 0.05 + 0.40 * (publicVisibility / 1000);
    if (t === 'public_embarrassment') s += 0.05 + 0.30 * (publicVisibility / 1000);

    if (t === 'tension_headache' || t === 'stiff_shoulders') s += 0.05 + 0.35 * (stress01k / 1000) + 0.20 * (fatigue01k / 1000);
    if (t === 'body_feels_strong') s += 0.05 + 0.30 * (latents.physicalConditioning / 1000) + Math.max(0, (needs01k.sleep - 650) / 360);

    if (t.startsWith('needed_')) {
      const needTag = t.replace(/^needed_/, '');
      if (needTag === 'company') s += Math.max(0, (620 - needs01k.belonging) / 300) + 0.20 * (latents.socialBattery / 1000);
      if (needTag === 'silence') s += Math.max(0, (stress01k - 520) / 340) + 0.20 * (1 - latents.socialBattery / 1000);
      if (needTag === 'control') s += Math.max(0, (620 - needs01k.autonomy) / 300) + 0.20 * (1 - latents.impulseControl / 1000);
      if (needTag === 'meaning') s += Math.max(0, (620 - needs01k.purpose) / 300) + 0.20 * (latents.principledness / 1000);
      if (needTag === 'walk') s += Math.max(0, (fatigue01k - 520) / 360) + 0.10 * (1 - latents.physicalConditioning / 1000);
    }

    // Role-flavored baseline thoughts.
    if (roleSeedTags.includes('media') && (t === 'too_much_scrutiny' || t === 'public_backlash')) s += 0.25;
    if ((roleSeedTags.includes('operative') || roleSeedTags.includes('security')) && (t === 'on_edge' || t === 'loss_of_control' || t === 'felt_watched')) s += 0.20;
    if (roleSeedTags.includes('analyst') && (t === 'ruminating' || t === 'imposter_syndrome')) s += 0.15;

    return Math.max(0, s + n);
  };

  const thoughtPool = uniqueStrings(vocab.deepSimPreview!.thoughtTags!);
  const thoughtCount = clampInt(3 + previewRng.int(0, 2), 2, 6);
  const scoredThoughts = thoughtPool.map(tag => ({ tag, score: thoughtScore(tag) }));
  let chosenThoughtTags = scoredThoughts
    .filter(x => x.score > 0.10)
    .sort((a, b) => (b.score - a.score) || a.tag.localeCompare(b.tag))
    .slice(0, thoughtCount)
    .map(x => x.tag);
  if (!chosenThoughtTags.length) {
    chosenThoughtTags = scoredThoughts.sort((a, b) => (b.score - a.score) || a.tag.localeCompare(b.tag)).slice(0, 3).map(x => x.tag);
  }

  const thoughts = chosenThoughtTags.slice(0, thoughtCount).map((tag) => {
    const sc = thoughtScore(tag);
    const intensity01k = clampFixed01k(Math.round(220 + 760 * sc));
    const tagRng = makeRng(fnv1a32(`${seed}::deep_sim_preview::thought::${tag}`));
    const expiresDay = clampInt(tagRng.int(2, 8), 1, 30);
    return { tag, source: thoughtSourceFor(tag), valence: thoughtValenceFor(tag), intensity01k, expiresDay };
  });

  const breakRisk01k = clampFixed01k(
    Math.round(
      120 +
        0.55 * stress01k +
        0.45 * fatigue01k +
        0.25 * Math.max(0, 600 - needs01k.safety) +
        0.18 * Math.max(0, 600 - needs01k.sleep) +
        0.18 * Math.max(0, 600 - needs01k.purpose) +
        220 * (1 - latents.impulseControl / 1000) +
        160 * (latents.stressReactivity / 1000) +
        120 * (latents.riskAppetite / 1000) +
        120 * viceTendency -
        140 * opsec01 -
        120 * (traits.conscientiousness / 1000) +
        previewRng.int(-90, 90),
    ),
  );

  const breakTypeScore = (type: string): number => {
    const n = stableNoise(`break:${type}`);
    const safetyDef = Math.max(0, 650 - needs01k.safety) / 650;
    const belongDef = Math.max(0, 650 - needs01k.belonging) / 650;
    const purposeDef = Math.max(0, 650 - needs01k.purpose) / 650;
    const stress = stress01k / 1000;
    const fatigue = fatigue01k / 1000;
    const impulseLo = 1 - latents.impulseControl / 1000;
    const opsecLo = 1 - opsec01;

    if (type === 'withdrawal') return Math.max(0, 0.15 + 0.45 * belongDef + 0.30 * fatigue + 0.25 * (1 - latents.socialBattery / 1000) + n);
    if (type === 'panic') return Math.max(0, 0.15 + 0.55 * safetyDef + 0.45 * stress + 0.25 * impulseLo + n);
    if (type === 'rage') return Math.max(0, 0.10 + 0.50 * fatigue + 0.35 * stress + 0.30 * (1 - traits.agreeableness / 1000) + 0.10 * impulseLo + n);
    if (type === 'confession_leak') return Math.max(0, 0.08 + 0.55 * safetyDef + 0.25 * (publicVisibility / 1000) + 0.25 * opsecLo + 0.20 * stress + n);
    if (type === 'sabotage') return Math.max(0, 0.08 + 0.50 * purposeDef + 0.35 * stress + 0.20 * impulseLo + 0.15 * (aptitudes.deceptionAptitude / 1000) + n);
    if (type === 'defection_attempt') return Math.max(0, 0.06 + 0.55 * safetyDef + 0.45 * purposeDef + 0.25 * (latents.cosmopolitanism / 1000) + 0.15 * risk01 + n);
    return Math.max(0, 0.05 + 0.30 * stress + 0.30 * fatigue + n);
  };

  const breakTypesPool = uniqueStrings(vocab.deepSimPreview!.breakTypes!);
  const breakTypesTopK = breakTypesPool
    .map(type => ({ type, score: breakTypeScore(type) }))
    .sort((a, b) => (b.score - a.score) || a.type.localeCompare(b.type))
    .slice(0, 2)
    .map(x => x.type);

  const deepSimPreview: DeepSimPreviewV1 = {
    version: 1,
    day0: 0,
    needs01k,
    baselineMood01k,
    mood01k,
    stress01k,
    fatigue01k,
    thoughts,
    breakRisk01k,
    breakRiskBand: band5From01k(breakRisk01k),
    breakTypesTopK,
  };
  traceSet(trace, 'deepSimPreview', deepSimPreview, { method: 'facetSeededSnapshot', dependsOn: { facet: 'deep_sim_preview', abroad: previewAbroad, recoveryOffline, securityPressure01k, publicVisibility, paperTrail, digitalHygiene } });

  const id = fnv1a32(`${seed}::${birthYear}::${homeCountryIso3}::${tierBand}`).toString(16);
  traceSet(trace, 'id', id, { method: 'fnv1a32', dependsOn: { normalizedSeed: seed, birthYear, homeCountryIso3, tierBand } });

	  traceFacet(trace, seed, 'created_at');
	  const createdAtRng = makeRng(facetSeed(seed, 'created_at'));
	  const createdAtIso = new Date(
	    Date.UTC(
	      asOfYear,
	      createdAtRng.int(0, 11),
	      createdAtRng.int(1, 28),
	      createdAtRng.int(0, 23),
	      createdAtRng.int(0, 59),
	      createdAtRng.int(0, 59),
	    ),
	  ).toISOString();
	  traceSet(trace, 'createdAtIso', createdAtIso, { method: 'facetSeededDateUtc', dependsOn: { facet: 'created_at', asOfYear } });

	  return {
	    version: 1,
	    id,
	    seed,
	    createdAtIso,
	    generationTrace: trace,
	    deepSimPreview,
	    identity: {
	      name,
      homeCountryIso3,
      citizenshipCountryIso3,
      currentCountryIso3,
      homeCulture,
      birthYear: effectiveBirthYear,
      tierBand,
      originTierBand,
      socioeconomicMobility,
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
    psych: { traits, ethics, contradictions },
    network,
    eliteCompensators,
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
    neurodivergence: {
      indicatorTags: neuroIndicatorTags,
      copingStrategies: neuroCopingStrategies,
    },
    spirituality: {
      affiliationTag: spiritualityAffiliationTag,
      observanceLevel: spiritualityObservanceLevel,
      practiceTypes: spiritualityPracticeTypes,
    },
    background: {
      adversityTags: backgroundAdversityTags,
      resilienceIndicators: backgroundResilienceIndicators,
    },
    gender: {
      identityTag: genderIdentityTag,
      pronounSet: genderPronounSet,
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
