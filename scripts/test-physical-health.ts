#!/usr/bin/env node
/**
 * Physical Health Vocab Test Harness
 *
 * Verifies health vocab expansions and ensures high-conflict contexts
 * can generate injury history tags and fitness bands.
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

  console.log('Checking health vocab expansions...');
  assertIncludes(vocab.health?.injuryHistoryTags, 'gunshot-wound', 'health.injuryHistoryTags');
  assertIncludes(vocab.health?.diseaseTags, 'pneumonia', 'health.diseaseTags');
  assertIncludes(vocab.health?.fitnessBands, 'peak-condition', 'health.fitnessBands');
  assertIncludes(vocab.health?.treatmentTags, 'physical-therapy', 'health.treatmentTags');

  console.log('Checking high-conflict injury generation...');
  const baseCtx = {
    vocab,
    age: 36,
    tierBand: 'middle' as const,
    homeCountryIso3: 'USA',
    homeCulture: 'western',
    cohortBucketStartYear: 1990,
    latents: {
      cosmopolitanism: 500,
      publicness: 500,
      opsecDiscipline: 500,
      institutionalEmbeddedness: 500,
      riskAppetite: 650,
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
      physicalConditioning: 650,
    },
    cosmo01: 0.5,
    inst01: 0.5,
    risk01: 0.7,
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
      endurance: 600,
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
    travelScore: 700,
  };

  let sawInjury = false;
  let sawFitnessBand = false;
  const fitnessBands = new Set(vocab.health?.fitnessBands ?? []);
  for (let i = 0; i < 25; i += 1) {
    const health = computeLifestyle({ ...baseCtx, seed: `health-high-${i}` }).health;
    if (health.injuryHistoryTags.length > 0) sawInjury = true;
    if (health.fitnessBand && fitnessBands.has(health.fitnessBand)) sawFitnessBand = true;
    if (sawInjury && sawFitnessBand) break;
  }
  if (!sawInjury) {
    throw new Error('Expected at least one high-conflict seed to yield an injury history tag.');
  }
  if (!sawFitnessBand) {
    throw new Error('Expected fitnessBand to be selected from vocab.health.fitnessBands.');
  }

  console.log('Physical health test passed.');
}

run();
