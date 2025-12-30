import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateAgent, type AgentVocabV1, type AgentPriorsV1, type ShadowCountryMapEntry } from '../src/agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJsonFile<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, '..', relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

const vocab = loadJsonFile<AgentVocabV1>('public/agent-vocab.v1.json');
const priors = loadJsonFile<AgentPriorsV1>('public/agent-priors.v1.json');
const countries = loadJsonFile<ShadowCountryMapEntry[]>('public/shadow-country-map.json');

const traditions = new Map<string, number>();
const cultures = new Map<string, number>();
const cultureTraditionPairs = new Map<string, number>();

for (let i = 0; i < 500; i++) {
  const input = {
    seed: `test-spirit-${i}`,
    vocab,
    priors,
    countries,
    asOfYear: 2024,
  };
  const agent = generateAgent(input);

  const trad = agent.spirituality.tradition;
  traditions.set(trad, (traditions.get(trad) ?? 0) + 1);

  const culture = agent.identity.homeCulture;
  cultures.set(culture, (cultures.get(culture) ?? 0) + 1);

  // Track culture-tradition pairs
  if (trad !== 'none') {
    const pair = `${culture}→${trad}`;
    cultureTraditionPairs.set(pair, (cultureTraditionPairs.get(pair) ?? 0) + 1);
  }

  if (i < 10) {
    const name = agent.identity.name;
    console.log(`${name}: ${culture} → ${trad} (${agent.spirituality.affiliationTag}, ${agent.spirituality.observanceLevel})`);
  }
}

console.log('\n=== Tradition Distribution ===');
[...traditions.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([t, c]) => console.log(`${t}: ${c}`));

console.log('\n=== Culture Distribution ===');
[...cultures.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([c, n]) => console.log(`${c}: ${n}`));

console.log('\n=== Top Culture→Tradition Pairs (showing culture-aware selection) ===');
[...cultureTraditionPairs.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .forEach(([pair, count]) => console.log(`${pair}: ${count}`));
