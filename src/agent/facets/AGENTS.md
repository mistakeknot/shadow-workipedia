# Agent Facets - AGENTS.md

Cross-agent policies for the agent generation facets system.

## Overview

This directory contains 14 modular facets that generate different aspects of agent profiles. Each facet follows a consistent pattern: **context in → deterministic computation → result out**, using seeded RNGs for reproducibility.

## Facet Dependencies

```
seed + vocab + country context
         ↓
    Geography Stage 1 (origin, citizenship, current)
         ↓
    Role Seed Tags
         ↓
    Latents (computed from seed + tier + roles)
         ↓
    Geography Stage 2 (culture blending with cosmo latent)
         ↓
    Identity (names, languages, gender, career tracks)
         ↓
    Appearance (height, build, hair, voice)
         ↓
    Capabilities (aptitudes → traits → skills)
         ↓
    Psychology (ethics, contradictions, visibility)
         ↓
    Preferences (food, media, fashion, routines)
         ↓
    Social (family, network, reputation)
         ↓
    Lifestyle (health, vices, spirituality)
         ↓
    Domestic (housing, legal, life skills)
         ↓
    Narrative (timeline, minority status)
         ↓
    Simulation (day-0 needs, mood, break risk)
```

## File Reference

| File | Purpose | Key Outputs |
|------|---------|-------------|
| `identity.ts` | Core identity | roleSeedTags, careerTrack, name, languages, gender |
| `geography.ts` | Origin and culture | homeCountry, citizenship, cultureEnvironment |
| `appearance.ts` | Physical attributes | heightBand, buildTag, hair, voiceTag |
| `aptitudes.ts` | Base abilities | strength, cognitiveSpeed, charisma (13 total) |
| `traits.ts` | Personality | riskTolerance, conscientiousness, authoritarianism |
| `capabilities.ts` | Orchestrator | Calls aptitudes → traits → skills |
| `skills.ts` | Competencies | driving, shooting, tradecraft, negotiation (10+) |
| `psychology.ts` | Deep psychology | ethics, contradictions, redLines, visibility |
| `preferences.ts` | Lifestyle choices | food, media, fashion, routines, environment, social, work, quirks |
| `lifestyle.ts` | Health/habits | vices, spirituality, background, memory/trauma |
| `social.ts` | Relationships | family, network role, reputation, communities |
| `domestic.ts` | Daily life | housing, thirdPlaces, legalStatus |
| `narrative.ts` | Life history | timeline events, minorityStatus |
| `simulation.ts` | Day-0 state | needs, mood, stress, breakRisk |

## Correlates System

Correlates are cross-facet relationships that ensure realistic agent generation. When modifying any facet, check for correlate impacts.

### Active Correlates

**Tier-Based:**
- #2 Tier ↔ Health (lifestyle.ts): Elite gets better healthcare outcomes
- #3 Tier ↔ Education (identity.ts): Elite prefers graduate/doctorate
- Tier ↔ Housing (domestic.ts): Elite owns, mass rents precariously

**Age-Based:**
- #1 Age ↔ Physical Conditioning (latents.ts): Conditioning declines with age; stress accumulates
- #4 Age ↔ Family (social.ts): Marriage/children peak 28-45
- #6 Age ↔ Network Role (social.ts): Young=peripheral, senior=hub
- Age ↔ Community Status (social.ts): Elders become pillars

**Latent-Based:**
- #5 Cosmopolitanism ↔ Diaspora (geography.ts, social.ts)
- #7 Religiosity ↔ Vices (lifestyle.ts): Strict observance reduces vices
- #9 Travel ↔ Skills (skills.ts): Travel boosts tradecraft/negotiation
- #11 Empathy+Deception ↔ Network (social.ts): Shapes network role
- #12 Authoritarianism ↔ Conflict Style (generator.ts)
- #14 Visibility ↔ Reputation (social.ts): High visibility = defined reputation

**Trait-Based:**
- #13 Conscientiousness ↔ Housing (domestic.ts): High = stable housing
- #15 Risk ↔ Housing (domestic.ts): High risk = transient housing
- Social Battery ↔ Third Places (domestic.ts): Determines venue count
- #8 Build/Height ↔ Gait (generator.ts): Physical presence correlates with build/height

**Cross-Latent Correlations:**
- Opsec ↔ Publicness (latents.ts): Negative correlation - high opsec suppresses publicness and vice versa
- Opsec ↔ Tradecraft (skills.ts): Positive correlation - opsec discipline is core to tradecraft skill
- Risk Appetite ↔ Tradecraft (skills.ts): Positive correlation - risk takers develop operational skills
- Tier ↔ Housing (domestic.ts): Positive correlation - higher tier means more stable housing

### Country Priors & Indicators

The priors file includes `countries[*].buckets[*].indicators` (GDP, trade openness, air travel, UCDP conflict series, military spend, urbanization). These are wired in as **small, clamped nudges** (never hard constraints) to improve realism:

- `urbanPopulationPct` → `geography.urbanicity` weighting (social.ts)
- `gdpPerCapUsd` → education/housing stability nudges (identity.ts, domestic.ts)
- `exportsPctGdp` + `importsPctGdp` → openness nudges for career/mobility/citizenship (identity.ts, lifestyle.ts, generator.ts)
- `airPassengersPerCap` → abroad/mobility/travel nudges (identity.ts, lifestyle.ts, generator.ts)
- `militaryExpenditurePctGdp` → defense/intel institution/career nudges + militarization signal (identity.ts, generator.ts)
- `ucdp*` (conflict/deaths series) → blended security env + adversity weighting (generator.ts, lifestyle.ts)

## Implementation Patterns

### Adding a New Correlate

1. Identify the facets involved
2. Add required inputs to the facet's Context type
3. Apply correlation logic using normalized (0-1) values
4. Update the orchestrator (generator.ts) to pass the new inputs
5. Add comment with correlate number: `// Correlate #X: Name`
6. Document in this file

### Weighted Picking Pattern

```typescript
const weights = pool.map(item => {
  let w = 1;
  // Apply correlates
  if (condition1) w += factor1 * normalized_value;
  if (condition2) w *= Math.max(0.1, 1 - factor2 * value);
  return { item, weight: w };
});
const result = weightedPick(rng, weights);
```

### Value Scales

- **Fixed (0-1000)**: Primary scale for all attributes
- **Normalized (0-1)**: Use for weight calculations: `value / 1000`
- **Band5**: Categorical (low/med-low/medium/med-high/high)

## Testing

```bash
# Generate agents and check for grammar/consistency
pnpm test:narration -- --count 100

# Type check all facets
pnpm typecheck
```

## Common Mistakes

1. **Forgetting to normalize**: Always divide Fixed by 1000 before using in weight math
2. **Missing clamp**: Use `clampFixed01k()` after arithmetic to stay in range
3. **Circular dependencies**: Facets must not import from later-stage facets
4. **Unseeded randomness**: Never use `Math.random()`; always use `rng.int()` or `rng.float()`

---

**Last Updated**: 2026-01-05
