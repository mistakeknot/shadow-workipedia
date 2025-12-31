# Agent Data Files - Guidelines for AI Agents

This directory contains large JSON data files that define agent generation vocabulary and country/era priors. These files are too large to read in full context, so follow these patterns.

## File Overview

| File | Size | Purpose |
|------|------|---------|
| `agent-vocab.v1.json` | ~2000 lines | Vocabulary pools for agent attributes |
| `agent-priors.v1.json` | ~15000+ lines | Country/era statistical priors |
| `shadow-country-map.json` | ~500 lines | Real → shadow country mappings |

## Working with agent-vocab.v1.json

### Structure (top-level keys)

```
names           - First/last name pools by culture
appearance      - Height, build, hair, eyes, voice, marks
personality     - Big Five traits, temperament tags
skills          - Skill categories and specific skills
aptitudes       - Cognitive/physical aptitude dimensions
visibility      - Public/stealth role tags
health          - Chronic conditions, allergies
covers          - Cover identity aptitudes and backstories
mobility        - Travel frequency, passport access bands
preferences     - Food, drinks, media, fashion
routines        - Chronotypes, recovery rituals, sleep windows
relationships   - Relationship types, family structures
vices           - Vice pool, triggers, break types
logistics       - Identity kit items, communication methods
cultureProfiles - Macro-culture definitions (8 profiles)
microCultureProfiles - Language → culture mappings (40+)
```

### How to Edit

1. **Find the section** using Grep:
   ```bash
   # Find chronotypes
   grep -n "chronotypes" public/agent-vocab.v1.json

   # Find vices section
   grep -n '"vicePool"' public/agent-vocab.v1.json
   ```

2. **Read context around the line** using Read with offset/limit:
   ```
   Read file with offset=(line-10), limit=30
   ```

3. **Make surgical edits** - Edit only the specific array/object, not surrounding structure

4. **Validate JSON** after editing:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('public/agent-vocab.v1.json'))"
   ```

5. **Run narration tests** to catch grammar issues:
   ```bash
   pnpm test:narration
   ```

### Section Line Numbers (approximate)

These may drift as the file is edited - use Grep to find current locations:

- `names`: ~1-200
- `appearance`: ~200-400
- `personality`: ~400-500
- `visibility`: ~525-530
- `health`: ~530-540
- `mobility`: ~555-560
- `preferences`: ~560-860
- `routines`: ~860-900
- `vices`: ~900-1040
- `cultureProfiles`: ~1080-1500
- `microCultureProfiles`: ~1500-1900

## Working with agent-priors.v1.json

### Structure

```json
{
  "version": 1,
  "countries": {
    "USA": {
      "buckets": {
        "1960": { /* decade-specific data */ },
        "1970": { ... },
        ...
        "2020": { ... }
      }
    },
    "CHN": { ... },
    // 240+ countries
  }
}
```

### Bucket Contents (per country-decade)

Each bucket contains:
- `indicators` - Raw statistics (GDP, population, literacy, etc.)
- `languages01k` - Language distribution weights (sum to 1000)
- `foodEnvironment01k` - Food culture axes (spice, seafood, street food, etc.)
- `cultureEnvironment01k` - Cultural dimensions
- `securityEnvironment01k` - Security/conflict indicators
- `appearance.heightBandWeights01k` - Height distribution
- `mediaEnvironment01k` - Media consumption patterns
- `educationTrackWeights` - Education path probabilities
- `careerTrackWeights` - Career path probabilities

### How to Edit

1. **Find a specific country**:
   ```bash
   grep -n '"USA":' public/agent-priors.v1.json
   ```

2. **Read one country's data** - typically 200-300 lines per country

3. **For bulk changes**, consider editing the generation script:
   `scripts/generate-agent-priors.ts`

## Validation Checklist

Before committing changes to these files:

- [ ] JSON is valid (no trailing commas, proper quoting)
- [ ] Arrays maintain consistent style (one item per line for long lists)
- [ ] New tags follow kebab-case convention
- [ ] `pnpm test:narration` passes
- [ ] Generated agents display correctly in UI

## Adding New Categories

When adding entirely new top-level categories to vocab:

1. Add the category to `agent-vocab.v1.json`
2. Update type definitions in `src/agentGenerator.ts` (AgentVocabV1 type)
3. Add generation logic in `src/agentGenerator.ts`
4. Update display in `src/agentsView.ts`
5. Add narration rules in `src/agentNarration.ts` if needed

## Common Patterns

### Weighted pools
Many arrays are used with weighted random selection. Items earlier in the array don't have priority - weights are calculated dynamically based on agent attributes.

### 01k notation
Values suffixed with `01k` are integers 0-1000 representing 0.0-1.0 (permille). This avoids floating point in JSON.

### Culture cascading
Agent generation cascades: country priors → macro culture → micro culture → individual preferences. Each layer can override or blend with the previous.
