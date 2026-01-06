# AgentsView Modularization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Bead:** N/A (manual request)

**Goal:** Modularize `src/agentsView.ts` by extracting rendering and utility helpers into focused modules without changing behavior.

**Architecture:** Keep `initializeAgentsView` as the public entrypoint. Move the large render block and helper render utilities into `src/agentsView/renderAgent.ts`. Extract formatting helpers into `src/agentsView/formatting.ts` and export/download helpers into `src/agentsView/exportUtils.ts`. `initializeAgentsView` will import the new modules and continue to orchestrate state, events, and DOM updates.

**Tech Stack:** TypeScript, Vite, Node + tsx

**Constraint:** No worktrees (per user instruction). Work directly on `main`.

---

### Task 1: Add render smoke test (RED → GREEN)

**Files:**
- Create: `scripts/test-agents-view-render.ts`

**Step 1: Write the failing test**

Create `scripts/test-agents-view-render.ts` with the following content (expects new module that does not exist yet):

```ts
#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateAgent } from '../src/agent';
import type { AgentPriorsV1, AgentVocabV1, GenerateAgentInput } from '../src/agent/types';
import { renderAgent } from '../src/agentsView/renderAgent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJson<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, '..', relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf-8')) as T;
}

const vocab = loadJson<AgentVocabV1>('public/agent-vocab.v1.json');
const priors = loadJson<AgentPriorsV1>('public/agent-priors.v1.json');
const countries = loadJson<GenerateAgentInput['countries']>('public/shadow-country-map.json');

const agent = generateAgent({
  seed: 'agentsview-test-001',
  vocab,
  priors,
  countries,
  birthYear: 1985,
  asOfYear: 2025,
});

const html = renderAgent(agent, new Map(), 'portrait', () => true, 2025, vocab);

if (!html.includes(agent.identity.name)) {
  throw new Error('Expected renderAgent output to include agent name.');
}
if (!html.includes('Overview')) {
  throw new Error('Expected renderAgent output to include Overview tab.');
}
console.log('agentsView render test passed.');
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx scripts/test-agents-view-render.ts`

Expected: FAIL with module not found for `src/agentsView/renderAgent`.

**Step 3: Implement minimal module to make test pass**

- Create `src/agentsView/renderAgent.ts`
- Move `renderAgent` and its helper functions from `src/agentsView.ts` into this new module.
- Export `renderAgent` (and any local helper types it needs).
- Update `src/agentsView.ts` to import `renderAgent` from the new module and remove the old inline function.

**Step 4: Run test to verify it passes**

Run: `node --import tsx scripts/test-agents-view-render.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/test-agents-view-render.ts src/agentsView/renderAgent.ts src/agentsView.ts
git commit -m "Extract agent profile renderer"
```

---

### Task 2: Extract formatting helpers

**Files:**
- Create: `src/agentsView/formatting.ts`
- Modify: `src/agentsView.ts`, `src/agentsView/renderAgent.ts`

**Step 1: Write the failing test**

Reuse the render smoke test. It should still pass before changes.

**Step 2: Make a small change to force failure**

Temporarily remove `escapeHtml` from `src/agentsView.ts` before exporting it, then run the test to ensure it fails with a missing import (rollback after confirming). This confirms the test catches module wiring issues.

**Step 3: Write minimal implementation**

- Move these helpers into `src/agentsView/formatting.ts`:
  - `escapeHtml`
  - `toTitleCaseWords`
  - `displayLanguageCode`
- Update imports in `src/agentsView.ts` and `src/agentsView/renderAgent.ts` to use the module.

**Step 4: Run test to verify it passes**

Run: `node --import tsx scripts/test-agents-view-render.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/agentsView/formatting.ts src/agentsView.ts src/agentsView/renderAgent.ts
git commit -m "Extract agents view formatting helpers"
```

---

### Task 3: Extract export/download helpers

**Files:**
- Create: `src/agentsView/exportUtils.ts`
- Modify: `src/agentsView.ts`, `src/agentsView/renderAgent.ts`

**Step 1: Write the failing test**

Reuse the render smoke test. It should still pass before changes.

**Step 2: Implement minimal extraction**

Move these functions into `src/agentsView/exportUtils.ts`:
- `downloadJson`
- `humanizeAgentForExport`

Update `src/agentsView.ts` imports and remove local copies.

**Step 3: Run test to verify it passes**

Run: `node --import tsx scripts/test-agents-view-render.ts`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/agentsView/exportUtils.ts src/agentsView.ts
git commit -m "Extract agents view export helpers"
```

---

### Task 4: Extract roster storage helpers

**Files:**
- Create: `src/agentsView/rosterStorage.ts`
- Modify: `src/agentsView.ts`

**Step 1: Write the failing test**

Reuse the render smoke test. It should still pass before changes.

**Step 2: Implement minimal extraction**

Move these helpers into `src/agentsView/rosterStorage.ts`:
- `ROSTER_STORAGE_KEY`
- `loadRoster`
- `saveRoster`

Update imports in `src/agentsView.ts`.

**Step 3: Run test to verify it passes**

Run: `node --import tsx scripts/test-agents-view-render.ts`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/agentsView/rosterStorage.ts src/agentsView.ts
git commit -m "Extract agents roster storage helpers"
```

---

### Task 5: Verify full build

**Step 1: Run build**

Run: `pnpm build`

Expected: `tsc` and `vite build` complete successfully.

**Step 2: Commit (if needed)**

No code changes expected. If any fixes were required, commit with a clear message.

---

## Verification Checklist

- `node --import tsx scripts/test-agents-view-render.ts` passes
- `pnpm build` passes
- `initializeAgentsView` API unchanged
- Rendering output includes agent name and Overview tab

---

## Notes for Implementation

- Keep string output and ordering intact to avoid UI drift.
- Do not change DOM/event logic during extraction.
- Ensure all new modules use ASCII and existing code style.

