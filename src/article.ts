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

/**
 * Router for handling article navigation
 */
export class ArticleRouter {
  private currentRoute: string | null = null;

  constructor(
    private onRouteChange: (route: string | null) => void
  ) {
    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRouteChange());

    // Handle initial route
    this.handleRouteChange();
  }

  private handleRouteChange() {
    const hash = window.location.hash;

    if (!hash || hash === '#/') {
      this.currentRoute = null;
      this.onRouteChange(null);
      return;
    }

    // Parse routes like #/issue/water-scarcity-wars or #/system/economy
    const match = hash.match(/^#\/(issue|system)\/([a-z0-9-]+)$/);

    if (match) {
      this.currentRoute = hash;
      this.onRouteChange(hash);
    } else {
      // Invalid route, go home
      this.navigateHome();
    }
  }

  navigateToArticle(type: 'issue' | 'system', slug: string) {
    window.location.hash = `#/${type}/${slug}`;
  }

  navigateHome() {
    window.location.hash = '#/';
  }

  getCurrentRoute(): { type: 'issue' | 'system'; slug: string } | null {
    if (!this.currentRoute) return null;

    const match = this.currentRoute.match(/^#\/(issue|system)\/([a-z0-9-]+)$/);
    if (!match) return null;

    return {
      type: match[1] as 'issue' | 'system',
      slug: match[2],
    };
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
