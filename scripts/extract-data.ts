import { createHash } from 'crypto';
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';
import { marked } from 'marked';
import type { GraphData, GraphNode, GraphEdge, IssueCategory, IssueUrgency, CommunityInfo, PrincipleInfo, DataFlowInfo, PrimitiveName, IssueEvent } from '../src/types';
import { parseSystemWalkTracker, getSystemWalkData } from './parse-system-walks';
import { loadWikiContent, getWikiArticle, type WikiArticle } from './parse-wiki';

const PARENT_REPO = join(process.cwd(), '..');
const OUTPUT_PATH = join(process.cwd(), 'public', 'data.json');
const AGENT_VOCAB_INPUT_PATH = join(PARENT_REPO, 'data/agent-generation/v1/vocab.json');
const AGENT_VOCAB_OUTPUT_PATH = join(process.cwd(), 'public', 'agent-vocab.v1.json');
const AGENT_PRIORS_INPUT_PATH = join(PARENT_REPO, 'data/generated/agent-priors/v1/agent-priors.v1.json');
const AGENT_PRIORS_OUTPUT_PATH = join(process.cwd(), 'public', 'agent-priors.v1.json');
const SHADOW_COUNTRY_MAP_INPUT_PATH = join(PARENT_REPO, 'data', 'country-shadow-map.json');
const SHADOW_COUNTRY_MAP_OUTPUT_PATH = join(process.cwd(), 'public', 'shadow-country-map.json');
const YAML_DATA_DIR = join(PARENT_REPO, 'data/issues');
const COMMUNITIES_DATA_FILE = join(PARENT_REPO, 'data/generated/analysis/communities-with-mechanics.json');
const PRINCIPLES_INDEX_FILE = join(process.cwd(), 'data/principles-index.json');
const DATA_FLOWS_FILE = join(process.cwd(), 'data/system-data-flows.json');
const PRIMITIVES_MAPPING_FILE = join(PARENT_REPO, 'docs/technical/simulation-primitives-mapping.json');

// Color palette for categories (will be used in future extraction logic)
const CATEGORY_COLORS: Record<IssueCategory, string> = {
  Existential: '#dc2626',   // Red-600 - civilization-threatening risks
  Economic: '#3b82f6',
  Social: '#8b5cf6',
  Political: '#ef4444',
  Environmental: '#10b981',
  Security: '#f59e0b',
  Technological: '#06b6d4',
  Cultural: '#ec4899',
  Infrastructure: '#6366f1',
};

const CANONICAL_SYSTEMS = [
  'Civil Conflict',
  'Climate',
  'Culture',
  'Diplomacy',
  'Economy',
  'Education',
  'Geography',
  'Healthcare',
  'Homelessness Crisis Response',
  'Infrastructure',
  'Institutions',
  'International Organizations',
  'Media',
  'Military',
  'Pandemic',
  'Philanthropic Foundations',
  'Politics',
  'Population',
  'Public Finance',
  'Resources',
  'Technology',
  'Trade',
] as const;

type CanonicalSystem = typeof CANONICAL_SYSTEMS[number];

const SYSTEM_ALIASES: Record<string, CanonicalSystem> = {
  // Common abbreviation in legacy content
  'international orgs': 'International Organizations',
  'international org': 'International Organizations',
  // Canonical itself (case-insensitive match handles it too, but keep explicit)
  'international organizations': 'International Organizations',
} as const;

const CANONICAL_SYSTEM_BY_LOWER = new Map<string, CanonicalSystem>(
  CANONICAL_SYSTEMS.map(s => [s.toLowerCase(), s])
);

function canonicalizeSystemLabel(raw: unknown): CanonicalSystem | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;

  const base = trimmed.includes('(') ? trimmed.split('(')[0].trim() : trimmed;
  const lower = base.toLowerCase();

  const alias = SYSTEM_ALIASES[lower];
  if (alias) return alias;

  const direct = CANONICAL_SYSTEM_BY_LOWER.get(lower);
  if (direct) return direct;

  return null;
}

function copyAgentVocab() {
  if (!existsSync(AGENT_VOCAB_INPUT_PATH)) {
    console.warn('⚠️  Agent vocab not found:', AGENT_VOCAB_INPUT_PATH);
    return;
  }
  try {
    const raw = readFileSync(AGENT_VOCAB_INPUT_PATH, 'utf-8');
    // Validate JSON before writing to public/.
    JSON.parse(raw);
    writeFileSync(AGENT_VOCAB_OUTPUT_PATH, raw);
    console.log('🧬 Copied agent vocab →', AGENT_VOCAB_OUTPUT_PATH);
  } catch (err) {
    console.warn('⚠️  Failed to copy agent vocab:', err);
  }
}

function copyAgentPriors() {
  if (!existsSync(AGENT_PRIORS_INPUT_PATH)) {
    console.warn('⚠️  Agent priors not found:', AGENT_PRIORS_INPUT_PATH);
    return;
  }
  try {
    const raw = readFileSync(AGENT_PRIORS_INPUT_PATH, 'utf-8');
    JSON.parse(raw);
    writeFileSync(AGENT_PRIORS_OUTPUT_PATH, raw);
    console.log('🧭 Copied agent priors →', AGENT_PRIORS_OUTPUT_PATH);
  } catch (err) {
    console.warn('⚠️  Failed to copy agent priors:', err);
  }
}

function copyShadowCountryMap() {
  if (!existsSync(SHADOW_COUNTRY_MAP_INPUT_PATH)) {
    console.warn('⚠️  Shadow country map not found:', SHADOW_COUNTRY_MAP_INPUT_PATH);
    return;
  }
  try {
    const sourceRaw = readFileSync(SHADOW_COUNTRY_MAP_INPUT_PATH, 'utf-8');
    const sourceEntries = JSON.parse(sourceRaw) as Array<Record<string, unknown>>;

    // If local file exists with descriptions, preserve them
    if (existsSync(SHADOW_COUNTRY_MAP_OUTPUT_PATH)) {
      const localRaw = readFileSync(SHADOW_COUNTRY_MAP_OUTPUT_PATH, 'utf-8');
      const localEntries = JSON.parse(localRaw) as Array<Record<string, unknown>>;
      const descriptionsByIso3 = new Map<string, string>();

      for (const entry of localEntries) {
        const iso3 = String(entry.iso3 || '').trim();
        const description = typeof entry.description === 'string' ? entry.description : '';
        if (iso3 && description) {
          descriptionsByIso3.set(iso3, description);
        }
      }

      // Merge descriptions into source entries
      for (const entry of sourceEntries) {
        const iso3 = String(entry.iso3 || '').trim();
        const existingDesc = descriptionsByIso3.get(iso3);
        if (existingDesc) {
          entry.description = existingDesc;
        }
      }

      console.log(`🌍 Merged ${descriptionsByIso3.size} descriptions into shadow country map`);
    }

    writeFileSync(SHADOW_COUNTRY_MAP_OUTPUT_PATH, JSON.stringify(sourceEntries, null, 2) + '\n');
    console.log('🌍 Updated shadow country map →', SHADOW_COUNTRY_MAP_OUTPUT_PATH);
  } catch (err) {
    console.warn('⚠️  Failed to copy shadow country map:', err);
  }
}

function normalizeAffectedSystems(rawSystems: unknown): CanonicalSystem[] {
  const list = Array.isArray(rawSystems) ? rawSystems : (rawSystems ? [rawSystems] : []);
  const out: CanonicalSystem[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const canonical = canonicalizeSystemLabel(item);
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
  }
  return out;
}

function stableHash8(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 8);
}

function titleCaseWords(raw: string): string {
  return raw
    .split(/\s+/g)
    .filter(Boolean)
    .map(word => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ');
}

function humanizeKey(raw: string): string {
  const withSpaces = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  return titleCaseWords(withSpaces);
}

function slugify(raw: string): string {
  const normalized = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  return slug || stableHash8(raw);
}

function buildGeneratedWikiArticle(input: {
  id: string;
  title: string;
  type: WikiArticle['type'];
  frontmatter: Record<string, any>;
  contentMd: string;
  lastUpdated?: string;
}): WikiArticle {
  const content = input.contentMd.trim() + '\n';
  const html = marked.parse(content) as string;
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return {
    id: input.id,
    title: input.title,
    type: input.type,
    frontmatter: input.frontmatter,
    content,
    html,
    wordCount,
    lastUpdated: input.lastUpdated || new Date().toISOString().split('T')[0]!,
  };
}

type StringListVocab = { path: string; items: string[] };

function collectStringLists(root: unknown): StringListVocab[] {
  const out: StringListVocab[] = [];

  const skipTopKeys = new Set(['version', 'cultureProfiles', 'microCultureProfiles']);

  const walk = (value: unknown, pathParts: string[]) => {
    if (Array.isArray(value)) {
      if (value.length > 0 && value.every(v => typeof v === 'string')) {
        out.push({ path: pathParts.join('.'), items: value as string[] });
      }
      return;
    }

    if (!value || typeof value !== 'object') return;
    for (const [key, next] of Object.entries(value as Record<string, unknown>)) {
      if (pathParts.length === 0 && skipTopKeys.has(key)) continue;
      walk(next, [...pathParts, key]);
    }
  };

  walk(root, []);
  return out;
}

function generateCountryWikiArticles(): Record<string, WikiArticle> {
  // Read from local output path (which has descriptions) if it exists, otherwise fall back to parent repo
  const countryMapPath = existsSync(SHADOW_COUNTRY_MAP_OUTPUT_PATH) ? SHADOW_COUNTRY_MAP_OUTPUT_PATH : SHADOW_COUNTRY_MAP_INPUT_PATH;
  if (!existsSync(countryMapPath)) return {};
  const raw = readFileSync(countryMapPath, 'utf-8');
  const entries = JSON.parse(raw) as Array<{ real: string; shadow: string; iso3: string; continent?: string; population?: number; description?: string }>;

  const byContinent = new Map<string, Array<(typeof entries)[number]>>();
  for (const entry of entries) {
    const continent = typeof entry.continent === 'string' && entry.continent.trim() ? entry.continent.trim() : 'Unknown';
    const bucket = byContinent.get(continent) ?? [];
    bucket.push(entry);
    byContinent.set(continent, bucket);
  }

  for (const bucket of byContinent.values()) {
    bucket.sort((a, b) => (a.shadow || '').localeCompare(b.shadow || '') || (a.iso3 || '').localeCompare(b.iso3 || ''));
  }

  const continents = Array.from(byContinent.keys()).sort((a, b) => a.localeCompare(b));

  const countryIndexMd = [
    `This is a generated reference view of Shadow Work countries.`,
    ``,
    `- Source: \`data/country-shadow-map.json\``,
    ``,
    `## Continents`,
    ...continents.flatMap(continent => {
      const bucket = byContinent.get(continent) ?? [];
      return [
        ``,
        `### ${continent} (${bucket.length})`,
        ...bucket.map(entry => {
          const iso3 = String(entry.iso3 || '').trim();
          const id = `country-${slugify(iso3)}`;
          const shadow = String(entry.shadow || '').trim() || iso3;
          return `- [${shadow} (${iso3})](#/wiki/${id})`;
        }),
      ];
    }),
    ``,
  ].join('\n');

  const articles: Record<string, WikiArticle> = {};

  articles['countries'] = buildGeneratedWikiArticle({
    id: 'countries',
    title: 'Countries',
    type: 'countryIndex',
    frontmatter: {
      id: 'countries',
      title: 'Countries',
      generated: true,
      sourceRepo: 'vibeguider/shadow-work',
      sourcePath: 'data/country-shadow-map.json',
      lastUpdated: new Date().toISOString().split('T')[0],
    },
    contentMd: countryIndexMd,
  });

  for (const entry of entries) {
    const iso3 = String(entry.iso3 || '').trim();
    if (!iso3) continue;

    const id = `country-${slugify(iso3)}`;
    const shadow = String(entry.shadow || '').trim() || iso3;
    const real = String(entry.real || '').trim() || '';
    const continent = typeof entry.continent === 'string' ? entry.continent.trim() : '';
    const population = typeof entry.population === 'number' && Number.isFinite(entry.population) ? entry.population : null;
    const description = typeof entry.description === 'string' ? entry.description.trim() : '';

    const mdParts = [
      `- **Continent:** ${continent || '—'}`,
      `- **Population:** ${population !== null ? population.toLocaleString() : '—'}`,
      ``,
    ];

    if (description) {
      mdParts.push(description, ``);
    }

    mdParts.push(
      `## Links`,
      `- [All countries](#/wiki/countries)`,
      ``
    );

    const md = mdParts.join('\n');

    articles[id] = buildGeneratedWikiArticle({
      id,
      title: shadow,
      type: 'country',
      frontmatter: {
        id,
        title: shadow,
        generated: true,
        iso3,
        shadow,
        real,
        continent: continent || undefined,
        population: population ?? undefined,
        sourceRepo: 'vibeguider/shadow-work',
        sourcePath: 'data/country-shadow-map.json',
        lastUpdated: new Date().toISOString().split('T')[0],
      },
      contentMd: md,
    });
  }

  return articles;
}

function generateAgentVocabWikiArticles(): Record<string, WikiArticle> {
  if (!existsSync(AGENT_VOCAB_INPUT_PATH)) return {};
  const raw = readFileSync(AGENT_VOCAB_INPUT_PATH, 'utf-8');
  const vocab = JSON.parse(raw) as unknown;

  const lists = collectStringLists(vocab)
    .filter(l => l.path && l.items.length > 0)
    .sort((a, b) => a.path.localeCompare(b.path));

  const listArticles: Record<string, WikiArticle> = {};
  const itemArticles: Record<string, WikiArticle> = {};

  const listIdByPath = new Map<string, string>();
  for (const list of lists) {
    const listId = `vocab-list-${slugify(list.path)}`;
    listIdByPath.set(list.path, listId);

    const leafLabel = humanizeKey(list.path.split('.').slice(-1)[0] || list.path);
    const title = leafLabel;

    const uniqueItems: string[] = [];
    const seen = new Set<string>();
    for (const item of list.items) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      uniqueItems.push(trimmed);
    }

    const md = [
      `- **Path:** \`${list.path}\``,
      `- **Items:** ${uniqueItems.length}`,
      ``,
      `## Items`,
      ``,
      ...uniqueItems.map(item => {
        const itemSlugBase = `${list.path}::${item}`;
        const itemId = `vocab-item-${slugify(list.path)}-${slugify(item)}-${stableHash8(itemSlugBase)}`;
        return `- [${item}](#/wiki/${itemId})`;
      }),
      ``,
      `---`,
      ``,
      `Generated from \`data/agent-generation/v1/vocab.json\`.`,
      ``,
    ].join('\n');

    listArticles[listId] = buildGeneratedWikiArticle({
      id: listId,
      title,
      type: 'vocabList',
      frontmatter: {
        id: listId,
        title,
        generated: true,
        path: list.path,
        itemCount: uniqueItems.length,
        sourceRepo: 'vibeguider/shadow-work',
        sourcePath: 'data/agent-generation/v1/vocab.json',
        lastUpdated: new Date().toISOString().split('T')[0],
      },
      contentMd: md,
    });

    for (const item of uniqueItems) {
      const itemSlugBase = `${list.path}::${item}`;
      const itemId = `vocab-item-${slugify(list.path)}-${slugify(item)}-${stableHash8(itemSlugBase)}`;
      const itemTitle = `${item} (${leafLabel})`;
      const mdItem = [
        `## Value`,
        ``,
        `\`${item}\``,
        ``,
        `## Belongs to`,
        `- [${title}](#/wiki/${listId})`,
        ``,
        `- **Path:** \`${list.path}\``,
        ``,
        `---`,
        ``,
        `Generated from \`data/agent-generation/v1/vocab.json\`.`,
        ``,
      ].join('\n');

      itemArticles[itemId] = buildGeneratedWikiArticle({
        id: itemId,
        title: itemTitle,
        type: 'vocabItem',
        frontmatter: {
          id: itemId,
          title: itemTitle,
          generated: true,
          value: item,
          listPath: list.path,
          listId,
          sourceRepo: 'vibeguider/shadow-work',
          sourcePath: 'data/agent-generation/v1/vocab.json',
          lastUpdated: new Date().toISOString().split('T')[0],
        },
        contentMd: mdItem,
      });
    }
  }

  const byTop = new Map<string, Array<{ path: string; listId: string; title: string }>>();
  for (const [path, listId] of listIdByPath.entries()) {
    const top = path.split('.')[0] || 'root';
    const leafLabel = humanizeKey(path.split('.').slice(-1)[0] || path);
    const title = leafLabel;
    const bucket = byTop.get(top) ?? [];
    bucket.push({ path, listId, title });
    byTop.set(top, bucket);
  }
  for (const bucket of byTop.values()) {
    bucket.sort((a, b) => a.path.localeCompare(b.path));
  }

    const vocabIndexMd = [
      `This is a generated index of the agent generation vocabulary lists and items.`,
      ``,
      `- Source: \`data/agent-generation/v1/vocab.json\``,
      ``,
      `## Vocab Lists`,
    ...Array.from(byTop.keys()).sort().flatMap(top => {
      const bucket = byTop.get(top) ?? [];
      return [
        ``,
        `### ${humanizeKey(top)} (${bucket.length})`,
        ...bucket.map(x => `- [${x.title}](#/wiki/${x.listId})`),
      ];
    }),
    ``,
  ].join('\n');

  const vocabIndex = buildGeneratedWikiArticle({
    id: 'agent-vocab-v1',
    title: 'Agent Vocabulary (v1)',
    type: 'vocabIndex',
    frontmatter: {
      id: 'agent-vocab-v1',
      title: 'Agent Vocabulary (v1)',
      generated: true,
      sourceRepo: 'vibeguider/shadow-work',
      sourcePath: 'data/agent-generation/v1/vocab.json',
      lastUpdated: new Date().toISOString().split('T')[0],
    },
    contentMd: vocabIndexMd,
  });

  return {
    'agent-vocab-v1': vocabIndex,
    ...listArticles,
    ...itemArticles,
  };
}

interface RawIssue {
  id: string;
  name: string;
  categories: IssueCategory[]; // Multi-category support
  urgency: IssueUrgency;
  description: string;
  tags: string[];
  triggerConditions?: string;
  peakYears?: string;
  crisisExamples?: string[];
  evolutionPaths?: string[];
}

interface IssueRedirectIndex {
  issueIdRedirects: Map<string, string>; // alias/merged-id -> canonical-id
  canonicalAliases: Map<string, string[]>; // canonical-id -> aliases[]
  deprecatedIssueIds: Set<string>; // issue ids with mergedInto
}

function normalizePercentLike(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  const scaled = value <= 10 ? value * 10 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function parseIssueCatalog(multiCategoryData: Map<string, IssueCategory[]>): RawIssue[] {
  const catalogPath = join(PARENT_REPO, 'docs/technical/simulation-systems/ISSUE-CATALOG.md');

  if (!existsSync(catalogPath)) {
    console.warn('⚠️  ISSUE-CATALOG.md not found, using mock data');
    return getMockIssues();
  }

  // Load enhanced descriptions (v3-remapped with catalog IDs, 100% coverage)
  const enhancedDescPath = '/tmp/enhanced-descriptions-v3-remapped.json';
  let enhancedDescriptions: Record<string, { description: string }> = {};
  if (existsSync(enhancedDescPath)) {
    enhancedDescriptions = JSON.parse(readFileSync(enhancedDescPath, 'utf-8'));
    console.log(`✅ Loaded ${Object.keys(enhancedDescriptions).length} enhanced descriptions (v3-remapped, 100% catalog coverage)`);
  } else {
    console.warn('⚠️  Enhanced descriptions not found, using crisis examples as fallback');
  }

  const content = readFileSync(catalogPath, 'utf-8');
  const issues: RawIssue[] = [];

  // Split by ##### to find issues
  const lines = content.split('\n');
  let currentCategory: IssueCategory = 'Technological'; // Default fallback (used if no multi-category data)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track current category from #### headers
    if (line.startsWith('#### ')) {
      const categoryText = line.substring(4).trim();
      // Map category names to IssueCategory
      if (categoryText.includes('Technology') || categoryText.includes('Technological')) {
        currentCategory = 'Technological';
      } else if (categoryText.includes('Economic') || categoryText.includes('Financial')) {
        currentCategory = 'Economic';
      } else if (categoryText.includes('Social') || categoryText.includes('Cultural')) {
        currentCategory = 'Social';
      } else if (categoryText.includes('Political') || categoryText.includes('Governance')) {
        currentCategory = 'Political';
      } else if (categoryText.includes('Environmental') || categoryText.includes('Climate')) {
        currentCategory = 'Environmental';
      } else if (categoryText.includes('Security') || categoryText.includes('Conflict')) {
        currentCategory = 'Security';
      } else if (categoryText.includes('Infrastructure') || categoryText.includes('System')) {
        currentCategory = 'Infrastructure';
      }
    }

    // Parse issue headers (##### Issue Name)
    if (line.startsWith('##### ')) {
      const name = line.substring(6).trim();

      // Generate ID from name (kebab-case)
      const id = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Look ahead for metadata and description
      let description = '';
      let urgency: IssueUrgency = 'Medium'; // Default
      let triggerConditions: string | undefined;
      let peakYears: string | undefined;
      const crisisExamples: string[] = [];
      const evolutionPaths: string[] = [];
      let inCrisisExamples = false;
      let inEvolutionPaths = false;

      for (let j = i + 1; j < Math.min(i + 100, lines.length); j++) {
        const nextLine = lines[j].trim();

        // Stop at next issue
        if (nextLine.startsWith('##### ') || nextLine.startsWith('#### ')) {
          break;
        }

        // Extract trigger conditions
        if (nextLine.startsWith('**Trigger Conditions**:')) {
          triggerConditions = nextLine.substring(23).trim();
        }

        // Extract peak years
        if (nextLine.startsWith('**Peak Years**:')) {
          peakYears = nextLine.substring(15).trim();
          // Issues peaking soon are more urgent
          if (peakYears.includes('2024') || peakYears.includes('2025')) {
            urgency = 'Critical';
          } else if (peakYears.includes('202') && parseInt(peakYears.match(/202(\d)/)?.[1] || '9') < 5) {
            urgency = 'High';
          } else if (peakYears.includes('21') || peakYears.includes('22')) {
            urgency = 'Latent';
          }
        }

        // Extract crisis examples
        if (nextLine.startsWith('**Crisis Examples**:')) {
          inCrisisExamples = true;
          inEvolutionPaths = false;
          continue;
        }

        // Extract evolution paths
        if (nextLine.startsWith('**Evolution Paths**:')) {
          inEvolutionPaths = true;
          inCrisisExamples = false;
          continue;
        }

        // Stop collecting examples/paths at next section
        if (nextLine.startsWith('**') && !nextLine.startsWith('- **')) {
          inCrisisExamples = false;
          inEvolutionPaths = false;
        }

        // Collect crisis examples (lines starting with - **)
        if (inCrisisExamples && nextLine.startsWith('- **')) {
          const example = nextLine.substring(4).replace(/\*\*/g, '').trim();
          if (example) crisisExamples.push(example);
        }

        // Collect evolution paths (lines starting with -)
        if (inEvolutionPaths && nextLine.startsWith('- ') && !nextLine.startsWith('- **')) {
          const path = nextLine.substring(2).trim();
          if (path) evolutionPaths.push(path);
        }

        // First non-metadata paragraph is description (simplified)
        // Skip internal references (numbered lists, architecture files, line counts, etc.)
        const isInternalReference =
          /^\d+\.\s+\*\*/.test(nextLine) || // Numbered lists like "1. **46a. 1033 Program"
          /Architecture file:/.test(nextLine) || // Architecture references
          /See architecture:/.test(nextLine) || // Architecture links
          /\.md\]/.test(nextLine) || // Markdown file links
          /~\d+ lines/.test(nextLine) || // Line counts (any variant)
          /\*\*\d+ sub-systems?\*\*/.test(nextLine) || // "**N sub-systems**" or "**N sub-system**"
          /This issue requires/.test(nextLine) || // "This issue requires..."
          /Complete System Walk/.test(nextLine) || // "Complete System Walk with..."
          /^###?\s+/.test(nextLine) || // Markdown headers (### or ##)
          nextLine === name; // Skip if description is just the issue name

        if (!description && nextLine.length > 20 && !nextLine.startsWith('**') && !nextLine.startsWith('-') && !isInternalReference) {
          description = nextLine;
        }
      }

      // Extract tags from name
      const tags = name
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4)
        .slice(0, 3);

      // Use multi-category data if available, otherwise fall back to single category
      const categories = multiCategoryData.get(id) || [currentCategory];

      // Priority: enhanced description > prose description > crisis example > issue name
      let finalDescription = enhancedDescriptions[id]?.description || description;

      if (!finalDescription && crisisExamples.length > 0) {
        // Use first crisis example, clean up the format
        finalDescription = crisisExamples[0]
          .replace(/^[^:]+:\s*/, '') // Remove "Example Name: " prefix
          .trim();
      }
      if (!finalDescription) {
        finalDescription = name; // Last resort: use the issue name
      }

      issues.push({
        id,
        name,
        categories,
        urgency,
        description: finalDescription,
        tags,
        triggerConditions,
        peakYears,
        crisisExamples: crisisExamples.length > 0 ? crisisExamples : undefined,
        evolutionPaths: evolutionPaths.length > 0 ? evolutionPaths : undefined,
      });
    }
  }

  return issues;
}

function getMockIssues(): RawIssue[] {
  // Fallback mock data for development
  return [
    {
      id: 'climate-change-crisis',
      name: 'Climate Change Crisis',
      categories: ['Environmental', 'Political'],
      urgency: 'Critical',
      description: 'Accelerating global warming causing extreme weather and ecosystem collapse.',
      tags: ['climate', 'environment', 'crisis'],
    },
    {
      id: 'ai-job-displacement',
      name: 'AI Job Displacement Tsunami',
      categories: ['Technological', 'Economic', 'Social'],
      urgency: 'High',
      description: 'Rapid automation eliminating millions of jobs across multiple sectors.',
      tags: ['ai', 'employment', 'automation'],
    },
    {
      id: 'wealth-inequality',
      name: 'Extreme Wealth Inequality',
      categories: ['Economic', 'Social'],
      urgency: 'Critical',
      description: 'Growing gap between rich and poor destabilizing economies.',
      tags: ['inequality', 'economics', 'social'],
    },
    {
      id: 'democratic-backsliding',
      name: 'Democratic Backsliding',
      categories: ['Political', 'Social'],
      urgency: 'High',
      description: 'Erosion of democratic institutions and norms worldwide.',
      tags: ['democracy', 'politics', 'governance'],
    },
    {
      id: 'cyber-warfare',
      name: 'Cyber Warfare Escalation',
      categories: ['Security', 'Technological'],
      urgency: 'High',
      description: 'State-sponsored cyber attacks threatening critical infrastructure.',
      tags: ['security', 'cyber', 'warfare'],
    },
  ];
}

function issueToNode(
  issue: RawIssue,
  issueNumber: number,
  curatedMappings: Map<string, string[]>,
  systemWalkMap: Map<string, { issueNumber: number; subsystemCount: number; totalLines: number }>,
  primitivesMapping: Map<string, PrimitiveName[]>,
  slugToNumberMap: Map<string, number>,
  wikiIssueArticles: Map<string, WikiArticle>
): GraphNode {
  const urgencySizes = {
    Critical: 16,
    High: 12,
    Medium: 8,
    Low: 6,
    Latent: 4,
  };

  // Use first category as primary color (will draw border rings for others)
  const primaryCategory = issue.categories[0];

  // Get system walk data for this issue
  const systemWalk = getSystemWalkData(issue.id, issueNumber, PARENT_REPO, systemWalkMap);

  // Get actual issue number from slug-to-number map (built from ARCHITECTURE filenames)
  const realIssueNumber = slugToNumberMap.get(issue.id) ?? issueNumber;

  // Get primitives for this issue number
  const primitives = primitivesMapping.get(String(realIssueNumber));

  const wikiArticle = wikiIssueArticles.get(issue.id);
  const fm = wikiArticle?.frontmatter ?? {};

  const affectedSystems = normalizeAffectedSystems(curatedMappings.get(issue.id) || []);

  return {
    id: issue.id,
    type: 'issue',
    label: issue.name,
    categories: issue.categories,
    urgency: issue.urgency,
    description: issue.description,
    // Deterministic: derived from wiki frontmatter when available, otherwise defaults.
    publicConcern: normalizePercentLike(fm.publicConcern, 70),
    economicImpact: normalizePercentLike(fm.economicImpact, 60),
    socialImpact: normalizePercentLike(fm.socialImpact, 60),
    affectedSystems,
    primitives,
    triggerConditions: issue.triggerConditions,
    peakYears: issue.peakYears,
    crisisExamples: issue.crisisExamples,
    evolutionPaths: issue.evolutionPaths,
    systemWalk,
    color: CATEGORY_COLORS[primaryCategory],
    size: urgencySizes[issue.urgency],
  };
}

/**
 * Create a GraphNode from a wiki article (for wiki-only issues not in catalog)
 */
function wikiArticleToNode(
  article: WikiArticle,
  issueNumber: number,
  curatedMappings: Map<string, string[]>,
  systemWalkMap: Map<string, { issueNumber: number; subsystemCount: number; totalLines: number }>,
  multiCategoryData: Map<string, IssueCategory[]>,
  primitivesMapping: Map<string, PrimitiveName[]>,
  slugToNumberMap: Map<string, number>
): GraphNode {
  const fm = article.frontmatter;

  const urgencySizes: Record<IssueUrgency, number> = {
    Critical: 16,
    High: 12,
    Medium: 8,
    Low: 6,
    Latent: 4,
  };

  // Normalize urgency (frontmatter may have lowercase)
  const rawUrgency = (fm.urgency || 'Medium') as string;
  const urgency: IssueUrgency = (rawUrgency.charAt(0).toUpperCase() + rawUrgency.slice(1).toLowerCase()) as IssueUrgency;

  // Get categories from multi-category data first, then fallback to frontmatter
  let categories: IssueCategory[] = multiCategoryData.get(article.id) || [];
  if (categories.length === 0 && fm.category) {
    // Frontmatter category can be string or array
    const fmCategories = Array.isArray(fm.category) ? fm.category : [fm.category];
    categories = fmCategories.filter((c: string) =>
      ['Existential', 'Economic', 'Social', 'Political', 'Environmental', 'Security', 'Technological', 'Cultural', 'Infrastructure'].includes(c)
    ) as IssueCategory[];
  }
  if (categories.length === 0) {
    categories = ['Technological']; // Default fallback
  }

  const primaryCategory = categories[0];

  // Get system walk data
  const systemWalk = getSystemWalkData(article.id, issueNumber, PARENT_REPO, systemWalkMap);

  // Get affected systems from curated mappings first, then frontmatter
  let affectedSystems = curatedMappings.get(article.id) || [];
  if (affectedSystems.length === 0 && fm.affectedSystems) {
    affectedSystems = Array.isArray(fm.affectedSystems) ? fm.affectedSystems : [fm.affectedSystems];
  }
  const normalizedAffectedSystems = normalizeAffectedSystems(affectedSystems);

  // Get actual issue number from slug-to-number map, fallback to frontmatter number
  const realIssueNumber = slugToNumberMap.get(article.id) ?? (fm.number ? parseInt(fm.number, 10) : null);

  // Get primitives from frontmatter (if added) or mapping
  let primitives: PrimitiveName[] | undefined = fm.primitives as PrimitiveName[] | undefined;
  if (!primitives && realIssueNumber) {
    primitives = primitivesMapping.get(String(realIssueNumber));
  }

  // Convert 0-10 scale to 0-100 if needed
  const publicConcern = normalizePercentLike(fm.publicConcern, 70);
  const economicImpact = normalizePercentLike(fm.economicImpact, 60);
  const socialImpact = normalizePercentLike(fm.socialImpact, 60);

  return {
    id: article.id,
    type: 'issue',
    label: article.title,
    categories,
    urgency,
    description: article.content.substring(0, 500), // First 500 chars as description
    publicConcern,
    economicImpact,
    socialImpact,
    affectedSystems: normalizedAffectedSystems,
    primitives,
    systemWalk,
    hasArticle: true,
    wordCount: article.wordCount,
    color: CATEGORY_COLORS[primaryCategory],
    size: urgencySizes[urgency] || 8,
  };
}

interface ConnectivitySystem {
  name: string;
  connections: number;
}

interface ConnectivityData {
  systems: ConnectivitySystem[];
  edges: Array<{ source: string; target: string; implementation: string; phase: string }>;
}

type CanonicalConnectivityData = {
  systems: Array<{ name: CanonicalSystem; connections: number }>;
  // Preserve implementation/phase as a best-effort label; multiple edges will be merged.
  edges: Array<{ source: CanonicalSystem; target: CanonicalSystem; label: string; strength: number }>;
};

function parseSystemsFromConnectivity(): ConnectivityData {
  const connectivityPath = join(PARENT_REPO, 'docs/technical/simulation-systems/CONNECTIVITY-INDEX.json');

  if (!existsSync(connectivityPath)) {
    console.warn('⚠️  CONNECTIVITY-INDEX.json not found, using mock systems');
    const mockSystems = getMockSystems();
    return { systems: mockSystems, edges: [] };
  }

  const content = readFileSync(connectivityPath, 'utf-8');
  const data = JSON.parse(content);

  // Count connections per system
  const systemConnections = new Map<string, number>();
  const systemEdges: Array<{ source: string; target: string; implementation: string; phase: string }> = [];

  if (data.connections && Array.isArray(data.connections)) {
    for (const edge of data.connections) {
      const source = edge.source;
      const target = edge.target;

      if (source && target) {
        systemConnections.set(source, (systemConnections.get(source) || 0) + 1);
        systemConnections.set(target, (systemConnections.get(target) || 0) + 1);

        // Store edge for later processing
        systemEdges.push({
          source,
          target,
          implementation: edge.implementation || 'Planned',
          phase: edge.phase || 'P0',
        });
      }
    }
  }

  const systems = Array.from(systemConnections.entries()).map(([name, connections]) => ({
    name,
    connections,
  }));

  return { systems, edges: systemEdges };
}

function getMockSystems(): ConnectivitySystem[] {
  return [
    { name: 'Climate', connections: 42 },
    { name: 'Economy', connections: 38 },
    { name: 'Politics', connections: 35 },
    { name: 'Healthcare', connections: 28 },
    { name: 'Technology', connections: 31 },
    { name: 'Education', connections: 22 },
    { name: 'Military', connections: 18 },
    { name: 'Trade', connections: 25 },
  ];
}

function systemToNode(system: ConnectivitySystem): GraphNode {
  // Generate ID from system name (kebab-case)
  const id = system.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // System node color (distinct from issue categories)
  const systemColor = '#64748b'; // Slate gray

  // Size based on connection count (4-20px range)
  const size = Math.min(20, Math.max(6, 6 + system.connections / 10));

  return {
    id,
    type: 'system',
    label: system.name,
    description: `Simulation system with ${system.connections} connections`,
    connectionCount: system.connections,
    domain: 'Simulation',
    color: systemColor,
    size,
  };
}

function canonicalizeConnectivityData(raw: ConnectivityData): CanonicalConnectivityData {
  const systemConnections = new Map<CanonicalSystem, number>();

  for (const s of raw.systems) {
    const canonical = canonicalizeSystemLabel(s.name);
    if (!canonical) {
      console.warn(`⚠️  Unknown system in connectivity index (skipping): ${s.name}`);
      continue;
    }
    systemConnections.set(canonical, (systemConnections.get(canonical) || 0) + (s.connections || 0));
  }

  // Ensure all canonical systems exist as nodes (even if 0 connections),
  // so issue mappings can't accidentally create orphan names.
  for (const s of CANONICAL_SYSTEMS) {
    if (!systemConnections.has(s)) systemConnections.set(s, 0);
  }

  const strengthForLabel = (label: string): number => {
    // Match the old behavior: "Live" > "Partial" > other
    if (label.startsWith('Live')) return 0.8;
    if (label.startsWith('Partial')) return 0.5;
    return 0.3;
  };

  // Merge system-to-system edges after canonicalization to reduce clutter.
  const edgeAgg = new Map<string, { source: CanonicalSystem; target: CanonicalSystem; bestLabel: string; bestStrength: number; count: number }>();

  for (const e of raw.edges) {
    const source = canonicalizeSystemLabel(e.source);
    const target = canonicalizeSystemLabel(e.target);
    if (!source || !target) continue;
    if (source === target) continue;

    const a = source < target ? source : target;
    const b = source < target ? target : source;
    const key = `${a}||${b}`;
    const label = `${e.implementation} (${e.phase})`;
    const strength = strengthForLabel(e.implementation);

    const existing = edgeAgg.get(key);
    if (!existing) {
      edgeAgg.set(key, { source: a, target: b, bestLabel: label, bestStrength: strength, count: 1 });
      continue;
    }

    existing.count += 1;
    if (strength > existing.bestStrength) {
      existing.bestStrength = strength;
      existing.bestLabel = label;
    }
  }

  const edges = Array.from(edgeAgg.values()).map(e => ({
    source: e.source,
    target: e.target,
    label: e.count > 1 ? `${e.bestLabel} +${e.count - 1}` : e.bestLabel,
    strength: e.bestStrength,
  }));

  const systems = Array.from(systemConnections.entries())
    .map(([name, connections]) => ({ name, connections }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { systems, edges };
}

function loadIssueRedirectIndex(): IssueRedirectIndex {
  const issueIdRedirects = new Map<string, string>();
  const canonicalAliases = new Map<string, string[]>();
  const deprecatedIssueIds = new Set<string>();

  if (!existsSync(YAML_DATA_DIR)) {
    console.warn('⚠️  YAML data directory not found, returning empty redirect index');
    return { issueIdRedirects, canonicalAliases, deprecatedIssueIds };
  }

  const yamlFiles = readdirSync(YAML_DATA_DIR).filter(f => f.endsWith('.yaml') && !f.startsWith('_'));

  for (const file of yamlFiles) {
    try {
      const content = readFileSync(join(YAML_DATA_DIR, file), 'utf-8');
      const data = yaml.parse(content);

      const id = typeof data?.id === 'string' ? data.id.trim() : '';
      if (!id) continue;

      const mergedInto = typeof data?.mergedInto === 'string' ? data.mergedInto.trim() : '';
      if (mergedInto && mergedInto !== id) {
        deprecatedIssueIds.add(id);
        // Deprecated id redirects to canonical
        issueIdRedirects.set(id, mergedInto);
      }

      if (Array.isArray(data?.aliases)) {
        const aliases = data.aliases
          .filter((a: any) => typeof a === 'string')
          .map((a: string) => a.trim())
          .filter((a: string) => a.length > 0 && a !== id);

        if (aliases.length > 0) {
          canonicalAliases.set(id, Array.from(new Set(aliases)));
        }

        for (const alias of aliases) {
          // First-wins; collisions are better handled in `pnpm data:validate`
          if (!issueIdRedirects.has(alias)) {
            issueIdRedirects.set(alias, id);
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️  Error parsing redirects from ${file}:`, err);
    }
  }

  // Add a second pass: if an issue is deprecated (mergedInto) and no explicit alias
  // points to the canonical, ensure the deprecated ID resolves deterministically.
  for (const deprecatedId of deprecatedIssueIds) {
    const canonical = issueIdRedirects.get(deprecatedId);
    if (canonical && canonical !== deprecatedId) {
      issueIdRedirects.set(deprecatedId, canonical);
    }
  }

  console.log(
    `🔁 Loaded issue redirects: ${issueIdRedirects.size} redirect keys, ${deprecatedIssueIds.size} merged issues`
  );

  return { issueIdRedirects, canonicalAliases, deprecatedIssueIds };
}

function resolveIssueId(id: string, redirects: Map<string, string>): string {
  let current = id;
  const visited = new Set<string>();
  for (let i = 0; i < 25; i++) {
    const next = redirects.get(current);
    if (!next || next === current) return current;
    if (visited.has(current)) {
      console.warn(`⚠️  Redirect cycle detected for '${id}' (stuck at '${current}')`);
      return current;
    }
    visited.add(current);
    current = next;
  }
  console.warn(`⚠️  Redirect chain too deep for '${id}', last='${current}'`);
  return current;
}

function loadCuratedConnections(): Map<string, Array<{targetId: string, relationshipType: string, strength: number}>> {
  const connectionMap = new Map<string, Array<{targetId: string, relationshipType: string, strength: number}>>();

  // Read connections from YAML files in data/issues/
  if (!existsSync(YAML_DATA_DIR)) {
    console.warn('⚠️  YAML data directory not found, returning empty map');
    return connectionMap;
  }

  const yamlFiles = readdirSync(YAML_DATA_DIR).filter(f => f.endsWith('.yaml') && !f.startsWith('_'));

  for (const file of yamlFiles) {
    try {
      const content = readFileSync(join(YAML_DATA_DIR, file), 'utf-8');
      const data = yaml.parse(content);

      if (data.id && data.connections && Array.isArray(data.connections) && data.connections.length > 0) {
        const connections = data.connections.map((conn: { target: string; relationship?: string; strength?: number }) => ({
          targetId: conn.target,
          relationshipType: conn.relationship || 'correlates',
          strength: conn.strength || 0.5
        }));
        connectionMap.set(data.id, connections);
      }
    } catch (err) {
      console.warn(`⚠️  Error parsing ${file}:`, err);
    }
  }

  return connectionMap;
}

/**
 * Load events from YAML issue files
 * Returns a map of issue ID to array of events
 */
function loadIssueEvents(): Map<string, IssueEvent[]> {
  const eventsMap = new Map<string, IssueEvent[]>();

  if (!existsSync(YAML_DATA_DIR)) {
    console.warn('⚠️  YAML data directory not found, returning empty events map');
    return eventsMap;
  }

  const yamlFiles = readdirSync(YAML_DATA_DIR).filter(f => f.endsWith('.yaml') && !f.startsWith('_'));

  for (const file of yamlFiles) {
    try {
      const content = readFileSync(join(YAML_DATA_DIR, file), 'utf-8');
      const data = yaml.parse(content);

      if (data.id && data.events && Array.isArray(data.events) && data.events.length > 0) {
        const events: IssueEvent[] = data.events
          .filter((e: any) => e.id && e.name && e.description)
          .map((e: any) => ({
            id: e.id,
            name: e.name,
            description: e.description.trim()
          }));

        if (events.length > 0) {
          eventsMap.set(data.id, events);
        }
      }
    } catch (err) {
      // Silently skip malformed files
    }
  }

  return eventsMap;
}

function extractIssueEdges(
  issues: RawIssue[],
  wikiSlugs: Set<string> | undefined,
  resolve: (id: string) => string
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  // Load curated human-reviewed connections
  const curatedConnections = loadCuratedConnections();
  console.log(`📋 Loaded ${curatedConnections.size} issues with curated connections`);

  // Use wiki slugs for validation if provided, otherwise fall back to catalog IDs
  const catalogIds = new Set(issues.map(i => i.id));
  const validTargets = wikiSlugs || catalogIds;

  // Create edges from curated connections
  for (const issue of issues) {
    const connections = curatedConnections.get(issue.id);

    if (!connections || connections.length === 0) {
      continue;
    }

    for (const conn of connections) {
      const canonicalTarget = resolve(conn.targetId);

      // Verify target exists in wiki articles (or catalog as fallback)
      if (!validTargets.has(canonicalTarget)) {
        console.warn(`⚠️  Target issue "${conn.targetId}" (→ "${canonicalTarget}") not found for "${issue.id}"`);
        continue;
      }

      if (canonicalTarget === issue.id) continue;

      edges.push({
        source: issue.id,
        target: canonicalTarget,
        type: 'issue-issue',
        strength: conn.strength || 0.5,
        label: conn.relationshipType,
        bidirectional: false,
      });
    }
  }

  return edges;
}

function loadCuratedMappings(): Map<string, string[]> {
  const mappingsPath = join(process.cwd(), 'issue-system-mappings.json');

  if (!existsSync(mappingsPath)) {
    console.warn('⚠️  Curated mappings not found, returning empty map');
    return new Map();
  }

  const content = readFileSync(mappingsPath, 'utf-8');
  const data = JSON.parse(content);

  const mappingMap = new Map<string, string[]>();

  if (data.mappings && Array.isArray(data.mappings)) {
    for (const mapping of data.mappings) {
      const normalized = normalizeAffectedSystems(mapping.systems);
      mappingMap.set(mapping.issueId, normalized);
    }
  }

  return mappingMap;
}

function loadMultiCategoryData(): Map<string, IssueCategory[]> {
  const multiCategoryPath = join(process.cwd(), 'multi-category-all-issues.json');

  if (!existsSync(multiCategoryPath)) {
    console.warn('⚠️  Multi-category data not found, returning empty map');
    return new Map();
  }

  const content = readFileSync(multiCategoryPath, 'utf-8');
  const data = JSON.parse(content);

  const categoryMap = new Map<string, IssueCategory[]>();

  if (data.recategorizations && Array.isArray(data.recategorizations)) {
    for (const recat of data.recategorizations) {
      categoryMap.set(recat.issueId, recat.categories);
    }
  }

  return categoryMap;
}

interface CommunityMember {
  id: string;
  title: string;
  number: string;
  isBridge: boolean;
  betweenness: number;
}

interface SharedMechanic {
  pattern: string;
  mechanic: string;
  count: number;
  percentage: number;
  issues: string[];
}

interface CommunityData {
  id: number;
  originalId: number;
  splitReason?: string;
  mergedFrom?: number[];
  size: number;
  members: CommunityMember[];
  stats: {
    avgStrength: number;
    topCategories: Array<{ category: string; count: number }>;
    topTags: Array<{ tag: string; count: number }>;
  };
  sharedMechanics: SharedMechanic[];
  mechanicScore: number;
}

function loadCommunityData(): {
  communityMap: Map<string, { communityId: number; label: string; isBridge: boolean }>;
  communities: Record<number, CommunityInfo>;
} {
  if (!existsSync(COMMUNITIES_DATA_FILE)) {
    console.warn('⚠️  Community data not found, returning empty map');
    return { communityMap: new Map(), communities: {} };
  }

  const content = readFileSync(COMMUNITIES_DATA_FILE, 'utf-8');
  const data = JSON.parse(content);

  const communityMap = new Map<string, { communityId: number; label: string; isBridge: boolean }>();
  const communities: Record<number, CommunityInfo> = {};

  if (data.communities && Array.isArray(data.communities)) {
    for (const community of data.communities as CommunityData[]) {
      // Generate community label
      const topCategory = community.stats.topCategories[0]?.category || 'Mixed';
      const topTags = community.stats.topTags.slice(0, 2).map(t => t.tag).join(', ');
      const label = `${topCategory} (${topTags})`;

      // Store community info
      communities[community.id] = {
        id: community.id,
        size: community.size,
        label,
        topCategory,
        mechanicScore: community.mechanicScore,
        sharedMechanics: community.sharedMechanics,
      };

      // Map each member to their community
      for (const member of community.members) {
        communityMap.set(member.id, {
          communityId: community.id,
          label,
          isBridge: member.isBridge,
        });
      }
    }
  }

  return { communityMap, communities };
}

interface ExtractedPrinciple {
  id: string;
  name: string;
  system: string;
  sourceFile: string;
  thresholdCount: number;
}

function loadPrinciplesData(): { principles: PrincipleInfo[]; nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!existsSync(PRINCIPLES_INDEX_FILE)) {
    console.warn('⚠️  Principles index not found. Run extract-principles.ts first.');
    return { principles: [], nodes: [], edges: [] };
  }

  const content = readFileSync(PRINCIPLES_INDEX_FILE, 'utf-8');
  const data = JSON.parse(content);

  const principles: PrincipleInfo[] = [];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Principle node color (distinct from issues/systems)
  const principleColor = '#f59e0b'; // Amber-500

  // Hub systems (SW#01-13) map to system nodes, not issues
  const hubSystemMap: Record<string, string> = {
    'climate': 'climate',
    'technology': 'technology',
    'diplomacy': 'diplomacy',
    'economy': 'economy',
    'population': 'population',
    'pandemic': 'pandemic',
    'water-conflict-unified': 'resources', // Map to resources system
    'infrastructure': 'infrastructure',
    'education': 'education',
    'politics': 'politics',
    'culture': 'culture',
    'institutions': 'institutions',
  };

  if (data.principles && Array.isArray(data.principles)) {
    for (const p of data.principles as ExtractedPrinciple[]) {
      // Create PrincipleInfo
      principles.push({
        id: p.id,
        name: p.name,
        description: '', // Will be loaded from wiki article
        sourceSystem: p.system,
        sourceFile: p.sourceFile || '',
        thresholds: [],
        relatedPrinciples: [],
        systems: [],
      });

      // Create GraphNode for visualization
      nodes.push({
        id: p.id,
        type: 'principle',
        label: p.name,
        description: p.system,
        sourceSystem: p.system,
        thresholds: [],
        color: principleColor,
        size: Math.min(12, 6 + p.thresholdCount), // Size based on threshold count
      });

      // Extract target from sourceFile (e.g., "44-climate-insurance-collapse-ARCHITECTURE.md")
      const fileMatch = p.sourceFile?.match(/^(\d+[a-z]?)-(.+)-ARCHITECTURE\.md$/);
      if (fileMatch) {
        const swNumber = fileMatch[1];
        const slugPart = fileMatch[2]; // Already kebab-case from filename

        // Check if this is a hub system (SW#01-13, single or double digit without letter)
        const isHubSystem = /^(0[1-9]|1[0-3])$/.test(swNumber);

        if (isHubSystem && hubSystemMap[slugPart]) {
          // Connect to system node
          edges.push({
            source: p.id,
            target: hubSystemMap[slugPart],
            type: 'principle-system',
            strength: 0.4,
            directed: false,
          });
        } else {
          // Connect to issue node
          edges.push({
            source: p.id,
            target: slugPart,
            type: 'principle-issue',
            strength: 0.3,
            directed: false,
          });
        }
      }
    }
  }

  return { principles, nodes, edges };
}

/**
 * Build a mapping from SW# numbers to issue/system slugs
 * Parses ARCHITECTURE filenames like "01-climate-ARCHITECTURE.md" → "01" → "climate"
 */
function buildSwNumberToSlugMap(): Map<string, string> {
  const archDir = join(PARENT_REPO, 'docs/technical/simulation-systems');
  const map = new Map<string, string>();

  if (!existsSync(archDir)) {
    console.warn('⚠️  ARCHITECTURE directory not found');
    return map;
  }

  const setMapping = (num: string, slug: string, overwrite = false) => {
    if (!num || !slug) return;
    if (overwrite || !map.has(num)) {
      map.set(num, slug);
    }
    const normalized = num.replace(/^0+/, '') || '0';
    if (normalized !== num && (overwrite || !map.has(normalized))) {
      map.set(normalized, slug);
    }
  };

  const files = readdirSync(archDir).filter(f => f.endsWith('-ARCHITECTURE.md'));

  for (const file of files) {
    // Parse filename: "01-climate-ARCHITECTURE.md" → num="01", slug="climate"
    const match = file.match(/^(\d+[a-z]?)-(.+)-ARCHITECTURE\.md$/);
    if (match) {
      const [, num, slug] = match;
      // Prefer ARCHITECTURE filename mappings (canonical for hub systems)
      setMapping(num, slug);
    }
  }

  // Hub systems (SW#01-13) are system nodes, not issue nodes.
  // Map them to the system IDs used in the explorer graph.
  const hubSystemSlugToNodeId: Record<string, string> = {
    climate: 'climate',
    technology: 'technology',
    diplomacy: 'diplomacy',
    economy: 'economy',
    population: 'population',
    pandemic: 'pandemic',
    'water-conflict-unified': 'resources',
    infrastructure: 'infrastructure',
    education: 'education',
    politics: 'politics',
    culture: 'culture',
    institutions: 'institutions',
  };

  for (const [num, slug] of map.entries()) {
    // Match SW#01-13 without letter suffix.
    if (/^(0[1-9]|1[0-3])$/.test(num)) {
      const systemId = hubSystemSlugToNodeId[slug];
      if (systemId) {
        setMapping(num, systemId, true);
      }
    }
  }

  // Non-hub systems referenced by System Walk numbers (used by data flows).
  // These are systems in the explorer graph (CONNECTIVITY-INDEX), not issues.
  const systemWalkNumberToSystemNodeId: Record<string, string> = {
    '15': 'public-finance',
    '16': 'institutions-legal-evidence',
  };
  for (const [num, systemId] of Object.entries(systemWalkNumberToSystemNodeId)) {
    setMapping(num, systemId, true);
  }

  // If ISSUE-CATALOG includes a system-walk number that corresponds to a fully-architected issue,
  // prefer the catalog-derived issue slug (it matches wiki/YAML IDs more often than filename slugs).
  // We *only* apply this when the line indicates "Complete architecture" to avoid collisions with
  // completion-order annotations that aren't stable identifiers.
  const issueCatalogPath = join(PARENT_REPO, 'docs/technical/simulation-systems/ISSUE-CATALOG.md');
  if (existsSync(issueCatalogPath)) {
    try {
      const content = readFileSync(issueCatalogPath, 'utf-8');
      const lines = content.split('\n');
      let currentIssueId: string | null = null;

      for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line.startsWith('##### ')) {
          const name = line.substring(6).trim();
          const id = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          currentIssueId = id;
          continue;
        }

        if (!currentIssueId) continue;

        if (/system walk #/i.test(line) && /complete architecture/i.test(line)) {
          const m = line.match(/System Walk #(\d+[a-z]?)/i);
          if (m) {
            setMapping(m[1], currentIssueId, true);
          }
        }
      }
    } catch {
      // Ignore parse failures
    }
  }

  // Also include YAML issue mappings (covers issues without ARCHITECTURE files)
  // `number` can be integer, "SW#081", or "081" depending on file.
  if (existsSync(YAML_DATA_DIR)) {
    const yamlFiles = readdirSync(YAML_DATA_DIR).filter(f => f.endsWith('.yaml') && !f.startsWith('_'));
    for (const file of yamlFiles) {
      try {
        const doc = yaml.parse(readFileSync(join(YAML_DATA_DIR, file), 'utf-8'));
        const slug = doc?.id;
        const rawNumber = doc?.number;
        if (typeof slug !== 'string' || slug.trim().length === 0) continue;

        let num: string | null = null;
        if (typeof rawNumber === 'number') {
          num = String(rawNumber);
        } else if (typeof rawNumber === 'string') {
          const swMatch = rawNumber.match(/^SW#(\d+[a-z]?)$/i);
          if (swMatch) {
            num = swMatch[1];
          } else {
            const plainMatch = rawNumber.match(/^(\d+[a-z]?)$/i);
            if (plainMatch) {
              num = plainMatch[1];
            }
          }
        }

        if (num) {
          setMapping(num, slug);
        }
      } catch {
        // Skip malformed YAML
      }
    }
  }

  return map;
}

function loadDataFlows(resolveIssueIdForEdges?: (id: string) => string): { dataFlows: DataFlowInfo[]; edges: GraphEdge[] } {
  if (!existsSync(DATA_FLOWS_FILE)) {
    console.warn('⚠️  Data flows file not found. Run extract-principles.ts first.');
    return { dataFlows: [], edges: [] };
  }

  const content = readFileSync(DATA_FLOWS_FILE, 'utf-8');
  const data = JSON.parse(content);

  // Build SW# → slug mapping
  const swMap = buildSwNumberToSlugMap();
  console.log(`🗺️  Built SW# mapping with ${swMap.size} entries`);

  const dataFlows: DataFlowInfo[] = [];
  const edges: GraphEdge[] = [];

  // Helper to convert SW#XX to slug
  const swToSlug = (swRef: string): string | null => {
    // Extract number from "SW#01", "SW#1", "SW#420", etc.
    const match = swRef.match(/^SW#(\d+[a-z]?)$/i);
    if (!match) return null;
    const num = match[1];
    return swMap.get(num) || swMap.get(String(parseInt(num, 10))) || null;
  };

  if (data.flows && Array.isArray(data.flows)) {
    // Deduplicate flows
    const seenFlows = new Set<string>();
    let skippedCount = 0;

    for (const flow of data.flows) {
      const flowKey = `${flow.source}->${flow.target}:${flow.direction}`;
      if (seenFlows.has(flowKey)) continue;
      seenFlows.add(flowKey);

      // Convert SW# references to slugs
      const sourceSlug = swToSlug(flow.source);
      const targetSlug = swToSlug(flow.target);

      if (!sourceSlug || !targetSlug) {
        skippedCount++;
        continue;
      }

      dataFlows.push({
        source: flow.source,
        target: flow.target,
        direction: flow.direction,
        data: flow.data || [],
      });

      // Create directed edge with proper slug IDs
      const resolvedSource = resolveIssueIdForEdges ? resolveIssueIdForEdges(sourceSlug) : sourceSlug;
      const resolvedTarget = resolveIssueIdForEdges ? resolveIssueIdForEdges(targetSlug) : targetSlug;

      if (resolvedSource === resolvedTarget) {
        skippedCount++;
        continue;
      }

      edges.push({
        source: resolvedSource,
        target: resolvedTarget,
        type: 'data-flow',
        strength: 0.4,
        directed: true,
        flowDirection: flow.direction,
        label: flow.direction === 'reads' ? 'reads from' : 'writes to',
      });
    }

    if (skippedCount > 0) {
      console.log(`  ⚠️  Skipped ${skippedCount} flows (unmapped SW# or collapsed to self after canonicalization)`);
    }
  }

  return { dataFlows, edges };
}

/**
 * Load primitives mapping from simulation-primitives-mapping.json
 * Returns a map from issue number (as string) to array of primitive names
 */
function loadPrimitivesMapping(): Map<string, PrimitiveName[]> {
  const mapping = new Map<string, PrimitiveName[]>();

  if (!existsSync(PRIMITIVES_MAPPING_FILE)) {
    console.warn('⚠️  Primitives mapping file not found');
    return mapping;
  }

  try {
    const data = JSON.parse(readFileSync(PRIMITIVES_MAPPING_FILE, 'utf-8'));
    for (const [swKey, info] of Object.entries(data)) {
      // Extract number from SW#123 format
      const num = swKey.replace('SW#', '').replace(/^0+/, '') || '0';
      const primitives = (info as { primitives: string[] }).primitives as PrimitiveName[];
      mapping.set(num, primitives);
    }
  } catch (e) {
    console.warn('⚠️  Error loading primitives mapping:', e);
  }

  return mapping;
}

// Primitive display info
const PRIMITIVE_INFO: Record<PrimitiveName, { label: string; color: string; pattern: string }> = {
  TrustErosion: { label: 'Trust Erosion', color: '#ef4444', pattern: 'harm → fear → avoidance → worse' },
  DeathSpiral: { label: 'Death Spiral', color: '#dc2626', pattern: 'A↓ → B↓ → collapse' },
  ThresholdCascade: { label: 'Threshold Cascade', color: '#f97316', pattern: 'accumulation → threshold → phase transition' },
  CapacityStress: { label: 'Capacity Stress', color: '#eab308', pattern: 'utilization↑ → degradation → overflow' },
  ContagionPropagation: { label: 'Contagion', color: '#84cc16', pattern: 'shock → channel spread → amplification' },
  LegitimacyDynamics: { label: 'Legitimacy', color: '#22c55e', pattern: 'performance → legitimacy → compliance' },
  FeedbackLoop: { label: 'Feedback Loop', color: '#14b8a6', pattern: 'A → B → A (reinforcing/balancing)' },
  PolicyContagion: { label: 'Policy Contagion', color: '#06b6d4', pattern: 'adopt → neighbor pressure → spread' },
  ResourceDepletion: { label: 'Resource Depletion', color: '#0ea5e9', pattern: 'extraction > renewal → scarcity' },
  ExodusMigration: { label: 'Exodus Migration', color: '#3b82f6', pattern: 'push factors → threshold → mass movement' },
  CaptureConcentration: { label: 'Capture', color: '#6366f1', pattern: 'advantage → accumulation → lock-in' },
  ResistanceBacklash: { label: 'Resistance', color: '#8b5cf6', pattern: 'grievance → mobilization → counter-reaction' },
  QueueBacklog: { label: 'Queue Backlog', color: '#a855f7', pattern: 'arrival > service → backlog → delay' },
  AdaptiveResistance: { label: 'Adaptive Resistance', color: '#d946ef', pattern: 'intervention → selection → resistance' },
};

/**
 * Create primitive nodes and issue-primitive edges from the primitives mapping
 */
function createPrimitiveGraphData(
  primitivesMapping: Map<string, PrimitiveName[]>,
  slugToNumberMap: Map<string, number>,
  issueNodes: GraphNode[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Build reverse map: number -> slug
  const numberToSlug = new Map<number, string>();
  for (const [slug, num] of slugToNumberMap) {
    numberToSlug.set(num, slug);
  }

  // Track which primitives are actually used
  const usedPrimitives = new Set<PrimitiveName>();
  const primitiveUsageCount = new Map<PrimitiveName, number>();

  // Create edges from issues to primitives
  for (const [issueNum, primitives] of primitivesMapping) {
    const slug = numberToSlug.get(parseInt(issueNum, 10));
    if (!slug) continue;

    // Check if this issue exists in our nodes
    const issueNode = issueNodes.find(n => n.id === slug);
    if (!issueNode) continue;

    for (const primitive of primitives) {
      usedPrimitives.add(primitive);
      primitiveUsageCount.set(primitive, (primitiveUsageCount.get(primitive) || 0) + 1);

      // Create edge from issue to primitive
      const primitiveId = primitive.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1); // TrustErosion -> trust-erosion
      edges.push({
        source: slug,
        target: primitiveId,
        type: 'issue-primitive',
        strength: 0.3,
      });
    }
  }

  // Create primitive nodes for each used primitive
  for (const primitive of usedPrimitives) {
    const info = PRIMITIVE_INFO[primitive];
    const primitiveId = primitive.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1);
    const usageCount = primitiveUsageCount.get(primitive) || 0;

    nodes.push({
      id: primitiveId,
      type: 'primitive',
      label: info.label,
      description: info.pattern,
      color: info.color,
      size: 10 + Math.min(usageCount / 5, 8), // Size based on usage
      usageCount,
    });
  }

  return { nodes, edges };
}

/**
 * Build a mapping from issue slug to issue number by parsing ARCHITECTURE filenames
 */
function buildSlugToIssueNumberMap(): Map<string, number> {
  const mapping = new Map<string, number>();
  const systemsDir = join(PARENT_REPO, 'docs/technical/simulation-systems');

  if (!existsSync(systemsDir)) {
    return mapping;
  }

  try {
    const files = readdirSync(systemsDir);
    for (const file of files) {
      // Match pattern: NN-slug-ARCHITECTURE.md
      const match = file.match(/^(\d+)-(.+)-ARCHITECTURE\.md$/);
      if (match) {
        const num = parseInt(match[1], 10);
        const slug = match[2];
        mapping.set(slug, num);
      }
    }
  } catch (e) {
    console.warn('⚠️  Error building slug-to-number map:', e);
  }

  return mapping;
}

async function main() {
  console.log('🔍 Extracting data from Shadow Work...');

  copyAgentVocab();
  copyAgentPriors();
  copyShadowCountryMap();

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Load multi-category data
  const multiCategoryData = loadMultiCategoryData();
  console.log(`🏷️  Loaded ${multiCategoryData.size} multi-category assignments`);

  // Load curated mappings
  const curatedMappings = loadCuratedMappings();
  console.log(`📋 Loaded ${curatedMappings.size} curated issue-system mappings`);

  // Load community data
  const { communityMap, communities } = loadCommunityData();
  console.log(`🎨 Loaded ${Object.keys(communities).length} communities with ${communityMap.size} member assignments`);

  // Load principles data (from extract-principles.ts output)
  const { principles, nodes: principleNodes, edges: principleEdges } = loadPrinciplesData();
  console.log(`🔬 Loaded ${principles.length} design principles with ${principleEdges.length} edges`);

  // Load redirects/aliases from YAML (used to canonicalize targets and avoid duplicate nodes)
  const issueRedirectIndex = loadIssueRedirectIndex();
  const resolveIssue = (id: string) => resolveIssueId(id, issueRedirectIndex.issueIdRedirects);

  // Load data flows (from extract-principles.ts output)
  const { dataFlows, edges: dataFlowEdges } = loadDataFlows(resolveIssue);
  console.log(`🔗 Loaded ${dataFlows.length} data flow connections`);

  // Load primitives mapping
  const primitivesMapping = loadPrimitivesMapping();
  console.log(`🧩 Loaded ${primitivesMapping.size} issue-primitive mappings`);

  // Load events from YAML files
  const issueEvents = loadIssueEvents();
  console.log(`📅 Loaded events for ${issueEvents.size} issues`);

  // Build slug-to-issue-number map from ARCHITECTURE filenames
  const slugToNumberMap = buildSlugToIssueNumberMap();
  console.log(`📌 Built slug-to-number map with ${slugToNumberMap.size} entries`);

  // Parse system walk tracker
  const systemWalkMap = parseSystemWalkTracker(PARENT_REPO);

  // Load wiki content early to get valid slugs for connection validation
  const wikiContent = loadWikiContent();
  const caseStudyIssueSlugs = new Set<string>();
  const mergedIssueSlugs = new Set<string>();
  for (const [id, article] of wikiContent.issues) {
    const caseStudyOf = article.frontmatter?.caseStudyOf;
    if (typeof caseStudyOf === 'string' && caseStudyOf.trim().length > 0) {
      caseStudyIssueSlugs.add(id);
    }
    if (issueRedirectIndex.deprecatedIssueIds.has(id)) {
      mergedIssueSlugs.add(id);
    }
  }

  const wikiIssueSlugsAll = new Set(wikiContent.issues.keys());
  const wikiIssueSlugs = new Set<string>();
  for (const id of wikiContent.issues.keys()) {
    if (!caseStudyIssueSlugs.has(id) && !mergedIssueSlugs.has(id)) {
      wikiIssueSlugs.add(id);
    }
  }

  if (caseStudyIssueSlugs.size > 0) {
    console.log(`🧾 Loaded ${caseStudyIssueSlugs.size} case-study issue articles (excluded from graph nodes)`);
  }
  if (mergedIssueSlugs.size > 0) {
    console.log(`🧭 Loaded ${mergedIssueSlugs.size} merged/redirect issue articles (excluded from graph nodes)`);
  }
  console.log(`📚 Loaded ${wikiIssueSlugs.size} wiki issue slugs for connection validation`);

  // Extract issues
  const allRawIssues = parseIssueCatalog(multiCategoryData);
  console.log(`📋 Found ${allRawIssues.length} issues in catalog`);

  // Filter out archived issues (those that don't have active wiki articles)
  // Also exclude case-study/merged articles: visible in wiki, but not separate graph nodes.
  const rawIssues = allRawIssues.filter(issue => wikiIssueSlugs.has(issue.id));
  const archivedCount = allRawIssues.filter(issue => !wikiIssueSlugsAll.has(issue.id)).length;
  if (archivedCount > 0) {
    console.log(`📦 Skipping ${archivedCount} archived issues (wiki articles in archive)`);
  }

  const issueNodes = rawIssues.map((issue, index) =>
    issueToNode(issue, index + 1, curatedMappings, systemWalkMap, primitivesMapping, slugToNumberMap, wikiContent.issues)
  );
  nodes.push(...issueNodes);

  // Create nodes from wiki-only articles (not in catalog)
  const catalogIds = new Set(rawIssues.map(i => i.id));
  const wikiOnlyArticles: WikiArticle[] = [];
  for (const [id, article] of wikiContent.issues) {
    if (!catalogIds.has(id) && !caseStudyIssueSlugs.has(id) && !mergedIssueSlugs.has(id)) {
      wikiOnlyArticles.push(article);
    }
  }

  if (wikiOnlyArticles.length > 0) {
    console.log(`📰 Found ${wikiOnlyArticles.length} wiki-only issues (no catalog entry)`);
    const wikiOnlyNodes = wikiOnlyArticles.map((article, index) =>
      wikiArticleToNode(article, 300 + index, curatedMappings, systemWalkMap, multiCategoryData, primitivesMapping, slugToNumberMap)
    );
    nodes.push(...wikiOnlyNodes);
    issueNodes.push(...wikiOnlyNodes); // Also add to issueNodes for edge processing
  }

  // Extract systems as nodes
  const rawConnectivityData = parseSystemsFromConnectivity();
  const connectivityData = canonicalizeConnectivityData(rawConnectivityData);
  console.log(`🎯 Found ${rawConnectivityData.systems.length} systems (collapsed to ${connectivityData.systems.length} canonical systems)`);

  const systemNodes = connectivityData.systems.map(system => systemToNode(system));
  nodes.push(...systemNodes);

  // Add principle nodes
  // Only add principles that have valid edges to avoid disconnected clusters
  if (principleNodes.length > 0) {
    // Get all valid target IDs (issues + systems) before adding principle nodes
    const validTargetIds = new Set(nodes.map(n => n.id));

    // Find which principles have valid edges
    const validPrincipleEdges = principleEdges.filter(e => validTargetIds.has(e.target));
    const connectedPrincipleIds = new Set(validPrincipleEdges.map(e => e.source));

    // Only add principle nodes that have at least one valid edge
    const connectedPrincipleNodes = principleNodes.filter(n => connectedPrincipleIds.has(n.id));
    nodes.push(...connectedPrincipleNodes);

    // Add the valid edges
    edges.push(...validPrincipleEdges);

    const skippedNodes = principleNodes.length - connectedPrincipleNodes.length;
    const skippedEdges = principleEdges.length - validPrincipleEdges.length;
    console.log(`🔬 Added ${connectedPrincipleNodes.length} principle nodes (${skippedNodes} skipped - no matching target)`);
    console.log(`🔗 Added ${validPrincipleEdges.length} principle edges (${skippedEdges} skipped - invalid target)`);
  }

  // Note: Primitives are rendered as overlays/hulls, not as separate nodes
  // The primitives field on issue nodes is used by the UI for grouping

  // Create system ID map for edge creation
  const systemIdMap = new Map(systemNodes.map(s => [s.label, s.id]));

  // Extract edges
  console.log('🔗 Extracting connections...');

  // 1. Issue-to-issue edges (validate against wiki slugs)
  const issueEdges = extractIssueEdges(rawIssues, wikiIssueSlugs, resolveIssue);
  console.log(`  - ${issueEdges.length} issue-issue edges`);
  edges.push(...issueEdges);

  // 1b. Issue-to-issue edges from wiki-only articles (from YAML connections first, fallback to frontmatter)
  const curatedConnections = loadCuratedConnections();
  let wikiOnlyEdgeCount = 0;
  for (const article of wikiOnlyArticles) {
    // First try YAML connections (higher quality)
    const yamlConnections = curatedConnections.get(article.id);
    if (yamlConnections && yamlConnections.length > 0) {
      for (const conn of yamlConnections) {
        const canonicalTarget = resolveIssue(conn.targetId);
        if (wikiIssueSlugs.has(canonicalTarget) && canonicalTarget !== article.id) {
          edges.push({
            source: article.id,
            target: canonicalTarget,
            type: 'issue-issue',
            strength: conn.strength || 0.5,
            label: conn.relationshipType,
            bidirectional: false,
          });
          wikiOnlyEdgeCount++;
        }
      }
    } else {
      // Fallback to frontmatter connections
      const connections = article.frontmatter.connections;
      if (Array.isArray(connections)) {
        for (const targetId of connections) {
          if (typeof targetId !== 'string') continue;
          const canonicalTarget = resolveIssue(targetId);
          if (wikiIssueSlugs.has(canonicalTarget) && canonicalTarget !== article.id) {
            edges.push({
              source: article.id,
              target: canonicalTarget,
              type: 'issue-issue',
              strength: 0.5,
              bidirectional: true,
            });
            wikiOnlyEdgeCount++;
          }
        }
      }
    }
  }
  if (wikiOnlyEdgeCount > 0) {
    console.log(`  - ${wikiOnlyEdgeCount} issue-issue edges from wiki-only articles`);
  }

  // 2. System-to-system edges (canonicalized + merged)
  for (const edge of connectivityData.edges) {
    const sourceId = systemIdMap.get(edge.source);
    const targetId = systemIdMap.get(edge.target);

    if (sourceId && targetId) {
      edges.push({
        source: sourceId,
        target: targetId,
        type: 'system-system',
        strength: edge.strength,
        label: edge.label,
        bidirectional: true,
      });
    }
  }
  console.log(`  - ${connectivityData.edges.length} system-system edges`);

  // 3. Issue-to-system edges
  let issueSystemEdgeCount = 0;
  for (const issue of issueNodes) {
    if (issue.affectedSystems && issue.affectedSystems.length > 0) {
      for (const systemName of issue.affectedSystems) {
        const systemId = systemIdMap.get(systemName);
        if (systemId) {
          edges.push({
            source: issue.id,
            target: systemId,
            type: 'issue-system',
            strength: 0.6,
            label: 'affects',
            bidirectional: false,
          });
          issueSystemEdgeCount++;
        }
      }
    }
  }
  console.log(`  - ${issueSystemEdgeCount} issue-system edges`);

  // 4. Data flow edges (directed flows between issues and/or systems)
  // Allow data flows between any valid nodes (issues or systems)
  const allNodeIds = new Set(nodes.map(n => n.id));

  // Build case study → parent map so flows that reference case studies attach to the canonical issue node.
  const caseStudyToParent = new Map<string, string>();
  for (const [id, article] of wikiContent.issues) {
    const parent = article.frontmatter?.caseStudyOf;
    if (typeof parent === 'string' && parent.trim().length > 0) {
      caseStudyToParent.set(id, parent.trim());
    }
  }

  const canonicalizeFlowEndpoint = (id: string): string => {
    const parent = caseStudyToParent.get(id);
    if (parent) return parent;
    return resolveIssue(id);
  };

  // Canonicalize endpoints, dedupe, then validate.
  const canonicalizedDataFlowEdges: GraphEdge[] = [];
  const seenFlowEdges = new Set<string>();
  let skippedInvalidFlowNodes = 0;

  for (const edge of dataFlowEdges) {
    const source = canonicalizeFlowEndpoint(edge.source);
    const target = canonicalizeFlowEndpoint(edge.target);
    if (source === target) continue;

    const key = `${source}->${target}:${edge.flowDirection || ''}`;
    if (seenFlowEdges.has(key)) continue;
    seenFlowEdges.add(key);

    if (!allNodeIds.has(source) || !allNodeIds.has(target)) {
      skippedInvalidFlowNodes++;
      continue;
    }

    canonicalizedDataFlowEdges.push({ ...edge, source, target });
  }

  edges.push(...canonicalizedDataFlowEdges);
  console.log(
    `  - ${canonicalizedDataFlowEdges.length} data-flow edges (${skippedInvalidFlowNodes} skipped - invalid node)`
  );

  // Process wiki articles (already loaded earlier for connection validation)
  console.log('📚 Processing wiki articles...');

  // Create wiki articles map for output - include ALL wiki articles
  const wikiArticles: Record<string, WikiArticle> = {};

  // First, add all wiki articles (even those without matching catalog nodes)
  // Attach events to issue articles
  let issuesWithEvents = 0;
  let totalEvents = 0;
  for (const [id, article] of wikiContent.issues) {
    const events = issueEvents.get(id);
    if (events && events.length > 0) {
      article.events = events;
      issuesWithEvents++;
      totalEvents += events.length;
    }
    wikiArticles[id] = article;
  }
  for (const [id, article] of wikiContent.systems) {
    wikiArticles[id] = article;
  }
  for (const [id, article] of wikiContent.principles) {
    wikiArticles[id] = article;
  }
  for (const [id, article] of wikiContent.primitives) {
    wikiArticles[id] = article;
  }
  for (const [id, article] of wikiContent.mechanics) {
    wikiArticles[id] = article;
  }
  // Generated reference articles (countries + agent vocab)
  for (const [id, article] of Object.entries(generateCountryWikiArticles())) {
    wikiArticles[id] = article;
  }
  for (const [id, article] of Object.entries(generateAgentVocabWikiArticles())) {
    wikiArticles[id] = article;
  }
  console.log(`  - ${issuesWithEvents} issues with ${totalEvents} events attached`);

  // Then, attach wiki article metadata to matching nodes
  for (const node of nodes) {
    const article = getWikiArticle(node.id, node.type as 'issue' | 'system' | 'principle' | 'primitive', wikiContent);
    if (article) {
      // Add hasArticle flag to node
      node.hasArticle = true;
      node.wordCount = article.wordCount;
    }

    // Attach community data for issue nodes
    if (node.type === 'issue') {
      const communityInfo = communityMap.get(node.id);
      if (communityInfo) {
        node.communityId = communityInfo.communityId;
        node.communityLabel = communityInfo.label;
        node.isBridgeNode = communityInfo.isBridge;
      }
    }
  }

  console.log(`  - ${wikiContent.issues.size} issue articles`);
  console.log(`  - ${wikiContent.systems.size} system articles`);
  console.log(`  - ${wikiContent.principles.size} principle articles`);
  console.log(`  - ${wikiContent.primitives.size} primitive articles`);
  console.log(`  - ${wikiContent.mechanics.size} mechanic articles`);

  const principleCount = nodes.filter(n => n.type === 'principle').length;

  const data: GraphData = {
    nodes,
    edges,
    articles: wikiArticles, // Include full articles
    communities, // Include community metadata
    principles: principles.length > 0 ? principles : undefined,
    dataFlows: dataFlows.length > 0 ? dataFlows : undefined,
    issueIdRedirects:
      issueRedirectIndex.issueIdRedirects.size > 0
        ? Object.fromEntries(issueRedirectIndex.issueIdRedirects.entries())
        : undefined,
    canonicalIssueAliases:
      issueRedirectIndex.canonicalAliases.size > 0
        ? Object.fromEntries(issueRedirectIndex.canonicalAliases.entries())
        : undefined,
    metadata: {
      generatedAt: new Date().toISOString(),
      issueCount: nodes.filter(n => n.type === 'issue').length,
      systemCount: nodes.filter(n => n.type === 'system').length,
      edgeCount: edges.length,
      articleCount: Object.keys(wikiArticles).length,
      communityCount: Object.keys(communities).length,
      principleCount: principleCount > 0 ? principleCount : undefined,
      dataFlowCount: dataFlows.length > 0 ? dataFlows.length : undefined,
    },
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));

  let summary = `✅ Extracted ${data.metadata.issueCount} issues, ${data.metadata.systemCount} systems, ${data.metadata.edgeCount} edges, ${data.metadata.articleCount} articles, ${data.metadata.communityCount} communities`;
  if (principleCount > 0) {
    summary += `, ${principleCount} principles`;
  }
  if (dataFlows.length > 0) {
    summary += `, ${dataFlows.length} data flows`;
  }
  console.log(summary);
  console.log(`📦 Wrote to ${OUTPUT_PATH}`);
}

main().catch(console.error);
