#!/usr/bin/env node
/**
 * Lifestyle Summary Helper Test Harness
 *
 * Verifies summary formatting for everyday life and memory/trauma UI helpers.
 */

import { buildEverydayLifeSummary, buildMemoryTraumaSummary } from '../src/agent/lifestyleSummary';

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`Expected ${label} to be "${expected}", got "${actual}"`);
  }
}

function run(): void {
  const everyday = buildEverydayLifeSummary({
    thirdPlaces: ['cafes', 'coworking-space'],
    commuteMode: 'remote',
    weeklyAnchor: 'meal-prep',
    pettyHabits: ['multiple-alarms'],
    caregivingObligation: 'pet-care',
  }, value => value.toUpperCase());

  assertEqual(everyday.thirdPlaces, 'CAFES, COWORKING-SPACE', 'everyday.thirdPlaces');
  assertEqual(everyday.commuteMode, 'REMOTE', 'everyday.commuteMode');
  assertEqual(everyday.weeklyAnchor, 'MEAL-PREP', 'everyday.weeklyAnchor');
  assertEqual(everyday.pettyHabits, 'MULTIPLE-ALARMS', 'everyday.pettyHabits');
  assertEqual(everyday.caregivingObligation, 'PET-CARE', 'everyday.caregivingObligation');

  const memory = buildMemoryTraumaSummary({
    memoryTags: ['visual-snapshot'],
    traumaTags: ['combat-direct-violence'],
    triggerPatterns: ['smell', 'anniversary'],
    responsePatterns: ['hypervigilance'],
  }, value => value.toUpperCase());

  assertEqual(memory.memoryTags, 'VISUAL-SNAPSHOT', 'memory.memoryTags');
  assertEqual(memory.traumaTags, 'COMBAT-DIRECT-VIOLENCE', 'memory.traumaTags');
  assertEqual(memory.triggerPatterns, 'SMELL, ANNIVERSARY', 'memory.triggerPatterns');
  assertEqual(memory.responsePatterns, 'HYPERVIGILANCE', 'memory.responsePatterns');

  const emptyMemory = buildMemoryTraumaSummary({
    memoryTags: [],
    traumaTags: [],
    triggerPatterns: [],
    responsePatterns: [],
  });
  assertEqual(emptyMemory.traumaTags, '—', 'empty memory.traumaTags');

  console.log('Lifestyle summaries test passed.');
}

run();
