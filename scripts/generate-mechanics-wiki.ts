import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

type SubsystemPattern = {
  pattern: string;
  mechanic: string;
};

type SubsystemsIndex = {
  metadata?: Record<string, unknown>;
  patterns?: Array<{
    pattern: string;
    mechanic: string;
  }>;
};

const PARENT_REPO = join(process.cwd(), '..');
const INPUT_PATH = join(PARENT_REPO, 'data/generated/analysis/subsystems.json');
const OUTPUT_DIR = join(process.cwd(), 'wiki', 'mechanics');

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleizeMechanic(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Mechanic';

  const lower = trimmed.toLowerCase();
  if (lower === 'id') return 'ID';

  // Preserve multi-word mechanics as-authored (they often encode sentence case / proper nouns / hyphenation).
  if (trimmed.includes(' ')) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  // Single-token mechanics: normalize casing/spacing.
  if (/^[a-z]+$/.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  // camelCase / PascalCase -> words
  const spaced = trimmed.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced
    .split(' ')
    .map(w => {
      if (!w) return w;
      if (/^[A-Z0-9]{2,}$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

function mechanicId(pattern: string, mechanic: string): string {
  const p = slugify(pattern);
  const m = slugify(mechanic);
  return `mechanic--${p}--${m}`;
}

function isArtifactMechanicId(id: string): boolean {
  const parts = id.split('--');
  const patternSlug = parts[1] ?? '';
  const mechanicSlug = parts.slice(2).join('--');

  const isNumericish = (s: string) => /^\d+[a-z]?$/.test(s) || /^\d{4}s?$/.test(s);
  const isFromRef = (s: string) => s.startsWith('from-');

  return isNumericish(patternSlug) || isNumericish(mechanicSlug) || isFromRef(patternSlug) || isFromRef(mechanicSlug);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function main() {
  if (!existsSync(INPUT_PATH)) {
    console.error(`Mechanics source not found: ${INPUT_PATH}`);
    process.exit(1);
  }

  const raw = readFileSync(INPUT_PATH, 'utf8');
  const data = JSON.parse(raw) as SubsystemsIndex;

  const uniques = new Map<string, SubsystemPattern>(); // keyed by page id
  let collisions = 0;
  for (const m of data.patterns || []) {
    if (!m || typeof m.pattern !== 'string' || typeof m.mechanic !== 'string') continue;
    const id = mechanicId(m.pattern, m.mechanic);
    if (uniques.has(id)) {
      const existing = uniques.get(id)!;
      if (existing.pattern !== m.pattern || existing.mechanic !== m.mechanic) {
        collisions++;
      }
      continue;
    }
    uniques.set(id, { pattern: m.pattern, mechanic: m.mechanic });
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const today = formatDate(new Date());
  let created = 0;
  let skipped = 0;

  for (const [id, { pattern, mechanic }] of uniques.entries()) {
    const filePath = join(OUTPUT_DIR, `${id}.md`);

    if (existsSync(filePath)) {
      skipped++;
      continue;
    }

    const patternSlug = slugify(pattern);
    const title = `${titleizeMechanic(mechanic)} (${patternSlug})`;
    const hidden = isArtifactMechanicId(id);

    const content = `---\n` +
      `id: ${id}\n` +
      `title: ${title}\n` +
      `pattern: ${pattern}\n` +
      `mechanic: ${mechanic}\n` +
      (hidden ? `hidden: true\n` : '') +
      `editedBy: Shadow Work Team\n` +
      `lastUpdated: ${today}\n` +
      `---\n\n` +
      `## Overview\n` +
      `Describe how this mechanic works in the simulation and what it affects.\n\n` +
      `## Notes\n` +
      `Add examples, edge cases, and links to ARCHITECTURE sources.\n`;

    writeFileSync(filePath, content, 'utf8');
    created++;
  }

  console.log(
    `✅ Mechanics pages (from subsystems patterns): created ${created}, skipped ${skipped} (already existed), total ${uniques.size}, collisions ${collisions}`
  );
}

main();
