# Catalog Coverage Report

Coverage levels:
- Integrated: explicit vocab + generator logic present.
- Partial: some vocab/logic exists, but most catalog content not represented.
- Not integrated: no dedicated vocab or generator logic.

Agent catalogs

| Catalog | Coverage | Evidence | Gaps / Notes |
| --- | --- | --- | --- |
| agent-preferences-catalog.md | Partial | `data/agent-generation/v1/vocab.json` -> `preferences.*`; generator: `src/agent/facets/preferences.ts`; UI: `src/agentsView.ts` | Catalog includes richer context (rituals, narratives, sensory detail) not represented in vocab. |
| agent-preferences-aesthetics-catalog.md | Partial | Vocab: `preferences.fashion`, `preferences.environment`, `preferences.livingSpace`; generator: `src/agent/facets/preferences.ts` | No color/texture/olfactory/audio/tactile preferences. |
| agent-food-culture-catalog.md | Partial | Vocab: `preferences.food.*`; generator: `src/agent/facets/preferences.ts` | No cuisine-level or preparation style modeling. |
| agent-living-spaces-catalog.md | Partial | Vocab: `preferences.livingSpace.*`, `home.*`; generator: `src/agent/facets/preferences.ts`, `src/agent/facets/domestic.ts` | Missing deeper spatial aesthetic / narrative behaviors. |
| agent-daily-life-catalog.md | Integrated (core lists) | Vocab: `everydayLife.*`; generator: `src/agent/facets/domestic.ts`; UI: `src/agentsView.ts` | Only list-level coverage, not full narrative detail. |
| agent-memory-trauma-catalog.md | Integrated | Vocab: `memoryTrauma.*`; generator: `src/agent/facets/lifestyle.ts`; UI: `src/agentsView.ts` | Narrative detail from catalog not encoded. |
| agent-physical-health-catalog.md | Integrated | Vocab: `health.*`; generator: `src/agent/facets/lifestyle.ts`; UI: `src/agentsView.ts` | Symptom progression/medical history depth not modeled. |
| agent-physical-details-catalog.md | Integrated | Vocab: `appearance.*`; generator: `src/agent/facets/appearance.ts`; UI: `src/agentsView.ts` | Some detailed sub-features not represented (e.g., tattoos/scars specifics). |
| agent-substance-dependency-catalog.md | Partial | Vocab: `vices.*`, `viceCategorization`; generator: `src/agent/facets/lifestyle.ts` | No dependency stages, recovery arcs, or severity progression. |
| agent-thoughts-emotions-catalog.md | Partial | Vocab: `affect.*`, `selfConcept.*`, `deepSimPreview.*`; generator: `src/agent/facets/psychology.ts`, `src/agent/facets/simulation.ts` | Catalog taxonomies and narrative prompts mostly absent. |
| agent-conversation-topics-catalog.md | Integrated | Vocab: `civicLife.conversationTopics`; generator: `src/agent/facets/social.ts`; UI: `src/agentsView.ts` | — |
| agent-knowledge-ignorance-catalog.md | Integrated (lists + sources/barriers + depth scores) | Vocab: `knowledgeIgnorance.*`; generator: `src/agent/facets/psychology.ts`; UI: `src/agentsView.ts` | Decay/learning not modeled yet. |
| agent-personality-facets-catalog.md | Integrated | Vocab: `personality.facetNames`, `personality.facetCategories`; generator: `src/agent/personalityFacets.ts` | UI does not display facets yet. |
| agent-psychology-types-catalog.md | Not integrated | No psychology type system in vocab or generator | We have personality styles, not type archetypes. |
| agent-artistic-expression-catalog.md | Partial | Vocab: `preferences.hobbies.creative` (and some media/hobbies); generator: `src/agent/facets/preferences.ts` | Missing explicit artistic mediums and expression detail. |
| agent-cultural-social-dynamics-catalog.md | Partial | Vocab: `cultureAxes`, `communities`, `reputation`; generator: `src/agent/facets/social.ts`, `src/agent/facets/geography.ts` | Not sourced from this catalog; only overlaps. |
| agent-needs-relationships-catalog.md | Partial | Vocab: `family`, `relationships`, `attachments`, `attachmentStyle`; generator: `src/agent/facets/social.ts`, `src/agent/facets/domestic.ts`, `src/agent/generator.ts` | Catalog-specific needs/relationship archetypes not encoded. |
| agent-economic-mobility-catalog.md | Not integrated | No vocab mappings; economics facet is internally defined | Catalog concepts not represented. |
| agent-dreams-goals-catalog.md | Not integrated | Motivations exist but not sourced from catalog | Could map to motivations/fears. |
| agent-dreams-nightmares-catalog.md | Not integrated | No dream/nightmare fields | None. |
| agent-event-template-catalog.md | Not integrated | Narrative events are hard-coded in `src/agent/facets/narrative.ts` | No vocab list or templates. |
| agent-detail-generation-catalog.md | Not integrated | No direct vocab mapping | None. |
| agent-decision-templates-catalog.md | Not integrated | No decision templates in vocab | None. |
| agent-existence-crisis-catalog.md | Not integrated | No existential crisis fields | None. |
| agent-psychology-integration-guide.md | Not integrated | Guide only | Not a data source. |
| agent-skills-personality-evolution-catalog.md | Not integrated | No skill evolution system in vocab | None. |
| agent-behavior-catalog.md | Not integrated | No behavior templates in vocab | None. |

Non-agent catalogs used for personality system

| Catalog | Coverage | Evidence | Notes |
| --- | --- | --- | --- |
| personality-trait-catalog.md | Integrated | Vocab: `personality.traitNames`, `personality.traitCategories`; generator: `src/agent/personalityFacets.ts` | Used for trait triad selection. |
| personality-quirk-combination-catalog.md | Integrated | Vocab: `personality.quirkCombinations`; generator: `src/agent/personalityFacets.ts` | Rules now added for all combos. |
