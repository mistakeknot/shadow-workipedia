#!/usr/bin/env node
/**
 * Health Summary Helper Test Harness
 *
 * Verifies health summary formatting for UI/export helpers.
 */

import { buildHealthSummary } from '../src/agent/healthSummary';

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`Expected ${label} to be "${expected}", got "${actual}"`);
  }
}

function run(): void {
  const health = {
    chronicConditionTags: ['arthritis'],
    allergyTags: ['pollen'],
    injuryHistoryTags: ['gunshot-wound', 'concussion'],
    diseaseTags: ['pneumonia'],
    fitnessBand: 'excellent',
    treatmentTags: ['physical-therapy', 'painkillers'],
  };

  const summary = buildHealthSummary(health, (value) => value.toUpperCase());
  assertEqual(summary.chronic, 'ARTHRITIS', 'chronic summary');
  assertEqual(summary.allergies, 'POLLEN', 'allergies summary');
  assertEqual(summary.injuries, 'GUNSHOT-WOUND, CONCUSSION', 'injuries summary');
  assertEqual(summary.diseases, 'PNEUMONIA', 'diseases summary');
  assertEqual(summary.fitness, 'EXCELLENT', 'fitness summary');
  assertEqual(summary.treatments, 'PHYSICAL-THERAPY, PAINKILLERS', 'treatments summary');

  const emptySummary = buildHealthSummary({
    chronicConditionTags: [],
    allergyTags: [],
    injuryHistoryTags: [],
    diseaseTags: [],
    fitnessBand: 'good',
    treatmentTags: [],
  });
  assertEqual(emptySummary.chronic, '—', 'empty chronic summary');
  assertEqual(emptySummary.treatments, '—', 'empty treatments summary');

  console.log('Health summary test passed.');
}

run();
