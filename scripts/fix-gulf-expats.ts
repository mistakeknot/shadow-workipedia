/**
 * Fix Gulf States expatriate population weights in agent-priors.v1.json
 *
 * Gulf Cooperation Council (GCC) countries have extremely high expatriate populations,
 * dominated by South Asian workers. Current priors vastly undercount these demographics.
 *
 * Real demographic data (2020s):
 * - UAE: ~88% expats (Indians 27%, Pakistanis 12%, Bangladeshis 7%, Filipinos 5%, others)
 * - Qatar: ~88% expats (Indians 25%, Nepalis 16%, Bangladeshis 13%, Filipinos 10%)
 * - Kuwait: ~70% expats (Indians 21%, Egyptians 15%, Bangladeshis 10%, Filipinos 8%)
 * - Bahrain: ~55% expats (Indians 25%, Bangladeshis 10%, Pakistanis 5%)
 * - Oman: ~46% expats (Indians 22%, Bangladeshis 16%, Pakistanis 9%)
 * - Saudi Arabia: ~38% expats (Indians 13%, Bangladeshis 7%, Pakistanis 6%, Egyptians 5%)
 *
 * Sources:
 * - UN Department of Economic and Social Affairs migration data
 * - Gulf Labour Markets and Migration (GLMM) programme
 * - World Bank migration statistics
 * - National statistics bureaus
 *
 * Culture profile mappings:
 * - aramaic: Arab (native Gulf populations)
 * - bharatic: North Indian (Hindi belt)
 * - dravidic: South Indian (Tamil, Malayalam, etc.)
 * - sindhukan: Pakistani
 * - gangetic: Bangladeshi (Bengal region)
 * - gorkhalic: Nepali
 * - maharlikan: Filipino
 * - deshretine: Egyptian
 * - sawahili: East African
 * - nusantaran: Indonesian
 * - parsic: Iranian
 * - alvionic: Western expats (UK, US, etc.)
 * - cosmopolitan: Mixed/global
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Bucket {
  cohortBucketStartYear: number;
  cultureProfileWeights01k?: Record<string, number>;
  [key: string]: unknown;
}

interface Country {
  iso3: string;
  buckets: Record<string, Bucket>;
}

interface Priors {
  version: number;
  generatedAtIso: string;
  sources: unknown[];
  buckets: unknown;
  countries: Record<string, Country>;
}

// Gulf states culture weights by decade
// Values are per-1000 (01k), must sum to ~1000
// Historical progression: expat populations grew significantly from 1970s oil boom onward

const gulfCorrections: Record<string, Record<string, Record<string, number>>> = {
  // UAE - highest expat ratio (~88% in 2020)
  // Pre-oil: small Bedouin/fishing communities, some Iranian traders
  // Post-1971: rapid development attracted massive labor migration
  ARE: {
    '1960': {
      'profile:nabatric': 850,      // Native Emiratis dominant pre-oil
      'profile:mazanic': 100,       // Iranian traders (historical)
      'profile:magadhic': 30,      // Small Indian trader community
      'profile:pandyanic': 20,
    },
    '1970': {
      'profile:nabatric': 650,      // Oil boom beginning
      'profile:mazanic': 80,
      'profile:magadhic': 100,
      'profile:pandyanic': 70,
      'profile:harappic': 50,
      'profile:tyndallic': 50,      // Western oil workers
    },
    '1980': {
      'profile:nabatric': 350,      // Massive construction boom
      'profile:magadhic': 200,
      'profile:pandyanic': 150,
      'profile:harappic': 100,
      'profile:pauravic': 50,
      'profile:katagalugan': 50,
      'profile:mazanic': 40,
      'profile:tyndallic': 40,
      'profile:deshretine': 20,
    },
    '1990': {
      'profile:nabatric': 250,
      'profile:magadhic': 220,
      'profile:pandyanic': 170,
      'profile:harappic': 120,
      'profile:pauravic': 70,
      'profile:katagalugan': 60,
      'profile:mazanic': 35,
      'profile:tyndallic': 35,
      'profile:deshretine': 25,
      'profile:sawahili': 15,
    },
    '2000': {
      'profile:nabatric': 180,
      'profile:magadhic': 230,
      'profile:pandyanic': 180,
      'profile:harappic': 130,
      'profile:pauravic': 80,
      'profile:katagalugan': 60,
      'profile:mazanic': 35,
      'profile:tyndallic': 45,
      'profile:deshretine': 30,
      'profile:sawahili': 15,
      'profile:meridian': 15,
    },
    '2010': {
      'profile:nabatric': 130,      // ~13% Emirati
      'profile:magadhic': 250,     // ~25% Indian (North)
      'profile:pandyanic': 150,     // ~15% Indian (South - Kerala, Tamil Nadu)
      'profile:harappic': 120,    // ~12% Pakistani
      'profile:pauravic': 80,      // ~8% Bangladeshi
      'profile:katagalugan': 60,    // ~6% Filipino
      'profile:licchavic': 30,     // ~3% Nepali
      'profile:mazanic': 30,        // ~3% Iranian
      'profile:tyndallic': 60,      // ~6% Western
      'profile:deshretine': 40,    // ~4% Egyptian/Arab expat
      'profile:sawahili': 20,      // ~2% African
      'profile:nusantaran': 15,    // Indonesian
      'profile:meridian': 15,
    },
    '2020': {
      'profile:nabatric': 120,      // ~12% Emirati (shrinking share)
      'profile:magadhic': 270,     // ~27% Indian (largest group)
      'profile:pandyanic': 140,     // Kerala/Tamil workers
      'profile:harappic': 120,    // ~12% Pakistani
      'profile:pauravic': 70,      // ~7% Bangladeshi
      'profile:katagalugan': 55,    // ~5.5% Filipino
      'profile:licchavic': 35,     // Nepali (growing)
      'profile:mazanic': 25,        // Iranian
      'profile:tyndallic': 70,      // Western expats (Dubai growth)
      'profile:deshretine': 40,    // Egyptian
      'profile:sawahili': 20,
      'profile:nusantaran': 15,
      'profile:meridian': 20,
    },
  },

  // Qatar - also ~88% expat, but different mix (more Nepali)
  QAT: {
    '1960': {
      'profile:nabatric': 900,
      'profile:mazanic': 70,
      'profile:magadhic': 30,
    },
    '1970': {
      'profile:nabatric': 700,
      'profile:magadhic': 100,
      'profile:mazanic': 60,
      'profile:pandyanic': 60,
      'profile:tyndallic': 50,
      'profile:harappic': 30,
    },
    '1980': {
      'profile:nabatric': 400,
      'profile:magadhic': 180,
      'profile:pandyanic': 120,
      'profile:harappic': 80,
      'profile:mazanic': 50,
      'profile:tyndallic': 70,
      'profile:pauravic': 50,
      'profile:katagalugan': 30,
      'profile:deshretine': 20,
    },
    '1990': {
      'profile:nabatric': 300,
      'profile:magadhic': 200,
      'profile:pandyanic': 130,
      'profile:harappic': 90,
      'profile:pauravic': 70,
      'profile:katagalugan': 50,
      'profile:licchavic': 40,
      'profile:tyndallic': 50,
      'profile:mazanic': 35,
      'profile:deshretine': 25,
      'profile:sawahili': 10,
    },
    '2000': {
      'profile:nabatric': 200,
      'profile:magadhic': 210,
      'profile:pandyanic': 130,
      'profile:pauravic': 100,
      'profile:harappic': 80,
      'profile:licchavic': 80,
      'profile:katagalugan': 70,
      'profile:tyndallic': 50,
      'profile:mazanic': 30,
      'profile:deshretine': 30,
      'profile:sawahili': 10,
      'profile:meridian': 10,
    },
    '2010': {
      'profile:nabatric': 140,      // ~14% Qatari
      'profile:magadhic': 200,     // ~20% Indian
      'profile:licchavic': 150,    // ~15% Nepali (WC construction)
      'profile:pauravic': 130,     // ~13% Bangladeshi
      'profile:katagalugan': 100,   // ~10% Filipino
      'profile:pandyanic': 80,
      'profile:harappic': 70,
      'profile:tyndallic': 50,
      'profile:deshretine': 40,
      'profile:mazanic': 20,
      'profile:sawahili': 10,
      'profile:meridian': 10,
    },
    '2020': {
      'profile:nabatric': 120,      // ~12% Qatari
      'profile:magadhic': 220,     // ~22% Indian
      'profile:licchavic': 160,    // ~16% Nepali
      'profile:pauravic': 130,     // ~13% Bangladeshi
      'profile:katagalugan': 100,   // ~10% Filipino
      'profile:pandyanic': 70,
      'profile:harappic': 60,
      'profile:tyndallic': 60,      // Western professionals
      'profile:deshretine': 40,
      'profile:mazanic': 20,
      'profile:sawahili': 10,
      'profile:meridian': 10,
    },
  },

  // Kuwait - ~70% expat (large Egyptian/Arab expat community)
  KWT: {
    '1960': {
      'profile:nabatric': 700,
      'profile:mazanic': 150,       // Iranian traders
      'profile:magadhic': 100,
      'profile:pandyanic': 50,
    },
    '1970': {
      'profile:nabatric': 500,
      'profile:deshretine': 150,   // Egyptian teachers/professionals
      'profile:magadhic': 120,
      'profile:pandyanic': 80,
      'profile:mazanic': 70,
      'profile:harappic': 50,
      'profile:tyndallic': 30,
    },
    '1980': {
      'profile:nabatric': 400,
      'profile:deshretine': 180,
      'profile:magadhic': 140,
      'profile:pandyanic': 80,
      'profile:harappic': 60,
      'profile:mazanic': 50,
      'profile:katagalugan': 40,
      'profile:tyndallic': 30,
      'profile:pauravic': 20,
    },
    '1990': {
      'profile:nabatric': 450,      // Post-Gulf War, many expats left
      'profile:deshretine': 150,
      'profile:magadhic': 130,
      'profile:pandyanic': 70,
      'profile:harappic': 60,
      'profile:katagalugan': 50,
      'profile:mazanic': 40,
      'profile:tyndallic': 30,
      'profile:pauravic': 20,
    },
    '2000': {
      'profile:nabatric': 350,
      'profile:magadhic': 180,
      'profile:deshretine': 130,
      'profile:pandyanic': 80,
      'profile:pauravic': 80,
      'profile:harappic': 60,
      'profile:katagalugan': 60,
      'profile:mazanic': 25,
      'profile:tyndallic': 25,
      'profile:sawahili': 10,
    },
    '2010': {
      'profile:nabatric': 320,      // ~32% Kuwaiti
      'profile:magadhic': 180,     // ~18% Indian
      'profile:deshretine': 120,   // ~12% Egyptian
      'profile:pauravic': 100,     // ~10% Bangladeshi
      'profile:katagalugan': 80,    // ~8% Filipino
      'profile:pandyanic': 60,
      'profile:harappic': 50,
      'profile:mazanic': 30,
      'profile:tyndallic': 30,
      'profile:sawahili': 15,
      'profile:meridian': 15,
    },
    '2020': {
      'profile:nabatric': 300,      // ~30% Kuwaiti
      'profile:magadhic': 210,     // ~21% Indian
      'profile:deshretine': 150,   // ~15% Egyptian
      'profile:pauravic': 100,     // ~10% Bangladeshi
      'profile:katagalugan': 80,    // ~8% Filipino
      'profile:pandyanic': 50,
      'profile:harappic': 40,
      'profile:mazanic': 20,
      'profile:tyndallic': 25,
      'profile:sawahili': 10,
      'profile:meridian': 15,
    },
  },

  // Bahrain - ~55% expat (more integrated, older trade history)
  BHR: {
    '1960': {
      'profile:nabatric': 750,
      'profile:mazanic': 150,       // Long Iranian presence
      'profile:magadhic': 70,
      'profile:pandyanic': 30,
    },
    '1970': {
      'profile:nabatric': 650,
      'profile:mazanic': 120,
      'profile:magadhic': 100,
      'profile:pandyanic': 60,
      'profile:tyndallic': 40,
      'profile:harappic': 30,
    },
    '1980': {
      'profile:nabatric': 550,
      'profile:magadhic': 140,
      'profile:pandyanic': 80,
      'profile:mazanic': 80,
      'profile:harappic': 50,
      'profile:tyndallic': 40,
      'profile:katagalugan': 30,
      'profile:pauravic': 30,
    },
    '1990': {
      'profile:nabatric': 500,
      'profile:magadhic': 160,
      'profile:pandyanic': 90,
      'profile:mazanic': 70,
      'profile:harappic': 50,
      'profile:pauravic': 50,
      'profile:katagalugan': 40,
      'profile:tyndallic': 30,
      'profile:deshretine': 10,
    },
    '2000': {
      'profile:nabatric': 480,
      'profile:magadhic': 170,
      'profile:pandyanic': 90,
      'profile:pauravic': 70,
      'profile:harappic': 50,
      'profile:katagalugan': 50,
      'profile:mazanic': 40,
      'profile:tyndallic': 30,
      'profile:deshretine': 15,
      'profile:meridian': 5,
    },
    '2010': {
      'profile:nabatric': 460,      // ~46% Bahraini
      'profile:magadhic': 180,     // ~18% Indian
      'profile:pandyanic': 90,
      'profile:pauravic': 80,      // ~8% Bangladeshi
      'profile:harappic': 50,     // ~5% Pakistani
      'profile:katagalugan': 50,
      'profile:mazanic': 35,
      'profile:tyndallic': 30,
      'profile:deshretine': 15,
      'profile:meridian': 10,
    },
    '2020': {
      'profile:nabatric': 450,      // ~45% Bahraini
      'profile:magadhic': 200,     // ~20% Indian
      'profile:pandyanic': 80,
      'profile:pauravic': 100,     // ~10% Bangladeshi
      'profile:harappic': 50,
      'profile:katagalugan': 45,
      'profile:mazanic': 30,
      'profile:tyndallic': 25,
      'profile:deshretine': 10,
      'profile:meridian': 10,
    },
  },

  // Oman - ~46% expat (more balanced, slower development)
  OMN: {
    '1960': {
      'profile:nabatric': 900,
      'profile:mazanic': 50,
      'profile:magadhic': 30,
      'profile:sawahili': 20,      // Zanzibar connection
    },
    '1970': {
      'profile:nabatric': 800,
      'profile:magadhic': 80,
      'profile:mazanic': 40,
      'profile:pandyanic': 40,
      'profile:sawahili': 25,
      'profile:tyndallic': 15,
    },
    '1980': {
      'profile:nabatric': 650,
      'profile:magadhic': 130,
      'profile:pandyanic': 70,
      'profile:pauravic': 50,
      'profile:mazanic': 30,
      'profile:harappic': 30,
      'profile:sawahili': 20,
      'profile:tyndallic': 20,
    },
    '1990': {
      'profile:nabatric': 600,
      'profile:magadhic': 150,
      'profile:pandyanic': 80,
      'profile:pauravic': 70,
      'profile:harappic': 35,
      'profile:katagalugan': 25,
      'profile:mazanic': 20,
      'profile:sawahili': 10,
      'profile:tyndallic': 10,
    },
    '2000': {
      'profile:nabatric': 580,
      'profile:magadhic': 160,
      'profile:pauravic': 100,
      'profile:pandyanic': 60,
      'profile:harappic': 35,
      'profile:katagalugan': 30,
      'profile:mazanic': 15,
      'profile:tyndallic': 10,
      'profile:sawahili': 5,
      'profile:meridian': 5,
    },
    '2010': {
      'profile:nabatric': 560,      // ~56% Omani
      'profile:magadhic': 170,     // ~17% Indian
      'profile:pauravic': 120,     // ~12% Bangladeshi
      'profile:pandyanic': 50,
      'profile:harappic': 40,
      'profile:katagalugan': 30,
      'profile:mazanic': 10,
      'profile:tyndallic': 10,
      'profile:sawahili': 5,
      'profile:meridian': 5,
    },
    '2020': {
      'profile:nabatric': 540,      // ~54% Omani
      'profile:magadhic': 180,     // ~18% Indian
      'profile:pauravic': 130,     // ~13% Bangladeshi
      'profile:pandyanic': 50,
      'profile:harappic': 40,
      'profile:katagalugan': 30,
      'profile:mazanic': 10,
      'profile:tyndallic': 10,
      'profile:meridian': 10,
    },
  },

  // Saudi Arabia - ~38% expat (largest absolute numbers due to population)
  SAU: {
    '1960': {
      'profile:nabatric': 950,
      'profile:magadhic': 30,
      'profile:mazanic': 20,
    },
    '1970': {
      'profile:nabatric': 850,
      'profile:deshretine': 50,    // Egyptian professionals
      'profile:magadhic': 40,
      'profile:harappic': 30,
      'profile:mazanic': 20,
      'profile:tyndallic': 10,
    },
    '1980': {
      'profile:nabatric': 700,
      'profile:magadhic': 80,
      'profile:deshretine': 70,
      'profile:harappic': 50,
      'profile:pandyanic': 30,
      'profile:pauravic': 20,
      'profile:katagalugan': 20,
      'profile:mazanic': 15,
      'profile:tyndallic': 15,
    },
    '1990': {
      'profile:nabatric': 680,
      'profile:magadhic': 90,
      'profile:deshretine': 70,
      'profile:harappic': 55,
      'profile:pandyanic': 30,
      'profile:pauravic': 25,
      'profile:katagalugan': 25,
      'profile:mazanic': 10,
      'profile:tyndallic': 15,
    },
    '2000': {
      'profile:nabatric': 660,
      'profile:magadhic': 100,
      'profile:deshretine': 60,
      'profile:harappic': 55,
      'profile:pauravic': 40,
      'profile:pandyanic': 30,
      'profile:katagalugan': 25,
      'profile:tyndallic': 15,
      'profile:mazanic': 10,
      'profile:meridian': 5,
    },
    '2010': {
      'profile:nabatric': 640,      // ~64% Saudi
      'profile:magadhic': 110,     // ~11% Indian
      'profile:pauravic': 60,      // ~6% Bangladeshi
      'profile:harappic': 55,     // ~5.5% Pakistani
      'profile:deshretine': 50,    // ~5% Egyptian
      'profile:pandyanic': 25,
      'profile:katagalugan': 25,
      'profile:tyndallic': 15,
      'profile:mazanic': 10,
      'profile:meridian': 10,
    },
    '2020': {
      'profile:nabatric': 620,      // ~62% Saudi
      'profile:magadhic': 130,     // ~13% Indian
      'profile:pauravic': 70,      // ~7% Bangladeshi
      'profile:harappic': 60,     // ~6% Pakistani
      'profile:deshretine': 50,    // ~5% Egyptian
      'profile:pandyanic': 20,
      'profile:katagalugan': 20,
      'profile:tyndallic': 15,
      'profile:mazanic': 5,
      'profile:meridian': 10,
    },
  },
};

const priorsPath = resolve(__dirname, '../public/agent-priors.v1.json');
const priors: Priors = JSON.parse(readFileSync(priorsPath, 'utf-8'));

console.log('Fixing Gulf States expatriate population weights...\n');

let countriesFixed = 0;
let bucketsFixed = 0;

for (const [iso3, yearWeights] of Object.entries(gulfCorrections)) {
  const country = priors.countries[iso3];
  if (!country) {
    console.log(`Warning: Country ${iso3} not found in priors`);
    continue;
  }

  let countryBucketsFixed = 0;
  for (const [year, newWeights] of Object.entries(yearWeights)) {
    const bucket = country.buckets[year];
    if (bucket) {
      // Verify weights sum to ~1000
      const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
      if (sum < 990 || sum > 1010) {
        console.log(`Warning: ${iso3} ${year} weights sum to ${sum}, not 1000`);
      }
      bucket.cultureProfileWeights01k = newWeights;
      countryBucketsFixed++;
    }
  }

  if (countryBucketsFixed > 0) {
    countriesFixed++;
    bucketsFixed += countryBucketsFixed;
    console.log(`${iso3}: Fixed ${countryBucketsFixed} buckets`);
  }
}

console.log(`\nFixed ${bucketsFixed} buckets across ${countriesFixed} countries\n`);

// Verify some key corrections
console.log('Verification (2020 values - top 5 cultures):');
const verifyCountries = ['ARE', 'QAT', 'KWT', 'SAU'];
for (const iso3 of verifyCountries) {
  const country = priors.countries[iso3];
  if (country) {
    const bucket2020 = country.buckets['2020'];
    if (bucket2020?.cultureProfileWeights01k) {
      const sorted = Object.entries(bucket2020.cultureProfileWeights01k)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => `${k.replace('profile:', '')}:${v}`)
        .join(', ');
      console.log(`  ${iso3}: ${sorted}`);
    }
  }
}

writeFileSync(priorsPath, JSON.stringify(priors, null, 2));
console.log('\nSaved updated priors to', priorsPath);
