#!/usr/bin/env node
/**
 * Personality + Thoughts/Emotions Vocab Test Harness
 *
 * Verifies vocab expansions for personality, affect, and self-concept,
 * and checks stress-tell forcing behavior under high-stress latents.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { computePsychology } from '../src/agent/facets/psychology';
import { formatKnowledgeItemMeta } from '../src/agent/knowledgeFormat';
import { renderCognitiveCard, renderCognitiveSection } from '../src/agent/cognitiveSection';
import { renderCognitiveTabButton, renderCognitiveTabPanel } from '../src/agent/cognitiveTab';
import { isAgentProfileTab } from '../src/agent/profileTabs';
import { renderKnowledgeEntry, renderKnowledgeEntryList } from '../src/agent/knowledgeEntry';
import { formatCopingMeta, formatEmotionMeta, formatThoughtMeta, renderPsychologyEntry, renderPsychologyEntryList } from '../src/agent/psychologyEntry';
import { renderPsychologySection } from '../src/agent/psychologySection';
import { computeHousingWeights } from '../src/agent/facets/domestic';
import { buildPressureWeights } from '../src/agent/pressureResponse';
import { formatFunctionalSpec, formatThirdPlace, sanitizeComfortItems } from '../src/agentNarration';
import { generateAgent } from '../src/agent';
import type { AgentPriorsV1, AgentVocabV1, GenerateAgentInput, Latents } from '../src/agent/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJsonFile<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, '..', relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

function assertIncludes(pool: string[] | undefined, value: string, label: string): void {
  if (!pool || !pool.includes(value)) {
    throw new Error(`Expected ${label} to include "${value}".`);
  }
}

function run(): void {
  console.log('Loading vocab...');
  const vocab = loadJsonFile<AgentVocabV1>('public/agent-vocab.v1.json');

  console.log('Checking personality vocab...');
  assertIncludes(vocab.personality?.conflictStyles, 'assertive', 'personality.conflictStyles');
  assertIncludes(vocab.personality?.epistemicStyles, 'systems-thinking', 'personality.epistemicStyles');
  assertIncludes(vocab.personality?.socialEnergyTags, 'social-butterfly', 'personality.socialEnergyTags');
  assertIncludes(vocab.personality?.riskPostures, 'reckless', 'personality.riskPostures');
  assertIncludes(vocab.personality?.emotionalRegulation, 'even-tempered', 'personality.emotionalRegulation');
  assertIncludes(vocab.personality?.communicationStyles, 'diplomatic', 'personality.communicationStyles');
  assertIncludes(vocab.personality?.trustFormation, 'guarded', 'personality.trustFormation');
  assertIncludes(vocab.personality?.humorStyles, 'jovial', 'personality.humorStyles');
  assertIncludes(vocab.personality?.facetNames, 'Bravery', 'personality.facetNames');
  assertIncludes(vocab.personality?.traitNames, 'Ambitious', 'personality.traitNames');
  const facetCategoryOrder = Object.keys(vocab.personality?.facetCategories ?? {});
  const expectedFacetCategoryOrder = [
    'Emotional Regulation',
    'Social & Interpersonal',
    'Moral & Ethical',
    'Intellectual & Analytical',
    'Courage & Bravery',
    'Work Ethic & Professionalism',
    'Physical & Sensory',
    'Cultural & Identity',
    'Leadership & Authority',
  ];
  if (facetCategoryOrder.join('|') !== expectedFacetCategoryOrder.join('|')) {
    throw new Error(`Expected facetCategories order to be ${expectedFacetCategoryOrder.join(', ')}.`);
  }
  const quirkNames = vocab.personality?.quirkCombinations?.map(c => c.name) ?? [];
  if (!quirkNames.includes('The Compassionate Predator')) {
    throw new Error('Expected personality.quirkCombinations to include \"The Compassionate Predator\".');
  }

  console.log('Checking cultural dynamics vocab...');
  const culturalDynamics = (vocab as any).culturalDynamics as
    | {
      communicationNorms?: string[];
      powerDynamics?: string[];
      bondingMechanisms?: string[];
      clashPoints?: string[];
    }
    | undefined;
  assertIncludes(
    culturalDynamics?.communicationNorms,
    'Direct vs indirect communication',
    'culturalDynamics.communicationNorms',
  );
  assertIncludes(
    culturalDynamics?.powerDynamics,
    'Competence earns authority',
    'culturalDynamics.powerDynamics',
  );
  assertIncludes(
    culturalDynamics?.bondingMechanisms,
    'Shared danger bonds fast',
    'culturalDynamics.bondingMechanisms',
  );
  assertIncludes(
    culturalDynamics?.clashPoints,
    'Time expectations conflict',
    'culturalDynamics.clashPoints',
  );

  console.log('Checking needs/relationships vocab...');
  const needsRelationships = (vocab as any).needsRelationships as
    | {
      needsArchetypes?: string[];
      relationshipArchetypes?: string[];
    }
    | undefined;
  assertIncludes(
    needsRelationships?.needsArchetypes,
    'safety-vigilant',
    'needsRelationships.needsArchetypes',
  );
  assertIncludes(
    needsRelationships?.relationshipArchetypes,
    'family-duty-bound',
    'needsRelationships.relationshipArchetypes',
  );

  console.log('Checking conversation topics vocab...');
  assertIncludes(vocab.civicLife?.conversationTopics, 'Remember when the extraction went sideways in Prague?', 'civicLife.conversationTopics');
  assertIncludes(vocab.civicLife?.conversationTopics, 'Try reversing the polarity on the jammer', 'civicLife.conversationTopics');

  console.log('Checking knowledge/ignorance vocab...');
  const knowledgeIgnorance = (vocab as any).knowledgeIgnorance as
    | {
      knowledgeStrengths?: string[];
      knowledgeGaps?: string[];
      falseBeliefs?: string[];
      informationSources?: string[];
      informationBarriers?: string[];
    }
    | undefined;
  assertIncludes(
    knowledgeIgnorance?.knowledgeStrengths,
    'Tradecraft: Surveillance, counter-surveillance, dead drops',
    'knowledgeIgnorance.knowledgeStrengths',
  );
  assertIncludes(
    knowledgeIgnorance?.knowledgeGaps,
    "I don't speak Arabic",
    'knowledgeIgnorance.knowledgeGaps',
  );
  assertIncludes(
    knowledgeIgnorance?.falseBeliefs,
    'Outdated procedures still followed',
    'knowledgeIgnorance.falseBeliefs',
  );
  assertIncludes(
    knowledgeIgnorance?.informationSources,
    'Official briefings: Sanitized versions',
    'knowledgeIgnorance.informationSources',
  );
  assertIncludes(
    knowledgeIgnorance?.informationBarriers,
    'Need-to-know: More unknown than known',
    'knowledgeIgnorance.informationBarriers',
  );

  console.log('Checking dreams/goals vocab...');
  const dreamsGoals = (vocab as any).dreamsGoals as { dreams?: string[] } | undefined;
  assertIncludes(
    dreamsGoals?.dreams,
    "Become the world's greatest sniper",
    'dreamsGoals.dreams',
  );

  console.log('Checking dreams/nightmares vocab...');
  const dreamsNightmares = (vocab as any).dreamsNightmares as { dreams?: string[]; nightmares?: string[] } | undefined;
  assertIncludes(
    dreamsNightmares?.dreams,
    'Peaceful beaches with no missions',
    'dreamsNightmares.dreams',
  );
  assertIncludes(
    dreamsNightmares?.nightmares,
    'Reliving firefights with muzzle flashes in slow motion',
    'dreamsNightmares.nightmares',
  );

  console.log('Checking economic mobility vocab...');
  const economicMobility = (vocab as any).economicMobility as
    | {
      originStories?: string[];
      mobilityPatterns?: string[];
      moneyDrivers?: string[];
      classNavigation?: string[];
      retirementModes?: string[];
      moneyPersonalityTypes?: string[];
    }
    | undefined;
  assertIncludes(
    economicMobility?.originStories,
    'The Slum Survivor',
    'economicMobility.originStories',
  );
  assertIncludes(
    economicMobility?.mobilityPatterns,
    'The Steady Climber',
    'economicMobility.mobilityPatterns',
  );
  assertIncludes(
    economicMobility?.moneyDrivers,
    'The Security Seeker',
    'economicMobility.moneyDrivers',
  );
  assertIncludes(
    economicMobility?.moneyPersonalityTypes,
    'The Hoarder',
    'economicMobility.moneyPersonalityTypes',
  );

  console.log('Checking affect/self-concept vocab...');
  assertIncludes(vocab.affect?.baselineAffects, 'numb', 'affect.baselineAffects');
  assertIncludes(vocab.affect?.regulationStyles, 'meditates', 'affect.regulationStyles');
  assertIncludes(vocab.affect?.stressTells, 'jaw-clench', 'affect.stressTells');
  assertIncludes(vocab.affect?.repairStyles, 'gives-space', 'affect.repairStyles');
  assertIncludes(vocab.selfConcept?.selfStories, 'avenger', 'selfConcept.selfStories');
  assertIncludes(vocab.selfConcept?.socialMasks, 'professional', 'selfConcept.socialMasks');

  console.log('Checking thoughts/emotions vocab...');
  const thoughtsEmotions = (vocab as any).thoughtsEmotions as
    | {
      thoughts?: {
        immediateObservations?: string[];
        reflections?: string[];
        memories?: string[];
        worries?: string[];
        desires?: string[];
        socialThoughts?: string[];
      };
      emotions?: { primary?: string[]; complex?: string[] };
      coping?: { healthy?: string[]; unhealthy?: string[] };
    }
    | undefined;
  assertIncludes(
    thoughtsEmotions?.thoughts?.immediateObservations,
    'This safe house is cramped',
    'thoughtsEmotions.thoughts.immediateObservations',
  );
  assertIncludes(
    thoughtsEmotions?.thoughts?.reflections,
    "That civilian didn't have to die",
    'thoughtsEmotions.thoughts.reflections',
  );
  assertIncludes(
    thoughtsEmotions?.thoughts?.memories,
    'Just like Belgrade all over again',
    'thoughtsEmotions.thoughts.memories',
  );
  assertIncludes(
    thoughtsEmotions?.thoughts?.worries,
    'This cough is getting worse',
    'thoughtsEmotions.thoughts.worries',
  );
  assertIncludes(
    thoughtsEmotions?.thoughts?.desires,
    'A beach somewhere, no missions',
    'thoughtsEmotions.thoughts.desires',
  );
  assertIncludes(
    thoughtsEmotions?.thoughts?.socialThoughts,
    "Rodriguez always has my back",
    'thoughtsEmotions.thoughts.socialThoughts',
  );
  assertIncludes(
    thoughtsEmotions?.emotions?.primary,
    'Joy',
    'thoughtsEmotions.emotions.primary',
  );
  assertIncludes(
    thoughtsEmotions?.emotions?.complex,
    'Despair',
    'thoughtsEmotions.emotions.complex',
  );
  assertIncludes(
    thoughtsEmotions?.coping?.healthy,
    'Physical exercise',
    'thoughtsEmotions.coping.healthy',
  );
  assertIncludes(
    thoughtsEmotions?.coping?.unhealthy,
    'Substance use',
    'thoughtsEmotions.coping.unhealthy',
  );

  console.log('Checking dependency vocab...');
  assertIncludes(vocab.vices?.dependencyStages, 'early-stage', 'vices.dependencyStages');
  assertIncludes(vocab.vices?.dependencyPatterns, 'stress-induced', 'vices.dependencyPatterns');
  assertIncludes(vocab.vices?.withdrawalTells, 'headaches', 'vices.withdrawalTells');
  assertIncludes(vocab.vices?.rituals, 'morning-coffee', 'vices.rituals');
  assertIncludes(vocab.vices?.riskFlags, 'op-risk', 'vices.riskFlags');
  assertIncludes(vocab.vices?.recoveryArcs, 'relapse-risk', 'vices.recoveryArcs');

  console.log('Checking stress-tell forcing...');
  const latents: Latents = {
    cosmopolitanism: 500,
    publicness: 500,
    opsecDiscipline: 900,
    institutionalEmbeddedness: 500,
    riskAppetite: 500,
    stressReactivity: 900,
    impulseControl: 200,
    techFluency: 500,
    socialBattery: 500,
    aestheticExpressiveness: 500,
    frugality: 500,
    curiosityBandwidth: 500,
    adaptability: 500,
    planningHorizon: 500,
    principledness: 500,
    physicalConditioning: 500,
  };

  const psych = computePsychology({
    seed: 'stress-tells-001',
    vocab: {
      ...vocab,
      affect: {
        ...vocab.affect,
        stressTells: ['insomnia', 'goes-quiet', 'snaps'],
        baselineAffects: vocab.affect?.baselineAffects ?? ['warm'],
        regulationStyles: vocab.affect?.regulationStyles ?? ['suppresses'],
        repairStyles: vocab.affect?.repairStyles ?? ['apologizes-fast'],
      },
    },
    latents,
    aptitudes: {
      strength: 500,
      endurance: 500,
      agility: 500,
      reflexes: 500,
      handEyeCoordination: 500,
      cognitiveSpeed: 500,
      attentionControl: 700,
      workingMemory: 500,
      riskCalibration: 500,
      charisma: 500,
      empathy: 500,
      assertiveness: 500,
      deceptionAptitude: 500,
    },
    traits: {
      riskTolerance: 500,
      conscientiousness: 500,
      noveltySeeking: 500,
      agreeableness: 500,
      authoritarianism: 500,
    },
    tierBand: 'middle',
    roleSeedTags: ['analyst'],
    careerTrackTag: 'civil-service',
    heightBand: 'average',
  });

  const tells = psych.affect.stressTells;
  for (const required of ['insomnia', 'goes-quiet', 'snaps']) {
    if (!tells.includes(required as typeof tells[number])) {
      throw new Error(`Expected stressTells to include ${required}.`);
    }
  }

  console.log('Checking personality facets/traits generation...');
  const priors = loadJsonFile<AgentPriorsV1>('public/agent-priors.v1.json');
  const countries = loadJsonFile<GenerateAgentInput['countries']>('public/shadow-country-map.json');
  const agent = generateAgent({
    seed: 'personality-catalog-001',
    vocab,
    priors,
    countries,
    asOfYear: 2025,
  });
  if (!agent.personality.facets.length) {
    throw new Error('Expected personality.facets to be generated.');
  }
  if (agent.personality.traitTriad.length < 2) {
    throw new Error('Expected personality.traitTriad to include at least two traits.');
  }
  const agentNeedsRelationships = (agent as any).needsRelationships as
    | {
      needs: { primary: string; secondary?: string };
      relationships: { primary: string; secondary?: string };
    }
    | undefined;
  if (!agentNeedsRelationships?.needs?.primary) {
    throw new Error('Expected needsRelationships.needs.primary to be generated.');
  }
  if (!agentNeedsRelationships?.relationships?.primary) {
    throw new Error('Expected needsRelationships.relationships.primary to be generated.');
  }

  const agentKnowledge = (agent as any).knowledgeIgnorance as
    | {
      knowledgeStrengths?: string[];
      knowledgeGaps?: string[];
      falseBeliefs?: string[];
      informationSources?: string[];
      informationBarriers?: string[];
    }
    | undefined;
  if (!agentKnowledge) {
    throw new Error('Expected knowledgeIgnorance to be generated.');
  }
  for (const [label, list] of [
    ['knowledgeStrengths', agentKnowledge.knowledgeStrengths],
    ['knowledgeGaps', agentKnowledge.knowledgeGaps],
    ['falseBeliefs', agentKnowledge.falseBeliefs],
    ['informationSources', agentKnowledge.informationSources],
    ['informationBarriers', agentKnowledge.informationBarriers],
  ] as const) {
    if (!list || list.length < 2 || list.length > 4) {
      throw new Error(`Expected ${label} to include 2-4 items.`);
    }
  }

  const depth = (agentKnowledge as any).depths01k as
    | { strengths?: number; gaps?: number; falseBeliefs?: number; sources?: number; barriers?: number }
    | undefined;
  if (!depth) {
    throw new Error('Expected knowledgeIgnorance.depths01k to be generated.');
  }
  for (const [label, value] of Object.entries(depth)) {
    if (typeof value !== 'number' || value < 0 || value > 1000) {
      throw new Error(`Expected depth ${label} to be in range 0-1000.`);
    }
  }

  const formattedKnowledge = formatKnowledgeItemMeta({
    item: 'Test item',
    accuracy: 'partial',
    confidence01k: 720,
    lastUsedDays: 42,
    decayRate01k: 310,
  });
  if (!formattedKnowledge.includes('partial')) {
    throw new Error('Expected formatted knowledge item to include accuracy tag.');
  }
  if (!formattedKnowledge.includes('72%')) {
    throw new Error('Expected formatted knowledge item to include confidence percentage.');
  }
  if (!formattedKnowledge.includes('31%')) {
    throw new Error('Expected formatted knowledge item to include decay percentage.');
  }
  if (!formattedKnowledge.includes('42d')) {
    throw new Error('Expected formatted knowledge item to include last used days.');
  }
  const knowledgeEntry = renderKnowledgeEntry({
    item: 'Test item',
    accuracy: 'partial',
    confidence01k: 720,
    lastUsedDays: 42,
    decayRate01k: 310,
  });
  if (!knowledgeEntry.includes('knowledge-entry-meta')) {
    throw new Error('Expected knowledge entry to include meta line.');
  }
  const knowledgeEntryEscaped = renderKnowledgeEntry({
    item: '<script>alert(1)</script>',
    accuracy: 'correct',
    confidence01k: 500,
    lastUsedDays: 10,
    decayRate01k: 100,
  });
  if (knowledgeEntryEscaped.includes('<script>')) {
    throw new Error('Expected knowledge entry to escape item content.');
  }
  if (!knowledgeEntryEscaped.includes('&lt;script&gt;alert(1)&lt;/script&gt;')) {
    throw new Error('Expected knowledge entry to include escaped item content.');
  }
  const knowledgeEntryListFallback = renderKnowledgeEntryList(undefined, ['<b>Injected</b>']);
  if (knowledgeEntryListFallback.includes('<b>Injected</b>')) {
    throw new Error('Expected knowledge entry fallback to escape item content.');
  }
  const knowledgeEntryListLeft = renderKnowledgeEntryList(
    [{
      item: 'Left aligned item',
      accuracy: 'correct',
      confidence01k: 640,
      lastUsedDays: 12,
      decayRate01k: 220,
    }],
    [],
    'left',
  );
  if (!knowledgeEntryListLeft.includes('knowledge-entry-list-left')) {
    throw new Error('Expected knowledge entry list to include left alignment class.');
  }
  if (!knowledgeEntryListLeft.includes('knowledge-entry-left')) {
    throw new Error('Expected knowledge entry items to include left alignment class.');
  }

  const thoughtMeta = formatThoughtMeta({
    item: 'Test thought',
    valence: 'negative',
    intensity01k: 620,
    recencyDays: 12,
  });
  if (!thoughtMeta.includes('negative')) {
    throw new Error('Expected thought meta to include valence.');
  }
  if (!thoughtMeta.includes('62%')) {
    throw new Error('Expected thought meta to include intensity percentage.');
  }
  if (!thoughtMeta.includes('12d')) {
    throw new Error('Expected thought meta to include recency days.');
  }

  const emotionMeta = formatEmotionMeta({
    item: 'Test emotion',
    intensity01k: 580,
    durationHours: 6,
    moodImpact01k: -180,
    behaviorTilt: 'withdrawn',
  });
  if (!emotionMeta.includes('58%')) {
    throw new Error('Expected emotion meta to include intensity percentage.');
  }
  if (!emotionMeta.includes('6h')) {
    throw new Error('Expected emotion meta to include duration.');
  }
  if (!emotionMeta.includes('withdrawn')) {
    throw new Error('Expected emotion meta to include behavior tilt.');
  }

  const copingMeta = formatCopingMeta({
    item: 'Test coping',
    effectiveness01k: 740,
    recencyDays: 21,
  });
  if (!copingMeta.includes('74%')) {
    throw new Error('Expected coping meta to include effectiveness percentage.');
  }
  if (!copingMeta.includes('21d')) {
    throw new Error('Expected coping meta to include recency days.');
  }

  const psychologyEntry = renderPsychologyEntry({ item: '<script>alert(1)</script>', meta: 'meta' });
  if (psychologyEntry.includes('<script>')) {
    throw new Error('Expected psychology entry to escape item content.');
  }
  if (!psychologyEntry.includes('psychology-entry-meta')) {
    throw new Error('Expected psychology entry to include meta line.');
  }
  const psychologyListLeft = renderPsychologyEntryList([{ item: 'Left entry', meta: 'meta' }], 'left');
  if (!psychologyListLeft.includes('psychology-entry-list-left')) {
    throw new Error('Expected psychology entry list to include left alignment class.');
  }
  if (!psychologyListLeft.includes('psychology-entry-left')) {
    throw new Error('Expected psychology entry list to include left entry alignment class.');
  }

  const psychologySection = renderPsychologySection('<div class="kv-row"></div>', false);
  if (!psychologySection.includes('psychology-grid-wrap')) {
    throw new Error('Expected psychology section to include wrapper class.');
  }
  if (!psychologySection.includes('data-psychology-details-toggle')) {
    throw new Error('Expected psychology section to include a details toggle.');
  }
  const psychologySectionOpen = renderPsychologySection('<div class="kv-row"></div>', true);
  if (!psychologySectionOpen.includes('psychology-details-on')) {
    throw new Error('Expected psychology section to show details class when enabled.');
  }

  const cognitiveSection = renderCognitiveSection('<div class="kv-row"></div>', false);
  if (!cognitiveSection.includes('cognitive-grid-wrap')) {
    throw new Error('Expected cognitive section to include wrapper class.');
  }
  if (!cognitiveSection.includes('agent-card-span12')) {
    throw new Error('Expected cognitive grid wrapper to span full width.');
  }
  if (!cognitiveSection.includes('cognitive-grid-header-left')) {
    throw new Error('Expected cognitive section to include left-aligned header class.');
  }
  if (cognitiveSection.includes('<h3>Cognitive</h3>')) {
    throw new Error('Expected cognitive section not to include a heading.');
  }
  if (!cognitiveSection.includes('data-cognitive-details-toggle')) {
    throw new Error('Expected cognitive section to include a details toggle.');
  }
  if (!cognitiveSection.includes('Show details')) {
    throw new Error('Expected cognitive section to show details label when collapsed.');
  }
  const cognitiveSectionOpen = renderCognitiveSection('<div class="kv-row"></div>', true);
  if (!cognitiveSectionOpen.includes('cognitive-details-on')) {
    throw new Error('Expected cognitive section to show details class when enabled.');
  }
  if (!cognitiveSectionOpen.includes('Hide details')) {
    throw new Error('Expected cognitive section to show hide label when expanded.');
  }
  const cognitiveCard = renderCognitiveCard('Strengths', 820, '<div class="agent-inline-muted">—</div>');
  if (!cognitiveCard.includes('agent-card')) {
    throw new Error('Expected cognitive card to render with agent-card class.');
  }
  if (!cognitiveCard.includes('Strengths')) {
    throw new Error('Expected cognitive card to include the title.');
  }
  if (!cognitiveCard.includes('(82%)')) {
    throw new Error('Expected cognitive card to include the depth percentage.');
  }
  const cognitiveTabButton = renderCognitiveTabButton(true);
  if (!cognitiveTabButton.includes('data-agent-tab="cognitive"')) {
    throw new Error('Expected cognitive tab button to target cognitive tab.');
  }
  if (!cognitiveTabButton.includes('active')) {
    throw new Error('Expected cognitive tab button to render as active.');
  }
  const cognitiveTabPanel = renderCognitiveTabPanel(true, '<section></section>');
  if (!cognitiveTabPanel.includes('data-agent-tab-panel="cognitive"')) {
    throw new Error('Expected cognitive tab panel to target cognitive panel.');
  }
  if (!cognitiveTabPanel.includes('active')) {
    throw new Error('Expected cognitive tab panel to render as active.');
  }
  if (!isAgentProfileTab('portrait')) {
    throw new Error('Expected portrait to be a valid agent profile tab.');
  }
  if (!isAgentProfileTab('character')) {
    throw new Error('Expected character to be a valid agent profile tab.');
  }
  if (!isAgentProfileTab('psychology')) {
    throw new Error('Expected psychology to be a valid agent profile tab.');
  }
  if (!isAgentProfileTab('connections')) {
    throw new Error('Expected connections to be a valid agent profile tab.');
  }
  if (!isAgentProfileTab('capabilities')) {
    throw new Error('Expected capabilities to be a valid agent profile tab.');
  }
  if (!isAgentProfileTab('daily-life')) {
    throw new Error('Expected daily-life to be a valid agent profile tab.');
  }
  if (!isAgentProfileTab('data')) {
    throw new Error('Expected data to be a valid agent profile tab.');
  }
  if (isAgentProfileTab('not-a-tab')) {
    throw new Error('Expected unknown tab to be invalid.');
  }
  if (isAgentProfileTab('constraints')) {
    throw new Error('Expected constraints tab to be removed.');
  }

  const knowledgeItems = (agentKnowledge as any).items as
    | {
        strengths?: Array<{ item?: string; accuracy?: string; confidence01k?: number; lastUsedDays?: number; decayRate01k?: number }>;
        gaps?: Array<{ item?: string; accuracy?: string; confidence01k?: number; lastUsedDays?: number; decayRate01k?: number }>;
        falseBeliefs?: Array<{ item?: string; accuracy?: string; confidence01k?: number; lastUsedDays?: number; decayRate01k?: number }>;
        sources?: Array<{ item?: string; accuracy?: string; confidence01k?: number; lastUsedDays?: number; decayRate01k?: number }>;
        barriers?: Array<{ item?: string; accuracy?: string; confidence01k?: number; lastUsedDays?: number; decayRate01k?: number }>;
      }
    | undefined;
  if (!knowledgeItems) {
    throw new Error('Expected knowledgeIgnorance.items to be generated.');
  }
  const accuracyTags = new Set(['correct', 'partial', 'wrong', 'unknown']);
  for (const [label, list] of Object.entries(knowledgeItems)) {
    if (!Array.isArray(list) || list.length < 1) {
      throw new Error(`Expected knowledgeIgnorance.items.${label} to be non-empty.`);
    }
    for (const entry of list) {
      if (!entry.item || typeof entry.item !== 'string') {
        throw new Error(`Expected knowledgeIgnorance.items.${label} item to be a string.`);
      }
      if (!entry.accuracy || !accuracyTags.has(entry.accuracy)) {
        throw new Error(`Expected knowledgeIgnorance.items.${label} accuracy to be a valid tag.`);
      }
      if (typeof entry.confidence01k !== 'number' || entry.confidence01k < 0 || entry.confidence01k > 1000) {
        throw new Error(`Expected knowledgeIgnorance.items.${label} confidence01k in range 0-1000.`);
      }
      if (typeof entry.decayRate01k !== 'number' || entry.decayRate01k < 0 || entry.decayRate01k > 1000) {
        throw new Error(`Expected knowledgeIgnorance.items.${label} decayRate01k in range 0-1000.`);
      }
      if (typeof entry.lastUsedDays !== 'number' || entry.lastUsedDays < 0 || entry.lastUsedDays > 365) {
        throw new Error(`Expected knowledgeIgnorance.items.${label} lastUsedDays in range 0-365.`);
      }
    }
  }

  const dreams = (agent as any).motivations?.dreams as string[] | undefined;
  if (!dreams || dreams.length < 1 || dreams.length > 3) {
    throw new Error('Expected motivations.dreams to include 1-3 items.');
  }

  const thoughtsBlock = (agent as any).thoughtsEmotions as
    | {
      thoughts?: Record<string, Array<{ item?: string; valence?: string; intensity01k?: number; recencyDays?: number }>>;
      emotions?: Record<string, Array<{ item?: string; valence?: string; intensity01k?: number; durationHours?: number; moodImpact01k?: number; behaviorTilt?: string }>>;
      coping?: Record<string, Array<{ item?: string; effectiveness01k?: number; recencyDays?: number }>>;
    }
    | undefined;
  if (!thoughtsBlock) {
    throw new Error('Expected thoughtsEmotions to be generated.');
  }
  if (!thoughtsBlock.thoughts || !thoughtsBlock.emotions || !thoughtsBlock.coping) {
    throw new Error('Expected thoughtsEmotions to include thoughts, emotions, and coping blocks.');
  }
  for (const [label, list] of Object.entries(thoughtsBlock.thoughts)) {
    if (!Array.isArray(list) || list.length < 1 || list.length > 4) {
      throw new Error(`Expected thoughtsEmotions.thoughts.${label} to include 1-4 items.`);
    }
    for (const entry of list) {
      if (!entry.item) throw new Error(`Expected thoughtsEmotions.thoughts.${label} item to be a string.`);
      if (!entry.valence) throw new Error(`Expected thoughtsEmotions.thoughts.${label} to include valence.`);
      if (typeof entry.intensity01k !== 'number') {
        throw new Error(`Expected thoughtsEmotions.thoughts.${label} to include intensity01k.`);
      }
      if (typeof entry.recencyDays !== 'number') {
        throw new Error(`Expected thoughtsEmotions.thoughts.${label} to include recencyDays.`);
      }
    }
  }
  for (const [label, list] of Object.entries(thoughtsBlock.emotions)) {
    if (!Array.isArray(list) || list.length < 1 || list.length > 4) {
      throw new Error(`Expected thoughtsEmotions.emotions.${label} to include 1-4 items.`);
    }
    for (const entry of list) {
      if (!entry.item) throw new Error(`Expected thoughtsEmotions.emotions.${label} item to be a string.`);
      if (typeof entry.intensity01k !== 'number') {
        throw new Error(`Expected thoughtsEmotions.emotions.${label} to include intensity01k.`);
      }
      if (typeof entry.durationHours !== 'number') {
        throw new Error(`Expected thoughtsEmotions.emotions.${label} to include durationHours.`);
      }
      if (typeof entry.moodImpact01k !== 'number') {
        throw new Error(`Expected thoughtsEmotions.emotions.${label} to include moodImpact01k.`);
      }
      if (!entry.behaviorTilt) {
        throw new Error(`Expected thoughtsEmotions.emotions.${label} to include behaviorTilt.`);
      }
    }
  }
  for (const [label, list] of Object.entries(thoughtsBlock.coping)) {
    if (!Array.isArray(list) || list.length < 1 || list.length > 4) {
      throw new Error(`Expected thoughtsEmotions.coping.${label} to include 1-4 items.`);
    }
    for (const entry of list) {
      if (!entry.item) throw new Error(`Expected thoughtsEmotions.coping.${label} item to be a string.`);
      if (typeof entry.effectiveness01k !== 'number') {
        throw new Error(`Expected thoughtsEmotions.coping.${label} to include effectiveness01k.`);
      }
      if (typeof entry.recencyDays !== 'number') {
        throw new Error(`Expected thoughtsEmotions.coping.${label} to include recencyDays.`);
      }
    }
  }

  const dependencyProfiles = (agent as any).dependencyProfiles as
    | Array<{ substance?: string; stage?: string; pattern?: string; ritual?: string; withdrawal?: string; riskFlag?: string; recovery?: string }>
    | undefined;
  if (!dependencyProfiles || !Array.isArray(dependencyProfiles)) {
    throw new Error('Expected dependencyProfiles to be generated.');
  }
  if (agent.vices.length > 0 && dependencyProfiles.length < 1) {
    throw new Error('Expected dependencyProfiles when vices are present.');
  }
  for (const profile of dependencyProfiles) {
    if (!profile.substance || !profile.stage || !profile.pattern) {
      throw new Error('Expected dependencyProfiles entries to include substance, stage, and pattern.');
    }
    if (!profile.ritual || !profile.withdrawal || !profile.riskFlag || !profile.recovery) {
      throw new Error('Expected dependencyProfiles entries to include ritual, withdrawal, riskFlag, and recovery.');
    }
  }

  const culturalDynamicsAgent = (agent as any).culturalDynamics as
    | { communicationNorms?: string[]; powerDynamics?: string[]; bondingMechanisms?: string[]; clashPoints?: string[] }
    | undefined;
  if (!culturalDynamicsAgent) {
    throw new Error('Expected culturalDynamics to be generated.');
  }
  for (const [label, list] of Object.entries(culturalDynamicsAgent)) {
    if (!Array.isArray(list) || list.length < 1 || list.length > 4) {
      throw new Error(`Expected culturalDynamics.${label} to include 1-4 items.`);
    }
  }

  const dreamImagery = (agent as any).dreamsNightmares as
    | { dreams?: string[]; nightmares?: string[] }
    | undefined;
  if (!dreamImagery) {
    throw new Error('Expected dreamsNightmares to be generated.');
  }
  if (!dreamImagery.dreams || dreamImagery.dreams.length < 1 || dreamImagery.dreams.length > 3) {
    throw new Error('Expected dreamsNightmares.dreams to include 1-3 items.');
  }
  if (!dreamImagery.nightmares || dreamImagery.nightmares.length < 1 || dreamImagery.nightmares.length > 3) {
    throw new Error('Expected dreamsNightmares.nightmares to include 1-3 items.');
  }

  const econMobility = (agent as any).economicMobility as
    | {
      originStory?: string;
      mobilityPattern?: string;
      moneyDriver?: string;
      classNavigation?: string;
      retirementMode?: string;
      moneyPersonality?: string;
    }
    | undefined;
  if (!econMobility) {
    throw new Error('Expected economicMobility to be generated.');
  }
  for (const [label, value] of Object.entries(econMobility)) {
    if (!value || typeof value !== 'string') {
      throw new Error(`Expected economicMobility.${label} to be a non-empty string.`);
    }
  }

  console.log('Checking narrative helper consistency...');
  const thirdPlace = formatThirdPlace('pub');
  if (thirdPlace !== 'the pub') {
    throw new Error(`Expected formatThirdPlace("pub") to return "the pub", got "${thirdPlace}".`);
  }
  const functionalSpec = formatFunctionalSpec('humint-ops', 'political-appointee', 'government');
  if (!functionalSpec.includes('in HUMINT ops')) {
    throw new Error(`Expected political appointee HUMINT ops to read "in HUMINT ops", got "${functionalSpec}".`);
  }
  const comfortSanitized = sanitizeComfortItems(['vegetarian meals', 'slow-cooked meats'], []);
  if (comfortSanitized.some(item => /vegetarian/i.test(item)) && comfortSanitized.some(item => /meats?/i.test(item))) {
    throw new Error('Expected sanitizeComfortItems to drop conflicting vegetarian + meat combo.');
  }
  const comfortRestricted = sanitizeComfortItems(['vegetarian meals', 'slow-cooked meats'], ['vegetarian']);
  if (comfortRestricted.some(item => /meats?/i.test(item))) {
    throw new Error('Expected sanitizeComfortItems to drop meat items for vegetarian restriction.');
  }

  console.log('Checking housing + pressure hard constraints...');
  const housingWeightsLowRisk = computeHousingWeights({
    housingPool: ['owned', 'stable-rental', 'tenuous', 'transient', 'couch-surfing', 'institutional'],
    tierBand: 'middle',
    age: 30,
    roleSeedTags: [],
    gdp01: 0.5,
    conscientiousness01: 0.5,
    riskAppetite01: 0.1,
    hasFamily: false,
    isSeniorProfessional: false,
  });
  const housingMap = new Map(housingWeightsLowRisk.map(h => [h.item, h.weight]));
  for (const key of ['tenuous', 'transient', 'couch-surfing'] as const) {
    if ((housingMap.get(key) ?? 0) !== 0) {
      throw new Error(`Expected low-risk housing weight for ${key} to be 0.`);
    }
  }

  const lowRiskLatents = { ...latents, riskAppetite: 100, stressReactivity: 500, impulseControl: 500 };
  const highRiskLatents = { ...latents, riskAppetite: 900, stressReactivity: 500, impulseControl: 500 };
  const lowRiskPressure = buildPressureWeights({
    roleSeedTags: [],
    gradeBand: 'mid-level',
    conflictStyle: 'compromising',
    latents: lowRiskLatents,
  });
  const highRiskPressure = buildPressureWeights({
    roleSeedTags: [],
    gradeBand: 'mid-level',
    conflictStyle: 'compromising',
    latents: highRiskLatents,
  });
  const lowRiskMap = new Map(lowRiskPressure.map(p => [p.item, p.weight]));
  const highRiskMap = new Map(highRiskPressure.map(p => [p.item, p.weight]));
  if ((lowRiskMap.get('rushes') ?? 1) !== 0) {
    throw new Error('Expected low-risk pressure response to zero out rushes.');
  }
  if ((highRiskMap.get('freezes') ?? 1) !== 0) {
    throw new Error('Expected high-risk pressure response to zero out freezes.');
  }

  console.log('Personality vocab test passed.');
}

run();
