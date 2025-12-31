#!/usr/bin/env npx tsx
/**
 * Comprehensive shadow naming overhaul
 *
 * Renames problematic micro-culture profiles, continent names, and country names
 * that are too obvious/academic, applying Gene Wolfe/Miéville style naming:
 * - Oblique references that reward research
 * - Historical depth over linguistic obviousness
 * - Avoiding academic terminology (aramaic, teutonic, etc.)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const projectRoot = resolve(import.meta.dirname, '..');

// ============================================================================
// MICRO-CULTURE PROFILE RENAMES
// ============================================================================
// From academic/linguistic terms to oblique historical/geographic references

const profileRenames: Record<string, string> = {
  // Most problematic - direct academic terms
  'profile:aramaic': 'profile:nabatric',       // Nabataean trading empire
  'profile:bharatic': 'profile:magadhic',     // Maurya Empire reference
  'profile:dravidic': 'profile:pandyanic',      // Sangam literature tradition
  'profile:teutonic': 'profile:marcomannian',     // "Southern" in Latin - oblique
  'profile:slavonic': 'profile:vyatic',        // Vyatichi tribal confederation
  'profile:helladic': 'profile:peloric',   // Thrace + polis blend

  // Moderately problematic
  'profile:gangetic': 'profile:pauravic',      // Vanga kingdom reference
  'profile:parsic': 'profile:mazanic',         // Medes/Mazandarani reference
  'profile:tianlongic': 'profile:huaxiac',  // More oblique

  // Keep but note reasoning:
  // - maharlikan: Already good (Filipino historical term), keeping as-is
  // - sogdian: Excellent (obscure Silk Road reference)
  // - puntic: Good (Punic = Carthaginian)
  // - khoiveldic: Good (Khoisan + veld blend)
};

// ============================================================================
// COUNTRY NAME RENAMES
// ============================================================================
// Most egregious direct references

const countryRenames: Record<string, string> = {
  // Too obvious
  'Tianlong': 'Yanzhou',           // CHN - still referential but less "dragon"
  'Bharatvani': 'Jambudvipa',       // IND - ancient cosmological name
  'Maharlika': 'Suvarnadvipa',          // PHL - blend of island group names
  'Juchevon': 'Chosonri',           // PRK - less ideology-referential

  // Moderately obvious
  'Teutmark': 'Austrasien',         // DEU - Frankish kingdom reference
  'Serendivi': 'Serendivine',         // LKA - ancient Greek name

  // Random/disconnected - make more referential
  'Ichirougan': 'Bajani',           // BRB - Bajan cultural identity
  'Bodhenisle': 'Caimani',          // CYM - closer to etymology
};

// ============================================================================
// MACRO-CULTURE / CONTINENT RENAMES
// ============================================================================
// Note: These appear in vocab.homeCultures and need careful handling

const macroCultureRenames: Record<string, string> = {
  // 'Aram' is from Aramaic/Aramean - too obvious
  // But changing it would be very disruptive. Leaving for now with note.
  // 'Abendar' - Greek evening/west, esoteric enough
  // 'Mero' - Meroë ancient Nubian kingdom, good
  // 'Uttara' - Latin sun, good
  // 'Pelag' - pelagic/oceanic, good
  // 'Anahuac' - need to investigate origin
  // 'Tahuantin' - green (Portuguese verde), good for South America
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function replaceInJson(content: string, oldStr: string, newStr: string): string {
  // Replace as JSON key
  const keyPattern = new RegExp(`"${escapeRegex(oldStr)}"\\s*:`, 'g');
  content = content.replace(keyPattern, `"${newStr}":`);

  // Replace as JSON value
  const valuePattern = new RegExp(`:\\s*"${escapeRegex(oldStr)}"`, 'g');
  content = content.replace(valuePattern, `: "${newStr}"`);

  // Replace in arrays
  const arrayPattern = new RegExp(`"${escapeRegex(oldStr)}"`, 'g');
  content = content.replace(arrayPattern, `"${newStr}"`);

  return content;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('=== Shadow Naming Overhaul ===\n');

  // 1. Update agent-vocab.v1.json
  console.log('1. Updating agent-vocab.v1.json...');
  const vocabPath = resolve(projectRoot, 'public/agent-vocab.v1.json');
  let vocabContent = readFileSync(vocabPath, 'utf-8');

  let vocabChanges = 0;
  for (const [oldName, newName] of Object.entries(profileRenames)) {
    const before = vocabContent;
    vocabContent = replaceInJson(vocabContent, oldName, newName);
    if (vocabContent !== before) {
      console.log(`  ✓ ${oldName} → ${newName}`);
      vocabChanges++;
    }
  }

  // Also rename the languages array entries that match
  const languageRenames: Record<string, string> = {
    'Aramaic': 'Nabatric',
    'Bharatic': 'Mauryanic',
    'Dravidic': 'Sangamic',
    'Teutonic': 'Austronic',
    'Helladic': 'Thracopolic',
    // Languages that remain (they're used in other contexts)
  };

  for (const [oldName, newName] of Object.entries(languageRenames)) {
    const before = vocabContent;
    vocabContent = replaceInJson(vocabContent, oldName, newName);
    if (vocabContent !== before) {
      console.log(`  ✓ Language: ${oldName} → ${newName}`);
      vocabChanges++;
    }
  }

  writeFileSync(vocabPath, vocabContent);
  console.log(`  Total vocab changes: ${vocabChanges}\n`);

  // 2. Update agent-priors.v1.json
  console.log('2. Updating agent-priors.v1.json...');
  const priorsPath = resolve(projectRoot, 'public/agent-priors.v1.json');
  let priorsContent = readFileSync(priorsPath, 'utf-8');

  let priorsChanges = 0;
  for (const [oldName, newName] of Object.entries(profileRenames)) {
    const before = priorsContent;
    priorsContent = replaceInJson(priorsContent, oldName, newName);
    if (priorsContent !== before) {
      priorsChanges++;
    }
  }

  writeFileSync(priorsPath, priorsContent);
  console.log(`  Total priors changes: ${priorsChanges}\n`);

  // 3. Update shadow-country-map.json
  console.log('3. Updating shadow-country-map.json...');
  const countryPath = resolve(projectRoot, 'public/shadow-country-map.json');
  let countryContent = readFileSync(countryPath, 'utf-8');

  let countryChanges = 0;
  for (const [oldName, newName] of Object.entries(countryRenames)) {
    const before = countryContent;
    // Country names are in "shadow" field values
    countryContent = countryContent.replace(
      new RegExp(`"shadow":\\s*"${escapeRegex(oldName)}"`, 'g'),
      `"shadow": "${newName}"`
    );
    if (countryContent !== before) {
      console.log(`  ✓ ${oldName} → ${newName}`);
      countryChanges++;
    }
  }

  writeFileSync(countryPath, countryContent);
  console.log(`  Total country changes: ${countryChanges}\n`);

  // 4. Update any TypeScript files that reference these
  console.log('4. Checking TypeScript files for hardcoded references...');
  const tsFiles = [
    'src/agentGenerator.ts',
    'src/agentNarration.ts',
    'scripts/fix-gulf-expats.ts',
  ];

  let tsChanges = 0;
  for (const relPath of tsFiles) {
    const fullPath = resolve(projectRoot, relPath);
    try {
      let content = readFileSync(fullPath, 'utf-8');
      const before = content;

      // Replace profile references
      for (const [oldName, newName] of Object.entries(profileRenames)) {
        content = content.replace(new RegExp(escapeRegex(oldName), 'g'), newName);
      }

      // Replace country name references
      for (const [oldName, newName] of Object.entries(countryRenames)) {
        content = content.replace(new RegExp(escapeRegex(oldName), 'g'), newName);
      }

      if (content !== before) {
        writeFileSync(fullPath, content);
        console.log(`  ✓ Updated ${relPath}`);
        tsChanges++;
      }
    } catch (e) {
      // File might not exist
    }
  }
  console.log(`  Total TS file changes: ${tsChanges}\n`);

  console.log('=== Summary ===');
  console.log(`Profile renames: ${Object.keys(profileRenames).length}`);
  console.log(`Country renames: ${Object.keys(countryRenames).length}`);
  console.log(`Language renames: ${Object.keys(languageRenames).length}`);
  console.log('\nDone! Run tests to verify.');
}

main();
