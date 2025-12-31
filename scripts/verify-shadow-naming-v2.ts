#!/usr/bin/env npx tsx
/**
 * Verify shadow naming v2 fix
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

console.log('=== Shadow Naming v2 Verification ===\n');

let errors = 0;

// 1. Verify NEW country names (v2)
console.log('1. Checking v2 country renames...');
const v2Countries: Record<string, string> = {
  'CHN': 'Zhonghua',      // was Yanzhou
  'USA': 'Amaran',        // unchanged
  'RUS': 'Holmgardic',   // was Gardarike
  'PHL': 'Suvarnadvipa',  // unchanged
  'JPN': 'Yamatune',      // was Akitsukuni
  'DEU': 'Teutonine',     // was Austrasien
  'IND': 'Jambudine',         // was Jambudvipa
  'FRA': 'Gallicor',     // was Gallicene
  'KOR': 'Gogurine',      // was Haedong
  'GBR': 'Alvion',        // unchanged
  'AUS': 'Eoranic',       // was Gondwanari
};

for (const [iso3, expected] of Object.entries(v2Countries)) {
  const country = countries.find(c => c.iso3 === iso3);
  if (!country) {
    console.log(`  ✗ NOT FOUND: ${iso3}`);
    errors++;
  } else if (country.shadow !== expected) {
    console.log(`  ✗ WRONG: ${iso3} = "${country.shadow}" (expected "${expected}")`);
    errors++;
  } else {
    console.log(`  ✓ ${iso3} = ${country.shadow}`);
  }
}

// 2. Verify NEW continent names (v2)
console.log('\n2. Checking v2 continent names...');
const v2Continents: Record<string, string> = {
  'IND': 'Sindhara',      // was Uttara
  'CHN': 'Sindhara',      // was Uttara
  'JPN': 'Sindhara',      // was Uttara
  'MEX': 'Cibolar',       // was Anahuac
  'USA': 'Cibolar',       // was Anahuac
  'BRA': 'Chimora',       // was Tahuantin
  'ARG': 'Chimora',       // was Tahuantin
  'SAU': 'Mashriqi',      // was Aram
  'IRN': 'Mashriqi',      // was Aram
  'DEU': 'Abendar',       // unchanged
  'NGA': 'Mero',          // unchanged
  'AUS': 'Pelag',         // unchanged
};

for (const [iso3, expected] of Object.entries(v2Continents)) {
  const country = countries.find(c => c.iso3 === iso3);
  if (!country) {
    console.log(`  ✗ NOT FOUND: ${iso3}`);
    errors++;
  } else if (country.continent !== expected) {
    console.log(`  ✗ WRONG: ${iso3} continent = "${country.continent}" (expected "${expected}")`);
    errors++;
  } else {
    console.log(`  ✓ ${iso3} continent = ${country.continent}`);
  }
}

// 3. Verify continent distribution
console.log('\n3. Checking continent counts...');
const continentCounts: Record<string, number> = {};
for (const country of countries) {
  continentCounts[country.continent] = (continentCounts[country.continent] ?? 0) + 1;
}

const expectedContinents = ['Abendar', 'Sindhara', 'Mero', 'Mashriqi', 'Pelag', 'Cibolar', 'Chimora'];
const oldContinents = ['Hesper', 'Solis', 'Uttara', 'Athar', 'Verd', 'Aram', 'Anahuac', 'Tahuantin'];

for (const expected of expectedContinents) {
  if (continentCounts[expected] && continentCounts[expected] > 0) {
    console.log(`  ✓ ${expected}: ${continentCounts[expected]} countries`);
  } else {
    console.log(`  ✗ MISSING: ${expected}`);
    errors++;
  }
}

for (const old of oldContinents) {
  if (continentCounts[old] && continentCounts[old] > 0) {
    console.log(`  ✗ STILL EXISTS: ${old} (${continentCounts[old]} countries)`);
    errors++;
  }
}

// 4. Verify v2 profiles exist
console.log('\n4. Checking v2 profiles...');
const v2Profiles = [
  'profile:turdetanic',    // was celtiberic
  'profile:quadic',        // was marcomannian
  'profile:meluhhanic',    // was harappic
  'profile:zanjic',        // was sawahili
  'profile:karroidic',     // was khoiveldic
  'profile:ferghanic',     // was sogdian
  'profile:biladic',       // was afranic
];

const vocabProfiles = Object.keys(vocab.microCultureProfiles ?? {});
for (const profile of v2Profiles) {
  if (!vocabProfiles.includes(profile)) {
    console.log(`  ✗ MISSING: ${profile}`);
    errors++;
  } else {
    console.log(`  ✓ ${profile}`);
  }
}

// 5. Verify old problematic profiles are gone
console.log('\n5. Checking old profiles removed...');
const oldProblematicProfiles = [
  'profile:celtiberic',
  'profile:marcomannian',
  'profile:harappic',
  'profile:sawahili',
  'profile:khoiveldic',
  'profile:sogdian',
  'profile:afranic',
];

for (const profile of oldProblematicProfiles) {
  if (vocabProfiles.includes(profile)) {
    console.log(`  ✗ STILL EXISTS: ${profile}`);
    errors++;
  } else {
    console.log(`  ✓ Removed: ${profile}`);
  }
}

// 6. Verify homeCultures updated
console.log('\n6. Checking homeCultures...');
const homeCultures = vocab.identity?.homeCultures ?? [];
const expectedHomeCultures = ['Abendar', 'Sindhara-South', 'Sindhara-East', 'Cibolar-West'];

for (const expected of expectedHomeCultures) {
  if (homeCultures.includes(expected)) {
    console.log(`  ✓ ${expected}`);
  } else {
    console.log(`  ✗ MISSING: ${expected}`);
    errors++;
  }
}

// 7. Generate test agents
console.log('\n7. Generating test agents...');
const testCountries = ['USA', 'CHN', 'RUS', 'JPN', 'IND', 'DEU', 'BRA', 'MEX'];

for (const iso3 of testCountries) {
  try {
    const agent = generateAgent({
      seed: 'v2-verify-' + iso3,
      vocab,
      priors,
      countries,
      asOfYear: 2024,
      homeCountryIso3: iso3,
      includeTrace: true,
    });

    const countryEntry = countries.find(c => c.iso3 === iso3);
    console.log(`  ✓ ${iso3} (${countryEntry?.shadow}): ${agent.identity.name}`);
  } catch (err) {
    console.log(`  ✗ ${iso3}: ERROR - ${err}`);
    errors++;
  }
}

// 8. Data quality checks
console.log('\n8. Checking data quality...');

// Netherlands should be in Abendar (Europe)
const netherlands = countries.find(c => c.iso3 === 'NLD');
if (netherlands?.continent !== 'Abendar') {
  console.log(`  ✗ Netherlands continent = "${netherlands?.continent}" (expected "Abendar")`);
  errors++;
} else {
  console.log(`  ✓ Netherlands in Abendar`);
}

// India description should mention Sindhara
const india = countries.find(c => c.iso3 === 'IND');
if (india?.description?.includes('Cibolar')) {
  console.log(`  ✗ India description still mentions "Cibolar"`);
  errors++;
} else if (india?.description?.includes('Sindhara')) {
  console.log(`  ✓ India description mentions Sindhara`);
} else {
  console.log(`  ? India description doesn't mention any continent`);
}

// Summary
console.log('\n=== Summary ===');
if (errors === 0) {
  console.log('✓ All v2 verifications passed!');
} else {
  console.log(`✗ ${errors} error(s) found`);
  process.exit(1);
}
