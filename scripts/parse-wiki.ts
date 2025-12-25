import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

export interface WikiArticle {
  id: string;
  title: string;
  type: 'issue' | 'system' | 'principle' | 'primitive' | 'mechanic' | 'countryIndex' | 'country' | 'vocabIndex' | 'vocabList' | 'vocabItem';
  frontmatter: Record<string, any>;
  content: string;
  html: string;
  wordCount: number;
  lastUpdated: string;
}

function titleCaseWords(raw: string): string {
  return raw
    .split(/\s+/g)
    .filter(Boolean)
    .map(word => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ');
}

function humanizeWikiId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return '';

  const prefixed = trimmed.match(/^(mechanic|issue|system|principle|primitive|community|country|vocab|vocabList|vocabItem)--(.+?)--(.+)$/);
  if (prefixed && prefixed[2] === prefixed[3]) {
    return titleCaseWords(prefixed[2].replace(/[-_]+/g, ' '));
  }

  return titleCaseWords(trimmed.replace(/[-_]+/g, ' '));
}

function rewriteWikiLinks(input: string): string {
  const lines = input.split('\n');
  const out: string[] = [];
  let inCodeFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      out.push(line);
      continue;
    }

    if (inCodeFence) {
      out.push(line);
      continue;
    }

    out.push(
      line.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, rawId: string, rawLabel?: string) => {
        const id = String(rawId ?? '').trim();
        if (!id) return String(_);

        const label = String(rawLabel ?? '').trim() || humanizeWikiId(id) || id;
        const href = `#/wiki/${encodeURIComponent(id)}`;
        return `[${label}](${href})`;
      })
    );
  }

  return out.join('\n');
}

/**
 * Parse a single wiki markdown file
 */
export function parseWikiArticle(filePath: string, type: 'issue' | 'system' | 'principle' | 'primitive' | 'mechanic'): WikiArticle | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const { data: frontmatter, content } = matter(fileContent);

    // Skip template files
    if (filePath.includes('_TEMPLATE')) {
      return null;
    }

    const normalizedContent = rewriteWikiLinks(content);

    // Convert markdown to HTML
    const html = marked.parse(normalizedContent) as string;

    // Calculate word count
    const wordCount = normalizedContent.split(/\s+/).length;

    return {
      id: frontmatter.id || 'unknown',
      title: frontmatter.title || frontmatter.name || 'Untitled',
      type,
      frontmatter,
      content: normalizedContent,
      html,
      wordCount,
      lastUpdated: frontmatter.lastUpdated || new Date().toISOString().split('T')[0],
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

/**
 * Parse all wiki articles from a directory
 */
export function parseWikiDirectory(dirPath: string, type: 'issue' | 'system' | 'principle' | 'primitive' | 'mechanic'): Map<string, WikiArticle> {
  const articles = new Map<string, WikiArticle>();

  if (!existsSync(dirPath)) {
    console.warn(`⚠️  Wiki directory not found: ${dirPath}`);
    return articles;
  }

  const files = readdirSync(dirPath);

  for (const file of files) {
    if (!file.endsWith('.md')) {
      continue;
    }

    const filePath = join(dirPath, file);
    const article = parseWikiArticle(filePath, type);

    if (article) {
      articles.set(article.id, article);
    }
  }

  console.log(`📚 Parsed ${articles.size} ${type} articles from wiki`);
  return articles;
}

export type WikiContent = {
  issues: Map<string, WikiArticle>;
  systems: Map<string, WikiArticle>;
  principles: Map<string, WikiArticle>;
  primitives: Map<string, WikiArticle>;
  mechanics: Map<string, WikiArticle>;
};

/**
 * Load all wiki content
 */
export function loadWikiContent(): WikiContent {
  const wikiRoot = join(process.cwd(), 'wiki');

  const issues = parseWikiDirectory(join(wikiRoot, 'issues'), 'issue');
  const systems = parseWikiDirectory(join(wikiRoot, 'systems'), 'system');
  const principles = parseWikiDirectory(join(wikiRoot, 'principles'), 'principle');
  const primitives = parseWikiDirectory(join(wikiRoot, 'primitives'), 'primitive');
  const mechanics = parseWikiDirectory(join(wikiRoot, 'mechanics'), 'mechanic');

  return { issues, systems, principles, primitives, mechanics };
}

/**
 * Check if a node has a wiki article
 */
export function hasWikiArticle(
  nodeId: string,
  nodeType: 'issue' | 'system' | 'principle' | 'primitive' | 'mechanic',
  wikiContent: WikiContent
): boolean {
  const articles = nodeType === 'issue' ? wikiContent.issues :
                   nodeType === 'system' ? wikiContent.systems :
                   nodeType === 'principle' ? wikiContent.principles :
                   nodeType === 'primitive' ? wikiContent.primitives :
                   wikiContent.mechanics;
  return articles.has(nodeId);
}

/**
 * Get wiki article content for a node
 */
export function getWikiArticle(
  nodeId: string,
  nodeType: 'issue' | 'system' | 'principle' | 'primitive' | 'mechanic',
  wikiContent: WikiContent
): WikiArticle | null {
  const articles = nodeType === 'issue' ? wikiContent.issues :
                   nodeType === 'system' ? wikiContent.systems :
                   nodeType === 'principle' ? wikiContent.principles :
                   nodeType === 'primitive' ? wikiContent.primitives :
                   wikiContent.mechanics;
  return articles.get(nodeId) || null;
}
