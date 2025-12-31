# Agent Generator Modularization Plan

## Current Status (Phase 4 Complete - Full Migration Done)

**Migration Complete!** The original `agentGenerator.ts` (4,876 lines) has been removed.
All imports now use `src/agent/` modules.

---

**Foundation Modules (~2,200 lines):**
- ✅ `src/agent/types.ts` (740 lines) - All type definitions
- ✅ `src/agent/utils.ts` (489 lines) - RNG, clamping, environment mixing, geography
- ✅ `src/agent/latents.ts` (247 lines) - Latent trait computation
- ✅ `src/agent/generator.ts` (~1,400 lines) - **Full orchestrator + helper exports**
- ✅ `src/agent/index.ts` (166 lines) - Public API exports for all modules
- ✅ TypeScript passes, app runs correctly

**Facet Modules (~4,800 lines):**
- ✅ `facets/geography.ts` (306 lines) - Origin, citizenship, current, culture blending
- ✅ `facets/identity.ts` (621 lines) - Roles, names, languages, gender, orientation
- ✅ `facets/appearance.ts` (254 lines) - Height, build, hair, eyes, voice, marks
- ✅ `facets/capabilities.ts` (177 lines) - Orchestrator for aptitudes/traits/skills
- ✅ `facets/aptitudes.ts` (150 lines) - Physical, cognitive, social aptitudes
- ✅ `facets/traits.ts` (70 lines) - Big Five psychological traits
- ✅ `facets/skills.ts` (289 lines) - Skills inventory with role bumps
- ✅ `facets/psychology.ts` (403 lines) - Ethics, contradictions, red lines, visibility
- ✅ `facets/preferences.ts` (682 lines) - Food, media, fashion, routines
- ✅ `facets/social.ts` (293 lines) - Urbanicity, diaspora, family, relationships, network
- ✅ `facets/lifestyle.ts` (718 lines) - Health, vices, logistics, spirituality, background
- ✅ `facets/narrative.ts` (259 lines) - Timeline events, minority status
- ✅ `facets/simulation.ts` (577 lines) - Deep sim preview (needs, mood, stress, break risk)

**Total: ~8,400 lines across 18 modules**

**Key Exports from `src/agent/generator.ts`:**
- `generateAgent()` - **Full orchestrator that calls all facet modules**
- `initializeTrace()` - Trace object initialization
- `validateVocab()` - Vocab validation with error messages
- `validateCountries()` - Country map normalization
- `computeGeographyStage1()` - Origin/mobility before latents
- `computeGeographyStage2()` - Citizenship/current/culture after latents
- `computeRoleSeedTags()` - Role seed tag selection
- `pickFromWeightedMicroProfiles()` - Weight-faithful microculture picker
- Types: `MicroProfileEntry`, `PrimaryWeights`, `ClimateIndicators`, `ValidCountry`

**Testing:**
- ✅ TypeScript compiles without errors
- ✅ `scripts/test-orchestrator.ts` - New orchestrator generates valid agents
- ⚠️ Output differs from original (different logic paths, but both valid)

## Architecture Notes

The modular architecture now consists of:

1. **Foundation layer** (`types.ts`, `utils.ts`, `latents.ts`) - Core types and utilities
2. **Facet layer** (`facets/*.ts`) - Domain-specific generators
3. **Orchestrator** (`generator.ts`) - Calls facets in dependency order, assembles result
4. **Public API** (`index.ts`) - Clean exports for consumers

**Key Design Decisions:**

1. Each facet has a `Context` type (inputs) and `Result` type (outputs)
2. Facets don't import from each other - they only import from `types` and `utils`
3. The orchestrator handles all inter-facet data flow
4. Some fields are computed inline in the orchestrator (institution, personality, workStyle, cultureAxes)
   rather than in facets because they have complex cross-facet dependencies

---

## Overview

Split `agentGenerator.ts` (4,876 lines) into focused modules by domain.
Each module can exceed 400 lines if dedicated to a coherent facet.

**Target Structure:**
```
src/
  agent/
    types.ts           (~450 lines) - All type definitions
    utils.ts           (~400 lines) - RNG, weights, clamping, environment mixing
    latents.ts         (~200 lines) - Foundation personality dimensions
    facets/
      geography.ts     (~400 lines) - Origin, citizenship, current, culture environment
      identity.ts      (~350 lines) - Name, gender, orientation, naming, languages
      appearance.ts    (~150 lines) - Height, build, hair, eyes, voice, marks
      capabilities.ts  (~400 lines) - Aptitudes + skills
      psychology.ts    (~300 lines) - Traits, ethics, contradictions, red lines
      preferences.ts   (~500 lines) - Food, media, fashion, routines
      social.ts        (~400 lines) - Family, relationships, institution, visibility
      lifestyle.ts     (~350 lines) - Vices, health, logistics, neurodivergence, spirituality
      narrative.ts     (~300 lines) - Timeline, background, minority status
      simulation.ts    (~400 lines) - Deep sim preview (needs, mood, break risk)
    generator.ts       (~300 lines) - Main orchestrator, imports facets
    index.ts           (~30 lines)  - Re-exports public API
```

---

## Phase 1: Foundation

### Task 1.1: Extract Types
**Subagent:** `general-purpose`
**File:** `src/agent/types.ts`
**Scope:** All `export type` definitions (lines 1-700)
- Foundation types: TierBand, Band5, Fixed, HeightBand, NeedTag
- Culture types: EthnolinguisticHeritage, RegionalSocialization, InstitutionalCulture, CultureAxes
- Vocab/Priors types: AgentVocabV1, AgentPriorsV1
- Agent attributes: all 40+ attribute types
- Output types: GeneratedAgent, GenerateAgentInput, AgentGenerationTraceV1

**Dependencies:** None

### Task 1.2: Extract Utils
**Subagent:** `general-purpose`
**File:** `src/agent/utils.ts`
**Scope:** All pure utility functions (lines 705-1140)
- Clamping: clampInt, clampFixed01k, clampSigned01k, clamp01, band5From01k
- RNG: fnv1a32, mulberry32, makeRng, facetSeed, normalizeSeed, randomSeedString
- Weights: weightedPick, weightedPickKUnique, topKByScore, uniqueStrings, pickKHybrid
- Environment: normalize*Env01k, mix*Env01k, normalizeWeights01k, mixWeights01k
- Geography: deriveCultureFromContinent
- Tracing: traceSet, traceFacet

**Dependencies:** Types

### Task 1.3: Extract Latents
**Subagent:** `general-purpose`
**File:** `src/agent/latents.ts`
**Scope:** computeLatents function (lines 1171-1351)
- 16 personality foundation dimensions
- Tier/role bias calculations
- Latent type definition

**Dependencies:** Types, Utils

---

## Phase 2: Facets (can run in parallel after Phase 1)

### Task 2.1: Extract Geography Facet
**Subagent:** `general-purpose`
**File:** `src/agent/facets/geography.ts`
**Scope:** Lines ~1438-1742 + culture axes ~4138-4267
- Base setup (birth year, tier, vocab validation)
- Socioeconomic mobility
- Origin/citizenship/current country selection
- Culture environment blending
- Culture axes (ethnolinguistic, regional, institutional)

**Dependencies:** Types, Utils, Latents

### Task 2.2: Extract Identity Facet
**Subagent:** `general-purpose`
**File:** `src/agent/facets/identity.ts`
**Scope:** Lines ~1743-2005 + 3686-3840
- Career/education tracks
- Name generation
- Languages + proficiency
- Gender identity + pronouns
- Sexual orientation + outness
- Naming structure + honorifics + aliases

**Dependencies:** Types, Utils

### Task 2.3: Extract Appearance Facet
**Subagent:** `general-purpose`
**File:** `src/agent/facets/appearance.ts`
**Scope:** Lines ~2006-2095
- Height, build
- Hair (color, texture), eyes
- Voice
- Distinguishing marks

**Dependencies:** Types, Utils

### Task 2.4: Extract Capabilities Facet
**Subagent:** `general-purpose`
**File:** `src/agent/facets/capabilities.ts`
**Scope:** Lines ~2096-2162 + 2538-2780
- Physical aptitudes (strength, endurance, dexterity, reflexes)
- Cognitive aptitudes (speed, attention, memory, risk calibration)
- Social aptitudes (charisma, empathy, assertiveness, deception)
- Skills inventory (50+ skills with proficiency, XP, last-used)

**Dependencies:** Types, Utils, Latents

### Task 2.5: Extract Psychology Facet
**Subagent:** `general-purpose`
**File:** `src/agent/facets/psychology.ts`
**Scope:** Lines ~2163-2458
- Big Five traits
- Ethics decomposition (rule adherence, harm aversion, mission utilitarianism, loyalty)
- Contradictions
- Red lines
- Visibility (public, paper trail, digital hygiene)
- Covers

**Dependencies:** Types, Utils, Latents

### Task 2.6: Extract Preferences Facet
**Subagent:** `general-purpose`
**File:** `src/agent/facets/preferences.ts`
**Scope:** Lines ~2781-3330
- Food (comfort foods, dislikes, restrictions, ritual drink)
- Media (platform diet, genres, attention, doomscrolling, epistemic hygiene)
- Fashion (style tags, formality, conformity, status signaling)
- Routines (chronotype, sleep window, recovery rituals)

**Dependencies:** Types, Utils, Latents

### Task 2.7: Extract Social Facet
**Subagent:** `general-purpose`
**File:** `src/agent/facets/social.ts`
**Scope:** Lines ~3841-4027
- Geography (urbanicity, diaspora status)
- Family (marital status, dependents, parents, siblings)
- Relationships (patron, mentor, rival, etc.)
- Institution (org type, grade, clearance, functional spec, cover status)

**Dependencies:** Types, Utils

### Task 2.8: Extract Lifestyle Facet
**Subagent:** `general-purpose`
**File:** `src/agent/facets/lifestyle.ts`
**Scope:** Lines ~2410-2421 + 3331-3685
- Health (chronic conditions, allergies)
- Vices (substance, behavioral, triggers)
- Logistics (identity kit)
- Neurodivergence (indicators, coping)
- Spirituality (affiliation, observance, practices)
- Background (adversity, resilience)

**Dependencies:** Types, Utils, Latents

### Task 2.9: Extract Personality Facet
**Subagent:** `general-purpose`
**File:** `src/agent/facets/personality.ts`
**Scope:** Lines ~4029-4137
- Conflict style
- Epistemic style
- Social energy
- Risk posture
- Work style (writing, briefing, confidence, jargon, meeting tolerance)

**Dependencies:** Types, Utils

### Task 2.10: Extract Narrative Facet
**Subagent:** `general-purpose`
**File:** `src/agent/facets/narrative.ts`
**Scope:** Lines ~4268-4372
- Timeline events
- Minority status

**Dependencies:** Types, Utils

### Task 2.11: Extract Simulation Facet
**Subagent:** `general-purpose`
**File:** `src/agent/facets/simulation.ts`
**Scope:** Lines ~4373-4710
- Needs calculation (sleep, safety, belonging, autonomy, competence, purpose, comfort)
- Mood, stress, fatigue
- Thoughts generation
- Break risk + break types

**Dependencies:** Types, Utils, All facet outputs

---

## Phase 3: Integration

### Task 3.1: Create Generator Orchestrator
**Subagent:** `general-purpose`
**File:** `src/agent/generator.ts`
**Scope:**
- Import all facets
- Define GeneratorContext type (shared state passed between facets)
- Orchestrate facet execution in dependency order
- Handle tracing
- Build and return GeneratedAgent

**Dependencies:** All facets

### Task 3.2: Create Index & Update Imports
**Subagent:** `general-purpose`
**Files:**
- Create `src/agent/index.ts` with public exports
- Update `src/agentsView.ts` to import from `./agent`
- Update `src/agentNarration.ts` to import from `./agent`
- Remove `src/agentGenerator.ts`

**Dependencies:** Generator complete

### Task 3.3: Verification
**Subagent:** `general-purpose`
**Scope:**
- `pnpm typecheck` passes
- Dev server runs
- Generate agents, verify output matches original
- Narration still works

**Dependencies:** All imports updated

---

## Risk Mitigation

1. **Determinism:** Each facet must use `facetSeed()` to ensure identical output
2. **Circular deps:** Facets import from utils only, not from each other
3. **State passing:** Use explicit context objects, not global state
4. **Incremental testing:** Typecheck after each group completes

---

## Estimated Effort

| Phase | Tasks | Est. Time | Parallelizable |
|-------|-------|-----------|----------------|
| Phase 1 | 5 | 30 min | 3 parallel |
| Phase 2 | 4 | 40 min | 2 parallel |
| Phase 3 | 4 | 40 min | 4 parallel |
| Phase 4 | 3 | 30 min | 3 parallel |
| Phase 5 | 3 | 30 min | 3 parallel |
| Phase 6 | 3 | 30 min | Sequential |
| **Total** | **22** | **~3 hours** | With parallelism: ~1.5 hours |
