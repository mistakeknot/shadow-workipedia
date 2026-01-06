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
  seed: 'agentsview-test-narrative-length',
  vocab,
  priors,
  countries,
  birthYear: 1984,
  asOfYear: 2025,
});

const html = renderAgent(agent, new Map(), 'overview', () => true, 2025, vocab);

const synopsisMatch = html.match(/<h3>Synopsis<\/h3>[\s\S]*?<div class="agent-narrative">([\s\S]*?)<\/div>/);
if (!synopsisMatch) {
  throw new Error('Synopsis narrative not found in render output.');
}
const synopsisParagraphs = (synopsisMatch[1].match(/<p>/g) ?? []).length;
if (synopsisParagraphs !== 3) {
  throw new Error(`Expected synopsis to have 3 paragraphs, got ${synopsisParagraphs}.`);
}

const detailsMatch = html.match(/data-agents-details="profile:portrait:narrative"[\s\S]*?<div class="agent-narrative">([\s\S]*?)<\/div>/);
if (!detailsMatch) {
  throw new Error('Full narrative not found in render output.');
}
const detailParagraphs = (detailsMatch[1].match(/<p>/g) ?? []).length;
if (detailParagraphs < 4) {
  throw new Error(`Expected full narrative to have at least 4 paragraphs, got ${detailParagraphs}.`);
}

console.log('agent narrative length test passed.');
