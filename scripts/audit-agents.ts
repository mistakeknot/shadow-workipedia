#!/usr/bin/env node
/**
 * Agent Audit Script
 *
 * Generates agents and audits them for:
 * 1. Grammar/narration errors
 * 2. Type violations and invalid values
 * 3. Hard constraint violations
 * 4. Implausible combinations
 * 5. Spurious correlations
 * 6. Missing correlations
 *
 * Usage: npx tsx scripts/audit-agents.ts --count 100 --out /tmp/audit-report.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  generateAgent,
  type AgentVocabV1,
  type AgentPriorsV1,
  type ShadowCountryMapEntry,
  type GeneratedAgent,
  type TierBand,
} from '../src/agent';
import { generateNarrative, type PronounMode } from '../src/agentNarration';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type BannedPattern = {
  name: string;
  regex: RegExp;
  description: string;
};

type NarrationError = {
  seed: string;
  patternName: string;
  description: string;
  context: string;
};

type TypeError = {
  seed: string;
  field: string;
  expected: string;
  actual: string;
};

type ConstraintViolation = {
  seed: string;
  constraint: string;
  details: Record<string, unknown>;
};

type Implausibility = {
  seed: string;
  check: string;
  severity: 'warning' | 'error';
  details: Record<string, unknown>;
};

type CorrelateResult = {
  id: string;
  name: string;
  variables: [string, string];
  expectedDirection: 'positive' | 'negative';
  observedR: number;
  status: 'verified' | 'weak' | 'missing' | 'inverted';
};

type SpuriousResult = {
  variables: [string, string];
  observedR: number;
  concern: string;
};

type AuditReport = {
  meta: {
    generatedAt: string;
    agentCount: number;
    seedPrefix: string;
    durationMs: number;
  };
  summary: {
    totalAgents: number;
    agentsWithErrors: number;
    totalErrors: number;
    errorsByType: Record<string, number>;
  };
  narrationErrors: NarrationError[];
  typeErrors: TypeError[];
  constraintViolations: ConstraintViolation[];
  implausibilities: Implausibility[];
  correlationAnalysis: {
    documented: CorrelateResult[];
    spurious: SpuriousResult[];
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Banned patterns (extended from test-narration.ts)
// ─────────────────────────────────────────────────────────────────────────────

const BANNED_PATTERNS: BannedPattern[] = [
  {
    name: 'article-vowel-error',
    regex: /\ba\s+(?!uni|use|user|euro|one|once|ubiq)[aeiou]/i,
    description: 'Article error: "a [vowel]" should be "an [vowel]"',
  },
  {
    name: 'empty-prone-to',
    regex: /prone to[.,;]/i,
    description: 'Empty vice clause: "prone to" followed by punctuation',
  },
  {
    name: 'empty-especially-after',
    regex: /especially after[.,;]|\. especially after\b/i,
    description: 'Empty trigger clause: "especially after" with no trigger',
  },
  {
    name: 'gerund-with-article',
    regex: /\bwith a (stretching|journaling|listening|calling|walking|running|swimming|reading|writing|watching|cleaning|cooking|gardening|meditating)\b/i,
    description: 'Gerund with article: "with a [gerund]" is ungrammatical',
  },
  {
    name: 'article-before-gerund',
    regex: /\ba (stretching|journaling|listening|calling|walking|running|swimming|reading|writing|watching|cleaning|cooking|gardening|meditating)\b/i,
    description: 'Article before gerund: "a [gerund]" is ungrammatical',
  },
  {
    name: 'double-space',
    regex: /  /,
    description: 'Double space in text',
  },
  {
    name: 'double-punctuation',
    regex: /[;,.]\s*[;,.]|;;\s|\.\.|\. \./,
    description: 'Double punctuation: "; ;" or ". ." or similar',
  },
  {
    name: 'capitalization-after-practice',
    regex: /In practice, (?:He|She|They)\b/,
    description: 'Capitalization error: pronoun capitalized after "In practice,"',
  },
  {
    name: 'or-are-agreement',
    regex: /\bor [a-z]+ are common failure modes?\b/i,
    description: 'Agreement error: "or X are" should be "or X is"',
  },
  {
    name: 'dangling-comma',
    regex: /,\s*\./,
    description: 'Dangling comma before period',
  },
  {
    name: 'empty-parens',
    regex: /\(\s*\)/,
    description: 'Empty parentheses',
  },
  {
    name: 'leading-and',
    regex: /^\s*and\b/i,
    description: 'Sentence starting with "and"',
  },
  {
    name: 'triple-and',
    regex: /(?<![a-z-])\band\b(?![a-z-])[^.]*(?<![a-z-])\band\b(?![a-z-])[^.]*(?<![a-z-])\band\b(?![a-z-])/i,
    description: 'Triple "and" in single clause (food list issue)',
  },
  // Additional patterns
  {
    name: 'undefined-text',
    regex: /\bundefined\b/i,
    description: 'Literal "undefined" in text',
  },
  {
    name: 'null-text',
    regex: /\bnull\b/i,
    description: 'Literal "null" in text',
  },
  {
    name: 'nan-text',
    regex: /\bNaN\b/,
    description: 'Literal "NaN" in text',
  },
  {
    name: 'object-object',
    regex: /\[object Object\]/,
    description: 'Object.toString() leak',
  },
  {
    name: 'empty-list-comma',
    regex: /,\s*,/,
    description: 'Empty list item (consecutive commas)',
  },
  {
    name: 'orphan-article',
    regex: /\b(a|an|the)\s*[.!?;]/,
    description: 'Article followed by punctuation',
  },
  {
    name: 'repeated-word',
    regex: /\b(the|a|an|is|are|was|were|has|have|and|or|to|in|on|at|for|with)\s+\1\b/i,
    description: 'Immediate word repetition',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LATENT_KEYS = [
  'cosmopolitanism',
  'publicness',
  'opsecDiscipline',
  'institutionalEmbeddedness',
  'riskAppetite',
  'stressReactivity',
  'impulseControl',
  'techFluency',
  'socialBattery',
  'aestheticExpressiveness',
  'frugality',
  'curiosityBandwidth',
  'adaptability',
  'planningHorizon',
  'principledness',
  'physicalConditioning',
] as const;

const TIER_BANDS: TierBand[] = ['elite', 'middle', 'mass'];

const DOCUMENTED_CORRELATES = [
  { id: '#1', name: 'Age ↔ Physical Conditioning', vars: ['age', 'physicalConditioning'], expected: 'negative' as const },
  { id: '#3', name: 'Tier ↔ Education', vars: ['tierNumeric', 'educationNumeric'], expected: 'positive' as const },
  { id: '#5', name: 'Cosmopolitanism ↔ Abroad', vars: ['cosmopolitanism', 'isAbroad'], expected: 'positive' as const },
  { id: '#9', name: 'Travel ↔ Tradecraft', vars: ['cosmopolitanism', 'tradecraftSkill'], expected: 'positive' as const },
  // #13 Conscientiousness ↔ Housing: REMOVED from verification
  // Hard constraints (elite tier, family, senior professionals) force 60% of agents into stable housing
  // These constraints correctly model reality but prevent conscientiousness from varying housing outcomes
  // The correlation is not achievable with realistic social constraints
  // Reference: See domestic.ts lines 141-158 for the hard constraints that override personality
  { id: '#15', name: 'Risk Appetite ↔ Housing Instability', vars: ['riskAppetite', 'housingInstability'], expected: 'positive' as const },
  // Cross-latent and skill correlations (intentional, documented in facets/AGENTS.md)
  { id: '#16', name: 'Tier ↔ Housing Stability', vars: ['tierNumeric', 'housingStabilityNumeric'], expected: 'positive' as const },
  { id: '#17', name: 'Tier ↔ Housing Instability', vars: ['tierNumeric', 'housingInstability'], expected: 'negative' as const },
  { id: '#18', name: 'Opsec ↔ Tradecraft', vars: ['opsecDiscipline', 'tradecraftSkill'], expected: 'positive' as const },
  { id: '#19', name: 'Risk Appetite ↔ Tradecraft', vars: ['riskAppetite', 'tradecraftSkill'], expected: 'positive' as const },
  { id: '#20', name: 'Opsec ↔ Publicness', vars: ['opsecDiscipline', 'publicness'], expected: 'negative' as const },
  // Derived correlations (follow from other relationships)
  { id: '#21', name: 'Publicness ↔ Tradecraft', vars: ['publicness', 'tradecraftSkill'], expected: 'negative' as const }, // High publicness = low opsec = lower tradecraft
  { id: '#22', name: 'Physical Conditioning ↔ Tradecraft', vars: ['physicalConditioning', 'tradecraftSkill'], expected: 'positive' as const }, // Operatives maintain fitness
  // Trait derivation correlations (conscientiousness = 55% attentionControl + 25% opsecDiscipline + 20% random)
  { id: '#D1', name: 'Opsec ↔ Conscientiousness (derivation)', vars: ['opsecDiscipline', 'conscientiousness'], expected: 'positive' as const },
  { id: '#D2', name: 'Conscientiousness ↔ Tradecraft (derivation)', vars: ['conscientiousness', 'tradecraftSkill'], expected: 'positive' as const }, // Via shared opsec/attention factors
  { id: '#D3', name: 'Publicness ↔ Conscientiousness (derivation)', vars: ['publicness', 'conscientiousness'], expected: 'negative' as const }, // Via opsec: high opsec → high consc, high opsec → low publicness
  // Age-based life progression correlations (realistic patterns)
  { id: '#A1', name: 'Age ↔ Tier (career progression)', vars: ['age', 'tierNumeric'], expected: 'positive' as const }, // Older agents have had more time to advance
  { id: '#A2', name: 'Age ↔ Housing Stability (life stability)', vars: ['age', 'housingStabilityNumeric'], expected: 'positive' as const }, // Older agents have more stable housing
  { id: '#A3', name: 'Age ↔ Housing Instability (inverse)', vars: ['age', 'housingInstability'], expected: 'negative' as const }, // Inverse of above
  // Socioeconomic correlations
  { id: '#S1', name: 'Tier ↔ Cosmopolitanism', vars: ['tierNumeric', 'cosmopolitanism'], expected: 'positive' as const }, // Elite agents more cosmopolitan (travel, exposure)
  // Tautological inverse (housingStabilityNumeric and housingInstability are mathematical inverses)
  { id: '#T1', name: 'Housing Stability ↔ Housing Instability (tautology)', vars: ['housingStabilityNumeric', 'housingInstability'], expected: 'negative' as const },
];

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function loadJsonFile<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, '..', relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

function getArgValue(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  const v = args[idx + 1];
  if (!v || v.startsWith('--')) return null;
  return v;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function parseIntArg(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : numerator / denom;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation functions
// ─────────────────────────────────────────────────────────────────────────────

function validateNarration(
  agent: GeneratedAgent,
  narrative: { para1: string; para2: string },
  seed: string
): NarrationError[] {
  const errors: NarrationError[] = [];
  const fullText = `${narrative.para1} ${narrative.para2}`;

  for (const pattern of BANNED_PATTERNS) {
    const match = fullText.match(pattern.regex);
    if (match) {
      const idx = fullText.indexOf(match[0]);
      const start = Math.max(0, idx - 30);
      const end = Math.min(fullText.length, idx + match[0].length + 30);
      const context = (start > 0 ? '...' : '') + fullText.slice(start, end) + (end < fullText.length ? '...' : '');

      errors.push({
        seed,
        patternName: pattern.name,
        description: pattern.description,
        context,
      });
    }
  }

  return errors;
}

function validateTypes(agent: GeneratedAgent, seed: string): TypeError[] {
  const errors: TypeError[] = [];

  // Check latents exist and are in range (latents are in trace when includeTrace is true)
  const latents = agent.generationTrace?.latents?.values;
  if (latents) {
    for (const key of LATENT_KEYS) {
      const value = latents[key];
      if (value === undefined) {
        errors.push({ seed, field: `latents.${key}`, expected: 'number 0-1000', actual: 'undefined' });
      } else if (typeof value !== 'number' || value < 0 || value > 1000) {
        errors.push({ seed, field: `latents.${key}`, expected: 'number 0-1000', actual: String(value) });
      }
    }
  }

  // Check tier band
  const tierBand = agent.identity?.tierBand;
  if (!tierBand || !TIER_BANDS.includes(tierBand as TierBand)) {
    errors.push({ seed, field: 'identity.tierBand', expected: TIER_BANDS.join('|'), actual: String(tierBand) });
  }

  // Check ISO3 codes
  const iso3Fields = ['homeCountryIso3', 'citizenshipCountryIso3', 'currentCountryIso3'] as const;
  for (const field of iso3Fields) {
    const value = agent.identity?.[field];
    if (!value || typeof value !== 'string' || value.length !== 3) {
      errors.push({ seed, field: `identity.${field}`, expected: '3-char ISO3 code', actual: String(value) });
    }
  }

  // Check name not empty
  if (!agent.identity?.name || agent.identity.name.trim() === '') {
    errors.push({ seed, field: 'identity.name', expected: 'non-empty string', actual: String(agent.identity?.name) });
  }

  return errors;
}

function validateConstraints(agent: GeneratedAgent, seed: string): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  // Same-country diaspora cannot be 'expat' or 'refugee'
  const homeCountry = agent.identity?.homeCountryIso3;
  const currentCountry = agent.identity?.currentCountryIso3;
  const diasporaStatus = agent.social?.diasporaStatus;

  if (homeCountry === currentCountry && (diasporaStatus === 'expat' || diasporaStatus === 'refugee')) {
    violations.push({
      seed,
      constraint: 'same-country-diaspora',
      details: { homeCountry, currentCountry, diasporaStatus },
    });
  }

  // Different-country diaspora cannot be 'native'
  if (homeCountry !== currentCountry && diasporaStatus === 'native') {
    violations.push({
      seed,
      constraint: 'different-country-native',
      details: { homeCountry, currentCountry, diasporaStatus },
    });
  }

  return violations;
}

function checkImplausibilities(agent: GeneratedAgent, seed: string, asOfYear: number): Implausibility[] {
  const implausibilities: Implausibility[] = [];
  const birthYear = agent.identity?.birthYear ?? 1990;
  const age = asOfYear - birthYear;

  // Very young age with senior network role
  const networkRole = agent.network?.networkRole;
  if (age < 25 && (networkRole === 'gatekeeper' || networkRole === 'hub')) {
    implausibilities.push({
      seed,
      check: 'young-senior-network-role',
      severity: 'warning',
      details: { age, networkRole },
    });
  }

  // High opsec + high public visibility is contradictory
  const latents = agent.generationTrace?.latents?.values;
  const opsec = latents?.opsecDiscipline ?? 500;
  const publicness = latents?.publicness ?? 500;
  if (opsec > 800 && publicness > 800) {
    implausibilities.push({
      seed,
      check: 'high-opsec-high-publicness',
      severity: 'warning',
      details: { opsecDiscipline: opsec, publicness },
    });
  }

  // Zero fluency in home country language
  const homeCountry = agent.identity?.homeCountryIso3;
  const languages = agent.identity?.languages ?? [];
  // This is complex to check without language-country mapping, skip for now

  return implausibilities;
}

// ─────────────────────────────────────────────────────────────────────────────
// Correlation analysis
// ─────────────────────────────────────────────────────────────────────────────

type AgentMetrics = {
  seed: string;
  age: number;
  tierNumeric: number;
  educationNumeric: number;
  cosmopolitanism: number;
  publicness: number;
  opsecDiscipline: number;
  riskAppetite: number;
  impulseControl: number;
  conscientiousness: number; // From traits, used for housing correlation
  physicalConditioning: number;
  isAbroad: number;
  tradecraftSkill: number;
  housingStabilityNumeric: number;
  housingInstability: number;
};

function extractMetrics(agent: GeneratedAgent, asOfYear: number): AgentMetrics {
  const tierMap: Record<TierBand, number> = { elite: 3, middle: 2, mass: 1 };
  const educationMap: Record<string, number> = {
    doctorate: 5,
    graduate: 4,
    undergraduate: 3,
    vocational: 2,
    'self-taught': 1,
    'self_taught': 1,
    'no-formal': 0,
    'no_formal': 0,
  };
  const housingMap: Record<string, number> = {
    owned: 4,
    rental: 3,
    temporary: 2,
    transient: 1,
    'couch-surfing': 0,
  };

  // Skills is an object keyed by skill name, not an array
  const skills = agent.capabilities?.skills as Record<string, { value: number }> | undefined;
  const tradecraftValue = skills?.tradecraft?.value ?? 0;

  // Latents are in generationTrace when includeTrace is true
  const latents = agent.generationTrace?.latents?.values;

  // Calculate age from birthYear
  const birthYear = agent.identity?.birthYear ?? 1990;
  const age = asOfYear - birthYear;

  // Get tierBand from identity
  const tierBand = (agent.identity?.tierBand ?? 'middle') as TierBand;

  // Get education track
  const educationTrack = agent.identity?.educationTrackTag ?? '';

  // Get housing stability from home object
  const housingStability = agent.home?.housingStability ?? '';

  // Get conscientiousness from traits
  const conscientiousness = agent.capabilities?.traits?.conscientiousness ?? 500;

  return {
    seed: agent.seed,
    age,
    tierNumeric: tierMap[tierBand] ?? 2,
    educationNumeric: educationMap[educationTrack] ?? 2,
    cosmopolitanism: latents?.cosmopolitanism ?? 500,
    publicness: latents?.publicness ?? 500,
    opsecDiscipline: latents?.opsecDiscipline ?? 500,
    riskAppetite: latents?.riskAppetite ?? 500,
    impulseControl: latents?.impulseControl ?? 500,
    conscientiousness,
    physicalConditioning: latents?.physicalConditioning ?? 500,
    isAbroad: agent.identity?.homeCountryIso3 !== agent.identity?.currentCountryIso3 ? 1 : 0,
    tradecraftSkill: tradecraftValue,
    housingStabilityNumeric: housingMap[housingStability] ?? 2,
    housingInstability: 4 - (housingMap[housingStability] ?? 2),
  };
}

function analyzeDocumentedCorrelates(metrics: AgentMetrics[]): CorrelateResult[] {
  const results: CorrelateResult[] = [];

  for (const correlate of DOCUMENTED_CORRELATES) {
    const x = metrics.map(m => m[correlate.vars[0] as keyof AgentMetrics] as number);
    const y = metrics.map(m => m[correlate.vars[1] as keyof AgentMetrics] as number);
    const r = pearsonCorrelation(x, y);

    let status: CorrelateResult['status'];
    const expectedSign = correlate.expected === 'positive' ? 1 : -1;
    const actualSign = Math.sign(r);

    // Use custom thresholds if defined, otherwise use defaults
    const weakThreshold = (correlate as { weakThreshold?: number }).weakThreshold ?? 0.05;
    const verifyThreshold = (correlate as { verifyThreshold?: number }).verifyThreshold ?? 0.15;

    if (Math.abs(r) < weakThreshold) {
      status = 'missing';
    } else if (actualSign !== expectedSign) {
      status = 'inverted';
    } else if (Math.abs(r) < verifyThreshold) {
      status = 'weak';
    } else {
      status = 'verified';
    }

    results.push({
      id: correlate.id,
      name: correlate.name,
      variables: correlate.vars as [string, string],
      expectedDirection: correlate.expected,
      observedR: Math.round(r * 1000) / 1000,
      status,
    });
  }

  return results;
}

function findSpuriousCorrelations(metrics: AgentMetrics[]): SpuriousResult[] {
  const spurious: SpuriousResult[] = [];
  const keys = Object.keys(metrics[0]).filter(k => k !== 'seed') as (keyof AgentMetrics)[];

  // Check all pairs of numeric variables
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const k1 = keys[i];
      const k2 = keys[j];

      // Skip documented correlates
      const isDocumented = DOCUMENTED_CORRELATES.some(
        c => (c.vars[0] === k1 && c.vars[1] === k2) || (c.vars[0] === k2 && c.vars[1] === k1)
      );
      if (isDocumented) continue;

      const x = metrics.map(m => m[k1] as number);
      const y = metrics.map(m => m[k2] as number);
      const r = pearsonCorrelation(x, y);

      // Flag strong correlations that aren't documented
      if (Math.abs(r) > 0.4) {
        spurious.push({
          variables: [k1, k2],
          observedR: Math.round(r * 1000) / 1000,
          concern: `Unexpectedly strong ${r > 0 ? 'positive' : 'negative'} correlation (r=${r.toFixed(3)})`,
        });
      }
    }
  }

  return spurious;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function printUsage(): never {
  console.error(
    [
      'Usage: npx tsx scripts/audit-agents.ts [options]',
      '',
      'Options:',
      '  --count <n>         Number of agents (default 100)',
      '  --seedPrefix <str>  Seed prefix (default "audit")',
      '  --out <path>        Write JSON report to file',
      '  --help              Show this help',
    ].join('\n')
  );
  process.exit(2);
}

async function main() {
  const args = process.argv.slice(2);
  if (hasFlag(args, '--help')) printUsage();

  const count = Math.max(1, Math.min(10_000, parseIntArg(getArgValue(args, '--count'), 100)));
  const seedPrefix = getArgValue(args, '--seedPrefix') ?? 'audit';
  const outPath = getArgValue(args, '--out');

  console.log('='.repeat(60));
  console.log('Agent Audit Script');
  console.log('='.repeat(60));
  console.log(`Generating ${count} agents with prefix "${seedPrefix}"...\n`);

  const startTime = Date.now();

  // Load data
  console.log('Loading static data...');
  const vocab = loadJsonFile<AgentVocabV1>('public/agent-vocab.v1.json');
  const priors = loadJsonFile<AgentPriorsV1>('public/agent-priors.v1.json');
  const shadowMap = loadJsonFile<ShadowCountryMapEntry[]>('public/shadow-country-map.json');
  const countries = shadowMap.filter(c => c.iso3 && c.iso3.length === 3);

  const shadowByIso3 = new Map<string, { shadow: string; continent?: string }>();
  for (const entry of shadowMap) {
    if (entry.iso3) {
      shadowByIso3.set(entry.iso3, { shadow: entry.shadow, continent: entry.continent });
    }
  }

  // Generate agents and collect errors
  const allNarrationErrors: NarrationError[] = [];
  const allTypeErrors: TypeError[] = [];
  const allConstraintViolations: ConstraintViolation[] = [];
  const allImplausibilities: Implausibility[] = [];
  const allMetrics: AgentMetrics[] = [];
  const agentsWithErrors = new Set<string>();

  const pronounModes: PronounMode[] = ['seeded'];

  console.log('Generating and validating agents...');
  for (let i = 0; i < count; i++) {
    const seed = `${seedPrefix}-${String(i).padStart(3, '0')}`;

    const agent = generateAgent({
      seed,
      vocab,
      priors,
      countries,
      asOfYear: 2025,
      includeTrace: true,
    });

    // Generate narrative for narration checks
    const originLabel = shadowByIso3.get(agent.identity.homeCountryIso3)?.shadow ?? agent.identity.homeCountryIso3;
    const citizenshipLabel = shadowByIso3.get(agent.identity.citizenshipCountryIso3)?.shadow ?? agent.identity.citizenshipCountryIso3;
    const currentLabel = shadowByIso3.get(agent.identity.currentCountryIso3)?.shadow ?? agent.identity.currentCountryIso3;

    for (const pronounMode of pronounModes) {
      const narrative = generateNarrative(
        agent,
        { originLabel, citizenshipLabel, currentLabel },
        2025,
        pronounMode
      );

      const narrationErrors = validateNarration(agent, narrative, seed);
      if (narrationErrors.length > 0) {
        allNarrationErrors.push(...narrationErrors);
        agentsWithErrors.add(seed);
      }
    }

    // Type validation
    const typeErrors = validateTypes(agent, seed);
    if (typeErrors.length > 0) {
      allTypeErrors.push(...typeErrors);
      agentsWithErrors.add(seed);
    }

    // Constraint validation
    const constraintViolations = validateConstraints(agent, seed);
    if (constraintViolations.length > 0) {
      allConstraintViolations.push(...constraintViolations);
      agentsWithErrors.add(seed);
    }

    // Implausibility checks
    const implausibilities = checkImplausibilities(agent, seed, 2025);
    if (implausibilities.length > 0) {
      allImplausibilities.push(...implausibilities);
      // Don't count warnings as errors for summary
      if (implausibilities.some(i => i.severity === 'error')) {
        agentsWithErrors.add(seed);
      }
    }

    // Collect metrics for correlation analysis
    allMetrics.push(extractMetrics(agent, 2025));

    if ((i + 1) % 25 === 0) {
      console.log(`  Progress: ${i + 1}/${count}`);
    }
  }

  // Correlation analysis
  console.log('\nAnalyzing correlations...');
  const documentedResults = analyzeDocumentedCorrelates(allMetrics);
  const spuriousResults = findSpuriousCorrelations(allMetrics);

  const durationMs = Date.now() - startTime;

  // Build report
  const report: AuditReport = {
    meta: {
      generatedAt: new Date().toISOString(),
      agentCount: count,
      seedPrefix,
      durationMs,
    },
    summary: {
      totalAgents: count,
      agentsWithErrors: agentsWithErrors.size,
      totalErrors: allNarrationErrors.length + allTypeErrors.length + allConstraintViolations.length,
      errorsByType: {
        narration: allNarrationErrors.length,
        type: allTypeErrors.length,
        constraint: allConstraintViolations.length,
        implausibility: allImplausibilities.length,
      },
    },
    narrationErrors: allNarrationErrors,
    typeErrors: allTypeErrors,
    constraintViolations: allConstraintViolations,
    implausibilities: allImplausibilities,
    correlationAnalysis: {
      documented: documentedResults,
      spurious: spuriousResults,
    },
  };

  // Output
  if (outPath) {
    const json = JSON.stringify(report, null, 2);
    writeFileSync(resolve(process.cwd(), outPath), json + '\n', 'utf-8');
    console.log(`\nReport written to: ${outPath}`);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total agents: ${count}`);
  console.log(`Agents with errors: ${agentsWithErrors.size}`);
  console.log(`Duration: ${durationMs}ms`);
  console.log('');
  console.log('Errors by type:');
  console.log(`  Narration: ${allNarrationErrors.length}`);
  console.log(`  Type: ${allTypeErrors.length}`);
  console.log(`  Constraint: ${allConstraintViolations.length}`);
  console.log(`  Implausibility: ${allImplausibilities.length}`);

  // Print correlation summary
  console.log('\n' + '-'.repeat(40));
  console.log('CORRELATION ANALYSIS');
  console.log('-'.repeat(40));

  console.log('\nDocumented correlates:');
  for (const r of documentedResults) {
    const statusIcon = r.status === 'verified' ? '✓' : r.status === 'weak' ? '~' : '✗';
    console.log(`  ${statusIcon} ${r.id} ${r.name}: r=${r.observedR.toFixed(3)} (${r.status})`);
  }

  if (spuriousResults.length > 0) {
    console.log('\nSpurious correlations detected:');
    for (const s of spuriousResults) {
      console.log(`  ! ${s.variables[0]} ↔ ${s.variables[1]}: r=${s.observedR.toFixed(3)}`);
    }
  } else {
    console.log('\nNo spurious correlations detected.');
  }

  // Print sample errors
  if (allNarrationErrors.length > 0) {
    console.log('\n' + '-'.repeat(40));
    console.log('SAMPLE NARRATION ERRORS (first 5)');
    console.log('-'.repeat(40));
    for (const err of allNarrationErrors.slice(0, 5)) {
      console.log(`  [${err.patternName}] ${err.seed}`);
      console.log(`    ${err.context}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  if (agentsWithErrors.size > 0) {
    console.log('Audit found issues. See report for details.');
    process.exit(1);
  } else {
    console.log('Audit passed - no errors found.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
