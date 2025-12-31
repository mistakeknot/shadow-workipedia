import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateAgent, type AgentVocabV1, type AgentPriorsV1 } from '../src/agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJsonFile<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, '..', relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

const vocab = loadJsonFile<AgentVocabV1>('public/agent-vocab.v1.json');
const priors = loadJsonFile<AgentPriorsV1>('public/agent-priors.v1.json');
const shadowMap = loadJsonFile<Array<{ real: string; shadow: string; iso3?: string; continent?: string; population?: number }>>('public/shadow-country-map.json');

const countries = shadowMap.filter(c => c.iso3 && c.iso3.length === 3);
const shadowByIso3 = new Map(countries.map(c => [c.iso3, c.shadow]));

const countryHits: Record<string, number> = {};

// Use random seeds
for (let i = 0; i < 500; i++) {
  const seed = `random-test-${Math.random().toString(36)}`;
  const agent = generateAgent({ seed, asOfYear: 2025, vocab, priors, countries });
  const shadow = shadowByIso3.get(agent.identity.homeCountryIso3) ?? agent.identity.homeCountryIso3;
  countryHits[shadow] = (countryHits[shadow] ?? 0) + 1;
}

const sorted = Object.entries(countryHits).sort((a, b) => b[1] - a[1]);
console.log('Top 20 countries with random seeds:');
sorted.slice(0, 20).forEach(([name, count]) => console.log(`  ${count} ${name}`));
console.log('');
console.log('Key countries:');
['Amaran', 'Alvion', 'Teutmark', 'Gallicene', 'Kamikura', 'Rupertine',
 'Bharatvani', 'Tianlong', 'Severnya'].forEach(name => {
  console.log(`  ${countryHits[name] ?? 0} ${name}`);
});
