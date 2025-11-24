import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

export interface WikiArticle {
  id: string;
  title: string;
  type: 'issue' | 'system';
  frontmatter: Record<string, any>;
  content: string;
  html: string;
  wordCount: number;
  lastUpdated: string;
}

/**
 * Parse a single wiki markdown file
 */
export function parseWikiArticle(filePath: string, type: 'issue' | 'system'): WikiArticle | null {
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

    // Convert markdown to HTML
    const html = marked.parse(content) as string;

    // Calculate word count
    const wordCount = content.split(/\s+/).length;

    return {
      id: frontmatter.id || 'unknown',
      title: frontmatter.title || 'Untitled',
      type,
      frontmatter,
      content,
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
export function parseWikiDirectory(dirPath: string, type: 'issue' | 'system'): Map<string, WikiArticle> {
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

/**
 * Load all wiki content
 */
export function loadWikiContent(): {
  issues: Map<string, WikiArticle>;
  systems: Map<string, WikiArticle>;
} {
  const wikiRoot = join(process.cwd(), 'wiki');

  const issues = parseWikiDirectory(join(wikiRoot, 'issues'), 'issue');
  const systems = parseWikiDirectory(join(wikiRoot, 'systems'), 'system');

  return { issues, systems };
}

/**
 * Check if a node has a wiki article
 */
export function hasWikiArticle(
  nodeId: string,
  nodeType: 'issue' | 'system',
  wikiContent: { issues: Map<string, WikiArticle>; systems: Map<string, WikiArticle> }
): boolean {
  const articles = nodeType === 'issue' ? wikiContent.issues : wikiContent.systems;
  return articles.has(nodeId);
}

/**
 * Get wiki article content for a node
 */
export function getWikiArticle(
  nodeId: string,
  nodeType: 'issue' | 'system',
  wikiContent: { issues: Map<string, WikiArticle>; systems: Map<string, WikiArticle> }
): WikiArticle | null {
  const articles = nodeType === 'issue' ? wikiContent.issues : wikiContent.systems;
  return articles.get(nodeId) || null;
}
