/**
 * Narrative Facet - Agent timeline events and minority status
 *
 * Handles:
 * - Timeline events (upbringing, education, career milestones, crises, etc.)
 * - Minority status flags (local majority, visible/linguistic/religious minority)
 */

import type {
  TierBand,
  AgentVocabV1,
  AgentGenerationTraceV1,
  TimelineEventType,
  DiasporaStatus,
} from '../types';

import {
  makeRng,
  facetSeed,
  traceSet,
  traceFacet,
  Rng,
} from '../utils';

// ============================================================================
// Types
// ============================================================================

export type TimelineEvent = {
  yearOffset: number; // years from birth
  type: TimelineEventType;
  description: string;
  impact: 'positive' | 'negative' | 'neutral' | 'mixed';
};

export type MinorityStatus = {
  localMajority: boolean; // majority in their current location
  visibleMinority: boolean; // visually identifiable as different
  linguisticMinority: boolean; // primary language differs from locale
  religiousMinority: boolean; // faith differs from locale majority
};

export type NarrativeContext = {
  seed: string;
  vocab: AgentVocabV1;
  age: number;
  birthYear: number;
  homeCountryIso3: string;
  currentCountryIso3: string;
  tierBand: TierBand;
  originTierBand: TierBand;
  educationTrackTag: string;
  careerTrackTag: string;
  roleSeedTags: string[];
  homeCulture: string;
  languages: string[];
  spiritualityAffiliationTag: string;
  backgroundAdversityTags: string[];
  urbanicity: string;
  originRegion: string | null;
  diasporaStatus: DiasporaStatus;
  trace?: AgentGenerationTraceV1;
};

export type NarrativeResult = {
  timeline: TimelineEvent[];
  minorityStatus: MinorityStatus;
};

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_EVENT_TYPES: TimelineEventType[] = [
  'upbringing', 'education-milestone', 'first-job', 'first-posting', 'promotion', 'career-break',
  'scandal', 'injury', 'burnout', 'family-crisis', 'mentorship', 'betrayal', 'moral-injury',
  'success', 'failure', 'recruitment', 'defection-attempt', 'security-incident', 'romantic', 'loss',
];

const POSITIVE_EVENTS = new Set<TimelineEventType>([
  'success', 'promotion', 'mentorship', 'recruitment', 'romantic',
]);

const NEGATIVE_EVENTS = new Set<TimelineEventType>([
  'scandal', 'injury', 'burnout', 'betrayal', 'moral-injury', 'failure', 'loss', 'security-incident',
]);

const FOUNDATIONAL_EVENTS = new Set<TimelineEventType>([
  'upbringing', 'education-milestone', 'first-job', 'first-posting',
]);

// ============================================================================
// Helpers
// ============================================================================

function getEventDescriptions(): Record<string, string[]> {
  return {
    promotion: ['Advanced to senior role', 'Recognized for exceptional work', 'Given increased responsibilities'],
    success: ['Key operation succeeded', 'Major analysis proved correct', 'Negotiation breakthrough'],
    mentorship: ['Found a guiding figure', 'Taken under experienced wing', 'Critical guidance received'],
    scandal: ['Narrowly avoided exposure', 'Implicated in internal affair', 'Reputation challenged'],
    injury: ['Sustained field injury', 'Operational accident', 'Health crisis'],
    burnout: ['Hit the wall professionally', 'Needed extended leave', 'Rebuilt from exhaustion'],
    betrayal: ['Trusted colleague turned', 'Discovered deception', 'Asset compromised'],
    'moral-injury': ['Crossed a personal line', 'Witnessed something unforgivable', 'Questioned everything'],
    failure: ['Operation went wrong', 'Analysis proved faulty', 'Missed critical signals'],
    loss: ['Lost someone close', 'Witnessed tragedy', 'Personal devastation'],
    romantic: ['Significant relationship began', 'Found unexpected connection', 'Personal life shifted'],
    'career-break': ['Took time away', 'Reassessed priorities', 'Stepped back temporarily'],
    'family-crisis': ['Family needed attention', 'Personal obligations intervened', 'Home front demanded focus'],
    recruitment: ['Brought into sensitive program', 'Selected for special assignment', 'Noticed by key figures'],
    'security-incident': ['Security breach occurred', 'Cover nearly blown', 'Operational security compromised'],
    'defection-attempt': ['Approached by other side', 'Loyalty tested', 'Turned away overture'],
  };
}

function determineImpact(
  rng: Rng,
  eventType: TimelineEventType,
): 'positive' | 'negative' | 'neutral' | 'mixed' {
  if (POSITIVE_EVENTS.has(eventType)) return 'positive';
  if (NEGATIVE_EVENTS.has(eventType)) return 'negative';
  return rng.next01() < 0.3 ? 'mixed' : 'neutral';
}

function generateUpbringingEvent(
  ctx: NarrativeContext,
): TimelineEvent {
  const { urbanicity, originRegion, homeCountryIso3, backgroundAdversityTags } = ctx;
  return {
    yearOffset: 0,
    type: 'upbringing',
    description: `Grew up in ${urbanicity} ${originRegion ?? 'region'} of ${homeCountryIso3}`,
    impact: backgroundAdversityTags.length > 2 ? 'negative' : 'neutral',
  };
}

function generateEducationEvent(
  rng: Rng,
  ctx: NarrativeContext,
): TimelineEvent {
  const eduAge = rng.int(18, 25);
  return {
    yearOffset: eduAge,
    type: 'education-milestone',
    description: `Completed ${ctx.educationTrackTag} education`,
    impact: 'positive',
  };
}

function generateFirstJobEvent(
  rng: Rng,
  ctx: NarrativeContext,
): TimelineEvent {
  const firstJobAge = rng.int(22, 28);
  const isOperative = ctx.roleSeedTags.includes('operative');
  return {
    yearOffset: firstJobAge,
    type: isOperative ? 'first-posting' : 'first-job',
    description: `Entered ${ctx.careerTrackTag} career track`,
    impact: 'positive',
  };
}

function generateRandomEvent(
  rng: Rng,
  ctx: NarrativeContext,
  eventType: TimelineEventType,
): TimelineEvent {
  const descriptions = getEventDescriptions();
  const descOptions = descriptions[eventType] ?? ['Significant event occurred'];
  const description = descOptions[rng.int(0, descOptions.length - 1)]!;
  const yearOffset = rng.int(25, Math.max(26, ctx.age));
  const impact = determineImpact(rng, eventType);

  return { yearOffset, type: eventType, description, impact };
}

// ============================================================================
// Main Computation
// ============================================================================

export function computeNarrative(ctx: NarrativeContext): NarrativeResult {
  const {
    seed,
    vocab,
    homeCountryIso3,
    currentCountryIso3,
    spiritualityAffiliationTag,
    diasporaStatus,
    trace,
  } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // TIMELINE (Oracle recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'timeline');
  const timeRng = makeRng(facetSeed(seed, 'timeline'));
  const eventTypes = vocab.timeline?.eventTypes ?? DEFAULT_EVENT_TYPES;

  // Generate 6-10 life events
  const eventCount = timeRng.int(6, 10);
  const timeline: TimelineEvent[] = [];

  // Always include foundational events
  timeline.push(generateUpbringingEvent(ctx));
  timeline.push(generateEducationEvent(timeRng, ctx));
  timeline.push(generateFirstJobEvent(timeRng, ctx));

  // Fill remaining events randomly between age 25 and current age
  const remainingCount = eventCount - 3;
  const availableTypes = (eventTypes as TimelineEventType[]).filter(
    t => !FOUNDATIONAL_EVENTS.has(t),
  );
  const mutableAvailable = [...availableTypes];

  for (let i = 0; i < remainingCount && mutableAvailable.length > 0; i++) {
    const typeIdx = timeRng.int(0, mutableAvailable.length - 1);
    const eventType = mutableAvailable[typeIdx]!;
    mutableAvailable.splice(typeIdx, 1); // Remove to avoid duplicates

    timeline.push(generateRandomEvent(timeRng, ctx, eventType));
  }

  // Sort by year
  timeline.sort((a, b) => a.yearOffset - b.yearOffset);

  traceSet(trace, 'timeline', { eventCount: timeline.length }, { method: 'generated' });

  // ─────────────────────────────────────────────────────────────────────────────
  // MINORITY STATUS (Oracle recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'minorityStatus');
  const minRng = makeRng(facetSeed(seed, 'minorityStatus'));

  // Local majority - are they part of the majority in their current location?
  // Native with high probability = majority; diaspora = likely minority
  const localMajority = diasporaStatus === 'native' && minRng.next01() > 0.15;

  // Visible minority - based on home vs current country being different regions
  const visibleMinority = homeCountryIso3 !== currentCountryIso3 && minRng.next01() < 0.6;

  // Linguistic minority - primary language differs from locale
  const linguisticMinority = homeCountryIso3 !== currentCountryIso3 || minRng.next01() < 0.1;

  // Religious minority - faith differs from locale majority
  const religiousMinority = spiritualityAffiliationTag !== 'secular' && minRng.next01() < 0.25;

  const minorityStatus: MinorityStatus = {
    localMajority,
    visibleMinority,
    linguisticMinority,
    religiousMinority,
  };

  traceSet(trace, 'minorityStatus', minorityStatus, { method: 'derived' });

  return { timeline, minorityStatus };
}
