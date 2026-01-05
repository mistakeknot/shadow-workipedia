# Agent Decision Templates (Marketing) Design

## Summary
Add a lightweight “Decision style” snapshot driven by the Agent Decision Templates catalog. This is a marketing-facing card: short, punchy decision tendencies (3–5) that describe how the agent chooses under pressure.

## Data Model
- Parent vocab: add `decisionTemplates` to `data/agent-generation/v1/vocab.json` with category arrays.
- Generated agent adds `decisionStyle: { tendencies: Array<{ category, item }> }`.

## Categories
- mission, resource, social, crisis, information, moral, resourceManagement, longTerm

## Generation
- New facet `computeDecisionStyle(seed, vocab, latents, traits, aptitudes, ethics)`.
- Compute category weights from traits/latents (risk, conscientiousness, planning, stress, empathy, harm aversion).
- Pick 3–5 unique category tendencies; select a random item within each category.

## UI
- Portrait tab: add “Decision style” card under Behavior lens.
- Display archetype tendencies as short bullet lines.

## Testing
- Extend `scripts/test-personality-vocab.ts` to assert decisionTemplates vocab and generated tendencies (3–5 entries).
- Run `pnpm extract-data` and the test harness.
