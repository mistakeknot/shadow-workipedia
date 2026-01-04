/**
 * Skills computation for agents.
 *
 * Skills are derived competencies with experience tracking.
 * They depend on aptitudes, traits, latents, and career/role context.
 */

import type { Fixed, TierBand, Latents, AgentVocabV1 } from '../types';
import { makeRng, facetSeed, clampFixed01k, clampInt, type SecurityEnv01k } from '../utils';
import type { Aptitudes } from './aptitudes';
import type { PsychTraits } from './traits';

// ============================================================================
// Types
// ============================================================================

export type SkillEntry = {
  value: Fixed;
  xp: Fixed;
  lastUsedDay: number | null;
};

export type SkillBias = {
  skill: string;
  delta: number;
  reason: string;
};

export type SkillsContext = {
  seed: string;
  vocab: AgentVocabV1;
  aptitudes: Aptitudes;
  traits: PsychTraits;
  latents: Latents;
  roleSeedTags: readonly string[];
  tierBand: TierBand;
  careerTrackTag: string;
  voiceTag: string;
  securityEnv01k: SecurityEnv01k | null;
  travelScore: Fixed;
};

export type SkillsResult = {
  skills: Record<string, SkillEntry>;
  voiceBiases: SkillBias[];
};

// ============================================================================
// Skills Computation
// ============================================================================

/**
 * Compute skills from aptitudes, traits, and context.
 *
 * @param ctx - Context with all dependencies
 * @returns Computed skills and voice biases
 */
export function computeSkills(ctx: SkillsContext): SkillsResult {
  const {
    seed, vocab, aptitudes, traits, latents, roleSeedTags,
    tierBand, careerTrackTag, voiceTag, securityEnv01k, travelScore,
  } = ctx;

  const skillRng = makeRng(facetSeed(seed, 'skills'));

  if (!vocab.capabilities.skillKeys.length) {
    throw new Error('Agent vocab missing: capabilities.skillKeys');
  }

  // Security environment axes
  const securityAxis01k = (axis: 'conflict' | 'stateViolence' | 'militarization', fallback01k: Fixed) =>
    securityEnv01k ? securityEnv01k[axis] : fallback01k;

  const conflictEnv01k = securityAxis01k('conflict', 0);
  const stateViolenceEnv01k = securityAxis01k('stateViolence', 0);
  const militarizationEnv01k = securityAxis01k('militarization', 150);
  const securityPressure01k = clampFixed01k(
    0.45 * conflictEnv01k + 0.35 * stateViolenceEnv01k + 0.20 * militarizationEnv01k,
  );

  const skills: Record<string, SkillEntry> = {};

  for (const k of vocab.capabilities.skillKeys) {
    const noise = clampFixed01k(skillRng.int(0, 1000));

    // Career bonuses
    const careerBonus = computeCareerBonus(careerTrackTag, k);
    const tierBonus = tierBand === 'elite' ? 60 : tierBand === 'mass' ? -20 : 0;

    // Compute skill value based on skill type
    const value = computeSkillValue({
      k, noise, careerBonus, tierBonus,
      aptitudes, traits, latents, roleSeedTags, travelScore,
      conflictEnv01k, stateViolenceEnv01k, securityPressure01k,
    });

    // Compute XP based on value
    const xp = clampFixed01k(clampInt(Math.round((value / 1000) * 520) + skillRng.int(0, 180), 0, 500));

    skills[k] = { value, xp, lastUsedDay: null };
  }

  // Apply role seed bumps from vocab
  applyRoleBumps(skills, roleSeedTags, vocab);

  // Voice-based skill biases
  const voiceBiases = applyVoiceBiases(skills, voiceTag, skillRng);

  return { skills, voiceBiases };
}

// ============================================================================
// Helper Functions
// ============================================================================

function computeCareerBonus(careerTrackTag: string, skillKey: string): number {
  return (
    (careerTrackTag === 'military' && ['shooting', 'tradecraft', 'surveillance', 'driving'].includes(skillKey) ? 120 : 0) +
    (careerTrackTag === 'intelligence' && ['tradecraft', 'surveillance', 'shooting', 'driving', 'legalOps'].includes(skillKey) ? 140 : 0) +
    (careerTrackTag === 'foreign-service' && ['negotiation', 'bureaucracy', 'mediaHandling', 'driving'].includes(skillKey) ? 120 : 0) +
    (careerTrackTag === 'journalism' && ['mediaHandling', 'surveillance', 'negotiation'].includes(skillKey) ? 120 : 0) +
    (careerTrackTag === 'law' && ['legalOps', 'bureaucracy', 'negotiation'].includes(skillKey) ? 140 : 0) +
    (careerTrackTag === 'public-health' && ['firstAid', 'bureaucracy', 'negotiation'].includes(skillKey) ? 120 : 0) +
    (careerTrackTag === 'finance' && ['financeOps', 'bureaucracy', 'negotiation'].includes(skillKey) ? 120 : 0) +
    (careerTrackTag === 'logistics' && ['driving', 'tradecraft', 'bureaucracy'].includes(skillKey) ? 120 : 0)
  );
}

type SkillValueParams = {
  k: string;
  noise: Fixed;
  careerBonus: number;
  tierBonus: number;
  aptitudes: Aptitudes;
  traits: PsychTraits;
  latents: Latents;
  roleSeedTags: readonly string[];
  travelScore: Fixed;
  conflictEnv01k: Fixed;
  stateViolenceEnv01k: Fixed;
  securityPressure01k: Fixed;
};

function computeSkillValue(p: SkillValueParams): Fixed {
  const { k, noise, careerBonus, tierBonus, aptitudes, traits, latents, roleSeedTags, travelScore } = p;
  const { conflictEnv01k, stateViolenceEnv01k, securityPressure01k } = p;

  let value: Fixed;
  switch (k) {
    case 'driving':
      value = clampFixed01k(
        0.22 * aptitudes.dexterity + 0.22 * aptitudes.handEyeCoordination +
        0.20 * aptitudes.attentionControl + 0.12 * traits.riskTolerance +
        0.12 * travelScore + 0.12 * noise + careerBonus + tierBonus
      );
      break;

    case 'shooting':
      value = clampFixed01k(
        0.26 * aptitudes.reflexes + 0.24 * aptitudes.handEyeCoordination +
        0.18 * aptitudes.attentionControl + 0.12 * latents.opsecDiscipline +
        0.08 * securityPressure01k + 0.20 * noise + careerBonus + tierBonus
      );
      break;

    case 'surveillance':
      // Correlate #9: Travel ↔ Skills - varied environments sharpen surveillance skills
      value = clampFixed01k(
        0.20 * aptitudes.cognitiveSpeed + 0.20 * aptitudes.attentionControl +
        0.16 * aptitudes.workingMemory + 0.16 * latents.opsecDiscipline +
        0.08 * latents.techFluency +
        0.06 * travelScore + // Diverse environments build surveillance adaptability
        0.06 * stateViolenceEnv01k + 0.16 * noise + careerBonus
      );
      break;

    case 'tradecraft':
      // Correlate #9: Travel ↔ Skills - operatives who travel more develop better tradecraft
      value = clampFixed01k(
        0.24 * latents.opsecDiscipline + 0.20 * aptitudes.deceptionAptitude +
        0.10 * latents.riskAppetite + 0.16 * aptitudes.workingMemory +
        0.08 * latents.techFluency +
        0.08 * travelScore + // Travel experience builds operational skills
        0.06 * conflictEnv01k + 0.16 * noise + careerBonus +
        (roleSeedTags.includes('operative') ? 90 : 0)
      );
      break;

    case 'firstAid':
      value = clampFixed01k(
        0.25 * aptitudes.workingMemory + 0.20 * aptitudes.attentionControl +
        0.25 * traits.conscientiousness + 0.06 * stateViolenceEnv01k +
        0.30 * noise + careerBonus + tierBonus
      );
      break;

    case 'negotiation':
      // Correlate #9: Travel ↔ Skills - international exposure improves negotiation
      value = clampFixed01k(
        0.28 * aptitudes.charisma + 0.18 * aptitudes.empathy +
        0.16 * aptitudes.workingMemory + 0.10 * latents.publicness +
        0.10 * travelScore + // Travel exposure builds cross-cultural negotiation skills
        0.18 * noise + careerBonus + tierBonus
      );
      break;

    case 'mediaHandling':
      value = clampFixed01k(
        0.30 * latents.publicness + 0.20 * aptitudes.charisma +
        0.18 * aptitudes.attentionControl + 0.12 * (1000 - latents.opsecDiscipline) +
        0.06 * latents.techFluency +
        0.20 * noise + careerBonus + (roleSeedTags.includes('media') ? 90 : 0)
      );
      break;

    case 'bureaucracy':
      value = clampFixed01k(
        0.28 * latents.institutionalEmbeddedness + 0.22 * aptitudes.workingMemory +
        0.18 * traits.conscientiousness + 0.32 * noise + careerBonus + tierBonus
      );
      break;

    case 'financeOps':
      value = clampFixed01k(
        0.24 * aptitudes.workingMemory + 0.20 * aptitudes.cognitiveSpeed +
        0.18 * traits.conscientiousness + 0.38 * noise + careerBonus + tierBonus
      );
      break;

    case 'legalOps':
      value = clampFixed01k(
        0.24 * aptitudes.workingMemory + 0.20 * aptitudes.attentionControl +
        0.18 * latents.institutionalEmbeddedness + 0.38 * noise + careerBonus + tierBonus
      );
      break;

    default:
      // Generic skill: cognitive-weighted with high noise
      value = clampFixed01k(
        0.22 * aptitudes.cognitiveSpeed + 0.22 * aptitudes.attentionControl +
        0.18 * aptitudes.workingMemory + 0.38 * noise + careerBonus
      );
      break;
  }

  // Apply floor/ceiling for readability
  return clampFixed01k(clampInt(value, 90, 940));
}

function applyRoleBumps(
  skills: Record<string, SkillEntry>,
  roleSeedTags: readonly string[],
  vocab: AgentVocabV1,
): void {
  const bump = (key: string, delta: number) => {
    const entry = skills[key];
    if (!entry) return;
    entry.value = clampFixed01k(entry.value + delta);
  };

  for (const tag of roleSeedTags) {
    const bumps = vocab.capabilities.roleSkillBumps[tag];
    if (!bumps) continue;
    for (const [skillKey, delta] of Object.entries(bumps)) {
      bump(skillKey, delta);
    }
  }
}

type RngLike = { int: (min: number, max: number) => number };

function applyVoiceBiases(
  skills: Record<string, SkillEntry>,
  voiceTag: string,
  skillRng: RngLike,
): SkillBias[] {
  const biases: SkillBias[] = [];

  const bump = (skill: string, delta: number, reason: string) => {
    const entry = skills[skill];
    if (!entry) return;
    entry.value = clampFixed01k(entry.value + delta);
    biases.push({ skill, delta, reason });
  };

  if (voiceTag === 'commanding') {
    bump('negotiation', skillRng.int(10, 40), 'voice:commanding');
    bump('mediaHandling', skillRng.int(0, 20), 'voice:commanding');
  }
  if (voiceTag === 'warm') {
    bump('negotiation', skillRng.int(0, 20), 'voice:warm');
  }
  if (voiceTag === 'fast-talking') {
    bump('mediaHandling', skillRng.int(5, 30), 'voice:fast-talking');
  }

  return biases;
}
