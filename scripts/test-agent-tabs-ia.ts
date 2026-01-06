#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateAgent } from '../src/agent';
import type { AgentPriorsV1, AgentVocabV1, GenerateAgentInput } from '../src/agent/types';
import { renderAgent } from '../src/agentsView/renderAgent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJson<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, '..', relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf-8')) as T;
}

const vocab = loadJson<AgentVocabV1>('public/agent-vocab.v1.json');
const priors = loadJson<AgentPriorsV1>('public/agent-priors.v1.json');
const countries = loadJson<GenerateAgentInput['countries']>('public/shadow-country-map.json');

const agent = generateAgent({
  seed: 'agentsview-test-tabs-ia',
  vocab,
  priors,
  countries,
  birthYear: 1982,
  asOfYear: 2025,
});

const html = renderAgent(agent, new Map(), 'overview', () => true, 2025, vocab);

const expectedTabs = [
  'data-agent-tab="overview"',
  'data-agent-tab="character"',
  'data-agent-tab="life"',
  'data-agent-tab="skills"',
  'data-agent-tab="connections"',
  'data-agent-tab="mind"',
  'data-agent-tab="data"',
];

for (const tab of expectedTabs) {
  if (!html.includes(tab)) {
    throw new Error(`Expected tab ${tab} in render output.`);
  }
}

const expectedPanels = [
  'data-agent-tab-panel="overview"',
  'data-agent-tab-panel="character"',
  'data-agent-tab-panel="life"',
  'data-agent-tab-panel="skills"',
  'data-agent-tab-panel="connections"',
  'data-agent-tab-panel="mind"',
  'data-agent-tab-panel="data"',
];

for (const panel of expectedPanels) {
  if (!html.includes(panel)) {
    throw new Error(`Expected panel ${panel} in render output.`);
  }
}

console.log('agent tab IA test passed.');
