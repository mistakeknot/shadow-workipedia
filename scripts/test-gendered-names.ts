#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateAgent } from '../src/agent';
import type { AgentPriorsV1, AgentVocabV1, GenerateAgentInput } from '../src/agent/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJson<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, '..', relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf-8')) as T;
}

const vocab = loadJson<AgentVocabV1>('public/agent-vocab.v1.json');
const priors = loadJson<AgentPriorsV1>('public/agent-priors.v1.json');
const countries = loadJson<GenerateAgentInput['countries']>('public/shadow-country-map.json');

const addNames = (target: Set<string>, names: string[] | undefined): void => {
  if (!names) return;
  for (const name of names) target.add(name);
};

const assertNonEmpty = (label: string, names: string[] | undefined): void => {
  if (!names || names.length === 0) {
    throw new Error(`Expected non-empty ${label}.`);
  }
};

const assertDisjoint = (label: string, male: string[] | undefined, female: string[] | undefined): void => {
  if (!male || !female) return;
  const femaleSet = new Set(female);
  const overlap = male.filter(name => femaleSet.has(name));
  if (overlap.length) {
    const sample = overlap.slice(0, 5).join(', ');
    throw new Error(`Expected disjoint ${label}. Overlap: ${sample}`);
  }
};

assertNonEmpty('identity.maleFirstNames', (vocab.identity as { maleFirstNames?: string[] }).maleFirstNames);
assertNonEmpty('identity.femaleFirstNames', (vocab.identity as { femaleFirstNames?: string[] }).femaleFirstNames);
assertDisjoint(
  'identity gendered pools',
  (vocab.identity as { maleFirstNames?: string[] }).maleFirstNames,
  (vocab.identity as { femaleFirstNames?: string[] }).femaleFirstNames,
);

const maleUnion = new Set<string>();
const femaleUnion = new Set<string>();
addNames(maleUnion, (vocab.identity as { maleFirstNames?: string[] }).maleFirstNames);
addNames(femaleUnion, (vocab.identity as { femaleFirstNames?: string[] }).femaleFirstNames);

for (const [profileId, profile] of Object.entries(vocab.cultureProfiles ?? {})) {
  if (!profile.identity?.firstNames?.length) continue;
  const male = profile.identity?.maleFirstNames;
  const female = profile.identity?.femaleFirstNames;
  assertNonEmpty(`cultureProfiles.${profileId}.identity.maleFirstNames`, male);
  assertNonEmpty(`cultureProfiles.${profileId}.identity.femaleFirstNames`, female);
  assertDisjoint(`cultureProfiles.${profileId}.identity`, male, female);
  addNames(maleUnion, male);
  addNames(femaleUnion, female);
}

for (const [profileId, profile] of Object.entries(vocab.microCultureProfiles ?? {})) {
  if (!profile.identity?.firstNames?.length) continue;
  const male = profile.identity?.maleFirstNames;
  const female = profile.identity?.femaleFirstNames;
  assertNonEmpty(`microCultureProfiles.${profileId}.identity.maleFirstNames`, male);
  assertNonEmpty(`microCultureProfiles.${profileId}.identity.femaleFirstNames`, female);
  assertDisjoint(`microCultureProfiles.${profileId}.identity`, male, female);
  addNames(maleUnion, male);
  addNames(femaleUnion, female);
}

if (!maleUnion.size || !femaleUnion.size) {
  throw new Error('Expected gendered name unions to be non-empty.');
}

const seeds = Array.from({ length: 200 }, (_, i) => `gendered-name-${i}`);
const mismatches: Array<{ name: string; gender: string }> = [];

for (const seed of seeds) {
  const agent = generateAgent({
    seed,
    vocab,
    priors,
    countries,
    birthYear: 1988,
    asOfYear: 2025,
  });
  const firstName = agent.identity.name.split(' ')[0] ?? '';
  if (!firstName) continue;
  if (agent.gender.identityTag === 'cisgender-man' && !maleUnion.has(firstName)) {
    mismatches.push({ name: firstName, gender: 'cisgender-man' });
  }
  if (agent.gender.identityTag === 'cisgender-woman' && !femaleUnion.has(firstName)) {
    mismatches.push({ name: firstName, gender: 'cisgender-woman' });
  }
}

if (mismatches.length) {
  const sample = mismatches.slice(0, 5).map(m => `${m.name} (${m.gender})`).join(', ');
  throw new Error(`Found ${mismatches.length} gendered name mismatches. Sample: ${sample}`);
}

console.log('gendered name pools test passed.');
