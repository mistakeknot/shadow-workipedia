import type { ArticleRouter } from '../article';
import type { GraphSimulation, SimNode } from '../graph';
import type { ClickHandler, DragHandler, HoverHandler, ZoomPanHandler } from '../interactions';
import type { CommunityInfo, GraphData } from '../types';

type WikiDeps = {
  data: GraphData;
  graph: GraphSimulation;
  router: ArticleRouter;
  resolveIssueId: (id: string) => string;
  getSelectedWikiArticle: () => string | null;
  getSelectedCommunity: () => string | null;
  getWikiSection: () => 'articles' | 'communities';
  getCommunityColor: (id: number) => string;
  wikiSidebarContent: HTMLElement;
  wikiArticleContent: HTMLElement;
  wikiSidebar: HTMLDivElement | null;
  panelContent: HTMLDivElement;
  detailPanel: HTMLDivElement;
  canvas: HTMLCanvasElement;
  getCurrentTransform: () => { x: number; y: number; k: number };
  hoverHandler: HoverHandler;
  clickHandler: ClickHandler;
  dragHandler: DragHandler;
  zoomHandler: ZoomPanHandler;
  render: () => void;
  setSelectedNode: (node: SimNode | null) => void;
  renderDetailPanel: (node: SimNode, data: GraphData) => string;
  renderWikiArticleContent: (article: NonNullable<GraphData['articles']>[string], data: GraphData) => string;
  attachDetailPanelHandlers: () => void;
};

export function createWikiRenderer({
  data,
  graph,
  router,
  resolveIssueId,
  getSelectedWikiArticle,
  getSelectedCommunity,
  getWikiSection,
  getCommunityColor,
  wikiSidebarContent,
  wikiArticleContent,
  wikiSidebar,
  panelContent,
  detailPanel,
  canvas,
  getCurrentTransform,
  hoverHandler,
  clickHandler,
  dragHandler,
  zoomHandler,
  render,
  setSelectedNode,
  renderDetailPanel,
  renderWikiArticleContent,
  attachDetailPanelHandlers,
}: WikiDeps) {
  const WIKI_SIDEBAR_SECTION_STATE_KEY = 'wikiSidebarSectionOpenState:v1';
  const loadWikiSidebarSectionState = (): Record<string, boolean> => {
    try {
      const raw = localStorage.getItem(WIKI_SIDEBAR_SECTION_STATE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed as Record<string, boolean>;
    } catch {
      return {};
    }
  };
  const saveWikiSidebarSectionState = (state: Record<string, boolean>) => {
    try {
      localStorage.setItem(WIKI_SIDEBAR_SECTION_STATE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  };

	  return function renderWikiList() {
    const selectedWikiArticle = getSelectedWikiArticle();
    const selectedCommunity = getSelectedCommunity();
    const wikiSection = getWikiSection();
	    if (!data.articles || Object.keys(data.articles).length === 0) {
      wikiSidebarContent.innerHTML = `<div class="wiki-empty-sidebar">No articles yet</div>`;
      wikiArticleContent.innerHTML = `
        <div class="wiki-welcome">
          <h2>Welcome to the Wiki</h2>
          <p>Wiki articles will appear here as they are created.</p>
        </div>
      `;
      return;
    }

	    // Convert articles to array and sort by title
	    const articles = Object.values(data.articles).sort((a, b) =>
	      a.title.localeCompare(b.title)
	    );

	    const isHiddenArticle = (article: typeof articles[number]) =>
	      article.frontmatter?.hidden === true;
	    const isMergedArticle = (article: typeof articles[number]) =>
	      typeof article.frontmatter?.mergedInto === 'string' && article.frontmatter.mergedInto.trim().length > 0;

    // Don't auto-select - show welcome message when on #/wiki

    // Group by type
    const issueArticlesAll = articles.filter(a => a.type === 'issue');
    const caseStudyArticles = issueArticlesAll.filter(a => {
      const parent = a.frontmatter?.caseStudyOf;
      return typeof parent === 'string' && parent.trim().length > 0;
    });
    const redirectArticles = issueArticlesAll.filter(a => {
      const parent = a.frontmatter?.caseStudyOf;
      if (typeof parent === 'string' && parent.trim().length > 0) return false;
      const redirects = data.issueIdRedirects;
      if (!redirects) return false;
      const direct = redirects[a.id];
      return typeof direct === 'string' && direct.trim().length > 0 && resolveIssueId(a.id) !== a.id;
    });
    const issueArticles = issueArticlesAll.filter(a => {
      const parent = a.frontmatter?.caseStudyOf;
      if (typeof parent === 'string' && parent.trim().length > 0) return false;
      const redirects = data.issueIdRedirects;
      if (!redirects) return true;
      const direct = redirects[a.id];
      return !(typeof direct === 'string' && direct.trim().length > 0 && resolveIssueId(a.id) !== a.id);
    });
	    // Filter out subsystems (those with parentheses) to show only main systems
	    const systemArticles = articles.filter(a =>
	      a.type === 'system' &&
	      !a.title.includes('(') &&
	      !isHiddenArticle(a) &&
	      !isMergedArticle(a)
	    );
	    const principleArticles = articles.filter(a => a.type === 'principle');
		    const primitiveArticles = articles.filter(a => a.type === 'primitive');
		    const mechanicArticles = articles.filter(a =>
		      a.type === 'mechanic' &&
		      !isHiddenArticle(a) &&
		      !isMergedArticle(a)
		    );
	    const countryIndexArticles = articles.filter(a => a.type === 'countryIndex');
	    const vocabIndexArticles = articles.filter(a => a.type === 'vocabIndex');
	    const vocabListArticles = articles.filter(a => a.type === 'vocabList');

	    const communitiesRaw = data.communities ? Object.values(data.communities) : [];
	    const communities = communitiesRaw.slice().sort((a, b) => {
	      const al = (a.label || '').toLowerCase();
	      const bl = (b.label || '').toLowerCase();
	      const cmp = al.localeCompare(bl);
	      if (cmp !== 0) return cmp;
	      if (b.size !== a.size) return b.size - a.size;
	      return a.id - b.id;
	    });
	    const communityIssueCounts = new Map<number, number>();
	    for (const node of data.nodes) {
	      if (node.type !== 'issue') continue;
	      if (node.communityId === undefined) continue;
	      communityIssueCounts.set(node.communityId, (communityIssueCounts.get(node.communityId) || 0) + 1);
	    }

	    // Mobile: collapse sidebar when an article or community is selected
	    if (wikiSidebar) {
	      if (selectedWikiArticle || selectedCommunity) {
	        wikiSidebar.classList.add('collapsed');
	      } else {
	        wikiSidebar.classList.remove('collapsed');
	      }
	    }

	    // Render sidebar
	    const renderArticleSidebarItem = (article: typeof articles[0]) => `
	      <div class="wiki-sidebar-item${selectedWikiArticle === article.id ? ' active' : ''}" data-article-id="${article.id}">
	        ${article.title}
	      </div>
	    `;
		    const renderCommunitySidebarItem = (community: (typeof communities)[number]) => {
		      const slug = `community-${community.id}`;
		      const count = communityIssueCounts.get(community.id) ?? community.size ?? 0;
		      return `
		        <div class="wiki-sidebar-item${selectedCommunity === slug ? ' active' : ''}" data-community-slug="${slug}">
		          <div style="display:flex; align-items:center; gap:0.5rem;">
		            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${getCommunityColor(community.id)}; flex-shrink: 0;"></span>
		            <div style="flex: 1; min-width: 0;">
		              <div style="font-weight: 600; font-size: 0.85rem; line-height: 1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
		                ${community.label || `Community ${community.id}`}
		              </div>
		              <div style="font-size: 0.75rem; color:#94a3b8;">${count} issues</div>
		            </div>
		          </div>
		        </div>
		      `;
		    };

	    const sectionState = loadWikiSidebarSectionState();
	    const renderSidebarSection = (title: string, key: string, items: typeof articles) => {
	      if (items.length === 0) return '';
	      const isOpen = sectionState[key] ?? true;
	      return `
        <details class="wiki-sidebar-section" data-section-key="${key}" ${isOpen ? 'open' : ''}>
          <summary class="wiki-sidebar-section-summary">
            <h3>${title} (${items.length})</h3>
          </summary>
	          <div class="wiki-sidebar-list">
	            ${items.map(renderArticleSidebarItem).join('')}
	          </div>
	        </details>
	      `;
	    };
	    const renderCommunitiesSidebarSection = (title: string, key: string, items: typeof communities) => {
	      if (items.length === 0) return '';
	      const isOpen = sectionState[key] ?? true;
	      return `
	        <details class="wiki-sidebar-section" data-section-key="${key}" ${isOpen ? 'open' : ''}>
	          <summary class="wiki-sidebar-section-summary">
	            <h3>${title} (${items.length})</h3>
	          </summary>
	          <div class="wiki-sidebar-list">
	            ${items.map(renderCommunitySidebarItem).join('')}
	          </div>
	        </details>
	      `;
	    };

	    // Mobile expand button (shown only when collapsed)
	    const expandButton = (selectedWikiArticle || selectedCommunity)
	      ? `<button class="wiki-sidebar-expand" id="wiki-sidebar-expand-btn">Browse all content</button>`
	      : '';

	    const sidebarHtml = `
	      ${expandButton}
	      ${renderSidebarSection('Issues', 'issues', issueArticles)}
	      ${renderSidebarSection('Case Studies', 'case-studies', caseStudyArticles)}
	      ${renderSidebarSection('Redirects', 'redirects', redirectArticles)}
	      ${renderSidebarSection('Systems', 'systems', systemArticles)}
	      ${renderSidebarSection('Principles', 'principles', principleArticles)}
	      ${renderSidebarSection('Primitives', 'primitives', primitiveArticles)}
	      ${renderSidebarSection('Mechanics', 'mechanics', mechanicArticles)}
	      ${renderSidebarSection('Countries', 'countries', countryIndexArticles)}
	      ${renderSidebarSection('Vocab', 'vocab', vocabIndexArticles)}
	      ${renderSidebarSection('Vocab Lists', 'vocab-lists', vocabListArticles)}
	      ${renderCommunitiesSidebarSection('Communities', 'communities', communities)}
	    `;

    wikiSidebarContent.innerHTML = sidebarHtml;

		    function renderCommunityDetailHtml(slug: string): string {
		      const match = slug.match(/^community-(\d+)$/);
		      const id = match ? Number(match[1]) : NaN;
		      if (!Number.isFinite(id)) {
	        return `
	          <div class="wiki-welcome">
	            <h2>Community</h2>
	            <p class="wiki-welcome-subtitle">Invalid community id: ${slug}</p>
	          </div>
	        `;
	      }

		      const info = (data.communities as Record<number, CommunityInfo> | undefined)?.[id];
		      const issues = data.nodes
		        .filter(n => n.type === 'issue' && n.communityId === id)
		        .sort((a, b) => a.label.localeCompare(b.label));

		      const issueIds = new Set(issues.map(i => i.id));
		      const issueById = new Map(issues.map(i => [i.id, i]));

		      const toTopList = <T,>(counts: Map<T, number>, limit: number) =>
		        Array.from(counts.entries())
		          .sort((a, b) => b[1] - a[1])
		          .slice(0, limit);
		      const toTopCountedList = <T, V extends { count: number }>(counts: Map<T, V>, limit: number) =>
		        Array.from(counts.entries())
		          .sort((a, b) => (b[1]?.count ?? 0) - (a[1]?.count ?? 0))
		          .slice(0, limit);

		      const categoryCounts = new Map<string, number>();
		      for (const issue of issues) {
		        for (const category of issue.categories ?? []) {
		          categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
		        }
		      }

		      const systemCounts = new Map<string, number>();
		      for (const issue of issues) {
		        for (const system of issue.affectedSystems ?? []) {
		          systemCounts.set(system, (systemCounts.get(system) || 0) + 1);
		        }
		      }

		      const tagCounts = new Map<string, number>();
		      for (const issue of issues) {
		        const tags = data.articles?.[issue.id]?.frontmatter?.tags;
		        if (!Array.isArray(tags)) continue;
		        for (const tag of tags) {
		          if (typeof tag !== 'string') continue;
		          const trimmed = tag.trim();
		          if (!trimmed) continue;
		          tagCounts.set(trimmed, (tagCounts.get(trimmed) || 0) + 1);
		        }
		      }

		      const issueDegree = new Map<string, number>();
		      const issueInternalDegree = new Map<string, number>();
		      const issueExternalDegree = new Map<string, number>();

		      const externalTargetCounts = new Map<string, { count: number; strengthSum: number; labelCounts: Map<string, number> }>();
		      const connectedCommunityCounts = new Map<number, number>();

		      let internalIssueEdges = 0;
		      let externalIssueEdges = 0;

		      for (const edge of data.edges) {
		        if (edge.type !== 'issue-issue') continue;
		        const sourceIn = issueIds.has(edge.source);
		        const targetIn = issueIds.has(edge.target);
		        if (!sourceIn && !targetIn) continue;

		        // Update degree counts for member issues
		        if (sourceIn) issueDegree.set(edge.source, (issueDegree.get(edge.source) || 0) + 1);
		        if (targetIn) issueDegree.set(edge.target, (issueDegree.get(edge.target) || 0) + 1);

		        if (sourceIn && targetIn) {
		          internalIssueEdges++;
		          issueInternalDegree.set(edge.source, (issueInternalDegree.get(edge.source) || 0) + 1);
		          issueInternalDegree.set(edge.target, (issueInternalDegree.get(edge.target) || 0) + 1);
		          continue;
		        }

		        // Cross-community issue edge
		        externalIssueEdges++;
		        const member = sourceIn ? edge.source : edge.target;
		        const other = sourceIn ? edge.target : edge.source;
		        issueExternalDegree.set(member, (issueExternalDegree.get(member) || 0) + 1);

		        const bucket = externalTargetCounts.get(other) ?? { count: 0, strengthSum: 0, labelCounts: new Map() };
		        bucket.count += 1;
		        bucket.strengthSum += edge.strength || 0;
		        const label = edge.label || 'correlates';
		        bucket.labelCounts.set(label, (bucket.labelCounts.get(label) || 0) + 1);
		        externalTargetCounts.set(other, bucket);

		        const otherNode = data.nodes.find(n => n.id === other && n.type === 'issue');
		        const otherCommunity = otherNode?.communityId;
		        if (typeof otherCommunity === 'number' && otherCommunity !== id) {
		          connectedCommunityCounts.set(otherCommunity, (connectedCommunityCounts.get(otherCommunity) || 0) + 1);
		        }
		      }

		      const systemTargetCounts = new Map<string, { count: number; strengthSum: number; labelCounts: Map<string, number> }>();
		      let externalSystemEdges = 0;
		      for (const edge of data.edges) {
		        if (edge.type !== 'issue-system') continue;
		        const sourceIn = issueIds.has(edge.source);
		        const targetIn = issueIds.has(edge.target);
		        if (!sourceIn && !targetIn) continue;

		        externalSystemEdges++;
		        const member = sourceIn ? edge.source : edge.target;
		        const other = sourceIn ? edge.target : edge.source;
		        issueDegree.set(member, (issueDegree.get(member) || 0) + 1);
		        issueExternalDegree.set(member, (issueExternalDegree.get(member) || 0) + 1);

		        const bucket = systemTargetCounts.get(other) ?? { count: 0, strengthSum: 0, labelCounts: new Map() };
		        bucket.count += 1;
		        bucket.strengthSum += edge.strength || 0;
		        const label = edge.label || 'correlates';
		        bucket.labelCounts.set(label, (bucket.labelCounts.get(label) || 0) + 1);
		        systemTargetCounts.set(other, bucket);
		      }

		      const topInternalIssues = toTopList(issueInternalDegree, 8).map(([issueId]) => issueById.get(issueId)).filter(Boolean) as typeof issues;
		      const topBridgeIssues = issues
		        .filter(i => i.isBridgeNode)
		        .sort((a, b) => (issueExternalDegree.get(b.id) || 0) - (issueExternalDegree.get(a.id) || 0))
		        .slice(0, 8);

		      const topExternalTargets = toTopCountedList(externalTargetCounts, 10).map(([targetId, meta]) => {
		        const node = data.nodes.find(n => n.id === targetId);
		        const title = node?.label ?? targetId;
		        const avgStrength = meta.count > 0 ? meta.strengthSum / meta.count : 0;
		        const topLabel = toTopList(meta.labelCounts, 1)[0]?.[0] ?? 'correlates';
		        return { targetId, title, count: meta.count, avgStrength, label: topLabel };
		      });
		      const topSystemTargets = toTopCountedList(systemTargetCounts, 10).map(([targetId, meta]) => {
		        const node = data.nodes.find(n => n.id === targetId);
		        const title = node?.label ?? targetId;
		        const avgStrength = meta.count > 0 ? meta.strengthSum / meta.count : 0;
		        const topLabel = toTopList(meta.labelCounts, 1)[0]?.[0] ?? 'correlates';
		        return { targetId, title, count: meta.count, avgStrength, label: topLabel };
		      });

		      const topConnectedCommunities = toTopList(connectedCommunityCounts, 8).map(([otherId, count]) => {
		        const other = (data.communities as Record<number, CommunityInfo> | undefined)?.[otherId];
		        return { id: otherId, label: other?.label ?? `Community ${otherId}`, count };
		      });

		      const INITIAL_SHOW = 30;
		      const hasMore = issues.length > INITIAL_SHOW;

	      const slugify = (value: string) =>
	        value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	      const mechanicPageId = (pattern: string, mechanic: string) =>
	        `mechanic--${slugify(pattern)}--${slugify(mechanic)}`;

		      const shared = (info?.sharedMechanics || [])
		        .slice()
		        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
		        .slice(0, 12);

		      return `
		        <div class="wiki-welcome">
		          <h2 style="display:flex; align-items:center; gap:0.6rem;">
		            <span style="width: 12px; height: 12px; border-radius: 50%; background: ${getCommunityColor(id)}; display:inline-block;"></span>
		            ${info?.label ?? `Community ${id}`}
		          </h2>
		          <p class="wiki-welcome-subtitle">${issues.length} issues</p>
		          ${info ? `
		            <div style="display:flex; gap:1rem; flex-wrap:wrap; color:#94a3b8; font-size:0.85rem; margin-top:0.25rem;">
		              <span>Top category: <strong style="color:#e2e8f0; font-weight:600;">${info.topCategory}</strong></span>
		              <span>Mechanic score: <strong style="color:#e2e8f0; font-weight:600;">${info.mechanicScore}</strong></span>
		              <span>Internal links: <strong style="color:#e2e8f0; font-weight:600;">${internalIssueEdges}</strong></span>
		              <span>Cross-community links: <strong style="color:#e2e8f0; font-weight:600;">${externalIssueEdges}</strong></span>
		            </div>
		          ` : ''}
		          ${shared.length > 0 ? `
		            <div style="margin-top:0.9rem;">
		              <h3 style="margin:0 0 0.5rem 0; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; font-size:0.75rem;">Shared mechanics</h3>
		              <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
		                ${shared.map(m => `
	                  <a
	                    class="badge related-link"
	                    href="#/wiki/${mechanicPageId(m.pattern, m.mechanic)}"
	                    style="text-decoration:none; background: rgba(148,163,184,0.12); border: 1px solid rgba(148,163,184,0.18); color:#cbd5e1;"
	                    title="${m.pattern} • ${m.count} issues"
	                  >
	                    ${m.mechanic}
	                  </a>
		                `).join('')}
		              </div>
		            </div>
		          ` : ''}
		        </div>

		        ${(toTopList(categoryCounts, 1).length > 0 || toTopList(tagCounts, 1).length > 0 || toTopList(systemCounts, 1).length > 0) ? `
		          <div class="related-content">
		            <h2>Signature</h2>
		            ${toTopList(categoryCounts, 5).length > 0 ? `
		              <div style="margin-top:0.5rem;">
		                <h3 style="margin:0 0 0.5rem 0; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; font-size:0.75rem;">Categories</h3>
		                <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
		                  ${toTopList(categoryCounts, 8).map(([cat, count]) => `
		                    <span class="badge" style="background: rgba(148,163,184,0.10); border: 1px solid rgba(148,163,184,0.18); color:#cbd5e1;" title="${count} issues">
		                      ${cat}
		                    </span>
		                  `).join('')}
		                </div>
		              </div>
		            ` : ''}
		            ${toTopList(tagCounts, 5).length > 0 ? `
		              <div style="margin-top:0.9rem;">
		                <h3 style="margin:0 0 0.5rem 0; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; font-size:0.75rem;">Dominant tags</h3>
		                <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
		                  ${toTopList(tagCounts, 12).map(([tag, count]) => `
		                    <span class="badge" style="background: rgba(148,163,184,0.10); border: 1px solid rgba(148,163,184,0.18); color:#cbd5e1;" title="${count} issues">
		                      ${tag}
		                    </span>
		                  `).join('')}
		                </div>
		              </div>
		            ` : ''}
		            ${toTopList(systemCounts, 5).length > 0 ? `
		              <div style="margin-top:0.9rem;">
		                <h3 style="margin:0 0 0.5rem 0; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; font-size:0.75rem;">Most affected systems</h3>
		                <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
		                  ${toTopList(systemCounts, 10).map(([system, count]) => `
		                    <a
		                      class="badge related-link"
		                      href="#/wiki/${system}"
		                      style="text-decoration:none; background: rgba(148,163,184,0.10); border: 1px solid rgba(148,163,184,0.18); color:#cbd5e1;"
		                      title="${count} issues"
		                    >
		                      ${system}
		                    </a>
		                  `).join('')}
		                </div>
		              </div>
		            ` : ''}
		          </div>
		        ` : ''}

		        ${(topBridgeIssues.length > 0 || topInternalIssues.length > 0) ? `
		          <div class="related-content">
		            <h2>Key Issues</h2>
		            ${topInternalIssues.length > 0 ? `
		              <h3 style="margin:0.6rem 0 0.5rem 0; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; font-size:0.75rem;">Most connected (within community)</h3>
		              <div class="related-links">
		                ${topInternalIssues.map(n => `
		                  <a href="#/wiki/${n.id}" class="related-link ${n.hasArticle ? 'has-article' : ''}">
		                    ${n.label}
		                    <span style="color:#94a3b8; font-size:0.8rem;">(${issueInternalDegree.get(n.id) || 0} links)</span>
		                    ${n.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
		                  </a>
		                `).join('')}
		              </div>
		            ` : ''}
		            ${topBridgeIssues.length > 0 ? `
		              <h3 style="margin:0.9rem 0 0.5rem 0; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; font-size:0.75rem;">Bridge issues (cross-community)</h3>
		              <div class="related-links">
		                ${topBridgeIssues.map(n => `
		                  <a href="#/wiki/${n.id}" class="related-link ${n.hasArticle ? 'has-article' : ''}">
		                    ${n.label}
		                    <span style="color:#94a3b8; font-size:0.8rem;">(${issueExternalDegree.get(n.id) || 0} outbound links)</span>
		                    ${n.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
		                  </a>
		                `).join('')}
		              </div>
		            ` : ''}
		          </div>
		        ` : ''}

		        ${(topExternalTargets.length > 0 || topSystemTargets.length > 0 || topConnectedCommunities.length > 0) ? `
		          <div class="related-content">
		            <h2>Connections</h2>
		            ${topConnectedCommunities.length > 0 ? `
		              <h3 style="margin:0.6rem 0 0.5rem 0; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; font-size:0.75rem;">Connected communities</h3>
		              <div class="related-links">
		                ${topConnectedCommunities.map(c => `
		                  <a href="#/communities/community-${c.id}" class="related-link">
		                    ${c.label}
		                    <span style="color:#94a3b8; font-size:0.8rem;">(${c.count} edges)</span>
		                  </a>
		                `).join('')}
		              </div>
		            ` : ''}
		            ${topExternalTargets.length > 0 ? `
		              <h3 style="margin:0.9rem 0 0.5rem 0; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; font-size:0.75rem;">Top cross-community issue links</h3>
		              <div class="related-links">
		                ${topExternalTargets.map(t => `
		                  <a href="#/wiki/${t.targetId}" class="related-link">
		                    ${t.title}
		                    <span style="color:#94a3b8; font-size:0.8rem;">(${t.count} • ${t.label} • ${t.avgStrength.toFixed(2)})</span>
		                  </a>
		                `).join('')}
		              </div>
		            ` : ''}
		            ${topSystemTargets.length > 0 ? `
		              <h3 style="margin:0.9rem 0 0.5rem 0; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; font-size:0.75rem;">Most linked systems</h3>
		              <div class="related-links">
		                ${topSystemTargets.map(t => `
		                  <a href="#/wiki/${t.targetId}" class="related-link">
		                    ${t.title}
		                    <span style="color:#94a3b8; font-size:0.8rem;">(${t.count} • ${t.label} • ${t.avgStrength.toFixed(2)})</span>
		                  </a>
		                `).join('')}
		              </div>
		            ` : ''}
		          </div>
		        ` : ''}

		        <div class="related-content">
		          <h2>Issues</h2>
		          <div class="related-links">
		            ${issues.slice(0, INITIAL_SHOW).map(n => `
	              <a
	                href="#/wiki/${n.id}"
	                class="related-link ${n.hasArticle ? 'has-article' : ''}"
	              >
	                ${n.label}
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
	                    ${n.label}
	                    ${n.hasArticle ? '<span class="article-indicator">📄</span>' : ''}
	                  </a>
	                `).join('')}
	              </div>
	              <button class="expand-toggle" data-target="issues" data-expanded="false">
	                <span class="expand-text">+${issues.length - INITIAL_SHOW} more</span>
	                <span class="collapse-text">Show less</span>
	              </button>
	            ` : ''}
	          </div>
	        </div>
	      `;
	    }

	    const renderCommunityCollapsibleSection = (title: string, items: typeof communities) => {
	      if (items.length === 0) return '';
	      return `
	        <details class="wiki-collapsible-section communities-section" open>
	          <summary>
	            <span class="section-title">${title}</span>
	            <span class="section-count">${items.length}</span>
	          </summary>
	          <div class="wiki-article-grid">
	            ${items.map(c => {
	              const slug = `community-${c.id}`;
	              const count = communityIssueCounts.get(c.id) ?? c.size ?? 0;
	              return `
	                <a href="#/communities/${slug}" class="wiki-article-card">
	                  <span class="article-title">${c.label || `Community ${c.id}`}</span>
	                  <span style="color:#94a3b8; font-size:0.8rem; margin-top:0.2rem; display:block;">${count} issues</span>
	                </a>
	              `;
	            }).join('')}
	          </div>
	        </details>
	      `;
	    };

	    // Render article content / community content / welcome message
	    if (selectedCommunity) {
	      wikiArticleContent.innerHTML = renderCommunityDetailHtml(selectedCommunity);
	      wikiArticleContent.scrollTop = 0;
	    } else if (selectedWikiArticle && data.articles[selectedWikiArticle]) {
	      const article = data.articles[selectedWikiArticle];
	      wikiArticleContent.innerHTML = renderWikiArticleContent(article, data);
	      // Reset scroll position when switching articles
	      wikiArticleContent.scrollTop = 0;
	    } else if (wikiSection === 'communities') {
	      wikiArticleContent.innerHTML = `
	        <div class="wiki-welcome-full">
	          <h1>Issue Communities</h1>
	          <p class="wiki-welcome-subtitle">${communities.length} communities detected via Louvain algorithm</p>
	          <div class="wiki-sections">
	            ${renderCommunityCollapsibleSection('Communities', communities)}
	          </div>
	        </div>
	      `;
	    } else {
	      // Render collapsible sections for the main wiki page
	      const renderCollapsibleSection = (title: string, items: typeof articles, typeClass: string) => {
	        if (items.length === 0) return '';
        return `
          <details class="wiki-collapsible-section ${typeClass}" open>
            <summary>
              <span class="section-title">${title}</span>
              <span class="section-count">${items.length}</span>
            </summary>
            <div class="wiki-article-grid">
              ${items.map(article => `
                <a href="#/wiki/${article.id}" class="wiki-article-card">
                  <span class="article-title">${article.title}</span>
                </a>
              `).join('')}
            </div>
          </details>
        `;
      };

      wikiArticleContent.innerHTML = `
        <div class="wiki-welcome-full">
          <h1>Shadow Workipedia</h1>
          <p class="wiki-welcome-subtitle">${articles.length} articles documenting global challenges and systemic risks</p>

	          <div class="wiki-sections">
	            ${renderCollapsibleSection('Issues', issueArticles, 'issues-section')}
	            ${renderCollapsibleSection('Case Studies', caseStudyArticles, 'issues-section')}
	            ${renderCollapsibleSection('Redirects', redirectArticles, 'issues-section')}
	            ${renderCollapsibleSection('Systems', systemArticles, 'systems-section')}
	            ${renderCollapsibleSection('Principles', principleArticles, 'principles-section')}
	            ${renderCollapsibleSection('Primitives', primitiveArticles, 'primitives-section')}
	            ${renderCollapsibleSection('Mechanics', mechanicArticles, 'mechanics-section')}
	            ${renderCollapsibleSection('Countries', countryIndexArticles, 'countries-section')}
	            ${renderCollapsibleSection('Vocab', vocabIndexArticles, 'vocab-section')}
	            ${renderCollapsibleSection('Vocab Lists', vocabListArticles, 'vocab-section')}
	            ${renderCommunityCollapsibleSection('Communities', communities)}
	          </div>
	        </div>
	      `;
	    }

	    // Attach click handlers to sidebar items
	    wikiSidebarContent.querySelectorAll('.wiki-sidebar-item').forEach(item => {
	      item.addEventListener('click', () => {
	        const articleId = item.getAttribute('data-article-id');
	        if (articleId && data.articles && data.articles[articleId]) {
	          const article = data.articles[articleId];
	          // Navigate via router to update URL
	          router.navigateToArticle(article.type, articleId);
	          return;
	        }

	        const communitySlug = item.getAttribute('data-community-slug');
	        if (communitySlug) {
	          router.navigateToCommunity(communitySlug);
	        }
	      });
	    });

    // Persist collapsible section state
    wikiSidebarContent.querySelectorAll<HTMLDetailsElement>('.wiki-sidebar-section').forEach(section => {
      section.addEventListener('toggle', () => {
        const key = section.getAttribute('data-section-key');
        if (!key) return;
        const next = loadWikiSidebarSectionState();
        next[key] = section.open;
        saveWikiSidebarSectionState(next);
      });
    });

    // Attach click handler to expand button (mobile: expand collapsed sidebar)
    const expandBtn = document.getElementById('wiki-sidebar-expand-btn');
    if (expandBtn && wikiSidebar) {
      expandBtn.addEventListener('click', () => {
        wikiSidebar.classList.remove('collapsed');
      });
    }

    // Attach click handler to back button (navigate to graph and show issue card)
    const backBtn = wikiArticleContent.querySelector('.back-btn[data-back-to-graph]');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        const nodeId = backBtn.getAttribute('data-back-to-graph');
        if (nodeId) {
          const targetNode = graph.getNodes().find(n => n.id === nodeId);
          if (targetNode) {
            // Switch to Graph view via router
            router.navigateToView('graph');

            // Select the node and show detail panel
            setSelectedNode(targetNode);
            panelContent.innerHTML = renderDetailPanel(targetNode, data);
            panelContent.scrollTop = 0; // Reset scroll position for new node
            detailPanel.classList.remove('hidden');

            // Attach handlers for detail panel interactions
            attachDetailPanelHandlers();

            // Pan to center on the node if it has coordinates
            if (targetNode.x !== undefined && targetNode.y !== undefined) {
              const centerX = canvas.width / 2;
              const centerY = canvas.height / 2;
              const currentTransform = getCurrentTransform();
              const newX = centerX - targetNode.x * currentTransform.k;
              const newY = centerY - targetNode.y * currentTransform.k;

              currentTransform.x = newX;
              currentTransform.y = newY;

              hoverHandler.updateTransform(currentTransform);
              clickHandler.updateTransform(currentTransform);
              dragHandler.updateTransform(currentTransform);
              zoomHandler.setTransform(currentTransform);
              render();
            }
          }
        }
      });
    }

    // Attach click handlers to related content links (stay within wiki view)
    wikiArticleContent.querySelectorAll('.related-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (!href) return;

        // Preferred: #/wiki/<slug>
        const wikiMatch = href.match(/^#\/wiki\/([a-z0-9-]+)$/);
        if (wikiMatch) {
          const articleId = wikiMatch[1];
          const article = data.articles?.[articleId];
          if (article) {
            router.navigateToArticle(article.type, articleId);
            return;
          }

          // No article exists - show the node in graph view with detail panel
          const targetNode = graph.getNodes().find(n => n.id === articleId);
          if (targetNode) {
            router.navigateToView('graph');
            setSelectedNode(targetNode);
            panelContent.innerHTML = renderDetailPanel(targetNode, data);
            panelContent.scrollTop = 0;
            detailPanel.classList.remove('hidden');
            attachDetailPanelHandlers();
            if (targetNode.x !== undefined && targetNode.y !== undefined) {
              const centerX = canvas.width / 2;
              const centerY = canvas.height / 2;
              const currentTransform = getCurrentTransform();
              currentTransform.x = centerX - targetNode.x * currentTransform.k;
              currentTransform.y = centerY - targetNode.y * currentTransform.k;
              hoverHandler.updateTransform(currentTransform);
              clickHandler.updateTransform(currentTransform);
              dragHandler.updateTransform(currentTransform);
              zoomHandler.setTransform(currentTransform);
              render();
            }
          }
          return;
        }

        // Community links: #/communities/community-N
        const communityMatch = href.match(/^#\/communities\/(community-\d+)$/);
        if (communityMatch) {
          router.navigateToCommunity(communityMatch[1]);
          return;
        }

        // Legacy: #/issue/<slug>, #/system/<slug>, #/principle/<slug>, #/primitive/<slug>
        const legacyMatch = href.match(/^#\/(issue|system|principle|primitive)\/([a-z0-9-]+)$/);
        if (legacyMatch) {
          const type = legacyMatch[1] as 'issue' | 'system' | 'principle' | 'primitive';
          const articleId = legacyMatch[2];
          router.navigateToArticle(type, articleId);
        }
      });
    });

    // Attach click handlers to expand toggle buttons
	    wikiArticleContent.querySelectorAll('.expand-toggle').forEach(button => {
	      button.addEventListener('click', () => {
	        const isExpanded = button.getAttribute('data-expanded') === 'true';
	        const overflow = button.previousElementSibling as HTMLElement;

	        if (overflow && overflow.classList.contains('related-links-overflow')) {
	          overflow.setAttribute('data-expanded', String(!isExpanded));
	          button.setAttribute('data-expanded', String(!isExpanded));
	        }
	      });
	    });
	  }

	
}
