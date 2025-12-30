/**
 * Agent capabilities facet - orchestrates aptitudes, traits, and skills computation.
 *
 * This module provides the main entry point for computing agent capabilities.
 * The actual computation is delegated to sub-modules:
 * - aptitudes.ts - physical, cognitive, social aptitudes
 * - traits.ts - psychological traits
 * - skills.ts - derived skill competencies
 */

import type {
  Fixed,
  TierBand,
  HeightBand,
  Latents,
  AgentVocabV1,
  AgentGenerationTraceV1,
} from '../types';

import {
  makeRng,
  facetSeed,
  traceSet,
  traceFacet,
  type SecurityEnv01k,
} from '../utils';

// Re-export sub-module types and functions
export {
  type Aptitudes,
  type AptitudeBias,
  type AptitudesContext,
  type AptitudesResult,
  computeAptitudes,
} from './aptitudes';
export { type PsychTraits, computeTraits } from './traits';
export {
  type SkillEntry,
  type SkillBias,
  type SkillsContext,
  type SkillsResult,
  computeSkills,
} from './skills';

// Import for internal use
import { computeAptitudes, type Aptitudes, type AptitudeBias } from './aptitudes';
import { computeTraits, type PsychTraits } from './traits';
import { computeSkills, type SkillEntry, type SkillBias } from './skills';

// ============================================================================
// Types
// ============================================================================

/**
 * Context required for capabilities computation.
 */
export type CapabilitiesContext = {
  seed: string;
  vocab: AgentVocabV1;
  latents: Latents;
  roleSeedTags: readonly string[];
  tierBand: TierBand;
  // Appearance tags that influence aptitudes
  buildTag: string;
  heightBand: HeightBand;
  voiceTag: string;
  // Career context for skill bonuses
  careerTrackTag: string;
  // Security environment for skill modifiers
  securityEnv01k: SecurityEnv01k | null;
  // Travel score for mobility-related skills
  travelScore: Fixed;
  // Tracing
  trace?: AgentGenerationTraceV1;
};

/**
 * Result of capabilities computation.
 */
export type CapabilitiesResult = {
  aptitudes: Aptitudes;
  traits: PsychTraits;
  skills: Record<string, SkillEntry>;
  // Diagnostic info
  aptitudeBiases: AptitudeBias[];
  voiceSkillBiases: SkillBias[];
};

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Compute capabilities (aptitudes, traits, and skills) for an agent.
 *
 * @param ctx - Context containing all inputs needed for computation
 * @returns Computed aptitudes, traits, skills, and diagnostic biases
 */
export function computeCapabilities(ctx: CapabilitiesContext): CapabilitiesResult {
  const { seed, trace } = ctx;

  // Compute aptitudes
  traceFacet(trace, seed, 'capabilities');
  const capRng = makeRng(facetSeed(seed, 'capabilities'));

  const { aptitudes, biases: aptitudeBiases } = computeAptitudes({
    capRng,
    latents: ctx.latents,
    tierBand: ctx.tierBand,
    buildTag: ctx.buildTag,
    heightBand: ctx.heightBand,
    voiceTag: ctx.voiceTag,
  });

  if (trace) {
    trace.derived.aptitudeBiases = aptitudeBiases;
  }
  traceSet(trace, 'capabilities.aptitudes', aptitudes, {
    method: 'formula+appearanceLatents',
    dependsOn: {
      facet: 'capabilities',
      tierBand: ctx.tierBand,
      buildTag: ctx.buildTag,
      heightBand: ctx.heightBand,
      voiceTag: ctx.voiceTag,
      conditioning01: ctx.latents.physicalConditioning / 1000,
      aptitudeBiases,
    },
  });

  // Compute traits (needed for skills)
  traceFacet(trace, seed, 'psych_traits');
  const traits = computeTraits(seed, aptitudes, ctx.latents);
  traceSet(trace, 'psych.traits', traits, {
    method: 'formula',
    dependsOn: { facet: 'psych_traits', latents: ctx.latents, aptitudes },
  });

  // Compute skills
  traceFacet(trace, seed, 'skills');
  const { skills, voiceBiases: voiceSkillBiases } = computeSkills({
    seed,
    vocab: ctx.vocab,
    aptitudes,
    traits,
    latents: ctx.latents,
    roleSeedTags: ctx.roleSeedTags,
    tierBand: ctx.tierBand,
    careerTrackTag: ctx.careerTrackTag,
    voiceTag: ctx.voiceTag,
    securityEnv01k: ctx.securityEnv01k,
    travelScore: ctx.travelScore,
  });

  if (trace && voiceSkillBiases.length) {
    trace.derived.voiceSkillBiases = voiceSkillBiases;
  }
  traceSet(trace, 'capabilities.skills', skills, {
    method: 'derived+roleBumps+voiceBumps',
    dependsOn: {
      facet: 'skills',
      roleSeedTags: ctx.roleSeedTags,
      careerTrackTag: ctx.careerTrackTag,
      tierBand: ctx.tierBand,
      voiceTag: ctx.voiceTag,
      voiceSkillBiases,
    },
  });

  return {
    aptitudes,
    traits,
    skills,
    aptitudeBiases,
    voiceSkillBiases,
  };
}
