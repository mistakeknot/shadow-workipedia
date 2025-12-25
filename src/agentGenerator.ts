export type TierBand = 'elite' | 'middle' | 'mass';

export type Band5 = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export type Fixed = number; // fixed-point int, typically 0..1000

export type HeightBand = 'very_short' | 'short' | 'average' | 'tall' | 'very_tall';

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
  cultureProfiles?: Record<string, CultureProfileV1>;
};

export type GeneratedAgent = {
  version: 1;
  id: string;
  seed: string;
  createdAtIso: string;

  identity: {
    name: string;
    homeCountryIso3: string;
    homeCulture: string;
    birthYear: number;
    tierBand: TierBand;
    roleSeedTags: string[];
    languages: string[];
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
  seed: string;
  birthYear?: number;
  tierBand?: TierBand;
  homeCulture?: string;
  roleSeedTags?: string[];
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

function pickWeightedFromPools(rng: Rng, primary: readonly string[], fallback: readonly string[], primaryWeight: number): string {
  const usePrimary = primary.length > 0 && rng.next01() < primaryWeight;
  const pool = usePrimary ? primary : fallback;
  return rng.pick(pool);
}

function pickKHybrid(rng: Rng, primary: readonly string[], fallback: readonly string[], k: number, primaryCount: number): string[] {
  const primaryK = Math.max(0, Math.min(k, primaryCount));
  const fallbackK = Math.max(0, k - primaryK);
  const a = primary.length ? rng.pickK(primary, primaryK) : [];
  const b = fallback.length ? rng.pickK(fallback, fallbackK) : [];
  return uniqueStrings([...a, ...b]).slice(0, k);
}

export function generateAgent(input: GenerateAgentInput): GeneratedAgent {
  const seed = normalizeSeed(input.seed);
  const base = makeRng(facetSeed(seed, 'base'));

  const birthYear = clampInt(input.birthYear ?? base.int(1960, 2006), 1800, 2525);
  const vocab = input.vocab;
  if (vocab.version !== 1) throw new Error(`Unsupported agent vocab version: ${String((vocab as { version?: unknown }).version)}`);
  if (!vocab.identity.tierBands.length) throw new Error('Agent vocab missing: identity.tierBands');
  if (!vocab.identity.homeCultures.length) throw new Error('Agent vocab missing: identity.homeCultures');
  if (!vocab.identity.roleSeedTags.length) throw new Error('Agent vocab missing: identity.roleSeedTags');
  if (!vocab.identity.firstNames.length || !vocab.identity.lastNames.length) throw new Error('Agent vocab missing: identity name pools');
  if (!vocab.identity.languages.length) throw new Error('Agent vocab missing: identity.languages');

  const tierBand: TierBand = input.tierBand ?? base.pick(vocab.identity.tierBands as readonly TierBand[]);

  const countries = input.countries;
  const validCountries = countries.filter((c) => typeof c.iso3 === 'string' && c.iso3.trim().length === 3);
  if (!validCountries.length) throw new Error('Agent country map missing: no ISO3 entries');
  const originRng = makeRng(facetSeed(seed, 'origin'));
  const origin = originRng.pick(validCountries);
  const homeCountryIso3 = origin.iso3.trim().toUpperCase();

  const shadowContinentToCulture: Record<string, string> = {
    Pelag: 'Oceania',
    Mero: 'Sub‑Saharan Africa',
    Aram: 'MENA',
    Solis: 'South Asia',
    Hesper: 'Europe',
    Athar: 'Europe',
    Verd: 'Americas',
  };

  const derivedCulture = shadowContinentToCulture[(origin.continent ?? '').trim()] ?? 'Global';
  const homeCulture = (input.homeCulture ?? derivedCulture ?? base.pick(vocab.identity.homeCultures)) as string;
  const roleSeedTags = (input.roleSeedTags?.length ? input.roleSeedTags : base.pickK(vocab.identity.roleSeedTags, 2))
    .slice(0, 4);

  const culture = vocab.cultureProfiles?.[homeCulture];
  const cultureWeights = culture?.weights ?? {};
  const namesPrimaryWeight = clamp01(cultureWeights.namesPrimaryWeight ?? 0.75, 0.75);
  const languagesPrimaryWeight = clamp01(cultureWeights.languagesPrimaryWeight ?? 0.85, 0.85);
  const foodPrimaryWeight = clamp01(cultureWeights.foodPrimaryWeight ?? 0.7, 0.7);
  const mediaPrimaryWeight = clamp01(cultureWeights.mediaPrimaryWeight ?? 0.7, 0.7);
  const fashionPrimaryWeight = clamp01(cultureWeights.fashionPrimaryWeight ?? 0.6, 0.6);

  const nameRng = makeRng(facetSeed(seed, 'name'));
  const cultureFirst = culture?.identity?.firstNames ?? [];
  const cultureLast = culture?.identity?.lastNames ?? [];
  const name = `${pickWeightedFromPools(nameRng, cultureFirst, vocab.identity.firstNames, namesPrimaryWeight)} ${pickWeightedFromPools(nameRng, cultureLast, vocab.identity.lastNames, namesPrimaryWeight)}`;

  const langRng = makeRng(facetSeed(seed, 'languages'));
  const cultureLangs = uniqueStrings(culture?.identity?.languages ?? []);
  const baseLangs = uniqueStrings(vocab.identity.languages);
  const unionLangs = uniqueStrings([...cultureLangs, ...baseLangs]);
  const languageCount = langRng.int(1, 3);
  const languages: string[] = [];
  if (cultureLangs.length && langRng.next01() < languagesPrimaryWeight) {
    languages.push(langRng.pick(cultureLangs));
  } else {
    languages.push(langRng.pick(baseLangs));
  }
  const remaining = Math.max(0, languageCount - languages.length);
  languages.push(...langRng.pickK(unionLangs.filter(l => !languages.includes(l)), remaining));

  const appearanceRng = makeRng(facetSeed(seed, 'appearance'));
  if (!vocab.appearance.heightBands.length) throw new Error('Agent vocab missing: appearance.heightBands');
  if (!vocab.appearance.buildTags.length) throw new Error('Agent vocab missing: appearance.buildTags');
  if (!vocab.appearance.hairColors.length || !vocab.appearance.hairTextures.length) throw new Error('Agent vocab missing: appearance hair pools');
  if (!vocab.appearance.eyeColors.length) throw new Error('Agent vocab missing: appearance.eyeColors');
  if (!vocab.appearance.voiceTags.length) throw new Error('Agent vocab missing: appearance.voiceTags');

  const heightBand = appearanceRng.pick(vocab.appearance.heightBands as readonly HeightBand[]);
  const buildTag = appearanceRng.pick(vocab.appearance.buildTags);
  const hair = { color: appearanceRng.pick(vocab.appearance.hairColors), texture: appearanceRng.pick(vocab.appearance.hairTextures) };
  const eyes = { color: appearanceRng.pick(vocab.appearance.eyeColors) };
  const voiceTag = appearanceRng.pick(vocab.appearance.voiceTags);
  const distinguishingMarks = appearanceRng.pickK(vocab.appearance.distinguishingMarks, appearanceRng.int(0, 2));

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

  const skillRng = makeRng(facetSeed(seed, 'skills'));
  const baseSkillValue = (min: number, max: number) => clampFixed01k(skillRng.int(min, max));

  if (!vocab.capabilities.skillKeys.length) throw new Error('Agent vocab missing: capabilities.skillKeys');

  const skills: GeneratedAgent['capabilities']['skills'] = Object.fromEntries(
    vocab.capabilities.skillKeys.map((k) => [k, { value: baseSkillValue(120, 720), xp: clampFixed01k(skillRng.int(0, 500)), lastUsedDay: null }])
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

  const prefsRng = makeRng(facetSeed(seed, 'preferences'));
  if (!vocab.preferences.food.comfortFoods.length) throw new Error('Agent vocab missing: preferences.food.comfortFoods');
  if (!vocab.preferences.food.dislikes.length) throw new Error('Agent vocab missing: preferences.food.dislikes');
  if (!vocab.preferences.food.restrictions.length) throw new Error('Agent vocab missing: preferences.food.restrictions');
  if (!vocab.preferences.food.ritualDrinks.length) throw new Error('Agent vocab missing: preferences.food.ritualDrinks');

  const cultureComfort = uniqueStrings(culture?.preferences?.food?.comfortFoods ?? []);
  const comfortFoods = cultureComfort.length && prefsRng.next01() < foodPrimaryWeight
    ? pickKHybrid(prefsRng, cultureComfort, vocab.preferences.food.comfortFoods, 2, 1)
    : prefsRng.pickK(vocab.preferences.food.comfortFoods, 2);
  const dislikes = prefsRng.pickK(vocab.preferences.food.dislikes, prefsRng.int(1, 3));
  const restrictions = prefsRng.pickK(vocab.preferences.food.restrictions, prefsRng.int(0, 1));
  const cultureDrinks = uniqueStrings(culture?.preferences?.food?.ritualDrinks ?? []);
  const ritualDrink = cultureDrinks.length
    ? pickWeightedFromPools(prefsRng, cultureDrinks, vocab.preferences.food.ritualDrinks, foodPrimaryWeight)
    : prefsRng.pick(vocab.preferences.food.ritualDrinks);

  if (!vocab.preferences.media.genres.length) throw new Error('Agent vocab missing: preferences.media.genres');
  if (!vocab.preferences.media.platforms.length) throw new Error('Agent vocab missing: preferences.media.platforms');
  const cultureGenres = uniqueStrings(culture?.preferences?.media?.genres ?? []);
  const genreTopK = cultureGenres.length && prefsRng.next01() < mediaPrimaryWeight
    ? pickKHybrid(prefsRng, cultureGenres, vocab.preferences.media.genres, 5, 3)
    : prefsRng.pickK(vocab.preferences.media.genres, 5);
  const platformDietRaw = vocab.preferences.media.platforms.map(p => ({ p, w: prefsRng.int(1, 100) }));
  const totalW = platformDietRaw.reduce((s, x) => s + x.w, 0);
  const platformDiet: Record<string, Fixed> = Object.fromEntries(platformDietRaw.map(({ p, w }) => [p, clampInt((w / totalW) * 1000, 0, 1000)]));

  const fashionRng = makeRng(facetSeed(seed, 'fashion'));
  if (!vocab.preferences.fashion.styleTags.length) throw new Error('Agent vocab missing: preferences.fashion.styleTags');
  const cultureStyle = uniqueStrings(culture?.preferences?.fashion?.styleTags ?? []);
  const styleTags = cultureStyle.length && fashionRng.next01() < fashionPrimaryWeight
    ? pickKHybrid(fashionRng, cultureStyle, vocab.preferences.fashion.styleTags, 3, 2)
    : fashionRng.pickK(vocab.preferences.fashion.styleTags, 3);
  const formality = clampFixed01k(fashionRng.int(0, 1000));
  const conformity = clampFixed01k(fashionRng.int(0, 1000));
  const statusSignaling = clampFixed01k(fashionRng.int(0, 1000));

  const routinesRng = makeRng(facetSeed(seed, 'routines'));
  if (!vocab.routines.chronotypes.length) throw new Error('Agent vocab missing: routines.chronotypes');
  if (!vocab.routines.recoveryRituals.length) throw new Error('Agent vocab missing: routines.recoveryRituals');
  const chronotype = routinesRng.pick(vocab.routines.chronotypes);
  const sleepWindow = chronotype === 'early' ? '22:00–06:00' : chronotype === 'night' ? '02:00–10:00' : '00:00–08:00';
  const recoveryRituals = routinesRng.pickK(vocab.routines.recoveryRituals, 2);

  const vicesRng = makeRng(facetSeed(seed, 'vices'));
  if (!vocab.vices.vicePool.length) throw new Error('Agent vocab missing: vices.vicePool');
  if (!vocab.vices.triggers.length) throw new Error('Agent vocab missing: vices.triggers');
  const viceCount = vicesRng.int(0, 2);
  const vices = vicesRng.pickK(vocab.vices.vicePool, viceCount).map((vice) => {
    const severityValue = clampFixed01k(vicesRng.int(100, 950));
    const triggers = vicesRng.pickK(vocab.vices.triggers, vicesRng.int(1, 3));
    return { vice, severity: band5From01k(severityValue), triggers };
  });

  const logisticsRng = makeRng(facetSeed(seed, 'logistics'));
  if (!vocab.logistics.identityKitItems.length) throw new Error('Agent vocab missing: logistics.identityKitItems');
  const kitItems = logisticsRng.pickK(vocab.logistics.identityKitItems, 5)
    .map((item) => {
      const security = band5From01k(clampFixed01k(logisticsRng.int(150, 900)));
      return { item, security, compromised: false };
    });

  const id = fnv1a32(`${seed}::${birthYear}::${homeCountryIso3}::${tierBand}`).toString(16);

  return {
    version: 1,
    id,
    seed,
    createdAtIso: new Date().toISOString(),
    identity: {
      name,
      homeCountryIso3,
      homeCulture,
      birthYear,
      tierBand,
      roleSeedTags,
      languages,
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
        attentionResilience: clampFixed01k(prefsRng.int(0, 1000)),
        doomscrollingRisk: clampFixed01k(prefsRng.int(0, 1000)),
        epistemicHygiene: clampFixed01k(prefsRng.int(0, 1000)),
      },
      fashion: { styleTags, formality, conformity, statusSignaling },
    },
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
