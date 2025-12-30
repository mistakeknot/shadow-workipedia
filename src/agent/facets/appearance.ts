/**
 * Appearance Facet
 *
 * Computes physical appearance attributes for agents including:
 * - Height band (with country-specific priors)
 * - Build tag
 * - Hair (color and texture)
 * - Eye color
 * - Voice tag (with career correlations)
 * - Distinguishing marks
 */

import type { Fixed, HeightBand, Latents, AgentVocabV1, AgentGenerationTraceV1 } from '../types';
import {
  type Rng,
  makeRng,
  facetSeed,
  clampInt,
  weightedPick,
  uniqueStrings,
  traceSet,
  traceFacet,
} from '../utils';

// ============================================================================
// Types
// ============================================================================

/** Country priors bucket for appearance (subset of full country priors) */
export type AppearanceCountryPriors = {
  appearance?: {
    heightBandWeights01k?: Partial<Record<HeightBand, Fixed>>;
  };
};

/** Input context for appearance computation */
export type AppearanceContext = {
  seed: string;
  vocab: AgentVocabV1;
  latents: Latents;
  countryPriors: AppearanceCountryPriors | null;
  trace?: AgentGenerationTraceV1;
  // Derived values from identity facet
  age: number;
  careerTrackTag: string;
  roleSeedTags: readonly string[];
  // Derived values from latents (normalized 0-1)
  public01: number;
  opsec01: number;
};

/** Output result from appearance computation */
export type AppearanceResult = {
  heightBand: HeightBand;
  buildTag: string;
  hair: { color: string; texture: string };
  eyes: { color: string };
  voiceTag: string;
  distinguishingMarks: string[];
};

// ============================================================================
// Voice Tag Configuration
// ============================================================================

const VOICE_BIASES = {
  military: ['commanding', 'clipped', 'precise', 'booming', 'authoritative', 'crisp'],
  journalism: ['warm', 'storyteller', 'bright', 'animated', 'engaging', 'articulate'],
  academia: ['teacherly', 'measured', 'dry-humored', 'thoughtful', 'deliberate', 'scholarly'],
  intelligence: ['soft-spoken', 'measured', 'deadpan', 'neutral', 'calm', 'unremarkable'],
  operative: ['calm', 'measured', 'murmured', 'low', 'controlled', 'quiet'],
  'foreign-service': ['smooth', 'diplomatic', 'polished', 'refined', 'measured', 'reassuring'],
} as const;

const PUBLIC_VOICES = ['warm', 'engaging', 'animated', 'bright', 'charismatic'];
const OPSEC_VOICES = ['soft-spoken', 'quiet', 'murmured', 'unremarkable', 'neutral'];

// ============================================================================
// Helper Functions
// ============================================================================

function selectHeightBand(rng: Rng, vocab: AgentVocabV1, priors: AppearanceCountryPriors | null): HeightBand {
  const pool = vocab.appearance.heightBands as readonly HeightBand[];
  const priorsWeights = priors?.appearance?.heightBandWeights01k;

  if (!priorsWeights) {
    return rng.pick(pool);
  }

  const weights = pool.map((b) => ({
    item: b,
    weight: Number(priorsWeights[b] ?? 0) || 0,
  }));

  return weightedPick(rng, weights) as HeightBand;
}

function selectHairColor(
  rng: Rng,
  hairColors: readonly string[],
  age: number,
  express01: number,
  public01: number,
): string {
  const grayish = (s: string) => {
    const k = s.toLowerCase();
    return k.includes('gray') || k.includes('silver') || k.includes('salt') || k.includes('white');
  };
  const dyed = (s: string) => s.toLowerCase().includes('dyed');

  const weights = hairColors.map((c) => {
    let w = 1;

    // Gray/silver hair more likely with age
    if (grayish(c)) {
      w += age >= 50 ? 0.8 + 2.0 * (age / 120) : -0.7;
      if (age <= 25) w *= 0.25;
    }

    // Dyed hair correlates with expressiveness and public visibility
    if (dyed(c)) {
      w += 0.25 + 0.9 * express01 + 0.35 * public01;
    }

    return { item: c, weight: Math.max(0.05, w) };
  });

  return weightedPick(rng, weights);
}

function selectVoiceTag(
  rng: Rng,
  voiceTags: readonly string[],
  careerTrackTag: string,
  roleSeedTags: readonly string[],
  public01: number,
  opsec01: number,
): string {
  const weights = voiceTags.map((v) => {
    const key = v.toLowerCase();
    let w = 1;

    // Career-based voice biases
    const careerVoices = VOICE_BIASES[careerTrackTag as keyof typeof VOICE_BIASES];
    if (careerVoices && careerVoices.some((cv) => key.includes(cv))) {
      w += careerTrackTag === 'intelligence' ? 1.6 : 1.4;
    }

    // Operative role has strongest voice bias
    if (roleSeedTags.includes('operative') && VOICE_BIASES.operative.some((ov) => key.includes(ov))) {
      w += 1.8;
    }

    // Public visibility -> more expressive voices
    if (public01 > 0.6 && PUBLIC_VOICES.some((pv) => key.includes(pv))) {
      w += 0.6 * public01;
    }

    // High OPSEC -> quieter, less distinctive voices
    if (opsec01 > 0.6 && OPSEC_VOICES.some((ov) => key.includes(ov))) {
      w += 0.5 * opsec01;
    }

    return { item: v, weight: Math.max(0.1, w) };
  });

  return weightedPick(rng, weights);
}

function selectDistinguishingMarks(
  rng: Rng,
  markPool: readonly string[],
  express01: number,
  public01: number,
  opsec01: number,
): string[] {
  // High OPSEC agents avoid distinguishing marks
  // Public figures may have more (they're noticed anyway)
  const baseMax = opsec01 > 0.7 ? 1 : public01 > 0.7 ? 3 : 2;
  const maxMarks = clampInt(baseMax + (express01 > 0.75 ? 1 : 0), 0, 3);

  const count = rng.int(0, maxMarks);
  return uniqueStrings(rng.pickK(markPool, count));
}

// ============================================================================
// Main Computation
// ============================================================================

/**
 * Compute appearance attributes for an agent.
 *
 * Uses country priors for height band when available.
 * Correlates hair color with age and expressiveness.
 * Correlates voice with career track and visibility.
 * Limits distinguishing marks for high-OPSEC agents.
 */
export function computeAppearance(ctx: AppearanceContext): AppearanceResult {
  const { seed, vocab, latents, countryPriors, trace, age, careerTrackTag, roleSeedTags, public01, opsec01 } = ctx;

  // Validate required vocab
  if (!vocab.appearance.heightBands.length) throw new Error('Agent vocab missing: appearance.heightBands');
  if (!vocab.appearance.buildTags.length) throw new Error('Agent vocab missing: appearance.buildTags');
  if (!vocab.appearance.hairColors.length || !vocab.appearance.hairTextures.length) {
    throw new Error('Agent vocab missing: appearance hair pools');
  }
  if (!vocab.appearance.eyeColors.length) throw new Error('Agent vocab missing: appearance.eyeColors');
  if (!vocab.appearance.voiceTags.length) throw new Error('Agent vocab missing: appearance.voiceTags');

  traceFacet(trace, seed, 'appearance');
  const rng = makeRng(facetSeed(seed, 'appearance'));

  const express01 = latents.aestheticExpressiveness / 1000;

  // Height band with country priors
  const heightBand = selectHeightBand(rng, vocab, countryPriors);

  // Build tag - uniform selection (avoids cultural stereotypes)
  const buildTag = rng.pick(vocab.appearance.buildTags);

  // Hair color with age and expressiveness correlations
  const hairColor = selectHairColor(rng, vocab.appearance.hairColors, age, express01, public01);
  const hair = {
    color: hairColor,
    texture: rng.pick(vocab.appearance.hairTextures),
  };

  // Eye color - uniform selection
  const eyes = { color: rng.pick(vocab.appearance.eyeColors) };

  // Voice tag with career and visibility correlations
  const voiceTag = selectVoiceTag(rng, vocab.appearance.voiceTags, careerTrackTag, roleSeedTags, public01, opsec01);

  // Distinguishing marks (limited for OPSEC)
  const distinguishingMarks = selectDistinguishingMarks(
    rng,
    vocab.appearance.distinguishingMarks,
    express01,
    public01,
    opsec01,
  );

  traceSet(
    trace,
    'appearance',
    { heightBand, buildTag, hair, eyes, voiceTag, distinguishingMarks },
    {
      method: 'pick+weights',
      dependsOn: { facet: 'appearance', age, express01, opsec01, public01 },
    },
  );

  return { heightBand, buildTag, hair, eyes, voiceTag, distinguishingMarks };
}
