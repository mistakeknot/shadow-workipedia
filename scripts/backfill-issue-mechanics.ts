import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';
import matter from 'gray-matter';

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

function extractMechanicsFromFrontmatterText(fmText: string): string[] {
  const out: string[] = [];

  // Inline list: mechanics: [a, b]
  const inlineMatches = fmText.matchAll(/^mechanics:\s*\[([^\]]*)\]\s*$/gm);
  for (const m of inlineMatches) {
    const inner = (m[1] ?? '').trim();
    if (!inner) continue;
    for (const part of inner.split(',')) {
      const cleaned = part.trim().replace(/^['"]|['"]$/g, '');
      if (cleaned) out.push(cleaned);
    }
  }

  // Block list:
  // mechanics:
  //   - id
  //   - id
  const blockMatches = fmText.matchAll(/^mechanics:\s*\n((?:[ \t]*-\s*[^\n]*\n)+)/gm);
  for (const m of blockMatches) {
    const block = m[1] ?? '';
    for (const line of block.split('\n')) {
      const mm = line.match(/^\s*-\s*(.+)\s*$/);
      if (!mm) continue;
      const cleaned = mm[1].trim().replace(/^['"]|['"]$/g, '');
      if (cleaned) out.push(cleaned);
    }
  }

  return Array.from(new Set(out.map(s => s.trim()).filter(Boolean)));
}

type MechanicRedirectIndex = {
  redirects: Map<string, string>;
  hidden: Set<string>;
};

function loadMechanicRedirectIndex(repoRoot: string): MechanicRedirectIndex {
  const redirects = new Map<string, string>();
  const hidden = new Set<string>();

  const dir = join(repoRoot, 'wiki', 'mechanics');
  if (!existsSync(dir)) return { redirects, hidden };

  const files = readdirSync(dir).filter(f => f.endsWith('.md') && !f.includes('_TEMPLATE'));
  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf8');
    const parsed = matter(raw);
    const fm = parsed.data as Record<string, any>;
    const id = typeof fm.id === 'string' ? fm.id.trim() : '';
    if (!id) continue;

    if (fm.hidden === true) hidden.add(id);

    const mergedInto = typeof fm.mergedInto === 'string' ? fm.mergedInto.trim() : '';
    if (mergedInto) redirects.set(id, mergedInto);
  }

  // Ensure redirects resolve transitively.
  for (const [from] of redirects) {
    let current = from;
    const visited = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const next = redirects.get(current);
      if (!next || next === current) break;
      if (visited.has(current)) break;
      visited.add(current);
      current = next;
    }
    if (current !== from) redirects.set(from, current);
  }

  return { redirects, hidden };
}

function canonicalizeMechanicId(id: string, redirects: Map<string, string>): string {
  let current = id;
  const visited = new Set<string>();
  for (let i = 0; i < 25; i++) {
    const next = redirects.get(current);
    if (!next || next === current) return current;
    if (visited.has(current)) return current;
    visited.add(current);
    current = next;
  }
  return current;
}

function upsertMechanicsFrontmatter(
  fileText: string,
  derivedMechanicIds: string[],
  redirectIndex: MechanicRedirectIndex
): string {
  if (!fileText.startsWith('---\n')) return fileText;

  const endIdx = fileText.indexOf('\n---', 4);
  if (endIdx === -1) return fileText;

  const fmStart = 4;
  const fmEnd = endIdx + 1; // include trailing newline before '---'
  const fmText = fileText.slice(fmStart, fmEnd);

  const existingRaw = extractMechanicsFromFrontmatterText(fmText);

  const canonicalExisting = existingRaw
    .map(id => canonicalizeMechanicId(id, redirectIndex.redirects))
    .filter(id => !redirectIndex.hidden.has(id));

  const canonicalDerived = derivedMechanicIds
    .map(id => canonicalizeMechanicId(id, redirectIndex.redirects))
    .filter(id => !redirectIndex.hidden.has(id));

  const merged = Array.from(new Set([...canonicalExisting, ...canonicalDerived])).sort((a, b) => a.localeCompare(b));
  const block = buildMechanicsBlock(merged);

  // Remove *all* existing mechanics keys (inline or block) to prevent duplicates.
  let nextFmText = fmText;
  nextFmText = nextFmText.replace(/^mechanics:\s*\[[^\n]*\]\s*$/gm, '');
  nextFmText = nextFmText.replace(/^mechanics:\s*\n(?:[ \t]*-\s*[^\n]*\n)*/gm, '');

  // Trim trailing whitespace/extra blank lines, then append a single canonical block.
  nextFmText = nextFmText.replace(/\s+$/g, '');
  nextFmText = `${nextFmText}\n${block}\n`;

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
  const redirectIndex = loadMechanicRedirectIndex(repoRoot);

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
    const next = upsertMechanicsFrontmatter(raw, derivedList, redirectIndex);
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
