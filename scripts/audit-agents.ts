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
  { id: '#2', name: 'Tier ↔ Health', vars: ['tierNumeric', 'healthScore'], expected: 'positive' as const }, // Elite has better healthcare
  { id: '#3', name: 'Tier ↔ Education', vars: ['tierNumeric', 'educationNumeric'], expected: 'positive' as const },
  { id: '#4', name: 'Age ↔ Has Family', vars: ['age', 'hasFamily'], expected: 'positive' as const }, // Marriage/children peak 28-45
  { id: '#5', name: 'Cosmopolitanism ↔ Abroad', vars: ['cosmopolitanism', 'isAbroad'], expected: 'positive' as const },
  { id: '#6', name: 'Age ↔ Network Role', vars: ['age', 'networkRoleNumeric'], expected: 'positive' as const }, // Senior = hub/gatekeeper
  { id: '#7', name: 'Religiosity ↔ Vices', vars: ['religiosity', 'viceCount'], expected: 'negative' as const }, // Strict observance reduces vices
  { id: '#9', name: 'Travel ↔ Tradecraft', vars: ['cosmopolitanism', 'tradecraftSkill'], expected: 'positive' as const },
  // #11 Empathy+Deception → Network: Complex multi-variable correlation, not easily testable with Pearson
  { id: '#12', name: 'Authoritarianism ↔ Conflict Style', vars: ['authoritarianism', 'conflictStyleNumeric'], expected: 'positive' as const }, // Authoritarian = competing
  // #13 Conscientiousness ↔ Housing: REMOVED from verification
  // Hard constraints (elite tier, family, senior professionals) force 60% of agents into stable housing
  // These constraints correctly model reality but prevent conscientiousness from varying housing outcomes
  // The correlation is not achievable with realistic social constraints
  // Reference: See domestic.ts lines 141-158 for the hard constraints that override personality
  { id: '#14', name: 'Visibility ↔ Reputation', vars: ['visibilityNumeric', 'reputationNumeric'], expected: 'positive' as const }, // High visibility = defined reputation
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
  { id: '#A4', name: 'Age ↔ Community Status', vars: ['age', 'communityStatusNumeric'], expected: 'positive' as const }, // Elders become pillars
  // Socioeconomic correlations
  { id: '#S1', name: 'Tier ↔ Cosmopolitanism', vars: ['tierNumeric', 'cosmopolitanism'], expected: 'positive' as const }, // Elite agents more cosmopolitan (travel, exposure)
  // Domestic correlations
  { id: '#L1', name: 'Social Battery ↔ Third Places', vars: ['socialBattery', 'thirdPlacesCount'], expected: 'positive' as const }, // Extroverts have more third places
  // Tautological inverse (housingStabilityNumeric and housingInstability are mathematical inverses)
  { id: '#T1', name: 'Housing Stability ↔ Housing Instability (tautology)', vars: ['housingStabilityNumeric', 'housingInstability'], expected: 'negative' as const },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW CORRELATES FOR AUDIT-FIRST ANALYSIS (measuring current state)
  // ═══════════════════════════════════════════════════════════════════════════

  // Category A: Cognitive/Education
  { id: '#E1', name: 'Education ↔ Cognitive Speed', vars: ['educationNumeric', 'cognitiveSpeed'], expected: 'positive' as const },
  { id: '#E2', name: 'Education ↔ Working Memory', vars: ['educationNumeric', 'workingMemory'], expected: 'positive' as const },
  { id: '#E3', name: 'Age ↔ Conscientiousness', vars: ['age', 'conscientiousness'], expected: 'positive' as const },
  { id: '#E4', name: 'Age ↔ Avg Skill XP', vars: ['age', 'avgSkillXp'], expected: 'positive' as const },

  // Category B: Social/Network
  { id: '#N1', name: 'Community Status ↔ Network Role', vars: ['communityStatusNumeric', 'networkRoleNumeric'], expected: 'positive' as const },
  { id: '#N2', name: 'Dependent Count ↔ Third Places', vars: ['dependentCount', 'thirdPlacesCount'], expected: 'negative' as const },
  { id: '#N3', name: 'Conscientiousness ↔ Network Role', vars: ['conscientiousness', 'networkRoleNumeric'], expected: 'positive' as const },
  { id: '#N4', name: 'Deception ↔ Relationship Count', vars: ['deception', 'relationshipCount'], expected: 'negative' as const },
  { id: '#N5', name: 'Family ↔ Religiosity', vars: ['hasFamily', 'religiosity'], expected: 'positive' as const },

  // Category C: Housing/Domestic
  { id: '#H1', name: 'Family Size ↔ Housing Stability', vars: ['householdSize', 'housingStabilityNumeric'], expected: 'positive' as const },
  { id: '#H2', name: 'Residency Status ↔ Housing Stability', vars: ['residencyNumeric', 'housingStabilityNumeric'], expected: 'positive' as const },
  { id: '#H3', name: 'Cosmopolitanism ↔ Housing Stability', vars: ['cosmopolitanism', 'housingStabilityNumeric'], expected: 'negative' as const },
  { id: '#H4', name: 'Frugality ↔ Housing Stability', vars: ['frugality', 'housingStabilityNumeric'], expected: 'positive' as const },

  // Category D: Health/Lifestyle
  { id: '#HL1', name: 'Stress Reactivity ↔ Chronic Conditions', vars: ['stressReactivity', 'chronicCount'], expected: 'positive' as const },
  { id: '#HL2', name: 'Vice Tendency ↔ Chronic Conditions', vars: ['viceTendency', 'chronicCount'], expected: 'positive' as const },
  { id: '#HL3', name: 'Endurance ↔ Stress Reactivity', vars: ['endurance', 'stressReactivity'], expected: 'negative' as const },
  { id: '#HL4', name: 'Religiosity ↔ Dietary Restrictions', vars: ['religiosity', 'dietaryRestrictionCount'], expected: 'positive' as const },

  // Category E: Skills/Capabilities
  { id: '#SK1', name: 'Institutional Embeddedness ↔ Bureaucracy', vars: ['institutionalEmbeddedness', 'bureaucracySkill'], expected: 'positive' as const },
  { id: '#SK2', name: 'Tech Fluency ↔ Digital Hygiene', vars: ['techFluency', 'digitalHygiene'], expected: 'positive' as const },
  { id: '#SK3', name: 'Social Battery ↔ Negotiation', vars: ['socialBattery', 'negotiationSkill'], expected: 'positive' as const },
  { id: '#SK4', name: 'Adaptability ↔ Negotiation', vars: ['adaptability', 'negotiationSkill'], expected: 'positive' as const },
  { id: '#SK5', name: 'Opsec ↔ Digital Hygiene', vars: ['opsecDiscipline', 'digitalHygiene'], expected: 'positive' as const },

  // Category F: Trait/Latent Cross-Correlations
  { id: '#X1', name: 'Tier ↔ Risk Appetite', vars: ['tierNumeric', 'riskAppetite'], expected: 'negative' as const },
  { id: '#X2', name: 'Institutional Embeddedness ↔ Risk Appetite', vars: ['institutionalEmbeddedness', 'riskAppetite'], expected: 'negative' as const },
  { id: '#X3', name: 'Curiosity ↔ Risk Appetite', vars: ['curiosityBandwidth', 'riskAppetite'], expected: 'positive' as const },
  { id: '#X4', name: 'Planning Horizon ↔ Impulse Control', vars: ['planningHorizon', 'impulseControl'], expected: 'positive' as const },
  { id: '#X5', name: 'Agreeableness ↔ Conflict Style', vars: ['agreeableness', 'conflictStyleNumeric'], expected: 'negative' as const },
  { id: '#X6', name: 'Authoritarianism ↔ Home Orderliness', vars: ['authoritarianism', 'homeOrderliness'], expected: 'positive' as const },

  // Category G: Behavioral Coherence
  { id: '#B1', name: 'Conscientiousness ↔ Petty Habits', vars: ['conscientiousness', 'pettyHabitScore'], expected: 'positive' as const },
  { id: '#B2', name: 'Third Places ↔ Civic Engagement', vars: ['thirdPlacesCount', 'civicEngagementNumeric'], expected: 'positive' as const },
  { id: '#B3', name: 'Physical Conditioning ↔ Active Hobbies', vars: ['physicalConditioning', 'activeHobbyCount'], expected: 'positive' as const },
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
  const diasporaStatus = agent.geography?.diasporaStatus;

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
  const networkRole = agent.network?.role;
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
  // Additional metrics for missing correlations
  socialBattery: number;
  thirdPlacesCount: number;
  networkRoleNumeric: number;
  hasFamily: number; // 1 if married/partnered with dependents, 0 otherwise
  viceCount: number;
  religiosity: number; // derived from observanceLevel
  empathy: number;
  deception: number;
  authoritarianism: number;
  conflictStyleNumeric: number;
  communityStatusNumeric: number;
  visibilityNumeric: number;
  reputationNumeric: number;
  buildNumeric: number;
  gaitNumeric: number;
  healthScore: number; // derived from conditions/fitness

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW METRICS FOR AUDIT-FIRST ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════

  // Cognitive/Education (Category A)
  cognitiveSpeed: number; // from aptitudes
  workingMemory: number; // from aptitudes
  avgSkillXp: number; // computed from skills

  // Social/Network (Category B)
  dependentCount: number;
  relationshipCount: number;

  // Housing/Domestic (Category C)
  householdSize: number;
  residencyNumeric: number;
  frugality: number; // from latents

  // Health/Lifestyle (Category D)
  stressReactivity: number; // from latents
  chronicCount: number;
  viceTendency: number; // derived, used in chronic condition weights
  dietaryRestrictionCount: number;
  endurance: number; // from aptitudes

  // Skills/Capabilities (Category E)
  bureaucracySkill: number;
  digitalHygiene: number;
  negotiationSkill: number;
  institutionalEmbeddedness: number; // from latents
  techFluency: number; // from latents
  adaptability: number; // from latents

  // Trait/Latent Cross (Category F)
  curiosityBandwidth: number; // from latents
  planningHorizon: number; // from latents
  agreeableness: number; // from traits
  homeOrderliness: number; // from preferences

  // Behavioral Coherence (Category G)
  pettyHabitScore: number; // computed from habits
  civicEngagementNumeric: number;
  activeHobbyCount: number;
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
    'stable-rental': 3,
    rental: 3,
    tenuous: 2,
    temporary: 2,
    transient: 1,
    'couch-surfing': 0,
    institutional: 2,
  };
  const networkRoleMap: Record<string, number> = {
    isolate: 0,
    peripheral: 1,
    connector: 2,
    hub: 3,
    broker: 4,
    gatekeeper: 5,
  };
  const conflictStyleMap: Record<string, number> = {
    avoidant: 0,
    accommodating: 1,
    yielding: 1,
    compromising: 2,
    collaborative: 3,
    assertive: 4,
    competing: 5,
  };
  const communityStatusMap: Record<string, number> = {
    banned: 0,
    outsider: 1,
    newcomer: 2,
    regular: 3,
    respected: 4,
    pillar: 5,
    controversial: 2, // uncertain status
  };
  const reputationMap: Record<string, number> = {
    unknown: 0,
    'has-been': 1,
    'burnt-out': 1,
    'by-the-book': 2,
    unpredictable: 2,
    reliable: 3,
    principled: 3,
    discreet: 3,
    fixer: 4,
    brilliant: 4,
    'rising-star': 4,
    ruthless: 3, // competent but feared
    corrupt: 1,
    reckless: 2,
    loudmouth: 1,
  };
  const buildMap: Record<string, number> = {
    slight: 1,
    lean: 2,
    average: 3,
    athletic: 4,
    stocky: 4,
    heavy: 5,
    muscular: 5,
  };
  const gaitMap: Record<string, number> = {
    slouching: 1,
    nervous: 1,
    measured: 2,
    graceful: 3,
    brisk: 4,
    military: 5,
    heavy: 4,
  };
  const observanceMap: Record<string, number> = {
    none: 0,
    lapsed: 0,
    secular: 0,
    cultural: 1,
    nominal: 1,
    moderate: 2,
    practicing: 3,
    observant: 4,
    strict: 5,
    'ultra-orthodox': 6,
    devout: 5,
    orthodox: 5,
    fundamentalist: 5,
  };
  const fitnessMap: Record<string, number> = {
    critical: 1,
    poor: 2,
    fair: 3,
    average: 3,
    good: 4,
    excellent: 5,
    'peak-condition': 6,
    elite: 5,
  };

  // NEW: Residency status map for housing correlates
  const residencyMap: Record<string, number> = {
    citizen: 5,
    'permanent-resident': 4,
    'work-visa': 3,
    'student-visa': 2,
    refugee: 1,
    irregular: 0,
    undocumented: 0,
    stateless: 0,
  };

  // NEW: Civic engagement map (matching actual values from social.ts)
  const civicEngagementMap: Record<string, number> = {
    disengaged: 0,
    disillusioned: 1,
    'quiet-voter': 2,
    'active-participant': 3,
    organizer: 4,
    candidate: 5,
    // Legacy fallbacks
    none: 0,
    passive: 1,
    voter: 2,
    occasional: 2,
    active: 3,
    leader: 5,
  };

  // NEW: Orderliness map from preferences
  const orderlinessMap: Record<string, number> = {
    chaotic: 1,
    messy: 2,
    casual: 3,
    tidy: 4,
    meticulous: 5,
    obsessive: 6,
  };

  // Skills is an object keyed by skill name, not an array
  const skills = agent.capabilities?.skills as Record<string, { value: number }> | undefined;
  const tradecraftValue = skills?.tradecraft?.value ?? 0;

  // Latents are in generationTrace when includeTrace is true
  const latents = agent.generationTrace?.latents?.values;
  // Derived values (like viceTendency) are in generationTrace.derived
  const derived = (agent.generationTrace as any)?.derived;

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

  // Extract aptitudes
  const aptitudes = agent.capabilities?.aptitudes;

  // Has family: married/partnered with dependents (captures "has started a family")
  const maritalStatus = agent.family?.maritalStatus ?? 'single';
  const dependentCount = agent.family?.dependentCount ?? 0;
  const hasFamily = (maritalStatus === 'married' || maritalStatus === 'partnered') && dependentCount > 0 ? 1 : 0;

  // Vice count
  const viceCount = agent.vices?.length ?? 0;

  // Health score: fitness band minus chronic conditions
  const fitnessBand = agent.health?.fitnessBand ?? 'average';
  const chronicCount = agent.health?.chronicConditionTags?.length ?? 0;
  const healthScore = Math.max(0, (fitnessMap[fitnessBand] ?? 3) * 200 - chronicCount * 100);

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
    // Additional metrics
    socialBattery: latents?.socialBattery ?? 500,
    thirdPlacesCount: agent.everydayLife?.thirdPlaces?.length ?? 0,
    networkRoleNumeric: networkRoleMap[agent.network?.role ?? 'peripheral'] ?? 1,
    hasFamily,
    viceCount,
    religiosity: observanceMap[agent.spirituality?.observanceLevel ?? 'secular'] ?? 0,
    empathy: aptitudes?.empathy ?? 500,
    deception: aptitudes?.deceptionAptitude ?? 500,
    authoritarianism: agent.capabilities?.traits?.authoritarianism ?? 500,
    conflictStyleNumeric: conflictStyleMap[agent.personality?.conflictStyle ?? 'compromising'] ?? 2,
    communityStatusNumeric: communityStatusMap[agent.communities?.communityStatus ?? 'regular'] ?? 3,
    visibilityNumeric: agent.visibility?.publicVisibility ?? 500,
    reputationNumeric: reputationMap[agent.reputation?.professional ?? 'unknown'] ?? 0,
    buildNumeric: buildMap[agent.appearance?.buildTag ?? 'average'] ?? 3,
    gaitNumeric: gaitMap[agent.physicalPresence?.gait ?? 'measured'] ?? 2,
    healthScore,

    // ═══════════════════════════════════════════════════════════════════════════
    // NEW METRICS FOR AUDIT-FIRST ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════

    // Cognitive/Education (Category A)
    cognitiveSpeed: aptitudes?.cognitiveSpeed ?? 500,
    workingMemory: aptitudes?.workingMemory ?? 500,
    avgSkillXp: computeAvgSkillXp(skills),

    // Social/Network (Category B)
    dependentCount,
    // Correlate #N4: actual relationships array from social.ts
    relationshipCount: agent.relationships?.length ?? 0,

    // Housing/Domestic (Category C)
    // Compute household size from family status (matches housing weight inputs)
    // NOT from householdComposition which is picked AFTER housing stability
    householdSize: computeEstimatedHouseholdSize(agent.family?.maritalStatus, agent.family?.dependentCount ?? 0),
    // legalAdmin.residencyStatus maps to residency stability
    residencyNumeric: computeResidencyStability(agent.legalAdmin?.residencyStatus),
    frugality: latents?.frugality ?? 500,

    // Health/Lifestyle (Category D)
    stressReactivity: latents?.stressReactivity ?? 500,
    chronicCount,
    // viceTendency is derived value (0-1), scale to 0-1000 for consistency
    viceTendency: (derived?.viceTendency ?? 0.5) * 1000,
    // food.restrictions is the dietary restrictions array
    dietaryRestrictionCount: agent.preferences?.food?.restrictions?.length ?? 0,
    endurance: aptitudes?.endurance ?? 500,

    // Skills/Capabilities (Category E)
    bureaucracySkill: skills?.bureaucracy?.value ?? 0,
    digitalHygiene: agent.visibility?.digitalHygiene ?? 500,
    negotiationSkill: skills?.negotiation?.value ?? 0,
    institutionalEmbeddedness: latents?.institutionalEmbeddedness ?? 500,
    techFluency: latents?.techFluency ?? 500,
    adaptability: latents?.adaptability ?? 500,

    // Trait/Latent Cross (Category F)
    curiosityBandwidth: latents?.curiosityBandwidth ?? 500,
    planningHorizon: latents?.planningHorizon ?? 500,
    agreeableness: agent.capabilities?.traits?.agreeableness ?? 500,
    // Correlate #X6: homeOrderliness from everydayLife (0-1000 scale)
    homeOrderliness: (agent.everydayLife?.homeOrderliness ?? 500) / 1000 * 5,

    // Behavioral Coherence (Category G)
    // Correlate #B1: pettyHabits from everydayLife
    pettyHabitScore: computePettyHabitScore(agent.everydayLife?.pettyHabits ?? []),
    // civicLife.engagement maps to civic engagement
    civicEngagementNumeric: civicEngagementMap[agent.civicLife?.engagement ?? 'passive'] ?? 1,
    // hobbies.primary contains the hobbies
    activeHobbyCount: countActiveHobbies(agent.preferences?.hobbies?.primary ?? []),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions for computed metrics
// ─────────────────────────────────────────────────────────────────────────────

function computeAvgSkillXp(skills: Record<string, { value: number; xp?: number }> | undefined): number {
  if (!skills) return 0;
  const xpValues = Object.values(skills).map(s => s.xp ?? 0);
  if (xpValues.length === 0) return 0;
  return xpValues.reduce((sum, v) => sum + v, 0) / xpValues.length;
}

function computePettyHabitScore(habits: string[]): number {
  // Correlate #B1: Conscientiousness ↔ Petty Habits
  // Organized habits = high score, disorganized = low score
  const organizedHabits = new Set([
    'always-early', 'checks-locks', 'double-checks-everything', 'overpacks',
    'makes-lists', 'prepares-ahead', 'keeps-receipts', 'irons-clothes', 'polishes-shoes',
  ]);
  const disorganizedHabits = new Set([
    'always-late', 'forgets-keys', 'loses-phone', 'skips-breakfast',
  ]);
  let score = 0;
  for (const habit of habits) {
    if (organizedHabits.has(habit)) {
      score += 3; // Organized habits = high conscientiousness
    } else if (disorganizedHabits.has(habit)) {
      score -= 2; // Disorganized habits = low conscientiousness
    } else {
      score += 1; // Neutral habits
    }
  }
  // Shift to positive scale (min -4 for 2 disorganized → 0, max 6 for 2 organized → 10)
  return score + 4;
}

function countActiveHobbies(hobbies: string[]): number {
  const activeHobbies = [
    'running', 'cycling', 'swimming', 'hiking', 'climbing', 'yoga',
    'martial-arts', 'weightlifting', 'dancing', 'tennis', 'soccer',
    'basketball', 'skiing', 'surfing', 'kayaking', 'rock-climbing',
    'capoeira', 'golf', 'boxing', 'judo', 'karate', 'taekwondo',
  ];
  return hobbies.filter(h => activeHobbies.some(ah => h.toLowerCase().includes(ah))).length;
}

// DEPRECATED: computeHouseholdSize from composition is not used for #H1
// because householdComposition is picked AFTER housing stability
function computeHouseholdSize(composition: string): number {
  const sizeMap: Record<string, number> = {
    alone: 1,
    partner: 2,
    'small-family': 3,
    'nuclear-family': 4,
    'extended-family': 6,
    'multi-generational': 7,
    roommates: 3,
    'group-house': 5,
    institutional: 10,
  };
  return sizeMap[composition] ?? 1;
}

// Compute estimated household size from family status
// This matches the input to housing weights: 1 + married + dependentCount
function computeEstimatedHouseholdSize(maritalStatus: string | undefined, dependentCount: number): number {
  const isMarried = maritalStatus === 'married' || maritalStatus === 'partnered';
  return 1 + (isMarried ? 1 : 0) + dependentCount;
}

function computeResidencyStability(residencyStatus: string | undefined): number {
  // Map actual ResidencyStatus values to stability (higher = more stable)
  const statusMap: Record<string, number> = {
    citizen: 5,           // Full citizen - most stable
    'permanent-resident': 4, // Legal permanent - very stable
    diplomatic: 4,        // Diplomatic status - stable but temporary
    'work-visa': 3,       // Legal but temporary
    'student-visa': 2,    // Temporary, education-dependent
    'asylum-pending': 2,  // Precarious but legal
    irregular: 1,         // Undocumented - least stable
    refugee: 1,           // Precarious
    stateless: 1,         // Most precarious
  };
  return statusMap[residencyStatus ?? 'citizen'] ?? 3;
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
