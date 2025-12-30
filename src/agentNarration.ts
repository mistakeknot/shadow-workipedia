/**
 * Agent narration generation - pure functions for DF-style narrative text.
 * Extracted for testability and reuse.
 */

import tracery from 'tracery-grammar';
import narrationSpec from './agentNarration.v1.json';
import type { GeneratedAgent, Band5 } from './agent';
import { formatBand5 } from './agent';

// ─────────────────────────────────────────────────────────────
// Deterministic RNG
// ─────────────────────────────────────────────────────────────

export function hashStringToU32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeXorshiftRng(seed: string): () => number {
  let state = hashStringToU32(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function setTraceryRng(rng: () => number) {
  const fn = (tracery as unknown as { setRng?: (r: () => number) => void }).setRng;
  if (fn) fn(rng);
}

let traceryRngCurrent: () => number = Math.random;
function withTraceryRng<T>(rng: () => number, fn: () => T): T {
  const prev = traceryRngCurrent;
  traceryRngCurrent = rng;
  setTraceryRng(rng);
  try {
    return fn();
  } finally {
    traceryRngCurrent = prev;
    setTraceryRng(prev);
  }
}

// ─────────────────────────────────────────────────────────────
// Selection helpers
// ─────────────────────────────────────────────────────────────

export function pickVariant(seed: string, key: string, variants: readonly string[]): string {
  if (!variants.length) return '';
  const idx = hashStringToU32(`${seed}::${key}`) % variants.length;
  return variants[idx] ?? '';
}

export function pickKUnique(seed: string, key: string, values: readonly string[], k: number): string[] {
  if (!values.length || k <= 0) return [];
  const picks: string[] = [];
  const used = new Set<number>();
  const rounds = Math.min(values.length, k);
  for (let i = 0; i < rounds; i++) {
    const base = hashStringToU32(`${seed}::${key}::${i}`);
    let idx = base % values.length;
    for (let probe = 0; probe < values.length && used.has(idx); probe++) idx = (idx + 1) % values.length;
    used.add(idx);
    picks.push(values[idx] ?? '');
  }
  return picks.filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// Text transformations
// ─────────────────────────────────────────────────────────────

// Proper nouns that should be capitalized (heritage terms, languages, regions)
const PROPER_NOUNS = new Set([
  // European
  'hungarian', 'celtic', 'iberian', 'ashkenazi', 'sephardic', 'sephardi', 'mizrahi',
  'greek', 'albanian', 'romanian', 'bulgarian', 'slovak', 'germanic',
  'french', 'spanish', 'portuguese', 'italian', 'german', 'dutch',
  'swedish', 'norwegian', 'danish', 'finnish', 'estonian', 'latvian', 'lithuanian',
  'irish', 'scottish', 'welsh', 'basque', 'catalan', 'galician',
  'nordic', 'balkan', 'baltic', 'slavic', 'anglo',
  'russian', 'ukrainian', 'polish', 'czech', 'serbian', 'croatian', 'bosnian',
  // Middle East & Central Asia
  'persian', 'turkish', 'kurdish', 'arabic', 'arab', 'hebrew', 'urdu', 'hindi',
  'levantine', 'maghrebi', 'egyptian', 'iranian', 'uzbek', 'kazakh',
  'pashto', 'sindhi', 'punjabi',
  // South Asia
  'bengali', 'tamil', 'telugu', 'gujarati', 'marathi', 'malayalam', 'kannada',
  'dravidian', 'indic', 'pakistani', 'indian', 'nepali', 'sri lankan', 'bangladeshi',
  // East Asia
  'mandarin', 'cantonese', 'hokkien', 'hakka', 'korean', 'japanese', 'han',
  'sinitic', 'sinosphere',
  // Southeast Asia
  'thai', 'vietnamese', 'khmer', 'lao', 'burmese', 'malay', 'indonesian',
  'javanese', 'sundanese', 'tagalog', 'filipino', 'cebuano', 'ilocano',
  // Africa
  'yoruba', 'igbo', 'hausa', 'zulu', 'xhosa', 'amhara', 'oromo', 'somali',
  'swahili', 'bantu', 'nilotic', 'berber', 'tuareg', 'fulani', 'akan', 'wolof',
  'afrikaans',
  // Americas
  'andean', 'amazonian', 'maya', 'aztec', 'inca', 'mapuche', 'guarani',
  'navajo', 'cherokee', 'sioux', 'apache', 'inuit', 'metis',
  'mesoamerican', 'mestizo', 'caribbean', 'brazilian', 'mexican', 'cuban',
  'colombian', 'venezuelan', 'peruvian', 'argentine', 'chilean', 'ecuadorian',
  'puerto rican', 'dominican', 'haitian', 'jamaican', 'trinidadian',
  // Oceania
  'maori', 'polynesian', 'melanesian', 'aboriginal', 'torres',
  // General regional
  'african', 'european', 'asian', 'american', 'australian',
  'mediterranean', 'scandinavian', 'caucasian',
  'latin', 'franco', 'italic', 'hellenic',
]);

export function toNarrativePhrase(input: string): string {
  // First, expand camelCase: "harmAversion" -> "harm Aversion"
  const expanded = input.replace(/([a-z])([A-Z])/g, '$1 $2');
  const normalized = expanded.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) return normalized;
  const words = normalized.split(' ').map((w) => {
    if (w === 'tv') return 'TV';
    if (w === 'ai') return 'AI';
    if (w === 'opsec') return 'OPSEC';
    if (w === 'r&d') return 'R&D';
    // Capitalize proper nouns (heritage terms, languages, ethnicities)
    if (PROPER_NOUNS.has(w)) return w.charAt(0).toUpperCase() + w.slice(1);
    return w;
  });
  return words.join(' ')
    .replace(/\bsci fi\b/g, 'sci-fi')
    .replace(/\bsoft spoken\b/g, 'soft-spoken')
    .replace(/\bsteel blue\b/g, 'steel-blue')
    .replace(/\bblue green\b/g, 'blue-green')
    .replace(/\bblue black\b/g, 'blue-black')
    .replace(/\bsalt and pepper\b/g, 'salt-and-pepper')
    // Compound adjectives that need hyphens
    .replace(/\bdata driven\b/g, 'data-driven')
    .replace(/\bself deprecating\b/g, 'self-deprecating')
    .replace(/\bself directed\b/g, 'self-directed')
    .replace(/\bself developed\b/g, 'self-developed')
    .replace(/\bperi urban\b/g, 'peri-urban')
    .replace(/\blong limbed\b/g, 'long-limbed')
    .replace(/\bbarrel chested\b/g, 'barrel-chested')
    .replace(/\bbroad shouldered\b/g, 'broad-shouldered')
    .replace(/\bnarrative driven\b/g, 'narrative-driven')
    .replace(/\bauthority driven\b/g, 'authority-driven')
    .replace(/\bconsensus seeking\b/g, 'consensus-seeking')
    .replace(/\bdata heavy\b/g, 'data-heavy')
    .replace(/\brisk averse\b/g, 'risk-averse')
    .replace(/\brisk seeking\b/g, 'risk-seeking')
    .replace(/\brisk neutral\b/g, 'risk-neutral')
    .replace(/\bwork focused\b/g, 'work-focused')
    .replace(/\bhigh strung\b/g, 'high-strung')
    .replace(/\blow key\b/g, 'low-key')
    .replace(/\bhigh powered\b/g, 'high-powered')
    .replace(/\bwell connected\b/g, 'well-connected')
    .replace(/\bmid level\b/g, 'mid-level')
    .replace(/\bpaint stained\b/g, 'paint-stained')
    .replace(/\bslow cooked\b/g, 'slow-cooked')
    .replace(/\bink stained\b/g, 'ink-stained')
    .replace(/\bhand eye\b/g, 'hand-eye')
    .replace(/\bbinge watching\b/g, 'binge-watching')
    .replace(/\bonline arguing\b/g, 'online-arguing')
    .replace(/\bcrypto trading\b/g, 'crypto-trading')
    .replace(/\bstreet formal\b/g, 'street-formal')
    .replace(/\bplatinum blonde\b/g, 'platinum-blonde')
    .replace(/\bombre afro\b/g, 'ombré afro')
    .replace(/\bafro brazilian\b/gi, 'Afro-Brazilian')
    .replace(/\bafro caribbean\b/gi, 'Afro-Caribbean')
    .replace(/\bafro cuban\b/gi, 'Afro-Cuban')
    .replace(/\bafro latin\b/gi, 'Afro-Latin')
    .replace(/\bafrofuturism\b/gi, 'Afrofuturism')
    // Acronyms that need capitalization in context
    .replace(/\bit security\b/g, 'IT security')
    .replace(/\bit policy\b/g, 'IT policy')
    .replace(/\bit ops\b/g, 'IT ops')
    .replace(/\bbbq\b/gi, 'BBQ')
    .replace(/\bk drama\b/gi, 'K-drama')
    .replace(/\bngo\b/gi, 'NGO')
    .replace(/\bhumint\b/gi, 'HUMINT')
    .replace(/\bosint\b/gi, 'OSINT')
    .replace(/\bsigint\b/gi, 'SIGINT');
}

function capitalizeFirst(input: string): string {
  if (!input) return input;
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function humanizeSkillKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return toTitleCaseWords(spaced);
}

// ISO 639 language code to readable name mapping
const LANGUAGE_CODE_MAP: Record<string, string> = {
  // Major world languages
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ru: 'Russian', zh: 'Mandarin', ja: 'Japanese', ko: 'Korean',
  ar: 'Arabic', hi: 'Hindi', bn: 'Bengali', ur: 'Urdu', pa: 'Punjabi',
  // Chinese varieties
  yue: 'Cantonese', nan: 'Hokkien', wuu: 'Shanghainese', hsn: 'Xiang',
  hak: 'Hakka', gan: 'Gan',
  // South Asian
  ta: 'Tamil', te: 'Telugu', mr: 'Marathi', gu: 'Gujarati', ml: 'Malayalam',
  kn: 'Kannada', or: 'Odia', ne: 'Nepali', si: 'Sinhala',
  // Southeast Asian
  vi: 'Vietnamese', th: 'Thai', id: 'Indonesian', ms: 'Malay', my: 'Burmese',
  tl: 'Tagalog', ceb: 'Cebuano', ilo: 'Ilocano', km: 'Khmer', lo: 'Lao',
  // Middle Eastern
  fa: 'Persian', he: 'Hebrew', tr: 'Turkish', ku: 'Kurdish',
  arz: 'Egyptian Arabic', aeb: 'Tunisian Arabic', arb: 'Gulf Arabic',
  // African
  sw: 'Swahili', ha: 'Hausa', yo: 'Yoruba', ig: 'Igbo', am: 'Amharic',
  om: 'Oromo', so: 'Somali', zu: 'Zulu', xh: 'Xhosa', af: 'Afrikaans',
  // European
  pl: 'Polish', nl: 'Dutch', sv: 'Swedish', no: 'Norwegian', da: 'Danish',
  fi: 'Finnish', el: 'Greek', cs: 'Czech', ro: 'Romanian', hu: 'Hungarian',
  uk: 'Ukrainian', be: 'Belarusian', bg: 'Bulgarian', sr: 'Serbian',
  hr: 'Croatian', sk: 'Slovak', sl: 'Slovenian', lt: 'Lithuanian',
  lv: 'Latvian', et: 'Estonian', sq: 'Albanian', mk: 'Macedonian',
  bs: 'Bosnian', mt: 'Maltese', ga: 'Irish', cy: 'Welsh', eu: 'Basque',
  ca: 'Catalan', gl: 'Galician',
  // Central Asian
  uz: 'Uzbek', kk: 'Kazakh', ky: 'Kyrgyz', tk: 'Turkmen', tg: 'Tajik',
  mn: 'Mongolian', ka: 'Georgian', hy: 'Armenian', az: 'Azerbaijani',
  // Creoles and pidgins
  pcm: 'Nigerian Pidgin', ht: 'Haitian Creole', crs: 'Seychellois Creole',
  // Additional South Asian
  as: 'Assamese', mai: 'Maithili', mag: 'Magahi', rkt: 'Rangpuri', lah: 'Saraiki',
  // Additional African
  ny: 'Chichewa', bm: 'Bambara', mg: 'Malagasy', ak: 'Akan',
  // Additional languages
  ps: 'Pashto', dz: 'Dzongkha', dv: 'Divehi', fo: 'Faroese',
  apd: 'Sudanese Arabic',
  // Commonly generated codes that may be missing
  st: 'Sesotho', kl: 'Kalaallisut', bem: 'Bemba', sn: 'Shona',
  rw: 'Kinyarwanda', lg: 'Luganda', wo: 'Wolof', ff: 'Fula',
  ti: 'Tigrinya', tw: 'Twi', ee: 'Ewe', tn: 'Tswana', ts: 'Tsonga',
  ve: 'Venda', ss: 'Swati', nr: 'Southern Ndebele', nd: 'Northern Ndebele',
  chy: 'Cheyenne', cr: 'Cree', oj: 'Ojibwe', nv: 'Navajo',
};

function languageCodeToName(code: string): string {
  const normalized = code.toLowerCase().trim();
  const name = LANGUAGE_CODE_MAP[normalized];
  if (name) return name;
  // If not found, try toNarrativePhrase as fallback (might be already a name)
  const phrased = toNarrativePhrase(code);
  // Capitalize first letter if it looks like a language name
  if (phrased.length > 1) return phrased.charAt(0).toUpperCase() + phrased.slice(1);
  return code.toUpperCase(); // Last resort: just uppercase the code
}

function toTitleCaseWords(input: string): string {
  const normalized = input.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return normalized;
  const words = normalized.split(' ').map((word) => {
    const w = word.toLowerCase();
    if (w === 'tv') return 'TV';
    if (w === 'ai') return 'AI';
    if (w === 'opsec') return 'OPSEC';
    if (w === 'df') return 'DF';
    if (w === 'r&d') return 'R&D';
    if (w === 'ngo') return 'NGO';
    if (w === 'humint') return 'HUMINT';
    if (w === 'osint') return 'OSINT';
    if (w === 'sigint') return 'SIGINT';
    if (w === 'sci' || w === 'sci-fi' || w === 'scifi') return 'Sci-Fi';
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
  return words.join(' ').replace(/\bSci Fi\b/g, 'Sci-Fi');
}

// ─────────────────────────────────────────────────────────────
// Article / joining helpers
// ─────────────────────────────────────────────────────────────

export function aOrAn(phrase: string): string {
  const p = phrase.trim();
  if (!p) return 'a';
  const c = p[0]?.toLowerCase() ?? '';
  if ('aeiou'.includes(c)) return 'an';
  return 'a';
}

function needsIndefiniteArticle(phrase: string): boolean {
  const p = phrase.trim().toLowerCase();
  if (!p) return false;
  if (p.startsWith('a ') || p.startsWith('an ') || p.startsWith('the ')) return false;
  const last = p.split(/\s+/).pop() ?? p;
  if (last.endsWith('s') && !last.endsWith('ss')) return false;
  return true;
}

export function withIndefiniteArticle(phrase: string): string {
  const p = phrase.trim();
  if (!p) return p;
  return needsIndefiniteArticle(p) ? `${aOrAn(p)} ${p}` : p;
}

export function oxfordJoin(items: string[]): string {
  const xs = items.map(s => s.trim()).filter(Boolean);
  if (xs.length <= 1) return xs[0] ?? '';
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
}

function toGerund(verb: string): string {
  const v = verb.toLowerCase();
  if (v.endsWith('ie')) return `${v.slice(0, -2)}ying`;
  if (v.endsWith('e') && !v.endsWith('ee')) return `${v.slice(0, -1)}ing`;
  // Words where we DON'T double the final consonant despite CVC ending
  // (multi-syllable words with stress NOT on final syllable)
  const noDoubleConsonant = new Set(['visit', 'listen', 'garden', 'open', 'happen', 'offer', 'order', 'enter']);
  if (noDoubleConsonant.has(v)) return `${v}ing`;
  // Double final consonant only for CVC pattern (single vowel before consonant)
  // "run" -> "running", "swim" -> "swimming", but NOT "cook" -> "cooking" (double vowel)
  if (/[^aeiou][aeiou][bcdfghjklmnpqrstvwxyz]$/.test(v) && v.length >= 3) return `${v}${v.slice(-1)}ing`;
  return `${v}ing`;
}

function isGerundPhrase(phrase: string): boolean {
  // Check if phrase is a gerund or starts with a gerund
  const words = phrase.trim().toLowerCase().split(/\s+/);
  const first = words[0] ?? '';
  return first.endsWith('ing');
}

function toRecoveryActivity(raw: string): string {
  const phrase = toNarrativePhrase(raw);
  if (!phrase) return phrase;
  // Already a gerund phrase: keep as-is without article
  if (isGerundPhrase(phrase)) return phrase;
  if (phrase.endsWith(' music')) return `listening to ${phrase}`;
  const parts = phrase.split(/\s+/);
  const first = parts[0] ?? '';
  const rest = parts.slice(1).join(' ');
  const verbStarters = new Set([
    'call', 'clean', 'cook', 'visit', 'watch', 'sketch', 'journal',
    'meditate', 'stretch', 'stargaze', 'garden', 'swim', 'run', 'read', 'write', 'walk',
  ]);
  // Nouns that should be converted to gerund form (meditation -> meditating)
  const nounToGerund: Record<string, string> = {
    'meditation': 'meditating',
    'yoga': 'doing yoga',
    'prayer': 'praying',
    'nap': 'napping',
    'bath': 'taking a bath',
  };
  if (nounToGerund[phrase]) return nounToGerund[phrase];
  if (verbStarters.has(first)) {
    const gerund = toGerund(first);
    // Return gerund form - NO article for gerund activities
    return rest ? `${gerund} ${rest}` : gerund;
  }
  // Only add article for noun phrases (not gerund activities)
  return withIndefiniteArticle(phrase);
}

export function joinTwoWithPlusIfAmbiguous(items: string[]): string {
  const xs = items.map(s => s.trim()).filter(Boolean);
  if (xs.length <= 1) return xs[0] ?? '';
  if (xs.length === 2) {
    const a = xs[0] ?? '';
    const b = xs[1] ?? '';
    const ambiguous = a.includes(' and ') || a.includes(' or ') || b.includes(' and ') || b.includes(' or ');
    return ambiguous ? `${a}, plus ${b}` : `${a} and ${b}`;
  }
  return oxfordJoin(xs);
}

// ─────────────────────────────────────────────────────────────
// Pronouns
// ─────────────────────────────────────────────────────────────

export type PronounMode = 'seeded' | 'they' | 'he' | 'she' | 'name';

/**
 * Maps agent's gender.pronounSet (e.g., "he-him", "she-her") to PronounMode.
 * This ensures narration uses the agent's actual pronouns rather than random assignment.
 */
export function pronounSetToMode(pronounSet: string, seed?: string): Exclude<PronounMode, 'seeded'> {
  const normalized = pronounSet.toLowerCase().trim();
  const pickFrom = (options: Array<Exclude<PronounMode, 'seeded'>>): Exclude<PronounMode, 'seeded'> => {
    if (!options.length) return 'they';
    if (!seed) return options[0] ?? 'they';
    const idx = hashStringToU32(`${seed}::pronounSet::${normalized}`) % options.length;
    return options[idx] ?? options[0] ?? 'they';
  };

  // Handle explicit mixed sets first (avoid "startsWith" swallowing them).
  if (normalized === 'he-they') return pickFrom(['he', 'they']);
  if (normalized === 'she-they') return pickFrom(['she', 'they']);

  if (normalized === 'he-him' || normalized === 'he') return 'he';
  if (normalized === 'she-her' || normalized === 'she') return 'she';
  if (normalized === 'they-them' || normalized === 'they') return 'they';

  // For "any-pronouns", deterministically pick among the main sets.
  if (normalized === 'any-pronouns') return pickFrom(['they', 'she', 'he']);

  // For "neopronouns" (or unknown), default to they/them for now.
  return 'they';
}

type Pronouns = { Subj: string; subj: string; possAdj: string; be: string; have: string };

function seededPronounFromSeed(seed: string): Exclude<PronounMode, 'seeded'> {
  const roll = hashStringToU32(`${seed}::bio:pronouns`) % 1000;
  if (roll < 100) return 'they';
  if (roll < 550) return 'she';
  return 'he';
}

function getPronouns(mode: PronounMode, seed: string, shortName: string): Pronouns {
  const resolved = mode === 'seeded' ? seededPronounFromSeed(seed) : mode;
  if (resolved === 'name') return { Subj: shortName, subj: shortName, possAdj: `${shortName}'s`, be: 'is', have: 'has' };
  if (resolved === 'he') return { Subj: 'He', subj: 'he', possAdj: 'his', be: 'is', have: 'has' };
  if (resolved === 'she') return { Subj: 'She', subj: 'she', possAdj: 'her', be: 'is', have: 'has' };
  return { Subj: 'They', subj: 'they', possAdj: 'their', be: 'are', have: 'have' };
}

function conjugate(pron: { be: string }, singular: string, plural: string): string {
  return pron.be === 'are' ? plural : singular;
}

// ─────────────────────────────────────────────────────────────
// Trait formatting
// ─────────────────────────────────────────────────────────────

function formatTraitNarration(name: string, band: Band5): string {
  // Use more direct phrasing that varies by trait and band
  switch (name) {
    case 'riskTolerance':
      switch (band) {
        case 'very_low': return 'risk-averse.';
        case 'low': return 'cautious with risk.';
        case 'medium': return 'moderate in risk-taking.';
        case 'high': return 'comfortable with risk.';
        case 'very_high': return 'drawn to high-stakes situations.';
        default: return 'moderate in risk-taking.';
      }
    case 'conscientiousness':
      switch (band) {
        case 'very_low': return 'disorganized by nature.';
        case 'low': return 'loose with structure.';
        case 'medium': return 'moderately organized.';
        case 'high': return 'methodical.';
        case 'very_high': return 'meticulous about order.';
        default: return 'moderately organized.';
      }
    case 'noveltySeeking':
      switch (band) {
        case 'very_low': return 'a creature of habit.';
        case 'low': return 'steady in routines.';
        case 'medium': return 'open to new experiences.';
        case 'high': return 'drawn to novelty.';
        case 'very_high': return 'constantly seeking new experiences.';
        default: return 'open to new experiences.';
      }
    case 'agreeableness':
      switch (band) {
        case 'very_low': return 'blunt and confrontational.';
        case 'low': return 'direct, sometimes abrasive.';
        case 'medium': return 'generally cooperative.';
        case 'high': return 'accommodating.';
        case 'very_high': return 'eager to please.';
        default: return 'generally cooperative.';
      }
    case 'authoritarianism':
      switch (band) {
        case 'very_low': return 'resistant to hierarchy.';
        case 'low': return 'skeptical of authority.';
        case 'medium': return 'pragmatic about hierarchy.';
        case 'high': return 'respectful of hierarchy.';
        case 'very_high': return 'deeply hierarchical in outlook.';
        default: return 'pragmatic about hierarchy.';
      }
    default: return '';
  }
}

// ─────────────────────────────────────────────────────────────
// Narration spec processing
// ─────────────────────────────────────────────────────────────

type NarrationRarity = 'common' | 'uncommon' | 'rare';
type NarrationRuleItem = string | { text: string; w?: number; weight?: number; rarity?: NarrationRarity };
type NarrationSpecV1 = { version: 1; rules: Record<string, NarrationRuleItem[] | string> };

function isNarrationSpecV1(v: unknown): v is NarrationSpecV1 {
  if (!v || typeof v !== 'object') return false;
  const version = (v as { version?: unknown }).version;
  const rules = (v as { rules?: unknown }).rules;
  return version === 1 && !!rules && typeof rules === 'object';
}

function expandNarrationRule(items: NarrationRuleItem[] | string): string[] {
  if (typeof items === 'string') return [items];
  const out: string[] = [];
  const rarityWeight = (r: NarrationRarity | undefined): number => {
    if (r === 'rare') return 1;
    if (r === 'uncommon') return 4;
    return 10;
  };
  for (const it of items) {
    if (typeof it === 'string') { out.push(it); continue; }
    if (!it || typeof it !== 'object') continue;
    const text = String((it as { text?: unknown }).text ?? '').trim();
    if (!text) continue;
    const wRaw = (it as { w?: unknown; weight?: unknown }).w ?? (it as { weight?: unknown }).weight;
    const wNum = typeof wRaw === 'number' && Number.isFinite(wRaw) ? Math.max(0, Math.floor(wRaw)) : 1;
    const mult = wNum * rarityWeight((it as { rarity?: unknown }).rarity as NarrationRarity | undefined);
    const reps = Math.max(1, Math.min(50, mult));
    for (let i = 0; i < reps; i++) out.push(text);
  }
  return out.length ? out : [];
}

let narrationRulesCache: Record<string, string[]> | null = null;
function getNarrationRules(): Record<string, string[]> {
  if (narrationRulesCache) return narrationRulesCache;
  const specUnknown: unknown = narrationSpec;
  if (!isNarrationSpecV1(specUnknown)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(specUnknown.rules)) {
    out[k] = expandNarrationRule(v as NarrationRuleItem[] | string);
  }
  narrationRulesCache = out;
  return out;
}

function normalizeNarrationText(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

// ─────────────────────────────────────────────────────────────
// Role label fixes
// ─────────────────────────────────────────────────────────────

function fixRoleLabel(rawLabel: string): string {
  // Ensure roles read like a person (not a system label).
  const l = rawLabel.toLowerCase();
  if (l === 'logistics') return 'logistics specialist';
  if (l === 'security') return 'security operative';
  if (l === 'media') return 'media operative';
  if (l === 'analyst') return 'analyst';
  if (l === 'technocrat') return 'technocrat';
  if (l === 'diplomat') return 'diplomat';
  if (l === 'operative') return 'operative';
  if (l === 'fixer') return 'fixer';
  if (l === 'enforcer') return 'enforcer';
  if (l === 'courier') return 'courier';
  if (l === 'handler') return 'handler';
  if (l === 'recruiter') return 'recruiter';
  if (l === 'asset') return 'asset';
  if (l === 'cutout') return 'cutout';
  if (l === 'finance') return 'finance specialist';
  if (l === 'intel') return 'intel specialist';
  if (l === 'comms') return 'communications specialist';
  if (l === 'propaganda') return 'propaganda specialist';
  if (l === 'surveillance') return 'surveillance specialist';
  if (l === 'infiltrator') return 'infiltrator';
  if (l === 'saboteur') return 'saboteur';
  return rawLabel;
}

// ─────────────────────────────────────────────────────────────
// Appearance de-duplication
// ─────────────────────────────────────────────────────────────

function extractLeadingAdjective(phrase: string): string | null {
  // Extract leading color/descriptor word from phrases like "gray hair", "gray eyes"
  const words = phrase.trim().toLowerCase().split(/\s+/);
  if (words.length < 2) return null;
  const first = words[0] ?? '';
  // Common descriptors that might repeat
  const adjectives = new Set([
    'gray', 'grey', 'brown', 'black', 'blonde', 'blond', 'red', 'white', 'silver',
    'blue', 'green', 'hazel', 'amber', 'dark', 'light', 'pale', 'deep', 'bright',
  ]);
  return adjectives.has(first) ? first : null;
}

function dedupeAppearance(hair: string, eyes: string, seed: string): { hair: string; eyes: string } {
  const hairAdj = extractLeadingAdjective(hair);
  const eyesAdj = extractLeadingAdjective(eyes);

  // If both have same leading adjective, rephrase one
  if (hairAdj && eyesAdj && hairAdj === eyesAdj) {
    // Use seed to decide which to rephrase
    const rephraseEyes = (hashStringToU32(`${seed}::dedupe:appearance`) % 2) === 0;
    if (rephraseEyes) {
      // Rephrase eyes: "gray eyes" -> "matching eyes" or similar
      const altEyes = [`eyes to match`, `matching eyes`, `similarly colored eyes`];
      const alt = altEyes[hashStringToU32(`${seed}::dedupe:eyes`) % altEyes.length] ?? eyes;
      return { hair, eyes: alt };
    } else {
      // Rephrase hair: "gray hair" -> keep it, rephrase eyes instead (simpler)
      return { hair, eyes: `eyes to match` };
    }
  }
  return { hair, eyes };
}

// ─────────────────────────────────────────────────────────────
// Main narration generator
// ─────────────────────────────────────────────────────────────

export type NarrativeLabels = {
  originLabel: string;
  citizenshipLabel: string;
  currentLabel: string;
};

export type NarrativeResult = {
  para1: string;
  para2: string;
  para3: string;
  html: string;
};

export function generateNarrative(
  agent: GeneratedAgent,
  labels: NarrativeLabels,
  asOfYear: number,
  pronounMode: PronounMode,
): NarrativeResult {
  const seed = agent.seed;
  const shortName = agent.identity.name.split(' ')[0] ?? agent.identity.name;
  const pron = getPronouns(pronounMode, seed, shortName);

  const role = pickVariant(seed, 'bio:role', agent.identity.roleSeedTags.length ? agent.identity.roleSeedTags : ['agent']);
  const roleLabelRaw = toNarrativePhrase(role || 'agent');
  const roleLabel = fixRoleLabel(roleLabelRaw);
  // Convert tier bands to natural phrasing for identity opener
  const tierRaw = agent.identity.tierBand;
  const tier = tierRaw === 'mass' ? 'working-class' : tierRaw === 'middle' ? 'mid-level' : tierRaw;

  const age = Math.max(0, Math.min(120, asOfYear - agent.identity.birthYear));
  const ageClause = Number.isFinite(age) && age > 0 ? ` In ${asOfYear}, ${pron.subj} ${pron.be} ${age}.` : '';

  // Build hair description without redundant "hair" suffix
  const hairColor = toNarrativePhrase(agent.appearance.hair.color);
  const hairTexture = toNarrativePhrase(agent.appearance.hair.texture);
  // If texture already implies hair (e.g., "locs", "curls", "waves"), don't add "hair"
  const textureImpliesHair = /\b(locs|curls|waves|braids|dreads|afro)\b/i.test(hairTexture);
  const hairRaw = textureImpliesHair
    ? `${hairColor} ${hairTexture}`.trim()
    : `${hairColor}, ${hairTexture} hair`.trim();
  const eyesRaw = `${toNarrativePhrase(agent.appearance.eyes.color)} eyes`.trim();

  // De-duplicate if same adjective repeats (e.g., "gray eyes and gray hair")
  const { hair, eyes } = dedupeAppearance(hairRaw, eyesRaw, seed);

  const height = toNarrativePhrase(agent.appearance.heightBand);
  const build = toNarrativePhrase(agent.appearance.buildTag);
  const voiceTag = toNarrativePhrase(agent.appearance.voiceTag);
  const voice = voiceTag === 'storyteller' ? 'storyteller-like' : voiceTag;
  const mark = pickVariant(seed, 'bio:mark', agent.appearance.distinguishingMarks);

  const skillsSorted = Object.entries(agent.capabilities.skills)
    .map(([k, v]) => ({ key: k, value: v.value }))
    .sort((a, b) => (b.value - a.value) || a.key.localeCompare(b.key));
  const topSkillKeys = skillsSorted.slice(0, 2).map(s => toNarrativePhrase(humanizeSkillKey(s.key)));

  const apt = agent.capabilities.aptitudes;
  const aptitudePairs = ([
    ['Strength', apt.strength],
    ['Endurance', apt.endurance],
    ['Dexterity', apt.dexterity],
    ['Reflexes', apt.reflexes],
    ['Hand-eye coordination', apt.handEyeCoordination],
    ['Cognitive speed', apt.cognitiveSpeed],
    ['Attention control', apt.attentionControl],
    ['Working memory', apt.workingMemory],
    ['Risk calibration', apt.riskCalibration],
    ['Charisma', apt.charisma],
    ['Empathy', apt.empathy],
    ['Assertiveness', apt.assertiveness],
    ['Deception', apt.deceptionAptitude],
  ] as const)
    .slice()
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  const topAptitudeNames = aptitudePairs.slice(0, 2).map(([label]) => toNarrativePhrase(label));

  const traits = agent.psych.traits;
  const traitPairs = ([
    ['riskTolerance', traits.riskTolerance],
    ['conscientiousness', traits.conscientiousness],
    ['noveltySeeking', traits.noveltySeeking],
    ['agreeableness', traits.agreeableness],
    ['authoritarianism', traits.authoritarianism],
  ] as const)
    .slice()
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  const topTrait = traitPairs[0];
  const traitClause = topTrait ? formatTraitNarration(topTrait[0], formatBand5(topTrait[1])) : '';

  const comfort = pickKUnique(seed, 'bio:comfort', agent.preferences.food.comfortFoods, 2).map(toNarrativePhrase);
  const genre = pickKUnique(seed, 'bio:genre', agent.preferences.media.genreTopK, 2).map(toNarrativePhrase);
  const style = pickKUnique(seed, 'bio:style', agent.preferences.fashion.styleTags, 1).map(toNarrativePhrase)[0] ?? '';
  const ritual = toNarrativePhrase(agent.preferences.food.ritualDrink);
  const rituals = pickKUnique(seed, 'bio:rituals', agent.routines.recoveryRituals, 2);

  const preview = agent.deepSimPreview;
  const breakBand = toNarrativePhrase(preview.breakRiskBand);
  // Convert break band to natural phrasing for templates
  const breakBandPhrase = (() => {
    switch (preview.breakRiskBand) {
      case 'very_low': return 'remarkably resilient';
      case 'low': return 'steady under pressure';
      case 'medium': return 'vulnerable to burnout';
      case 'high': return 'at risk of breaking';
      case 'very_high': return 'highly fragile';
      default: return 'vulnerable to burnout';
    }
  })();
  const breakTypes = preview.breakTypesTopK.slice(0, 2).map(toNarrativePhrase);

  const vice = agent.vices[0]?.vice ? toNarrativePhrase(agent.vices[0].vice) : '';
  const viceTrigger = agent.vices[0]?.triggers?.[0] ? toNarrativePhrase(agent.vices[0].triggers[0]) : '';

  // Mobility/trajectory
  const originTier = toNarrativePhrase(agent.identity.originTierBand);
  const currentTier = toNarrativePhrase(agent.identity.tierBand);
  const hasMobility = originTier !== currentTier;

  // Ethics
  const loyaltyScope = toNarrativePhrase(agent.psych.ethics.loyaltyScope);
  const topContradiction = agent.psych.contradictions[0];
  const contradictionTrait1 = topContradiction ? toNarrativePhrase(topContradiction.trait1) : '';
  const contradictionTrait2 = topContradiction ? toNarrativePhrase(topContradiction.trait2) : '';

  // Spirituality
  // Convert tradition to readable form
  const rawTradition = agent.spirituality.tradition;
  const spiritualityTradition = rawTradition !== 'none' ? toNarrativePhrase(rawTradition) : '';
  // Fix affiliationTags that are awkward with the templates
  const rawAffiliation = toNarrativePhrase(agent.spirituality.affiliationTag);
  const spiritualityAffiliation = (() => {
    // "practicing religious" + "practice" = redundant; simplify to "religious"
    if (rawAffiliation === 'practicing religious') return 'religious';
    // "devout" is better as observance level, use "faith" for affiliation
    if (rawAffiliation === 'devout') return 'faith';
    // "spiritual not religious" is awkward in templates; simplify
    if (rawAffiliation === 'spiritual not religious') return 'spiritual';
    // "culturally religious" is awkward ("observes culturally religious" / "culturally religious practice")
    // Use "traditional" which works with both templates
    if (rawAffiliation === 'culturally religious') return 'traditional';
    return rawAffiliation;
  })();
  const spiritualityLevel = toNarrativePhrase(agent.spirituality.observanceLevel);
  // Only show spirituality in narration if tradition is specified (not 'none') and observance is meaningful
  const hasSignificantSpirituality = rawTradition !== 'none' && ['moderate', 'observant', 'strict', 'ultra-orthodox'].includes(agent.spirituality.observanceLevel);
  const observeVerb = conjugate(pron, 'observes', 'observe');

  const aTier = aOrAn(tier);
  const ATier = capitalizeFirst(aTier);
  const hailVerb = conjugate(pron, 'hails', 'hail');
  const keepVerb = conjugate(pron, 'keeps', 'keep');
  const recoverVerb = conjugate(pron, 'recovers', 'recover');
  const favorVerb = conjugate(pron, 'favors', 'favor');
  const tendVerb = conjugate(pron, 'tends', 'tend');
  const dressVerb = conjugate(pron, 'dresses', 'dress');
  const enjoyVerb = conjugate(pron, 'enjoys', 'enjoy');

  const recoveryActivities = rituals.map(toRecoveryActivity).filter(Boolean);
  // Use plus-joining if any item contains "and" to avoid triple-and
  const recoveryListText = recoveryActivities.length ? joinTwoWithPlusIfAmbiguous(recoveryActivities) : 'a routine';
  const genres = genre.length ? joinTwoWithPlusIfAmbiguous(genre) : 'mixed media';
  const comfortLine = comfort.length ? joinTwoWithPlusIfAmbiguous(comfort) : 'simple staples';
  const styleLine = style || 'practical';

  const markPhrase = mark ? toNarrativePhrase(mark) : '';
  const markSentence = markPhrase ? `${pron.Subj} ${pron.have} ${withIndefiniteArticle(markPhrase)}.` : '';
  const traitSentence = traitClause ? `${pron.Subj} ${pron.be} ${traitClause}` : '';

  const chronotype = toNarrativePhrase(agent.routines.chronotype);
  const chronotypeArticle = aOrAn(chronotype);

  const roleTagsLower = agent.identity.roleSeedTags.map(t => String(t).trim().toLowerCase());
  const toneDiplomat = roleTagsLower.includes('diplomat');
  const toneOps = roleTagsLower.includes('operative') || roleTagsLower.includes('security');
  const toneMedia = roleTagsLower.includes('media');
  const toneAnalyst = roleTagsLower.includes('analyst') || roleTagsLower.includes('technocrat');

  const opsecHigh = agent.visibility.digitalHygiene >= 700 && agent.visibility.publicVisibility <= 450 && agent.visibility.paperTrail <= 600;
  const publicHigh = agent.visibility.publicVisibility >= 700;
  const mobilityHigh = agent.mobility.travelFrequencyBand === 'high' || agent.mobility.travelFrequencyBand === 'very_high';

  const skillsList = topSkillKeys.length ? oxfordJoin(topSkillKeys) : '';
  const aptitudesList = topAptitudeNames.length ? oxfordJoin(topAptitudeNames) : '';
  const recoveryList = recoveryListText;
  const breakTypesList = (() => {
    if (!breakTypes.length) return '';
    if (breakTypes.length === 1) return breakTypes[0] ?? '';
    const a = breakTypes[0] ?? '';
    const b = breakTypes[1] ?? '';
    const preferOr = (hashStringToU32(`${seed}::bio:breakTypesOr`) % 1000) < 350;
    if (!a || !b) return oxfordJoin([a, b].filter(Boolean));
    if (preferOr) return `${a} or ${b}`;
    return `${a} and ${b}`;
  })();

  const breakTypesClauseText = breakTypesList
    ? breakTypesList.includes(' or ')
      ? `; ${breakTypesList} is a common failure mode`
      : `; ${breakTypesList} are common failure modes`
    : '';

  const locationPhrase = toneDiplomat
    ? pickVariant(seed, 'bio:locPhrase:diplomat', ['posted in', 'stationed in', 'based in'] as const)
    : toneOps
      ? pickVariant(seed, 'bio:locPhrase:ops', ['operating out of', 'based in'] as const)
      : toneMedia
        ? pickVariant(seed, 'bio:locPhrase:media', ['working out of', 'based in'] as const)
        : toneAnalyst
          ? pickVariant(seed, 'bio:locPhrase:analyst', ['working from', 'based in'] as const)
          : 'based in';

  // Optional aside sentence (rare DF-style texture).
  const asideRoll = hashStringToU32(`${seed}::bio:aside`) % 1000;
  const includeAside = asideRoll < 140;
  const asideOptions: string[] = [];
  if (includeAside) {
    if (toneDiplomat) asideOptions.push(`${pron.Subj} ${pron.be} careful with names in public conversation.`);
    if (toneOps && opsecHigh) asideOptions.push(`${pron.Subj} ${pron.have} a habit of checking exits before settling.`);
    if (toneMedia && publicHigh) asideOptions.push(`${pron.Subj} ${pron.be} sensitive to public scrutiny.`);
    if (agent.preferences.media.doomscrollingRisk >= 700) asideOptions.push(`${pron.Subj} ${conjugate(pron, 'tends', 'tend')} to doomscroll when restless.`);
    // New asides for mobility, opsec, public figures
    if (mobilityHigh && !opsecHigh) asideOptions.push(`${pron.Subj} ${pron.have} the look of someone who never fully unpacks.`);
    if (opsecHigh && !toneOps) asideOptions.push(`${pron.Subj} ${pron.have} a careful eye for cameras.`);
    if (publicHigh && !toneMedia) asideOptions.push(`${pron.Subj} ${conjugate(pron, 'moves', 'move')} like someone used to being watched.`);
    if (!asideOptions.length) asideOptions.push(`${pron.Subj} ${pron.be} hard to read at first glance.`);
  }

  const baseRules: Record<string, string[] | string> = {
    name: [agent.identity.name],
    birthYear: [String(agent.identity.birthYear)],
    age: [String(age)],
    ageClause: [ageClause],
    Subj: [pron.Subj],
    subj: [pron.subj],
    be: [pron.be],
    have: [pron.have],
    possAdj: [pron.possAdj],
    PossAdjCap: [capitalizeFirst(pron.possAdj)],
    aTier: [aTier],
    ATier: [ATier],
    tier: [tier],
    role: [roleLabel],
    originLabel: [labels.originLabel],
    homeIso3: [agent.identity.homeCountryIso3],
    currentLabel: [labels.currentLabel],
    currentIso3: [agent.identity.currentCountryIso3],
    locationPhrase: [locationPhrase],
    height: [height],
    build: [build],
    hair: [hair],
    eyes: [eyes],
    voice: [voice],
    markSentence: [markSentence],
    skillsList: [skillsList],
    aptitudesList: [aptitudesList],
    traitSentence: [traitSentence],
    chronotype: [chronotype],
    chronotypeArticle: [chronotypeArticle],
    sleepWindow: [agent.routines.sleepWindow],
    recoveryList: [recoveryList],
    ritualDrink: [ritual],
    genreList: [genres],
    styleTag: [styleLine],
    comfortFoodList: [comfortLine],
    hail: [hailVerb],
    keep: [keepVerb],
    recover: [recoverVerb],
    favor: [favorVerb],
    tend: [tendVerb],
    dress: [dressVerb],
    enjoy: [enjoyVerb],
    breakBand: [breakBand],
    breakBandPhrase: [breakBandPhrase],
    breakTypesList: [breakTypesList],
    breakTypesClause: [breakTypesClauseText],
    viceTag: [vice],
    viceTriggerTag: [viceTrigger],
    // Mobility - fix "mass" tier for natural reading in mobility sentences
    originTier: [originTier === 'mass' ? 'working-class' : originTier],
    currentTier: [currentTier === 'mass' ? 'working-class' : currentTier],
    aCurrentTier: [aOrAn(currentTier === 'mass' ? 'working-class' : currentTier)],
    // Ethics
    loyaltyScope: [loyaltyScope],
    contradictionTrait1: [contradictionTrait1],
    contradictionTrait2: [contradictionTrait2],
    // Spirituality
    spiritualityTradition: [spiritualityTradition || 'faith'],
    spiritualityAffiliation: [spiritualityAffiliation],
    spiritualityLevel: [spiritualityLevel],
    observe: [observeVerb],
    // Institution
    orgType: [(() => {
      const ot = toNarrativePhrase(agent.institution.orgType);
      // Some org types already work without an article in "works ... in X" context
      // academia, defense, military, government, private security, corporate need no article
      if (['academia', 'defense', 'military', 'government', 'private security', 'corporate'].includes(ot)) return ot;
      // Rewrite "state enterprise" as "a state enterprise"
      if (ot === 'state enterprise') return 'a state enterprise';
      // Others need an article: "in an international org", "in a think tank"
      return aOrAn(ot) + ' ' + ot;
    })()],
    gradeBand: [toNarrativePhrase(agent.institution.gradeBand)],
    aGradeBand: [aOrAn(toNarrativePhrase(agent.institution.gradeBand))],
    functionalSpec: [(() => {
      const spec = toNarrativePhrase(agent.institution.functionalSpecialization);
      // Policy specializations need a role suffix
      if (spec.endsWith(' policy')) return spec + ' officer';
      // Technical security roles need "specialist"
      if (spec === 'IT security') return spec + ' specialist';
      if (spec === 'health security') return spec + ' specialist';
      // Intel analysis is awkward - use "intel analyst"
      if (spec === 'intel analysis') return 'intel analyst';
      // Roles that need "officer" suffix
      if (['public diplomacy', 'counterintel', 'protocol', 'sanctions', 'development',
           'communications', 'regional desk', 'legal affairs', 'consular'].includes(spec)) {
        return spec + ' officer';
      }
      // Ops suffixes are fine as-is (security ops, logistics ops, influence ops, etc.)
      if (spec.endsWith(' ops')) return spec;
      // Technical collection is specialized
      if (spec === 'technical collection') return spec + ' specialist';
      // These are standalone role titles that work as-is
      if (['liaison', 'osint', 'general admin', 'targeting'].includes(spec)) {
        return spec;
      }
      // Political/economic officer are already complete
      if (spec.endsWith(' officer')) return spec;
      return spec;
    })()],
    yearsInService: [String(agent.institution.yearsInService)],
    work: [conjugate(pron, 'works', 'work')],
    hold: [conjugate(pron, 'holds', 'hold')],
    // Personality
    conflictStyle: [toNarrativePhrase(agent.personality.conflictStyle)],
    epistemicStyle: [toNarrativePhrase(agent.personality.epistemicStyle)],
    socialEnergy: [toNarrativePhrase(agent.personality.socialEnergy)],
    riskPosture: [(() => {
      const rp = agent.personality.riskPosture;
      // Keep hyphen for compound adjective
      if (rp === 'context-dependent') return 'context-dependent';
      return toNarrativePhrase(rp);
    })()],
    lean: [conjugate(pron, 'leans', 'lean')],
    // Work style
    writingStyle: [toNarrativePhrase(agent.workStyle.writingStyle)],
    briefingStyle: [(() => {
      const bs = toNarrativePhrase(agent.workStyle.briefingStyle);
      // Convert plural noun forms to singular adjective forms for "X briefings" template
      if (bs === 'memos') return 'memo-style';
      if (bs === 'slides') return 'slide-based';
      return bs;
    })()],
    // Convert calibration jargon to natural phrasing for "She is X in assessments"
    confidenceCalibration: [(() => {
      const cal = agent.workStyle.confidenceCalibration;
      // Convert to natural-sounding adjectives
      if (cal === 'well-calibrated') return 'reliably accurate';
      if (cal === 'overconfident') return 'often overconfident';
      if (cal === 'underconfident') return 'often overly cautious';
      if (cal === 'variable') return 'inconsistent';
      return toNarrativePhrase(cal);
    })()],
    prefer: [conjugate(pron, 'prefers', 'prefer')],
    // Geography
    urbanicity: [toNarrativePhrase(agent.geography.urbanicity)],
    aUrbanicity: [aOrAn(toNarrativePhrase(agent.geography.urbanicity))],
    diasporaStatus: [(() => {
      const ds = agent.geography.diasporaStatus;
      // Convert to phrases that work with "#Subj# #be# #diasporaStatus#"
      if (ds === 'native') return 'a native';
      if (ds === 'internal-migrant') return 'an internal migrant';
      if (ds === 'expat') return 'an expat';
      if (ds === 'refugee') return 'a refugee';
      if (ds === 'dual-citizen') return 'a dual citizen';
      if (ds === 'borderland') return 'from the borderlands';
      if (ds === 'diaspora-child') return 'diaspora-born';
      return toNarrativePhrase(ds);
    })()],
    // Family
    maritalStatus: [(() => {
      const ms = agent.family.maritalStatus;
      // "its-complicated" doesn't work with "#Subj# #be# #maritalStatus#" template
      // "She is it's complicated" is wrong - need "For her, it's complicated"
      if (ms === 'its-complicated') return 'in a complicated situation';
      return toNarrativePhrase(ms);
    })()],
    dependentsClause: [agent.family.dependentCount > 0 ? ` with ${agent.family.dependentCount} dependent${agent.family.dependentCount > 1 ? 's' : ''}` : ''],
    // Culture axes
    ethnolinguistic: [(() => {
      const eth = toNarrativePhrase(agent.culture.ethnolinguistic);
      // Avoid "mixed heritage heritage" redundancy
      if (eth.endsWith(' heritage')) return eth.replace(/ heritage$/, '');
      return eth;
    })()],
    regionalUpbringing: [toNarrativePhrase(agent.culture.regional)],
    aRegionalUpbringing: [aOrAn(toNarrativePhrase(agent.culture.regional))],
    institutionalCulture: [toNarrativePhrase(agent.culture.institutional)],
    draw: [conjugate(pron, 'draws', 'draw')],
    carry: [conjugate(pron, 'carries', 'carry')],
    // New facets
    primaryGoal: [(() => {
      const goal = agent.motivations.primaryGoal;
      // Make goal phrases read naturally: "driven by X"
      const goalPhrases: Record<string, string> = {
        career: 'career advancement',
        financial: 'financial security',
        relational: 'close relationships',
        creative: 'creative expression',
        legacy: 'leaving a legacy',
        security: 'personal security',
        freedom: 'personal freedom',
        mastery: 'mastery of craft',
        recognition: 'recognition',
        service: 'service to others',
      };
      return goalPhrases[goal] ?? toNarrativePhrase(goal);
    })()],
    topFear: [agent.motivations.fears[0] ? toNarrativePhrase(agent.motivations.fears[0]) : ''],
    fear: [conjugate(pron, 'fears', 'fear')],
    attachmentDesc: [(() => {
      const style = agent.attachmentStyle;
      // Convert hyphenated attachment styles to readable phrases
      if (style === 'anxious-preoccupied') return 'anxiously attached';
      if (style === 'dismissive-avoidant') return 'emotionally distant';
      if (style === 'fearful-avoidant') return 'wary of closeness';
      if (style === 'secure') return 'securely attached';
      return toNarrativePhrase(style).replace(/-/g, ' ');
    })()],
    debtLevel: [(() => {
      const dl = agent.economics.debtLevel;
      // "none" debt sounds unnatural, change to "no"
      if (dl === 'none') return 'no';
      return toNarrativePhrase(dl);
    })()],
    incomeStability: [toNarrativePhrase(agent.economics.incomeStability)],
    spendingStyle: [toNarrativePhrase(agent.economics.spendingStyle)],
    financialState: [(() => {
      // Financial state should be consistent with income stability
      // The template is: "X income keeps things Y" - ensure X and Y are coherent
      const stability = agent.economics.incomeStability.toLowerCase();
      const anxiety = agent.economics.financialAnxiety01k;

      // Guaranteed/independent income (very stable)
      if (['guaranteed', 'independent'].includes(stability)) {
        return anxiety > 700 ? 'comfortable' : 'secure';
      }
      // Stable income
      if (stability === 'stable') {
        return anxiety > 600 ? 'manageable' : 'stable';
      }
      // Variable income - middle ground
      if (stability === 'variable') {
        return anxiety > 600 ? 'unpredictable' : anxiety > 300 ? 'manageable' : 'workable';
      }
      // Unstable income
      if (stability === 'unstable') {
        return anxiety > 500 ? 'precarious' : 'uncertain';
      }
      // Default fallback
      return anxiety > 600 ? 'strained' : anxiety > 300 ? 'manageable' : 'stable';
    })()],
    secretCount: [agent.secrets.length === 0 ? 'no notable secrets' : agent.secrets.length === 1 ? 'a significant secret' : `${agent.secrets.length} significant secrets`],
    humorStyle: [toNarrativePhrase(agent.humorStyle)],
    pressureResponse: [(() => {
      const pr = agent.pressureResponse;
      // Conjugate verbs for they/them pronouns
      if (pr === 'freezes') return `${conjugate(pron, 'tends', 'tend')} to freeze`;
      if (pr === 'deliberates') return `${conjugate(pron, 'deliberates', 'deliberate')} carefully`;
      if (pr === 'delegates') return `${conjugate(pron, 'delegates', 'delegate')} quickly`;
      if (pr === 'rushes') return `${conjugate(pron, 'rushes', 'rush')} into action`;
      if (pr === 'thrives') return conjugate(pron, 'thrives', 'thrive');
      if (pr === 'avoids') return `${conjugate(pron, 'avoids', 'avoid')} decisions`;
      return toNarrativePhrase(pr);
    })()],
    gaitDesc: [toNarrativePhrase(agent.physicalPresence.gait)],
    eyeContactDesc: [toNarrativePhrase(agent.physicalPresence.eyeContact)],
    move: [conjugate(pron, 'moves', 'move')],
    maintain: [conjugate(pron, 'maintains', 'maintain')],
    lyingDesc: [agent.deceptionSkill.lyingAbility > 700 ? 'skilled' : agent.deceptionSkill.lyingAbility > 400 ? 'capable' : 'poor'],
    detectsLiesClause: [agent.deceptionSkill.detectsLies > 600 ? ` and ${conjugate(pron, 'reads', 'read')} others well` : ''],
    // Additional conjugated verbs for templates
    show: [conjugate(pron, 'shows', 'show')],
    excel: ['excel'], // Infinitive form for "tends to excel" - NOT conjugated
    rely: [conjugate(pron, 'relies', 'rely')],
    // Years of service - handle singular vs plural
    yearsWord: [agent.institution.yearsInService === 1 ? 'year' : 'years'],
    // Health conditions
    healthCondition: [(() => {
      const conditions = agent.health.chronicConditionTags;
      if (!conditions.length) return '';
      const top = conditions.slice(0, 2).map(toNarrativePhrase);
      return oxfordJoin(top);
    })()],
    // Use "is" for single condition, "are" for multiple (e.g., "Asthma and depression are")
    healthConditionBe: [agent.health.chronicConditionTags.length > 1 ? 'are' : 'is'],
    manage: [conjugate(pron, 'manages', 'manage')],
    // Neurodivergence - filter out "neurotypical" since we don't narrate that
    // All phrases must work with "#Subj# #be# X" pattern (i.e., adjective/adjectival phrases)
    neurodivergentDesc: [(() => {
      const tags = agent.neurodivergence.indicatorTags.filter(t =>
        t.toLowerCase() !== 'neurotypical'
      );
      if (!tags.length) return '';
      const phrases = tags.slice(0, 2).map(t => {
        const p = toNarrativePhrase(t);
        // Convert to adjectives that work with "She is X"
        if (p === 'adhd traits') return 'ADHD';
        if (p === 'asd traits') return 'autistic';
        if (p === 'dyslexia traits') return 'dyslexic';
        if (p === 'dyscalculia traits') return 'dyscalculic';
        if (p === 'anxiety processing') return 'anxiety-prone';
        if (p === 'hyperfocus prone') return 'hyperfocus-prone';
        if (p === 'pattern recognition strength') return 'a pattern-recognition thinker';
        if (p === 'executive function variance') return 'executive-function divergent';
        if (p === 'sensory processing') return 'sensory-sensitive';
        if (p === 'sensory sensitivity') return 'sensory-sensitive';
        if (p === 'time blindness') return 'time-blind';
        // Generic fallback: if it ends with "traits", convert to adjectival
        if (p.endsWith(' traits')) return p.replace(/ traits$/, '-adjacent');
        return p;
      });
      return oxfordJoin(phrases);
    })()],
    copingStrategy: [(() => {
      const strats = agent.neurodivergence.copingStrategies;
      if (!strats.length) return '';
      return toNarrativePhrase(strats[0] ?? '');
    })()],
    cope: [conjugate(pron, 'copes', 'cope')],
    // Languages - convert ISO 639 codes to readable names
    languagesList: [(() => {
      const langs = agent.identity.languages;
      if (langs.length <= 1) return ''; // Don't narrate if only one language
      const displayLangs = langs.slice(0, 3).map(l => languageCodeToName(l));
      return oxfordJoin(displayLangs);
    })()],
    speak: [conjugate(pron, 'speaks', 'speak')],
    // Network role
    networkRole: [toNarrativePhrase(agent.network.role)],
    aNetworkRole: [aOrAn(toNarrativePhrase(agent.network.role))],
    leverageType: [toNarrativePhrase(agent.network.leverageType)],
    function: [conjugate(pron, 'functions', 'function')],
    // Adversity/Background - convert tags to natural phrases
    adversityDesc: [(() => {
      const tags = agent.background.adversityTags;
      if (!tags.length) return '';
      const tag = (tags[0] ?? '').toLowerCase();
      // "stable-upbringing" is not adversity - don't narrate it as survival
      if (tag === 'stable-upbringing') return '';
      // Convert tags to phrases that work with "survived X" and "X shaped their resilience"
      const adversityPhrases: Record<string, string> = {
        'economic-hardship-history': 'economic hardship',
        'displacement-survivor': 'displacement',
        'conflict-exposure': 'conflict',
        'family-instability': 'family instability',
        'institutional-upbringing': 'an institutional upbringing',
        'loss-of-parent': 'the loss of a parent',
        'medical-trauma-history': 'medical trauma',
        'refugee-background': 'life as a refugee',
        'persecution-survivor': 'persecution',
      };
      return adversityPhrases[tag] ?? toNarrativePhrase(tag);
    })()],
    // Red lines
    redLineDesc: [(() => {
      const lines = agent.identity.redLines;
      if (!lines.length) return '';
      return toNarrativePhrase(lines[0] ?? '');
    })()],
    obj: [pron.be === 'are' ? 'them' : (pron.subj === 'he' ? 'him' : 'her')],
    // Orientation - with pronoun-coherence check
    orientationDesc: [(() => {
      const tag = agent.orientation.orientationTag;
      // Don't narrate straight/undisclosed as those are normative/uninformative
      if (['straight', 'undisclosed'].includes(tag)) return '';
      // Check for pronoun-orientation coherence
      // "lesbian" only makes sense with she/her or they/them
      if (tag === 'lesbian' && pron.subj === 'he') return 'queer';
      // "gay" traditionally male but acceptable for any gender now
      return toNarrativePhrase(tag);
    })()],
    identify: [conjugate(pron, 'identifies', 'identify')],
    // ─────────────────────────────────────────────────────────────
    // Oracle facets - new in domestic/social/psychology
    // ─────────────────────────────────────────────────────────────
    // Affect
    affectBaseline: [toNarrativePhrase(agent.affect?.baseline ?? '')],
    affectRegulation: [(() => {
      const style = agent.affect?.regulationStyle ?? '';
      const phrases: Record<string, string> = {
        ruminates: 'ruminates',
        suppresses: 'suppresses',
        externalizes: 'externalizes',
        reframes: 'reframes',
        compartmentalizes: 'compartmentalizes',
        avoids: 'avoids the issue',
        'seeks-support': 'seeks support',
      };
      return phrases[style] ?? toNarrativePhrase(style);
    })()],
    // Self-concept
    selfStory: [(() => {
      const story = agent.selfConcept?.selfStory ?? '';
      const phrases: Record<string, string> = {
        'self-made': 'self-made',
        wronged: 'wronged',
        caretaker: 'a caretaker',
        chosen: 'chosen',
        survivor: 'a survivor',
        reformer: 'a reformer',
        outsider: 'an outsider',
        loyalist: 'a loyalist',
        pragmatist: 'a pragmatist',
        idealist: 'an idealist',
      };
      return phrases[story] ?? toNarrativePhrase(story);
    })()],
    socialMask: [(() => {
      const mask = agent.selfConcept?.socialMask ?? '';
      const phrases: Record<string, string> = {
        bureaucrat: 'the bureaucrat',
        charmer: 'the charmer',
        patriot: 'the patriot',
        cynic: 'the cynic',
        'true-believer': 'the true believer',
        everyman: 'the everyman',
        intellectual: 'the intellectual',
        'tough-guy': 'the tough guy',
        helper: 'the helper',
        rebel: 'the rebel',
      };
      return phrases[mask] ?? toNarrativePhrase(mask);
    })()],
    see: [conjugate(pron, 'sees', 'see')],
    present: [conjugate(pron, 'presents', 'present')],
    // Communities - add article for role nouns
    communityStatus: [(() => {
      const status = agent.communities?.communityStatus ?? '';
      // These need "a/an" prefix for natural phrasing: "is a pillar", "is a regular"
      const needsArticle = ['pillar', 'regular', 'newcomer', 'outsider'];
      if (needsArticle.includes(status)) {
        return aOrAn(status) + ' ' + toNarrativePhrase(status);
      }
      // These work as adjectives: "is respected", "is controversial", "is banned"
      return toNarrativePhrase(status);
    })()],
    communityType: [(() => {
      const m = agent.communities?.memberships?.[0];
      return m ? toNarrativePhrase(m.type) : '';
    })()],
    communityRole: [(() => {
      const m = agent.communities?.memberships?.[0];
      return m ? toNarrativePhrase(m.role) : '';
    })()],
    // Reputation
    professionalRep: [toNarrativePhrase(agent.reputation?.professional ?? '')],
    neighborhoodRep: [toNarrativePhrase(agent.reputation?.neighborhood ?? '')],
    // Civic life
    civicEngagement: [toNarrativePhrase(agent.civicLife?.engagement ?? '')],
    civicEngagementPhrase: [(() => {
      const eng = agent.civicLife?.engagement ?? '';
      // Convert engagement level to natural phrasing
      switch (eng) {
        case 'disengaged': return 'disengaged';
        case 'quiet-voter': return 'a quiet voter';
        case 'active-participant': return 'an active participant';
        case 'organizer': return 'an organizer';
        case 'candidate': return 'a political candidate';
        case 'disillusioned': return 'disillusioned with politics';
        default: return toNarrativePhrase(eng);
      }
    })()],
    civicIdeology: [toNarrativePhrase(agent.civicLife?.ideology ?? '')],
    // Everyday life
    commuteMode: [toNarrativePhrase(agent.everydayLife?.commuteMode ?? '')],
    thirdPlace: [(() => {
      const places = agent.everydayLife?.thirdPlaces ?? [];
      if (!places.length) return '';
      const place = toNarrativePhrase(places[0] ?? '');
      // Places that need "the" prefix for "spends time at X" context
      const needsThe = ['gym', 'library', 'park', 'mosque', 'church', 'temple', 'synagogue',
                        'market', 'barber shop', 'salon', 'pool', 'community center'];
      // Places that need "a" prefix
      const needsA = ['cafe', 'bar', 'restaurant'];
      if (needsThe.includes(place)) return 'the ' + place;
      if (needsA.includes(place)) return 'a ' + place;
      return place;
    })()],
    commute: [conjugate(pron, 'commutes', 'commute')],
    spend: [conjugate(pron, 'spends', 'spend')],
    // Home
    neighborhoodType: [toNarrativePhrase(agent.home?.neighborhoodType ?? '')],
    aNeighborhoodType: [aOrAn(toNarrativePhrase(agent.home?.neighborhoodType ?? ''))],
    householdComposition: [toNarrativePhrase(agent.home?.householdComposition ?? '')],
    housingStability: [toNarrativePhrase(agent.home?.housingStability ?? '')],
    live: [conjugate(pron, 'lives', 'live')],
    // Household composition - add "with" for non-alone compositions
    householdCompositionPhrase: [(() => {
      const comp = agent.home?.householdComposition ?? '';
      if (!comp || comp === 'alone') return 'alone';
      return 'with ' + toNarrativePhrase(comp);
    })()],
    // Life skills - convert competence bands to adjective phrases that work with "is"
    streetSmarts: [(() => {
      const band = agent.lifeSkills?.streetSmarts ?? '';
      switch (band) {
        case 'incompetent': return 'hopeless';
        case 'struggles': return 'out of their depth';
        case 'adequate': return 'adequate';
        case 'competent': return 'streetwise';
        case 'expert': return 'street-savvy';
        default: return toNarrativePhrase(band);
      }
    })()],
    domesticCompetence: [(() => {
      const band = agent.lifeSkills?.domesticCompetence ?? '';
      switch (band) {
        case 'incompetent': return 'hopeless';
        case 'struggles': return 'poor';
        case 'adequate': return 'passable';
        case 'competent': return 'solid';
        case 'expert': return 'excellent';
        default: return toNarrativePhrase(band);
      }
    })()],
    etiquetteLiteracy: [toNarrativePhrase(agent.lifeSkills?.etiquetteLiteracy ?? '')],
  };

  const textRules = (() => {
    const base = getNarrationRules();
    const copy: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(base)) copy[k] = v.slice();
    return copy;
  })();

  // Hard guards for missing fields to avoid dangling clauses.
  if (!vice) textRules.bioP2Vice = [''];
  if (!viceTrigger) textRules.viceTriggerClause = [''];
  if (!breakTypesList) textRules.breakTypesClause = [''];

  // Only include mobility if there's a difference between origin and current tier
  if (!hasMobility) textRules.bioP2Mobility = [''];

  // Only include contradiction if one exists
  if (!topContradiction) textRules.bioP2Contradiction = [''];

  // Only include spirituality for meaningful observance levels
  if (!hasSignificantSpirituality) textRules.bioP2Spirituality = [''];

  // Guards for new facets - only show when interesting
  if (agent.humorStyle === 'none') textRules.bioP2Humor = [''];
  if (agent.secrets.length === 0) textRules.bioP2Secrets = [''];
  if (!agent.motivations.fears[0]) textRules.bioP2Motivation = [''];

  // Guards for newly added facets
  if (!agent.health.chronicConditionTags.length) textRules.bioP2Health = [''];
  // Filter out "neurotypical" - only narrate actual neurodivergence
  const hasMeaningfulNeurodivergence = agent.neurodivergence.indicatorTags.some(t =>
    t.toLowerCase() !== 'neurotypical'
  );
  if (!hasMeaningfulNeurodivergence) textRules.bioP2Neurodivergence = [''];
  if (agent.identity.languages.length <= 1) textRules.bioP2Languages = [''];
  // Network role - only show non-trivial roles
  if (['isolate', 'peripheral'].includes(agent.network.role)) textRules.bioP2Network = [''];
  if (!agent.background.adversityTags.length) textRules.bioP2Adversity = [''];
  if (!agent.identity.redLines.length) textRules.bioP2RedLines = [''];
  // Don't narrate straight/undisclosed orientation
  if (['straight', 'undisclosed'].includes(agent.orientation.orientationTag)) textRules.bioP2Orientation = [''];

  // Guards for oracle facets - only show when present and interesting
  if (!agent.affect?.baseline) textRules.bioP2Affect = [''];
  if (!agent.selfConcept?.selfStory) textRules.bioP2SelfConcept = [''];
  if (!agent.communities?.memberships?.length) textRules.bioP2Communities = [''];
  if (!agent.reputation?.professional) textRules.bioP2Reputation = [''];
  if (!agent.civicLife?.engagement || agent.civicLife.engagement === 'disengaged') textRules.bioP2CivicLife = [''];
  if (!agent.everydayLife?.commuteMode) textRules.bioP2EverydayLife = [''];
  if (!agent.home?.neighborhoodType) textRules.bioP2Home = [''];
  if (!agent.lifeSkills?.streetSmarts) textRules.bioP2LifeSkills = [''];

  if (toneDiplomat) {
    textRules.bioP1Identity = [
      ...(textRules.bioP1Identity ?? []),
      '#name# was born in #birthYear#.#ageClause# #Subj# #be# #aTier# #tier#-tier #role# from #originLabel# (#homeIso3#), later #locationPhrase# #currentLabel# (#currentIso3#).',
    ];
  }
  if (toneOps) {
    textRules.bioP1Identity = [
      ...(textRules.bioP1Identity ?? []),
      '#name# was born in #birthYear#.#ageClause# From #originLabel# (#homeIso3#), #subj# #have# since taken up work in #currentLabel# (#currentIso3#) as #aTier# #tier#-tier #role#.',
    ];
  }
  if (includeAside) textRules.bioP1Aside = asideOptions.length ? asideOptions : [''];
  if (toneOps && opsecHigh) {
    textRules.bioP2Strain = [
      ...(textRules.bioP2Strain ?? []),
      'Under strain, break risk runs #breakBand##breakTypesClause#. Exposure remains a frequent risk.',
    ];
  }

  const rules: Record<string, string[] | string> = { ...textRules, ...baseRules };

  const rng = makeXorshiftRng(`${seed}::bio:narration:v3::${pronounMode}`);
  return withTraceryRng(rng, () => {
    const grammar = tracery.createGrammar(rules);
    grammar.addModifiers({
      ...tracery.baseEngModifiers,
      lower: (s: string) => s.toLowerCase(),
      trim: (s: string) => s.trim(),
      capFirst: (s: string) => capitalizeFirst(s),
      oxford: (s: string) => oxfordJoin(s.split(',').map(x => x.trim()).filter(Boolean)),
    });

    // Para 1: Identity & Appearance (who they are, what they look like)
    const para1 = normalizeNarrationText(grammar.flatten('#bioP1Identity# #bioP1Appearance# #bioP1VoiceMark# #bioP1CompetenceLead# #bioP1CompetenceSupport# #bioP1Trait# #bioP1Aside#'));

    // Para 2: Daily life & Preferences (routines, tastes, work style, health, languages, domestic)
    const para2 = normalizeNarrationText(grammar.flatten('#bioP2Routine# #bioP2Taste# #bioP2Institution# #bioP2WorkStyle# #bioP2Languages# #bioP2Geography# #bioP2Family# #bioP2Health# #bioP2Neurodivergence# #bioP2EverydayLife# #bioP2Home# #bioP2LifeSkills# #bioP2Communities#'));

    // Para 3: Psychology & Inner life (motivations, relationships, vulnerabilities, network, reputation)
    const para3 = normalizeNarrationText(grammar.flatten('#bioP2Motivation# #bioP2Attachment# #bioP2Orientation# #bioP2Pressure# #bioP2Strain# #bioP2Vice# #bioP2Ethics# #bioP2Spirituality# #bioP2Contradiction# #bioP2Economics# #bioP2Secrets# #bioP2Humor# #bioP2Presence# #bioP2Deception# #bioP2Mobility# #bioP2Personality# #bioP2Culture# #bioP2Network# #bioP2Adversity# #bioP2RedLines# #bioP2Affect# #bioP2SelfConcept# #bioP2Reputation# #bioP2CivicLife#'));

    const html = `
      <div class="agent-narrative">
        <p>${escapeHtml(para1)}</p>
        <p>${escapeHtml(para2)}</p>
        <p>${escapeHtml(para3)}</p>
      </div>
    `;

    return { para1, para2, para3, html };
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
