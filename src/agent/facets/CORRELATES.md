# Agent Generation Correlates

This document defines the cross-attribute correlations enforced in agent generation. Each correlate ensures realistic co-occurrence patterns across facets.

## Validation Status

All correlates are validated using Pearson correlation coefficient (r) against 1200 generated agents. A correlate is:
- **Verified**: |r| ≥ 0.15 in expected direction
- **Weak**: 0.05 ≤ |r| < 0.15 in expected direction
- **Missing**: |r| < 0.05
- **Inverted**: Correlation in wrong direction

**Last audit: 2026-01-06 | 57 correlates tested | 57 verified (100%)**

## Deterministic Threshold Approach

The agent generator uses a **hybrid deterministic/probabilistic** approach to guarantee correlations:

1. **Weighted Random Selection**: Initial attribute values are picked using weighted probabilities influenced by correlate factors
2. **Deterministic Post-Hoc Adjustment**: After selection, extreme cases are corrected to guarantee the correlation holds

This ensures correlations are stable regardless of sample size, while maintaining realistic variety.

### Example: #X5 Agreeableness ↔ Conflict Style

```typescript
// Step 1: Weighted selection (probabilistic)
let conflictStyle = weightedPick(rng, conflictWeights);

// Step 2: Deterministic post-hoc adjustment
if (agreeableness01 > 0.65 && aggressiveStyles.includes(conflictStyle)) {
  conflictStyle = rng.pick(cooperativeStyles); // High agreeableness MUST NOT be aggressive
}
```

### Correlates Using Deterministic Thresholds

| ID | Correlate | Threshold Logic | File |
|----|-----------|-----------------|------|
| #HL1 | Stress ↔ Chronic | healthVulnerabilityScore thresholds determine condition count | lifestyle.ts |
| #N5 | Family ↔ Religiosity | Families upgrade observance level by 1 | lifestyle.ts |
| #B3 | Conditioning ↔ Hobbies | High conditioning forces physical/outdoor category | preferences.ts |
| #X5 | Agreeableness ↔ Conflict | High agreeableness blocks aggressive styles | generator.ts |
| #12 | Authoritarianism ↔ Conflict | High auth forces competing (unless high agree) | generator.ts |
| #4 | Age ↔ Has Family | Older partnered people forced to have dependents | social.ts |
| #N3 | Conscientiousness ↔ Network | High conscientiousness upgrades network role | social.ts |
| #14 | Visibility ↔ Reputation | High visibility blocks low-reputation tags | social.ts |
| #N1 | Community ↔ Network | High community status upgrades network role | social.ts |

---

## Correlate Catalog (57 total)

### Tier-Based Correlates (6)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #2 | Tier ↔ Health | Positive | 0.36 | lifestyle.ts |
| #3 | Tier ↔ Education | Positive | 0.51 | identity.ts |
| #16 | Tier ↔ Housing Stability | Positive | 0.20 | domestic.ts |
| #17 | Tier ↔ Housing Instability | Negative | -0.20 | domestic.ts |
| #S1 | Tier ↔ Cosmopolitanism | Positive | 0.24 | latents.ts |
| #X1 | Tier ↔ Risk Appetite | Negative | -0.25 | latents.ts |

### Age-Based Correlates (8)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #1 | Age ↔ Physical Conditioning | Negative | -0.36 | latents.ts |
| #4 | Age ↔ Has Family | Positive | 0.28 | social.ts (deterministic) |
| #6 | Age ↔ Network Role | Positive | 0.43 | social.ts |
| #A1 | Age ↔ Tier | Positive | 0.21 | generator.ts |
| #A2 | Age ↔ Housing Stability | Positive | 0.34 | domestic.ts |
| #A3 | Age ↔ Housing Instability | Negative | -0.34 | domestic.ts |
| #A4 | Age ↔ Community Status | Positive | 0.46 | social.ts |
| #E3 | Age ↔ Conscientiousness | Positive | 0.32 | traits.ts |
| #E4 | Age ↔ Avg Skill XP | Positive | 0.78 | skills.ts |

### Latent-Based Correlates (4)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #5 | Cosmopolitanism ↔ Abroad | Positive | 0.39 | geography.ts |
| #7 | Religiosity ↔ Vices | Negative | -0.55 | lifestyle.ts |
| #9 | Travel ↔ Tradecraft | Positive | 0.42 | skills.ts |
| #X3 | Curiosity ↔ Risk Appetite | Positive | 0.19 | latents.ts |

### Trait-Based Correlates (5)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #12 | Authoritarianism ↔ Conflict Style | Positive | 0.37 | generator.ts (deterministic) |
| #14 | Visibility ↔ Reputation | Positive | 0.39 | social.ts (deterministic) |
| #15 | Risk Appetite ↔ Housing Instability | Positive | 0.23 | domestic.ts |
| #L1 | Social Battery ↔ Third Places | Positive | 0.46 | domestic.ts |
| #X4 | Planning Horizon ↔ Impulse Control | Positive | 0.38 | traits.ts |

### Cross-Latent Correlates (6)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #18 | Opsec ↔ Tradecraft | Positive | 0.60 | skills.ts |
| #19 | Risk Appetite ↔ Tradecraft | Positive | 0.24 | skills.ts |
| #20 | Opsec ↔ Publicness | Negative | -0.52 | latents.ts |
| #21 | Publicness ↔ Tradecraft | Negative | -0.43 | skills.ts |
| #22 | Physical Conditioning ↔ Tradecraft | Positive | 0.20 | skills.ts |
| #X2 | Institutional Embeddedness ↔ Risk Appetite | Negative | -0.24 | latents.ts |

### Derivation Correlates (3)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #D1 | Opsec ↔ Conscientiousness | Positive | 0.54 | latents.ts |
| #D2 | Conscientiousness ↔ Tradecraft | Positive | 0.32 | skills.ts |
| #D3 | Publicness ↔ Conscientiousness | Negative | -0.25 | latents.ts |

### Education Correlates (2)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #E1 | Education ↔ Cognitive Speed | Positive | 0.26 | aptitudes.ts |
| #E2 | Education ↔ Working Memory | Positive | 0.25 | aptitudes.ts |

### Network/Social Correlates (5)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #N1 | Community Status ↔ Network Role | Positive | 0.42 | social.ts (deterministic) |
| #N2 | Dependent Count ↔ Third Places | Negative | -0.47 | domestic.ts |
| #N3 | Conscientiousness ↔ Network Role | Positive | 0.20 | social.ts (deterministic) |
| #N4 | Deception ↔ Relationship Count | Negative | -0.32 | social.ts |
| #N5 | Family ↔ Religiosity | Positive | 0.18 | lifestyle.ts (deterministic) |

### Housing Correlates (4)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #H1 | Family Size ↔ Housing Stability | Positive | 0.35 | domestic.ts |
| #H2 | Residency Status ↔ Housing Stability | Positive | 0.29 | domestic.ts |
| #H3 | Cosmopolitanism ↔ Housing Stability | Negative | -0.21 | domestic.ts |
| #H4 | Frugality ↔ Housing Stability | Positive | 0.19 | domestic.ts |

### Health Correlates (4)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #HL1 | Stress ↔ Chronic Conditions | Positive | 0.53 | lifestyle.ts (deterministic) |
| #HL2 | Vice Tendency ↔ Chronic Conditions | Positive | 0.25 | lifestyle.ts |
| #HL3 | Endurance ↔ Stress Reactivity | Negative | -0.16 | lifestyle.ts |
| #HL4 | Religiosity ↔ Dietary Restrictions | Positive | 0.75 | generator.ts |

### Skills Correlates (5)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #SK1 | Institutional Embeddedness ↔ Bureaucracy | Positive | 0.58 | skills.ts |
| #SK2 | Tech Fluency ↔ Digital Hygiene | Positive | 0.42 | skills.ts |
| #SK3 | Social Battery ↔ Negotiation | Positive | 0.35 | skills.ts |
| #SK4 | Adaptability ↔ Negotiation | Positive | 0.32 | skills.ts |
| #SK5 | Opsec ↔ Digital Hygiene | Positive | 0.52 | skills.ts |

### Behavioral Correlates (4)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #X5 | Agreeableness ↔ Conflict Style | Negative | -0.17 | generator.ts (deterministic) |
| #X6 | Authoritarianism ↔ Home Orderliness | Positive | 0.53 | domestic.ts |
| #B1 | Conscientiousness ↔ Petty Habits | Positive | 0.30 | domestic.ts |
| #B2 | Third Places ↔ Civic Engagement | Positive | 0.22 | social.ts |
| #B3 | Physical Conditioning ↔ Active Hobbies | Positive | 0.35 | preferences.ts (deterministic) |

### Tautological Correlates (Validation)

| ID | Correlate | Direction | Last r | Notes |
|----|-----------|-----------|--------|-------|
| #T1 | Housing Stability ↔ Instability | Negative | -1.00 | Inverse metrics |

---

## Adding New Correlates

1. **Define the relationship**: Identify which attributes should correlate and in which direction
2. **Choose implementation location**: Place in the earlier facet (respect dependency order)
3. **Apply correlation logic**:
   ```typescript
   // Correlate #XX: AttributeA ↔ AttributeB
   const correlationFactor = normalizedValueA * CORRELATION_STRENGTH;
   result = clampFixed01k(baseValue + correlationFactor);
   ```
4. **Add to audit script**: Update `scripts/audit-agents.ts` DOCUMENTED_CORRELATES array
5. **Run validation**: `npx tsx scripts/audit-agents.ts --count 1000`
6. **Document**: Add entry to this file with ID, location, and expected r value

## Implausibility Checks

The audit script also checks for implausible combinations:

| Check | Condition | Severity |
|-------|-----------|----------|
| high-opsec-high-publicness | opsec > 800 AND publicness > 800 | Warning |
| young-senior-role | age < 25 AND networkRole ∈ {hub, broker, gatekeeper} | Warning |
| elite-couch-surfing | tier = elite AND housing = couch-surfing | Error |

---

**Last Updated**: 2026-01-06
