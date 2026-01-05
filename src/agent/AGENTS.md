# Agent Generator - AGENTS.md

Cross-agent policies for the agent generation system.

## Architecture

The agent generator uses a **faceted architecture** where each facet handles a specific domain of agent attributes. The main orchestrator (`generator.ts`) coordinates facets in dependency order.

```
src/agent/
├── generator.ts      # Main orchestrator - coordinates all facets
├── latents.ts        # Hidden psychological attributes (0-1000 scale)
├── types.ts          # TypeScript interfaces for GeneratedAgent
├── utils.ts          # Seeded RNG, weighted picking, culture blending
├── index.ts          # Public exports
└── facets/           # 14 domain-specific generation modules
    └── AGENTS.md     # Facet-specific documentation
```

## Key Concepts

### Seeded Determinism

All agent generation is deterministic given a seed:

```typescript
const rng = makeRng(facetSeed(seed, 'facetName'));
const value = rng.int(0, 1000);  // Always same for same seed
```

### Fixed Scale (0-1000)

All continuous attributes use a 0-1000 integer scale called `Fixed`:
- Avoids floating point issues
- Easy percentile interpretation (500 = median)
- Use `clampFixed01k()` after arithmetic

### Latents

Hidden psychological attributes computed early, influencing many facets:
- `cosmopolitanism`, `institutionalEmbeddedness`, `riskAppetite`
- `opsecDiscipline`, `publicness`, `socialBattery`
- `principledness`, `techFluency`, `aestheticExpressiveness`

### Weighted Picking

Major decisions use probabilistic selection:

```typescript
const result = weightedPick(rng, [
  { item: 'optionA', weight: baseWeight * correlate1 },
  { item: 'optionB', weight: baseWeight * correlate2 },
]);
```

## Generation Flow

1. **Base Setup**: Parse seed, determine birth year, tier band
2. **Geography Stage 1**: Origin country, citizenship, current location
3. **Role Seed Tags**: 2-4 tags (operative, diplomat, analyst, etc.)
4. **Latents**: Compute hidden psychological attributes
5. **Geography Stage 2**: Culture blending using cosmopolitanism
6. **Identity**: Names, languages, gender, career track
7. **Appearance**: Height, build, hair, voice
8. **Capabilities**: Aptitudes → Traits → Skills (cascaded)
9. **Psychology**: Ethics, contradictions, visibility
10. **Preferences**: Food, media, fashion, routines
11. **Social**: Family, network position, reputation
12. **Lifestyle**: Health, vices, spirituality
13. **Domestic**: Housing, legal status, life skills
14. **Narrative**: Timeline events, minority status
15. **Simulation**: Day-0 preview (needs, mood, break risk)

## Correlates

Cross-facet relationships ensure realistic agents. See `facets/AGENTS.md` for the complete correlate list.

**Key correlates:**
- Tier affects education, health, housing
- Age affects family structure, network position, community status
- Latents (cosmo, religiosity, risk) cascade through many facets
- Traits (conscientiousness, authoritarianism) affect lifestyle choices

## Modifying the Generator

### Adding a New Attribute

1. Add type to `types.ts`
2. Add computation to appropriate facet in `facets/`
3. Wire up in `generator.ts` orchestrator
4. Ensure any correlates are documented

### Adding a New Correlate

1. Identify source and target facets
2. Pass required data through Context types
3. Apply correlation in target facet with comment: `// Correlate #X`
4. Document in `facets/AGENTS.md`

### Testing

```bash
# Generate agents and validate narration
pnpm test:narration -- --count 100

# Type check
pnpm typecheck
```

### Agent Audit

Run a comprehensive audit of generated agents to detect errors and validate correlations:

```bash
npx tsx scripts/audit-agents.ts --count 100 --seedPrefix audit --out /tmp/audit-report.json
```

**What it checks:**

1. **Narration Errors** (20 patterns): Grammar issues, undefined/null text, `[object Object]` leaks, article-vowel errors, dangling punctuation
2. **Type Errors**: Fixed values (0-1000) in range, valid enums, required fields present
3. **Constraint Violations**: Same-country diaspora can't be expat/refugee, elite tier can't have couch-surfing housing
4. **Implausibilities**: High opsec + high publicness, elite tier + extreme poverty, zero fluency in home language
5. **Correlation Analysis**:
   - Verifies documented correlates have |r| > 0.1
   - Flags undocumented correlations with |r| > 0.3 as potentially spurious

**Output format:**
```json
{
  "summary": { "totalAgents": 100, "agentsWithErrors": 0, "errorsByType": {...} },
  "narrationErrors": [...],
  "typeErrors": [...],
  "constraintViolations": [...],
  "implausibilities": [...],
  "correlationAnalysis": {
    "documented": [{ "id": "#1", "name": "Age ↔ Physical Conditioning", "observedR": -0.34, "status": "verified" }],
    "spurious": [{ "variables": ["x", "y"], "observedR": 0.5, "concern": "..." }]
  }
}
```

**Documented correlates verified:**
| ID | Correlate | Expected |
|----|-----------|----------|
| #1 | Age ↔ Physical Conditioning | negative |
| #3 | Tier ↔ Education | positive |
| #5 | Cosmopolitanism ↔ Abroad | positive |
| #9 | Travel ↔ Tradecraft | positive |
| #13 | Conscientiousness ↔ Housing | positive |
| #15 | Risk Appetite ↔ Housing Instability | positive |

## Type Safety

- `HeightBand`: Uses underscores (`very_tall`), not hyphens
- `TierBand`: `'elite' | 'middle' | 'mass'`
- `Fixed`: 0-1000 integer (use type, not raw number)
- Pronouns: Match realistic distributions (~95%+ cis-matching)

---

**Last Updated**: 2026-01-05
