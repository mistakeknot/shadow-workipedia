/**
 * Aptitude computation for agents.
 *
 * Aptitudes are base physical, cognitive, and social abilities.
 * They are influenced by:
 * - Random base values (seeded)
 * - Physical conditioning latent
 * - Appearance traits (build, height, voice)
 * - Tier band
 */

import type { Fixed, TierBand, HeightBand, Latents } from '../types';
import { clampFixed01k, type Rng } from '../utils';

// ============================================================================
// Types
// ============================================================================

export type Aptitudes = {
  // Physical
  strength: Fixed;
  endurance: Fixed;
  dexterity: Fixed;
  reflexes: Fixed;
  handEyeCoordination: Fixed;
  flexibility: Fixed;
  // Cognitive
  cognitiveSpeed: Fixed;
  attentionControl: Fixed;
  workingMemory: Fixed;
  riskCalibration: Fixed;
  // Social
  charisma: Fixed;
  empathy: Fixed;
  assertiveness: Fixed;
  deceptionAptitude: Fixed;
};

export type AptitudeBias = {
  key: keyof Aptitudes;
  delta: number;
  reason: string;
};

export type AptitudesContext = {
  capRng: Rng;
  latents: Latents;
  tierBand: TierBand;
  buildTag: string;
  heightBand: HeightBand;
  voiceTag: string;
  /** Education track for cognitive aptitude biases (correlates #E1/#E2) */
  educationTrackTag?: string;
  /** Agent's age for aptitude modifiers (correlate PA6) */
  age?: number;
};

export type AptitudesResult = {
  aptitudes: Aptitudes;
  biases: AptitudeBias[];
};

// ============================================================================
// Aptitude Computation
// ============================================================================

/**
 * Compute aptitudes from appearance and latent traits.
 *
 * @param ctx - Context with RNG, latents, and appearance tags
 * @returns Computed aptitudes and applied biases
 */
export function computeAptitudes(ctx: AptitudesContext): AptitudesResult {
  const { capRng, latents, tierBand, buildTag, heightBand, voiceTag } = ctx;

  // Base category scores
  const physical = capRng.int(200, 900);
  const coordination = capRng.int(200, 900);
  const cognitive = capRng.int(200, 900);
  const social = capRng.int(200, 900);

  // PA6: Age continuously affects cognitiveSpeed (r~-0.25 expected)
  // Cognitive processing speed peaks in 20s and declines ~3pts/decade after 30
  const age = ctx.age ?? 35;
  const ageCogPenalty = age > 30 ? Math.min(250, (age - 30) * 5) : 0;

  // PA8: Age continuously affects reflexes (r~-0.30 expected)
  // Reflexes decline more steeply after 40, ~4pts/year
  const ageReflexPenalty = age > 35 ? Math.min(300, (age - 35) * 6) : 0;

  // PA7: High reflexes require baseline cognitiveSpeed (computed as co-variation)
  // This is modeled by having reflexes contribute positively to cognitiveSpeed
  const reflexCogBoost = Math.round(coordination * 0.08); // Reflexes base contributes to cog

  // Initial aptitude values
  let aptitudes: Aptitudes = {
    // Physical aptitudes
    strength: clampFixed01k(0.75 * physical + 0.25 * capRng.int(0, 1000) - (tierBand === 'elite' ? 30 : 0)),
    endurance: clampFixed01k(0.70 * physical + 0.30 * capRng.int(0, 1000)),
    dexterity: clampFixed01k(0.60 * coordination + 0.40 * capRng.int(0, 1000)),
    reflexes: clampFixed01k(0.75 * coordination + 0.25 * capRng.int(0, 1000) - ageReflexPenalty),
    handEyeCoordination: clampFixed01k(0.80 * coordination + 0.20 * capRng.int(0, 1000)),
    flexibility: clampFixed01k(0.55 * coordination + 0.45 * capRng.int(0, 1000)),
    // Cognitive aptitudes (with PA6/PA7 continuous effects)
    cognitiveSpeed: clampFixed01k(
      0.65 * cognitive + 0.25 * capRng.int(0, 1000) + reflexCogBoost - ageCogPenalty
    ),
    attentionControl: clampFixed01k(0.55 * cognitive + 0.45 * capRng.int(0, 1000)),
    workingMemory: clampFixed01k(0.65 * cognitive + 0.35 * capRng.int(0, 1000)),
    riskCalibration: clampFixed01k(0.45 * cognitive + 0.55 * capRng.int(0, 1000)),
    // Social aptitudes
    charisma: clampFixed01k(0.75 * social + 0.25 * capRng.int(0, 1000)),
    empathy: clampFixed01k(0.55 * social + 0.45 * capRng.int(0, 1000)),
    assertiveness: clampFixed01k(0.50 * social + 0.50 * capRng.int(0, 1000)),
    deceptionAptitude: clampFixed01k(0.40 * social + 0.60 * capRng.int(0, 1000)),
  };

  // Track biases for tracing
  const biases: AptitudeBias[] = [];
  const bumpApt = (key: keyof Aptitudes, delta: number, reason: string) => {
    if (!delta) return;
    aptitudes = { ...aptitudes, [key]: clampFixed01k(aptitudes[key] + delta) };
    biases.push({ key, delta, reason });
  };

  // Physical conditioning latent influences strength/endurance
  const conditioning01 = latents.physicalConditioning / 1000;
  const conditioningDelta = Math.round((conditioning01 - 0.5) * 80);
  bumpApt('strength', conditioningDelta, 'physicalConditioning');
  bumpApt('endurance', Math.round((conditioning01 - 0.5) * 70), 'physicalConditioning');

  // Correlate #HL3: Endurance ↔ Stress Reactivity (negative)
  // Chronic stress depletes physical reserves, reducing endurance
  const stress01 = latents.stressReactivity / 1000;
  const stressEndurancePenalty = Math.round((stress01 - 0.5) * -80);
  bumpApt('endurance', stressEndurancePenalty, 'stressReactivity:#HL3');

  // PR4: Reflexes ↔ Hand-Eye Coordination (positive correlation)
  // Fast reflexes facilitate better hand-eye coordination through quicker neural feedback loops.
  // Applied as weighted probability boost: high reflexes (>600) increase hand-eye coordination.
  const reflexes01 = aptitudes.reflexes / 1000;
  if (reflexes01 > 0.6) {
    // Scale boost by how far above threshold: max +60 at reflexes=1000
    const reflexBoostMagnitude = Math.round((reflexes01 - 0.6) * 150);
    // Probabilistic application: 70% chance to apply, with random variance
    if (capRng.int(0, 100) < 70) {
      const variance = capRng.int(-10, 10);
      bumpApt('handEyeCoordination', reflexBoostMagnitude + variance, 'PR4:reflexes-coordination');
    }
  }

  // Build tag influences
  const buildKey = buildTag.toLowerCase();
  const muscular = ['muscular', 'athletic', 'broad-shouldered', 'brawny', 'barrel-chested', 'sturdy', 'solid'];
  const wiry = ['wiry', 'lean', 'lanky', 'long-limbed', "runner's build", 'graceful', 'sinewy'];

  if (muscular.includes(buildKey)) {
    bumpApt('strength', capRng.int(20, 60), `build:${buildTag}`);
    bumpApt('endurance', capRng.int(10, 40), `build:${buildTag}`);
  } else if (wiry.includes(buildKey)) {
    bumpApt('dexterity', capRng.int(10, 40), `build:${buildTag}`);
    bumpApt('handEyeCoordination', capRng.int(10, 30), `build:${buildTag}`);
    bumpApt('endurance', capRng.int(5, 25), `build:${buildTag}`);
  } else if (['heavyset', 'stocky', 'compact', 'curvy'].includes(buildKey)) {
    bumpApt('strength', capRng.int(5, 30), `build:${buildTag}`);
    bumpApt('endurance', -capRng.int(0, 20), `build:${buildTag}`);
  }

  // Height influences
  if (heightBand === 'tall' || heightBand === 'very_tall') {
    bumpApt('strength', capRng.int(0, 25), `height:${heightBand}`);
  }
  if (heightBand === 'very_short') {
    bumpApt('strength', -capRng.int(0, 15), `height:${heightBand}`);
  }

  // Voice influences social aptitudes
  if (voiceTag === 'commanding') {
    bumpApt('assertiveness', capRng.int(20, 50), `voice:${voiceTag}`);
    bumpApt('charisma', capRng.int(10, 30), `voice:${voiceTag}`);
  }
  if (voiceTag === 'warm') {
    bumpApt('empathy', capRng.int(10, 40), `voice:${voiceTag}`);
  }
  if (voiceTag === 'fast-talking') {
    bumpApt('charisma', capRng.int(10, 30), `voice:${voiceTag}`);
    bumpApt('attentionControl', -capRng.int(0, 20), `voice:${voiceTag}`);
  }

  // Correlates #E1/#E2: Education ↔ Cognitive Aptitudes
  // Higher education correlates with stronger cognitive aptitudes (practice, training, selection)
  const educationTrackTag = ctx.educationTrackTag ?? 'secondary';
  const educationCognitiveBias = (() => {
    switch (educationTrackTag) {
      case 'doctorate': return 150;
      case 'graduate': return 100;
      case 'undergraduate': return 50;
      case 'military-academy': return 30;
      case 'civil-service-track': return 20;
      case 'trade-certification': return -10;
      case 'secondary': return -40;
      case 'self-taught': return -20; // Slightly above secondary (self-directed learning)
      default: return 0;
    }
  })();
  if (educationCognitiveBias !== 0) {
    bumpApt('cognitiveSpeed', educationCognitiveBias, `education:${educationTrackTag}`);
    bumpApt('workingMemory', educationCognitiveBias, `education:${educationTrackTag}`);
    bumpApt('attentionControl', Math.round(educationCognitiveBias * 0.6), `education:${educationTrackTag}`);
  }

  // Plausibility Gate PG7: High Empathy + High Deception is Implausible
  // Truly empathetic people struggle with sustained deception; high deception requires
  // compartmentalization that conflicts with deep empathy.
  if (aptitudes.empathy > 800 && aptitudes.deceptionAptitude > 750) {
    const deceptionCap = 600;
    const delta = deceptionCap - aptitudes.deceptionAptitude;
    aptitudes = { ...aptitudes, deceptionAptitude: deceptionCap };
    biases.push({ key: 'deceptionAptitude', delta, reason: 'PG7:empathy-deception-conflict' });
  }

  // ============================================================================
  // Aptitude Interdependencies (PA correlates)
  // ============================================================================

  // PA1: High dexterity ensures handEyeCoordination floor
  // Fine motor control (dexterity) builds hand-eye coordination over time
  if (aptitudes.dexterity > 700 && aptitudes.handEyeCoordination < 450) {
    const delta = 450 - aptitudes.handEyeCoordination;
    aptitudes = { ...aptitudes, handEyeCoordination: 450 as Fixed };
    biases.push({ key: 'handEyeCoordination', delta, reason: 'PA1:dexterity-coordination-floor' });
  }

  // PA2: High cognitiveSpeed ensures workingMemory floor
  // Fast processing requires adequate working memory to hold intermediate results
  if (aptitudes.cognitiveSpeed > 750 && aptitudes.workingMemory < 400) {
    const delta = 400 - aptitudes.workingMemory;
    aptitudes = { ...aptitudes, workingMemory: 400 as Fixed };
    biases.push({ key: 'workingMemory', delta, reason: 'PA2:cognitiveSpeed-memory-floor' });
  }

  // PA3: High riskCalibration requires attentionControl
  // Accurate risk assessment requires sustained focus to gather relevant information
  if (aptitudes.riskCalibration > 700 && aptitudes.attentionControl < 400) {
    const delta = 400 - aptitudes.attentionControl;
    aptitudes = { ...aptitudes, attentionControl: 400 as Fixed };
    biases.push({ key: 'attentionControl', delta, reason: 'PA3:riskCalibration-attention-floor' });
  }

  // PA4: High strength ensures endurance floor
  // Strong muscles require cardiovascular capacity to support them during exertion
  if (aptitudes.strength > 800 && aptitudes.endurance < 350) {
    const delta = 350 - aptitudes.endurance;
    aptitudes = { ...aptitudes, endurance: 350 as Fixed };
    biases.push({ key: 'endurance', delta, reason: 'PA4:strength-endurance-floor' });
  }

  // PA5: High workingMemory requires attentionControl
  // Holding complex information in mind requires focus to prevent interference
  if (aptitudes.workingMemory > 800 && aptitudes.attentionControl < 450) {
    const delta = 450 - aptitudes.attentionControl;
    aptitudes = { ...aptitudes, attentionControl: 450 as Fixed };
    biases.push({ key: 'attentionControl', delta, reason: 'PA5:workingMemory-attention-floor' });
  }

  // PA6: Age 55+ caps cognitiveSpeed (additional threshold on top of continuous penalty)
  // Cognitive processing speed naturally declines with age
  if (age > 55) {
    const ageCap = 800 - (age - 55) * 8;
    if (aptitudes.cognitiveSpeed > ageCap) {
      const delta = ageCap - aptitudes.cognitiveSpeed;
      aptitudes = { ...aptitudes, cognitiveSpeed: clampFixed01k(ageCap) };
      biases.push({ key: 'cognitiveSpeed', delta, reason: `PA6:age-${age}-cognitive-cap` });
    }
  }

  // PA7: High reflexes ensure cognitiveSpeed floor
  // Fast reflexes require neural processing speed to trigger rapid responses
  if (aptitudes.reflexes > 750 && aptitudes.cognitiveSpeed < 400) {
    const delta = 400 - aptitudes.cognitiveSpeed;
    aptitudes = { ...aptitudes, cognitiveSpeed: 400 as Fixed };
    biases.push({ key: 'cognitiveSpeed', delta, reason: 'PA7:reflexes-cognitiveSpeed-floor' });
  }

  // PA8: Age > 50 progressively reduces reflexes
  // Age-related reflexive slowing due to neural signal delay
  if (age > 50) {
    const reflexCap = 800 - 6 * (age - 50);
    if (aptitudes.reflexes > reflexCap) {
      const delta = reflexCap - aptitudes.reflexes;
      aptitudes = { ...aptitudes, reflexes: clampFixed01k(reflexCap) };
      biases.push({ key: 'reflexes', delta, reason: `PA8:age-${age}-reflexes-decline` });
    }
  }

  // PA9: Age < 30 ensures dexterity floor
  // Young people maintain fine motor skills through neuroplasticity
  if (age < 30 && aptitudes.dexterity < 350) {
    const delta = 350 - aptitudes.dexterity;
    aptitudes = { ...aptitudes, dexterity: 350 as Fixed };
    biases.push({ key: 'dexterity', delta, reason: `PA9:age-${age}-dexterity-floor` });
  }

  // PA10: High stressReactivity caps attentionControl
  // Chronic stress impairs sustained attention through cortisol-mediated prefrontal dysfunction
  if (latents.stressReactivity > 800 && aptitudes.attentionControl > 550) {
    const delta = 550 - aptitudes.attentionControl;
    aptitudes = { ...aptitudes, attentionControl: 550 as Fixed };
    biases.push({ key: 'attentionControl', delta, reason: 'PA10:stress-attention-cap' });
  }

  // PA11: High physicalConditioning ensures endurance floor
  // Fitness correlates with cardiovascular stamina
  if (latents.physicalConditioning > 700 && aptitudes.endurance < 400) {
    const delta = 400 - aptitudes.endurance;
    aptitudes = { ...aptitudes, endurance: 400 as Fixed };
    biases.push({ key: 'endurance', delta, reason: 'PA11:conditioning-endurance-floor' });
  }

  // PA12: Age > 60 + low conditioning caps strength
  // Combined age and inactivity leads to sarcopenia (muscle loss)
  if (age > 60 && latents.physicalConditioning < 400 && aptitudes.strength > 500) {
    const delta = 500 - aptitudes.strength;
    aptitudes = { ...aptitudes, strength: 500 as Fixed };
    biases.push({ key: 'strength', delta, reason: `PA12:age-${age}-inactive-strength-cap` });
  }

  // ============================================================================
  // Plausibility Gates (PG correlates)
  // ============================================================================

  // PG8: Very high assertiveness + low charisma → cap assertiveness
  // Highly assertive people without charisma come across as abrasive, limiting effectiveness
  if (aptitudes.assertiveness > 850 && aptitudes.charisma < 300) {
    const assertivenessCap = 700;
    const delta = assertivenessCap - aptitudes.assertiveness;
    aptitudes = { ...aptitudes, assertiveness: assertivenessCap as Fixed };
    biases.push({ key: 'assertiveness', delta, reason: 'PG8:assertiveness-charisma-cap' });
  }

  // PG9: Very low empathy caps charisma
  // Charisma requires some ability to read and respond to others' emotions
  if (aptitudes.empathy < 250 && aptitudes.charisma > 600) {
    const charismaCap = 600;
    const delta = charismaCap - aptitudes.charisma;
    aptitudes = { ...aptitudes, charisma: charismaCap as Fixed };
    biases.push({ key: 'charisma', delta, reason: 'PG9:empathy-charisma-cap' });
  }

  // PG10: Lean body builds cap strength
  // Slight/lean builds lack the muscle mass for exceptional strength
  if (['lean', 'slight', 'slim', 'slender', 'thin', 'petite', 'willowy'].includes(buildKey) && aptitudes.strength > 700) {
    const strengthCap = 700;
    const delta = strengthCap - aptitudes.strength;
    aptitudes = { ...aptitudes, strength: strengthCap as Fixed };
    biases.push({ key: 'strength', delta, reason: `PG10:build-${buildTag}-strength-cap` });
  }

  // PG11: Very low cognitiveSpeed caps workingMemory
  // Processing speed limits how effectively memory can be utilized
  if (aptitudes.cognitiveSpeed < 250 && aptitudes.workingMemory > 650) {
    const memoryCap = 650;
    const delta = memoryCap - aptitudes.workingMemory;
    aptitudes = { ...aptitudes, workingMemory: memoryCap as Fixed };
    biases.push({ key: 'workingMemory', delta, reason: 'PG11:cognitiveSpeed-memory-cap' });
  }

  // PG12: Very low endurance caps strength
  // No stamina limits usable strength in sustained exertion
  if (aptitudes.endurance < 200 && aptitudes.strength > 700) {
    const strengthCap = 700;
    const delta = strengthCap - aptitudes.strength;
    aptitudes = { ...aptitudes, strength: strengthCap as Fixed };
    biases.push({ key: 'strength', delta, reason: 'PG12:endurance-strength-cap' });
  }

  // PG13: Very low attentionControl caps reflexes
  // Inattention slows reactive response due to delayed threat detection
  if (aptitudes.attentionControl < 200 && aptitudes.reflexes > 600) {
    const reflexCap = 600;
    const delta = reflexCap - aptitudes.reflexes;
    aptitudes = { ...aptitudes, reflexes: reflexCap as Fixed };
    biases.push({ key: 'reflexes', delta, reason: 'PG13:attention-reflexes-cap' });
  }

  // PG14: Stocky/muscular build + age > 50 caps flexibility
  // Muscle bulk combined with age reduces joint range of motion
  const stockyMuscular = ['stocky', 'muscular', 'brawny', 'broad-shouldered', 'barrel-chested'];
  if (stockyMuscular.includes(buildKey) && age > 50 && aptitudes.flexibility > 550) {
    const flexibilityCap = 550;
    const delta = flexibilityCap - aptitudes.flexibility;
    aptitudes = { ...aptitudes, flexibility: flexibilityCap as Fixed };
    biases.push({ key: 'flexibility', delta, reason: `PG14:build-${buildTag}-age-${age}-flexibility-cap` });
  }

  // ============================================================================
  // NEW29: Tier ↔ Aptitude Ceiling/Floor
  // ============================================================================
  // Elite tier: higher cognitive floors (access to education, stimulation, nutrition)
  // Mass tier: soft ceiling on social aptitudes (limited networking access)

  if (tierBand === 'elite') {
    // Elite cognitive floor - access to education and mental stimulation
    const eliteCognitiveFloor = 350;
    if (aptitudes.cognitiveSpeed < eliteCognitiveFloor) {
      const delta = eliteCognitiveFloor - aptitudes.cognitiveSpeed;
      aptitudes = { ...aptitudes, cognitiveSpeed: eliteCognitiveFloor as Fixed };
      biases.push({ key: 'cognitiveSpeed', delta, reason: 'NEW29:elite-cognitive-floor' });
    }
    if (aptitudes.workingMemory < eliteCognitiveFloor) {
      const delta = eliteCognitiveFloor - aptitudes.workingMemory;
      aptitudes = { ...aptitudes, workingMemory: eliteCognitiveFloor as Fixed };
      biases.push({ key: 'workingMemory', delta, reason: 'NEW29:elite-memory-floor' });
    }
  }

  if (tierBand === 'mass') {
    // Mass tier has soft ceiling on social aptitudes (limited networking access)
    // Only applies probabilistically to prevent determinism
    const massSocialCeiling = 750;
    if (aptitudes.charisma > massSocialCeiling && capRng.next01() < 0.35) {
      const delta = massSocialCeiling - aptitudes.charisma;
      aptitudes = { ...aptitudes, charisma: massSocialCeiling as Fixed };
      biases.push({ key: 'charisma', delta, reason: 'NEW29:mass-social-ceiling' });
    }
  }

  return { aptitudes, biases };
}
