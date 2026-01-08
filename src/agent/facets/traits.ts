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
 * @param age - Agent's current age (affects conscientiousness)
 * @returns Psychological trait values
 */
export function computeTraits(
  seed: string,
  aptitudes: Aptitudes,
  latents: Latents,
  age: number,
): PsychTraits {
  const traitRng = makeRng(facetSeed(seed, 'psych_traits'));

  // Age bonus for conscientiousness: +3 per year over 25, capped at +120 (age 65)
  // Research shows conscientiousness increases with age throughout adulthood
  const ageBonus = Math.max(0, Math.min(120, (age - 25) * 3));

  // DC-T5: Age reduces novelty-seeking (continuous effect)
  // Research shows openness/novelty-seeking declines gradually with age
  const ageNoveltyCap = age > 30 ? Math.max(400, 1000 - (age - 30) * 10) : 1000;

  // DC-T8: Social battery influences agreeableness capacity (continuous)
  // Lower social energy means less capacity for social agreeableness
  const socialBatteryAgreeBonus = 0.12 * latents.socialBattery;

  // PG-T1: Authoritarianism contributes to conscientiousness (continuous)
  // Respect for order/rules correlates with disciplined behavior
  // This is calculated as a continuous factor, not just a floor

  const traits: PsychTraits = {
    riskTolerance: clampFixed01k(
      0.35 * (1000 - aptitudes.riskCalibration) +
      0.35 * latents.riskAppetite +
      0.30 * traitRng.int(0, 1000)
    ),
    conscientiousness: clampFixed01k(
      0.45 * aptitudes.attentionControl +
      0.20 * latents.opsecDiscipline +
      0.15 * traitRng.int(0, 1000) +
      ageBonus
      // PG-T1 continuous effect added in post-processing below
    ),
    // PG-T2: Opsec added as continuous negative factor (high opsec = less novelty seeking)
    noveltySeeking: clampFixed01k(
      Math.min(
        ageNoveltyCap, // DC-T5: Age continuously caps novelty seeking
        0.50 * aptitudes.cognitiveSpeed +
        0.20 * latents.cosmopolitanism +
        -0.15 * latents.opsecDiscipline +  // PG-T2: High opsec reduces novelty
        0.15 * traitRng.int(0, 1000)
      )
    ),
    agreeableness: clampFixed01k(
      0.53 * aptitudes.empathy +
      0.15 * (1000 - latents.riskAppetite) +
      socialBatteryAgreeBonus + // DC-T8: Social battery contributes to agreeableness
      0.20 * traitRng.int(0, 1000)
    ),
    authoritarianism: clampFixed01k(
      0.55 * aptitudes.assertiveness +
      0.25 * latents.institutionalEmbeddedness +
      0.20 * traitRng.int(0, 1000)
    ),
  };

  // PG-T1: Authoritarianism → conscientiousness continuous contribution
  // Those who value order tend to be more conscientious (gradual, not just threshold)
  // Increased from 0.08 to 0.20 to strengthen correlation
  const authContribution = 0.20 * traits.authoritarianism;
  traits.conscientiousness = clampFixed01k(traits.conscientiousness + authContribution);

  // ─────────────────────────────────────────────────────────────────────────────
  // TRAIT COHERENCE CORRELATES (Post-generation adjustments)
  // ─────────────────────────────────────────────────────────────────────────────

  // DC-T1: High riskTolerance incompatible with high conscientiousness
  // Risk-takers are impulsive; conscientious people are careful planners
  if (traits.riskTolerance > 700 && traits.conscientiousness > 700) {
    traits.conscientiousness = Math.min(traits.conscientiousness, 650);
  }

  // DC-T2: High noveltySeeking incompatible with high authoritarianism
  // Novelty seekers question authority; authoritarians prefer tradition and order
  if (traits.noveltySeeking > 700 && traits.authoritarianism > 700) {
    traits.authoritarianism = Math.min(traits.authoritarianism, 600);
  }

  // DC-T3: High agreeableness caps riskTolerance
  // Agreeable people avoid conflict/risk to maintain harmony
  if (traits.agreeableness > 750 && traits.riskTolerance > 700) {
    traits.riskTolerance = Math.min(traits.riskTolerance, 600);
  }

  // DC-T5: Age 55+ caps noveltySeeking
  // Research shows openness/novelty-seeking declines with age
  if (age > 55) {
    const ageCap = 650 - (age - 55) * 5;
    traits.noveltySeeking = Math.min(traits.noveltySeeking, Math.max(300, ageCap));
  }

  // DC-T7: High stressReactivity reduces conscientiousness
  // Chronic stress impairs executive function and self-regulation
  if (latents.stressReactivity > 750) {
    const stressPenalty = (latents.stressReactivity - 750) / 2;
    const stressCap = 700 - stressPenalty;
    traits.conscientiousness = Math.min(traits.conscientiousness, Math.max(300, stressCap));
  }

  // DC-T8: Low socialBattery + high agreeableness → cap agreeableness
  // Introverts with low social energy can't maintain excessive agreeableness
  if (latents.socialBattery < 300 && traits.agreeableness > 750) {
    traits.agreeableness = Math.min(traits.agreeableness, 700);
  }

  // PG-T1: High authoritarianism raises conscientiousness floor
  // Authoritarians value order, rules, and discipline (conscientiousness baseline)
  if (traits.authoritarianism > 750 && traits.conscientiousness < 400) {
    traits.conscientiousness = 400;
  }

  // PG-T2: Both very high opsec and novelty → cap novelty
  // Strict operational security requires routine and predictability; novelty-seeking is a liability
  if (latents.opsecDiscipline > 800 && traits.noveltySeeking > 750) {
    traits.noveltySeeking = Math.min(traits.noveltySeeking, 650);
  }

  // DC-T4: High impulse → conscientiousness cap
  // Low impulse control incompatible with high conscientiousness
  if (latents.impulseControl < 300) {
    traits.conscientiousness = clampFixed01k(Math.min(traits.conscientiousness, 650));
  }

  // DC-T6: Cosmopolitanism → authoritarianism reduction
  // High cosmopolitanism reduces in-group authoritarianism (continuous effect)
  const cosmo01 = latents.cosmopolitanism / 1000;
  traits.authoritarianism = clampFixed01k(traits.authoritarianism - Math.floor(150 * cosmo01));

  // DC-T9: Deception → trust floor
  // High deceivers must maintain basic social trust
  if (aptitudes.deceptionAptitude > 750) {
    traits.agreeableness = clampFixed01k(Math.max(traits.agreeableness, 250));
  }

  // DC-T10: Empathy → principledness floor
  // High empathy correlates with moral concern
  if (aptitudes.empathy > 800) {
    traits.conscientiousness = clampFixed01k(Math.max(traits.conscientiousness, 350));
  }

  // DC-T11: Stress + agreeableness → assertiveness cap
  // High stress + high agreeableness = conflict avoidance
  // Note: authoritarianism serves as proxy for assertiveness in trait space
  if (latents.stressReactivity > 700 && traits.agreeableness > 700) {
    traits.authoritarianism = clampFixed01k(Math.min(traits.authoritarianism, 550));
  }

  // DC-T12: Adaptability → dogmatism cap (continuous effect)
  // High adaptability incompatible with rigid thinking
  // Note: authoritarianism serves as proxy for dogmatism in trait space
  const adapt01 = latents.adaptability / 1000;
  traits.authoritarianism = clampFixed01k(traits.authoritarianism - Math.floor(120 * adapt01));

  // PG-T3: Very low empathy → agreeableness cap
  // Very low empathy limits genuine agreeableness
  if (aptitudes.empathy < 200) {
    traits.agreeableness = clampFixed01k(Math.min(traits.agreeableness, 600));
  }

  // PG-T4: Very high authoritarianism → openness cap
  // Extreme authoritarianism limits openness
  // Note: noveltySeeking serves as proxy for openness in trait space
  if (traits.authoritarianism > 850) {
    traits.noveltySeeking = clampFixed01k(Math.min(traits.noveltySeeking, 550));
  }

  // PG-T5: High opsec + high impulse control → risk floor
  // Controlled risk-taking requires some risk tolerance
  if (latents.opsecDiscipline > 800 && latents.impulseControl > 750) {
    traits.riskTolerance = clampFixed01k(Math.max(traits.riskTolerance, 200));
  }

  // PG-T6: Very high curiosity → cautiousness cap
  // Extreme curiosity limits excessive caution
  // Note: conscientiousness serves as proxy for cautiousness in trait space
  if (latents.curiosityBandwidth > 850) {
    traits.conscientiousness = clampFixed01k(Math.min(traits.conscientiousness, 600));
  }

  return traits;
}
