/**
 * Agent Generator Utility Functions
 *
 * Pure utility functions for agent generation including:
 * - Clamping and normalization
 * - RNG (random number generation)
 * - Weighted selection algorithms
 * - Environment mixing (food, security, culture)
 * - Geography helpers
 * - Tracing utilities
 */

import type { Fixed, Band5, Latents, AgentGenerationTraceV1 } from './types';

// Re-export types for convenience
export type { Fixed, Band5, Latents, AgentGenerationTraceV1 };

// ============================================================================
// RNG Type
// ============================================================================

export type Rng = {
  nextU32: () => number;
  next01: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  pickK: <T>(items: readonly T[], k: number) => T[];
};

// ============================================================================
// Clamping Functions
// ============================================================================

export function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function clampFixed01k(value: number): Fixed {
  return clampInt(value, 0, 1000);
}

export function clampSigned01k(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1000, Math.min(1000, Math.round(value)));
}

export function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

export function band5From01k(value: Fixed): Band5 {
  if (value < 200) return 'very_low';
  if (value < 400) return 'low';
  if (value < 600) return 'medium';
  if (value < 800) return 'high';
  return 'very_high';
}

// ============================================================================
// RNG Functions
// ============================================================================

export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number): Rng {
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

export function facetSeed(seed: string, facet: string): number {
  return fnv1a32(`${seed}::${facet}`);
}

export function normalizeSeed(seed: string): string {
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

// ============================================================================
// Weighted Selection Functions
// ============================================================================

export function weightedPick(rng: Rng, items: Array<{ item: string; weight: number }>): string {
  // Degrade gracefully if upstream data is missing.
  // Returning an empty string avoids hard-crashing the UI; callers should treat "" as "unknown/absent".
  if (!items.length) return '';
  const cleaned = items
    .map(({ item, weight }) => ({ item, weight: Number.isFinite(weight) ? Math.max(0, weight) : 0 }))
    .filter(x => x.item && x.weight > 0);
  if (!cleaned.length) {
    // Fallback to uniform pick from all items with valid names
    const fallback = items.map(x => x.item).filter(Boolean);
    return fallback.length ? rng.pick(fallback) : '';
  }
  const total = cleaned.reduce((s, x) => s + x.weight, 0);
  let r = rng.next01() * total;
  for (const x of cleaned) {
    r -= x.weight;
    if (r <= 0) return x.item;
  }
  return cleaned[cleaned.length - 1]!.item;
}

export function weightedPickKUnique(rng: Rng, items: Array<{ item: string; weight: number }>, k: number): string[] {
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

export function topKByScore(items: readonly string[], score: (item: string) => number, k: number): string[] {
  return [...items]
    .map(item => ({ item, score: score(item) }))
    .sort((a, b) => (b.score - a.score) || a.item.localeCompare(b.item))
    .slice(0, Math.max(0, k))
    .map(x => x.item);
}

export function uniqueStrings(items: readonly string[]): string[] {
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

export function pickKHybrid(rng: Rng, primary: readonly string[], fallback: readonly string[], k: number, primaryCount: number): string[] {
  const primaryK = Math.max(0, Math.min(k, primaryCount));
  const fallbackK = Math.max(0, k - primaryK);
  const a = primary.length ? rng.pickK(primary, primaryK) : [];
  const b = fallback.length ? rng.pickK(fallback, fallbackK) : [];
  return uniqueStrings([...a, ...b]).slice(0, k);
}

// ============================================================================
// Food Environment Types and Functions
// ============================================================================

export type FoodEnvAxis =
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

export type FoodEnv01k = Record<FoodEnvAxis, Fixed>;

export const FOOD_ENV_AXES: readonly FoodEnvAxis[] = [
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

export function normalizeFoodEnv01k(env: Partial<Record<FoodEnvAxis, Fixed>> | null | undefined): FoodEnv01k | null {
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

export function mixFoodEnv01k(parts: Array<{ env: FoodEnv01k; weight: number }>): FoodEnv01k {
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

// ============================================================================
// Security Environment Types and Functions
// ============================================================================

export type SecurityEnvAxis = 'conflict' | 'stateViolence' | 'militarization';

export type SecurityEnv01k = Record<SecurityEnvAxis, Fixed>;

export const SECURITY_ENV_AXES: readonly SecurityEnvAxis[] = ['conflict', 'stateViolence', 'militarization'];

export function normalizeSecurityEnv01k(env: Partial<Record<SecurityEnvAxis, Fixed>> | null | undefined): SecurityEnv01k | null {
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

export function mixSecurityEnv01k(parts: Array<{ env: SecurityEnv01k; weight: number }>): SecurityEnv01k {
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

// ============================================================================
// Culture Environment Types and Functions
// ============================================================================

export type CultureEnvAxis = 'cosmopolitanism' | 'traditionalism' | 'mediaOpenness';

export type CultureEnv01k = Record<CultureEnvAxis, Fixed>;

export const CULTURE_ENV_AXES: readonly CultureEnvAxis[] = ['cosmopolitanism', 'traditionalism', 'mediaOpenness'];

export function normalizeCultureEnv01k(env: Partial<Record<CultureEnvAxis, Fixed>> | null | undefined): CultureEnv01k | null {
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

export function mixCultureEnv01k(parts: Array<{ env: CultureEnv01k; weight: number }>): CultureEnv01k {
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

// ============================================================================
// Weight Normalization and Mixing
// ============================================================================

export function normalizeWeights01k(raw: Record<string, number>): Record<string, Fixed> {
  const entries = Object.entries(raw).map(([k, v]) => [k, Number.isFinite(v) ? Math.max(0, v) : 0] as const);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return {};
  const out: Record<string, Fixed> = {};
  for (const [k, v] of entries) out[k] = clampFixed01k((v / total) * 1000);
  return out;
}

export function normalizeWeights01kExact(raw: Record<string, number>): Record<string, Fixed> {
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

export function mixWeights01k(parts: Array<{ weights: Record<string, Fixed>; weight: number }>): Record<string, Fixed> {
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

// ============================================================================
// Geography Helpers
// ============================================================================

// ISO3-based culture overrides for countries whose shadow continent doesn't match real-world culture
// These override the shadow continent mapping to use correct macro-culture

// East Asian countries that should map to 'East Asia'
export const EAST_ASIA_ISO3 = new Set([
  'CHN', 'JPN', 'KOR', 'TWN', 'MNG', 'PRK', 'HKG', 'MAC', // Core East Asia
  'VNM', 'THA', 'LAO', 'KHM', 'MMR', // Mainland Southeast Asia
  'IDN', 'MYS', 'SGP', 'BRN', 'TLS', 'PHL', // Maritime Southeast Asia
]);

// Americas countries (Caribbean, Central, North America) that are in shadow continents mapped to Europe
export const AMERICAS_ISO3 = new Set([
  // Caribbean
  'ATG', 'ABW', 'BHS', 'BRB', 'VGB', 'CYM', 'CUB', 'CUW', 'DMA', 'DOM',
  'GRD', 'GLP', 'HTI', 'JAM', 'MTQ', 'PRI', 'KNA', 'LCA', 'VCT', 'SXM',
  'TTO', 'TCA', 'VIR', 'AIA', 'BLM', 'MAF', 'BES',
  // Central America
  'BLZ', 'CRI', 'SLV', 'GTM', 'HND', 'NIC', 'PAN',
  // North America
  'CAN', 'USA', 'MEX', 'BMU', 'GRL', 'SPM',
]);

// South Asian countries that may be in wrong shadow continents
export const SOUTH_ASIA_ISO3 = new Set([
  'IND', 'PAK', 'BGD', 'LKA', 'NPL', 'BTN', 'MDV', 'AFG',
]);

// Sub-Saharan African countries that may be in wrong shadow continents
export const SUB_SAHARAN_AFRICA_ISO3 = new Set([
  // West Africa
  'SEN', 'GMB', 'GNB', 'GIN', 'SLE', 'LBR', 'CIV', 'MLI', 'BFA', 'GHA',
  'TGO', 'BEN', 'NER', 'NGA', 'CMR', 'CPV', 'MRT',
  // Central Africa
  'COD', 'COG', 'CAF', 'TCD', 'GAB', 'GNQ', 'STP', 'AGO',
  // East Africa
  'ETH', 'ERI', 'DJI', 'SOM', 'KEN', 'UGA', 'TZA', 'RWA', 'BDI', 'SSD',
  'SDN', 'COM', 'MUS', 'MDG', 'SYC', 'REU', 'MYT',
  // Southern Africa
  'ZAF', 'NAM', 'BWA', 'ZWE', 'ZMB', 'MWI', 'MOZ', 'SWZ', 'LSO',
]);

/**
 * Derives a macro-culture region from a continent name.
 * Returns shadow culture names (Hesper, Aram, Mero, etc.) to match the shadow world naming.
 */
export function deriveCultureFromContinent(continent: string | undefined, iso3?: string): string {
  // ISO3-based overrides take priority over continent mapping
  // This fixes cases where shadow continents mix real-world regions
  if (iso3) {
    const upperIso3 = iso3.toUpperCase();
    if (EAST_ASIA_ISO3.has(upperIso3)) return 'Solis-East';
    if (AMERICAS_ISO3.has(upperIso3)) return 'Athar-West';
    if (SOUTH_ASIA_ISO3.has(upperIso3)) return 'Solis-South';
    if (SUB_SAHARAN_AFRICA_ISO3.has(upperIso3)) return 'Mero';
  }
  const token = (continent ?? '').trim();
  if (!token) return 'Global';

  // Shadow continent names (primary format from shadow-country-map.json)
  const shadowContinentToCulture: Record<string, string> = {
    Pelag: 'Pelag',
    Mero: 'Mero',
    Aram: 'Aram',
    Solis: 'Solis-South',
    Hesper: 'Hesper',
    Athar: 'Hesper', // Athar overlaps with Hesper for European cultures
    Verd: 'Athar-West',
  };

  // Check shadow continent names first
  if (shadowContinentToCulture[token]) {
    return shadowContinentToCulture[token];
  }

  // Legacy real-world continent names (for backwards compatibility)
  const realWorldToCulture: Record<string, string> = {
    'Americas': 'Athar-West',
    'North America': 'Athar-West',
    'South America': 'Athar-West',
    'Central America': 'Athar-West',
    'Europe': 'Hesper',
    'MENA': 'Aram',
    'Middle East': 'Aram',
    'North Africa': 'Aram',
    'Sub-Saharan Africa': 'Mero',
    'Sub\u2011Saharan Africa': 'Mero', // Non-breaking hyphen variant
    'Africa': 'Mero',
    'South Asia': 'Solis-South',
    'East Asia': 'Solis-East',
    'Southeast Asia': 'Solis-East',
    'Asia': 'Solis-South', // Fallback for generic "Asia"
    'Oceania': 'Pelag',
    'Pacific': 'Pelag',
    'Australia': 'Pelag',
  };

  // Check real-world names (case-insensitive)
  const normalizedToken = token.toLowerCase();
  for (const [key, value] of Object.entries(realWorldToCulture)) {
    if (key.toLowerCase() === normalizedToken) {
      return value;
    }
  }

  return 'Global';
}

// ============================================================================
// Tracing Utilities
// ============================================================================

export function traceSet(
  trace: AgentGenerationTraceV1 | undefined,
  path: string,
  value: unknown,
  meta?: { method?: string; dependsOn?: Record<string, unknown> },
): void {
  if (!trace) return;
  trace.fields[path] = { value, ...(meta ?? {}) };
}

export function traceFacet(trace: AgentGenerationTraceV1 | undefined, seed: string, facet: string): void {
  if (!trace) return;
  trace.facetSeeds[facet] = facetSeed(seed, facet);
}

// ============================================================================
// Formatting helpers
// ============================================================================

/**
 * Format a Fixed value (0-1000) as a percentage string
 */
export function formatFixed01k(value: Fixed): string {
  const pct = clampInt((value / 1000) * 100, 0, 100);
  return `${pct}%`;
}

/**
 * Format a Fixed value (0-1000) as a Band5 label
 */
export function formatBand5(value: Fixed): Band5 {
  return band5From01k(value);
}
