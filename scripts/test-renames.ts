#!/usr/bin/env npx tsx
/**
 * Verify that renamed shadow names work correctly
 */

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

console.log('=== Shadow Name Rename Verification ===\n');

// 1. Verify renamed profiles exist in vocab
console.log('1. Checking renamed profiles in vocab...');
const renamedProfiles = [
  'profile:nabatric',     // was aramaic
  'profile:mauryanic',    // was bharatic
  'profile:sangamic',     // was dravidic
  'profile:austronic',    // was teutonic
  'profile:vyatic',       // was slavonic
  'profile:thracopolic',  // was helladic
  'profile:vangalic',     // was gangetic
  'profile:mazanic',      // was parsic
  'profile:zhonghuaic',   // was tianlongic
];

const vocabProfiles = Object.keys(vocab.microCultureProfiles ?? {});
let missingProfiles = 0;
for (const profile of renamedProfiles) {
  if (!vocabProfiles.includes(profile)) {
    console.log(`  ✗ MISSING: ${profile}`);
    missingProfiles++;
  } else {
    console.log(`  ✓ ${profile}`);
  }
}

// 2. Verify old profiles are gone
console.log('\n2. Checking old profiles are removed...');
const oldProfiles = [
  'profile:aramaic',
  'profile:bharatic',
  'profile:dravidic',
  'profile:teutonic',
  'profile:slavonic',
  'profile:helladic',
  'profile:gangetic',
  'profile:parsic',
  'profile:tianlongic',
];

let staleProfiles = 0;
for (const profile of oldProfiles) {
  if (vocabProfiles.includes(profile)) {
    console.log(`  ✗ STILL EXISTS: ${profile}`);
    staleProfiles++;
  } else {
    console.log(`  ✓ Removed: ${profile}`);
  }
}

// 3. Verify country names
console.log('\n3. Checking renamed countries...');
const renamedCountries: Record<string, string> = {
  'CHN': 'Zhonghua',      // was Tianlong
  'IND': 'Jambudvipa',    // was Bharatvani
  'PHL': 'Luzvimin',      // was Maharlika
  'PRK': 'Koryelik',      // was Juchevon
  'DEU': 'Austrasien',    // was Teutmark
  'LKA': 'Serendivine',     // was Serendivi
  'BRB': 'Bajani',        // was Ichirougan
  'CYM': 'Caimani',       // was Bodhenisle
};

let wrongCountries = 0;
for (const [iso3, expectedShadow] of Object.entries(renamedCountries)) {
  const country = countries.find(c => c.iso3 === iso3);
  if (!country) {
    console.log(`  ✗ NOT FOUND: ${iso3}`);
    wrongCountries++;
  } else if (country.shadow !== expectedShadow) {
    console.log(`  ✗ WRONG: ${iso3} = "${country.shadow}" (expected "${expectedShadow}")`);
    wrongCountries++;
  } else {
    console.log(`  ✓ ${iso3} = ${country.shadow}`);
  }
}

// 4. Generate some agents to verify profiles work
console.log('\n4. Generating test agents...');
const testCountries = ['ARE', 'DEU', 'IND', 'CHN', 'USA'];

for (const iso3 of testCountries) {
  try {
    const agent = generateAgent({
      seed: 'test-rename-' + iso3,
      vocab,
      priors,
      countries,
      asOfYear: 2024,
      homeCountryIso3: iso3,
      includeTrace: true,
    });

    const trace = agent.generationTrace;
    const microTop = (trace?.derived?.microCultureProfilesTop as Array<{profileId: string}> | undefined);
    const topProfile = microTop?.[0]?.profileId ?? 'none';

    console.log(`  ✓ ${iso3}: ${agent.identity.name} - top micro: ${topProfile}`);
  } catch (err) {
    console.log(`  ✗ ${iso3}: ERROR - ${err}`);
  }
}

// Summary
console.log('\n=== Summary ===');
const errors = missingProfiles + staleProfiles + wrongCountries;
if (errors === 0) {
  console.log('✓ All renames verified successfully!');
} else {
  console.log(`✗ ${errors} error(s) found`);
  process.exit(1);
}
