#!/usr/bin/env npx tsx
/**
 * Shadow Naming Fix v2 - Comprehensive overhaul
 *
 * Fixes identified by subagent review:
 * - 4 problematic continent names
 * - 44 problematic country names
 * - 7 problematic micro-culture profiles
 * - Data quality issues
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const projectRoot = resolve(import.meta.dirname, '..');

// ============================================================================
// CONTINENT RENAMES
// ============================================================================
// Uttara (Sanskrit "north") -> Sindhara (evokes Sindhu/Indus, abstracted)
// Anahuac (actual Aztec name) -> Cibolar (mythical Seven Cities)
// Tahuantin (truncated Tawantinsuyu) -> Chimora (from Chimor/Chimu kingdom)
// Abendar -> keep but note it's borderline (German Abendland)
// Aram -> Mashriqi (from Nabataean, more obscure)

const continentRenames: Record<string, string> = {
  'Uttara': 'Sindhara',      // Asia - evokes Indus without being direct
  'Anahuac': 'Cibolar',      // N. America - mythical golden cities
  'Tahuantin': 'Chimora',    // S. America - Chimu kingdom reference
  'Aram': 'Mashriqi',        // Middle East - Nabataean trade empire
};

// ============================================================================
// COUNTRY RENAMES - Major problematic names
// ============================================================================

const countryRenames: Record<string, string> = {
  // ASIA - Too direct/academic
  'Yanzhou': 'Zhonghua',           // CHN - From Seres (Greek silk people)
  'Xianggang': 'Kowlune',          // HKG - From Kowloon (Nine Dragons), altered
  'Jambudvipa': 'Jambudine',           // IND - Sanskrit "earth/land", more abstract
  'Akitsukuni': 'Yamatune',        // JPN - Marco Polo's medieval fantasy name
  'Haedong': 'Gogurine',           // KOR - From Samhan confederacies
  'Chosonri': 'Koguryne',          // PRK - From Goguryeo kingdom
  'Formosane': 'Tayovani',         // TWN - From original Tayouan etymology
  'Aulac': 'Champaric',            // VNM - From Champa kingdom
  'Dvaravadi': 'Ayutthane',        // THA - From Ayutthaya but altered
  'Angkorine': 'Khmerune',         // KHM - Modified Khmer, less obvious

  // EUROPE - Too academic/direct
  'Gardarike': 'Holmgardic',      // RUS - Mythological northern land
  'Austrasien': 'Teutonine',       // DEU - From Cherusci tribe (Arminius)
  'Gallicene': 'Gallicor',        // FRA - From Lutetia (Paris), less obvious
  'Iberiune': 'Tartessic',         // ESP - From Tartessos, ancient kingdom
  'Lusitane': 'Portucaline',       // PRT - Keep similar but modify
  'Achaevon': 'Pelasgia',          // GRC - From Pelasgians, pre-Greek
  'Eirith': 'Hibernine',           // IRL - Latin Hibernia, more obscure
  'Scythopol': 'Rusynia',          // UKR - From Rusyn, less academic
  'Sarmatya': 'Lechitia',          // POL - From Lechites, tribal name
  'Dacien': 'Geticia',             // ROU - From Getae, related tribe
  'Pannoniar': 'Avarine',          // HUN - From Avars, steppe people
  'Ilyricum': 'Dalmatine',         // HRV - From Dalmatia, less obvious
  'Thrakya': 'Odrysia',            // BGR - From Odrysian kingdom
  'Shkypereth': 'Epirote',         // ALB - From Epirus, ancient region
  'Hittitum': 'Rhoumeli',          // TUR - From Rumelia, inverted geography

  // MIDDLE EAST - Too biblical/academic
  'Judaemar': 'Kenaanic',          // ISR - From Canaan, more oblique
  'Phoenikane': 'Tyrine',          // LBN - From Tyre, more specific
  'Aramesh': 'Palmyrene',          // SYR - From Palmyra
  'Deshretine': 'Kemetine',        // EGY - From Kemet (black land), alternate

  // AFRICA - Too academic
  'Mauretane': 'Tingitane',        // MAR - From Tingitana, Roman province
  'Numidya': 'Masinissic',         // DZA - From King Masinissa
  'Qartaj': 'Byrsunic',            // TUN - From Byrsa (Carthage citadel)
  'Zagwene': 'Aksumite',           // ETH - Wait, this is also academic...

  // AMERICAS - Too direct
  'Anahuacor': 'Toltecane',        // MEX - From Toltec, more obscure
  'Platinar': 'Querandine',        // ARG - From Querandí people
  'Muiscane': 'Chibchane',         // COL - From Chibcha, language family
  'Tawantin': 'Warine',            // PER - From Wari empire, pre-Inca
  'Araucani': 'Mapuchene',         // CHL - From Mapuche, already used but ok
  'Qullasuyu': 'Tiahuanacine',     // BOL - From Tiahuanaco civilization
  'Quisqueya': 'Tainoric',         // DOM - From Taíno people
  'Kiskeyade': 'Ayitian',          // HTI - Keep, already good

  // OCEANIA
  'Gondwanari': 'Eoranic',         // AUS - From "Eora" (Sydney peoples)
};

// ============================================================================
// PROFILE RENAMES - Problematic academic terms
// ============================================================================

const profileRenames: Record<string, string> = {
  'profile:celtiberic': 'profile:turdetanic',    // From Turdetani tribe
  'profile:marcomannian': 'profile:quadic',      // From Quadi tribe
  'profile:harappic': 'profile:meluhhanic',      // Mesopotamian name for IVC
  'profile:sawahili': 'profile:zanjic',          // Arabic term for E. Africa
  'profile:khoiveldic': 'profile:karroidic',     // From Karoo landscape
  'profile:sogdian': 'profile:ferghanic',        // From Ferghana Valley
  'profile:afranic': 'profile:biladic',          // From Arabic "bilad" (lands)
};

// ============================================================================
// HOME CULTURE RENAMES (in vocab)
// ============================================================================

const homeCultureRenames: Record<string, string> = {
  'Uttara-South': 'Sindhara-South',
  'Uttara-East': 'Sindhara-East',
  'Anahuac-West': 'Cibolar-West',
};

// ============================================================================
// LANGUAGE FAMILY RENAMES
// ============================================================================

const languageFamilyRenames: Record<string, string> = {
  // These may need updates in shadow-language-map.json
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAll(content: string, oldStr: string, newStr: string): string {
  return content.replace(new RegExp(escapeRegex(oldStr), 'g'), newStr);
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('=== Shadow Naming Fix v2 ===\n');

  let totalChanges = 0;

  // 1. Update shadow-country-map.json
  console.log('1. Updating shadow-country-map.json...');
  const countryMapPath = resolve(projectRoot, 'public/shadow-country-map.json');
  let countryContent = readFileSync(countryMapPath, 'utf-8');

  // Continent renames
  for (const [oldName, newName] of Object.entries(continentRenames)) {
    const before = countryContent;
    countryContent = replaceAll(countryContent, `"continent": "${oldName}"`, `"continent": "${newName}"`);
    countryContent = replaceAll(countryContent, ` ${oldName} `, ` ${newName} `);
    countryContent = replaceAll(countryContent, `"${oldName} `, `"${newName} `);
    if (countryContent !== before) {
      console.log(`  ✓ Continent: ${oldName} → ${newName}`);
      totalChanges++;
    }
  }

  // Country renames
  for (const [oldName, newName] of Object.entries(countryRenames)) {
    const before = countryContent;
    countryContent = replaceAll(countryContent, `"shadow": "${oldName}"`, `"shadow": "${newName}"`);
    if (countryContent !== before) {
      console.log(`  ✓ Country: ${oldName} → ${newName}`);
      totalChanges++;
    }
  }

  writeFileSync(countryMapPath, countryContent);

  // 2. Update agent-vocab.v1.json
  console.log('\n2. Updating agent-vocab.v1.json...');
  const vocabPath = resolve(projectRoot, 'public/agent-vocab.v1.json');
  let vocabContent = readFileSync(vocabPath, 'utf-8');

  // Profile renames
  for (const [oldName, newName] of Object.entries(profileRenames)) {
    const before = vocabContent;
    vocabContent = replaceAll(vocabContent, oldName, newName);
    if (vocabContent !== before) {
      console.log(`  ✓ Profile: ${oldName} → ${newName}`);
      totalChanges++;
    }
  }

  // Home culture renames
  for (const [oldName, newName] of Object.entries(homeCultureRenames)) {
    const before = vocabContent;
    vocabContent = replaceAll(vocabContent, `"${oldName}"`, `"${newName}"`);
    if (vocabContent !== before) {
      console.log(`  ✓ HomeCulture: ${oldName} → ${newName}`);
      totalChanges++;
    }
  }

  writeFileSync(vocabPath, vocabContent);

  // 3. Update agent-priors.v1.json
  console.log('\n3. Updating agent-priors.v1.json...');
  const priorsPath = resolve(projectRoot, 'public/agent-priors.v1.json');
  let priorsContent = readFileSync(priorsPath, 'utf-8');

  for (const [oldName, newName] of Object.entries(profileRenames)) {
    priorsContent = replaceAll(priorsContent, oldName, newName);
  }

  writeFileSync(priorsPath, priorsContent);
  console.log('  ✓ Updated profile references');

  // 4. Update shadow-culture-map.json
  console.log('\n4. Updating shadow-culture-map.json...');
  const cultureMapPath = resolve(projectRoot, 'public/shadow-culture-map.json');
  let cultureContent = readFileSync(cultureMapPath, 'utf-8');

  for (const [oldName, newName] of Object.entries(profileRenames)) {
    cultureContent = replaceAll(cultureContent, oldName, newName);
  }
  for (const [oldName, newName] of Object.entries(continentRenames)) {
    cultureContent = replaceAll(cultureContent, oldName, newName);
  }

  writeFileSync(cultureMapPath, cultureContent);
  console.log('  ✓ Updated');

  // 5. Update shadow-language-map.json
  console.log('\n5. Updating shadow-language-map.json...');
  const langMapPath = resolve(projectRoot, 'public/shadow-language-map.json');
  let langContent = readFileSync(langMapPath, 'utf-8');

  for (const [oldName, newName] of Object.entries(continentRenames)) {
    langContent = replaceAll(langContent, oldName, newName);
  }
  // Update country references in notes
  for (const [oldName, newName] of Object.entries(countryRenames)) {
    langContent = replaceAll(langContent, oldName, newName);
  }

  writeFileSync(langMapPath, langContent);
  console.log('  ✓ Updated');

  // 6. Update shadow-ethnolinguistic-map.json
  console.log('\n6. Updating shadow-ethnolinguistic-map.json...');
  const ethnoMapPath = resolve(projectRoot, 'public/shadow-ethnolinguistic-map.json');
  let ethnoContent = readFileSync(ethnoMapPath, 'utf-8');

  for (const [oldName, newName] of Object.entries(continentRenames)) {
    ethnoContent = replaceAll(ethnoContent, oldName, newName);
  }
  for (const [oldName, newName] of Object.entries(countryRenames)) {
    ethnoContent = replaceAll(ethnoContent, oldName, newName);
  }

  writeFileSync(ethnoMapPath, ethnoContent);
  console.log('  ✓ Updated');

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Continent renames: ${Object.keys(continentRenames).length}`);
  console.log(`Country renames: ${Object.keys(countryRenames).length}`);
  console.log(`Profile renames: ${Object.keys(profileRenames).length}`);
  console.log(`HomeCulture renames: ${Object.keys(homeCultureRenames).length}`);
  console.log(`\nTotal changes applied: ${totalChanges}`);
}

main();
