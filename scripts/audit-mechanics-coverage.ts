import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import * as yaml from 'yaml';

function main() {
  const repoRoot = process.cwd();
  const parentRepo = join(repoRoot, '..');

  const yamlDir = join(parentRepo, 'data/issues');
  const wikiIssuesDir = join(repoRoot, 'wiki', 'issues');
  const wikiMechanicsDir = join(repoRoot, 'wiki', 'mechanics');

  if (!existsSync(yamlDir)) {
    console.error(`❌ Missing issues dir: ${yamlDir}`);
    process.exit(1);
  }
  if (!existsSync(wikiIssuesDir)) {
    console.error(`❌ Missing wiki issues dir: ${wikiIssuesDir}`);
    process.exit(1);
  }
  if (!existsSync(wikiMechanicsDir)) {
    console.error(`❌ Missing wiki mechanics dir: ${wikiMechanicsDir}`);
    process.exit(1);
  }

  const yamlIssueIds: string[] = [];
  for (const file of readdirSync(yamlDir)) {
    if (!((file.endsWith('.yml') || file.endsWith('.yaml')) && !file.startsWith('_'))) continue;
    const doc = yaml.parse(readFileSync(join(yamlDir, file), 'utf8')) as any;
    if (doc?.id && typeof doc.id === 'string') yamlIssueIds.push(doc.id.trim());
  }
  yamlIssueIds.sort((a, b) => a.localeCompare(b));

  const mechanicPageIds = new Set(
    readdirSync(wikiMechanicsDir)
      .filter(f => f.endsWith('.md') && !f.includes('_TEMPLATE'))
      .map(f => f.replace(/\.md$/, ''))
  );

  const issueMechanics = new Map<string, string[]>();
  const unknownMechanics = new Map<string, string[]>(); // issueId -> ids not found as mechanic pages
  const issuesMissingWiki: string[] = [];

  for (const issueId of yamlIssueIds) {
    const filePath = join(wikiIssuesDir, `${issueId}.md`);
    if (!existsSync(filePath)) {
      issuesMissingWiki.push(issueId);
      continue;
    }

    const raw = readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const list = Array.isArray((parsed.data as any)?.mechanics) ? (parsed.data as any).mechanics : [];
    const ids = Array.isArray(list)
      ? list.filter((v: unknown): v is string => typeof v === 'string').map(v => v.trim()).filter(Boolean)
      : [];

    const uniques = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
    issueMechanics.set(issueId, uniques);

    const unknown = uniques.filter(id => !mechanicPageIds.has(id));
    if (unknown.length > 0) unknownMechanics.set(issueId, unknown);
  }

  const hasAny = Array.from(issueMechanics.entries()).filter(([, ids]) => ids.length > 0).map(([id]) => id);
  const hasNone = Array.from(issueMechanics.entries()).filter(([, ids]) => ids.length === 0).map(([id]) => id);

  const mechanicUsage = new Map<string, number>();
  for (const ids of issueMechanics.values()) {
    for (const id of ids) mechanicUsage.set(id, (mechanicUsage.get(id) ?? 0) + 1);
  }

  const topMechanics = Array.from(mechanicUsage.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15);

  console.log('🧪 Issue mechanics coverage audit (wiki frontmatter)');
  console.log('-----------------------------------------------');
  console.log(`YAML issues: ${yamlIssueIds.length}`);
  console.log(`Missing wiki pages: ${issuesMissingWiki.length}`);
  console.log(`Issues with ≥1 mechanic: ${hasAny.length}`);
  console.log(`Issues with 0 mechanics: ${hasNone.length}`);
  console.log(`Unique mechanic page ids referenced: ${mechanicUsage.size}`);
  console.log(`Unknown mechanic ids referenced (no page): ${unknownMechanics.size}`);
  console.log('');

  console.log('Top mechanics by issue usage:');
  for (const [id, count] of topMechanics) {
    console.log(`- ${id}  (${count} issues)`);
  }

  if (unknownMechanics.size > 0) {
    console.log('');
    console.log('Issues referencing unknown mechanic ids (first 25):');
    for (const [issueId, ids] of Array.from(unknownMechanics.entries()).slice(0, 25)) {
      console.log(`- ${issueId}: ${ids.join(', ')}`);
    }
  }

  console.log('');
  console.log('Issues with 0 mechanics (first 40):');
  for (const id of hasNone.slice(0, 40)) console.log(`- ${id}`);
  if (hasNone.length > 40) console.log(`…and ${hasNone.length - 40} more`);
}

main();

