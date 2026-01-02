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
  const quirkNames = vocab.personality?.quirkCombinations?.map(c => c.name) ?? [];
  if (!quirkNames.includes('The Compassionate Predator')) {
    throw new Error('Expected personality.quirkCombinations to include \"The Compassionate Predator\".');
  }

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

  console.log('Checking affect/self-concept vocab...');
  assertIncludes(vocab.affect?.baselineAffects, 'numb', 'affect.baselineAffects');
  assertIncludes(vocab.affect?.regulationStyles, 'meditates', 'affect.regulationStyles');
  assertIncludes(vocab.affect?.stressTells, 'jaw-clench', 'affect.stressTells');
  assertIncludes(vocab.affect?.repairStyles, 'gives-space', 'affect.repairStyles');
  assertIncludes(vocab.selfConcept?.selfStories, 'avenger', 'selfConcept.selfStories');
  assertIncludes(vocab.selfConcept?.socialMasks, 'professional', 'selfConcept.socialMasks');

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

  console.log('Personality vocab test passed.');
}

run();
