import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';

type SubsystemsIndex = {
  patterns?: Array<{
    pattern: string;
    mechanic: string;
    occurrences?: Array<{
      issueId: string;
    }>;
  }>;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function mechanicPageId(pattern: string, mechanic: string): string {
  return `mechanic--${slugify(pattern)}--${slugify(mechanic)}`;
}

function loadYamlIssueIds(parentRepo: string): Set<string> {
  const yamlDir = join(parentRepo, 'data/issues');
  if (!existsSync(yamlDir)) {
    console.error(`❌ Missing issues dir: ${yamlDir}`);
    process.exit(1);
  }

  const ids = new Set<string>();
  const files = readdirSync(yamlDir).filter(f => (f.endsWith('.yml') || f.endsWith('.yaml')) && !f.startsWith('_'));

  for (const file of files) {
    try {
      const doc = yaml.parse(readFileSync(join(yamlDir, file), 'utf8')) as any;
      if (doc?.id && typeof doc.id === 'string') ids.add(doc.id.trim());
    } catch (err) {
      console.warn(`⚠️  Failed parsing ${file}:`, err);
    }
  }

  return ids;
}

function loadDerivedMechanics(parentRepo: string, yamlIssueIds: Set<string>): Map<string, Set<string>> {
  const subsystemsPath = join(parentRepo, 'data/generated/analysis/subsystems.json');
  if (!existsSync(subsystemsPath)) {
    console.error(`❌ Missing subsystems index: ${subsystemsPath}`);
    process.exit(1);
  }

  const raw = readFileSync(subsystemsPath, 'utf8');
  const subsystems = JSON.parse(raw) as SubsystemsIndex;

  const issueToMechanics = new Map<string, Set<string>>();
  for (const p of subsystems.patterns || []) {
    if (!p || typeof p.pattern !== 'string' || typeof p.mechanic !== 'string') continue;
    const mechId = mechanicPageId(p.pattern, p.mechanic);
    for (const occ of p.occurrences || []) {
      if (!occ || typeof occ.issueId !== 'string') continue;
      const issueId = occ.issueId.trim();
      if (!yamlIssueIds.has(issueId)) continue;
      if (!issueToMechanics.has(issueId)) issueToMechanics.set(issueId, new Set());
      issueToMechanics.get(issueId)!.add(mechId);
    }
  }

  return issueToMechanics;
}

function buildMechanicsBlock(mechanicIds: string[]): string {
  if (mechanicIds.length === 0) return 'mechanics: []';
  const lines: string[] = [];
  lines.push('mechanics:');
  for (const id of mechanicIds) lines.push(`  - ${id}`);
  return lines.join('\n');
}

function normalizeExistingMechanics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    out.push(trimmed);
  }
  return out;
}

function upsertMechanicsFrontmatter(fileText: string, mechanicIds: string[]): string {
  if (!fileText.startsWith('---\n')) return fileText;

  const endIdx = fileText.indexOf('\n---', 4);
  if (endIdx === -1) return fileText;

  const fmStart = 4;
  const fmEnd = endIdx + 1; // include trailing newline before '---'
  const fmText = fileText.slice(fmStart, fmEnd);

  const parsed = yaml.parse(fmText) as any;
  const existing = normalizeExistingMechanics(parsed?.mechanics);

  const merged = Array.from(new Set([...existing, ...mechanicIds])).sort((a, b) => a.localeCompare(b));
  const block = buildMechanicsBlock(merged);

  const hasExistingKey = /^\s*mechanics:\s*$/m.test(fmText);
  let nextFmText = fmText;

  if (hasExistingKey) {
    // Replace existing mechanics block (mechanics: plus any following list items)
    nextFmText = nextFmText.replace(
      /^mechanics:\s*\n(?:[ \t]*-\s*[^\n]*\n)*/m,
      `${block}\n`
    );
  } else {
    // Insert mechanics block right before the closing delimiter.
    // Ensure frontmatter ends with a newline.
    const trimmed = nextFmText.endsWith('\n') ? nextFmText : `${nextFmText}\n`;
    nextFmText = `${trimmed}${block}\n`;
  }

  if (nextFmText === fmText) return fileText;
  return `${fileText.slice(0, fmStart)}${nextFmText}${fileText.slice(fmEnd)}`;
}

function main() {
  const repoRoot = process.cwd();
  const parentRepo = join(repoRoot, '..');

  const wikiIssuesDir = join(repoRoot, 'wiki', 'issues');
  if (!existsSync(wikiIssuesDir)) {
    console.error(`❌ Missing wiki issues dir: ${wikiIssuesDir}`);
    process.exit(1);
  }

  const yamlIssueIds = loadYamlIssueIds(parentRepo);
  const derived = loadDerivedMechanics(parentRepo, yamlIssueIds);

  let updated = 0;
  let skipped = 0;
  let missingWiki = 0;

  for (const issueId of Array.from(yamlIssueIds).sort((a, b) => a.localeCompare(b))) {
    const filePath = join(wikiIssuesDir, `${issueId}.md`);
    if (!existsSync(filePath)) {
      missingWiki++;
      continue;
    }

    const raw = readFileSync(filePath, 'utf8');
    const derivedList = Array.from(derived.get(issueId) || []).sort((a, b) => a.localeCompare(b));
    const next = upsertMechanicsFrontmatter(raw, derivedList);
    if (next === raw) {
      skipped++;
      continue;
    }
    writeFileSync(filePath, next, 'utf8');
    updated++;
  }

  console.log('🧰 Backfilled issue mechanics frontmatter');
  console.log(`- YAML issues: ${yamlIssueIds.size}`);
  console.log(`- With derived mechanics from subsystems: ${derived.size}`);
  console.log(`- Updated wiki issue pages: ${updated}`);
  console.log(`- Skipped (already had mechanics): ${skipped}`);
  console.log(`- Missing wiki pages for YAML issues: ${missingWiki}`);
}

main();
