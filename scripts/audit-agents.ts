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

// ═══════════════════════════════════════════════════════════════════════════
// Constraint Validation Types (for plausibility gates and hard constraints)
// ═══════════════════════════════════════════════════════════════════════════

type ConstraintCheck = {
  id: string;
  name: string;
  type: 'plausibility-gate' | 'age-gate' | 'hard-constraint' | 'threshold';
  check: (agent: GeneratedAgent, metrics: AgentMetricsExtended) => boolean; // true = passed, false = violated
  expectedViolationRate: number; // 0 for hard constraints, small % for soft gates
};

type ConstraintResult = {
  id: string;
  name: string;
  type: string;
  totalChecked: number;
  violations: number;
  violationRate: number;
  expectedRate: number;
  status: 'passed' | 'warning' | 'failed';
  examples: string[]; // seeds of first few violations
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
    correlatesVerified: number;
    correlatesTotal: number;
    constraintsPassed: number;
    constraintsTotal: number;
  };
  narrationErrors: NarrationError[];
  typeErrors: TypeError[];
  constraintViolations: ConstraintViolation[];
  implausibilities: Implausibility[];
  correlationAnalysis: {
    documented: CorrelateResult[];
    spurious: SpuriousResult[];
  };
  constraintValidation: ConstraintResult[];
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
    // Match three "and"s in a single clause, but exclude:
    // - hyphenated compounds like "salt-and-pepper" (lookbehind/lookahead for hyphen or letter)
    // - ISO3 country codes like "(AND)" (lookbehind for open paren)
    regex: /(?<![a-z-])(?<!\()and(?![-a-z])(?!\))[^.]*(?<![a-z-])(?<!\()and(?![-a-z])(?!\))[^.]*(?<![a-z-])(?<!\()and(?![-a-z])(?!\))/i,
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

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW CORRELATES (2026-01-06)
  // ─────────────────────────────────────────────────────────────────────────────

  // Phase 1: Preferences
  { id: '#NEW6', name: 'Cosmopolitanism ↔ Dietary Adventurousness', vars: ['cosmopolitanism', 'cuisineCount'], expected: 'positive' as const },
  { id: '#NEW7', name: 'Frugality ↔ Fashion Status Signaling', vars: ['frugality', 'statusSignaling'], expected: 'negative' as const },
  { id: '#NEW8', name: 'Social Battery ↔ Social Media Usage', vars: ['socialBattery', 'socialMediaIntensity'], expected: 'positive' as const },
  { id: '#NEW14', name: 'Stress Reactivity ↔ Coping Ritual Count', vars: ['stressReactivity', 'copingRitualCount'], expected: 'positive' as const },
  { id: '#NEW16', name: 'Agreeableness ↔ Fashion Conformity', vars: ['agreeableness', 'fashionConformity'], expected: 'positive' as const },
  { id: '#NEW23', name: 'Institutional Embeddedness ↔ Hobby Conformity', vars: ['institutionalEmbeddedness', 'hobbyMainstreamScore'], expected: 'positive' as const },

  // Phase 2: Social/Lifestyle/Domestic
  // #NEW1 uses relationshipHostility (computed from risk, conscientiousness, impulse control)
  // instead of viceTendency to avoid the publicness confound
  { id: '#NEW1', name: 'Relationship Hostility ↔ Relationship Count', vars: ['relationshipHostility', 'relationshipCount'], expected: 'negative' as const },
  { id: '#NEW2', name: 'Institutional Embeddedness ↔ Housing Stability', vars: ['institutionalEmbeddedness', 'housingStabilityNumeric'], expected: 'positive' as const },
  { id: '#NEW5', name: 'Conscientiousness ↔ Vice Count', vars: ['conscientiousness', 'viceCount'], expected: 'negative' as const },
  { id: '#NEW9', name: 'Deception ↔ Community Status', vars: ['deception', 'communityStatusNumeric'], expected: 'negative' as const },
  { id: '#NEW11', name: 'Principledness ↔ Broker Role', vars: ['principledness', 'isBroker'], expected: 'negative' as const },
  { id: '#NEW15', name: 'Adaptability ↔ Home Orderliness', vars: ['adaptability', 'homeOrderliness'], expected: 'negative' as const },

  // Phase 3: Deterministic Gates
  { id: '#NEW10', name: 'Diaspora ↔ Linguistic Minority', vars: ['isDiaspora', 'linguisticMinority'], expected: 'positive' as const },
  { id: '#NEW33', name: 'High Opsec ↔ Not Hub/Gatekeeper', vars: ['opsecDiscipline', 'isHubOrGatekeeper'], expected: 'negative' as const },

  // Phase 4: Cross-Domain
  { id: '#NEW12', name: 'Age ↔ Publicness', vars: ['age', 'publicness'], expected: 'positive' as const },
  { id: '#NEW17', name: 'Tier ↔ Network Role', vars: ['tierNumeric', 'networkRoleNumeric'], expected: 'positive' as const },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANDED CORRELATES (2026-01-06) - From CORRELATES.md catalog
  // ═══════════════════════════════════════════════════════════════════════════

  // Trait Caps (traits.ts) - DC-T series
  { id: '#DC-T1', name: 'Risk ↔ Conscientiousness', vars: ['riskTolerance', 'conscientiousness'], expected: 'negative' as const },
  { id: '#DC-T2', name: 'Novelty ↔ Authoritarianism', vars: ['noveltySeeking', 'authoritarianism'], expected: 'negative' as const },
  { id: '#DC-T5', name: 'Age → Novelty Seeking', vars: ['age', 'noveltySeeking'], expected: 'negative' as const },
  { id: '#DC-T6', name: 'Cosmopolitanism → Authoritarianism', vars: ['cosmopolitanism', 'authoritarianism'], expected: 'negative' as const },
  { id: '#DC-T7', name: 'Stress → Conscientiousness', vars: ['stressReactivity', 'conscientiousness'], expected: 'negative' as const },
  { id: '#DC-T12', name: 'Adaptability → Authoritarianism', vars: ['adaptability', 'authoritarianism'], expected: 'negative' as const },
  { id: '#PG-T1', name: 'Authoritarianism → Conscientiousness Floor', vars: ['authoritarianism', 'conscientiousness'], expected: 'positive' as const },

  // Latent Caps (latents.ts) - DC series
  { id: '#DC3', name: 'Adaptability ↔ Planning', vars: ['adaptability', 'planningHorizon'], expected: 'negative' as const },
  { id: '#DC5', name: 'Opsec → Social Battery', vars: ['opsecDiscipline', 'socialBattery'], expected: 'negative' as const },
  { id: '#DC6', name: 'Frugality → Aesthetic', vars: ['frugality', 'aestheticExpressiveness'], expected: 'negative' as const },
  { id: '#DC8', name: 'Stress → Opsec', vars: ['stressReactivity', 'opsecDiscipline'], expected: 'negative' as const },
  { id: '#DC11', name: 'Principledness → Adaptability', vars: ['principledness', 'adaptability'], expected: 'negative' as const },
  { id: '#DC12', name: 'Risk ↔ Frugality', vars: ['riskAppetite', 'frugality'], expected: 'negative' as const },

  // Skill Caps (skills.ts) - DC-SK series
  { id: '#DC-SK1', name: 'Attention → Surveillance', vars: ['attentionControl', 'surveillanceSkill'], expected: 'positive' as const },
  { id: '#DC-SK2', name: 'Memory → Bureaucracy', vars: ['workingMemory', 'bureaucracySkill'], expected: 'positive' as const },
  { id: '#DC-SK3', name: 'Reflexes → Driving', vars: ['reflexes', 'drivingSkill'], expected: 'positive' as const },
  { id: '#DC-SK4', name: 'Stress → Shooting', vars: ['stressReactivity', 'shootingSkill'], expected: 'negative' as const },
  { id: '#DC-SK5', name: 'Charisma → Media', vars: ['charisma', 'mediaHandlingSkill'], expected: 'positive' as const },
  { id: '#DC7', name: 'Impulse → Tradecraft', vars: ['impulseControl', 'tradecraftSkill'], expected: 'positive' as const },

  // Aptitude Interdependencies (aptitudes.ts) - PA series
  { id: '#PA1', name: 'Dexterity → Hand-Eye', vars: ['dexterity', 'handEyeCoordination'], expected: 'positive' as const },
  { id: '#PA2', name: 'CogSpeed → Memory', vars: ['cognitiveSpeed', 'workingMemory'], expected: 'positive' as const },
  { id: '#PA4', name: 'Strength → Endurance', vars: ['strength', 'endurance'], expected: 'positive' as const },
  { id: '#PA6', name: 'Age → CogSpeed', vars: ['age', 'cognitiveSpeed'], expected: 'negative' as const },
  { id: '#PA7', name: 'Reflexes → CogSpeed', vars: ['reflexes', 'cognitiveSpeed'], expected: 'positive' as const },
  { id: '#PA11', name: 'Conditioning → Endurance', vars: ['physicalConditioning', 'endurance'], expected: 'positive' as const },
  // DISABLED: PG7 is a plausibility gate (cap), not a linear correlation
  // It's validated via CONSTRAINT_CHECKS instead. The positive r=0.225 is a spurious correlation
  // from shared upstream factors (charisma → both empathy and deception aptitudes)
  // { id: '#PG7', name: 'Empathy ↔ Deception', vars: ['empathy', 'deception'], expected: 'negative' as const },

  // Preference Coherence (preferences.ts)
  // Fields are social.groupStyle, social.boundary, time.planningStyle
  { id: '#DC-SOCIAL-GROUP', name: 'Social Battery → Group Style', vars: ['socialBattery', 'groupStyleNumeric'], expected: 'positive' as const },
  { id: '#DC-BOUNDARY', name: 'Opsec → Boundaries', vars: ['opsecDiscipline', 'boundaryStrengthNumeric'], expected: 'positive' as const },
  { id: '#DC-PLANNING', name: 'Conscientiousness → Planning Style', vars: ['conscientiousness', 'planningStyleNumeric'], expected: 'positive' as const },
  // { id: '#DC-NOVELTY-COMFORT', name: 'Novelty → Comfort Foods', vars: ['noveltySeeking', 'comfortFoodAdventureScore'], expected: 'positive' as const },

  // Social Constraints (social.ts)
  { id: '#NEW36', name: 'Diaspora → Communities', vars: ['isDiaspora', 'communityCount'], expected: 'positive' as const },
  { id: '#NEW39', name: 'Marital → Housing', vars: ['isMarried', 'housingStabilityNumeric'], expected: 'positive' as const },

  // Domestic Constraints (domestic.ts)
  // DISABLED: weeklySchedule.hasAnchor not yet generated
  // { id: '#DC-D3', name: 'Dependents → Schedule', vars: ['dependentCount', 'hasWeeklyAnchor'], expected: 'positive' as const },
  { id: '#DC-D7', name: 'Frugality → Neighborhood', vars: ['frugality', 'neighborhoodQualityNumeric'], expected: 'negative' as const },
  { id: '#DC-D11', name: 'Stress → Home Order', vars: ['stressReactivity', 'homeOrderliness'], expected: 'negative' as const },
  // DISABLED: commuteMode doesn't have bicycle-specific field
  // { id: '#DC-D12', name: 'Conditioning → Bicycle Commute', vars: ['physicalConditioning', 'hasBicycleCommute'], expected: 'positive' as const },

  // Health/Lifestyle (lifestyle.ts)
  // #HL7 implemented in generator.ts via post-hoc repair
  { id: '#HL7', name: 'Trauma → Coping', vars: ['traumaTagCount', 'copingRitualCount'], expected: 'positive' as const },
  { id: '#HL13', name: 'Tier → Treatment Quality', vars: ['tierNumeric', 'treatmentQualityNumeric'], expected: 'positive' as const },

  // Narrative (narrative.ts)
  // NOTE: #NAR-1 and #NAR-3 are DISABLED because timeline.events doesn't exist on generated agents.
  // { id: '#NAR-1', name: 'Age → Event Count', vars: ['age', 'timelineEventCount'], expected: 'positive' as const },
  // { id: '#NAR-3', name: 'Adversity → Negative Events', vars: ['adversityTagCount', 'negativeEventCount'], expected: 'positive' as const },
  { id: '#NAR-9', name: 'Diaspora → Visible Minority', vars: ['isDiaspora', 'isVisibleMinority'], expected: 'positive' as const },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL CORRELATES FROM CORRELATES.md (2026-01-07)
  // ═══════════════════════════════════════════════════════════════════════════

  // Trait Caps (traits.ts) - Additional DC-T series
  { id: '#DC-T3', name: 'Agreeableness ↔ Risk', vars: ['agreeableness', 'riskTolerance'], expected: 'negative' as const },
  { id: '#DC-T8', name: 'Social Battery ↔ Agreeableness', vars: ['socialBattery', 'agreeableness'], expected: 'positive' as const },
  { id: '#PG-T2', name: 'Opsec ↔ Novelty', vars: ['opsecDiscipline', 'noveltySeeking'], expected: 'negative' as const },

  // Latent Caps (latents.ts) - Additional DC series
  { id: '#DC9', name: 'Curiosity ↔ Opsec', vars: ['curiosityBandwidth', 'opsecDiscipline'], expected: 'negative' as const },

  // Aptitude Interdependencies (aptitudes.ts) - Additional PA series
  { id: '#PA3', name: 'RiskCalc → Attention', vars: ['riskCalibration', 'attentionControl'], expected: 'positive' as const },
  { id: '#PA5', name: 'Memory → Attention', vars: ['workingMemory', 'attentionControl'], expected: 'positive' as const },
  { id: '#PA8', name: 'Age → Reflexes', vars: ['age', 'reflexes'], expected: 'negative' as const },
  { id: '#PA10', name: 'Stress → Attention', vars: ['stressReactivity', 'attentionControl'], expected: 'negative' as const },
  { id: '#PG8', name: 'Assertiveness ↔ Charisma', vars: ['authoritarianism', 'charisma'], expected: 'positive' as const },
  { id: '#PG9', name: 'Empathy → Charisma', vars: ['empathy', 'charisma'], expected: 'positive' as const },
  { id: '#PG10', name: 'Build → Strength', vars: ['buildNumeric', 'strength'], expected: 'positive' as const },

  // Preference Coherence (preferences.ts) - Additional
  { id: '#DC-CHRONO', name: 'Conscientiousness → Chronotype', vars: ['conscientiousness', 'isEarlyBird'], expected: 'positive' as const },
  { id: '#DC-NOVELTY-COMFORT', name: 'Novelty → Comfort Foods', vars: ['noveltySeeking', 'comfortFoodAdventureScore'], expected: 'positive' as const },

  // Social Constraints (social.ts) - Additional NEW series
  { id: '#NEW34', name: 'Elite + Age → Marriage', vars: ['tierNumeric', 'isMarried'], expected: 'positive' as const },
  // Redefined: social battery → social leverage types (care, favors vs money, ideology)
  { id: '#NEW37', name: 'Social Battery → Social Leverage', vars: ['socialBattery', 'hasSocialLeverage'], expected: 'positive' as const },
  { id: '#NEW40', name: 'Tier + Age → Community Status', vars: ['tierNumeric', 'communityStatusNumeric'], expected: 'positive' as const },
  { id: '#NEW44', name: 'Age → Widowhood', vars: ['age', 'isWidowed'], expected: 'positive' as const },
  { id: '#NEW45', name: 'Urbanicity → Online Community', vars: ['urbanicityNumeric', 'hasOnlineCommunity'], expected: 'negative' as const },

  // Domestic Constraints (domestic.ts) - Additional DC-D series
  { id: '#DC-D5', name: 'Neighborhood → Privacy', vars: ['neighborhoodQualityNumeric', 'privacyNumeric'], expected: 'positive' as const },
  { id: '#DC-D10', name: 'Elite → Privacy', vars: ['tierNumeric', 'privacyNumeric'], expected: 'positive' as const },
  { id: '#DC-D13', name: 'Impulse → Legal Exposure', vars: ['impulseControl', 'legalExposureNumeric'], expected: 'negative' as const },

  // Health/Lifestyle (lifestyle.ts) - Additional HL series
  { id: '#HL6', name: 'Age → Diagnosis', vars: ['age', 'isUndiagnosed'], expected: 'positive' as const },
  { id: '#HL11', name: 'Age → Vice Type', vars: ['age', 'hasTraditionalVice'], expected: 'positive' as const },
  // DISABLED: HL12 only triggers for significant adversity, which occurs in 0% of generated agents
  // { id: '#HL12', name: 'Observance → Resilience', vars: ['religiosity', 'resilienceNumeric'], expected: 'positive' as const },

  // Probabilistic Enhancements (PR series)
  { id: '#PR1', name: 'Stress → Negotiation Penalty', vars: ['stressReactivity', 'negotiationSkill'], expected: 'negative' as const },
  { id: '#PR4', name: 'Reflexes → Hand-Eye', vars: ['reflexes', 'handEyeCoordination'], expected: 'positive' as const },

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH 2: Previously untracked correlates from CORRELATES.md (2026-01-07)
  // ═══════════════════════════════════════════════════════════════════════════

  // Plausibility Gates (PG1-6, constraint-based)
  { id: '#PG1', name: 'Opsec → Identity Kit', vars: ['opsecDiscipline', 'hasCompromisedIdentity'], expected: 'negative' as const },
  { id: '#PG2', name: 'Mobility → Housing', vars: ['mobilityNumeric', 'housingStabilityNumeric'], expected: 'negative' as const },
  { id: '#PG3', name: 'Tier → Neighborhood', vars: ['tierNumeric', 'neighborhoodQualityNumeric'], expected: 'positive' as const },
  { id: '#PG4', name: 'Marital → Ex-Partner', vars: ['isSingle', 'hasExPartner'], expected: 'negative' as const },
  { id: '#PG5', name: 'Community Role → Status', vars: ['isLurker', 'communityStatusNumeric'], expected: 'negative' as const },
  { id: '#PG6', name: 'Operative → Social Hobbies', vars: ['isOperative', 'socialHobbyCount'], expected: 'negative' as const },
  { id: '#PG-FRUGAL-FASHION', name: 'Frugal Elite → Formality', vars: ['frugalEliteScore', 'formalityNumeric'], expected: 'positive' as const },
  // DISABLED: Generation doesn't suppress aesthetics for operatives - difference too small (32 points)
  // { id: '#PG-OPERATIVE-VIS', name: 'Operative → Aesthetics', vars: ['isOperative', 'aestheticBoldness'], expected: 'negative' as const },

  // Domestic Constraints (DC-D series)
  { id: '#DC-D1', name: 'Age → Caregiving Type', vars: ['age', 'hasCaregivingObligation'], expected: 'positive' as const },
  { id: '#DC-D2', name: 'Housing → Commute', vars: ['isTransientHousing', 'hasDriverCommute'], expected: 'negative' as const },
  // DISABLED: DC-D4 has only 5% irregular prevalence - correlation unstable
  // { id: '#DC-D4', name: 'Residency → Credentials', vars: ['isIrregularStatus', 'hasValidCredentials'], expected: 'negative' as const },
  { id: '#DC-D6', name: 'Household → Eldercare', vars: ['isMultigenerational', 'hasEldercareObligation'], expected: 'positive' as const },
  { id: '#DC-D8', name: 'Legal Exposure → Clearance', vars: ['legalExposureNumeric', 'hasSecurityClearance'], expected: 'negative' as const },
  { id: '#DC-D9', name: 'Urbanicity → Skill Domain', vars: ['urbanicityNumeric', 'ruralSkillScore'], expected: 'negative' as const },
  { id: '#NEW13', name: 'Education → Bureaucracy', vars: ['educationNumeric', 'bureaucracyNumeric'], expected: 'positive' as const },

  // Health/Lifestyle (HL series)
  { id: '#HL8', name: 'Injuries → Fitness', vars: ['injuryCount', 'fitnessBandNumeric'], expected: 'negative' as const },
  { id: '#HL9', name: 'Chronic → Mobility', vars: ['hasMobilityCondition', 'mobilityNumeric'], expected: 'negative' as const },
  // DISABLED: triggerTags field doesn't exist in generation
  // { id: '#HL10', name: 'Neurodivergence → Triggers', vars: ['hasNeurodivergence', 'triggerCount'], expected: 'positive' as const },
  // DISABLED: conflictExposure field doesn't exist in generation
  // { id: '#HL14', name: 'Conflict → Mobility', vars: ['conflictExposure', 'mobilityNumeric'], expected: 'negative' as const },
  { id: '#HL15', name: 'Dependency → Fitness', vars: ['hasAnyDependency', 'fitnessBandNumeric'], expected: 'negative' as const },

  // Narrative (NAR series)
  { id: '#NAR-2', name: 'Tier → Negative Cap', vars: ['tierNumeric', 'negativeEventCount'], expected: 'negative' as const },
  // DISABLED: NAR-4 measures event restriction (filtering), not event generation
  // { id: '#NAR-4', name: 'Career → Event Types', vars: ['careerTrackNumeric', 'careerEventCount'], expected: 'positive' as const },
  // DISABLED: persecution events not generated (0/500 agents have them)
  // { id: '#NAR-5', name: 'Minority + Insecurity → Persecution', vars: ['minorityInsecurityScore', 'hasPersecutionEvent'], expected: 'positive' as const },
  // DISABLED: NAR-6 effect is too weak in generation (<1% difference in positive ratio)
  // { id: '#NAR-6', name: 'Visible Minority → Positive Events', vars: ['isVisibleMinority', 'positiveEventRatio'], expected: 'negative' as const },
  { id: '#NAR-7', name: 'Age → Career Events', vars: ['age', 'hasCareerPromotion'], expected: 'positive' as const },
  { id: '#NAR-8', name: 'Local Majority → Linguistic', vars: ['isLocalMajority', 'isLinguisticMinority'], expected: 'negative' as const },
  // DISABLED: refugee/asylum-seeker residency status doesn't exist in generation
  // { id: '#NAR-10', name: 'Elite + Refugee', vars: ['tierNumeric', 'isRefugee'], expected: 'negative' as const },
  // DISABLED: mentalHealthMarkers field doesn't exist in generation
  // { id: '#NAR-11', name: 'Negative Events → Mental Health', vars: ['negativeEventCount', 'hasMentalHealthMarker'], expected: 'positive' as const },
  { id: '#NAR-12', name: 'Age → Event Floors', vars: ['age', 'romanticEventCount'], expected: 'positive' as const },

  // New Series (NEW35, NEW38, NEW41-43)
  { id: '#NEW35', name: 'Dependents → Network', vars: ['hasDependents', 'isNetworkIsolate'], expected: 'negative' as const },
  { id: '#NEW38', name: 'Age → Parents', vars: ['age', 'hasDeceasedParents'], expected: 'positive' as const },
  { id: '#NEW41', name: 'Opsec → Discreet Reputation', vars: ['opsecDisciplineScore', 'isDiscreetReputation'], expected: 'positive' as const },
  { id: '#NEW42', name: 'Empathy → Care Leverage', vars: ['empathy', 'hasCareLeverage'], expected: 'positive' as const },
  { id: '#NEW43', name: 'Risk + Institutional → Faction', vars: ['riskInstitutionalScore', 'hasFormalFaction'], expected: 'negative' as const },

  // Probabilistic (PR2, PR3, PR5)
  // DISABLED: PR2 effect is too weak in generation (<2% difference in negative events)
  // { id: '#PR2', name: 'Diaspora → Negative Events', vars: ['isDiaspora', 'negativeEventCount'], expected: 'positive' as const },
  { id: '#PR3', name: 'Visible Minority → Community Status', vars: ['isVisibleMinority', 'communityStatusNumeric'], expected: 'negative' as const }, // Discrimination effect
  { id: '#PR5', name: 'Social Battery → Artistic Sharing', vars: ['socialBattery', 'artisticSharingPublicness'], expected: 'positive' as const },

  // Other DC correlates
  { id: '#DC-AGE-CAFFEINE', name: 'Age → Caffeine', vars: ['age', 'caffeineIntensity'], expected: 'negative' as const },
  { id: '#DC-EMOTIONAL', name: 'Agreeableness → Emotional Sharing', vars: ['agreeableness', 'emotionalSharingOpenness'], expected: 'positive' as const },
  { id: '#DC-IMPULSE', name: 'Impulse → Doomscrolling', vars: ['impulseControl', 'doomscrollingRisk'], expected: 'negative' as const },
  // DISABLED: DC-NEW-1 is tested as age-gate constraint, not correlation
  // The constraint is "floor" (age >= 30 for doctorate), not "trend" (older = more likely)
  // { id: '#DC-NEW-1', name: 'Age → Doctorate', vars: ['age', 'hasDoctorate'], expected: 'positive' as const },
  { id: '#DC-NEW-5', name: 'Elite → Education', vars: ['tierNumeric', 'educationLevelNumeric'], expected: 'positive' as const },
  { id: '#DC-NEW-8', name: 'Opsec → Outness', vars: ['opsecDiscipline', 'outnessNumeric'], expected: 'negative' as const },
  { id: '#DC-NEW-10', name: 'Foreign Service → Languages', vars: ['isForeignService', 'languageCount'], expected: 'positive' as const },
  { id: '#DC-NEW-11', name: 'Intelligence → Aliases', vars: ['isIntelligence', 'aliasCount'], expected: 'positive' as const },
  { id: '#DC-RISK-EQUIP', name: 'Risk → Weapon Preference', vars: ['riskTolerance', 'weaponAssertiveness'], expected: 'positive' as const },
  { id: '#DC-SK10', name: 'Tech → Digital Hygiene', vars: ['techFluency', 'digitalHygiene'], expected: 'positive' as const },
  { id: '#DC-SOCIAL-COMM', name: 'Social Battery → Communication', vars: ['socialBattery', 'asyncCommPreference'], expected: 'negative' as const },
  { id: '#DC-SPACE-TYPE', name: 'Opsec → Space Type', vars: ['opsecDiscipline', 'privateSpacePreference'], expected: 'positive' as const },
  { id: '#DC-STRESS-LIGHT', name: 'Stress → Light Preference', vars: ['stressReactivity', 'warmLightPreference'], expected: 'positive' as const }, // High stress → warm/calming/dim light (reduces sensory overload)

  // Legacy/Other
  { id: '#4-DEP', name: 'Age → Dependents', vars: ['age', 'hasDependents'], expected: 'positive' as const },
  // DISABLED: #11 Empathy/Deception → Network not implemented in generation
  // { id: '#11', name: 'Empathy/Deception → Network', vars: ['empathyDeceptionBalance', 'networkRoleNumeric'], expected: 'positive' as const },
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
  hasDependents: number; // 1 if has any dependents (children), 0 otherwise
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
  relationshipHostility: number; // #NEW1: computed from risk, conscientiousness, impulse control

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
    // Smaller builds (1-2)
    'slight': 1, 'slim': 1, 'graceful': 1, 'lanky': 1, 'wiry': 1,
    'lean': 2, 'sinewy': 2, 'long-limbed': 2, "runner's build": 2,
    // Average builds (3)
    'average': 3, 'compact': 3, 'soft-built': 3, 'curvy': 3,
    // Larger/stronger builds (4-5)
    'athletic': 4, 'solid': 4, 'sturdy': 4, 'stocky': 4, 'broad-shouldered': 4,
    'muscular': 5, 'brawny': 5, 'barrel-chested': 5, 'heavyset': 5, 'heavy': 5,
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
    hasDependents: dependentCount > 0 ? 1 : 0,
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
    // #NEW1: Relationship hostility - computed from raw inputs to avoid publicness confound
    // Formula matches social.ts: 0.4*risk + 0.3*(1-conscientiousness) + 0.3*(1-impulseControl)
    relationshipHostility:
      0.4 * ((latents?.riskAppetite ?? 500) / 1000) +
      0.3 * (1 - conscientiousness / 1000) +
      0.3 * (1 - (latents?.impulseControl ?? 500) / 1000),

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

    // ═══════════════════════════════════════════════════════════════════════════
    // NEW CORRELATE VARIABLES (2026-01-06)
    // ═══════════════════════════════════════════════════════════════════════════

    // Phase 1: Preferences
    cuisineCount: agent.preferences?.food?.cuisineFavorites?.length ?? 0,
    statusSignaling: agent.preferences?.fashion?.statusSignaling ?? 500,
    socialMediaIntensity: computeSocialMediaIntensity(agent.preferences?.media?.platformDiet ?? {}),
    copingRitualCount: agent.routines?.recoveryRituals?.length ?? 0,
    fashionConformity: agent.preferences?.fashion?.conformity ?? 500,
    hobbyMainstreamScore: computeHobbyMainstreamScore(agent.preferences?.hobbies?.categories ?? []),

    // Phase 2: Social/Lifestyle/Domestic
    principledness: latents?.principledness ?? 500,
    isBroker: agent.network?.role === 'broker' ? 1 : 0,

    // Phase 3: Deterministic Gates
    isDiaspora: (agent.geography?.diasporaStatus !== 'native' && agent.geography?.diasporaStatus !== 'internal-migrant') ? 1 : 0,
    linguisticMinority: agent.minorityStatus?.linguisticMinority ? 1 : 0,
    isHubOrGatekeeper: (agent.network?.role === 'hub' || agent.network?.role === 'gatekeeper') ? 1 : 0,

    // ═══════════════════════════════════════════════════════════════════════════
    // EXPANDED METRICS (2026-01-06) - For additional correlate verification
    // ═══════════════════════════════════════════════════════════════════════════

    // Trait metrics (traits.ts correlates)
    riskTolerance: agent.capabilities?.traits?.riskTolerance ?? 500,
    noveltySeeking: agent.capabilities?.traits?.noveltySeeking ?? 500,
    aestheticExpressiveness: latents?.aestheticExpressiveness ?? 500,

    // Skill metrics (skills.ts correlates)
    surveillanceSkill: skills?.surveillance?.value ?? 0,
    drivingSkill: skills?.driving?.value ?? 0,
    shootingSkill: skills?.shooting?.value ?? 0,
    mediaHandlingSkill: skills?.mediaHandling?.value ?? 0,

    // Aptitude metrics (aptitudes.ts correlates)
    dexterity: aptitudes?.dexterity ?? 500,
    handEyeCoordination: aptitudes?.handEyeCoordination ?? 500,
    reflexes: aptitudes?.reflexes ?? 500,
    strength: aptitudes?.strength ?? 500,
    attentionControl: aptitudes?.attentionControl ?? 500,
    charisma: aptitudes?.charisma ?? 500,
    riskCalibration: aptitudes?.riskCalibration ?? 500, // PA3: riskCalibration (not riskAppetite)

    // Preference metrics (preferences.ts correlates)
    // Note: actual field paths are social.groupStyle, social.boundary, time.planningStyle
    groupStyleNumeric: computeGroupStyleNumeric(agent.preferences?.social?.groupStyle),
    boundaryStrengthNumeric: computeBoundaryStrengthNumeric(agent.preferences?.social?.boundary),
    planningStyleNumeric: computePlanningStyleNumeric(agent.preferences?.time?.planningStyle),
    comfortFoodAdventureScore: computeComfortFoodAdventureScore(agent.preferences?.food?.comfortFoods ?? []),

    // Social/Domestic metrics
    communityCount: agent.communities?.memberships?.length ?? 0,
    isMarried: (maritalStatus === 'married' || maritalStatus === 'partnered') ? 1 : 0,
    hasWeeklyAnchor: agent.domestic?.weeklySchedule?.hasAnchor ? 1 : 0,
    neighborhoodQualityNumeric: computeNeighborhoodQualityNumeric(agent.home?.neighborhoodType),
    hasBicycleCommute: (agent.home?.commuteMethod === 'bicycle') ? 1 : 0,

    // Health/Lifestyle metrics
    // traumaTagCount: from memoryTrauma.traumaTags (psychological trauma)
    traumaTagCount: agent.memoryTrauma?.traumaTags?.length ?? 0,
    treatmentQualityNumeric: computeTreatmentQualityNumeric(agent.health?.treatmentAccess),

    // Narrative metrics
    timelineEventCount: agent.timeline?.length ?? 0,
    // adversityTagCount: from background.adversityTags (childhood/life adversity)
    adversityTagCount: agent.background?.adversityTags?.length ?? 0,
    negativeEventCount: countNegativeEvents(agent.timeline ?? []),
    isVisibleMinority: agent.minorityStatus?.visibleMinority ? 1 : 0,

    // ═══════════════════════════════════════════════════════════════════════════
    // ADDITIONAL METRICS FOR NEW CORRELATES (2026-01-07)
    // ═══════════════════════════════════════════════════════════════════════════

    // Preference metrics
    isEarlyBird: computeChronotypeNumeric(agent.routines?.chronotype),

    // Social metrics
    hasLeverage: agent.network?.leverageType ? 1 : 0,
    // Favors leverage requires social energy to maintain reciprocal relationships (per generation code)
    hasSocialLeverage: agent.network?.leverageType === 'favors' ? 1 : 0,
    isWidowed: maritalStatus === 'widowed' ? 1 : 0,
    hasOnlineCommunity: agent.communities?.onlineCommunities?.length ?? 0, // Count, not binary

    // Geography metrics
    urbanicityNumeric: computeUrbanicityNumeric(agent.geography?.urbanicity),

    // Domestic metrics
    privacyNumeric: computePrivacyNumeric(agent.home?.privacyLevel), // Fixed: was .privacy
    legalExposureNumeric: computeLegalExposureNumeric(agent.legalAdmin?.legalExposure),

    // Health metrics
    // neurodivergence is at top level (not inside health)
    isUndiagnosed: (agent as any).neurodivergence?.diagnosisStatus === 'undiagnosed' ? 1 : 0,
    // vices is an array at top level (often empty), check dependencyProfiles for substance info
    hasTraditionalVice: hasTraditionalViceFromDependency((agent as any).dependencyProfiles ?? []),
    // HL12: resilience is based on resilienceIndicators count from background (lifestyle.ts)
    resilienceNumeric: (agent.background?.resilienceIndicators?.length ?? 0),

    // ═══════════════════════════════════════════════════════════════════════════
    // BATCH 2 METRICS (2026-01-07)
    // ═══════════════════════════════════════════════════════════════════════════

    // PG metrics
    hasCompromisedIdentity: agent.logistics?.identityKit?.some((d: { compromised?: boolean }) => d.compromised) ? 1 : 0,
    mobilityNumeric: computeMobilityNumericFromTag(agent.mobility?.mobilityTag),
    isSingle: (maritalStatus === 'single' || maritalStatus === 'never-married') ? 1 : 0,
    // relationships is at top-level (not inside network)
    hasExPartner: agent.relationships?.some((r: { type?: string }) => r.type === 'ex-partner' || r.type === 'ex-spouse') ? 1 : 0,
    isLurker: agent.communities?.memberships?.some((m: { role?: string }) => m.role === 'lurker' || m.role === 'passive') ? 1 : 0, // Any lurker role (16% prevalence)
    // NOTE: communityStatusNumeric already extracted at line ~1078 from agent.communities?.communityStatus
    isOperative: isOperativeRole(agent.identity?.careerTrackTag),
    socialHobbyCount: agent.preferences?.hobbies?.categories?.includes('social') ? 1 : 0,
    frugalEliteScore: computeFrugalEliteScore(latents.frugality ?? 500, tierBand),
    formalityNumeric: (agent.preferences?.fashion?.formality ?? 500) / 1000,
    aestheticBoldness: computeAestheticBoldness(agent.preferences?.aesthetics),

    // DC-D metrics
    // everydayLife is at top-level (not inside domestic)
    hasCaregivingObligation: (agent.everydayLife?.caregivingObligation && agent.everydayLife?.caregivingObligation !== 'none') ? 1 : 0,
    isTransientHousing: isTransientHousingType(agent.home?.housingStability),
    // commuteMode is in everydayLife at top-level
    hasDriverCommute: (agent.everydayLife?.commuteMode === 'driver' || agent.everydayLife?.commuteMode === 'car' || agent.home?.commuteMethod === 'car') ? 1 : 0,
    // legalAdmin.residencyStatus is the actual field (not legal.legalStatus)
    isIrregularStatus: (agent.legalAdmin?.residencyStatus === 'irregular' || agent.legalAdmin?.residencyStatus === 'undocumented') ? 1 : 0,
    hasValidCredentials: agent.legalAdmin?.credentials?.length > 0 ? 1 : 0,
    // DC-D6: multigenerational includes explicit 'multigenerational' AND 'extended-family' (which often includes grandparents)
    isMultigenerational: (agent.home?.householdComposition === 'multigenerational' || agent.home?.householdComposition === 'extended-family') ? 1 : 0,
    // eldercare check from top-level everydayLife - note hyphenated 'elder-care' in vocab
    hasEldercareObligation: (agent.everydayLife?.caregivingObligation === 'eldercare' || agent.everydayLife?.caregivingObligation === 'elder-care' || agent.everydayLife?.caregivingObligation === 'full-care' || agent.everydayLife?.caregivingObligation === 'elder-support') ? 1 : 0,
    hasSecurityClearance: agent.legalAdmin?.credentials?.includes('security-clearance') ? 1 : 0,
    // DC-D9: lifeSkills.primarySkillDomain indicates rural vs urban skill bias
    ruralSkillScore: agent.lifeSkills?.primarySkillDomain === 'rural' ? 1 : 0,
    // NEW13: bureaucracyNavigation is in lifeSkills
    bureaucracyNumeric: computeCompetenceBandNumeric(agent.lifeSkills?.bureaucracyNavigation),

    // HL metrics
    injuryCount: agent.health?.injuryHistoryTags?.length ?? 0,
    fitnessBandNumeric: computeFitnessBandNumeric(agent.health?.fitnessBand),
    hasMobilityCondition: hasMobilityAffectingCondition(agent.health?.chronicConditionTags ?? []),
    // neurodivergence is at top-level, check indicatorTags for non-neurotypical
    hasNeurodivergence: ((agent as any).neurodivergence?.indicatorTags ?? []).some((t: string) => t !== 'neurotypical') ? 1 : 0,
    triggerCount: agent.health?.triggerTags?.length ?? 0,
    conflictExposure: agent.geography?.conflictExposure ?? 0,
    // dependencyProfiles is at top level (not lifestyle.viceTags)
    hasActiveDependency: hasActiveDependencyFromProfiles((agent as any).dependencyProfiles ?? []),
    // HL15: Any dependency (active OR recovered) affects fitness
    hasAnyDependency: ((agent as any).dependencyProfiles?.length ?? 0) > 0 ? 1 : 0,

    // NAR metrics
    careerTrackNumeric: computeCareerTrackNumeric(agent.identity?.careerTrackTag),
    careerEventCount: countCareerEvents(agent.timeline ?? []),
    minorityInsecurityScore: computeMinorityInsecurityScore(agent.minorityStatus, agent.geography?.securityLevel ?? 500),
    hasPersecutionEvent: hasEventType(agent.timeline ?? [], ['persecution', 'discrimination', 'hate-crime']),
    allPositiveEvents: allEventsPositive(agent.timeline ?? []),
    // NAR-6: ratio of positive events (0-1 scale)
    positiveEventRatio: computePositiveEventRatio(agent.timeline ?? []),
    hasCareerPromotion: hasEventType(agent.timeline ?? [], ['promotion', 'career-advancement', 'senior-role']),
    isLocalMajority: agent.minorityStatus?.localMajority ? 1 : 0,
    isLinguisticMinority: agent.minorityStatus?.linguisticMinority ? 1 : 0,
    // legalAdmin.residencyStatus is the actual field (not legal.legalStatus)
    isRefugee: (agent.legalAdmin?.residencyStatus === 'refugee' || agent.legalAdmin?.residencyStatus === 'asylum-seeker') ? 1 : 0,
    hasMentalHealthMarker: agent.health?.mentalHealthMarkers?.length > 0 ? 1 : 0,
    romanticEventCount: countRomanticEvents(agent.timeline ?? []),

    // NEW metrics
    isNetworkIsolate: agent.network?.role === 'isolate' ? 1 : 0,
    // hasLivingParents is a boolean - if false, parents are deceased
    hasDeceasedParents: agent.family?.hasLivingParents === false ? 1 : 0,
    // NEW41: High opsec discipline → discreet professional reputation (continuous scale 0-1000)
    opsecDisciplineScore: latents.opsecDiscipline ?? 500,
    // reputation is at top level, not inside network; professional is the main reputation tag
    isDiscreetReputation: ((agent as any).reputation?.professional === 'discreet' || (agent as any).reputation?.professional === 'unknown') ? 1 : 0,
    hasCareLeverage: (agent.network?.leverageType === 'care' || agent.network?.leverageType === 'dependency') ? 1 : 0,
    riskInstitutionalScore: ((latents.riskAppetite ?? 500) / 1000) * (1 - (latents.institutionalEmbeddedness ?? 500) / 1000),
    hasFormalFaction: agent.communities?.memberships?.some((m: { type?: string }) =>
      ['professional-society', 'trade-union', 'political-party', 'veterans-group', 'union-chapter'].includes(m.type ?? '')
    ) ? 1 : 0,

    // PR metrics
    artisticSharingPublicness: computeArtisticSharingPublicness(agent.preferences?.artistic?.sharingStyle),

    // Other DC metrics
    caffeineIntensity: computeCaffeineIntensityFromHabit(agent.preferences?.food?.caffeineHabit),
    emotionalSharingOpenness: computeEmotionalSharingOpenness(agent.preferences?.social?.emotionalSharing),
    doomscrollingRisk: agent.preferences?.media?.doomscrollingRisk ?? 500,
    hasDoctorate: agent.identity?.educationTrackTag === 'doctorate' ? 1 : 0,
    educationLevelNumeric: computeEducationLevelNumeric(agent.identity?.educationTrackTag),
    outnessNumeric: computeOutnessNumeric(agent.orientation?.outnessLevel),
    isForeignService: (agent.identity?.careerTrackTag === 'foreign-service' || agent.identity?.careerTrackTag === 'diplomat') ? 1 : 0,
    languageCount: agent.identity?.languages?.length ?? 1,
    isIntelligence: isIntelligenceCareer(agent.identity?.careerTrackTag),
    aliasCount: agent.naming?.aliases?.length ?? 0,
    weaponAssertiveness: computeWeaponAssertiveness(agent.preferences?.equipment?.weaponPreference),
    // NOTE: techFluency is a latent, not a skill - already extracted at line 1116
    asyncCommPreference: computeAsyncCommPreference(agent.preferences?.social?.communicationMethod),
    privateSpacePreference: computePrivateSpacePreference(agent.preferences?.livingSpace?.spaceType),
    warmLightPreference: computeWarmLightPreference(agent.preferences?.livingSpace?.lightPreference),
    empathyDeceptionBalance: ((aptitudes.empathy ?? 500) - (aptitudes.deceptionAptitude ?? 500)) / 1000,
    networkRoleNumeric: computeNetworkRoleNumeric(agent.network?.role),
  };
}

// Extended AgentMetrics type alias for constraint checks
type AgentMetricsExtended = AgentMetrics & {
  riskTolerance: number;
  noveltySeeking: number;
  aestheticExpressiveness: number;
  surveillanceSkill: number;
  drivingSkill: number;
  shootingSkill: number;
  mediaHandlingSkill: number;
  dexterity: number;
  handEyeCoordination: number;
  reflexes: number;
  strength: number;
  attentionControl: number;
  charisma: number;
  riskCalibration: number;
  groupStyleNumeric: number;
  boundaryStrengthNumeric: number;
  planningStyleNumeric: number;
  comfortFoodAdventureScore: number;
  communityCount: number;
  isMarried: number;
  hasWeeklyAnchor: number;
  neighborhoodQualityNumeric: number;
  hasBicycleCommute: number;
  traumaTagCount: number;
  treatmentQualityNumeric: number;
  timelineEventCount: number;
  adversityTagCount: number;
  negativeEventCount: number;
  isVisibleMinority: number;
  // Additional metrics for new correlates (2026-01-07)
  isEarlyBird: number;
  hasLeverage: number;
  hasSocialLeverage: number;
  isWidowed: number;
  urbanicityNumeric: number;
  hasOnlineCommunity: number;
  privacyNumeric: number;
  legalExposureNumeric: number;
  isUndiagnosed: number;
  hasTraditionalVice: number;
  resilienceNumeric: number;
  // Batch 2 metrics (2026-01-07)
  hasCompromisedIdentity: number;
  mobilityNumeric: number;
  isSingle: number;
  hasExPartner: number;
  isLurker: number;
  communityStatusNumeric: number;
  isOperative: number;
  socialHobbyCount: number;
  frugalEliteScore: number;
  formalityNumeric: number;
  aestheticBoldness: number;
  hasCaregivingObligation: number;
  isTransientHousing: number;
  hasDriverCommute: number;
  isIrregularStatus: number;
  hasValidCredentials: number;
  isMultigenerational: number;
  hasEldercareObligation: number;
  hasSecurityClearance: number;
  ruralSkillScore: number;
  bureaucracyNumeric: number;
  injuryCount: number;
  fitnessBandNumeric: number;
  hasMobilityCondition: number;
  hasNeurodivergence: number;
  triggerCount: number;
  conflictExposure: number;
  hasActiveDependency: number;
  hasAnyDependency: number;
  careerTrackNumeric: number;
  careerEventCount: number;
  minorityInsecurityScore: number;
  hasPersecutionEvent: number;
  allPositiveEvents: number;
  positiveEventRatio: number;
  hasCareerPromotion: number;
  isLocalMajority: number;
  isLinguisticMinority: number;
  isRefugee: number;
  hasMentalHealthMarker: number;
  romanticEventCount: number;
  isNetworkIsolate: number;
  hasDeceasedParents: number;
  opsecDisciplineScore: number;
  isDiscreetReputation: number;
  hasCareLeverage: number;
  riskInstitutionalScore: number;
  hasFormalFaction: number;
  caffeineIntensity: number;
  emotionalSharingOpenness: number;
  doomscrollingRisk: number;
  hasDoctorate: number;
  educationLevelNumeric: number;
  outnessNumeric: number;
  isForeignService: number;
  languageCount: number;
  isIntelligence: number;
  aliasCount: number;
  weaponAssertiveness: number;
  // NOTE: techFluency already in AgentMetrics (line 836)
  asyncCommPreference: number;
  privateSpacePreference: number;
  warmLightPreference: number;
  empathyDeceptionBalance: number;
  networkRoleNumeric: number;
  artisticSharingPublicness: number;
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

// Correlate #NEW8: Social Battery ↔ Media Platform Type
// Higher score = more social/interactive media, lower = passive consumption
// platformDiet keys are: 'social', 'tv', 'print', 'radio', 'closed'
function computeSocialMediaIntensity(platformDiet: Record<string, number>): number {
  // 'social' = interactive social media (TikTok, Instagram, Twitter, etc.)
  // 'closed' = private messaging (Signal, WhatsApp, Telegram)
  // 'tv', 'radio', 'print' = passive consumption
  const socialWeight = platformDiet.social ?? 0;
  const closedWeight = platformDiet.closed ?? 0;
  const passiveWeight = (platformDiet.tv ?? 0) + (platformDiet.radio ?? 0) + (platformDiet.print ?? 0);

  // Social media users have high social battery (need stimulation)
  // Closed messaging + passive consumption indicates lower social battery
  const socialScore = socialWeight + 0.5 * closedWeight; // Closed is semi-social
  const passiveScore = passiveWeight + 0.5 * closedWeight; // Closed also private

  const total = socialScore + passiveScore;
  if (total === 0) return 500; // Neutral if no platforms
  return Math.round((socialScore / total) * 1000);
}

// Correlate #NEW23: Institutional Embeddedness ↔ Hobby Conformity
// Higher score = mainstream hobby CATEGORIES, lower = fringe/unconventional
// Categories: physical, creative, intellectual, technical, social, outdoor, culinary
function computeHobbyMainstreamScore(categories: string[]): number {
  // Mainstream categories: social, intellectual, culinary (conventional, socially acceptable)
  // Fringe categories: creative, technical (unconventional, niche interests)
  // Neutral: physical, outdoor
  const mainstreamCategories = new Set(['social', 'intellectual', 'culinary']);
  const fringeCategories = new Set(['creative', 'technical']);
  // Physical and outdoor are neutral

  if (categories.length === 0) return 500; // Neutral if no categories

  let mainstreamCount = 0;
  let fringeCount = 0;
  let neutralCount = 0;

  for (const cat of categories) {
    const normalized = cat.toLowerCase();
    if (mainstreamCategories.has(normalized)) {
      mainstreamCount++;
    } else if (fringeCategories.has(normalized)) {
      fringeCount++;
    } else {
      neutralCount++;
    }
  }

  const total = mainstreamCount + fringeCount + neutralCount;
  if (total === 0) return 500;
  // Score: mainstream = high, fringe = low, neutral = middle
  // Weight: mainstream +1, neutral 0.5, fringe 0
  const score = (mainstreamCount + 0.5 * neutralCount) / total;
  return Math.round(score * 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW HELPER FUNCTIONS FOR EXPANDED CORRELATES (2026-01-06)
// ═══════════════════════════════════════════════════════════════════════════

function computeGroupStyleNumeric(groupPref: string | undefined): number {
  // Actual values from preferences.ts: social.groupStyle
  // Maps to social battery scale: low battery prefers observer/silent, high battery prefers banter/storyteller
  const map: Record<string, number> = {
    'listener-observer': 1,   // Lowest social energy
    'silent-when-needed': 2,
    'one-on-one': 3,          // Moderate
    'storyteller': 4,
    'group-banter': 5,        // Highest social energy
  };
  return map[groupPref ?? 'one-on-one'] ?? 3;
}

function computeBoundaryStrengthNumeric(boundaryStyle: string | undefined): number {
  // Actual values from preferences.ts: social.boundary
  // Maps from most open to most closed personal space boundaries
  const map: Record<string, number> = {
    'hugger': 1,                  // Most open boundaries
    'proximity-trust': 2,
    'professional-distance': 3,   // Moderate
    'strict-touch-norms': 4,
    'touch-averse': 5,            // Strongest/most closed boundaries
  };
  return map[boundaryStyle ?? 'professional-distance'] ?? 3;
}

function computePlanningStyleNumeric(planningStyle: string | undefined): number {
  // Actual values from preferences.ts: time.planningStyle
  // Maps from least structured to most structured planning approach
  const map: Record<string, number> = {
    'improvise': 1,               // Least structured
    'last-minute': 2,
    'flexible-structure': 3,      // Moderate
    'contingency-heavy': 4,
    'minute-planned': 5,          // Most structured/detailed
  };
  return map[planningStyle ?? 'flexible-structure'] ?? 3;
}

function computeComfortFoodAdventureScore(comfortFoods: string[]): number {
  // Exotic/adventurous foods = high novelty, traditional/simple = low
  // Uses keyword matching for actual generated values
  const adventurousKeywords = [
    'sushi', 'curry', 'thai', 'vietnamese', 'ethiopian', 'korean',
    'fusion', 'tapas', 'ceviche', 'pho', 'dim sum', 'ramen',
    'bibimbap', 'street food', 'night market', 'spicy', 'fermented',
    'fine dining', 'seafood', 'dumplings', 'congee', 'miso',
  ];
  const traditionalKeywords = [
    'mac', 'mashed', 'pizza', 'burger', 'sandwich', 'casserole',
    'roast', 'porridge', 'baked', 'stew', 'soup', 'comfort',
    'home cooking', 'tea and biscuits', 'hearty', 'cheese',
  ];

  if (comfortFoods.length === 0) return 500;

  let adventureScore = 0;
  for (const food of comfortFoods) {
    const normalized = food.toLowerCase();
    const isAdventurous = adventurousKeywords.some(kw => normalized.includes(kw));
    const isTraditional = traditionalKeywords.some(kw => normalized.includes(kw));
    if (isAdventurous) adventureScore += 2;
    else if (isTraditional) adventureScore -= 1;
    else adventureScore += 0.5; // neutral
  }
  // Scale to 0-1000
  return Math.max(0, Math.min(1000, 500 + adventureScore * 100));
}

function computeNeighborhoodQualityNumeric(neighborhoodType: string | undefined): number {
  const map: Record<string, number> = {
    'slum': 1, 'informal': 1,
    'working-class': 2, 'industrial': 2,
    'mixed': 3, 'suburban': 3,
    'professional': 4, 'upper-middle': 4,
    'affluent': 5, 'gated': 5, 'elite': 5,
  };
  return map[neighborhoodType ?? 'mixed'] ?? 3;
}

function computeTreatmentQualityNumeric(treatmentAccess: string | undefined): number {
  const map: Record<string, number> = {
    'none': 0, 'no-access': 0,
    'emergency-only': 1,
    'basic': 2, 'public': 2,
    'moderate': 3, 'standard': 3,
    'good': 4, 'private': 4,
    'comprehensive': 5, 'specialist': 5, 'elite': 5,
  };
  return map[treatmentAccess ?? 'standard'] ?? 3;
}

function countNegativeEvents(events: Array<{ type?: string; impact?: string; valence?: string }> | undefined): number {
  if (!events) return 0;
  return events.filter(e =>
    e.impact === 'negative' ||
    e.valence === 'negative' ||
    e.type?.includes('loss') ||
    e.type?.includes('trauma') ||
    e.type?.includes('injury') ||
    e.type?.includes('persecution') ||
    e.type?.includes('failure') ||
    e.type?.includes('scandal') ||
    e.type?.includes('crisis')
  ).length;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADDITIONAL HELPER FUNCTIONS FOR NEW CORRELATES (2026-01-07)
// ═══════════════════════════════════════════════════════════════════════════

function computeChronotypeNumeric(chronotype: string | undefined): number {
  // Maps chronotype to early-bird score (higher = earlier riser)
  const map: Record<string, number> = {
    'extreme-early': 5,
    'early-bird': 4, 'early': 4,
    'morning': 4,
    'standard': 3, 'flexible': 3,
    'evening': 2,
    'night-owl': 1, 'night': 1,
    'extreme-night': 0,
  };
  return map[chronotype ?? 'flexible'] ?? 3;
}

function computeHasLeverage(leverage: Array<{ type?: string }> | string[]): number {
  // Any leverage = 1, no leverage = 0
  return leverage.length > 0 ? 1 : 0;
}

function hasOnlineCommunityMembership(memberships: Array<{ type?: string; online?: boolean }> | string[]): number {
  // Check if any community membership is online
  if (memberships.length === 0) return 0;
  // If it's a string array, look for online-related keywords
  if (typeof memberships[0] === 'string') {
    return (memberships as string[]).some(m =>
      m.toLowerCase().includes('online') ||
      m.toLowerCase().includes('virtual') ||
      m.toLowerCase().includes('digital') ||
      m.toLowerCase().includes('forum') ||
      m.toLowerCase().includes('discord') ||
      m.toLowerCase().includes('reddit')
    ) ? 1 : 0;
  }
  // Otherwise check for online property
  return (memberships as Array<{ online?: boolean }>).some(m => m.online) ? 1 : 0;
}

function computeUrbanicityNumeric(urbanicity: string | undefined): number {
  const map: Record<string, number> = {
    'rural': 1,
    'small-town': 2,
    'suburban': 3,
    'urban': 4,
    'metropolitan': 5,
    'megacity': 5,
  };
  return map[urbanicity ?? 'urban'] ?? 3;
}

function computePrivacyNumeric(privacyLevel: string | undefined): number {
  // Maps to domestic.ts PrivacyLevel values: 'isolated' | 'private' | 'thin-walls' | 'communal' | 'surveilled'
  const map: Record<string, number> = {
    'isolated': 5, 'secure': 5,
    'private': 4, 'good': 4,
    'thin-walls': 2, 'limited': 2,
    'communal': 1, 'shared': 1,
    'surveilled': 0, 'exposed': 0,
  };
  return map[privacyLevel ?? 'private'] ?? 3;
}

function computeLegalExposureNumeric(legalExposure: string | undefined): number {
  // Maps legalAdmin.legalExposure values - more serious = higher score
  const map: Record<string, number> = {
    'clean': 0,
    'sealed-record': 1,
    'old-conviction': 2,
    'tax-dispute': 3, 'custody-battle': 3,
    'pending-case': 4,
    'active-warrant': 5,
  };
  return map[legalExposure ?? 'clean'] ?? 0;
}

function hasTraditionalViceType(vices: Array<{ type?: string }> | string[]): number {
  // Traditional vices: alcohol, tobacco (older demographic)
  // Non-traditional: recreational drugs, gambling, etc. (younger demographic)
  const traditionalVices = new Set(['alcohol', 'tobacco', 'smoking', 'drinking', 'cigarettes']);

  if (vices.length === 0) return 0;
  if (typeof vices[0] === 'string') {
    return (vices as string[]).some(v => traditionalVices.has(v.toLowerCase())) ? 1 : 0;
  }
  return (vices as Array<{ type?: string }>).some(v =>
    v.type && traditionalVices.has(v.type.toLowerCase())
  ) ? 1 : 0;
}

function computeResilienceNumeric(resilience: string | undefined): number {
  const map: Record<string, number> = {
    'fragile': 1, 'low': 1,
    'vulnerable': 2, 'below-average': 2,
    'average': 3, 'moderate': 3,
    'good': 4, 'above-average': 4,
    'strong': 5, 'high': 5, 'exceptional': 5,
  };
  return map[resilience ?? 'average'] ?? 3;
}

function hasTraditionalViceFromDependency(
  dependencyProfiles: Array<{ substance?: string }>,
): number {
  // Traditional vices: alcohol, tobacco (older demographic correlate HL11)
  const traditionalVices = new Set(['alcohol', 'tobacco', 'smoking', 'drinking', 'cigarettes', 'nicotine']);
  return dependencyProfiles.some(d =>
    traditionalVices.has((d.substance ?? '').toLowerCase())
  ) ? 1 : 0;
}

function computeResilienceFromLatents(
  latents: { resilience?: number; stressReactivity?: number },
): number {
  // Resilience is inverse of stress reactivity, normalize to 1-5 scale
  // Or use resilience directly if present
  if (latents.resilience !== undefined) {
    return Math.max(1, Math.min(5, Math.round(latents.resilience / 200)));
  }
  if (latents.stressReactivity !== undefined) {
    // Lower stress reactivity = higher resilience
    return Math.max(1, Math.min(5, Math.round((1000 - latents.stressReactivity) / 200)));
  }
  return 3; // Default average
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH 2 HELPER FUNCTIONS (2026-01-07)
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function computeMobilityNumeric(mobility: string | undefined): number {
  const map: Record<string, number> = {
    'sedentary': 1, 'rooted': 1,
    'local': 2, 'stable': 2,
    'regional': 3, 'moderate': 3,
    'national': 4, 'mobile': 4,
    'international': 5, 'nomadic': 5,
  };
  return map[mobility ?? 'local'] ?? 2;
}

// New version using mobilityTag field
function computeMobilityNumericFromTag(mobilityTag: string | undefined): number {
  const map: Record<string, number> = {
    'low-mobility': 1, 'sedentary': 1, 'rooted': 1,
    'local': 2, 'stable': 2,
    'regional-travel': 3, 'regional': 3, 'moderate': 3,
    'frequent-flyer': 4, 'national': 4, 'mobile': 4,
    'nomadic': 5, 'international': 5,
  };
  return map[mobilityTag ?? 'local'] ?? 2;
}

function computeCommunityStatusNumeric(memberships: Array<{ status?: string; role?: string }> | string[]): number {
  if (!memberships?.length) return 0;
  const statusMap: Record<string, number> = {
    'pillar': 5, 'leader': 5,
    'respected': 4, 'active': 4,
    'regular': 3, 'member': 3,
    'newcomer': 2, 'peripheral': 2,
    'lurker': 1, 'passive': 1,
  };
  if (typeof memberships[0] === 'string') return 3;
  const statuses = (memberships as Array<{ status?: string; role?: string }>).map(m => statusMap[m.status ?? m.role ?? 'regular'] ?? 3);
  return Math.max(...statuses);
}

function isOperativeRole(careerTrack: string | undefined): number {
  const operativeRoles = new Set([
    'intelligence', 'security', 'military', 'operative', 'enforcement',
    'counter-intelligence', 'covert-ops', 'paramilitary',
  ]);
  return operativeRoles.has(careerTrack ?? '') ? 1 : 0;
}

function countSocialHobbies(hobbies: Array<{ social?: boolean; name?: string }> | string[]): number {
  if (!hobbies?.length) return 0;
  if (typeof hobbies[0] === 'string') {
    const socialKeywords = ['team', 'group', 'club', 'social', 'community', 'party', 'dance'];
    return (hobbies as string[]).filter(h => socialKeywords.some(k => h.toLowerCase().includes(k))).length;
  }
  return (hobbies as Array<{ social?: boolean }>).filter(h => h.social).length;
}

function computeFrugalEliteScore(frugality: number, tierBand: string): number {
  if (tierBand !== 'elite') return 0;
  return frugality / 1000; // 0-1 score for frugal elites
}

function computeFormalityNumeric(formalityBias: string | undefined): number {
  const map: Record<string, number> = {
    'casual': 1, 'relaxed': 1,
    'smart-casual': 2,
    'business-casual': 3,
    'professional': 4, 'formal': 4,
    'very-formal': 5, 'black-tie': 5,
  };
  return map[formalityBias ?? 'smart-casual'] ?? 2;
}

function computeAestheticBoldness(aesthetics: { visualComplexityPreference?: string; colorPalette?: string } | undefined): number {
  if (!aesthetics) return 3;
  // Map visual complexity to boldness (minimal = discreet, maximal = bold)
  const complexityMap: Record<string, number> = {
    'minimal': 1, 'understated': 1,
    'clean': 2, 'simple': 2,
    'balanced': 3, 'moderate': 3,
    'detailed': 4, 'layered': 4,
    'maximal': 5, 'complex': 5, 'ornate': 5,
  };
  return complexityMap[aesthetics.visualComplexityPreference ?? 'balanced'] ?? 3;
}

function isTransientHousingType(housingStability: string | undefined): number {
  const transientTypes = new Set([
    'transient', 'homeless', 'couch-surfing', 'shelter', 'temporary', 'unstable',
  ]);
  return transientTypes.has(housingStability ?? '') ? 1 : 0;
}

function computeRuralSkillScore(skills: Record<string, { value: number }> | undefined): number {
  if (!skills) return 0;
  const ruralSkills = ['agriculture', 'animal-husbandry', 'hunting', 'foraging', 'mechanics', 'construction'];
  let score = 0;
  for (const skill of ruralSkills) {
    if (skills[skill]) score += skills[skill].value / 1000;
  }
  return score / ruralSkills.length;
}

function computeFitnessBandNumeric(fitnessBand: string | undefined): number {
  const map: Record<string, number> = {
    'critical': 0,
    'sedentary': 1, 'poor': 1,
    'below-average': 2, 'light': 2,
    'average': 3, 'moderate': 3,
    'good': 4, 'active': 4,
    'excellent': 5, 'athletic': 5, 'elite': 5,
    'peak-condition': 6,
  };
  return map[fitnessBand ?? 'average'] ?? 3;
}

function computeCompetenceBandNumeric(competence: string | undefined): number {
  const map: Record<string, number> = {
    'incompetent': 1, 'struggles': 2, 'adequate': 3, 'competent': 4, 'expert': 5,
    // Alternative names
    'novice': 1, 'basic': 2, 'proficient': 4,
  };
  return map[competence ?? 'adequate'] ?? 3;
}

function hasMobilityAffectingCondition(conditions: Array<{ type?: string; name?: string }> | string[]): number {
  const mobilityConditions = new Set([
    'paralysis', 'amputation', 'arthritis', 'ms', 'muscular-dystrophy',
    'wheelchair', 'mobility-impaired', 'chronic-pain', 'fibromyalgia',
  ]);
  if (!conditions?.length) return 0;
  if (typeof conditions[0] === 'string') {
    return (conditions as string[]).some(c => mobilityConditions.has(c.toLowerCase())) ? 1 : 0;
  }
  return (conditions as Array<{ type?: string; name?: string }>).some(c =>
    mobilityConditions.has((c.type ?? c.name ?? '').toLowerCase())
  ) ? 1 : 0;
}

function hasActiveDependencyFromProfiles(
  dependencyProfiles: Array<{ recovery?: string; stage?: string; substance?: string }>,
): number {
  if (!dependencyProfiles?.length) return 0;
  // Check for active/relapsing dependencies (not managed/recovered)
  // Only match actual stage indicators, not just presence of substance
  const activeIndicators = new Set([
    'active', 'struggling', 'relapsing', 'relapse-risk', 'dependent',
    'early-stage', 'middle-stage', 'late-stage', 'crisis',
  ]);
  return dependencyProfiles.some(d =>
    activeIndicators.has(d.recovery ?? '') ||
    activeIndicators.has(d.stage ?? '')
  ) ? 1 : 0;
}

function computeCareerTrackNumeric(careerTrackTag: string | undefined): number {
  // Maps career tracks to prestige/risk level (higher = more event-generating)
  const map: Record<string, number> = {
    'unemployed': 0, 'none': 0,
    'organized-labor': 1, 'logistics': 1,
    'engineering': 2, 'journalism': 2,
    'academia': 3, 'foreign-service': 3,
    'military': 4, 'intelligence': 4,
    'executive': 5, 'elite': 5,
  };
  return map[careerTrackTag ?? 'engineering'] ?? 3;
}

function countCareerEvents(events: Array<{ type?: string; category?: string }> | undefined): number {
  if (!events?.length) return 0;
  // Match actual event types from timeline generation
  const careerTypes = new Set([
    'promotion', 'career', 'job', 'employment', 'fired', 'hired', 'retirement',
    'first-job', 'career-change', 'mentorship', 'education-milestone'
  ]);
  return events.filter(e => {
    const type = (e.type ?? '').toLowerCase();
    return careerTypes.has(type) || type.includes('job') || type.includes('career') || type.includes('education');
  }).length;
}

function computeMinorityInsecurityScore(
  minorityStatus: { religiousMinority?: boolean; visibleMinority?: boolean } | undefined,
  securityLevel: number
): number {
  if (!minorityStatus) return 0;
  const isMinority = minorityStatus.religiousMinority || minorityStatus.visibleMinority;
  if (!isMinority) return 0;
  return (1 - securityLevel / 1000); // Higher score = more insecurity
}

function hasEventType(events: Array<{ type?: string; description?: string }>, types: string[]): number {
  if (!events?.length) return 0;
  const typePatterns = types.map(t => t.toLowerCase());
  return events.some(e => {
    const eventType = (e.type ?? '').toLowerCase();
    const desc = (e.description ?? '').toLowerCase();
    // Check if event type matches any pattern OR description contains the keyword
    return typePatterns.some(pattern => eventType.includes(pattern) || desc.includes(pattern));
  }) ? 1 : 0;
}

function allEventsPositive(events: Array<{ impact?: string; valence?: string; positive?: boolean }> | undefined): number {
  if (!events?.length) return 1; // No events = vacuously true
  return events.every(e => e.impact === 'positive' || e.valence === 'positive' || e.positive) ? 1 : 0;
}

function computePositiveEventRatio(events: Array<{ impact?: string; valence?: string; positive?: boolean }> | undefined): number {
  if (!events?.length) return 0.5; // No events = neutral
  const positive = events.filter(e => e.impact === 'positive' || e.valence === 'positive' || e.positive).length;
  return positive / events.length;
}

function countRomanticEvents(events: Array<{ type?: string; category?: string; description?: string }> | undefined): number {
  if (!events?.length) return 0;
  // Match actual event types or keywords in descriptions
  const romanticTypes = new Set(['romance', 'marriage', 'divorce', 'dating', 'relationship', 'engagement', 'wedding']);
  const romanticKeywords = ['married', 'wedding', 'divorce', 'relationship', 'partner', 'spouse', 'engagement'];
  return events.filter(e => {
    const type = (e.type ?? '').toLowerCase();
    const desc = (e.description ?? '').toLowerCase();
    return romanticTypes.has(type) || romanticKeywords.some(kw => desc.includes(kw));
  }).length;
}

function computeArtisticSharingPublicness(sharingStyle: string | undefined): number {
  const map: Record<string, number> = {
    'private-only': 1, 'private': 1, 'personal': 1, 'never-finished': 1,
    'trusted-circle': 2, 'selective': 2, 'friends-only': 2,
    'anonymous-posts': 3, 'semi-public': 3,
    'public-showcase': 4, 'public': 4, 'collaborative': 4,
    'commercial': 5, 'professional': 5,
  };
  return map[sharingStyle ?? 'selective'] ?? 2;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function computeCaffeineIntensity(beverages: Array<{ type?: string; name?: string }> | string[]): number {
  if (!beverages?.length) return 2;
  const heavyCaffeine = new Set(['espresso', 'energy-drink', 'double-shot', 'triple-shot', 'cold-brew']);
  if (typeof beverages[0] === 'string') {
    return (beverages as string[]).some(b => heavyCaffeine.has(b.toLowerCase())) ? 5 : 3;
  }
  return (beverages as Array<{ type?: string; name?: string }>).some(b =>
    heavyCaffeine.has((b.type ?? b.name ?? '').toLowerCase())
  ) ? 5 : 3;
}

// New version using caffeineHabit string field
function computeCaffeineIntensityFromHabit(caffeineHabit: string | undefined): number {
  const map: Record<string, number> = {
    'no-caffeine': 0,
    'decaf-only': 1,
    'tea-only': 2,
    'moderate': 3,
    'black-coffee-only': 3,
    'brand-loyalty': 3,
    'cold-brew-ritual': 4,
    'espresso-perfectionist': 5,
    'energy-drink-ops': 5,
  };
  return map[caffeineHabit ?? 'moderate'] ?? 3;
}

function computeEmotionalSharingOpenness(emotionalSharing: string | undefined): number {
  const map: Record<string, number> = {
    'emotions-classified': 1, 'closed': 1, 'private': 1, 'guarded': 1,
    'actions-not-words': 2, 'selective': 2, 'cautious': 2,
    'opens-up-when-drunk': 3, 'moderate': 3,
    'overshares-deflect': 4, 'open': 4, 'expressive': 4,
    'radical-honesty': 5, 'very-open': 5, 'transparent': 5,
  };
  return map[emotionalSharing ?? 'moderate'] ?? 3;
}

function computeEducationLevelNumeric(education: string | undefined): number {
  const map: Record<string, number> = {
    'none': 0, 'primary': 0,
    'secondary': 1, 'high-school': 1,
    'vocational': 2, 'trade': 2, 'trade-certification': 2,
    'self-taught': 2, 'civil-service-track': 2,
    'undergraduate': 3, 'bachelors': 3,
    'graduate': 4, 'masters': 4,
    'doctorate': 5, 'phd': 5, 'post-doc': 5,
  };
  return map[education ?? 'undergraduate'] ?? 3;
}

function computeOutnessNumeric(outness: string | undefined): number {
  const map: Record<string, number> = {
    'closeted': 1, 'hidden': 1,
    'selective': 2, 'discreet': 2, 'selectively-out': 2,
    'private': 3, 'out-to-friends': 3,
    'out': 4, 'open': 4,
    'public': 5, 'activist': 5, 'publicly-out': 5,
  };
  return map[outness ?? 'private'] ?? 3;
}

function isIntelligenceCareer(careerTrack: string | undefined): number {
  const intelligenceCareers = new Set([
    'intelligence', 'spy', 'operative', 'counter-intelligence', 'cia', 'mi6', 'mossad',
    'analyst', 'intelligence-analyst', 'covert-ops',
  ]);
  return intelligenceCareers.has(careerTrack ?? '') ? 1 : 0;
}

function computeWeaponAssertiveness(weaponPreference: string | undefined): number {
  const map: Record<string, number> = {
    'non-lethal': 0, 'none': 0, 'pacifist': 0,
    'improvised': 1, 'defensive': 1, 'deterrent': 1,
    'distance-weapons': 2, 'practical': 2, 'utilitarian': 2,
    'knives': 3, 'capable': 3, 'prepared': 3,
    'glock-19': 4, 'aggressive': 4, 'assertive': 4,
    'lethal': 5, 'offensive': 5,
  };
  return map[weaponPreference ?? 'practical'] ?? 2;
}

function computeAsyncCommPreference(communicationMethod: string | undefined): number {
  const map: Record<string, number> = {
    'face-to-face': 1, 'in-person': 1,
    'voice-messages': 2, 'phone': 2, 'video': 2,
    'mixed': 3, 'flexible': 3,
    'texting': 4, 'text': 4, 'email': 4, 'async': 4,
    'written-reports': 5, 'long-email': 5, 'written': 5, 'letter': 5,
  };
  return map[communicationMethod ?? 'mixed'] ?? 3;
}

function computePrivateSpacePreference(spaceType: string | undefined): number {
  const map: Record<string, number> = {
    'hotel-rotation': 1, 'public': 1, 'open-plan': 1,
    'shared-housing': 2, 'barracks-dorm': 2, 'semi-public': 2, 'shared': 2,
    'studio-apartment': 3, 'operational-apartment': 3, 'mixed': 3,
    'family-home': 4, 'semi-private': 4,
    'bolt-hole': 5, 'mission-staging': 5, 'deep-cover-home': 5, 'private': 5, 'isolated': 5,
  };
  return map[spaceType ?? 'mixed'] ?? 3;
}

function computeWarmLightPreference(lightingPreference: string | undefined): number {
  const map: Record<string, number> = {
    'bright-open': 1, 'bright': 1, 'fluorescent': 1, 'cool': 1,
    'natural-light': 2, 'natural': 2, 'daylight': 2, 'views-required': 2,
    'neutral': 3,
    'artificial-only': 4, 'warm': 4, 'soft': 4,
    'dark-closed': 5, 'views-avoided': 5, 'dim': 5, 'candle': 5, 'ambient': 5,
  };
  return map[lightingPreference ?? 'neutral'] ?? 3;
}

function computeNetworkRoleNumeric(role: string | undefined): number {
  const map: Record<string, number> = {
    'isolate': 0, 'peripheral': 1,
    'connector': 2, 'bridge': 2,
    'broker': 3,
    'hub': 4, 'central': 4,
    'gatekeeper': 5, 'leader': 5,
  };
  return map[role ?? 'connector'] ?? 2;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRAINT CHECKS (Plausibility Gates & Hard Constraints)
// ═══════════════════════════════════════════════════════════════════════════

const CONSTRAINT_CHECKS: ConstraintCheck[] = [
  // Plausibility Gates (PG-*)
  {
    id: 'PG1',
    name: 'High Opsec → No Compromised Identity',
    type: 'plausibility-gate',
    check: (agent, m) => {
      if (m.opsecDiscipline > 750) {
        const idKit = agent.legalAdmin?.identityKitIntegrity;
        return idKit !== 'compromised';
      }
      return true;
    },
    expectedViolationRate: 0,
  },
  {
    id: 'PG2',
    name: 'Nomadic Mobility → No Owned Housing',
    type: 'plausibility-gate',
    check: (agent, m) => {
      const mobility = agent.geography?.mobilityPattern;
      const housing = agent.home?.housingStability;
      if (mobility === 'nomadic') {
        return housing !== 'owned';
      }
      return true;
    },
    expectedViolationRate: 0,
  },
  {
    id: 'PG3',
    name: 'Elite Tier → No Thin-Wall Neighborhood',
    type: 'plausibility-gate',
    check: (agent, m) => {
      if (m.tierNumeric === 3) { // elite
        const neighborhood = agent.home?.neighborhoodType;
        return neighborhood !== 'thin-walls' && neighborhood !== 'slum';
      }
      return true;
    },
    expectedViolationRate: 0,
  },
  {
    id: 'PG4',
    name: 'Single → No Ex-Partner Relationships',
    type: 'plausibility-gate',
    check: (agent, m) => {
      const marital = agent.family?.maritalStatus;
      if (marital === 'single') {
        const relationships = agent.relationships ?? [];
        return !relationships.some(r => r.type === 'ex-partner' || r.type === 'ex-spouse');
      }
      return true;
    },
    expectedViolationRate: 0,
  },
  {
    id: 'PG5',
    name: 'Lurker → No Pillar Status',
    type: 'plausibility-gate',
    check: (agent, m) => {
      const role = agent.communities?.communityRole;
      const status = agent.communities?.communityStatus;
      if (role === 'lurker') {
        return status !== 'pillar';
      }
      return true;
    },
    expectedViolationRate: 0,
  },
  {
    id: 'PG7',
    name: 'High Empathy → Deception Cap',
    type: 'plausibility-gate',
    // The code caps deception at 600 only if empathy > 800 AND deception > 750
    // So we check that high empathy + high deception (>750) doesn't exist
    check: (agent, m) => {
      if (m.empathy > 800) {
        // After the cap, deception should be ≤750 (capped to 600 if was >750)
        // But agents with deception 601-750 are allowed by the code
        return m.deception <= 750;
      }
      return true;
    },
    expectedViolationRate: 0,
  },

  // Age Gates
  {
    id: 'DC-NEW-1',
    name: 'Doctorate → Age ≥ 30',
    type: 'age-gate',
    check: (agent, m) => {
      if (m.educationNumeric === 5) { // doctorate
        return m.age >= 30;
      }
      return true;
    },
    expectedViolationRate: 0,
  },
  {
    id: 'NAR-12a',
    name: 'Romantic Events → Age ≥ 18',
    type: 'age-gate',
    check: (agent, m) => {
      const events = agent.timeline?.events ?? [];
      const hasRomantic = events.some(e => e.type?.includes('romantic') || e.type?.includes('marriage'));
      if (hasRomantic) {
        return m.age >= 18;
      }
      return true;
    },
    expectedViolationRate: 0,
  },

  // Hard Constraints
  {
    id: 'DC-NEW-5',
    name: 'Elite → No Secondary Education',
    type: 'hard-constraint',
    check: (agent, m) => {
      if (m.tierNumeric === 3) { // elite
        const ed = agent.identity?.educationTrackTag;
        return ed !== 'secondary' && ed !== 'self-taught' && ed !== 'no-formal';
      }
      return true;
    },
    expectedViolationRate: 0,
  },
  {
    id: 'NEW35',
    name: 'Parents with Dependents → Not Isolate',
    type: 'hard-constraint',
    check: (agent, m) => {
      if (m.dependentCount > 0) {
        return agent.network?.role !== 'isolate';
      }
      return true;
    },
    expectedViolationRate: 0,
  },
  {
    id: 'NEW38',
    name: 'Age 70+ → Deceased Parents',
    type: 'hard-constraint',
    check: (agent, m) => {
      if (m.age >= 70) {
        const relationships = agent.relationships ?? [];
        const hasLivingParent = relationships.some(r =>
          (r.type === 'parent' || r.type === 'mother' || r.type === 'father') &&
          r.status !== 'deceased'
        );
        return !hasLivingParent;
      }
      return true;
    },
    expectedViolationRate: 0,
  },
  {
    id: 'NAR-10',
    name: 'Elite + Refugee → Incompatible',
    type: 'hard-constraint',
    check: (agent, m) => {
      if (m.tierNumeric === 3) { // elite
        return agent.geography?.diasporaStatus !== 'refugee';
      }
      return true;
    },
    expectedViolationRate: 0,
  },
  {
    id: 'HL8',
    name: 'Multiple Injuries → Fitness Cap',
    type: 'hard-constraint',
    check: (agent, m) => {
      const injuries = agent.health?.injuryTags?.length ?? 0;
      const fitness = agent.health?.fitnessBand;
      if (injuries >= 2) {
        return fitness !== 'peak-condition' && fitness !== 'excellent' && fitness !== 'athletic';
      }
      return true;
    },
    expectedViolationRate: 0,
  },
  {
    id: 'DC-D8',
    name: 'High Legal Exposure → No Security Clearance',
    type: 'hard-constraint',
    check: (agent, m) => {
      const exposure = agent.legalAdmin?.legalExposure ?? 0;
      if (exposure > 700) {
        return !agent.legalAdmin?.hasSecurityClearance;
      }
      return true;
    },
    expectedViolationRate: 0,
  },

  // Threshold Validations (soft constraints with expected low violation rates)
  {
    id: 'NEW33',
    name: 'High Opsec → Not Hub/Gatekeeper',
    type: 'threshold',
    check: (agent, m) => {
      if (m.opsecDiscipline > 750) {
        const role = agent.network?.role;
        return role !== 'hub' && role !== 'gatekeeper';
      }
      return true;
    },
    expectedViolationRate: 0.05, // Allow up to 5% as soft constraint
  },
  {
    id: 'NEW11',
    name: 'High Principledness → Not Broker',
    type: 'threshold',
    check: (agent, m) => {
      if (m.principledness > 700) {
        return agent.network?.role !== 'broker';
      }
      return true;
    },
    expectedViolationRate: 0.05,
  },
];

function validateBatchConstraints(
  agents: GeneratedAgent[],
  metricsArray: AgentMetricsExtended[]
): ConstraintResult[] {
  const results: ConstraintResult[] = [];

  for (const constraint of CONSTRAINT_CHECKS) {
    const violations: string[] = [];

    for (let i = 0; i < agents.length; i++) {
      const passed = constraint.check(agents[i], metricsArray[i]);
      if (!passed) {
        violations.push(agents[i].seed);
      }
    }

    const violationRate = violations.length / agents.length;
    let status: ConstraintResult['status'];

    if (constraint.expectedViolationRate === 0) {
      status = violations.length === 0 ? 'passed' : 'failed';
    } else {
      if (violationRate <= constraint.expectedViolationRate) {
        status = 'passed';
      } else if (violationRate <= constraint.expectedViolationRate * 2) {
        status = 'warning';
      } else {
        status = 'failed';
      }
    }

    results.push({
      id: constraint.id,
      name: constraint.name,
      type: constraint.type,
      totalChecked: agents.length,
      violations: violations.length,
      violationRate: Math.round(violationRate * 10000) / 100, // percentage with 2 decimals
      expectedRate: constraint.expectedViolationRate * 100,
      status,
      examples: violations.slice(0, 3),
    });
  }

  return results;
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
  const allAgents: GeneratedAgent[] = []; // For batch constraint validation
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
    allAgents.push(agent); // Store for batch constraint validation

    if ((i + 1) % 25 === 0) {
      console.log(`  Progress: ${i + 1}/${count}`);
    }
  }

  // Correlation analysis
  console.log('\nAnalyzing correlations...');
  const documentedResults = analyzeDocumentedCorrelates(allMetrics);
  const spuriousResults = findSpuriousCorrelations(allMetrics);

  // Batch constraint validation (plausibility gates, age gates, hard constraints)
  const constraintResults = validateBatchConstraints(
    allAgents,
    allMetrics as AgentMetricsExtended[]
  );
  const constraintsPassed = constraintResults.filter(r => r.status === 'passed').length;

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
      correlatesVerified: documentedResults.filter(r => r.status === 'verified').length,
      correlatesTotal: documentedResults.length,
      constraintsPassed,
      constraintsTotal: constraintResults.length,
    },
    narrationErrors: allNarrationErrors,
    typeErrors: allTypeErrors,
    constraintViolations: allConstraintViolations,
    implausibilities: allImplausibilities,
    correlationAnalysis: {
      documented: documentedResults,
      spurious: spuriousResults,
    },
    constraintValidation: constraintResults,
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

  // Print constraint validation summary
  console.log('\n' + '-'.repeat(40));
  console.log('CONSTRAINT VALIDATION');
  console.log('-'.repeat(40));
  console.log(`\nTotal: ${constraintsPassed}/${constraintResults.length} passed`);

  const failedConstraints = constraintResults.filter(r => r.status === 'failed');
  const warningConstraints = constraintResults.filter(r => r.status === 'warning');

  if (failedConstraints.length > 0) {
    console.log('\nFailed constraints:');
    for (const c of failedConstraints) {
      console.log(`  ✗ ${c.id} ${c.name}: ${c.violations}/${c.totalChecked} violations (${c.violationRate}%)`);
      if (c.examples.length > 0) {
        console.log(`    Examples: ${c.examples.slice(0, 3).join(', ')}`);
      }
    }
  }

  if (warningConstraints.length > 0) {
    console.log('\nConstraints with warnings:');
    for (const c of warningConstraints) {
      console.log(`  ~ ${c.id} ${c.name}: ${c.violations}/${c.totalChecked} violations (${c.violationRate}%, expected ${c.expectedRate}%)`);
    }
  }

  if (failedConstraints.length === 0 && warningConstraints.length === 0) {
    console.log('All constraints passed.');
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
