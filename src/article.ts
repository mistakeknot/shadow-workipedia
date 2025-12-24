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

function getCaseStudyParentId(article: WikiArticle): string | null {
  const raw = article.frontmatter?.caseStudyOf;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveIssueId(id: string, data: GraphData): string {
  const redirects = data.issueIdRedirects;
  if (!redirects) return id;

  let current = id;
  const visited = new Set<string>();
  for (let i = 0; i < 25; i++) {
    const next = redirects[current];
    if (!next || next === current) return current;
    if (visited.has(current)) return current;
    visited.add(current);
    current = next;
  }
  return current;
}

function getRedirectTargetId(article: WikiArticle, data: GraphData): string | null {
  if (article.type !== 'issue') return null;
  const resolved = resolveIssueId(article.id, data);
  return resolved !== article.id ? resolved : null;
}

function findCaseStudiesForIssue(issueId: string, data: GraphData): WikiArticle[] {
  const articles = data.articles ? Object.values(data.articles) : [];
  return articles
    .filter(a => a.type === 'issue' && getCaseStudyParentId(a) === issueId)
    .sort((a, b) => a.title.localeCompare(b.title));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function toKebabFromCamel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function mechanicPageId(pattern: string, mechanic: string): string {
  return `mechanic--${slugify(pattern)}--${slugify(mechanic)}`;
}

type IssueMechanic = {
  id: string;
  title: string;
};

function findMechanicsForIssue(issueId: string, data: GraphData): IssueMechanic[] {
  const issueArticle = data.articles?.[issueId];
  const raw = issueArticle?.frontmatter?.mechanics;
  const ids = Array.isArray(raw)
    ? raw.filter((v: unknown): v is string => typeof v === 'string').map(v => v.trim()).filter(Boolean)
    : [];

  const uniques = Array.from(new Set(ids));
  const items = uniques.map(id => {
    const article = data.articles?.[id];
    const title = article?.type === 'mechanic' ? article.title : id;
    return { id, title };
  });

  return items.sort((a, b) => a.title.localeCompare(b.title));
}

function renderIssueMechanicsSection(issueId: string, data: GraphData): string {
  const issueArticle = data.articles?.[issueId];
  const hasMechanicsKey = Boolean(issueArticle && Object.prototype.hasOwnProperty.call(issueArticle.frontmatter ?? {}, 'mechanics'));
  const mechanics = findMechanicsForIssue(issueId, data);
  if (mechanics.length === 0 && !hasMechanicsKey) return '';

  return `
    <div class="related-section mechanics-section">
      <h3>Mechanics (${mechanics.length})</h3>
      ${mechanics.length > 0 ? `
        <div class="related-links">
          ${mechanics.map(m => `
            <a href="#/wiki/${m.id}" class="related-link has-article">
              ${m.title}
              <span class="article-indicator">📄</span>
            </a>
          `).join('')}
        </div>
      ` : `
        <p class="related-empty">No mechanics tagged yet.</p>
      `}
    </div>
  `;
}

type IssuePrimitive = {
  id: string;
  title: string;
};

function findPrimitivesForIssue(issueId: string, data: GraphData): IssuePrimitive[] {
  const node = data.nodes.find(n => n.type === 'issue' && n.id === issueId);
  const primitives = Array.isArray((node as any)?.primitives) ? (node as any).primitives as string[] : [];
  const uniqueIds = Array.from(new Set(primitives.map(p => toKebabFromCamel(p))));

  const items = uniqueIds.map(id => {
    const article = data.articles?.[id];
    const title = article?.type === 'primitive' ? article.title : id;
    return { id, title };
  });

  return items.sort((a, b) => a.title.localeCompare(b.title));
}

function renderIssuePrimitivesSection(issueId: string, data: GraphData): string {
  const node = data.nodes.find(n => n.type === 'issue' && n.id === issueId);
  const hasPrimitives = Array.isArray((node as any)?.primitives) && (node as any).primitives.length > 0;
  if (!hasPrimitives) return '';

  const primitives = findPrimitivesForIssue(issueId, data);
  if (primitives.length === 0) return '';

  return `
    <div class="related-section primitives-section">
      <h3>Simulation Primitives (${primitives.length})</h3>
      <div class="related-links">
        ${primitives.map(p => `
          <a href="#/wiki/${p.id}" class="related-link ${data.articles?.[p.id] ? 'has-article' : ''}">
            ${p.title}
            ${data.articles?.[p.id] ? '<span class="article-indicator">📄</span>' : ''}
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

function renderMechanicRelatedContent(article: WikiArticle, data: GraphData): string {
  const pattern = typeof article.frontmatter?.pattern === 'string' ? article.frontmatter.pattern : '';
  const mechanic = typeof article.frontmatter?.mechanic === 'string' ? article.frontmatter.mechanic : '';
  if (!pattern || !mechanic) return '';

  const currentMechanicId = article.id;

  const communities = data.communities ? Object.values(data.communities) : [];
  const matchingCommunities: Array<{ id: number; label: string; issues: string[] }> = [];
  const sharedIssueSet = new Set<string>();

  for (const c of communities) {
    const shared = (c as any).sharedMechanics as Array<any> | undefined;
    if (!Array.isArray(shared)) continue;
    const match = shared.find(m => m && typeof m.pattern === 'string' && typeof m.mechanic === 'string' && mechanicPageId(m.pattern, m.mechanic) === currentMechanicId);
    if (!match) continue;

    const cid = (c as any).id as number;
    const label = (c as any).label as string;
    const issues = Array.isArray(match.issues) ? match.issues : [];
    for (const id of issues) sharedIssueSet.add(id);
    matchingCommunities.push({ id: cid, label, issues });
  }

  const taggedIssueSet = new Set<string>();
  if (data.articles) {
    for (const a of Object.values(data.articles)) {
      if (a.type !== 'issue') continue;
      const list = Array.isArray(a.frontmatter?.mechanics) ? a.frontmatter.mechanics : [];
      if (!Array.isArray(list)) continue;
      if (list.some((v: unknown) => typeof v === 'string' && v.trim() === currentMechanicId)) {
        taggedIssueSet.add(a.id);
      }
    }
  }

  const issues = Array.from(new Set([...sharedIssueSet, ...taggedIssueSet]))
    .map(id => ({
      id,
      title: data.articles?.[id]?.title ?? data.nodes.find(n => n.id === id)?.label ?? id,
      hasArticle: Boolean(data.articles?.[id]),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const primitiveCounts = new Map<string, number>();
  for (const issueId of issues.map(i => i.id)) {
    const node = data.nodes.find(n => n.type === 'issue' && n.id === issueId);
    const primitives = Array.isArray((node as any)?.primitives) ? (node as any).primitives as string[] : [];
    for (const p of primitives) {
      const pid = toKebabFromCamel(p);
      primitiveCounts.set(pid, (primitiveCounts.get(pid) || 0) + 1);
    }
  }

  const topPrimitives = Array.from(primitiveCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id, count]) => ({
      id,
      title: data.articles?.[id]?.title ?? id,
      count,
      hasArticle: Boolean(data.articles?.[id]),
    }));

  const INITIAL_SHOW = 30;
  const hasMore = issues.length > INITIAL_SHOW;

  return `
    <div class="related-content">
      <h2>Where This Appears</h2>

      ${matchingCommunities.length > 0 ? `
        <div class="related-section">
          <h3>Communities (${matchingCommunities.length})</h3>
          <div class="related-links">
            ${matchingCommunities
              .sort((a, b) => a.label.localeCompare(b.label))
              .map(c => `
                <a href="#/communities/community-${c.id}" class="related-link">
                  ${c.label}
                </a>
              `).join('')}
          </div>
        </div>
      ` : ''}

      ${topPrimitives.length > 0 ? `
        <div class="related-section primitives-section">
          <h3>Common Primitives (${primitiveCounts.size})</h3>
          <div class="related-links">
            ${topPrimitives.map(p => `
              <a
                href="#/wiki/${p.id}"
                class="related-link ${p.hasArticle ? 'has-article' : ''}"
                title="Appears in ${p.count} issues tagged with this mechanic"
              >
                ${p.title}
                <span style="color:#94a3b8; font-size:0.8rem;">(${p.count})</span>
                ${p.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${issues.length > 0 ? `
        <div class="related-section" data-section="issues">
          <h3>Issues (${issues.length})</h3>
          <div class="related-links">
            ${issues.slice(0, INITIAL_SHOW).map(n => `
              <a
                href="#/wiki/${n.id}"
                class="related-link ${n.hasArticle ? 'has-article' : ''}"
              >
                ${n.title}
                ${n.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
              </a>
            `).join('')}
            ${hasMore ? `
              <div class="related-links-overflow" data-expanded="false">
                ${issues.slice(INITIAL_SHOW).map(n => `
                  <a
                    href="#/wiki/${n.id}"
                    class="related-link ${n.hasArticle ? 'has-article' : ''}"
                  >
                    ${n.title}
                    ${n.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
                  </a>
                `).join('')}
              </div>
              <button class="expand-toggle" data-target="issues">
                <span class="expand-text">+${issues.length - INITIAL_SHOW} more</span>
                <span class="collapse-text">Show less</span>
              </button>
            ` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderPrimitiveRelatedContent(article: WikiArticle, data: GraphData): string {
  if (article.type !== 'primitive') return '';

  const issues = data.nodes
    .filter(n => n.type === 'issue')
    .filter(n => Array.isArray((n as any).primitives) && ((n as any).primitives as string[]).some(p => toKebabFromCamel(p) === article.id))
    .map(n => ({
      id: n.id,
      title: data.articles?.[n.id]?.title ?? n.label ?? n.id,
      hasArticle: Boolean(data.articles?.[n.id]),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const mechanicsCounts = new Map<string, number>();
  for (const issue of issues) {
    const list = Array.isArray(data.articles?.[issue.id]?.frontmatter?.mechanics)
      ? data.articles?.[issue.id]?.frontmatter?.mechanics as unknown[]
      : [];
    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const id = raw.trim();
      if (!id) continue;
      mechanicsCounts.set(id, (mechanicsCounts.get(id) || 0) + 1);
    }
  }

  const topMechanics = Array.from(mechanicsCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id, count]) => ({
      id,
      title: data.articles?.[id]?.title ?? id,
      count,
      hasArticle: Boolean(data.articles?.[id]),
    }));

  const relatedPrimitives = Array.isArray(article.frontmatter?.related_primitives)
    ? (article.frontmatter.related_primitives as unknown[])
        .filter((v: unknown): v is string => typeof v === 'string')
        .map(v => v.trim())
        .filter(Boolean)
    : [];

  const uniqueRelatedPrimitives = Array.from(new Set(relatedPrimitives))
    .map(id => ({
      id,
      title: data.articles?.[id]?.title ?? id,
      hasArticle: Boolean(data.articles?.[id]),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const INITIAL_SHOW = 30;
  const hasMore = issues.length > INITIAL_SHOW;

  return `
    <div class="related-content">
      <h2>In the Simulation</h2>

      ${topMechanics.length > 0 ? `
        <div class="related-section mechanics-section">
          <h3>Common Mechanics (${mechanicsCounts.size})</h3>
          <div class="related-links">
            ${topMechanics.map(m => `
              <a
                href="#/wiki/${m.id}"
                class="related-link ${m.hasArticle ? 'has-article' : ''}"
                title="Appears on ${m.count} issues using this primitive"
              >
                ${m.title}
                <span style="color:#94a3b8; font-size:0.8rem;">(${m.count})</span>
                ${m.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${uniqueRelatedPrimitives.length > 0 ? `
        <div class="related-section primitives-section">
          <h3>Related Primitives (${uniqueRelatedPrimitives.length})</h3>
          <div class="related-links">
            ${uniqueRelatedPrimitives.map(p => `
              <a href="#/wiki/${p.id}" class="related-link ${p.hasArticle ? 'has-article' : ''}">
                ${p.title}
                ${p.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${issues.length > 0 ? `
        <div class="related-section" data-section="issues">
          <h3>Issues (${issues.length})</h3>
          <div class="related-links">
            ${issues.slice(0, INITIAL_SHOW).map(n => `
              <a
                href="#/wiki/${n.id}"
                class="related-link ${n.hasArticle ? 'has-article' : ''}"
              >
                ${n.title}
                ${n.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
              </a>
            `).join('')}
            ${hasMore ? `
              <div class="related-links-overflow" data-expanded="false">
                ${issues.slice(INITIAL_SHOW).map(n => `
                  <a
                    href="#/wiki/${n.id}"
                    class="related-link ${n.hasArticle ? 'has-article' : ''}"
                  >
                    ${n.title}
                    ${n.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
                  </a>
                `).join('')}
              </div>
              <button class="expand-toggle" data-target="issues">
                <span class="expand-text">+${issues.length - INITIAL_SHOW} more</span>
                <span class="collapse-text">Show less</span>
              </button>
            ` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderCaseStudyParentBanner(article: WikiArticle, data: GraphData): string {
  const parentId = getCaseStudyParentId(article);
  if (!parentId) return '';

  const parentTitle =
    data.articles?.[parentId]?.title ??
    data.nodes.find(n => n.id === parentId)?.label ??
    parentId;

  return `
    <div class="case-study-banner">
      <span class="case-study-badge">Case Study</span>
      <span class="case-study-of">of</span>
      <a class="case-study-parent-link" href="#/wiki/${parentId}">${parentTitle}</a>
    </div>
  `;
}

function renderRedirectBanner(article: WikiArticle, data: GraphData): string {
  const targetId = getRedirectTargetId(article, data);
  if (!targetId) return '';

  const targetTitle =
    data.articles?.[targetId]?.title ??
    data.nodes.find(n => n.id === targetId)?.label ??
    targetId;

  const badge = typeof article.frontmatter?.mergedInto === 'string' ? 'Merged' : 'Redirect';

  return `
    <div class="redirect-banner">
      <span class="redirect-badge">${badge}</span>
      <span class="redirect-of">to</span>
      <a class="redirect-target-link" href="#/wiki/${targetId}">${targetTitle}</a>
    </div>
  `;
}

export type ViewType = 'graph' | 'table' | 'wiki' | 'communities';
export type RouteType =
  | { kind: 'view'; view: ViewType }
  | { kind: 'article'; type: 'issue' | 'system' | 'principle' | 'primitive' | 'mechanic'; slug: string }
  | { kind: 'community'; slug: string }
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

    // View routes: #/table, #/wiki, #/communities
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

    if (hash === '#/communities') {
      this.currentRoute = { kind: 'view', view: 'communities' };
      this.onRouteChange(this.currentRoute);
      return;
    }

    // Community routes: #/communities/community-N
    const communityMatch = hash.match(/^#\/communities\/(community-\d+)$/);
    if (communityMatch) {
      const [, slug] = communityMatch;
      this.currentRoute = { kind: 'community', slug };
      this.onRouteChange(this.currentRoute);
      return;
    }

    // Article routes: #/wiki/slug, #/issue/slug, #/system/slug, #/principle/slug
    const articleMatch = hash.match(/^#\/(wiki|issue|system|principle)\/([a-z0-9-]+)$/);
    if (articleMatch) {
      const [, routeType, slug] = articleMatch;
      // Normalize routes to correct type
      const type = routeType === 'system' ? 'system' :
                   routeType === 'principle' ? 'principle' : 'issue';
      this.currentRoute = { kind: 'article', type, slug };
      this.onRouteChange(this.currentRoute);
      return;
    }

    // Invalid route, default to graph
    this.navigateToView('graph');
  }

  navigateToArticle(_type: 'issue' | 'system' | 'principle' | 'primitive' | 'mechanic', slug: string) {
    // Use #/wiki/slug for issues, systems, and principles (wiki view with sidebar)
    window.location.hash = `#/wiki/${slug}`;
  }

  navigateToCommunity(slug: string) {
    window.location.hash = `#/communities/${slug}`;
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
  // Find the node for additional metadata (redirect issues to canonical nodes)
  const effectiveNodeId = article.type === 'issue' ? resolveIssueId(article.id, data) : article.id;
  const node = data.nodes.find(n => n.id === effectiveNodeId);

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

      ${renderCaseStudyParentBanner(article, data)}
      ${renderRedirectBanner(article, data)}

      <article class="article-content">
        ${article.html}
      </article>

      ${article.type === 'mechanic'
        ? renderMechanicRelatedContent(article, data)
        : article.type === 'primitive'
          ? renderPrimitiveRelatedContent(article, data)
          : (node ? renderRelatedContent(node, data) : '')}

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
  // Find the node for additional metadata (redirect issues to canonical nodes)
  const effectiveNodeId = article.type === 'issue' ? resolveIssueId(article.id, data) : article.id;
  const node = data.nodes.find(n => n.id === effectiveNodeId);

  return `
    <div class="wiki-article-view">
      <div class="wiki-article-header">
        <div class="article-meta">
          <span class="article-type-badge">${article.type}</span>
          <span class="article-word-count">${article.wordCount.toLocaleString()} words</span>
          ${article.lastUpdated ? `<span class="article-updated">Updated ${formatDate(article.lastUpdated)}</span>` : ''}
        </div>
      </div>

      ${renderCaseStudyParentBanner(article, data)}
      ${renderRedirectBanner(article, data)}

      <article class="article-content">
        ${article.html}
      </article>

      ${article.type === 'mechanic'
        ? renderMechanicRelatedContent(article, data)
        : article.type === 'primitive'
          ? renderPrimitiveRelatedContent(article, data)
          : (node ? renderRelatedContent(node, data) : '')}

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

  const caseStudies = node.type === 'issue' ? findCaseStudiesForIssue(node.id, data) : [];
  const mechanicsSection = node.type === 'issue' ? renderIssueMechanicsSection(node.id, data) : '';
  const primitivesSection = node.type === 'issue' ? renderIssuePrimitivesSection(node.id, data) : '';

  // Find principles for this issue (match sourceFile to issue id)
  const relatedPrinciples = node.type === 'issue' && data.principles
    ? data.principles.filter(p => {
        // Extract issue slug from sourceFile: "44-climate-insurance-collapse-ARCHITECTURE.md" → "climate-insurance-collapse"
        const match = p.sourceFile.match(/^\d+[a-z]?-(.+)-ARCHITECTURE\.md$/);
        return match && match[1] === node.id;
      })
    : [];

  const INITIAL_SHOW = 10;
  const hasMoreIssues = connectedIssues.length > INITIAL_SHOW;

  return `
    <div class="related-content">
      <h2>Related Content</h2>

      ${relatedPrinciples.length > 0 ? `
        <div class="related-section principles-section">
          <h3>Design Principles (${relatedPrinciples.length})</h3>
          <div class="related-links">
            ${relatedPrinciples.map(p => `
              <a href="#/wiki/${p.id}" class="related-link has-article principle-link">
                ${p.name}
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${mechanicsSection}
      ${primitivesSection}

      ${caseStudies.length > 0 ? `
        <div class="related-section case-studies-section">
          <h3>Case Studies (${caseStudies.length})</h3>
          <div class="related-links">
            ${caseStudies.map(a => `
              <a href="#/wiki/${a.id}" class="related-link has-article">
                ${a.title}
                <span class="article-indicator">📄</span>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${connectedIssues.length > 0 ? `
        <div class="related-section" data-section="issues">
          <h3>Connected Issues (${connectedIssues.length})</h3>
          <div class="related-links">
            ${connectedIssues.slice(0, INITIAL_SHOW).map(n => `
              <a
                href="#/wiki/${n.id}"
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
                    href="#/wiki/${n.id}"
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
                href="#/wiki/${n.id}"
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
export function renderArticleNotFound(type: 'issue' | 'system' | 'principle', slug: string): string {
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
