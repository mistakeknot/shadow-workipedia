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

  // Initial aptitude values
  let aptitudes: Aptitudes = {
    // Physical aptitudes
    strength: clampFixed01k(0.75 * physical + 0.25 * capRng.int(0, 1000) - (tierBand === 'elite' ? 30 : 0)),
    endurance: clampFixed01k(0.70 * physical + 0.30 * capRng.int(0, 1000)),
    dexterity: clampFixed01k(0.60 * coordination + 0.40 * capRng.int(0, 1000)),
    reflexes: clampFixed01k(0.75 * coordination + 0.25 * capRng.int(0, 1000)),
    handEyeCoordination: clampFixed01k(0.80 * coordination + 0.20 * capRng.int(0, 1000)),
    // Cognitive aptitudes
    cognitiveSpeed: clampFixed01k(0.70 * cognitive + 0.30 * capRng.int(0, 1000)),
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

  return { aptitudes, biases };
}
