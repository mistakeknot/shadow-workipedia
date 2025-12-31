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
      'profile:mauryanic': 30,      // Small Indian trader community
      'profile:sangamic': 20,
    },
    '1970': {
      'profile:nabatric': 650,      // Oil boom beginning
      'profile:mazanic': 80,
      'profile:mauryanic': 100,
      'profile:sangamic': 70,
      'profile:sindhukan': 50,
      'profile:alvionic': 50,      // Western oil workers
    },
    '1980': {
      'profile:nabatric': 350,      // Massive construction boom
      'profile:mauryanic': 200,
      'profile:sangamic': 150,
      'profile:sindhukan': 100,
      'profile:vangalic': 50,
      'profile:maharlikan': 50,
      'profile:mazanic': 40,
      'profile:alvionic': 40,
      'profile:deshretine': 20,
    },
    '1990': {
      'profile:nabatric': 250,
      'profile:mauryanic': 220,
      'profile:sangamic': 170,
      'profile:sindhukan': 120,
      'profile:vangalic': 70,
      'profile:maharlikan': 60,
      'profile:mazanic': 35,
      'profile:alvionic': 35,
      'profile:deshretine': 25,
      'profile:sawahili': 15,
    },
    '2000': {
      'profile:nabatric': 180,
      'profile:mauryanic': 230,
      'profile:sangamic': 180,
      'profile:sindhukan': 130,
      'profile:vangalic': 80,
      'profile:maharlikan': 60,
      'profile:mazanic': 35,
      'profile:alvionic': 45,
      'profile:deshretine': 30,
      'profile:sawahili': 15,
      'profile:cosmopolitan': 15,
    },
    '2010': {
      'profile:nabatric': 130,      // ~13% Emirati
      'profile:mauryanic': 250,     // ~25% Indian (North)
      'profile:sangamic': 150,     // ~15% Indian (South - Kerala, Tamil Nadu)
      'profile:sindhukan': 120,    // ~12% Pakistani
      'profile:vangalic': 80,      // ~8% Bangladeshi
      'profile:maharlikan': 60,    // ~6% Filipino
      'profile:gorkhalic': 30,     // ~3% Nepali
      'profile:mazanic': 30,        // ~3% Iranian
      'profile:alvionic': 60,      // ~6% Western
      'profile:deshretine': 40,    // ~4% Egyptian/Arab expat
      'profile:sawahili': 20,      // ~2% African
      'profile:nusantaran': 15,    // Indonesian
      'profile:cosmopolitan': 15,
    },
    '2020': {
      'profile:nabatric': 120,      // ~12% Emirati (shrinking share)
      'profile:mauryanic': 270,     // ~27% Indian (largest group)
      'profile:sangamic': 140,     // Kerala/Tamil workers
      'profile:sindhukan': 120,    // ~12% Pakistani
      'profile:vangalic': 70,      // ~7% Bangladeshi
      'profile:maharlikan': 55,    // ~5.5% Filipino
      'profile:gorkhalic': 35,     // Nepali (growing)
      'profile:mazanic': 25,        // Iranian
      'profile:alvionic': 70,      // Western expats (Dubai growth)
      'profile:deshretine': 40,    // Egyptian
      'profile:sawahili': 20,
      'profile:nusantaran': 15,
      'profile:cosmopolitan': 20,
    },
  },

  // Qatar - also ~88% expat, but different mix (more Nepali)
  QAT: {
    '1960': {
      'profile:nabatric': 900,
      'profile:mazanic': 70,
      'profile:mauryanic': 30,
    },
    '1970': {
      'profile:nabatric': 700,
      'profile:mauryanic': 100,
      'profile:mazanic': 60,
      'profile:sangamic': 60,
      'profile:alvionic': 50,
      'profile:sindhukan': 30,
    },
    '1980': {
      'profile:nabatric': 400,
      'profile:mauryanic': 180,
      'profile:sangamic': 120,
      'profile:sindhukan': 80,
      'profile:mazanic': 50,
      'profile:alvionic': 70,
      'profile:vangalic': 50,
      'profile:maharlikan': 30,
      'profile:deshretine': 20,
    },
    '1990': {
      'profile:nabatric': 300,
      'profile:mauryanic': 200,
      'profile:sangamic': 130,
      'profile:sindhukan': 90,
      'profile:vangalic': 70,
      'profile:maharlikan': 50,
      'profile:gorkhalic': 40,
      'profile:alvionic': 50,
      'profile:mazanic': 35,
      'profile:deshretine': 25,
      'profile:sawahili': 10,
    },
    '2000': {
      'profile:nabatric': 200,
      'profile:mauryanic': 210,
      'profile:sangamic': 130,
      'profile:vangalic': 100,
      'profile:sindhukan': 80,
      'profile:gorkhalic': 80,
      'profile:maharlikan': 70,
      'profile:alvionic': 50,
      'profile:mazanic': 30,
      'profile:deshretine': 30,
      'profile:sawahili': 10,
      'profile:cosmopolitan': 10,
    },
    '2010': {
      'profile:nabatric': 140,      // ~14% Qatari
      'profile:mauryanic': 200,     // ~20% Indian
      'profile:gorkhalic': 150,    // ~15% Nepali (WC construction)
      'profile:vangalic': 130,     // ~13% Bangladeshi
      'profile:maharlikan': 100,   // ~10% Filipino
      'profile:sangamic': 80,
      'profile:sindhukan': 70,
      'profile:alvionic': 50,
      'profile:deshretine': 40,
      'profile:mazanic': 20,
      'profile:sawahili': 10,
      'profile:cosmopolitan': 10,
    },
    '2020': {
      'profile:nabatric': 120,      // ~12% Qatari
      'profile:mauryanic': 220,     // ~22% Indian
      'profile:gorkhalic': 160,    // ~16% Nepali
      'profile:vangalic': 130,     // ~13% Bangladeshi
      'profile:maharlikan': 100,   // ~10% Filipino
      'profile:sangamic': 70,
      'profile:sindhukan': 60,
      'profile:alvionic': 60,      // Western professionals
      'profile:deshretine': 40,
      'profile:mazanic': 20,
      'profile:sawahili': 10,
      'profile:cosmopolitan': 10,
    },
  },

  // Kuwait - ~70% expat (large Egyptian/Arab expat community)
  KWT: {
    '1960': {
      'profile:nabatric': 700,
      'profile:mazanic': 150,       // Iranian traders
      'profile:mauryanic': 100,
      'profile:sangamic': 50,
    },
    '1970': {
      'profile:nabatric': 500,
      'profile:deshretine': 150,   // Egyptian teachers/professionals
      'profile:mauryanic': 120,
      'profile:sangamic': 80,
      'profile:mazanic': 70,
      'profile:sindhukan': 50,
      'profile:alvionic': 30,
    },
    '1980': {
      'profile:nabatric': 400,
      'profile:deshretine': 180,
      'profile:mauryanic': 140,
      'profile:sangamic': 80,
      'profile:sindhukan': 60,
      'profile:mazanic': 50,
      'profile:maharlikan': 40,
      'profile:alvionic': 30,
      'profile:vangalic': 20,
    },
    '1990': {
      'profile:nabatric': 450,      // Post-Gulf War, many expats left
      'profile:deshretine': 150,
      'profile:mauryanic': 130,
      'profile:sangamic': 70,
      'profile:sindhukan': 60,
      'profile:maharlikan': 50,
      'profile:mazanic': 40,
      'profile:alvionic': 30,
      'profile:vangalic': 20,
    },
    '2000': {
      'profile:nabatric': 350,
      'profile:mauryanic': 180,
      'profile:deshretine': 130,
      'profile:sangamic': 80,
      'profile:vangalic': 80,
      'profile:sindhukan': 60,
      'profile:maharlikan': 60,
      'profile:mazanic': 25,
      'profile:alvionic': 25,
      'profile:sawahili': 10,
    },
    '2010': {
      'profile:nabatric': 320,      // ~32% Kuwaiti
      'profile:mauryanic': 180,     // ~18% Indian
      'profile:deshretine': 120,   // ~12% Egyptian
      'profile:vangalic': 100,     // ~10% Bangladeshi
      'profile:maharlikan': 80,    // ~8% Filipino
      'profile:sangamic': 60,
      'profile:sindhukan': 50,
      'profile:mazanic': 30,
      'profile:alvionic': 30,
      'profile:sawahili': 15,
      'profile:cosmopolitan': 15,
    },
    '2020': {
      'profile:nabatric': 300,      // ~30% Kuwaiti
      'profile:mauryanic': 210,     // ~21% Indian
      'profile:deshretine': 150,   // ~15% Egyptian
      'profile:vangalic': 100,     // ~10% Bangladeshi
      'profile:maharlikan': 80,    // ~8% Filipino
      'profile:sangamic': 50,
      'profile:sindhukan': 40,
      'profile:mazanic': 20,
      'profile:alvionic': 25,
      'profile:sawahili': 10,
      'profile:cosmopolitan': 15,
    },
  },

  // Bahrain - ~55% expat (more integrated, older trade history)
  BHR: {
    '1960': {
      'profile:nabatric': 750,
      'profile:mazanic': 150,       // Long Iranian presence
      'profile:mauryanic': 70,
      'profile:sangamic': 30,
    },
    '1970': {
      'profile:nabatric': 650,
      'profile:mazanic': 120,
      'profile:mauryanic': 100,
      'profile:sangamic': 60,
      'profile:alvionic': 40,
      'profile:sindhukan': 30,
    },
    '1980': {
      'profile:nabatric': 550,
      'profile:mauryanic': 140,
      'profile:sangamic': 80,
      'profile:mazanic': 80,
      'profile:sindhukan': 50,
      'profile:alvionic': 40,
      'profile:maharlikan': 30,
      'profile:vangalic': 30,
    },
    '1990': {
      'profile:nabatric': 500,
      'profile:mauryanic': 160,
      'profile:sangamic': 90,
      'profile:mazanic': 70,
      'profile:sindhukan': 50,
      'profile:vangalic': 50,
      'profile:maharlikan': 40,
      'profile:alvionic': 30,
      'profile:deshretine': 10,
    },
    '2000': {
      'profile:nabatric': 480,
      'profile:mauryanic': 170,
      'profile:sangamic': 90,
      'profile:vangalic': 70,
      'profile:sindhukan': 50,
      'profile:maharlikan': 50,
      'profile:mazanic': 40,
      'profile:alvionic': 30,
      'profile:deshretine': 15,
      'profile:cosmopolitan': 5,
    },
    '2010': {
      'profile:nabatric': 460,      // ~46% Bahraini
      'profile:mauryanic': 180,     // ~18% Indian
      'profile:sangamic': 90,
      'profile:vangalic': 80,      // ~8% Bangladeshi
      'profile:sindhukan': 50,     // ~5% Pakistani
      'profile:maharlikan': 50,
      'profile:mazanic': 35,
      'profile:alvionic': 30,
      'profile:deshretine': 15,
      'profile:cosmopolitan': 10,
    },
    '2020': {
      'profile:nabatric': 450,      // ~45% Bahraini
      'profile:mauryanic': 200,     // ~20% Indian
      'profile:sangamic': 80,
      'profile:vangalic': 100,     // ~10% Bangladeshi
      'profile:sindhukan': 50,
      'profile:maharlikan': 45,
      'profile:mazanic': 30,
      'profile:alvionic': 25,
      'profile:deshretine': 10,
      'profile:cosmopolitan': 10,
    },
  },

  // Oman - ~46% expat (more balanced, slower development)
  OMN: {
    '1960': {
      'profile:nabatric': 900,
      'profile:mazanic': 50,
      'profile:mauryanic': 30,
      'profile:sawahili': 20,      // Zanzibar connection
    },
    '1970': {
      'profile:nabatric': 800,
      'profile:mauryanic': 80,
      'profile:mazanic': 40,
      'profile:sangamic': 40,
      'profile:sawahili': 25,
      'profile:alvionic': 15,
    },
    '1980': {
      'profile:nabatric': 650,
      'profile:mauryanic': 130,
      'profile:sangamic': 70,
      'profile:vangalic': 50,
      'profile:mazanic': 30,
      'profile:sindhukan': 30,
      'profile:sawahili': 20,
      'profile:alvionic': 20,
    },
    '1990': {
      'profile:nabatric': 600,
      'profile:mauryanic': 150,
      'profile:sangamic': 80,
      'profile:vangalic': 70,
      'profile:sindhukan': 35,
      'profile:maharlikan': 25,
      'profile:mazanic': 20,
      'profile:sawahili': 10,
      'profile:alvionic': 10,
    },
    '2000': {
      'profile:nabatric': 580,
      'profile:mauryanic': 160,
      'profile:vangalic': 100,
      'profile:sangamic': 60,
      'profile:sindhukan': 35,
      'profile:maharlikan': 30,
      'profile:mazanic': 15,
      'profile:alvionic': 10,
      'profile:sawahili': 5,
      'profile:cosmopolitan': 5,
    },
    '2010': {
      'profile:nabatric': 560,      // ~56% Omani
      'profile:mauryanic': 170,     // ~17% Indian
      'profile:vangalic': 120,     // ~12% Bangladeshi
      'profile:sangamic': 50,
      'profile:sindhukan': 40,
      'profile:maharlikan': 30,
      'profile:mazanic': 10,
      'profile:alvionic': 10,
      'profile:sawahili': 5,
      'profile:cosmopolitan': 5,
    },
    '2020': {
      'profile:nabatric': 540,      // ~54% Omani
      'profile:mauryanic': 180,     // ~18% Indian
      'profile:vangalic': 130,     // ~13% Bangladeshi
      'profile:sangamic': 50,
      'profile:sindhukan': 40,
      'profile:maharlikan': 30,
      'profile:mazanic': 10,
      'profile:alvionic': 10,
      'profile:cosmopolitan': 10,
    },
  },

  // Saudi Arabia - ~38% expat (largest absolute numbers due to population)
  SAU: {
    '1960': {
      'profile:nabatric': 950,
      'profile:mauryanic': 30,
      'profile:mazanic': 20,
    },
    '1970': {
      'profile:nabatric': 850,
      'profile:deshretine': 50,    // Egyptian professionals
      'profile:mauryanic': 40,
      'profile:sindhukan': 30,
      'profile:mazanic': 20,
      'profile:alvionic': 10,
    },
    '1980': {
      'profile:nabatric': 700,
      'profile:mauryanic': 80,
      'profile:deshretine': 70,
      'profile:sindhukan': 50,
      'profile:sangamic': 30,
      'profile:vangalic': 20,
      'profile:maharlikan': 20,
      'profile:mazanic': 15,
      'profile:alvionic': 15,
    },
    '1990': {
      'profile:nabatric': 680,
      'profile:mauryanic': 90,
      'profile:deshretine': 70,
      'profile:sindhukan': 55,
      'profile:sangamic': 30,
      'profile:vangalic': 25,
      'profile:maharlikan': 25,
      'profile:mazanic': 10,
      'profile:alvionic': 15,
    },
    '2000': {
      'profile:nabatric': 660,
      'profile:mauryanic': 100,
      'profile:deshretine': 60,
      'profile:sindhukan': 55,
      'profile:vangalic': 40,
      'profile:sangamic': 30,
      'profile:maharlikan': 25,
      'profile:alvionic': 15,
      'profile:mazanic': 10,
      'profile:cosmopolitan': 5,
    },
    '2010': {
      'profile:nabatric': 640,      // ~64% Saudi
      'profile:mauryanic': 110,     // ~11% Indian
      'profile:vangalic': 60,      // ~6% Bangladeshi
      'profile:sindhukan': 55,     // ~5.5% Pakistani
      'profile:deshretine': 50,    // ~5% Egyptian
      'profile:sangamic': 25,
      'profile:maharlikan': 25,
      'profile:alvionic': 15,
      'profile:mazanic': 10,
      'profile:cosmopolitan': 10,
    },
    '2020': {
      'profile:nabatric': 620,      // ~62% Saudi
      'profile:mauryanic': 130,     // ~13% Indian
      'profile:vangalic': 70,      // ~7% Bangladeshi
      'profile:sindhukan': 60,     // ~6% Pakistani
      'profile:deshretine': 50,    // ~5% Egyptian
      'profile:sangamic': 20,
      'profile:maharlikan': 20,
      'profile:alvionic': 15,
      'profile:mazanic': 5,
      'profile:cosmopolitan': 10,
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
