import './style.css';
import type { GraphData, IssueCategory, CommunityInfo, PrimitiveName } from './types';
import { GraphSimulation } from './graph';
import type { SimNode } from './graph';
import { ZoomPanHandler, HoverHandler, ClickHandler, DragHandler } from './interactions';
import { ArticleRouter, renderWikiArticleContent, type RouteType } from './article';
import { initializeAgentsView } from './agentsView';
import { createCanvasContext } from './main/canvas';
import { initializeMainDom } from './main/dom';
import { attachMainHandlers } from './main/handlers';
import { initializeCommandPalette } from './main/palette';
import { createRenderLoop } from './main/render';
import { createTableRenderer } from './main/table';
import { createWikiRenderer } from './main/wiki';
import { createViewController } from './main/views';
import { initializeMainState } from './main/state';
import { polygonHull, polygonCentroid } from 'd3-polygon';

// Category color mapping (must match extract-data.ts)
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

// Community color palette (23 distinct colors for 23 communities)
const COMMUNITY_COLORS: Record<number, string> = {
  0: '#3b82f6',   // Blue
  1: '#10b981',   // Green
  2: '#ef4444',   // Red
  3: '#8b5cf6',   // Purple
  4: '#f59e0b',   // Orange
  5: '#06b6d4',   // Cyan
  6: '#ec4899',   // Pink
  7: '#6366f1',   // Indigo
  8: '#14b8a6',   // Teal
  9: '#f97316',   // Deep Orange
  10: '#a855f7',  // Violet
  11: '#22c55e',  // Lime
  12: '#eab308',  // Yellow
  13: '#e11d48',  // Rose
  14: '#0ea5e9',  // Sky
  15: '#84cc16',  // Lime Green
  16: '#f43f5e',  // Red-Pink
  17: '#06b6d4',  // Cyan2
  18: '#d946ef',  // Fuchsia
  19: '#64748b',  // Slate
  20: '#0891b2',  // Cyan3
  21: '#dc2626',  // Red2
  22: '#7c3aed',  // Violet2
};

// Primitive colors for hull overlays (matching simulation primitives)
const PRIMITIVE_COLORS: Record<string, { color: string; label: string }> = {
  TrustErosion: { color: '#ef4444', label: 'Trust Erosion' },
  DeathSpiral: { color: '#dc2626', label: 'Death Spiral' },
  ThresholdCascade: { color: '#f97316', label: 'Threshold Cascade' },
  CapacityStress: { color: '#eab308', label: 'Capacity Stress' },
  ContagionPropagation: { color: '#84cc16', label: 'Contagion' },
  LegitimacyDynamics: { color: '#22c55e', label: 'Legitimacy' },
  FeedbackLoop: { color: '#14b8a6', label: 'Feedback Loop' },
  PolicyContagion: { color: '#06b6d4', label: 'Policy Contagion' },
  ResourceDepletion: { color: '#0ea5e9', label: 'Resource Depletion' },
  ExodusMigration: { color: '#3b82f6', label: 'Exodus Migration' },
  CaptureConcentration: { color: '#6366f1', label: 'Capture' },
  ResistanceBacklash: { color: '#8b5cf6', label: 'Resistance' },
  QueueBacklog: { color: '#a855f7', label: 'Queue Backlog' },
  AdaptiveResistance: { color: '#d946ef', label: 'Adaptive Resistance' },
};

function getCategoryColor(category: IssueCategory): string {
  return CATEGORY_COLORS[category];
}

function getCommunityColor(communityId: number): string {
  return COMMUNITY_COLORS[communityId] || '#64748b'; // Fallback to gray
}

function getPrimitiveColor(primitive: PrimitiveName): string {
  return PRIMITIVE_COLORS[primitive]?.color || '#64748b';
}

function getPrimitiveLabel(primitive: PrimitiveName): string {
  return PRIMITIVE_COLORS[primitive]?.label || primitive;
}

/**
 * Convert hex color to rgba with specified alpha
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderDetailPanel(node: SimNode, data: GraphData): string {
  // If node has a wiki article, show the article content
  if (node.hasArticle && data.articles && data.articles[node.id]) {
    const article = data.articles[node.id];
    const fileBackedTypes: Array<typeof article.type> = ['issue', 'system', 'principle', 'primitive', 'mechanic'];
    const isFileBacked = fileBackedTypes.includes(article.type);
    return `
      <div class="panel-article-view">
        <div class="panel-article-header">
          <div class="article-meta">
            <span class="article-type-badge">${article.type}</span>
            <span class="article-word-count">${article.wordCount.toLocaleString()} words</span>
          </div>
        </div>
        <button
          class="read-article-btn"
          data-wiki-article-id="${article.id}"
          data-wiki-article-type="${article.type}"
        >
          Open in Wiki
        </button>
        <article class="article-content">
          ${article.html}
        </article>
        ${renderPanelRelatedContent(node, data)}
        <div class="article-footer">
          ${isFileBacked ? `
            <a
              href="https://github.com/mistakeknot/shadow-workipedia/edit/main/wiki/${article.type}s/${article.id}.md"
              target="_blank"
              class="edit-link"
            >
              📝 Edit this article on GitHub
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Fallback: show basic issue/system card if no article
  if (node.type === 'issue') {
    return `
      <h2>${node.label}</h2>
      <div class="node-badges">
        ${node.categories?.map(cat => `<span class="badge category-badge" style="background: ${getCategoryColor(cat)}">${cat}</span>`).join('') || ''}
        <span class="badge urgency-${node.urgency?.toLowerCase()}">${node.urgency}</span>
      </div>
      <p class="description">${node.description || 'No description available.'}</p>

      <button
        class="read-article-btn"
        data-wiki-article-id="${node.id}"
        data-wiki-article-type="issue"
      >
        Open in Wiki
      </button>

      ${node.affectedSystems && node.affectedSystems.length > 0 ? `
        <h3>Affected Systems</h3>
        <div class="affected-systems">
          ${node.affectedSystems.map(system => {
            // Convert system name to ID (kebab-case)
            const systemId = system.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            return `<span class="badge system-badge clickable-badge" data-system-id="${systemId}" data-system-name="${system}">${system}</span>`;
          }).join('')}
        </div>
      ` : ''}

      ${node.triggerConditions ? `
        <h3>Trigger Conditions</h3>
        <p class="metadata-text">${node.triggerConditions}</p>
      ` : ''}

      ${node.peakYears ? `
        <h3>Peak Years</h3>
        <p class="metadata-text">${node.peakYears}</p>
      ` : ''}

      ${node.crisisExamples && node.crisisExamples.length > 0 ? `
        <h3>Crisis Examples</h3>
        <ul class="crisis-list">
          ${node.crisisExamples.map(example => `
            <li>${example}</li>
          `).join('')}
        </ul>
      ` : ''}

      <h3>Connected Nodes (${getConnections(node, data).length})</h3>
      <div class="connections">
        ${getConnections(node, data, 20).map(conn => `
          <div class="connection-item" data-node-id="${conn.id}">
            <span class="connection-type">${conn.type}</span>
            <span class="connection-name">${conn.label}</span>
          </div>
        `).join('')}
        ${getConnections(node, data).length > 20 ? `<span class="more-count">+${getConnections(node, data).length - 20} more</span>` : ''}
      </div>
    `;
  } else {
    const allConnections = getConnections(node, data);
    return `
      <h2>${node.label}</h2>
      <div class="node-badges">
        <span class="badge" style="background: ${node.color}">System</span>
      </div>
      <p class="description">${node.description || 'Simulation system'}</p>

      <h3>Stats</h3>
      <div class="stat-item">
        <span>Connections:</span>
        <strong>${allConnections.length}</strong>
      </div>

      <h3>Connected Nodes</h3>
      <div class="connections">
        ${allConnections.slice(0, 30).map(conn => `
          <div class="connection-item" data-node-id="${conn.id}">
            <span class="connection-type">${conn.type}</span>
            <span class="connection-name">${conn.label}</span>
          </div>
        `).join('')}
        ${allConnections.length > 30 ? `<span class="more-count">+${allConnections.length - 30} more</span>` : ''}
      </div>
    `;
  }
}

function renderPanelRelatedContent(node: SimNode, data: GraphData): string {
  const connections = getConnections(node, data); // No limit - get all
  const connectedIssues = connections.filter(c => {
    const n = data.nodes.find(node => node.id === c.id);
    return n?.type === 'issue';
  });
  const connectedSystems = connections.filter(c => {
    const n = data.nodes.find(node => node.id === c.id);
    return n?.type === 'system';
  });

  const caseStudies = node.type === 'issue' && data.articles
    ? Object.values(data.articles)
        .filter(a => {
          const parent = a.frontmatter?.caseStudyOf;
          return a.type === 'issue' && typeof parent === 'string' && parent.trim() === node.id;
        })
        .sort((a, b) => a.title.localeCompare(b.title))
    : [];

  return `
    <div class="related-content">
      <h2>Related Content</h2>

      ${connectedIssues.length > 0 ? `
        <div class="related-section">
          <h3>Connected Issues (${connectedIssues.length})</h3>
          <div class="connections">
            ${connectedIssues.map(conn => `
              <div class="connection-item" data-node-id="${conn.id}">
                <span class="connection-name">${conn.label}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${caseStudies.length > 0 ? `
        <div class="related-section">
          <h3>Case Studies (${caseStudies.length})</h3>
          <div class="connections">
            ${caseStudies.map(a => `
              <a class="connection-item" href="#/wiki/${a.id}">
                <span class="connection-name">${a.title}</span>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${connectedSystems.length > 0 ? `
        <div class="related-section">
          <h3>Related Systems (${connectedSystems.length})</h3>
          <div class="connections">
            ${connectedSystems.map(conn => `
              <div class="connection-item" data-node-id="${conn.id}">
                <span class="connection-name">${conn.label}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function getConnections(node: SimNode, data: GraphData, limit?: number): Array<{id: string, label: string, type: string}> {
  const connections: Array<{id: string, label: string, type: string}> = [];
  const seen = new Set<string>(); // Deduplicate connections

  for (const edge of data.edges) {
    if (edge.source === node.id) {
      const target = data.nodes.find(n => n.id === edge.target);
      if (target && !seen.has(target.id)) {
        seen.add(target.id);
        connections.push({
          id: target.id,
          label: target.label,
          type: edge.type.replace('-', ' → '),
        });
      }
    } else if (edge.target === node.id) {
      const source = data.nodes.find(n => n.id === edge.source);
      if (source && !seen.has(source.id)) {
        seen.add(source.id);
        connections.push({
          id: source.id,
          label: source.label,
          type: edge.type.replace('-', ' ← '),
        });
      }
    }
  }

  // Sort alphabetically by label
  connections.sort((a, b) => a.label.localeCompare(b.label));

  return limit ? connections.slice(0, limit) : connections;
}

async function main() {
  console.log('🚀 Shadow Workipedia initializing...');

  // Load data
  let data: GraphData;
  let dataLoadError: string | null = null;
  try {
    const response = await fetch('/data.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    data = (await response.json()) as GraphData;
  } catch (err) {
    dataLoadError = (err instanceof Error ? err.message : String(err)) || 'Unknown error';
    console.warn(`[Shadow Workipedia] Failed to load /data.json: ${dataLoadError}`);
    const now = new Date().toISOString();
    data = {
      nodes: [],
      edges: [],
      metadata: {
        generatedAt: now,
        issueCount: 0,
        systemCount: 0,
        edgeCount: 0,
      },
    };
  }

  console.log(`📊 Loaded ${data.metadata.issueCount} issues, ${data.metadata.systemCount} systems`);
  if (data.metadata.articleCount) {
    console.log(`📚 ${data.metadata.articleCount} wiki articles available`);
  }

  function resolveIssueId(id: string): string {
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

  const {
    loading,
    warningBanner,
    graphView,
    tableView,
    wikiView,
    agentsView,
    agentsContainer,
    wikiSidebarContent,
    wikiArticleContent,
    articleView,
    header,
    tabNav,
    filterBar,
    tooltip,
    detailPanel,
    panelContent,
    closeBtn,
  } = initializeMainDom();

  // Hide loading indicator
  if (loading) loading.classList.add('hidden');

  if (warningBanner) {
    if (dataLoadError) {
      warningBanner.classList.remove('hidden');
      const extra =
        window.location.protocol === 'file:'
          ? ` You appear to be opening the site via <code>file://</code>; use <code>pnpm dev</code> or <code>pnpm preview</code> instead.`
          : '';
      warningBanner.innerHTML = `No <code>/data.json</code> found. Run <code>pnpm -C shadow-workipedia extract-data</code> (or <code>pnpm -C shadow-workipedia build:full</code>) then reload.${extra}`;
    } else if (data.nodes.length === 0) {
      warningBanner.classList.remove('hidden');
      warningBanner.innerHTML = `Loaded <code>/data.json</code> but it contains 0 nodes. Re-run <code>pnpm -C shadow-workipedia extract-data</code> and reload.`;
    } else {
      warningBanner.classList.add('hidden');
      warningBanner.textContent = '';
    }
  }

	  // Track selected wiki article
	  let selectedWikiArticle: string | null = null;
	  let selectedCommunity: string | null = null;
	  let wikiSection: 'articles' | 'communities' = 'articles';

	  // View state (needed early for router initialization)
	  let currentView: 'graph' | 'table' | 'wiki' | 'agents' | 'communities' = 'graph';

	  // Forward declare render functions (implemented later)
	  let render: () => void = () => {};
	  let renderTable: () => void;
	  let renderWikiList: () => void;

	  // Initialize Agents view (independent of extracted data)
	  initializeAgentsView(agentsContainer as HTMLElement);

  // Store router reference for navigation
  let router: ArticleRouter;

  const viewController = createViewController({
    graphView,
    tableView,
    wikiView,
    agentsView,
    articleView,
    header,
    tabNav,
    filterBar,
    viewModeToggles: document.getElementById('view-mode-toggles'),
    categoryFilters: document.getElementById('category-filters'),
    clusterToggle: document.getElementById('cluster-toggle'),
    tabGraph: document.getElementById('tab-graph'),
    tabTable: document.getElementById('tab-table'),
    tabWiki: document.getElementById('tab-wiki'),
    tabAgents: document.getElementById('tab-agents'),
    renderWikiList: () => renderWikiList(),
    onViewChange: (view) => {
      currentView = view;
      if (view === 'table') {
        renderTable();
      }
    },
  });

  const showView = viewController.showView;

  // Initialize article router (side effects only - registers hash change listener)
  router = new ArticleRouter((route: RouteType) => {
    // Hide tooltip on any route change
    const tooltipEl = document.getElementById('tooltip');
    if (tooltipEl) tooltipEl.classList.add('hidden');

    if (!route) {
      // Default to graph view
      showView('graph');
      return;
    }

    if (route.kind === 'view') {
      // View route - show the appropriate view
      // Clear selected wiki article when navigating to wiki list (not an article)
      if (route.view === 'wiki') {
        selectedWikiArticle = null;
        selectedCommunity = null;
        wikiSection = 'articles';
      }
      if (route.view === 'communities') {
        selectedCommunity = null;
        selectedWikiArticle = null;
        wikiSection = 'communities';
      }
      showView(route.view);
    } else if (route.kind === 'article') {
      // Handle wiki-level redirects/merges for any article type.
      const current = data.articles?.[route.slug];
      const mergedInto = typeof current?.frontmatter?.mergedInto === 'string' ? current.frontmatter.mergedInto.trim() : '';
      if (mergedInto && data.articles?.[mergedInto]) {
        window.location.hash = '#/wiki/' + mergedInto;
        return;
      }

      // Both issue and system articles show in wiki view with sidebar
      if (route.type === 'issue') {
        const resolved = resolveIssueId(route.slug);
        if ((!data.articles || !data.articles[route.slug]) && resolved !== route.slug && data.articles?.[resolved]) {
          window.location.hash = '#/wiki/' + resolved;
          return;
        }
      }

      selectedWikiArticle = route.slug;
      selectedCommunity = null;
      wikiSection = 'articles';
      showView('wiki');
      // Re-render to update selection and article content
      if (renderWikiList) renderWikiList();
    } else if (route.kind === 'community') {
      selectedCommunity = route.slug;
      selectedWikiArticle = null;
      wikiSection = 'communities';
      showView('communities');
      // Re-render to update selection and article content
      if (renderWikiList) renderWikiList();
    }
  });

  // Get canvas
  const { canvas, ctx } = createCanvasContext();

  // Transform state
  const initialState = initializeMainState();
  let {
    currentTransform,
    hoveredNode,
    selectedNode,
    connectedToSelected,
    showIssues,
    showSystems,
    showPrinciples,
    showPrimitives,
    showDataFlows,
    selectedPrimitive,
    showClusters,
    searchTerm,
    tableSortColumn,
    tableSortDirection,
  } = initialState;
  const { activeCategories, searchResults } = initialState;

  // Initialize simulation
  const graph = new GraphSimulation(data, canvas.width, canvas.height);

  // Size canvas to window (function defined early, called later after all dependencies are ready)
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    // Calculate header (includes tabs) + filter bar height dynamically
    const header = document.getElementById('header');
    const filterBar = document.getElementById('filter-bar');
    const headerHeight = header?.offsetHeight || 0;
    const filterHeight = filterBar?.offsetHeight || 0;
    canvas.height = window.innerHeight - headerHeight - filterHeight;

    // Restart simulation with new dimensions
    graph.restart();
    render();
  }

  // Initialize drag handler (must be before hover to handle mousedown first)
  const dragHandler = new DragHandler(
    canvas,
    graph.getNodes(),
    render,
    {
      onReheatSimulation: () => graph.restart()
    }
  );

  // Initialize hover handler
  const hoverHandler = new HoverHandler(
    canvas,
    graph.getNodes(),
    (node) => {
      hoveredNode = node;

      if (node) {
        // Show tooltip
        tooltip.innerHTML = `
          <div class="node-name">${node.label}</div>
          <div class="node-meta">
            ${node.type === 'issue'
              ? `${node.categories?.join(', ') || 'No category'} • ${node.urgency}`
              : `System • ${node.connectionCount} connections`
            }
          </div>
        `;
        tooltip.classList.remove('hidden');

        // Position tooltip near cursor
        canvas.style.cursor = 'pointer';
      } else {
        tooltip.classList.add('hidden');
        canvas.style.cursor = 'grab';
      }

      render(); // Re-render to highlight hovered node
    }
  );

  // Update tooltip position on mouse move
  canvas.addEventListener('mousemove', (event) => {
    if (!tooltip.classList.contains('hidden')) {
      tooltip.style.left = `${event.clientX + 16}px`;
      tooltip.style.top = `${event.clientY + 16}px`;
    }
  });

  function recomputeConnectedToSelected() {
    connectedToSelected = new Set<string>();
    if (!selectedNode) return;

    const selectedId = selectedNode.id;
    for (const link of graph.getLinks()) {
      if (link.source.id === selectedId) {
        connectedToSelected.add(link.target.id);
      } else if (link.target.id === selectedId) {
        connectedToSelected.add(link.source.id);
      }
    }
  }

  function setSelectedNode(node: SimNode | null) {
    selectedNode = node;
    recomputeConnectedToSelected();
  }
  // Shared function to attach detail panel interaction handlers
  function attachDetailPanelHandlers() {
    // Handle connection item clicks
    const connectionItems = panelContent.querySelectorAll('.connection-item');
    connectionItems.forEach(item => {
      item.addEventListener('click', () => {
        const nodeId = item.getAttribute('data-node-id');
        const targetNode = graph.getNodes().find(n => n.id === nodeId);
        if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined) {
          setSelectedNode(targetNode);
          panelContent.innerHTML = renderDetailPanel(targetNode, data);
          panelContent.scrollTop = 0; // Reset scroll position for new node
          attachDetailPanelHandlers(); // Re-attach handlers for new connections
          tooltip.classList.add('hidden');

          // Pan to center the selected node
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const newX = centerX - targetNode.x * currentTransform.k;
          const newY = centerY - targetNode.y * currentTransform.k;

          const startX = currentTransform.x;
          const startY = currentTransform.y;
          const duration = 500;
          const startTime = Date.now();

          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            currentTransform.x = startX + (newX - startX) * eased;
            currentTransform.y = startY + (newY - startY) * eased;

            hoverHandler.updateTransform(currentTransform);
            clickHandler.updateTransform(currentTransform);
            dragHandler.updateTransform(currentTransform);
            render();

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              zoomHandler.setTransform(currentTransform);
            }
          };

          animate();
        }
      });
    });

    // Handle read/open-in-wiki button clicks (navigate to wiki view)
    const readArticleBtns = panelContent.querySelectorAll('.read-article-btn[data-wiki-article-id]');
    readArticleBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const articleId = btn.getAttribute('data-wiki-article-id');
        if (!articleId) return;

        const explicitType = btn.getAttribute('data-wiki-article-type') as ('issue' | 'system' | 'principle' | null);
        const inferredType = data.articles?.[articleId]?.type as ('issue' | 'system' | 'principle' | undefined);
        const type = explicitType || inferredType || 'issue';

        detailPanel.classList.add('hidden');
        setSelectedNode(null);
        // Navigate to the wiki article (updates URL)
        router.navigateToArticle(type, articleId);
      });
    });

    // Handle system badge clicks
    const systemBadges = panelContent.querySelectorAll('.clickable-badge[data-system-id]');
    systemBadges.forEach(badge => {
      badge.addEventListener('click', () => {
        const systemId = badge.getAttribute('data-system-id');
        const systemName = badge.getAttribute('data-system-name');
        const targetNode = graph.getNodes().find(n => n.id === systemId && n.type === 'system');

        if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined) {
          // Enable systems toggle if clicking on a system
          if (!showSystems) {
            showSystems = true;
            const showSystemsBtn = document.getElementById('show-systems-btn') as HTMLButtonElement;
            if (showSystemsBtn) showSystemsBtn.classList.add('active');
          }

          setSelectedNode(targetNode);
          panelContent.innerHTML = renderDetailPanel(targetNode, data);
          panelContent.scrollTop = 0; // Reset scroll position for new node
          attachDetailPanelHandlers();
          tooltip.classList.add('hidden');

          // Pan to center the system node
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const newX = centerX - targetNode.x * currentTransform.k;
          const newY = centerY - targetNode.y * currentTransform.k;

          const startX = currentTransform.x;
          const startY = currentTransform.y;
          const duration = 500;
          const startTime = Date.now();

          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            currentTransform.x = startX + (newX - startX) * eased;
            currentTransform.y = startY + (newY - startY) * eased;

            hoverHandler.updateTransform(currentTransform);
            clickHandler.updateTransform(currentTransform);
            dragHandler.updateTransform(currentTransform);
            render();

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              zoomHandler.setTransform(currentTransform);
            }
          };

          animate();
        } else {
          console.warn(`System node not found: ${systemName} (${systemId})`);
        }
      });
    });
  }

  // Initialize click handler
  const clickHandler = new ClickHandler(
    canvas,
    graph.getNodes(),
    (node) => {
      setSelectedNode(node);

      if (node && node.x !== undefined && node.y !== undefined) {
        // Show detail panel
        panelContent.innerHTML = renderDetailPanel(node, data);
        panelContent.scrollTop = 0; // Reset scroll position for new node
        detailPanel.classList.remove('hidden');
        // Hide tooltip when detail panel opens (prevents overlap on mobile)
        tooltip.classList.add('hidden');

        // Pan to center the clicked node
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const newX = centerX - node.x * currentTransform.k;
        const newY = centerY - node.y * currentTransform.k;

        // Smooth transition
        const startX = currentTransform.x;
        const startY = currentTransform.y;
        const duration = 500;
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);

          currentTransform.x = startX + (newX - startX) * eased;
          currentTransform.y = startY + (newY - startY) * eased;

          hoverHandler.updateTransform(currentTransform);
          clickHandler.updateTransform(currentTransform);
          dragHandler.updateTransform(currentTransform);
          render();

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Sync d3-zoom's internal transform to prevent jump on next pan
            zoomHandler.setTransform(currentTransform);
          }
        };

        animate();

        // Add click handlers to connection items and system badges
        attachDetailPanelHandlers();
      } else {
        detailPanel.classList.add('hidden');
      }

      render();
    }
  );

  clickHandler.updateTransform(currentTransform);

  attachMainHandlers({
    graph,
    data,
    render,
    renderTable: () => renderTable(),
    detailPanel,
    closeBtn,
    setSelectedNode,
    getCurrentView: () => currentView,
    getShowIssues: () => showIssues,
    setShowIssues: (value) => {
      showIssues = value;
    },
    getShowSystems: () => showSystems,
    setShowSystems: (value) => {
      showSystems = value;
    },
    getShowPrinciples: () => showPrinciples,
    setShowPrinciples: (value) => {
      showPrinciples = value;
    },
    getShowPrimitives: () => showPrimitives,
    setShowPrimitives: (value) => {
      showPrimitives = value;
    },
    getShowDataFlows: () => showDataFlows,
    setShowDataFlows: (value) => {
      showDataFlows = value;
    },
    getSelectedPrimitive: () => selectedPrimitive,
    setSelectedPrimitive: (value) => {
      selectedPrimitive = value;
    },
    setShowClusters: (value) => {
      showClusters = value;
    },
    setSearchTerm: (value) => {
      searchTerm = value;
    },
    activeCategories,
    searchResults,
    getPrimitiveColor,
    getPrimitiveLabel,
  });

  // Initialize zoom/pan
  const zoomHandler = new ZoomPanHandler(canvas, (transform) => {
    currentTransform = transform;
    hoverHandler.updateTransform(transform);
    clickHandler.updateTransform(transform);
    dragHandler.updateTransform(transform);
    render();
  });

  // Connect drag handler to zoom handler (so drag can disable pan)
  dragHandler.setZoomHandler(zoomHandler);

  // Fit entire graph to view with padding
  function fitToView() {
    const nodes = graph.getNodes();
    if (nodes.length === 0) return;

    // Calculate bounding box of all nodes
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const node of nodes) {
      if (node.x !== undefined && node.y !== undefined) {
        minX = Math.min(minX, node.x - node.size);
        maxX = Math.max(maxX, node.x + node.size);
        minY = Math.min(minY, node.y - node.size);
        maxY = Math.max(maxY, node.y + node.size);
      }
    }

    if (!isFinite(minX)) return;

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const graphCenterX = (minX + maxX) / 2;
    const graphCenterY = (minY + maxY) / 2;

    // Add padding (10% on each side)
    const padding = 0.1;
    const availableWidth = canvas.width * (1 - 2 * padding);
    const availableHeight = canvas.height * (1 - 2 * padding);

    // Calculate scale to fit
    const scaleX = availableWidth / graphWidth;
    const scaleY = availableHeight / graphHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in past 1x

    // Calculate translation to center
    const canvasCenterX = canvas.width / 2;
    const canvasCenterY = canvas.height / 2;
    const translateX = canvasCenterX - graphCenterX * scale;
    const translateY = canvasCenterY - graphCenterY * scale;

    // Apply transform
    currentTransform = { x: translateX, y: translateY, k: scale };
    zoomHandler.setTransform(currentTransform);
    hoverHandler.updateTransform(currentTransform);
    clickHandler.updateTransform(currentTransform);
    dragHandler.updateTransform(currentTransform);
    render();
  }

  // Helper to calculate visible nodes based on current filters
  function getVisibleNodes(): SimNode[] {
    return graph.getNodes().filter(node => {
      // View toggle filtering
      if (node.type === 'issue' && !showIssues) return false;
      if (node.type === 'system' && !showSystems) return false;
      if (node.type === 'principle' && !showPrinciples) return false;

      // Category filtering - show node if ANY of its categories are active (additive filtering)
      // Systems and Principles don't have categories, so always show them based on view mode
      if (node.type === 'principle') return true;
      if (!node.categories || node.categories.length === 0) return true;
      const anyCategoryActive = node.categories.some(cat => activeCategories.has(cat));
      return anyCategoryActive;
    });
  }

  /**
   * Render convex hulls around community clusters
   */
  function renderCommunityHulls(
    ctx: CanvasRenderingContext2D,
    nodes: SimNode[],
    communities: Record<number, CommunityInfo> | undefined,
    transform: { x: number; y: number; k: number }
  ) {
    if (!communities) return;

    // Group nodes by community
    const communityNodes = new Map<number, Array<[number, number]>>();
    for (const node of nodes) {
      if (node.communityId !== undefined && node.x !== undefined && node.y !== undefined) {
        if (!communityNodes.has(node.communityId)) {
          communityNodes.set(node.communityId, []);
        }
        communityNodes.get(node.communityId)!.push([node.x, node.y]);
      }
    }

    // Draw hull for each community
    for (const [communityId, points] of communityNodes) {
      if (points.length < 3) continue; // Need 3+ points for hull

      const hull = polygonHull(points);
      if (!hull) continue;

      // Expand hull with padding
      const centroid = polygonCentroid(hull);
      const expandedHull = hull.map(([x, y]: [number, number]) => {
        const dx = x - centroid[0];
        const dy = y - centroid[1];
        const len = Math.sqrt(dx * dx + dy * dy);
        const padding = 30; // pixels of padding
        return [x + (dx / len) * padding, y + (dy / len) * padding] as [number, number];
      });

      // Draw filled region
      ctx.beginPath();
      const [first, ...rest] = expandedHull;
      ctx.moveTo(
        first[0] * transform.k + transform.x,
        first[1] * transform.k + transform.y
      );
      for (const [x, y] of rest) {
        ctx.lineTo(x * transform.k + transform.x, y * transform.k + transform.y);
      }
      ctx.closePath();

      const color = getCommunityColor(communityId);
      ctx.fillStyle = hexToRgba(color, 0.08);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(color, 0.3);
      ctx.lineWidth = 2 / transform.k;
      ctx.stroke();
    }
  }

  /**
   * Render labels at community centroids
   */
  function renderCommunityLabels(
    ctx: CanvasRenderingContext2D,
    nodes: SimNode[],
    communities: Record<number, CommunityInfo> | undefined,
    transform: { x: number; y: number; k: number }
  ) {
    if (!communities) return;

    // Calculate centroids
    const centroids = new Map<number, { x: number; y: number; count: number }>();
    for (const node of nodes) {
      if (node.communityId !== undefined && node.x !== undefined && node.y !== undefined) {
        if (!centroids.has(node.communityId)) {
          centroids.set(node.communityId, { x: 0, y: 0, count: 0 });
        }
        const c = centroids.get(node.communityId)!;
        c.x += node.x;
        c.y += node.y;
        c.count++;
      }
    }

    // Draw labels at centroids
    for (const [communityId, { x, y, count }] of centroids) {
      const community = communities[communityId];
      if (!community) continue;

      const cx = (x / count) * transform.k + transform.x;
      const cy = (y / count) * transform.k + transform.y;

      // Scale-aware font size (larger when zoomed out)
      const fontSize = Math.max(10, Math.min(16, 14 / transform.k));
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Text with shadow for readability
      const label = community.topCategory;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillText(label, cx + 1, cy + 1);
      ctx.fillStyle = getCommunityColor(communityId);
      ctx.fillText(label, cx, cy);
    }
  }

  // Helper function to draw an arrow at the end of an edge
  function drawArrow(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    nodeRadius: number,
    arrowSize: number
  ) {
    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Calculate arrow tip position (at edge of target node)
    const tipX = toX - nodeRadius * Math.cos(angle);
    const tipY = toY - nodeRadius * Math.sin(angle);

    // Arrow wings
    const wingAngle = Math.PI / 6; // 30 degrees
    const leftX = tipX - arrowSize * Math.cos(angle - wingAngle);
    const leftY = tipY - arrowSize * Math.sin(angle - wingAngle);
    const rightX = tipX - arrowSize * Math.cos(angle + wingAngle);
    const rightY = tipY - arrowSize * Math.sin(angle + wingAngle);

    // Draw filled arrowhead
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fill();
  }

  // Helper function to draw a diamond shape for principle nodes
  function drawDiamond(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x, y - size);      // Top
    ctx.lineTo(x + size, y);      // Right
    ctx.lineTo(x, y + size);      // Bottom
    ctx.lineTo(x - size, y);      // Left
    ctx.closePath();
  }

  // Render loop
  render = createRenderLoop({
    canvas,
    ctx,
    graph,
    data,
    hoverHandler,
    clickHandler,
    dragHandler,
    getVisibleNodes,
    getCurrentTransform: () => currentTransform,
    getShowClusters: () => showClusters,
    getShowDataFlows: () => showDataFlows,
    getSelectedNode: () => selectedNode,
    getHoveredNode: () => hoveredNode,
    getSearchTerm: () => searchTerm,
    searchResults,
    getConnectedToSelected: () => connectedToSelected,
    getSelectedPrimitive: () => selectedPrimitive,
    getPrimitiveColor,
    getCategoryColor,
    renderCommunityHulls,
    renderCommunityLabels,
    drawArrow,
    drawDiamond,
    fitToView,
  }).render;

  // Now that all dependencies (activeCategories, searchTerm, etc.) are initialized,
  // we can safely call resizeCanvas which calls render
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Set up reset button
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Restart simulation and fit to view after it settles
      graph.restart();
      setTimeout(fitToView, 300);

      // Reset categories
      activeCategories.clear();
      Object.keys(CATEGORY_COLORS).forEach((category) => {
        activeCategories.add(category);
      });

      // Reset button states
      document.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.classList.add('active');
      });

      // Clear search
      const resetSearchInput = document.getElementById('search') as HTMLInputElement | null;
      if (resetSearchInput) {
        resetSearchInput.value = '';
      }
      searchTerm = '';
      searchResults.clear();

      // Clear selection
      setSelectedNode(null);
      detailPanel.classList.add('hidden');

      render();
    });
  }

	  // Set up tab navigation
	  const tabGraph = document.getElementById('tab-graph') as HTMLButtonElement;
	  const tabTable = document.getElementById('tab-table') as HTMLButtonElement;
	  const tabWiki = document.getElementById('tab-wiki') as HTMLButtonElement;
	  const tabAgents = document.getElementById('tab-agents') as HTMLButtonElement;
	  const tableContainer = document.getElementById('table-container') as HTMLDivElement;

  renderTable = createTableRenderer({
    graph,
    data,
    getShowIssues: () => showIssues,
    getShowSystems: () => showSystems,
    activeCategories,
    getSelectedPrimitive: () => selectedPrimitive,
    getSearchTerm: () => searchTerm,
    searchResults,
    getTableSortColumn: () => tableSortColumn,
    setTableSortColumn: (value) => {
      tableSortColumn = value;
    },
    getTableSortDirection: () => tableSortDirection,
    setTableSortDirection: (value) => {
      tableSortDirection = value;
    },
    getCategoryColor,
    tableContainer,
    setSelectedNode,
    panelContent,
    detailPanel,
    tooltip,
    renderDetailPanel,
    attachDetailPanelHandlers,
  });

  // Tab clicks navigate via router (which updates URL and calls showView)
  tabGraph.addEventListener('click', () => router.navigateToView('graph'));
  tabTable.addEventListener('click', () => router.navigateToView('table'));
	  tabAgents.addEventListener('click', () => router.navigateToView('agents'));
	  tabWiki.addEventListener('click', () => {
	    // If a node is selected, navigate to its wiki article
	    if (selectedNode) {
      const nodeId = selectedNode.id;
      const nodeType = selectedNode.type;
      // Clear selection and close detail panel
      setSelectedNode(null);
      const detailPanel = document.getElementById('detail-panel');
      if (detailPanel) detailPanel.classList.add('hidden');
      // Navigate to the wiki article
      router.navigateToArticle(nodeType, nodeId);
    } else {
      router.navigateToView('wiki');
	    }
	  });

  initializeCommandPalette({
    router,
    graph,
    data,
    canvas,
    hoverHandler,
    clickHandler,
    dragHandler,
    zoomHandler,
    getCurrentTransform: () => currentTransform,
    getCurrentView: () => currentView,
    getShowIssues: () => showIssues,
    getShowSystems: () => showSystems,
    getShowPrinciples: () => showPrinciples,
    setSelectedNode,
    panelContent,
    detailPanel,
    tooltip,
    renderDetailPanel,
    attachDetailPanelHandlers,
    render,
    resetBtn: resetBtn as HTMLButtonElement | null,
  });

  // Wiki sidebar and article rendering
  const wikiSidebar = document.getElementById('wiki-sidebar');

  renderWikiList = createWikiRenderer({
    data,
    graph,
    router,
    resolveIssueId,
    getSelectedWikiArticle: () => selectedWikiArticle,
    getSelectedCommunity: () => selectedCommunity,
    getWikiSection: () => wikiSection,
    getCommunityColor,
    wikiSidebarContent,
    wikiArticleContent,
    wikiSidebar: wikiSidebar as HTMLDivElement | null,
    panelContent,
    detailPanel,
    canvas,
    getCurrentTransform: () => currentTransform,
    hoverHandler,
    clickHandler,
    dragHandler,
    zoomHandler,
    render,
    setSelectedNode,
    renderDetailPanel,
    renderWikiArticleContent,
    attachDetailPanelHandlers,
  });

  // Re-trigger initial route handling now that all functions are defined
	  const currentRoute = router.getCurrentRoute();
	  if (currentRoute?.kind === 'article' && currentRoute.type === 'issue') {
	    renderWikiList();
	  } else if (currentRoute?.kind === 'view' && currentRoute.view === 'wiki') {
	    renderWikiList();
	  } else if (currentRoute?.kind === 'community') {
	    renderWikiList();
	  } else if (currentRoute?.kind === 'view' && currentRoute.view === 'communities') {
	    renderWikiList();
	  }
}

main().catch(console.error);
