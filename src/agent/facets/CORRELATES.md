# Agent Generation Correlates

This document defines the cross-attribute correlations enforced in agent generation. Each correlate ensures realistic co-occurrence patterns across facets.

## Validation Status

All correlates are validated using Pearson correlation coefficient (r) against 1200 generated agents. A correlate is:
- **Verified**: |r| ≥ 0.15 in expected direction
- **Weak**: 0.05 ≤ |r| < 0.15 in expected direction
- **Missing**: |r| < 0.05
- **Inverted**: Correlation in wrong direction

**Last audit: 2026-01-08 | 181 tracked correlates | 128 verified (71%) | 31 weak | 22 missing | 16 constraints passed**

### Disabled Correlates (6)
These correlates are commented out because required fields don't exist in generation:
- `#PG-OPERATIVE-VIS`: Generation doesn't suppress aesthetics for operatives
- `#HL10`: triggerTags field doesn't exist
- `#HL14`: conflictExposure field doesn't exist
- `#NAR-5`: Persecution events not generated (0/500 agents)
- `#NAR-10`: refugee/asylum-seeker residency status doesn't exist
- `#NAR-11`: mentalHealthMarkers field doesn't exist

## Implementation Statistics

**Total implemented correlates across all facet files: ~406**

| File | Count | Description |
|------|-------|-------------|
| `traits.ts` | 18 | Personality trait coherence (caps, floors, plausibility gates) |
| `skills.ts` | 36 | Skill/aptitude dependencies (9 caps, 8 floors, 18 weighted, 1 PR) |
| `aptitudes.ts` | 25 | Physical/cognitive aptitude interdependencies |
| `social.ts` | 80 | Marital, network, community, relationship correlates |
| `domestic.ts` | 55 | Housing, caregiving, commute, legal status correlates |
| `lifestyle.ts` | 29 | Health, vice, fitness, treatment correlates |
| `narrative.ts` | 30 | Timeline events, age gates, diaspora/minority effects |
| `preferences.ts` | 42 | Food, fashion, hobbies, media, recovery correlates |
| `identity.ts` | 50 | Career, education, language, orientation correlates |
| `latents.ts` | 36 | Core latent variable interdependencies |
| `generator.ts` | 5 | Cross-facet orchestration correlates |

**Correlate Types:**
- **Plausibility Gates**: Hard constraints preventing impossible combinations (~45)
- **Deterministic Caps**: Threshold-based ceiling adjustments (~85)
- **Deterministic Floors**: Threshold-based minimum adjustments (~40)
- **Weighted Probabilities**: Continuous influence on selection weights (~180)
- **Age Gates**: Age-based restrictions on events/careers (~15)
- **Cross-Attribute Correlations**: Multi-variable interactions (~40)

**75 correlates are formally tracked** in the audit script with Pearson correlation validation. The remaining ~330 are structural constraints, weighted probabilities, and plausibility gates that ensure agent coherence without producing measurable linear correlations

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

---

## Plausibility Gates (Critical Hard Constraints)

These prevent fundamentally implausible agent combinations.

| ID | Gate | Constraint | File |
|----|------|-----------|------|
| #PG1 | Opsec → Identity Kit | High opsec (>750) blocks compromised identity kits | domestic.ts |
| #PG2 | Mobility → Housing | Nomadic mobility forces unstable housing | domestic.ts |
| #PG3 | Tier → Neighborhood | Elite tier blocks thin-wall neighborhoods | domestic.ts |
| #PG4 | Marital → Relationship Types | Singles can't have ex-partner relationships | social.ts |
| #PG5 | Community Role → Status | Lurkers can't be community pillars | social.ts |
| #PG6 | Operative Role → Hobbies | Operative roles block highly-social hobbies | preferences.ts |
| #PG7 | Empathy ↔ Deception | High empathy (>800) caps deception at 600 | aptitudes.ts |
| #DC-NEW-5 | Elite → Education | Elite tier cannot have secondary/self-taught education | identity.ts |
| #DC-NEW-1 | Age → Doctorate | Doctorate requires age ≥ 30 | identity.ts |
| #DC-NEW-10 | Foreign Service → Languages | Foreign service career requires 2+ languages | identity.ts |
| #DC-NEW-11 | Intelligence → Aliases | Intelligence career requires 1+ alias | identity.ts |
| #DC-NEW-8 | Opsec → Outness | High opsec (>0.75) cannot be publicly "out" | identity.ts |
| #NAR-8 | Local Majority → Linguistic | Local majority cannot be linguistic minority | narrative.ts |
| #NAR-10 | Elite + Refugee | Elite tier incompatible with refugee status | social.ts |
| #NEW38 | Age → Parents | Age 70+ implies deceased parents | social.ts |
| #NEW35 | Dependents → Network | Parents with dependents cannot be network isolates | social.ts |
| #HL8 | Injuries → Fitness | Multiple injuries (≥2) cap fitness band | lifestyle.ts |
| #DC-D2 | Housing → Commute | Transient housing cannot have driver commute | domestic.ts |
| #DC-D8 | Legal Exposure → Credentials | High legal exposure removes security clearance | domestic.ts |

---

## Trait Coherence Correlates

These ensure psychological consistency between personality traits and latent variables.

### Trait Caps (traits.ts)

| ID | Correlate | Logic | Expected r |
|----|-----------|-------|------------|
| #DC-T1 | Risk ↔ Conscientiousness | Both >700 → cap conscientiousness at 650 | -0.25 |
| #DC-T2 | Novelty ↔ Authoritarianism | Both >700 → cap authoritarianism at 600 | -0.25 |
| #DC-T3 | Agreeableness ↔ Risk | Both high → cap riskTolerance at 600 | -0.20 |
| #DC-T5 | Age → Novelty | Age 55+ progressively caps noveltySeeking | -0.25 |
| #DC-T7 | Stress → Conscientiousness | High stress (>750) caps conscientiousness | -0.20 |
| #DC-T8 | Social Battery ↔ Agreeableness | Low battery + high agree → cap agreeableness | +0.15 |
| #PG-T1 | Authoritarianism → Conscientiousness Floor | High auth (>750) raises conscientiousness floor to 400 | +0.25 |
| #PG-T2 | Opsec ↔ Novelty | Both very high → cap noveltySeeking at 650 | -0.20 |

### Latent Caps (latents.ts)

| ID | Correlate | Logic | Expected r |
|----|-----------|-------|------------|
| #DC3 | Adaptability ↔ Planning | Both high → cap planningHorizon at 550 | -0.20 |
| #DC5 | Opsec → Social Battery | High opsec (>800) caps socialBattery at 650 | -0.25 |
| #DC6 | Frugality → Aesthetic | High frugality (>800) caps aestheticExpressiveness at 550 | -0.30 |
| #DC8 | Stress → Opsec | High stress (>750) caps opsecDiscipline at 600 | -0.30 |
| #DC9 | Curiosity ↔ Opsec | Both very high → reduce opsecDiscipline by 150 | -0.15 |
| #DC11 | Principledness → Adaptability | High principle (>800) caps adaptability at 600 | -0.20 |
| #DC12 | Risk ↔ Frugality | Bidirectional: either >800 caps other at 550 | -0.25 |

---

## Skill/Aptitude Correlates

### Skill Caps Based on Aptitudes (skills.ts)

| ID | Correlate | Logic | Expected r |
|----|-----------|-------|------------|
| #DC-SK1 | Attention → Surveillance | attentionControl <300 caps surveillance at 450 | +0.35 |
| #DC-SK2 | Memory → Bureaucracy | workingMemory <350 caps bureaucracy at 500 | +0.30 |
| #DC-SK3 | Reflexes → Driving | reflexes <300 caps driving at 550 | +0.25 |
| #DC-SK4 | Stress → Shooting | stressReactivity >700 caps shooting at 550 | -0.30 |
| #DC-SK5 | Charisma → Media | charisma <300 caps mediaHandling at 450 | +0.30 |
| #DC-SK10 | Tech → Digital Hygiene | techFluency <300 caps digitalHygiene at 400 | +0.35 |
| #DC7 | Impulse → Tradecraft | impulseControl <350 caps tradecraft at 500 | +0.25 |

### Aptitude Interdependencies (aptitudes.ts)

| ID | Correlate | Logic | Expected r |
|----|-----------|-------|------------|
| #PA1 | Dexterity → Hand-Eye | dexterity >700 ensures handEyeCoordination ≥450 | +0.40 |
| #PA2 | CogSpeed → Memory | cognitiveSpeed >750 ensures workingMemory ≥400 | +0.45 |
| #PA3 | RiskCalc → Attention | riskCalculation >700 requires attentionControl ≥400 | +0.30 |
| #PA4 | Strength → Endurance | strength >800 ensures endurance ≥350 | +0.35 |
| #PA5 | Memory → Attention | workingMemory >800 requires attentionControl ≥450 | +0.40 |
| #PA6 | Age → CogSpeed | Age 55+ caps cognitiveSpeed (800 - 8*(age-55)) | -0.30 |
| #PA7 | Reflexes → CogSpeed | reflexes >750 ensures cognitiveSpeed ≥400 | +0.35 |
| #PG8 | Assert ↔ Charisma | assertiveness >850 + charisma <300 → cap assertiveness | +0.20 |
| #PG9 | Empathy → Charisma | empathy <250 caps charisma at 600 | +0.25 |
| #PG10 | Build → Strength | Lean/slight body builds cap strength at 700 | +0.30 |

---

## Preference Coherence Correlates (preferences.ts)

| ID | Correlate | Logic | Expected r |
|----|-----------|-------|------------|
| #DC-SOCIAL-GROUP | Social Battery → Group Style | Low battery (<350) weights solo, avoids large groups | +0.40 |
| #DC-SOCIAL-COMM | Social Battery → Communication | Low battery (<350) weights async comms (text/email) | +0.40 |
| #DC-EMOTIONAL | Agreeableness → Emotional Sharing | High agree (>700) weights open sharing | +0.35 |
| #DC-BOUNDARY | Opsec → Boundaries | High opsec (>700) weights firm/strong boundaries | +0.40 |
| #DC-PLANNING | Conscientiousness → Planning Style | High consc (>700) weights detailed/methodical | +0.35 |
| #DC-CHRONO | Conscientiousness → Chronotype | High consc (>700) weights early-bird | +0.25 |
| #DC-RISK-EQUIP | Risk → Weapon Preference | High risk (>700) weights assertive weapons | +0.30 |
| #DC-SPACE-TYPE | Opsec → Space Type | High opsec (>700) weights private spaces | +0.35 |
| #DC-IMPULSE | Impulse → Doomscrolling | Low impulse (<350) increases doomscrolling risk | -0.30 |
| #DC-NOVELTY-COMFORT | Novelty → Comfort Foods | High novelty (>700) weights exotic/adventurous | +0.35 |
| #DC-AGE-CAFFEINE | Age → Caffeine | Age >50 reduces heavy caffeine, boosts moderate | +0.20 |
| #DC-STRESS-LIGHT | Stress → Light Preference | High stress (>700) weights warm/dim lighting | +0.25 |
| #PG-FRUGAL-FASHION | Frugal + Elite → Formality | Frugal elite maintains formality floor | +0.20 |
| #PG-OPERATIVE-VIS | Operative → Aesthetics | Intelligence/security careers force understated style | -0.30 |

---

## Social/Domestic Correlates

### Social Constraints (social.ts)

| ID | Correlate | Logic | Expected r |
|----|-----------|-------|------------|
| #NEW34 | Elite + Age → Marriage | Elite under 30 delays marriage | -0.15 |
| #NEW36 | Diaspora → Communities | Non-native diaspora ensures ≥1 community | +0.30 |
| #NEW37 | Social Battery → Leverage | Low battery (<300) blocks favor leverage | -0.25 |
| #NEW39 | Marital → Housing | Married reduces couch-surfing probability | +0.35 |
| #NEW40 | Tier + Age → Community Status | Young (<35) mass tier cannot be pillar | +0.20 |
| #NEW41 | Opsec + Publicness → Reputation | Both high (>0.7) forces discreet reputation | -0.25 |
| #NEW42 | Empathy → Care Leverage | Low empathy (<300) blocks care leverage | +0.25 |
| #NEW43 | Risk + Institutional → Faction | High risk + low inst avoids formal factions | -0.25 |
| #NEW44 | Age → Widowhood | Age <40 significantly reduces widowhood | +0.15 |
| #NEW45 | Urbanicity → Online | Rural boosts online community presence | -0.20 |

### Domestic Constraints (domestic.ts)

| ID | Correlate | Logic | Expected r |
|----|-----------|-------|------------|
| #DC-D1 | Age → Caregiving | Age 50-70 increases eldercare; 70+ decreases childcare | +0.30 |
| #DC-D3 | Dependents → Schedule | Dependents >0 ensures stable weekly anchor | +0.35 |
| #DC-D5 | Neighborhood → Privacy | Gated/rural upgrades privacy level | +0.40 |
| #DC-D6 | Household → Caregiving | Multigenerational sets eldercare obligation | +0.35 |
| #DC-D7 | Frugality → Neighborhood | High frugality (>0.7) penalizes elite neighborhoods | -0.30 |
| #DC-D10 | Elite → Privacy | Elite tier ensures private privacy regardless of housing | +0.25 |
| #DC-D11 | Stress → Home Order | High stress (>0.7) caps homeOrderliness at 600 | -0.25 |
| #DC-D12 | Conditioning → Commute | Low conditioning (<350) reduces bicycle commute | +0.25 |
| #DC-D13 | Impulse → Legal Exposure | Low impulse (<0.35) increases legal exposure | -0.30 |

---

## Health/Lifestyle Correlates (lifestyle.ts)

| ID | Correlate | Logic | Expected r |
|----|-----------|-------|------------|
| #HL6 | Age → Diagnosis | Older (>50) more likely undiagnosed neurodivergence | +0.15 |
| #HL7 | Trauma → Coping | Trauma tags require ≥1 coping strategy | +0.40 |
| #HL9 | Chronic → Mobility | Mobility-affecting conditions reduce mobility options | -0.35 |
| #HL10 | Neurodivergence → Triggers | ADHD→boredom triggers; Anxiety→overwhelm; ASD→sensory | +0.45 |
| #HL11 | Age → Vice Type | Younger weights recreational; older weights alcohol/tobacco | +0.20 |
| #HL12 | Observance → Resilience | Devout/strict observance boosts resilience indicators | +0.25 |
| #HL13 | Tier → Treatment | Elite tier weighted toward comprehensive/specialist care | +0.30 |
| #HL14 | Conflict → Mobility | Conflict environments (>0.6) reduce nomadic options | -0.30 |
| #HL15 | Dependency → Fitness | Active/struggling addiction caps fitness at moderate | -0.40 |

---

## Narrative/Timeline Correlates (narrative.ts)

| ID | Correlate | Logic | Expected r |
|----|-----------|-------|------------|
| #NAR-1 | Age → Event Count | eventCount ≥ floor(age/15) + 3 | +0.60 |
| #NAR-2 | Tier → Negative Cap | Elite tier caps negative events at 2 (vs 4) | -0.25 |
| #NAR-3 | Adversity → Negative Event | Adversity tags require ≥1 negative event | +0.50 |
| #NAR-4 | Career → Event Types | Career restricts available event types | +0.30 |
| #NAR-5 | Minority + Insecurity → Persecution | Religious minority + low security triggers persecution | +0.35 |
| #NAR-6 | Visible Minority → Events | Cannot have all positive events | -0.20 |
| #NAR-7 | Age → Career Events | Age <25 blocks senior promotions | +0.25 |
| #NAR-9 | Diaspora → Visible Minority | Refugee +35%, diaspora-child +25%, expat +15% boost | +0.40 |
| #NAR-11 | Negative Events → Mental Health | ≥3 negative events adds mental health marker | +0.35 |
| #NAR-12 | Age → Event Floors | Age gates: romantic 18+, loss 16+, burnout 22+ | +0.30 |
| #DC-D4 | Residency → Credentials | Irregular residency affects credential validity | +0.40 |
| #DC-D9 | Urbanicity → Life Skills | Rural/urban determines skill domain focus | +0.25 |

---

## Original Correlate Catalog (75 documented)

### Tier-Based Correlates (6)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #2 | Tier ↔ Health | Positive | 0.32 | lifestyle.ts |
| #3 | Tier ↔ Education | Positive | 0.52 | identity.ts |
| #16 | Tier ↔ Housing Stability | Positive | 0.21 | domestic.ts |
| #17 | Tier ↔ Housing Instability | Negative | -0.21 | domestic.ts |
| #S1 | Tier ↔ Cosmopolitanism | Positive | 0.21 | latents.ts |
| #X1 | Tier ↔ Risk Appetite | Negative | -0.31 | latents.ts |

### Age-Based Correlates (9)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #1 | Age ↔ Physical Conditioning | Negative | -0.31 | latents.ts |
| #4 | Age ↔ Has Family | Positive | 0.28 | social.ts (deterministic) |
| #6 | Age ↔ Network Role | Positive | 0.33 | social.ts |
| #A1 | Age ↔ Tier | Positive | 0.29 | generator.ts |
| #A2 | Age ↔ Housing Stability | Positive | 0.27 | domestic.ts |
| #A3 | Age ↔ Housing Instability | Negative | -0.27 | domestic.ts |
| #A4 | Age ↔ Community Status | Positive | 0.20 | social.ts |
| #E3 | Age ↔ Conscientiousness | Positive | 0.26 | traits.ts |
| #E4 | Age ↔ Avg Skill XP | Positive | 0.77 | skills.ts |

### Latent-Based Correlates (4)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #5 | Cosmopolitanism ↔ Abroad | Positive | 0.34 | geography.ts |
| #7 | Religiosity ↔ Vices | Negative | -0.51 | lifestyle.ts |
| #9 | Travel ↔ Tradecraft | Positive | 0.38 | skills.ts |
| #X3 | Curiosity ↔ Risk Appetite | Positive | 0.19 | latents.ts |

### Trait-Based Correlates (5)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #12 | Authoritarianism ↔ Conflict Style | Positive | 0.34 | generator.ts (deterministic) |
| #14 | Visibility ↔ Reputation | Positive | 0.30 | social.ts (deterministic) |
| #15 | Risk Appetite ↔ Housing Instability | Positive | 0.35 | domestic.ts |
| #L1 | Social Battery ↔ Third Places | Positive | 0.45 | domestic.ts |
| #X4 | Planning Horizon ↔ Impulse Control | Positive | 0.24 | traits.ts |

### Cross-Latent Correlates (6)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #18 | Opsec ↔ Tradecraft | Positive | 0.51 | skills.ts |
| #19 | Risk Appetite ↔ Tradecraft | Positive | 0.23 | skills.ts |
| #20 | Opsec ↔ Publicness | Negative | -0.46 | latents.ts |
| #21 | Publicness ↔ Tradecraft | Negative | -0.32 | skills.ts |
| #22 | Physical Conditioning ↔ Tradecraft | Positive | 0.24 | skills.ts |
| #X2 | Institutional Embeddedness ↔ Risk Appetite | Negative | -0.25 | latents.ts |

### Derivation Correlates (3)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #D1 | Opsec ↔ Conscientiousness | Positive | 0.51 | latents.ts |
| #D2 | Conscientiousness ↔ Tradecraft | Positive | 0.27 | skills.ts |
| #D3 | Publicness ↔ Conscientiousness | Negative | -0.19 | latents.ts |

### Education Correlates (2)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #E1 | Education ↔ Cognitive Speed | Positive | 0.28 | aptitudes.ts |
| #E2 | Education ↔ Working Memory | Positive | 0.29 | aptitudes.ts |

### Network/Social Correlates (5)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #N1 | Community Status ↔ Network Role | Positive | 0.34 | social.ts (deterministic) |
| #N2 | Dependent Count ↔ Third Places | Negative | -0.49 | domestic.ts |
| #N3 | Conscientiousness ↔ Network Role | Positive | 0.17 | social.ts (deterministic) |
| #N4 | Deception ↔ Relationship Count | Negative | -0.31 | social.ts |
| #N5 | Family ↔ Religiosity | Positive | 0.20 | lifestyle.ts (deterministic) |

### Housing Correlates (4)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #H1 | Family Size ↔ Housing Stability | Positive | 0.33 | domestic.ts |
| #H2 | Residency Status ↔ Housing Stability | Positive | 0.28 | domestic.ts |
| #H3 | Cosmopolitanism ↔ Housing Stability | Negative | -0.26 | domestic.ts |
| #H4 | Frugality ↔ Housing Stability | Positive | 0.21 | domestic.ts |

### Health Correlates (4)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #HL1 | Stress ↔ Chronic Conditions | Positive | 0.51 | lifestyle.ts (deterministic) |
| #HL2 | Vice Tendency ↔ Chronic Conditions | Positive | 0.34 | lifestyle.ts |
| #HL3 | Endurance ↔ Stress Reactivity | Negative | -0.13~ | lifestyle.ts |
| #HL4 | Religiosity ↔ Dietary Restrictions | Positive | 0.75 | generator.ts |

### Skills Correlates (5)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #SK1 | Institutional Embeddedness ↔ Bureaucracy | Positive | 0.56 | skills.ts |
| #SK2 | Tech Fluency ↔ Digital Hygiene | Positive | 0.44 | skills.ts |
| #SK3 | Social Battery ↔ Negotiation | Positive | 0.37 | skills.ts |
| #SK4 | Adaptability ↔ Negotiation | Positive | 0.25 | skills.ts |
| #SK5 | Opsec ↔ Digital Hygiene | Positive | 0.48 | skills.ts |

### Behavioral Correlates (5)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #X5 | Agreeableness ↔ Conflict Style | Negative | -0.20 | generator.ts (deterministic) |
| #X6 | Authoritarianism ↔ Home Orderliness | Positive | 0.61 | domestic.ts |
| #B1 | Conscientiousness ↔ Petty Habits | Positive | 0.28 | domestic.ts |
| #B2 | Third Places ↔ Civic Engagement | Positive | 0.19 | social.ts |
| #B3 | Physical Conditioning ↔ Active Hobbies | Positive | 0.40 | preferences.ts (deterministic) |

### Tautological Correlates (Validation)

| ID | Correlate | Direction | Last r | Notes |
|----|-----------|-----------|--------|-------|
| #T1 | Housing Stability ↔ Instability | Negative | -1.00 | Inverse metrics |

### NEW Correlates (Phase 1, 2026-01-06) (17)

| ID | Correlate | Direction | Last r | Location |
|----|-----------|-----------|--------|----------|
| #NEW6 | Cosmopolitanism ↔ Dietary Adventurousness | Positive | 0.82 | preferences.ts |
| #NEW7 | Frugality ↔ Fashion Status Signaling | Negative | -0.40 | preferences.ts |
| #NEW8 | Social Battery ↔ Social Media Usage | Positive | 0.58 | preferences.ts |
| #NEW14 | Stress Reactivity ↔ Coping Ritual Count | Positive | 0.80 | preferences.ts |
| #NEW16 | Agreeableness ↔ Fashion Conformity | Positive | 0.23 | preferences.ts |
| #NEW23 | Institutional Embeddedness ↔ Hobby Conformity | Positive | 0.18 | preferences.ts |
| #NEW1 | Relationship Hostility ↔ Relationship Count | Negative | -0.32 | social.ts |
| #NEW2 | Institutional Embeddedness ↔ Housing Stability | Positive | 0.20 | domestic.ts |
| #NEW5 | Conscientiousness ↔ Vice Count | Negative | -0.23 | lifestyle.ts |
| #NEW9 | Deception ↔ Community Status | Negative | -0.15~ | social.ts |
| #NEW11 | Principledness ↔ Broker Role | Negative | -0.25 | social.ts |
| #NEW15 | Adaptability ↔ Home Orderliness | Negative | -0.58 | domestic.ts |
| #NEW33 | High Opsec ↔ Not Hub/Gatekeeper | Negative | -0.21 | social.ts |
| #NEW10 | Diaspora ↔ Linguistic Minority | Positive | 0.68 | narrative.ts |
| #NEW12 | Age ↔ Publicness | Positive | 0.17 | latents.ts |
| #NEW17 | Tier ↔ Network Role | Positive | 0.18 | social.ts |

### Probabilistic Enhancements (PR1-PR5)

| ID | Correlate | Direction | Logic | File |
|----|-----------|-----------|-------|------|
| #PR1 | Stress Reactivity ↔ Negotiation | Negative | stressReactivity >650 reduces negotiation by up to 15% | skills.ts |
| #PR2 | Diaspora ↔ Negative Timeline Events | Positive | Non-native diaspora increases negative event probability | narrative.ts |
| #PR3 | Visible Minority ↔ Community Status | Negative | Visible minorities face 35% reduction in high-status weights | social.ts |
| #PR4 | Reflexes ↔ Hand-Eye Coordination | Positive | reflexes >600 boosts handEyeCoordination | aptitudes.ts |
| #PR5 | Social Battery ↔ Artistic Sharing Style | Positive | High battery favors public/collaborative | preferences.ts |

---

## Weak Correlates (4)

These correlates exist but show weaker-than-expected correlation (0.05 ≤ |r| < 0.15):

| ID | Correlate | Last r | Notes |
|----|-----------|--------|-------|
| #A4 | Age ↔ Community Status | 0.13 | Life-stage effect, weakened by mobility |
| #HL3 | Endurance ↔ Stress Reactivity | -0.14 | Physical/mental independence |
| #X3 | Curiosity ↔ Risk Appetite | 0.14 | Weak cognitive-behavioral link |
| #X5 | Agreeableness ↔ Conflict Style | -0.14 | Personality-behavior independence |

---

## Implausibility Checks

The audit script checks for implausible combinations:

| Check | Condition | Severity |
|-------|-----------|----------|
| high-opsec-high-publicness | opsec > 800 AND publicness > 800 | Warning |
| young-senior-role | age < 25 AND networkRole ∈ {hub, broker, gatekeeper} | Warning |
| elite-couch-surfing | tier = elite AND housing = couch-surfing | Error |
| high-opsec-compromised-kit | opsec > 750 AND identity kit = compromised | Error (PG1) |
| nomadic-stable-housing | mobility = nomadic AND housing = stable | Error (PG2) |
| elite-thin-walls | tier = elite AND neighborhood = thin-walls | Error (PG3) |
| single-ex-partner | marital = single AND has ex-partner relationship | Error (PG4) |
| lurker-pillar | communityRole = lurker AND status = pillar | Error (PG5) |
| high-empathy-high-deception | empathy > 800 AND deception > 600 | Error (PG7) |
| elite-secondary-education | tier = elite AND education ∈ {secondary, self-taught} | Error (DC-NEW-5) |
| young-doctorate | age < 30 AND education = doctorate | Error (DC-NEW-1) |
| parents-isolate | dependentCount > 0 AND networkRole = isolate | Error (NEW35) |
| multiple-injuries-peak-fitness | injuries ≥ 2 AND fitness ∈ {peak, excellent, athletic} | Error (HL8) |

---

## Complete Correlate Catalog by File

### traits.ts (18 correlates)

| ID | Description | Logic | Direction |
|----|-------------|-------|-----------|
| DC-T1 | Risk ↔ Conscientiousness | riskTolerance >700 && conscientiousness >700 → cap at 650 | - |
| DC-T2 | Novelty ↔ Authoritarianism | noveltySeeking >700 && authoritarianism >700 → cap at 600 | - |
| DC-T3 | Agreeableness ↔ Risk | agreeableness >750 && riskTolerance >700 → cap at 600 | - |
| DC-T4 | Low Impulse → Conscientiousness | impulseControl <300 → conscientiousness cap 650 | - |
| DC-T5 | Age → Novelty | age >55 → noveltySeeking cap (650 - (age-55)*5), floor 300 | - |
| DC-T6 | Cosmopolitanism → Authoritarianism | cosmopolitanism >750 → authoritarianism cap 600 | - |
| DC-T7 | Stress → Conscientiousness | stressReactivity >750 → conscientiousness cap (700 - (stress-750)/2) | - |
| DC-T8 | Low Battery + Agreeableness | socialBattery <300 && agreeableness >750 → cap at 700 | - |
| DC-T9 | Deception → Agreeableness Floor | deceptionAptitude >750 → agreeableness floor 250 | + |
| DC-T10 | Empathy → Conscientiousness Floor | empathy >800 → conscientiousness floor 350 | + |
| DC-T11 | Stress + Agreeableness → Auth | stressReactivity >700 && agreeableness >700 → auth cap 550 | - |
| DC-T12 | Adaptability → Authoritarianism | adaptability >750 → authoritarianism cap 500 | - |
| PG-T1 | Authoritarianism → Conscientiousness | authoritarianism >750 → conscientiousness floor 400 | + |
| PG-T2 | Opsec → Novelty | opsecDiscipline >800 && noveltySeeking >750 → cap 650 | - |
| PG-T3 | Low Empathy → Agreeableness | empathy <200 → agreeableness cap 600 | - |
| PG-T4 | Extreme Auth → Novelty | authoritarianism >850 → noveltySeeking cap 550 | - |
| PG-T5 | Opsec + Impulse → Risk Floor | opsec >800 && impulseControl >750 → riskTolerance floor 200 | + |
| PG-T6 | Curiosity → Conscientiousness | curiosityBandwidth >850 → conscientiousness cap 600 | - |

### skills.ts (36 correlates)

| ID | Description | Logic | Direction |
|----|-------------|-------|-----------|
| DC7 | Low Impulse → Tradecraft | impulseControl <350 → tradecraft cap 500 | - |
| DC-SK1 | Low Attention → Surveillance | attentionControl <300 → surveillance cap 450 | - |
| DC-SK2 | Low Memory → Bureaucracy | workingMemory <350 → bureaucracy cap 500 | - |
| DC-SK3 | Low Reflexes → Driving | reflexes <300 → driving cap 550 | - |
| DC-SK4 | High Stress → Shooting | stressReactivity >700 → shooting cap 550 | - |
| DC-SK5 | Low Charisma → Media | charisma <300 → mediaHandling cap 450 | - |
| DC-SK6 | High Empathy → Negotiation | empathy >700 → negotiation floor 350 | + |
| DC-SK7 | High Opsec → Surveillance | opsecDiscipline >700 → surveillance floor 300 | + |
| DC-SK8 | High Stress → First Aid | stressReactivity >750 → firstAid cap 550 | - |
| DC-SK9 | High Dexterity → Lockpicking | dexterity >700 → lockpicking floor 300 | + |
| DC-SK10 | Low Tech → Digital Hygiene | techFluency <300 → digitalHygiene cap 400 | - |
| DC-SK11 | High Charisma → Elicitation | charisma >700 → elicitation floor 350 | + |
| DC-SK12 | High Attention → Analysis | attentionControl >750 → analysis floor 350 | + |
| DC-SK13 | High Reflexes → Driving | reflexes >700 → driving floor 400 | + |
| DC-SK14 | High Memory → Languages | workingMemory >750 → languages floor 350 | + |
| DC-SK15 | Extreme Stress → Combat | stressReactivity >800 → combat skills cap 500 | - |
| DC-SK16 | Fast Cognition → Research | cognitiveSpeed >700 → research floor 350 | + |
| PR1 | Stress → Negotiation Penalty | stressReactivity >650 → 0-15% penalty | - |
| WP-SK1 | Travel → Driving | travelScore * 0.12 in formula | + |
| WP-SK2 | Travel → Surveillance | travelScore * 0.06 in formula | + |
| WP-SK3 | Travel → Tradecraft | travelScore * 0.22 in formula | + |
| WP-SK4 | Cosmopolitanism → Tradecraft | cosmopolitanism * 0.20 in formula | + |
| WP-SK5 | Travel → Negotiation | travelScore * 0.10 in formula | + |
| WP-SK6 | Adaptability → Negotiation | adaptability * 0.12 in formula | + |
| WP-SK7 | Conflict → Shooting | securityPressure01k * 0.08 in formula | + |
| WP-SK8 | State Violence → Surveillance | stateViolenceEnv01k * 0.06 in formula | + |
| WP-SK9 | Conflict → Tradecraft | conflictEnv01k * 0.04 in formula | + |
| WP-SK10 | State Violence → First Aid | stateViolenceEnv01k * 0.06 in formula | + |
| WP-SK11 | Opsec → Surveillance | opsecDiscipline * 0.16 in formula | + |
| WP-SK12 | Tech → Surveillance | techFluency * 0.08 in formula | + |
| WP-SK13 | Tech → Tradecraft | techFluency * 0.04 in formula | + |
| WP-SK14 | Tech → Media | techFluency * 0.06 in formula | + |
| WP-SK15 | Publicness → Media | publicness * 0.30 in formula | + |
| WP-SK16 | Inv(Opsec) → Media | (1000 - opsec) * 0.12 in formula | - |
| WP-SK17 | Inst Embed → Bureaucracy | institutionalEmbeddedness * 0.28 in formula | + |
| WP-SK18 | Inst Embed → Legal Ops | institutionalEmbeddedness * 0.18 in formula | + |

### aptitudes.ts (25 correlates)

| ID | Description | Logic | Direction |
|----|-------------|-------|-----------|
| PA1 | Dexterity → Hand-Eye | dexterity >700 → handEyeCoordination floor 450 | + |
| PA2 | CogSpeed → Memory | cognitiveSpeed >750 → workingMemory floor 400 | + |
| PA3 | RiskCalc → Attention | riskCalibration >700 → attentionControl floor 400 | + |
| PA4 | Strength → Endurance | strength >800 → endurance floor 350 | + |
| PA5 | Memory → Attention | workingMemory >800 → attentionControl floor 450 | + |
| PA6 | Age → CogSpeed | age >55 → cognitiveSpeed cap (800 - (age-55)*8) | - |
| PA7 | Reflexes → CogSpeed | reflexes >750 → cognitiveSpeed floor 400 | + |
| PA8 | Age → Reflexes | age >50 → reflexes cap (800 - 6*(age-50)) | - |
| PA9 | Youth → Dexterity | age <30 → dexterity floor 350 | + |
| PA10 | High Stress → Attention | stressReactivity >800 → attentionControl cap 550 | - |
| PA11 | Conditioning → Endurance | physicalConditioning >700 → endurance floor 400 | + |
| PA12 | Age + Low Cond → Strength | age >60 && conditioning <400 → strength cap 500 | - |
| PG7 | Empathy ↔ Deception | empathy >800 && deception >750 → deception cap 600 | - |
| PG8 | Assert ↔ Charisma | assertiveness >850 && charisma <300 → assert cap 700 | - |
| PG9 | Low Empathy → Charisma | empathy <250 → charisma cap 600 | - |
| PG10 | Lean Build → Strength | lean/slight/slim build → strength cap 700 | - |
| PG11 | Low CogSpeed → Memory | cognitiveSpeed <250 → workingMemory cap 650 | - |
| PG12 | Low Endurance → Strength | endurance <200 → strength cap 700 | - |
| PG13 | Low Attention → Reflexes | attentionControl <200 → reflexes cap 600 | - |
| PG14 | Stocky + Age → Flexibility | stocky build && age >50 → flexibility cap 550 | - |
| PR4 | Reflexes → Hand-Eye | reflexes >600 → 70% boost handEyeCoord | + |
| E1/E2 | Education → Cognitive | doctorate +150, graduate +100, etc. to cogSpeed/memory | + |
| HL3 | Stress → Endurance | stressReactivity penalty to endurance | - |
| COND | Conditioning → Strength/Endurance | conditioning bias applied to physical aptitudes | + |
| BUILD | Body Build → Aptitudes | muscular/wiry/stocky biases to strength/dex/endurance | ± |

### latents.ts (36 correlates)

| ID | Description | Logic | Direction |
|----|-------------|-------|-----------|
| AB-1 | Age → Physical Conditioning | Peak 25-35, declines after 35 | - |
| AB-2 | Age → Stress Reactivity | +3 per year above 30 | + |
| AB-3 | Age → Tech Fluency | <25 +120, declines after 45 | - |
| AB-4 | Age → Publicness | Peaks 45-55 | + |
| TM-1 | Tier Mediator | Random mediator (0.3-1.7) scales all tier biases | ± |
| T-1 | Tier → Cosmopolitanism | elite +160, mass -120 | ± |
| T-2 | Tier → Publicness | elite +120, mass -40 | ± |
| T-3 | Tier → Institutional Embed | elite +120 | + |
| T-4 | Tier → Tech Fluency | elite +40, mass -40 | ± |
| T-5 | Tier → Aesthetic Express | elite +80, mass -20 | ± |
| T-6 | Tier → Frugality | elite -120, mass +120 | - |
| T-7 | Tier → Planning Horizon | elite +60, mass -20 | ± |
| T-8 | Tier → Stress Reactivity | elite -60, mass +60 | - |
| X-1 | Tier → Risk Appetite | elite -200, mass +80 | - |
| X-2 | Inst Embed → Risk Appetite | -0.25 × (embeddedness-350) | - |
| X-3 | Curiosity → Risk Appetite | 0.30 × (curiosity-500) | + |
| X-4 | Planning → Impulse Control | 0.28 × (planningHorizon-500) | + |
| X-5 | Conditioning → Stress | -0.18 × (conditioning-500) | - |
| PG-1 | Opsec ↔ Publicness | Mutual suppression when either >500 | - |
| DC-1 | Stress → Impulse | stressReactivity >700 → impulseControl ≤600 | - |
| DC-2 | Risk + Planning | both >700 → planningHorizon = 550 | - |
| DC-3 | Adaptability → Planning | adaptability >750 && planning >700 → cap 550 | - |
| DC-4 | Publicness → Impulse Floor | publicness >700 && impulse <400 → floor 450 | + |
| DC-5 | Opsec → Social Battery | opsec >800 → socialBattery ≤650 | - |
| DC-6 | Frugality → Aesthetic | frugality >800 → aesthetic ≤550 | - |
| DC-8 | Stress → Opsec | stressReactivity >750 → opsec ≤600 | - |
| DC-9 | Curiosity → Opsec | curiosity >800 && opsec >700 → opsec -=150 | - |
| DC-11 | Principle → Adaptability | principledness >800 → adaptability ≤600 | - |
| DC-12a | Risk → Frugality | riskAppetite >800 → frugality ≤550 | - |
| DC-12b | Frugality → Risk | frugality >800 → riskAppetite ≤550 | - |
| DC-13 | Age → Publicness Floor | age >50 && publicness <200 → floor 200 | + |
| DC-14 | Opsec → Publicness | opsec >850 → publicness ≤400 | - |
| DC-15 | Publicness → Opsec | publicness >850 → opsec ≤400 | - |
| DC-16 | Role → Publicness | media/diplomat floor 400; operative/security cap 500 | ± |
| DC-17 | Elite → Publicness Floor | elite && publicness <300 → floor 300 | + |
| DC-18 | Stress → Planning | stressReactivity >800 → planningHorizon ≤500 | - |

### social.ts (80 correlates)

#### Plausibility Gates (16)
| ID | Description | Logic |
|----|-------------|-------|
| PG-S1 | City-states → Urbanicity | Cannot have rural/small-town |
| PG-S2 | Tiny territories → Urbanicity | Cannot have megacity |
| PG-S3 | Small countries → Urbanicity | Cannot have megacity |
| PG-S4 | Same country → Diaspora | Cannot be expat/refugee/diaspora-child |
| PG-S5 | Different country → Diaspora | Cannot be native/internal-migrant |
| NAR-10 | Elite + Refugee | Incompatible → force expat |
| NEW38 | Age 70+ → Parents | Implies deceased parents |
| PG4a | Single → Relationships | Cannot have ex-partner |
| PG4b | Widowed → Relationships | Limited relationship types |
| DC6a | Young → Relationships | Age <25 cannot have patron |
| DC6b | Older → Relationships | Age >60 cannot be protege |
| PG5a | Lurker → Status | Cannot be pillar |
| PG5b | Leader → Status | Cannot be newcomer/outsider |
| NEW35 | Parents → Network | Dependents cannot be isolates |
| NEW40 | Young Mass → Status | Age <35 mass tier cannot be pillar |

#### Deterministic Adjustments (26)
| ID | Description | Direction |
|----|-------------|-----------|
| NEW34 | Elite + Young → Marriage | Delays marriage (×0.3) |
| NEW44 | Young → Widowhood | Age <40 rare (×0.1) |
| AGE-FAM-1 | Young → Family | Age <22 rarely married |
| NEW1-CAP1 | High Hostility → Relationships | Cap at 2 |
| NEW1-CAP2 | Moderate Hostility → Relationships | Cap at 3 |
| NEW46 | Siblings → Family Tie | Ensures relationship exists |
| NEW48 | High Deception → Trust | Ensures low-trust relationship |
| NEW50 | Elite + Young → Mentor | Ensures mentor relationship |
| NEW33 | High Opsec → Network | Blocks hub/gatekeeper |
| NEW11-POST | High Principle → Broker | Blocks broker role |
| NEW54 | High Institutional → Faction | Ensures faction alignment |
| NEW49 | Empathy + Family → Leverage | Boosts care leverage |
| NEW47 | Controversial + Public → Leadership | Reduces leadership |
| NEW51 | Low Battery → Online | Ensures online community |
| NEW52 | Diaspora + Minority → Community | Ensures dual community |
| NEW41 | Opsec + Publicness → Reputation | Forces discreet |
| NEW55 | Age + Pillar → Reputation | Ensures positive reputation |
| N3-POST1/2 | Conscientiousness → Network | Upgrades/downgrades role |
| N1-POST1/2 | Community Status → Network | Aligns role with status |
| 14-POST1/2 | Visibility → Reputation | Aligns reputation with visibility |
| 4-POST1/2/3 | Age + Partnership → Family | Age-based family adjustments |

#### Weighted Probabilities (38)
| ID | Description | Direction |
|----|-------------|-----------|
| #4 | Age → Marital Status | Age-based marriage weights |
| #4-DEP | Age → Dependents | Age-based dependent probability |
| #5 | Cosmopolitanism → Diaspora | High cosmo → expat/dual-citizen |
| #6 | Age → Network Role | Age-based role multipliers |
| #11 | Empathy/Deception → Network | Empathy→connector; deception→broker |
| N3 | Conscientiousness → Network | High cons→hub/gatekeeper |
| N4 | Deception → Relationships | Reduces relationship count |
| NEW1 | Hostility Factor | risk + inv(cons) + inv(impulse) |
| NEW17 | Tier → Network | Elite boost to hub/gatekeeper |
| NEW11-W | Principledness → Broker | Negative weight |
| NEW36 | Diaspora → Communities | Ensures community networks |
| NEW37 | Low Battery → Leverage | Blocks favor leverage |
| NEW42 | Low Empathy → Leverage | Blocks care leverage |
| NEW43 | Risk + Low Inst → Faction | Avoids factions |
| NEW45 | Rural → Online | Compensates with online |
| AGE-COMM | Age → Status | Age-based community status |
| PR3 | Visible Minority → Status | Penalty for pillar/respected |
| NEW9 | Deception → Status | Reduces high status weights |
| #14 | Visibility → Reputation | Publicness affects reputation |
| B2 | Third Places → Civic | Engagement based on places |
| CD-1 to CD-7 | Cultural Dynamics | Communication, power, bonding |
| NR-1 to NR-8 | Needs/Archetypes | Tier, opsec, age-based needs |

### domestic.ts (55 correlates)

#### Deterministic Adjustments (22)
| ID | Description | Direction |
|----|-------------|-----------|
| DC-D1 | Age → Caregiving | 50-70 eldercare; 70+ no childcare |
| DC-D2 | Transient → Commute | No driver commute |
| DC-D3 | Dependents → Schedule | Requires weekly anchor |
| DC-D4 | Residency → Credentials | Irregular affects validity |
| DC-D5 | Neighborhood → Privacy | Gated/rural upgrades privacy |
| DC-D6 | Household → Caregiving | Multigenerational → eldercare |
| DC-D7 | Frugality → Neighborhood | Penalizes elite neighborhoods |
| DC-D8 | Legal Exposure → Credentials | Removes security clearance |
| DC-D9 | Urbanicity → Skills | Rural/urban skill focus |
| DC-D10 | Elite → Privacy | Ensures private privacy |
| DC-D11 | Stress → Orderliness | Caps homeOrderliness at 600 |
| DC-D12 | Low Conditioning → Commute | Reduces bicycle |
| DC-D13 | Low Impulse → Legal | Increases exposure |
| DC-D14 | High Inst → Housing | Cannot be couch-surfing |
| DC-D15 | Diplomat → Residency | Forces diplomatic status |
| DC-D16 | Refugee → Housing | Reduces stability score |
| DC-D17 | Elite + Family → Household | Size minimum 3 |
| DC-D18 | Age 70+ → Accessibility | Requires accessible housing |
| DC-D19 | High Opsec → Entry | Requires private entry |
| DC-D20 | Rural → Vehicle | Forces vehicle commute |
| DC-D21 | Low Conditioning → Bicycle | Near-zero probability |
| DC-D22 | Stress + Disorder → Hoarding | Sets risk flag |

#### Plausibility Gates (5)
| ID | Description |
|----|-------------|
| PG-D1 | High Opsec → No compromised identity |
| PG-D2 | Nomadic → No owned housing |
| PG-D3a | Elite → Privacy floor |
| PG-D3b | Elite → Neighborhood floor |
| PG-D3c | Mass → Neighborhood ceiling |

#### Weighted Probabilities (16)
| ID | Description | Direction |
|----|-------------|-----------|
| WP-D1 | Social Battery → Third Places | + |
| WP-D2 | Dependents → Third Places | - |
| WP-D3 | Conscientiousness → Petty Habits | + organized |
| WP-D4 | Authoritarianism → Orderliness | + |
| WP-D5 | Conscientiousness → Housing | + stable |
| WP-D6 | Risk Appetite → Housing | + unstable |
| WP-D7 | Cosmopolitanism → Housing | + unstable |
| WP-D8 | Frugality → Housing | + stable |
| WP-D9 | Inst Embed → Housing | + stable |
| WP-D10 | Household Size → Housing | + stable |
| WP-D11 | Age → Housing | Young unstable; old stable |
| WP-D12 | Tier → Housing | Tier-appropriate ownership |
| WP-D13 | GDP → Housing | Country affects ownership |
| WP-D14 | Conditioning → Commute | High → bicycle/walk |
| WP-D15 | Opsec/Impulse/Principled → Legal | Cleaner record |
| WP-D16 | Housing → Residency | Cross-domain alignment |

#### Hard Constraints (12)
| ID | Description |
|----|-------------|
| HC-D1 | Family → No couch-surfing |
| HC-D2 | Married → Reduced couch-surfing |
| HC-D3 | Elite → No unstable housing |
| HC-D4 | Senior Professional → No couch-surfing |
| HC-D5 | Low Risk → No unstable housing |
| HC-D6 | Credibility Careers → Stable housing |
| HC-D7 | Partnered → Not alone |
| HC-D8 | Dependents → Not alone |
| HC-D9 | No Kids → Not partner-and-kids |
| HC-D10 | Citizenship → Not stateless |
| HC-D11 | Elite → No precarious residency |
| HC-D12 | Precarious → No high credentials |

### lifestyle.ts (29 correlates)

| ID | Description | Direction |
|----|-------------|-----------|
| HL1 | Stress → Chronic Conditions | + |
| HL2 | Vice Tendency → Chronic | + |
| HL6 | Age → Diagnosis Status | Older more undiagnosed |
| HL7 | Trauma → Coping | Requires response pattern |
| PG-HL8 | Multiple Injuries → Fitness | Cap at good |
| HL9 | Chronic → Mobility | Reduces nomadic |
| HL10 | Neurodivergence → Triggers | Type-matched triggers |
| HL11 | Age → Vice Type | Young recreational; old alcohol |
| HL12 | Observance → Resilience | Boosts resilience |
| HL13 | Tier → Treatment | Elite → comprehensive |
| HL14 | Conflict → Mobility | Reduces nomadic |
| PG-HL15 | Active Dependency → Fitness | Cap at moderate |
| HL17 | Severe Vice → Treatment | Ensures recovery option |
| HL18 | Age + Chronic → Medication | Ensures medication |
| HL19 | Conflict + Injury → Trauma | Adds trauma tag |
| HL20 | Elite + Chronic → Specialist | Upgrades treatment |
| HL21 | High Stress → Sleep | Adds sleep issues |
| HL22 | Substance + Family → Intervention | Sets flag |
| HL23 | Young + Chronic → Acute | Implicitly early-stage |
| HL24 | Neurodivergent → Coping | Ensures ritual |
| HL25 | Rural → Treatment | Downgrades access |
| N5 | Family → Religiosity | + |
| NEW5 | Conscientiousness → Vice | - |
| Tier-Health | Tier → Health | Elite better |
| Tier-Fitness | Tier → Fitness | Elite better |
| Religiosity-Vice | Observance → Vice Count | Caps/bans |
| Conflict-Vice | Conflict → Vice | + |
| Stress-Vice | Stress → Vice Count | + |

### narrative.ts (30 correlates)

| ID | Description | Direction |
|----|-------------|-----------|
| NAR-1 | Age → Event Count | floor(age/15) + 3 minimum |
| NAR-2 | Elite → Negative Cap | Cap at 2 vs 4 |
| NAR-3 | Adversity → Negative Event | Requires ≥1 |
| NAR-4 | Career → Event Types | Restricts available events |
| NAR-5 | Religious Minority + Insecure → Persecution | 60% chance |
| NAR-6 | Visible Minority → Challenge | Cannot be all positive |
| NAR-7 | Age → Promotion | Requires age ≥25 |
| NAR-8 | Local Majority → Linguistic | Cannot be linguistic minority |
| NAR-9 | Diaspora → Visible Minority | Probability boost |
| NAR-10 | Diaspora → Linguistic | 75% if non-native |
| NAR-11 | Negative Events → Mental Health | ≥3 adds marker |
| NAR-12 | Age → Romantic | Requires age ≥18 |
| NAR-13 | Refugee → Traumatic | Ensures traumatic event |
| NAR-14 | Elite + Young → Achievement | Ensures success event |
| NAR-15 | Conflict Exposure → Event | Adds conflict event |
| NAR-16 | Career → Event | Career-specific event |
| NAR-17 | Family + Age → Grief | Probability-based grief |
| NAR-18 | Minority + Adversity → Discrimination | Ensures event |
| PR2 | Diaspora → Negative Weight | Increases probability |
| AGE-BUR | Age → Burnout | Requires ≥22 |
| AGE-CAR | Age → Career Break | Requires ≥25 |
| AGE-MEN | Age → Mentorship | Requires ≥20 |
| AGE-BET | Age → Betrayal | Requires ≥20 |
| AGE-MOI | Age → Moral Injury | Requires ≥20 |
| AGE-REC | Age → Recruitment | Requires ≥22 |
| AGE-DEF | Age → Defection | Requires ≥25 |
| AGE-SEC | Age → Security Incident | Requires ≥22 |
| AGE-LOS | Age → Loss | Requires ≥16 |
| UPB-ADV | Adversity → Upbringing Impact | Negative if >2 tags |
| CAR-DEP | Career Events → Min Age | Minimum 22 |

### preferences.ts (42 correlates)

| ID | Description | Direction |
|----|-------------|-----------|
| DC-HL4 | Religiosity → Dietary | Observance multiplier |
| DC-NOVELTY-COMFORT | Novelty → Food | Adventurousness |
| DC-ELITE-DINING | Elite → Fine Dining | + |
| DC-STRESS-SPICE | Stress → Spice | Reduces tolerance |
| DC-AGE-PORTION | Age → Portions | Smaller for 65+ |
| DC-NEW6 | Cosmopolitanism → Cuisine | Diversity |
| DC-AGE-CAFFEINE | Age → Caffeine | Reduces heavy |
| DC-NEW8 | Social Battery → Media | Platform preference |
| DC-AGE-TECH | Age → Platform | Traditional for 60+ |
| DC-IMPULSE | Impulse → Doomscrolling | Risk increase |
| PG-OPERATIVE-VIS | Operative → Fashion | Forces understated |
| DC-NEW16 | Agreeableness → Conformity | + |
| DC-NEW7 | Frugality → Status Signaling | - |
| PG-FRUGAL-FASHION | Frugal Elite → Formality | Floor |
| DC-CHRONO | Conscientiousness → Chronotype | Early-bird |
| DC-NEW14 | Stress → Recovery Count | More rituals |
| DC-SOCIAL-RECOVERY | Social Battery → Recovery | Match type |
| DC-SOLO-RECOVERY | Low Battery → Solo | Ensure solo ritual |
| DC-OFFLINE-RECOVERY | Doomscroll → Offline | Ensure offline |
| DC-FRUGAL-HOBBY | Frugality → Hobby Count | Cap at 3 |
| DC-NEW23 | Inst Embed → Hobby Type | Mainstream vs fringe |
| DC-B3-HIGH | High Conditioning → Active | Force active hobby |
| DC-B3-LOW | Low Conditioning → Sedentary | Replace active |
| PG-OPERATIVE-HOBBY | Operative → Social | Block social hobbies |
| DC-IMPULSE-GAMBLING | Low Impulse → Gambling | Increase risk |
| DC-RURAL-HOBBY | Rural → Outdoor | Weight outdoor |
| DC-OPSEC-COLLECTION | High Opsec → Items | Non-traceable |
| DC-SPACE-TYPE | Opsec → Space | Private spaces |
| DC-STRESS-LIGHT | Stress → Light | Warm/dim preference |
| DC5 | Conscientiousness → Organization | Style match |
| DC-SOCIAL-SHARING | Low Battery → Private | Private sharing |
| DC-SOCIAL-GROUP | Low Battery → Solo | Solo activities |
| DC-SOCIAL-COMM | Low Battery → Async | Text/email |
| DC-BOUNDARY | Opsec → Boundaries | Firm boundaries |
| DC-EMOTIONAL | Agreeableness → Sharing | Open sharing |
| DC-RISK-EQUIP | Risk → Weapon | Assertive weapons |
| DC-CONSC-ROUTINE | Conscientiousness → Rhythm | Rigid routine |
| DC-PLANNING | Conscientiousness → Planning | Methodical style |

### identity.ts (50 correlates)

#### Career Correlates (20)
| ID | Description |
|----|-------------|
| DC-ID-1 | Age <25 → Block intelligence/foreign-service |
| DC-ID-2 | Age <28 → Block politics |
| DC-ID-3 | Age <28 → Block academia |
| DC-ID-4 | Mass tier → Academia ×0.05 |
| DC-ID-5 | High inst → Civil-service/foreign-service weight |
| DC-ID-6 | Low inst → NGO/journalism weight |
| DC-ID-7 | High risk → Intelligence/military weight |
| DC-ID-8 | Age <30 → Military/journalism boost |
| DC-ID-9 | Age >50 → Academia/politics boost |
| DC-ID-10 | Trade openness → Foreign-service weight |
| DC-ID-11 | Air travel → Journalism/intelligence weight |
| DC-ID-12 | Militarization → Military weight |
| DC-ID-13 | High GDP → Academia/engineering weight |
| DC-ID-14 | Low GDP → NGO/public-health weight |
| DC3 | High opsec → Low-publicness career |
| DC-ID-3B | Risk + inst → Operative career |
| DC-ID-5B | Refugee → Block clearance careers |
| DC-ID-7B | Rural → Rural careers |
| DC-ID-7C | Metro → Metro careers |
| DC-ID-8B | High conditioning → Physical careers |

#### Education Correlates (14)
| ID | Description |
|----|-------------|
| DC-ED-1 | Elite → Graduate/doctorate boost |
| DC-ED-2 | Middle → Undergrad/trade boost |
| DC-ED-3 | Mass → Secondary/trade boost |
| DC-ED-4 | Mass → Block doctorate |
| DC-ED-5 | Mass → Block graduate |
| DC-ED-6 | Academia → Requires graduate+ |
| DC-ED-7 | Academia + undergrad → Weight ×0.1 |
| DC-ED-8 | High inst → Graduate boost |
| DC-ED-9 | Mass + doctorate → Downgrade |
| DC-NEW-5 | Elite + secondary → Force undergrad |
| DC-NEW-1 | Age <30 + doctorate → Downgrade |
| DC-ID-6B | Age >40 + doctorate → Senior career |
| DC-AGE-1 | Education → Age floor |
| DC-GENDER-1 | Culture → Block two-spirit |

#### Language/Identity Correlates (16)
| ID | Description |
|----|-------------|
| DC-OR-1 | Male → Block lesbian |
| DC-OR-2 | Female → Gay ×0.3 |
| DC8 | High cosmo → Add language |
| DC-NEW-10 | Foreign service → 2+ languages |
| DC-LANG-1 | Cosmopolitanism → Language count |
| DC-LANG-2 | Home diversity → Language count |
| DC-LANG-3 | Trade/air → Language count |
| DC-LANG-4 | Career → Language count |
| DC-LANG-5 | Education → Language count |
| DC-PROF-1 | Tier → Proficiency level |
| DC-NEW-8 | High opsec → Block publicly-out |
| DC-OUT-1 | Elite → Closeted boost |
| DC-OUT-2 | Young → Publicly-out boost |
| DC-HON-1 | Elite → Surname honorific |
| DC-HON-2 | Young → Given-name honorific |
| DC-NEW-11 | Intelligence → Requires alias |

### generator.ts (5 correlates)

| ID | Description | Location |
|----|-------------|----------|
| DC20 | Conscientiousness → Opsec Floor | Cross-facet |
| N5 | Family → Religiosity | Orchestration |
| HL4 | Religiosity → Dietary | Orchestration |
| X5 | Agreeableness ↔ Conflict Style | Deterministic |
| #12 | Authoritarianism ↔ Conflict Style | Deterministic |

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
5. **Run validation**: `npx tsx scripts/audit-agents.ts --count 1200`
6. **Document**: Add entry to this file with ID, location, and expected r value

---

**Last Updated**: 2026-01-06
**Total Implemented**: ~406 correlates across 11 facet files
**Formally Tracked**: 75 correlates with Pearson validation
**Verification Rate**: 95% (71 verified, 4 weak, 0 missing)
