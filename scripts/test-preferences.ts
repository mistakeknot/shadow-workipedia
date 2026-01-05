#!/usr/bin/env node
/**
 * Preferences Vocab Test Harness
 *
 * Verifies that expanded preference vocab exists and generation outputs
 * the expected preference fields.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateAgent, type AgentVocabV1, type AgentPriorsV1 } from '../src/agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_SEEDS = ['prefs-001', 'prefs-002', 'prefs-003'];

function loadJsonFile<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, '..', relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

function assertNonEmptyArray(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Expected ${label} to be a non-empty array.`);
  }
}

function assertNonEmptyString(value: unknown, label: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Expected ${label} to be a non-empty string.`);
  }
}

function run(): void {
  console.log('Loading vocab + priors...');
  const vocab = loadJsonFile<AgentVocabV1>('public/agent-vocab.v1.json');
  const priors = loadJsonFile<AgentPriorsV1>('public/agent-priors.v1.json');
  const shadowMap = loadJsonFile<Array<{ real: string; shadow: string; iso3?: string; continent?: string }>>(
    'public/shadow-country-map.json'
  );

  const countries = shadowMap.filter(c => c.iso3 && c.iso3.length === 3);

  console.log('Checking vocab expansions...');
  const prefs = vocab.preferences as AgentVocabV1['preferences'] & Record<string, unknown>;
  const env = (prefs as { environment?: Record<string, unknown> }).environment;
  const living = (prefs as { livingSpace?: Record<string, unknown> }).livingSpace;
  const aesthetics = (prefs as { aesthetics?: Record<string, unknown> }).aesthetics;
  const artistic = (prefs as { artistic?: Record<string, unknown> }).artistic;
  const social = (prefs as { social?: Record<string, unknown> }).social;
  const work = (prefs as { work?: Record<string, unknown> }).work;
  const equipment = (prefs as { equipment?: Record<string, unknown> }).equipment;
  const quirks = (prefs as { quirks?: Record<string, unknown> }).quirks;
  const time = (prefs as { time?: Record<string, unknown> }).time;

  assertNonEmptyArray(env?.temperatureTags, 'preferences.environment.temperatureTags');
  assertNonEmptyArray(env?.weatherMoodTags, 'preferences.environment.weatherMoodTags');
  assertNonEmptyArray(living?.roomPreferenceTags, 'preferences.livingSpace.roomPreferenceTags');
  assertNonEmptyArray(living?.comfortItemTags, 'preferences.livingSpace.comfortItemTags');
  assertNonEmptyArray(aesthetics?.colorPalettes, 'preferences.aesthetics.colorPalettes');
  assertNonEmptyArray(aesthetics?.patternPreferences, 'preferences.aesthetics.patternPreferences');
  assertNonEmptyArray(aesthetics?.lightingPreferences, 'preferences.aesthetics.lightingPreferences');
  assertNonEmptyArray(aesthetics?.visualComplexityPreferences, 'preferences.aesthetics.visualComplexityPreferences');
  assertNonEmptyArray(aesthetics?.decorPreferences, 'preferences.aesthetics.decorPreferences');
  assertNonEmptyArray(aesthetics?.architectureStyles, 'preferences.aesthetics.architectureStyles');
  assertNonEmptyArray(aesthetics?.soundscapes, 'preferences.aesthetics.soundscapes');
  assertNonEmptyArray(aesthetics?.noiseTolerancePreferences, 'preferences.aesthetics.noiseTolerancePreferences');
  assertNonEmptyArray(aesthetics?.texturePreferences, 'preferences.aesthetics.texturePreferences');
  assertNonEmptyArray(aesthetics?.materialPreferences, 'preferences.aesthetics.materialPreferences');
  assertNonEmptyArray(aesthetics?.touchPreferences, 'preferences.aesthetics.touchPreferences');
  assertNonEmptyArray(aesthetics?.scentAttractions, 'preferences.aesthetics.scentAttractions');
  assertNonEmptyArray(aesthetics?.scentAversions, 'preferences.aesthetics.scentAversions');
  assertNonEmptyArray(artistic?.mediums, 'preferences.artistic.mediums');
  assertNonEmptyArray(artistic?.inspirationSources, 'preferences.artistic.inspirationSources');
  assertNonEmptyArray(artistic?.expressionDrivers, 'preferences.artistic.expressionDrivers');
  assertNonEmptyArray(artistic?.practiceRhythms, 'preferences.artistic.practiceRhythms');
  assertNonEmptyArray(artistic?.sharingStyles, 'preferences.artistic.sharingStyles');
  assertNonEmptyArray(artistic?.workspacePreferences, 'preferences.artistic.workspacePreferences');
  assertNonEmptyArray(social?.groupStyleTags, 'preferences.social.groupStyleTags');
  assertNonEmptyArray(social?.communicationMethodTags, 'preferences.social.communicationMethodTags');
  assertNonEmptyArray(social?.boundaryTags, 'preferences.social.boundaryTags');
  assertNonEmptyArray(social?.emotionalSharingTags, 'preferences.social.emotionalSharingTags');
  assertNonEmptyArray(work?.preferredOperationTags, 'preferences.work.preferredOperationTags');
  assertNonEmptyArray(work?.avoidedOperationTags, 'preferences.work.avoidedOperationTags');
  assertNonEmptyArray(equipment?.weaponPreferenceTags, 'preferences.equipment.weaponPreferenceTags');
  assertNonEmptyArray(equipment?.gearPreferenceTags, 'preferences.equipment.gearPreferenceTags');
  assertNonEmptyArray(quirks?.luckyItemTags, 'preferences.quirks.luckyItemTags');
  assertNonEmptyArray(quirks?.ritualTags, 'preferences.quirks.ritualTags');
  assertNonEmptyArray(quirks?.petPeeveTags, 'preferences.quirks.petPeeveTags');
  assertNonEmptyArray(quirks?.mustHaveTags, 'preferences.quirks.mustHaveTags');
  assertNonEmptyArray(time?.dailyRhythmTags, 'preferences.time.dailyRhythmTags');
  assertNonEmptyArray(time?.planningStyleTags, 'preferences.time.planningStyleTags');

  console.log('Checking generated agents...');
  for (const seed of TEST_SEEDS) {
    const agent = generateAgent({
      seed,
      asOfYear: 2025,
      vocab,
      priors,
      countries,
      includeTrace: false,
    });

    assertNonEmptyString(agent.preferences.environment.temperature, `${seed} environment.temperature`);
    assertNonEmptyString(agent.preferences.environment.weatherMood, `${seed} environment.weatherMood`);
    assertNonEmptyArray(agent.preferences.livingSpace.roomPreferences, `${seed} livingSpace.roomPreferences`);
    assertNonEmptyArray(agent.preferences.livingSpace.comfortItems, `${seed} livingSpace.comfortItems`);
    assertNonEmptyString(agent.preferences.aesthetics.colorPalette, `${seed} aesthetics.colorPalette`);
    assertNonEmptyString(agent.preferences.aesthetics.patternPreference, `${seed} aesthetics.patternPreference`);
    assertNonEmptyString(agent.preferences.aesthetics.lightingPreference, `${seed} aesthetics.lightingPreference`);
    assertNonEmptyString(agent.preferences.aesthetics.visualComplexityPreference, `${seed} aesthetics.visualComplexityPreference`);
    assertNonEmptyArray(agent.preferences.aesthetics.decorPreferences, `${seed} aesthetics.decorPreferences`);
    assertNonEmptyString(agent.preferences.aesthetics.architectureStyle, `${seed} aesthetics.architectureStyle`);
    assertNonEmptyString(agent.preferences.aesthetics.soundscape, `${seed} aesthetics.soundscape`);
    assertNonEmptyString(agent.preferences.aesthetics.noiseTolerancePreference, `${seed} aesthetics.noiseTolerancePreference`);
    assertNonEmptyString(agent.preferences.aesthetics.texturePreference, `${seed} aesthetics.texturePreference`);
    assertNonEmptyString(agent.preferences.aesthetics.materialPreference, `${seed} aesthetics.materialPreference`);
    assertNonEmptyString(agent.preferences.aesthetics.touchPreference, `${seed} aesthetics.touchPreference`);
    assertNonEmptyString(agent.preferences.aesthetics.scentAttraction, `${seed} aesthetics.scentAttraction`);
    assertNonEmptyString(agent.preferences.aesthetics.scentAversion, `${seed} aesthetics.scentAversion`);
    assertNonEmptyArray(agent.preferences.artistic.mediums, `${seed} artistic.mediums`);
    assertNonEmptyString(agent.preferences.artistic.inspirationSource, `${seed} artistic.inspirationSource`);
    assertNonEmptyString(agent.preferences.artistic.expressionDriver, `${seed} artistic.expressionDriver`);
    assertNonEmptyString(agent.preferences.artistic.practiceRhythm, `${seed} artistic.practiceRhythm`);
    assertNonEmptyString(agent.preferences.artistic.sharingStyle, `${seed} artistic.sharingStyle`);
    assertNonEmptyString(agent.preferences.artistic.workspacePreference, `${seed} artistic.workspacePreference`);
    assertNonEmptyString(agent.preferences.social.groupStyle, `${seed} social.groupStyle`);
    assertNonEmptyString(agent.preferences.social.communicationMethod, `${seed} social.communicationMethod`);
    assertNonEmptyString(agent.preferences.social.boundary, `${seed} social.boundary`);
    assertNonEmptyString(agent.preferences.social.emotionalSharing, `${seed} social.emotionalSharing`);
    assertNonEmptyArray(agent.preferences.work.preferredOperations, `${seed} work.preferredOperations`);
    assertNonEmptyArray(agent.preferences.work.avoidedOperations, `${seed} work.avoidedOperations`);
    assertNonEmptyString(agent.preferences.equipment.weaponPreference, `${seed} equipment.weaponPreference`);
    assertNonEmptyArray(agent.preferences.equipment.gearPreferences, `${seed} equipment.gearPreferences`);
    assertNonEmptyString(agent.preferences.quirks.luckyItem, `${seed} quirks.luckyItem`);
    assertNonEmptyArray(agent.preferences.quirks.rituals, `${seed} quirks.rituals`);
    assertNonEmptyArray(agent.preferences.quirks.petPeeves, `${seed} quirks.petPeeves`);
    assertNonEmptyArray(agent.preferences.quirks.mustHaves, `${seed} quirks.mustHaves`);
    assertNonEmptyString(agent.preferences.time.dailyRhythm, `${seed} time.dailyRhythm`);
    assertNonEmptyString(agent.preferences.time.planningStyle, `${seed} time.planningStyle`);
  }

  console.log('Preferences vocab test passed.');
}

run();
