# Plan: Modularize Large Files in shadow-workipedia

## Overview

Several TypeScript files significantly exceed the 400-line limit. This plan breaks them into manageable modules while preserving functionality.

**Important context:**
- The 400-line limit is enforced on `.ts` files only (no `lint:max-lines` script exists yet in this repo - needs to be added)
- JSON files in `public/` are NOT subject to line limits, but splitting them improves maintainability
- Vocab is loaded at runtime via `fetch()` in `src/agentsView.ts`, not via imports
- `tsx` is already a dev dependency; `ts-morph` is NOT (add if needed for AST refactoring)

**Files to modularize (by priority):**

| File | Lines | Priority | Reason |
|------|-------|----------|--------|
| `src/agent/types.ts` | 1,756 | P1 | Foundational, enables other refactors |
| `src/agent/generator.ts` | 2,887 | P2 | Core orchestration, complex |
| `src/agentNarration.ts` | 2,345 | P3 | Self-contained, clear splits |
| `src/agent/facets/preferences.ts` | 2,191 | P4 | Clear domain boundaries |
| `src/agent/facets/lifestyle.ts` | 1,897 | P5 | Clear domain boundaries |
| `src/agent/facets/social.ts` | 1,587 | P6 | Clear domain boundaries |
| `public/agent-vocab.v1.json` | 14,577 | P7 | Data file, improves review/edit (not lint-enforced) |

---

## Phase 0: Add lint:max-lines Script

Before starting, add the line-limit enforcement. **Use the Node script as primary** (cross-platform, faster):

Create `scripts/lint-max-lines.ts`:
```typescript
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const MAX_LINES = 400;
const SRC_DIR = 'src';

function checkDir(dir: string): string[] {
  const violations: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      violations.push(...checkDir(path));
    } else if (path.endsWith('.ts')) {
      const lines = readFileSync(path, 'utf8').split('\n').length;
      if (lines > MAX_LINES) {
        violations.push(`${path}: ${lines} lines (exceeds ${MAX_LINES})`);
      }
    }
  }
  return violations;
}

const violations = checkDir(SRC_DIR);
if (violations.length > 0) {
  console.error('Files exceeding line limit:');
  violations.forEach(v => console.error(`  ${v}`));
  process.exit(1);
} else {
  console.log(`✅ All .ts files in ${SRC_DIR}/ are ≤${MAX_LINES} lines`);
}
```

Add to `package.json`:
```json
{
  "lint:max-lines": "tsx scripts/lint-max-lines.ts",
  "lint": "pnpm lint:max-lines && pnpm typecheck"
}
```

Shell fallback (macOS/Linux only):
```bash
find src -name '*.ts' -exec sh -c 'lines=$(wc -l < "$1"); if [ $lines -gt 400 ]; then echo "$1: $lines lines"; exit 1; fi' _ {} \;
```

---

## Phase 1: Modularize types.ts (P1)

### Current Structure
```
src/agent/types.ts (1,756 lines)
├── Version and metadata types
├── Vocab types (AgentVocabV1, identity, appearance, etc.)
├── Priors types (AgentPriorsV1, buckets, countries)
├── Culture profile types
├── Latent types
├── Generated agent types (all the output facets)
├── Context types (generation inputs)
└── Trace types
```

### Target Structure (all files ≤350 lines for safety margin)
```
src/agent/types/
├── index.ts                    # Re-exports all types (~50 lines)
├── common.ts                   # Band5, Fixed, TierBand, shared enums (~100 lines)
├── vocab.ts                    # AgentVocabV1 and related (~350 lines)
├── priors.ts                   # AgentPriorsV1, buckets, countries (~200 lines)
├── cultures.ts                 # CultureProfileV1, MicroCultureProfile (~200 lines)
├── latents.ts                  # Latents type definition (~100 lines)
├── agent-identity.ts           # Identity, appearance, capabilities output types (~300 lines)
├── agent-psychology.ts         # Psychology, personality output types (~300 lines)
├── agent-social.ts             # Social, relationships output types (~300 lines)
├── agent-lifestyle.ts          # Lifestyle, health, preferences output types (~300 lines)
├── context.ts                  # Generation context types (~150 lines)
└── trace.ts                    # AgentGenerationTraceV1 (~100 lines)
```

**Note:** Original estimate of `agent.ts` at ~500 lines was over limit. Split into 4 domain files.

### Implementation Steps

1. **Install ts-morph** (if using AST extraction):
   ```bash
   pnpm add -D ts-morph
   ```

2. **Create directory**: `mkdir -p src/agent/types`

3. **Extract types by domain** (use ts-morph or manual extraction, NOT sed):
   - Start with leaf types (no dependencies): `common.ts`, `latents.ts`
   - Then types that depend on those: `vocab.ts`, `priors.ts`, `cultures.ts`
   - Finally output types: `agent-*.ts`, `context.ts`, `trace.ts`

4. **Create index.ts** with re-exports:
   ```typescript
   export * from './common';
   export * from './vocab';
   export * from './priors';
   export * from './cultures';
   export * from './latents';
   export * from './agent-identity';
   export * from './agent-psychology';
   export * from './agent-social';
   export * from './agent-lifestyle';
   export * from './context';
   export * from './trace';
   ```

5. **Update imports** across codebase:
   - Imports from `'../types'` should still work via index
   - Verify with `pnpm typecheck`

6. **Verification**: See verification section below

---

## Phase 2: Modularize generator.ts (P2)

### Current Structure
```
src/agent/generator.ts (2,887 lines)
├── Imports and type definitions
├── Helper functions (RNG, validation, etc.)
├── Culture/geography resolution
├── Facet orchestration (calls identity, appearance, etc.)
├── Deep sim preview generation
├── Output assembly
└── Export
```

### Target Structure (all files ≤350 lines)
```
src/agent/generator/
├── index.ts                    # Main generateAgent export (~100 lines)
├── options.ts                  # GenerateAgentOptions type, defaults (~100 lines)
├── context.ts                  # Context building, validation (~300 lines)
├── cultures.ts                 # Culture/geography resolution (~350 lines)
├── cultureHelpers.ts           # Culture helper functions (~200 lines)
├── orchestrator.ts             # Facet calling sequence (~350 lines)
├── assembly.ts                 # Output object assembly (~300 lines)
├── deepSim.ts                  # Deep sim preview generation (~350 lines)
├── deepSimHelpers.ts           # Deep sim helper functions (~200 lines)
└── helpers.ts                  # Shared utilities (~200 lines)
```

### Implementation Steps

1. **Identify logical boundaries** in current file:
   - Lines 1-100: Imports, types
   - Lines 100-400: Context building
   - Lines 400-800: Culture resolution
   - Lines 800-1500: Facet orchestration
   - Lines 1500-2200: Output assembly
   - Lines 2200-2887: Deep sim + helpers

2. **Extract bottom-up** (helpers first, then higher-level):
   - Start with pure functions that have no dependencies
   - Move up to functions that depend on extracted ones

3. **Preserve the public API**:
   ```typescript
   // src/agent/generator/index.ts
   export { generateAgent } from './orchestrator';
   export type { GenerateAgentOptions } from './options';
   ```

4. **Update imports** in facet files and main entry

5. **Verification**: See verification section below

---

## Phase 3: Modularize agentNarration.ts (P3)

### Current Structure
```
src/agentNarration.ts (2,345 lines)
├── Imports and types
├── Conjugation tables and helpers
├── Template rendering
├── Section generators (identity, appearance, psychology, etc.)
├── Main narrative assembly
└── Export
```

### Target Structure (all files ≤350 lines)
```
src/agentNarration/
├── index.ts                    # Main export, narrative assembly (~150 lines)
├── types.ts                    # Narration-specific types (~100 lines)
├── conjugation.ts              # Verb conjugation tables (~250 lines)
├── grammar.ts                  # Grammar helpers (pronouns, articles) (~150 lines)
├── templates.ts                # Template rendering utilities (~200 lines)
├── sections/
│   ├── identity.ts             # Identity narrative section (~200 lines)
│   ├── appearance.ts           # Appearance narrative section (~200 lines)
│   ├── psychology.ts           # Psychology narrative section (~250 lines)
│   ├── social.ts               # Social/relationships section (~200 lines)
│   ├── lifestyle.ts            # Lifestyle narrative section (~200 lines)
│   ├── background.ts           # Background/history section (~200 lines)
│   └── details.ts              # Miscellaneous details (~200 lines)
```

### Implementation Steps

1. **Extract conjugation utilities first** (no dependencies)

2. **Extract grammar helpers** (depends on conjugation)

3. **Extract template rendering** (depends on grammar)

4. **Extract section generators one by one**:
   - Each section is relatively independent
   - Move with its helper functions

5. **Update index.ts** to orchestrate sections

6. **Verification**: See verification section below

---

## Phase 4-6: Modularize Facet Files

### preferences.ts (2,191 lines) → P4

Split by preference category (all files ≤350 lines):
```
src/agent/facets/preferences/
├── index.ts           # Main export, orchestration (~150 lines)
├── types.ts           # Preference types (~100 lines)
├── food.ts            # Food preferences (~350 lines)
├── drinks.ts          # Drinks, caffeine, alcohol (~200 lines)
├── media.ts           # Media preferences (~200 lines)
├── fashion.ts         # Fashion preferences (~200 lines)
├── hobbies.ts         # Hobbies (~300 lines)
├── environment.ts     # Environment prefs (~200 lines)
└── livingSpace.ts     # Living space prefs (~200 lines)
```

### lifestyle.ts (1,897 lines) → P5

Split by lifestyle domain (all files ≤350 lines):
```
src/agent/facets/lifestyle/
├── index.ts           # Main export (~150 lines)
├── types.ts           # Lifestyle types (~100 lines)
├── health.ts          # Health, conditions (~300 lines)
├── fitness.ts         # Fitness, exercise (~200 lines)
├── routines.ts        # Daily routines, rituals (~300 lines)
├── vices.ts           # Vices, dependencies (~300 lines)
├── mobility.ts        # Travel, passports (~200 lines)
└── logistics.ts       # Living situation, admin (~200 lines)
```

### social.ts (1,587 lines) → P6

Split by social domain (all files ≤350 lines):
```
src/agent/facets/social/
├── index.ts           # Main export (~150 lines)
├── types.ts           # Social types (~100 lines)
├── family.ts          # Family structure (~300 lines)
├── relationships.ts   # Romantic, friendships (~300 lines)
├── community.ts       # Community memberships (~300 lines)
├── reputation.ts      # Status, reputation (~200 lines)
└── network.ts         # Professional network (~200 lines)
```

---

## Phase 7: Modularize agent-vocab.v1.json (P7)

**Note:** This is lower priority since JSON files aren't lint-enforced, but improves maintainability.

### Architecture Decision

**The merged JSON remains the runtime artifact.** Module files are for authoring/editing only.

- `public/agent-vocab.v1.json` - The actual file loaded by the app at runtime via `fetch()`
- `public/agent-vocab/*.json` - Source modules for easier editing (NOT loaded directly)
- Merge happens at build time, producing the single runtime file

**Important:** The merged file (`public/agent-vocab.v1.json`) **must be committed to git** so that:
1. Fresh clones work without running build steps
2. `pnpm dev` works immediately (the `predev` hook ensures it's up-to-date for ongoing development)
3. The Vite dev server can serve it from `public/`

The workflow is: edit modules → run `pnpm vocab:merge` (or let hooks run it) → commit both modules AND merged file.

### Target Structure
```
public/
├── agent-vocab.v1.json              # GENERATED - do not edit directly
└── agent-vocab/                     # SOURCE modules - edit these
    ├── _schema.json                 # Optional: JSON schema for validation
    ├── identity.json                # firstNames, lastNames, maleFirstNames, femaleFirstNames
    ├── appearance.json              # height, build, hair, eyes, voice
    ├── capabilities.json            # skills, psych, visibility
    ├── health.json                  # conditions, allergies, injuries, fitness
    ├── preferences-food.json        # comfortFoods, cuisines, restrictions, drinks
    ├── preferences-media.json       # genres, platforms
    ├── preferences-other.json       # fashion, hobbies, environment, livingSpace
    ├── cultures-macros.json         # 7 macro culture profiles
    ├── cultures-micros.json         # 56 micro culture profiles
    ├── psychology.json              # personality, affect, archetypes, types
    ├── narrative-timeline.json      # childhood, youngAdult, midAge, laterLife
    ├── narrative-other.json         # dreams, details, economicMobility
    └── social.json                  # civicLife, relationships
```

### Implementation Steps

1. **Create split script** `scripts/vocab-split.ts`:
   ```typescript
   // Read public/agent-vocab.v1.json
   // Split into domain files in public/agent-vocab/
   // One-time migration script
   ```

2. **Create merge script** `scripts/vocab-merge.ts`:
   ```typescript
   // Read all files from public/agent-vocab/
   // Deep merge into single object (preserve key order)
   // Write to public/agent-vocab.v1.json
   ```

3. **Add npm scripts with proper hooks**:
   ```json
   {
     "vocab:split": "tsx scripts/vocab-split.ts",
     "vocab:merge": "tsx scripts/vocab-merge.ts",
     "predev": "pnpm vocab:merge",
     "prebuild": "pnpm vocab:merge",
     "pretest:narration": "pnpm vocab:merge"
   }
   ```

4. **Add .gitignore entry** (optional, if you want to gitignore generated file):
   ```
   # Generated from agent-vocab/ modules
   # public/agent-vocab.v1.json
   ```

   **Or keep it committed** (simpler, no build step needed for fresh clones).

5. **Add header comment to generated file**:
   ```json
   {
     "_comment": "GENERATED FILE - Edit files in public/agent-vocab/ instead, then run pnpm vocab:merge",
     "version": "1.0.0",
     ...
   }
   ```

---

## Verification Protocol

### Nondeterministic Fields

The agent generator is fully deterministic given a seed, **except** for:
- `createdAtIso` - Timestamp of generation (uses `new Date()`)
- `generationTrace` - Contains timing/debug info (optional, usually omitted)

All other fields (including `id`, `secrets`, random selections) use the seeded RNG and are reproducible.

### Baseline Location

Store baseline at `scripts/fixtures/agent-baseline.json`:
- Keeps test fixtures with test scripts
- Committed to git (enables CI verification)
- Create directory: `mkdir -p scripts/fixtures`

### Deterministic Test Harness

Create `scripts/verify-agents.ts`:

```typescript
import { generateAgent } from '../src/agent';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// 100 fixed seeds for reproducible testing
const SEEDS = Array.from({ length: 100 }, (_, i) => `baseline-${String(i + 1).padStart(3, '0')}`);
const BASELINE_PATH = 'scripts/fixtures/agent-baseline.json';

// Fields to ignore in comparison (nondeterministic)
const IGNORED_FIELDS = new Set(['createdAtIso', 'generationTrace']);

function stripNondeterministic(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj, (k, v) => IGNORED_FIELDS.has(k) ? undefined : v));
}

async function generateBaseline() {
  const vocab = JSON.parse(readFileSync('public/agent-vocab.v1.json', 'utf8'));
  const priors = JSON.parse(readFileSync('public/agent-priors.v1.json', 'utf8'));
  const countries = JSON.parse(readFileSync('public/shadow-country-map.json', 'utf8'));

  const agents = SEEDS.map(seed =>
    stripNondeterministic(generateAgent({ seed, vocab, priors, countries, asOfYear: 2025 }))
  );

  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  writeFileSync(BASELINE_PATH, JSON.stringify(agents, null, 2));
  console.log(`Baseline saved: ${agents.length} agents to ${BASELINE_PATH}`);
}

async function verifyAgainstBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    throw new Error(`No baseline exists at ${BASELINE_PATH}. Run with --generate-baseline first.`);
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const vocab = JSON.parse(readFileSync('public/agent-vocab.v1.json', 'utf8'));
  const priors = JSON.parse(readFileSync('public/agent-priors.v1.json', 'utf8'));
  const countries = JSON.parse(readFileSync('public/shadow-country-map.json', 'utf8'));

  let diffs = 0;
  for (let i = 0; i < SEEDS.length; i++) {
    const agent = stripNondeterministic(
      generateAgent({ seed: SEEDS[i], vocab, priors, countries, asOfYear: 2025 })
    );
    const baselineAgent = baseline[i];

    if (JSON.stringify(agent) !== JSON.stringify(baselineAgent)) {
      console.error(`DIFF at seed ${SEEDS[i]}`);
      diffs++;
    }
  }

  if (diffs === 0) {
    console.log(`✅ All ${SEEDS.length} agents match baseline`);
  } else {
    console.error(`❌ ${diffs} agents differ from baseline`);
    process.exit(1);
  }
}

// Usage: tsx scripts/verify-agents.ts [--generate-baseline]
const generateMode = process.argv.includes('--generate-baseline');
if (generateMode) {
  generateBaseline();
} else {
  verifyAgainstBaseline();
}
```

Add npm scripts:
```json
{
  "test:baseline:generate": "tsx scripts/verify-agents.ts --generate-baseline",
  "test:baseline:verify": "tsx scripts/verify-agents.ts"
}
```

### Verification Checklist (per phase)

- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm lint:max-lines` passes (all .ts files ≤400 lines)
- [ ] `pnpm test:baseline:verify` passes (agents identical to baseline)
- [ ] `pnpm test:narration` passes (existing script - tests narrative generation)
- [ ] Manual spot-check: Generate agent in UI, verify display

---

## Execution Order

1. **Phase 0** - Add lint:max-lines (30 min)
2. **Phase 1 (types.ts)** - 2-3 hours
3. **Phase 2 (generator.ts)** - 3-4 hours
4. **Phase 3 (agentNarration.ts)** - 2-3 hours
5. **Phase 4 (preferences.ts)** - 2 hours
6. **Phase 5 (lifestyle.ts)** - 2 hours
7. **Phase 6 (social.ts)** - 2 hours
8. **Phase 7 (vocab JSON)** - 1-2 hours (optional, not lint-enforced)

---

## Tools & Dependencies

**Already available:**
- `tsx` (dev dependency) - TypeScript execution

**Add if needed:**
- `ts-morph` - AST-based refactoring (recommended for safe type extraction)
  ```bash
  pnpm add -D ts-morph
  ```

**DO NOT use:**
- `sed` for TypeScript (CATASTROPHIC RISK per AGENTS.md)
- `awk` for code transforms
- Regex-based find/replace on code

---

## Notes

- Each phase should be a separate PR/commit
- Preserve git history with `git mv` where possible
- Update any CLAUDE.md or AGENTS.md references
- The vocab JSON split uses Node.js (not AST tools) since it's JSON, not TypeScript
- Generate baseline BEFORE starting any refactor, verify AFTER each phase
