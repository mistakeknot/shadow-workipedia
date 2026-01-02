#!/usr/bin/env node
/**
 * Memory & Trauma Vocab Test Harness
 *
 * Verifies memory/trauma vocab expansions and ensures high-conflict contexts
 * generate trauma tags with trigger/response patterns.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { computeLifestyle } from '../src/agent/facets/lifestyle';
import type { AgentVocabV1 } from '../src/agent/types';

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

function assertAtLeast(value: number, min: number, label: string): void {
  if (value < min) {
    throw new Error(`Expected ${label} to be >= ${min}, got ${value}.`);
  }
}

function run(): void {
  console.log('Loading vocab...');
  const vocab = loadJsonFile<AgentVocabV1>('public/agent-vocab.v1.json');

  console.log('Checking memory/trauma vocab...');
  assertIncludes(vocab.memoryTrauma?.memoryTags, 'visual-snapshot', 'memoryTrauma.memoryTags');
  assertIncludes(vocab.memoryTrauma?.traumaTags, 'combat-direct-violence', 'memoryTrauma.traumaTags');
  assertIncludes(vocab.memoryTrauma?.triggerPatterns, 'smell', 'memoryTrauma.triggerPatterns');
  assertIncludes(vocab.memoryTrauma?.responsePatterns, 'hypervigilance', 'memoryTrauma.responsePatterns');

  console.log('Checking high-conflict generation...');
  const lifestyle = computeLifestyle({
    seed: 'memory-trauma-001',
    vocab,
    age: 38,
    tierBand: 'middle',
    homeCountryIso3: 'USA',
    homeCulture: 'western',
    cohortBucketStartYear: 1990,
    latents: {
      cosmopolitanism: 500,
      publicness: 500,
      opsecDiscipline: 500,
      institutionalEmbeddedness: 500,
      riskAppetite: 500,
      stressReactivity: 500,
      impulseControl: 500,
      techFluency: 500,
      socialBattery: 500,
      aestheticExpressiveness: 500,
      frugality: 500,
      curiosityBandwidth: 500,
      adaptability: 500,
      planningHorizon: 500,
      principledness: 500,
      physicalConditioning: 500,
    },
    cosmo01: 0.5,
    inst01: 0.5,
    risk01: 0.6,
    opsec01: 0.5,
    public01: 0.5,
    traits: {
      riskTolerance: 500,
      conscientiousness: 500,
      noveltySeeking: 500,
      agreeableness: 500,
      authoritarianism: 500,
    },
    aptitudes: {
      endurance: 500,
      attentionControl: 500,
    },
    roleSeedTags: ['operative'],
    careerTrackTag: 'military',
    restrictions: [],
    publicVisibility: 500,
    paperTrail: 500,
    attentionResilience: 500,
    doomscrollingRisk: 500,
    securityPressure01k: 900,
    conflictEnv01k: 900,
    stateViolenceEnv01k: 900,
    viceTendency: 0.35,
    travelScore: 600,
  });

  assertAtLeast(lifestyle.memoryTrauma.memoryTags.length, 1, 'memoryTrauma.memoryTags length');
  assertAtLeast(lifestyle.memoryTrauma.triggerPatterns.length, 1, 'memoryTrauma.triggerPatterns length');
  assertAtLeast(lifestyle.memoryTrauma.responsePatterns.length, 1, 'memoryTrauma.responsePatterns length');
  assertAtLeast(lifestyle.memoryTrauma.traumaTags.length, 1, 'memoryTrauma.traumaTags length');

  console.log('Checking low-conflict allows zero trauma tags...');
  const lowBase = {
    vocab,
    age: 30,
    tierBand: 'middle' as const,
    homeCountryIso3: 'USA',
    homeCulture: 'western',
    cohortBucketStartYear: 1990,
    latents: {
      cosmopolitanism: 500,
      publicness: 500,
      opsecDiscipline: 500,
      institutionalEmbeddedness: 500,
      riskAppetite: 400,
      stressReactivity: 350,
      impulseControl: 600,
      techFluency: 500,
      socialBattery: 500,
      aestheticExpressiveness: 500,
      frugality: 500,
      curiosityBandwidth: 500,
      adaptability: 500,
      planningHorizon: 500,
      principledness: 500,
      physicalConditioning: 500,
    },
    cosmo01: 0.4,
    inst01: 0.5,
    risk01: 0.3,
    opsec01: 0.5,
    public01: 0.4,
    traits: {
      riskTolerance: 500,
      conscientiousness: 500,
      noveltySeeking: 500,
      agreeableness: 500,
      authoritarianism: 500,
    },
    aptitudes: {
      endurance: 500,
      attentionControl: 500,
    },
    roleSeedTags: ['analyst'],
    careerTrackTag: 'civil-service',
    restrictions: [],
    publicVisibility: 400,
    paperTrail: 500,
    attentionResilience: 600,
    doomscrollingRisk: 400,
    securityPressure01k: 200,
    conflictEnv01k: 100,
    stateViolenceEnv01k: 100,
    viceTendency: 0.2,
    travelScore: 300,
  };

  let sawZeroTrauma = false;
  for (let i = 0; i < 25; i += 1) {
    const low = computeLifestyle({ ...lowBase, seed: `memory-trauma-low-${i}` });
    if (low.memoryTrauma.traumaTags.length === 0) {
      sawZeroTrauma = true;
      break;
    }
  }
  if (!sawZeroTrauma) {
    throw new Error('Expected at least one low-conflict seed to yield zero trauma tags.');
  }

  console.log('Memory & trauma test passed.');
}

run();
