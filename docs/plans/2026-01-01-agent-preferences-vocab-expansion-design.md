# Agent Preferences Vocab Expansion (Design)

Date: 2026-01-01

## Goal
Expand agent preference generation by ingesting `agent-preferences-catalog.md` into the shared agent vocab and wiring the new preference domains through generation and UI. The change should be schema-driven and deterministic, with minimal new logic beyond weighted picks from vocab pools.

## Source of Truth + Pipeline
- Source data lives in the parent repo at `../data/agent-generation/v1/vocab.json`.
- This repo consumes it via `pnpm extract-data`, which copies to `public/agent-vocab.v1.json`.
- No manual edits to `public/agent-vocab.v1.json`.

## Vocab Schema Additions
All new domains live under `preferences` to keep the data cohesive and the UI simple.

- `preferences.environment.temperatureTags`
- `preferences.environment.weatherMoodTags`
- `preferences.livingSpace.roomPreferenceTags`
- `preferences.livingSpace.comfortItemTags`
- `preferences.social.groupStyleTags`
- `preferences.social.communicationMethodTags`
- `preferences.social.boundaryTags`
- `preferences.social.emotionalSharingTags`
- `preferences.work.preferredOperationTags`
- `preferences.work.avoidedOperationTags`
- `preferences.equipment.weaponPreferenceTags`
- `preferences.equipment.gearPreferenceTags`
- `preferences.quirks.luckyItemTags`
- `preferences.quirks.ritualTags`
- `preferences.quirks.petPeeveTags`
- `preferences.quirks.mustHaveTags`
- `preferences.time.dailyRhythmTags`
- `preferences.time.planningStyleTags`

Tags are short, kebab-case strings derived from `game-design-docs/catalogs/agent-preferences-catalog.md`.

## Generator Changes
- Extend `AgentVocabV1` and generated agent preferences types in `src/agent/types.ts`.
- Expand `PreferencesResult` and logic in `src/agent/facets/preferences.ts`:
  - For each new vocab list, deterministically pick 1-3 items using the facet RNG.
  - Apply mild weight nudges using existing latents/traits (e.g., conscientiousness for time planning, publicness for room privacy) without hard constraints.
  - Record selections in trace using `traceSet` for tuning.

## UI + Export
- Update `src/agentsView.ts` to render the new preference sections as simple lists.
- Ensure export title-cases tags similarly to existing preference fields.

## Data Mapping Notes
- Focus on direct mappings from catalog phrases to compact tags (e.g., "night owl naturally" -> `night-owl`).
- Avoid quotes or long strings in vocab; keep tags composable and UI-friendly.

## Testing
- `pnpm typecheck`
- `pnpm test:narration -- --count 100`

## Risks
- Overlong lists or verbose strings degrade UI readability.
- Overweighting nudges could reduce variety; keep nudges small and clamped.
