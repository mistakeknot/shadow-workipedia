#!/usr/bin/env node
/**
 * Narration Test Harness
 *
 * Runs a fixed set of seeds through the narration generator and checks for banned patterns.
 * Deterministic and requires no network access.
 *
 * Usage: pnpm -C shadow-workipedia test:narration
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateAgent, type AgentVocabV1, type AgentPriorsV1 } from '../src/agent';
import { generateNarrative, type PronounMode } from '../src/agentNarration';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─────────────────────────────────────────────────────────────
// Test seeds (deterministic, covers edge cases)
// ─────────────────────────────────────────────────────────────

const TEST_SEEDS = [
  'alpha-001', 'beta-002', 'gamma-003', 'delta-004', 'epsilon-005',
  'zeta-006', 'eta-007', 'theta-008', 'iota-009', 'kappa-010',
  'lambda-011', 'mu-012', 'nu-013', 'xi-014', 'omicron-015',
  'pi-016', 'rho-017', 'sigma-018', 'tau-019', 'upsilon-020',
  'phi-021', 'chi-022', 'psi-023', 'omega-024', 'agent-025',
  'test-026', 'demo-027', 'sample-028', 'example-029', 'check-030',
  'verify-031', 'validate-032', 'confirm-033', 'assess-034', 'audit-035',
  'probe-036', 'scan-037', 'sweep-038', 'survey-039', 'inspect-040',
  'review-041', 'examine-042', 'analyze-043', 'evaluate-044', 'appraise-045',
  'judge-046', 'rate-047', 'score-048', 'grade-049', 'rank-050',
];

const PRONOUN_MODES: PronounMode[] = ['seeded', 'he', 'she', 'they', 'name'];

// ─────────────────────────────────────────────────────────────
// Banned patterns
// ─────────────────────────────────────────────────────────────

type BannedPattern = {
  name: string;
  regex: RegExp;
  description: string;
};

const BANNED_PATTERNS: BannedPattern[] = [
  {
    name: 'article-vowel-error',
    // "a" before a vowel is usually wrong ("a apple"), but allow common vowel-letter
    // cases with consonant sounds ("a union", "a user", "a European", etc.).
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
    // Only catches actual pronoun capitalization errors (He/She/They), not names
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
    // Match "and" as standalone word, not hyphenated (salt-and-pepper, etc.)
    // Only match truly separate "and" words within same sentence
    regex: /(?<![a-z-])\band\b(?![a-z-])[^.]*(?<![a-z-])\band\b(?![a-z-])[^.]*(?<![a-z-])\band\b(?![a-z-])/i,
    description: 'Triple "and" in single clause (food list issue)',
  },
];

// ─────────────────────────────────────────────────────────────
// Load static data
// ─────────────────────────────────────────────────────────────

function loadJsonFile<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, '..', relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

// ─────────────────────────────────────────────────────────────
// Test runner
// ─────────────────────────────────────────────────────────────

type TestFailure = {
  seed: string;
  pronounMode: PronounMode;
  patternName: string;
  description: string;
  context: string;
};

function runTests(): { passed: number; failed: number; failures: TestFailure[] } {
  console.log('Loading static data...');
  const vocab = loadJsonFile<AgentVocabV1>('public/agent-vocab.v1.json');
  const priors = loadJsonFile<AgentPriorsV1>('public/agent-priors.v1.json');
  const shadowMap = loadJsonFile<Array<{ real: string; shadow: string; iso3?: string; continent?: string }>>(
    'public/shadow-country-map.json'
  );

  const shadowByIso3 = new Map<string, { shadow: string; continent?: string }>();
  for (const entry of shadowMap) {
    if (entry.iso3) {
      shadowByIso3.set(entry.iso3, { shadow: entry.shadow, continent: entry.continent });
    }
  }

  // Filter to countries with valid iso3
  const countries = shadowMap.filter(c => c.iso3 && c.iso3.length === 3);

  const failures: TestFailure[] = [];
  let passed = 0;
  let total = 0;

  console.log(`Testing ${TEST_SEEDS.length} seeds × ${PRONOUN_MODES.length} pronoun modes = ${TEST_SEEDS.length * PRONOUN_MODES.length} combinations...\n`);

  for (const seed of TEST_SEEDS) {
    for (const pronounMode of PRONOUN_MODES) {
      total++;

      // Generate agent
      const agent = generateAgent({
        seed,
        asOfYear: 2025,
        vocab,
        priors,
        countries,
        includeTrace: false,
      });

      // Get labels
      const originLabel = shadowByIso3.get(agent.identity.homeCountryIso3)?.shadow ?? agent.identity.homeCountryIso3;
      const citizenshipLabel = shadowByIso3.get(agent.identity.citizenshipCountryIso3)?.shadow ?? agent.identity.citizenshipCountryIso3;
      const currentLabel = shadowByIso3.get(agent.identity.currentCountryIso3)?.shadow ?? agent.identity.currentCountryIso3;

      // Generate narrative
      const result = generateNarrative(
        agent,
        { originLabel, citizenshipLabel, currentLabel },
        2025,
        pronounMode
      );

      const fullText = `${result.para1} ${result.para2}`;

      // Check against banned patterns
      let hasFailure = false;
      for (const pattern of BANNED_PATTERNS) {
        const match = fullText.match(pattern.regex);
        if (match) {
          hasFailure = true;
          // Extract context around match
          const idx = fullText.indexOf(match[0]);
          const start = Math.max(0, idx - 30);
          const end = Math.min(fullText.length, idx + match[0].length + 30);
          const context = (start > 0 ? '...' : '') + fullText.slice(start, end) + (end < fullText.length ? '...' : '');

          failures.push({
            seed,
            pronounMode,
            patternName: pattern.name,
            description: pattern.description,
            context,
          });
        }
      }

      if (!hasFailure) {
        passed++;
      }
    }
  }

  return { passed, failed: total - passed, failures };
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

function main() {
  console.log('='.repeat(60));
  console.log('Agent Narration Test Harness');
  console.log('='.repeat(60) + '\n');

  const { passed, failed, failures } = runTests();

  if (failures.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('FAILURES');
    console.log('='.repeat(60) + '\n');

    // Group by pattern
    const byPattern = new Map<string, TestFailure[]>();
    for (const f of failures) {
      const list = byPattern.get(f.patternName) ?? [];
      list.push(f);
      byPattern.set(f.patternName, list);
    }

    for (const [patternName, patternFailures] of byPattern) {
      console.log(`\n[${patternName}] ${patternFailures[0]?.description ?? ''}`);
      console.log('-'.repeat(50));
      // Show up to 5 examples per pattern
      const shown = patternFailures.slice(0, 5);
      for (const f of shown) {
        console.log(`  Seed: ${f.seed} (${f.pronounMode})`);
        console.log(`  Context: ${f.context}`);
        console.log('');
      }
      if (patternFailures.length > 5) {
        console.log(`  ... and ${patternFailures.length - 5} more\n`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log('');

  if (failed > 0) {
    console.log('❌ Some tests failed. See details above.\n');
    process.exit(1);
  } else {
    console.log('✓ All narration tests passed.\n');
    process.exit(0);
  }
}

main();
