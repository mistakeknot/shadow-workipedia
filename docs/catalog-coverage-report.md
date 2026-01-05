# Catalog Coverage Report

Coverage levels:
- Integrated: explicit vocab + generator logic present.
- Partial: some vocab/logic exists, but most catalog content not represented.
- Not integrated: no dedicated vocab or generator logic.

Agent catalogs

| Catalog | Coverage | Evidence | Gaps / Notes |
| --- | --- | --- | --- |
| agent-preferences-catalog.md | Partial | Vocab: `preferences.*`; generator: `src/agent/facets/preferences.ts`; UI: `src/agentsView.ts` | Broad coverage but still missing deeper narrative preference arcs. |
| agent-preferences-aesthetics-catalog.md | Integrated (core lists) | Vocab: `preferences.aesthetics.*`; generator: `src/agent/facets/preferences.ts`; UI: `src/agentsView.ts` | Still no cross-domain narrative context. |
| agent-food-culture-catalog.md | Partial | Vocab: `preferences.food.*`; generator: `src/agent/facets/preferences.ts` | Added frugality weighting for comfort foods; still no cuisine-level/prep-style modeling. |
| agent-living-spaces-catalog.md | Partial | Vocab: `preferences.livingSpace.*`, `home.*`; generator: `src/agent/facets/preferences.ts`, `src/agent/facets/domestic.ts` | Missing deeper spatial aesthetic / narrative behaviors. |
| agent-daily-life-catalog.md | Integrated (core lists) | Vocab: `everydayLife.*`; generator: `src/agent/facets/domestic.ts`; UI: `src/agentsView.ts` | Only list-level coverage, not full narrative detail. |
| agent-memory-trauma-catalog.md | Integrated | Vocab: `memoryTrauma.*`; generator: `src/agent/facets/lifestyle.ts`; UI: `src/agentsView.ts` | Narrative detail from catalog not encoded. |
| agent-physical-health-catalog.md | Integrated | Vocab: `health.*`; generator: `src/agent/facets/lifestyle.ts`; UI: `src/agentsView.ts` | Symptom progression/medical history depth not modeled. |
| agent-physical-details-catalog.md | Integrated | Vocab: `physicalDetails.*`; generator: `src/agent/facets/physicalDetails.ts`; UI: `src/agentsView.ts` | Some detailed sub-features still not represented (e.g., specific tattoo/scar narratives). |
| agent-substance-dependency-catalog.md | Integrated (stages + profiles) | Vocab: `vices.*`, `dependencyStages`, `dependencyPatterns`; generator: `src/agent/facets/lifestyle.ts`; UI: `src/agentsView.ts` | Recovery arcs and long-term progression not modeled yet. |
| agent-thoughts-emotions-catalog.md | Integrated (thoughts/emotions/coping) | Vocab: `thoughtsEmotions.*`; generator: `src/agent/facets/psychology.ts`; UI: `src/agentsView.ts` | Catalog narrative prompts still not encoded. |
| agent-conversation-topics-catalog.md | Integrated | Vocab: `civicLife.conversationTopics`; generator: `src/agent/facets/social.ts`; UI: `src/agentsView.ts` | — |
| agent-knowledge-ignorance-catalog.md | Integrated (lists + sources/barriers + depth + confidence/decay) | Vocab: `knowledgeIgnorance.*`; generator: `src/agent/facets/psychology.ts`; UI: `src/agentsView.ts` | Learning progression still not modeled. |
| agent-personality-facets-catalog.md | Integrated | Vocab: `personality.facetNames`, `personality.facetCategories`; generator: `src/agent/personalityFacets.ts`; UI: `src/agentsView.ts` | Facet-to-behavior narrative ties still light. |
| agent-psychology-types-catalog.md | Integrated | Vocab: `psychologyTypes.*`; generator: `src/agent/facets/psychology.ts`; UI: `src/agentsView.ts` | Weighting heuristic-only (no lifecycle progression). |
| agent-artistic-expression-catalog.md | Integrated (creativity profile) | Vocab: `preferences.artistic.*`; generator: `src/agent/facets/preferences.ts`; UI: `src/agentsView.ts` | Snapshot-only (mediums, specialization, themes, learning, challenges). |
| agent-cultural-social-dynamics-catalog.md | Integrated (archetype lists) | Vocab: `culturalDynamics.*`; generator: `src/agent/facets/social.ts`; UI: `src/agentsView.ts` | Deeper causality not modeled. |
| agent-needs-relationships-catalog.md | Integrated (archetypes) | Vocab: `needsRelationships.*`; generator: `src/agent/facets/social.ts`; UI: `src/agentsView.ts` | Catalog-specific narrative arcs still missing. |
| agent-economic-mobility-catalog.md | Integrated (mobility archetypes) | Vocab: `economicMobility.*`; generator: `src/agent/generator.ts`; UI: `src/agentsView.ts` | Deeper mechanics not modeled yet. |
| agent-dreams-goals-catalog.md | Integrated (dream lists) | Vocab: `dreamsGoals.dreams`; generator: `src/agent/generator.ts`; UI: `src/agentsView.ts` | Category weighting not modeled yet. |
| agent-dreams-nightmares-catalog.md | Integrated (dream/nightmare lists) | Vocab: `dreamsNightmares.*`; generator: `src/agent/generator.ts`; UI: `src/agentsView.ts` | Category weighting not modeled yet. |
| agent-event-template-catalog.md | Integrated (timeline templates) | Vocab: `timelineTemplates.*`; generator: `src/agent/facets/narrative.ts`; UI: `src/agentsView.ts` | Uses template snippets only; richer event taxonomies not modeled. |
| agent-detail-generation-catalog.md | Integrated (detail markers) | Vocab: `detailGeneration.*`; generator: `src/agent/facets/details.ts`; UI: `src/agentsView.ts` | Snapshot-only (3–5 details). |
| agent-decision-templates-catalog.md | Integrated (decision style) | Vocab: `decisionTemplates.*`; generator: `src/agent/facets/decisionStyle.ts`; UI: `src/agentsView.ts` | Snapshot-only (3–5 tendencies). |
| agent-existence-crisis-catalog.md | Integrated (snapshot) | Vocab: `existenceCrises.*`; generator: `src/agent/facets/psychology.ts`; UI: `src/agentsView.ts` | Long-term progression not modeled. |
| agent-psychology-integration-guide.md | Not integrated | Guide only | Not a data source. |
| agent-skills-personality-evolution-catalog.md | Not integrated | No skill evolution system in vocab | None. |
| agent-behavior-catalog.md | Integrated (behavior lens) | Vocab: `behaviorArchetypes.*`; generator: `src/agent/facets/behavior.ts`; UI: `src/agentsView.ts` | Snapshot-only (archetype + 3–5 reads). |

Non-agent catalogs used for personality system

| Catalog | Coverage | Evidence | Notes |
| --- | --- | --- | --- |
| personality-trait-catalog.md | Integrated | Vocab: `personality.traitNames`, `personality.traitCategories`; generator: `src/agent/personalityFacets.ts` | Used for trait triad selection. |
| personality-quirk-combination-catalog.md | Integrated | Vocab: `personality.quirkCombinations`; generator: `src/agent/personalityFacets.ts` | Rules now added for all combos. |
