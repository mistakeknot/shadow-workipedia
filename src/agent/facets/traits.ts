/**
 * Psychological traits computation for agents.
 *
 * Traits are personality dimensions derived from aptitudes and latents.
 * They influence skill development and behavioral patterns.
 */

import type { Fixed, Latents } from '../types';
import { makeRng, facetSeed, clampFixed01k } from '../utils';
import type { Aptitudes } from './aptitudes';

// ============================================================================
// Types
// ============================================================================

export type PsychTraits = {
  riskTolerance: Fixed;
  conscientiousness: Fixed;
  noveltySeeking: Fixed;
  agreeableness: Fixed;
  authoritarianism: Fixed;
};

// ============================================================================
// Traits Computation
// ============================================================================

/**
 * Compute psychological traits from aptitudes and latents.
 *
 * @param seed - Agent seed string
 * @param aptitudes - Computed aptitudes
 * @param latents - Latent trait values
 * @returns Psychological trait values
 */
export function computeTraits(
  seed: string,
  aptitudes: Aptitudes,
  latents: Latents,
): PsychTraits {
  const traitRng = makeRng(facetSeed(seed, 'psych_traits'));

  return {
    riskTolerance: clampFixed01k(
      0.35 * (1000 - aptitudes.riskCalibration) +
      0.35 * latents.riskAppetite +
      0.30 * traitRng.int(0, 1000)
    ),
    conscientiousness: clampFixed01k(
      0.55 * aptitudes.attentionControl +
      0.25 * latents.opsecDiscipline +
      0.20 * traitRng.int(0, 1000)
    ),
    noveltySeeking: clampFixed01k(
      0.55 * aptitudes.cognitiveSpeed +
      0.25 * latents.cosmopolitanism +
      0.20 * traitRng.int(0, 1000)
    ),
    agreeableness: clampFixed01k(
      0.65 * aptitudes.empathy +
      0.15 * (1000 - latents.riskAppetite) +
      0.20 * traitRng.int(0, 1000)
    ),
    authoritarianism: clampFixed01k(
      0.55 * aptitudes.assertiveness +
      0.25 * latents.institutionalEmbeddedness +
      0.20 * traitRng.int(0, 1000)
    ),
  };
}
