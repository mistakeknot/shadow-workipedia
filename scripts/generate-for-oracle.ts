#!/usr/bin/env node
/**
 * Generate agents for oracle review
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateAgent, type AgentVocabV1, type AgentPriorsV1 } from '../src/agent';
import { generateNarrative, pronounSetToMode } from '../src/agentNarration';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJsonFile<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, '..', relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

const vocab = loadJsonFile<AgentVocabV1>('public/agent-vocab.v1.json');
const priors = loadJsonFile<AgentPriorsV1>('public/agent-priors.v1.json');
const shadowMap = loadJsonFile<Array<{ real: string; shadow: string; iso3?: string; continent?: string }>>(
  'public/shadow-country-map.json'
);

const shadowByIso3 = new Map<string, { shadow: string; continent?: string }>();
for (const entry of shadowMap) {
  if (entry.iso3) {
    shadowByIso3.set(entry.iso3, { shadow: entry.shadow, continent: entry.continent });
  }
}

const countries = shadowMap.filter(c => c.iso3 && c.iso3.length === 3);

const results: Array<{
  id: number;
  seed: string;
  name: string;
  tier: string;
  role: string;
  homeCountry: string;
  currentCountry: string;
  age: number;
  pronouns: string;
  gender: string;
  para1: string;
  para2: string;
}> = [];

// Generate 500 agents with varied seeds
for (let i = 1; i <= 500; i++) {
  const seed = `oracle-review-${i}`;
  const agent = generateAgent({
    seed,
    asOfYear: 2025,
    vocab,
    priors,
    countries,
  });

  const originLabel = shadowByIso3.get(agent.identity.homeCountryIso3)?.shadow ?? agent.identity.homeCountryIso3;
  const citizenshipLabel = shadowByIso3.get(agent.identity.citizenshipCountryIso3)?.shadow ?? agent.identity.citizenshipCountryIso3;
  const currentLabel = shadowByIso3.get(agent.identity.currentCountryIso3)?.shadow ?? agent.identity.currentCountryIso3;

  // Use the agent's actual pronounSet instead of random 'seeded' mode
  const pronounMode = pronounSetToMode(agent.gender.pronounSet, seed);
  const narr = generateNarrative(agent, { originLabel, citizenshipLabel, currentLabel }, 2025, pronounMode);

  results.push({
    id: i,
    seed,
    name: agent.identity.name,
    tier: agent.identity.tierBand,
    role: agent.identity.roleSeedTags.join(', '),
    homeCountry: originLabel,
    currentCountry: currentLabel,
    age: 2025 - agent.identity.birthYear,
    pronouns: agent.gender.pronounSet,
    gender: agent.gender.identityTag,
    para1: narr.para1,
    para2: narr.para2,
  });
}

writeFileSync('/tmp/agents-500.json', JSON.stringify(results, null, 2));
console.log('Generated 500 agents to /tmp/agents-500.json');

// Also create a summary for the oracle
const stats = {
  total: results.length,
  byTier: {} as Record<string, number>,
  byPronouns: {} as Record<string, number>,
  byGender: {} as Record<string, number>,
  ageRange: { min: Infinity, max: -Infinity, avg: 0 },
  uniqueCountries: new Set<string>(),
  uniqueRoles: new Set<string>(),
};

for (const r of results) {
  stats.byTier[r.tier] = (stats.byTier[r.tier] ?? 0) + 1;
  stats.byPronouns[r.pronouns] = (stats.byPronouns[r.pronouns] ?? 0) + 1;
  stats.byGender[r.gender] = (stats.byGender[r.gender] ?? 0) + 1;
  stats.ageRange.min = Math.min(stats.ageRange.min, r.age);
  stats.ageRange.max = Math.max(stats.ageRange.max, r.age);
  stats.ageRange.avg += r.age;
  stats.uniqueCountries.add(r.homeCountry);
  stats.uniqueCountries.add(r.currentCountry);
  r.role.split(', ').forEach(role => stats.uniqueRoles.add(role));
}
stats.ageRange.avg /= results.length;

console.log('\nStats:');
console.log('Tiers:', stats.byTier);
console.log('Pronouns:', stats.byPronouns);
console.log('Gender:', stats.byGender);
console.log('Age range:', stats.ageRange.min, '-', stats.ageRange.max, 'avg:', stats.ageRange.avg.toFixed(1));
console.log('Unique countries:', stats.uniqueCountries.size);
console.log('Unique roles:', stats.uniqueRoles.size);
