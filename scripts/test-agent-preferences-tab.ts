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
  seed: 'agentsview-test-preferences',
  vocab,
  priors,
  countries,
  birthYear: 1988,
  asOfYear: 2025,
});

const html = renderAgent(agent, new Map(), 'portrait', () => true, 2025, vocab);

if (!html.includes('data-agent-tab="preferences"')) {
  throw new Error('Expected Preferences tab button to render.');
}
if (!html.includes('data-agent-tab-panel="preferences"')) {
  throw new Error('Expected Preferences tab panel to render.');
}
if (!html.includes('Preferences')) {
  throw new Error('Expected Preferences label to appear.');
}

console.log('agent preferences tab test passed.');
