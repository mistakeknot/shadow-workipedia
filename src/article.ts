import type { GraphData, WikiArticle } from './types';

/**
 * Format ISO date string to readable format
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export type ViewType = 'graph' | 'table' | 'wiki';
export type RouteType =
  | { kind: 'view'; view: ViewType }
  | { kind: 'article'; type: 'issue' | 'system'; slug: string }
  | null;

/**
 * Router for handling navigation
 * Supports routes:
 *   #/ or #/graph - Graph view (default)
 *   #/table - Table view
 *   #/wiki - Wiki list view
 *   #/wiki/issue-slug - Wiki article for an issue
 *   #/issue/slug - Issue article (legacy, redirects to #/wiki/slug)
 *   #/system/slug - System article
 */
export class ArticleRouter {
  private currentRoute: RouteType = null;

  constructor(
    private onRouteChange: (route: RouteType) => void
  ) {
    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRouteChange());

    // Handle initial route
    this.handleRouteChange();
  }

  private handleRouteChange() {
    const hash = window.location.hash;

    // Default to graph view
    if (!hash || hash === '#/' || hash === '#/graph') {
      this.currentRoute = { kind: 'view', view: 'graph' };
      this.onRouteChange(this.currentRoute);
      return;
    }

    // View routes: #/table, #/wiki
    if (hash === '#/table') {
      this.currentRoute = { kind: 'view', view: 'table' };
      this.onRouteChange(this.currentRoute);
      return;
    }

    if (hash === '#/wiki') {
      this.currentRoute = { kind: 'view', view: 'wiki' };
      this.onRouteChange(this.currentRoute);
      return;
    }

    // Article routes: #/wiki/slug, #/issue/slug, #/system/slug
    const articleMatch = hash.match(/^#\/(wiki|issue|system)\/([a-z0-9-]+)$/);
    if (articleMatch) {
      const [, routeType, slug] = articleMatch;
      // Normalize wiki and issue routes to the same handling
      const type = routeType === 'system' ? 'system' : 'issue';
      this.currentRoute = { kind: 'article', type, slug };
      this.onRouteChange(this.currentRoute);
      return;
    }

    // Invalid route, default to graph
    this.navigateToView('graph');
  }

  navigateToArticle(type: 'issue' | 'system', slug: string) {
    // Use #/wiki/slug for issues, #/system/slug for systems
    const prefix = type === 'issue' ? 'wiki' : 'system';
    window.location.hash = `#/${prefix}/${slug}`;
  }

  navigateToView(view: ViewType) {
    if (view === 'graph') {
      window.location.hash = '#/';
    } else {
      window.location.hash = `#/${view}`;
    }
  }

  navigateHome() {
    window.location.hash = '#/';
  }

  getCurrentRoute(): RouteType {
    return this.currentRoute;
  }
}

/**
 * Render a wiki article as HTML
 */
export function renderArticleView(article: WikiArticle, data: GraphData): string {
  // Find the node for additional metadata
  const node = data.nodes.find(n => n.id === article.id);

  return `
    <div class="article-view">
      <div class="article-header">
        <button class="back-btn" data-back-to-graph="${article.id}">
          ← Back
        </button>
        <div class="article-meta">
          <span class="article-type-badge">${article.type}</span>
          <span class="article-word-count">${article.wordCount.toLocaleString()} words</span>
          ${article.lastUpdated ? `<span class="article-updated">Updated ${formatDate(article.lastUpdated)}</span>` : ''}
        </div>
      </div>

      <article class="article-content">
        ${article.html}
      </article>

      ${node ? renderRelatedContent(node, data) : ''}

      <div class="article-footer">
        <a
          href="https://github.com/mistakeknot/shadow-workipedia/edit/main/wiki/${article.type}s/${article.id}.md"
          target="_blank"
          class="edit-link"
        >
          📝 Edit this article on GitHub
        </a>
      </div>
    </div>
  `;
}

/**
 * Render wiki article content for the sidebar view (no back button)
 */
export function renderWikiArticleContent(article: WikiArticle, data: GraphData): string {
  // Find the node for additional metadata
  const node = data.nodes.find(n => n.id === article.id);

  return `
    <div class="wiki-article-view">
      <div class="wiki-article-header">
        <h1 class="wiki-article-title">${article.title}</h1>
        <div class="article-meta">
          <span class="article-type-badge">${article.type}</span>
          <span class="article-word-count">${article.wordCount.toLocaleString()} words</span>
          ${article.lastUpdated ? `<span class="article-updated">Updated ${formatDate(article.lastUpdated)}</span>` : ''}
        </div>
      </div>

      <article class="article-content">
        ${article.html}
      </article>

      ${node ? renderRelatedContent(node, data) : ''}

      <div class="article-footer">
        <a
          href="https://github.com/mistakeknot/shadow-workipedia/edit/main/wiki/${article.type}s/${article.id}.md"
          target="_blank"
          class="edit-link"
        >
          📝 Edit this article on GitHub
        </a>
      </div>
    </div>
  `;
}

/**
 * Render related content section
 */
function renderRelatedContent(node: any, data: GraphData): string {
  // Find connected nodes
  const connectedEdges = data.edges.filter(
    e => e.source === node.id || e.target === node.id
  );

  const connectedNodeIds = new Set<string>();
  connectedEdges.forEach(edge => {
    const otherId = edge.source === node.id ? edge.target : edge.source;
    connectedNodeIds.add(otherId);
  });

  const connectedNodes = data.nodes.filter(n => connectedNodeIds.has(n.id));

  // Separate by type
  const connectedIssues = connectedNodes.filter(n => n.type === 'issue');
  const connectedSystems = connectedNodes.filter(n => n.type === 'system');

  const INITIAL_SHOW = 10;
  const hasMoreIssues = connectedIssues.length > INITIAL_SHOW;

  return `
    <div class="related-content">
      <h2>Related Content</h2>

      ${connectedIssues.length > 0 ? `
        <div class="related-section" data-section="issues">
          <h3>Connected Issues (${connectedIssues.length})</h3>
          <div class="related-links">
            ${connectedIssues.slice(0, INITIAL_SHOW).map(n => `
              <a
                href="#/${n.type}/${n.id}"
                class="related-link ${n.hasArticle ? 'has-article' : ''}"
              >
                ${n.label}
                ${n.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
              </a>
            `).join('')}
            ${hasMoreIssues ? `
              <div class="related-links-overflow" data-expanded="false">
                ${connectedIssues.slice(INITIAL_SHOW).map(n => `
                  <a
                    href="#/${n.type}/${n.id}"
                    class="related-link ${n.hasArticle ? 'has-article' : ''}"
                  >
                    ${n.label}
                    ${n.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
                  </a>
                `).join('')}
              </div>
              <button class="expand-toggle" data-target="issues">
                <span class="expand-text">+${connectedIssues.length - INITIAL_SHOW} more</span>
                <span class="collapse-text">Show less</span>
              </button>
            ` : ''}
          </div>
        </div>
      ` : ''}

      ${connectedSystems.length > 0 ? `
        <div class="related-section">
          <h3>Related Systems (${connectedSystems.length})</h3>
          <div class="related-links">
            ${connectedSystems.map(n => `
              <a
                href="#/${n.type}/${n.id}"
                class="related-link ${n.hasArticle ? 'has-article' : ''}"
              >
                ${n.label}
                ${n.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render "article not found" message
 */
export function renderArticleNotFound(type: 'issue' | 'system', slug: string): string {
  return `
    <div class="article-view article-not-found">
      <div class="not-found-content">
        <h1>Article Not Found</h1>
        <p>No wiki article exists yet for this ${type}.</p>
        <p class="not-found-id">ID: <code>${slug}</code></p>

        <div class="not-found-actions">
          <a
            href="https://github.com/mistakeknot/shadow-workipedia/new/main/wiki/${type}s?filename=${slug}.md"
            target="_blank"
            class="create-article-btn"
          >
            ✏️ Create This Article
          </a>
          <button onclick="window.location.hash='#/'" class="home-btn">
            Go to Graph View
          </button>
        </div>
      </div>
    </div>
  `;
}
