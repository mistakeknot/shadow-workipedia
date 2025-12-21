import './style.css';
import type { GraphData, IssueCategory, CommunityInfo, PrimitiveName } from './types';
import { GraphSimulation } from './graph';
import type { SimNode } from './graph';
import { ZoomPanHandler, HoverHandler, ClickHandler, DragHandler } from './interactions';
import { ArticleRouter, renderWikiArticleContent, type RouteType, type ViewType } from './article';
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
    return `
      <div class="panel-article-view">
        <div class="panel-article-header">
          <div class="article-meta">
            <span class="article-type-badge">${article.type}</span>
            <span class="article-word-count">${article.wordCount.toLocaleString()} words</span>
          </div>
        </div>
        <article class="article-content">
          ${article.html}
        </article>
        ${renderPanelRelatedContent(node, data)}
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

  // Fallback: show basic issue/system card if no article
  if (node.type === 'issue') {
    return `
      <h2>${node.label}</h2>
      <div class="node-badges">
        ${node.categories?.map(cat => `<span class="badge category-badge" style="background: ${getCategoryColor(cat)}">${cat}</span>`).join('') || ''}
        <span class="badge urgency-${node.urgency?.toLowerCase()}">${node.urgency}</span>
      </div>
      <p class="description">${node.description || 'No description available.'}</p>

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
  const response = await fetch('/data.json');
  const data: GraphData = await response.json();

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

  // Hide loading indicator
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');

  // Get view elements
  const graphView = document.getElementById('graph-view');
  const tableView = document.getElementById('table-view');
  const wikiView = document.getElementById('wiki-view');
  const wikiSidebarContent = document.getElementById('wiki-sidebar-content');
  const wikiArticleContent = document.getElementById('wiki-article-content');
  const communitiesView = document.getElementById('communities-view');
  const communitiesSidebarContent = document.getElementById('communities-sidebar-content');
  const communitiesArticleContent = document.getElementById('communities-article-content');
  const articleView = document.getElementById('article-view');
  const articleContainer = document.getElementById('article-container');
  const header = document.getElementById('header');
  const tabNav = document.getElementById('tab-nav');
  const filterBar = document.getElementById('filter-bar');

  if (!graphView || !tableView || !wikiView || !wikiSidebarContent || !wikiArticleContent || !communitiesView || !communitiesSidebarContent || !communitiesArticleContent || !articleView || !articleContainer) {
    throw new Error('Required view elements not found');
  }

  // Track selected wiki article
  let selectedWikiArticle: string | null = null;
  let selectedCommunity: string | null = null;

  // View state (needed early for router initialization)
  let currentView: 'graph' | 'table' | 'wiki' | 'communities' = 'graph';

  // Forward declare render functions (implemented later)
  let renderTable: () => void;
  let renderWikiList: () => void;
  let renderCommunitiesList: () => void;

  // Store router reference for navigation
  let router: ArticleRouter;

  // Helper to switch views without updating URL (called by router)
  function showView(view: ViewType) {
    currentView = view;

    // Hide tooltip when switching views
    const tooltipEl = document.getElementById('tooltip');
    if (tooltipEl) tooltipEl.classList.add('hidden');

    // Update tab active states
    const tabGraph = document.getElementById('tab-graph');
    const tabTable = document.getElementById('tab-table');
    const tabWiki = document.getElementById('tab-wiki');
    const tabCommunities = document.getElementById('tab-communities');

    tabGraph?.classList.remove('active');
    tabTable?.classList.remove('active');
    tabWiki?.classList.remove('active');
    tabCommunities?.classList.remove('active');

    articleView?.classList.add('hidden');
    if (header) header.classList.remove('hidden');
    if (tabNav) tabNav.classList.remove('hidden');
    if (filterBar) filterBar.classList.remove('hidden');

    // View toggles and category filters are only relevant for graph view
    const viewModeToggles = document.getElementById('view-mode-toggles');
    const categoryFilters = document.getElementById('category-filters');
    const clusterToggle = document.getElementById('cluster-toggle');

    if (view === 'graph') {
      tabGraph?.classList.add('active');
      graphView?.classList.remove('hidden');
      tableView?.classList.add('hidden');
      wikiView?.classList.add('hidden');
      communitiesView?.classList.add('hidden');
      // Show view toggles and category filters for graph
      if (viewModeToggles) viewModeToggles.style.display = '';
      if (categoryFilters) categoryFilters.style.display = '';
      if (clusterToggle) clusterToggle.style.display = '';
    } else if (view === 'table') {
      tabTable?.classList.add('active');
      graphView?.classList.add('hidden');
      tableView?.classList.remove('hidden');
      wikiView?.classList.add('hidden');
      communitiesView?.classList.add('hidden');
      // Show view toggles and category filters for table
      if (viewModeToggles) viewModeToggles.style.display = '';
      if (categoryFilters) categoryFilters.style.display = '';
      if (clusterToggle) clusterToggle.style.display = '';
      renderTable();
    } else if (view === 'wiki') {
      tabWiki?.classList.add('active');
      graphView?.classList.add('hidden');
      tableView?.classList.add('hidden');
      wikiView?.classList.remove('hidden');
      communitiesView?.classList.add('hidden');
      // Hide all filters for wiki
      if (viewModeToggles) viewModeToggles.style.display = 'none';
      if (categoryFilters) categoryFilters.style.display = 'none';
      if (clusterToggle) clusterToggle.style.display = 'none';
      if (renderWikiList) renderWikiList();
    } else if (view === 'communities') {
      tabCommunities?.classList.add('active');
      graphView?.classList.add('hidden');
      tableView?.classList.add('hidden');
      wikiView?.classList.add('hidden');
      communitiesView?.classList.remove('hidden');
      // Hide all filters for communities
      if (viewModeToggles) viewModeToggles.style.display = 'none';
      if (categoryFilters) categoryFilters.style.display = 'none';
      if (clusterToggle) clusterToggle.style.display = 'none';
      if (renderCommunitiesList) renderCommunitiesList();
    }
  }

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
      }
      // Clear selected community when navigating to communities list
      if (route.view === 'communities') {
        selectedCommunity = null;
      }
      showView(route.view);
    } else if (route.kind === 'article') {
      // Both issue and system articles show in wiki view with sidebar
      if (route.type === 'issue') {
        const resolved = resolveIssueId(route.slug);
        if ((!data.articles || !data.articles[route.slug]) && resolved !== route.slug && data.articles?.[resolved]) {
          window.location.hash = `#/wiki/${resolved}`;
          return;
        }
      }

      selectedWikiArticle = route.slug;
      showView('wiki');
      // Re-render to update selection and article content
      if (renderWikiList) renderWikiList();
    } else if (route.kind === 'community') {
      // Community articles show in communities view with sidebar
      selectedCommunity = route.slug;
      showView('communities');
      // Re-render to update selection and article content
      if (renderCommunitiesList) renderCommunitiesList();
    }
  });

  // Get canvas
  const canvas = document.getElementById('graph-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas not found');

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Transform state
  let currentTransform = { x: 0, y: 0, k: 1 };

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

  // Tooltip element
  const tooltip = document.getElementById('tooltip') as HTMLDivElement;
  let hoveredNode: SimNode | null = null;

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

  // Selected node state
  let selectedNode: SimNode | null = null;
  let connectedToSelected = new Set<string>();

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
  const detailPanel = document.getElementById('detail-panel') as HTMLDivElement;
  const panelContent = document.getElementById('panel-content') as HTMLDivElement;
  const closeBtn = document.getElementById('close-panel') as HTMLButtonElement;

  // Filter state
  const activeCategories = new Set<string>([
    'Existential', 'Economic', 'Social', 'Political', 'Environmental',
    'Security', 'Technological', 'Cultural', 'Infrastructure'
  ]);

  // View toggles state
  let showIssues = true;
  let showSystems = false;
  let showPrinciples = false;
  let showPrimitives = false;
  let showDataFlows = false; // Show directed data flow arrows

  // Primitive selection state
  let selectedPrimitive: PrimitiveName | null = null;

  // Cluster visualization state
  let showClusters = false;

  // Search state
  let searchTerm = '';
  let searchResults = new Set<string>();

  // Table sort state
  let tableSortColumn: string | null = null;
  let tableSortDirection: 'asc' | 'desc' = 'asc';

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

    // Handle read article button clicks (navigate to wiki view)
    const readArticleBtn = panelContent.querySelector('.read-article-btn[data-wiki-article-id]');
    if (readArticleBtn) {
      readArticleBtn.addEventListener('click', () => {
        const articleId = readArticleBtn.getAttribute('data-wiki-article-id');
        if (articleId && data.articles && data.articles[articleId]) {
          detailPanel.classList.add('hidden');
          setSelectedNode(null);
          // Navigate to the wiki article (updates URL)
          router.navigateToArticle('issue', articleId);
        }
      });
    }

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

  // Close panel button
  closeBtn.addEventListener('click', () => {
    setSelectedNode(null);
    detailPanel.classList.add('hidden');
    render();
  });

  // View toggle button handlers
  const showIssuesBtn = document.getElementById('show-issues-btn') as HTMLButtonElement;
  const showSystemsBtn = document.getElementById('show-systems-btn') as HTMLButtonElement;

  if (showIssuesBtn) {
    showIssuesBtn.addEventListener('click', () => {
      showIssues = !showIssues;
      showIssuesBtn.classList.toggle('active', showIssues);
      updateSearchPlaceholder();
      render();
      if (currentView === 'table') {
        renderTable();
      }
    });
  }

  if (showSystemsBtn) {
    showSystemsBtn.addEventListener('click', () => {
      showSystems = !showSystems;
      showSystemsBtn.classList.toggle('active', showSystems);
      updateSearchPlaceholder();
      // Restart simulation to spread out newly visible nodes
      graph.restart();
      render();
      if (currentView === 'table') {
        renderTable();
      }
    });
  }

  // Principles toggle button
  const showPrinciplesBtn = document.getElementById('show-principles-btn') as HTMLButtonElement;
  if (showPrinciplesBtn) {
    showPrinciplesBtn.addEventListener('click', () => {
      showPrinciples = !showPrinciples;
      showPrinciplesBtn.classList.toggle('active', showPrinciples);
      updateSearchPlaceholder();
      // Restart simulation to spread out newly visible nodes
      graph.restart();
      render();
      if (currentView === 'table') {
        renderTable();
      }
    });
  }

  // Primitives toggle button
  const showPrimitivesBtn = document.getElementById('show-primitives-btn') as HTMLButtonElement;
  if (showPrimitivesBtn) {
    showPrimitivesBtn.addEventListener('click', () => {
      showPrimitives = !showPrimitives;
      showPrimitivesBtn.classList.toggle('active', showPrimitives);
      updateSearchPlaceholder();
      // Show/hide primitive legend panel
      updatePrimitiveLegend();
      render();
      if (currentView === 'table') {
        renderTable();
      }
    });
  }

  // Create or update the primitive legend panel
  function updatePrimitiveLegend() {
    let legend = document.getElementById('primitive-legend');

    if (!showPrimitives) {
      if (legend) legend.remove();
      selectedPrimitive = null;
      return;
    }

    if (!legend) {
      legend = document.createElement('div');
      legend.id = 'primitive-legend';
      legend.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 12px;
        z-index: 100;
        max-height: 60vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      `;
      document.body.appendChild(legend);
    }

    // Count issues per primitive
    const primitiveCounts = new Map<PrimitiveName, number>();
    for (const node of data.nodes) {
      if (node.primitives) {
        for (const p of node.primitives) {
          primitiveCounts.set(p, (primitiveCounts.get(p) || 0) + 1);
        }
      }
    }

    // Sort by count
    const sortedPrimitives = Array.from(primitiveCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    legend.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; font-size: 13px;">
        Simulation Primitives
      </div>
      <div style="font-size: 11px; color: #94a3b8; margin-bottom: 10px;">
        Click to highlight issues
      </div>
      ${sortedPrimitives.map(([primitive, count]) => `
        <div class="primitive-item" data-primitive="${primitive}" style="
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          margin: 2px 0;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s;
          ${selectedPrimitive === primitive ? 'background: rgba(255, 255, 255, 0.15);' : ''}
        ">
          <div style="
            width: 12px;
            height: 12px;
            border-radius: 3px;
            background: ${getPrimitiveColor(primitive)};
            flex-shrink: 0;
          "></div>
          <span style="color: #e2e8f0; font-size: 12px; flex: 1;">${getPrimitiveLabel(primitive)}</span>
          <span style="color: #64748b; font-size: 11px;">${count}</span>
        </div>
      `).join('')}
      ${selectedPrimitive ? `
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
          <button id="clear-primitive-selection" style="
            width: 100%;
            padding: 6px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 4px;
            color: #94a3b8;
            font-size: 11px;
            cursor: pointer;
          ">Clear selection</button>
        </div>
      ` : ''}
    `;

    // Add hover effects
    legend.querySelectorAll('.primitive-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        (item as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)';
      });
      item.addEventListener('mouseleave', () => {
        const p = item.getAttribute('data-primitive') as PrimitiveName | null;
        (item as HTMLElement).style.background = selectedPrimitive === p ? 'rgba(255, 255, 255, 0.15)' : '';
      });
      item.addEventListener('click', () => {
        const p = item.getAttribute('data-primitive') as PrimitiveName | null;
        selectedPrimitive = selectedPrimitive === p ? null : p;
        updatePrimitiveLegend();
        render();
        if (currentView === 'table') {
          renderTable();
        }
      });
    });

    // Clear button
    const clearBtn = document.getElementById('clear-primitive-selection');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        selectedPrimitive = null;
        updatePrimitiveLegend();
        render();
        if (currentView === 'table') {
          renderTable();
        }
      });
    }
  }

  // Data Flows toggle button
  const showDataFlowsBtn = document.getElementById('show-dataflows-btn') as HTMLButtonElement;
  if (showDataFlowsBtn) {
    showDataFlowsBtn.addEventListener('click', () => {
      showDataFlows = !showDataFlows;
      showDataFlowsBtn.classList.toggle('active', showDataFlows);
      render();
    });
  }

  // Update search placeholder based on what's visible
  function updateSearchPlaceholder() {
    const searchInput = document.getElementById('search') as HTMLInputElement;
    if (!searchInput) return;

    const types: string[] = [];
    if (showIssues) types.push('issues');
    if (showSystems) types.push('systems');
    if (showPrinciples) types.push('principles');

    if (types.length === 0) {
      searchInput.placeholder = 'Search...';
    } else if (types.length === 1) {
      searchInput.placeholder = `Search ${types[0]}...`;
    } else {
      searchInput.placeholder = `Search ${types.join(' & ')}...`;
    }
  }

  // Show Clusters toggle
  const showClustersToggle = document.getElementById('show-clusters') as HTMLInputElement;
  if (showClustersToggle) {
    showClustersToggle.addEventListener('change', (e) => {
      showClusters = (e.target as HTMLInputElement).checked;
      graph.enableClustering(showClusters, 0.08);
      render();
    });
  }

  // Create category filter buttons
  const categoryFilters = document.getElementById('category-filters') as HTMLDivElement;
  const categories = [
    { name: 'Existential', color: '#dc2626' },
    { name: 'Economic', color: '#3b82f6' },
    { name: 'Social', color: '#8b5cf6' },
    { name: 'Political', color: '#ef4444' },
    { name: 'Environmental', color: '#10b981' },
    { name: 'Security', color: '#f59e0b' },
    { name: 'Technological', color: '#06b6d4' },
    { name: 'Cultural', color: '#ec4899' },
    { name: 'Infrastructure', color: '#6366f1' },
  ];

  for (const cat of categories) {
    // Count issues with this category
    const count = graph.getNodes().filter(node =>
      node.type === 'issue' && node.categories?.includes(cat.name as IssueCategory)
    ).length;

    const btn = document.createElement('button');
    btn.className = 'category-filter-btn active';
    btn.textContent = `${cat.name} (${count})`;
    btn.style.setProperty('--category-color', cat.color);
    btn.style.borderColor = cat.color;

    btn.addEventListener('click', () => {
      if (activeCategories.has(cat.name)) {
        activeCategories.delete(cat.name);
        btn.classList.remove('active');
      } else {
        activeCategories.add(cat.name);
        btn.classList.add('active');
      }
      render();
      // Also update table if in table view
      if (currentView === 'table') {
        renderTable();
      }
    });

    categoryFilters.appendChild(btn);
  }

  // Search functionality
  const searchInput = document.getElementById('search') as HTMLInputElement;

  function performSearch(term: string) {
    searchTerm = term.toLowerCase().trim();
    searchResults.clear();

    if (!searchTerm) {
      render();
      if (currentView === 'table') {
        renderTable();
      }
      return;
    }

    // Find matching nodes
    for (const node of graph.getNodes()) {
      const matchesName = node.label.toLowerCase().includes(searchTerm);
      const matchesDesc = node.description?.toLowerCase().includes(searchTerm);
      const matchesCat = node.categories?.some(cat => cat.toLowerCase().includes(searchTerm));

      if (matchesName || matchesDesc || matchesCat) {
        searchResults.add(node.id);
      }
    }

    console.log(`Found ${searchResults.size} matches for "${term}"`);
    render();
    if (currentView === 'table') {
      renderTable();
    }
  }

  searchInput.addEventListener('input', (e) => {
    performSearch((e.target as HTMLInputElement).value);
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
  function render() {
    if (!ctx) return;

    // Update visible nodes for interaction handlers
    const visibleNodes = getVisibleNodes();
    const visibleNodeIds = new Set<string>(visibleNodes.map(n => n.id));
    hoverHandler.setVisibleNodes(visibleNodes);
    clickHandler.setVisibleNodes(visibleNodes);
    dragHandler.setVisibleNodes(visibleNodes);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transform
    ctx.save();
    ctx.translate(currentTransform.x, currentTransform.y);
    ctx.scale(currentTransform.k, currentTransform.k);

    // Draw community hulls and labels if enabled (before edges for proper layering)
    if (showClusters) {
      ctx.restore(); // Reset transform for screen-space rendering
      renderCommunityHulls(ctx, visibleNodes, data.communities, currentTransform);
      renderCommunityLabels(ctx, visibleNodes, data.communities, currentTransform);
      ctx.save(); // Reapply transform for edges/nodes
      ctx.translate(currentTransform.x, currentTransform.y);
      ctx.scale(currentTransform.k, currentTransform.k);
    }

    // Draw edges
    const links = graph.getLinks();
    const k = currentTransform.k;

    // Batch draw normal edges (canvas is much faster with fewer stroke() calls)
    {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = 1 / k;
      ctx.beginPath();
      let drewAny = false;
      for (const link of links) {
        if (link.type === 'data-flow') continue;
        if (!visibleNodeIds.has(link.source.id) || !visibleNodeIds.has(link.target.id)) continue;

        const isConnected = selectedNode &&
          (link.source.id === selectedNode.id || link.target.id === selectedNode.id);
        if (isConnected) continue;

        ctx.moveTo(link.source.x!, link.source.y!);
        ctx.lineTo(link.target.x!, link.target.y!);
        drewAny = true;
      }
      if (drewAny) ctx.stroke();
    }

    if (selectedNode) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.lineWidth = 2 / k;
      ctx.beginPath();
      let drewAny = false;
      for (const link of links) {
        if (link.type === 'data-flow') continue;
        if (!visibleNodeIds.has(link.source.id) || !visibleNodeIds.has(link.target.id)) continue;

        const isConnected =
          link.source.id === selectedNode.id || link.target.id === selectedNode.id;
        if (!isConnected) continue;

        ctx.moveTo(link.source.x!, link.source.y!);
        ctx.lineTo(link.target.x!, link.target.y!);
        drewAny = true;
      }
      if (drewAny) ctx.stroke();
    }

    // Data flow edges (smaller set, but still batch strokes)
    if (showDataFlows) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.lineWidth = 1.5 / k;
      ctx.beginPath();
      let drewAny = false;
      for (const link of links) {
        if (link.type !== 'data-flow') continue;
        if (!visibleNodeIds.has(link.source.id) || !visibleNodeIds.has(link.target.id)) continue;

        const isConnected = selectedNode &&
          (link.source.id === selectedNode.id || link.target.id === selectedNode.id);
        if (isConnected) continue;

        ctx.moveTo(link.source.x!, link.source.y!);
        ctx.lineTo(link.target.x!, link.target.y!);
        drewAny = true;
      }
      if (drewAny) ctx.stroke();

      if (selectedNode) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
        ctx.lineWidth = 2.5 / k;
        ctx.beginPath();
        drewAny = false;
        for (const link of links) {
          if (link.type !== 'data-flow') continue;
          if (!visibleNodeIds.has(link.source.id) || !visibleNodeIds.has(link.target.id)) continue;

          const isConnected =
            link.source.id === selectedNode.id || link.target.id === selectedNode.id;
          if (!isConnected) continue;

          ctx.moveTo(link.source.x!, link.source.y!);
          ctx.lineTo(link.target.x!, link.target.y!);
          drewAny = true;
        }
        if (drewAny) ctx.stroke();
      }

      // Arrowheads for directed data flows
      for (const link of links) {
        if (link.type !== 'data-flow' || !link.directed) continue;
        if (!visibleNodeIds.has(link.source.id) || !visibleNodeIds.has(link.target.id)) continue;

        const isConnected = selectedNode &&
          (link.source.id === selectedNode.id || link.target.id === selectedNode.id);
        ctx.fillStyle = isConnected
          ? 'rgba(245, 158, 11, 0.9)'
          : 'rgba(245, 158, 11, 0.25)';

        const targetSize = link.target.size || 8;
        const arrowSize = Math.max(6, 10 / k);
        drawArrow(
          ctx,
          link.source.x!,
          link.source.y!,
          link.target.x!,
          link.target.y!,
          targetSize + 2,
          arrowSize
        );
      }
    }

    // Draw nodes
    for (const node of visibleNodes) {
      const isHovered = hoveredNode && node.id === hoveredNode.id;
      const isSelected = selectedNode && node.id === selectedNode.id;
      const isSearchMatch = searchTerm !== '' && searchResults.has(node.id);
      const isConnected = selectedNode ? connectedToSelected.has(node.id) : false;

      // Determine relevance
      let isRelevant = true;
      if (searchTerm !== '') {
        isRelevant = isSearchMatch;
      } else if (selectedNode) {
        isRelevant = isSelected || isConnected;
      } else if (selectedPrimitive) {
        // Highlight nodes that use the selected primitive
        isRelevant = node.primitives?.includes(selectedPrimitive) ?? false;
      }

      // Use category color for nodes, or primitive color if selected
      const useColor = selectedPrimitive && node.primitives?.includes(selectedPrimitive)
        ? getPrimitiveColor(selectedPrimitive)
        : node.color;
      ctx.fillStyle = useColor;
      ctx.globalAlpha = isRelevant ? (isHovered ? 1.0 : 0.9) : 0.1;

      const size = (isHovered || isSelected) ? node.size * 1.2 : node.size;

      // Draw node shape based on type
      if (node.type === 'principle') {
        // Principle nodes: Diamond shape
        drawDiamond(ctx, node.x!, node.y!, size);
        ctx.fill();

        // Add subtle glow effect for principles
        ctx.globalAlpha = isRelevant ? 0.3 : 0.05;
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 2 / currentTransform.k;
        drawDiamond(ctx, node.x!, node.y!, size + 3 / currentTransform.k);
        ctx.stroke();

        ctx.globalAlpha = isRelevant ? (isHovered ? 1.0 : 0.9) : 0.1;
      } else {
        // Issue and System nodes: Circle shape
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
        ctx.fill();
      }

      // System nodes: Add distinctive dashed stroke and inner ring
      if (node.type === 'system') {
        ctx.globalAlpha = isRelevant ? 1.0 : 0.15;

        // Outer dashed stroke
        ctx.strokeStyle = '#e2e8f0'; // Light gray
        ctx.lineWidth = 2.5 / currentTransform.k;
        ctx.setLineDash([4 / currentTransform.k, 3 / currentTransform.k]); // Dashed pattern
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, size + (2 / currentTransform.k), 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid line

        // Inner ring for extra emphasis
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.4)';
        ctx.lineWidth = 1.5 / currentTransform.k;
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, size - (2 / currentTransform.k), 0, 2 * Math.PI);
        ctx.stroke();

        ctx.globalAlpha = isRelevant ? (isHovered ? 1.0 : 0.9) : 0.1;
      }

      // Draw border rings for additional categories (if multi-category)
      if (node.categories && node.categories.length > 1) {
        const ringWidth = 2 / currentTransform.k;
        let currentRadius = size;

        // Skip first category (already used for main fill), draw rings for rest
        for (let i = 1; i < node.categories.length; i++) {
          const cat = node.categories[i];
          ctx.strokeStyle = getCategoryColor(cat);
          ctx.lineWidth = ringWidth;

          currentRadius += ringWidth;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, currentRadius, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }

      // Highlight ring for search matches (outside all category rings)
      if (isSearchMatch && !isSelected) {
        const searchRingRadius = size + (node.categories ? (node.categories.length - 1) * (2 / currentTransform.k) : 0) + (3 / currentTransform.k);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / currentTransform.k;
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, searchRingRadius, 0, 2 * Math.PI);
        ctx.stroke();
      }

      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }

  // Track whether initial fit has been done
  let initialFitDone = false;
  let renderScheduled = false;
  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      render();
    });
  }

  graph.onTick(() => {
    // On first tick, fit to view before rendering (coalesced to 1 render/frame)
    if (!initialFitDone) {
      initialFitDone = true;
      fitToView();
      return;
    }
    scheduleRender();
  });

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
      categories.forEach(c => activeCategories.add(c.name));

      // Reset button states
      document.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.classList.add('active');
      });

      // Clear search
      searchInput.value = '';
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
  const tabCommunities = document.getElementById('tab-communities') as HTMLButtonElement;
  const tableContainer = document.getElementById('table-container') as HTMLDivElement;

  // Tab clicks navigate via router (which updates URL and calls showView)
  tabGraph.addEventListener('click', () => router.navigateToView('graph'));
  tabTable.addEventListener('click', () => router.navigateToView('table'));
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

  tabCommunities.addEventListener('click', () => router.navigateToView('communities'));

  // Table rendering (assign to forward-declared function)
  renderTable = function() {
    // Get filtered nodes
    const nodes = graph.getNodes().filter(node => {
      // Apply view toggle filter
      if (node.type === 'issue' && !showIssues) return false;
      if (node.type === 'system' && !showSystems) return false;

      // Apply category filter - show if ANY category is active (additive filtering)
      const anyCategoryActive = !node.categories?.length || node.categories.some(cat => activeCategories.has(cat));
      if (!anyCategoryActive) return false;

      // Apply primitive filter
      if (selectedPrimitive) {
        if (!node.primitives?.includes(selectedPrimitive)) return false;
      }

      // Apply search filter
      if (searchTerm !== '') {
        return searchResults.has(node.id);
      }

      return true;
    });

    // Sort nodes
    let sortedNodes = [...nodes];
    if (tableSortColumn) {
      sortedNodes.sort((a, b) => {
        let aVal: string | number | undefined;
        let bVal: string | number | undefined;

        switch (tableSortColumn) {
          case 'name':
            aVal = a.label;
            bVal = b.label;
            break;
          case 'categories':
            aVal = a.categories?.join(', ') || '';
            bVal = b.categories?.join(', ') || '';
            break;
          case 'urgency':
            const urgencyOrder = { Critical: 4, High: 3, Medium: 2, Low: 1, Latent: 0 };
            // Systems don't have urgency - sort them to the end
            aVal = a.type === 'system' ? -1 : urgencyOrder[a.urgency || 'Latent'];
            bVal = b.type === 'system' ? -1 : urgencyOrder[b.urgency || 'Latent'];
            break;
          case 'connections':
            aVal = data.edges.filter(e => e.source === a.id || e.target === a.id).length;
            bVal = data.edges.filter(e => e.source === b.id || e.target === b.id).length;
            break;
        }

        if (aVal === undefined || bVal === undefined) return 0;

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return tableSortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        } else {
          return tableSortDirection === 'asc'
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
        }
      });
    }

    // Build table HTML
    const html = `
      <table>
        <thead>
          <tr>
            <th data-column="name">Issue ${tableSortColumn === 'name' ? (tableSortDirection === 'asc' ? '▲' : '▼') : ''}</th>
            <th data-column="categories">Categories ${tableSortColumn === 'categories' ? (tableSortDirection === 'asc' ? '▲' : '▼') : ''}</th>
            <th data-column="urgency">Urgency ${tableSortColumn === 'urgency' ? (tableSortDirection === 'asc' ? '▲' : '▼') : ''}</th>
            <th data-column="connections">Connections ${tableSortColumn === 'connections' ? (tableSortDirection === 'asc' ? '▲' : '▼') : ''}</th>
          </tr>
        </thead>
        <tbody>
          ${sortedNodes.map(node => {
            const connectionCount = data.edges.filter(e => e.source === node.id || e.target === node.id).length;
            return `
              <tr data-node-id="${node.id}">
                <td>${node.label}</td>
                <td>
                  <div class="table-categories">
                    ${node.categories?.map(cat => {
                      const color = getCategoryColor(cat);
                      return `<span class="table-category-badge" style="background: ${color}; color: #0f172a;">${cat}</span>`;
                    }).join('') || ''}
                  </div>
                </td>
                <td>
                  ${node.type === 'system'
                    ? '<span class="badge system-badge">N/A</span>'
                    : `<span class="badge urgency-${node.urgency || 'latent'}">${node.urgency || 'latent'}</span>`
                  }
                </td>
                <td>${connectionCount}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    tableContainer.innerHTML = html;

    // Add column header click handlers for sorting
    tableContainer.querySelectorAll('th[data-column]').forEach(th => {
      th.addEventListener('click', () => {
        const column = th.getAttribute('data-column');
        if (column === tableSortColumn) {
          tableSortDirection = tableSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          tableSortColumn = column;
          tableSortDirection = 'asc';
        }
        renderTable();
      });
    });

    // Add row click handlers to open detail panel
    tableContainer.querySelectorAll('tbody tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const nodeId = tr.getAttribute('data-node-id');
        const node = graph.getNodes().find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
          panelContent.innerHTML = renderDetailPanel(node, data);
          panelContent.scrollTop = 0; // Reset scroll position for new node
          detailPanel.classList.remove('hidden');
          // Hide tooltip when detail panel opens (prevents overlap on mobile)
          tooltip.classList.add('hidden');

          // Attach connection handlers for navigation within table view
          attachDetailPanelHandlers();
        }
      });
    });
  }

  // Wiki sidebar and article rendering
  const wikiSidebar = document.getElementById('wiki-sidebar');

  renderWikiList = function() {
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
    const systemArticles = articles.filter(a => a.type === 'system' && !a.title.includes('('));
    const principleArticles = articles.filter(a => a.type === 'principle');
    const primitiveArticles = articles.filter(a => a.type === 'primitive');

    // Mobile: collapse sidebar when an article is selected
    if (wikiSidebar) {
      if (selectedWikiArticle) {
        wikiSidebar.classList.add('collapsed');
      } else {
        wikiSidebar.classList.remove('collapsed');
      }
    }

    // Render sidebar
    const renderSidebarItem = (article: typeof articles[0]) => `
      <div class="wiki-sidebar-item${selectedWikiArticle === article.id ? ' active' : ''}" data-article-id="${article.id}">
        ${article.title}
      </div>
    `;

    // Mobile expand button (shown only when collapsed)
    const expandButton = selectedWikiArticle
      ? `<button class="wiki-sidebar-expand" id="wiki-sidebar-expand-btn">Browse all articles</button>`
      : '';

    const sidebarHtml = `
      ${expandButton}
      ${issueArticles.length > 0 ? `
        <div class="wiki-sidebar-section">
          <h3>Issues (${issueArticles.length})</h3>
          <div class="wiki-sidebar-list">
            ${issueArticles.map(renderSidebarItem).join('')}
          </div>
        </div>
      ` : ''}

      ${caseStudyArticles.length > 0 ? `
        <div class="wiki-sidebar-section">
          <h3>Case Studies (${caseStudyArticles.length})</h3>
          <div class="wiki-sidebar-list">
            ${caseStudyArticles.map(renderSidebarItem).join('')}
          </div>
        </div>
      ` : ''}

      ${redirectArticles.length > 0 ? `
        <div class="wiki-sidebar-section">
          <h3>Redirects (${redirectArticles.length})</h3>
          <div class="wiki-sidebar-list">
            ${redirectArticles.map(renderSidebarItem).join('')}
          </div>
        </div>
      ` : ''}

      ${systemArticles.length > 0 ? `
        <div class="wiki-sidebar-section">
          <h3>Systems (${systemArticles.length})</h3>
          <div class="wiki-sidebar-list">
            ${systemArticles.map(renderSidebarItem).join('')}
          </div>
        </div>
      ` : ''}

      ${principleArticles.length > 0 ? `
        <div class="wiki-sidebar-section">
          <h3>Principles (${principleArticles.length})</h3>
          <div class="wiki-sidebar-list">
            ${principleArticles.map(renderSidebarItem).join('')}
          </div>
        </div>
      ` : ''}

      ${primitiveArticles.length > 0 ? `
        <div class="wiki-sidebar-section">
          <h3>Primitives (${primitiveArticles.length})</h3>
          <div class="wiki-sidebar-list">
            ${primitiveArticles.map(renderSidebarItem).join('')}
          </div>
        </div>
      ` : ''}
    `;

    wikiSidebarContent.innerHTML = sidebarHtml;

    // Render article content or welcome message with collapsible lists
    if (selectedWikiArticle && data.articles[selectedWikiArticle]) {
      const article = data.articles[selectedWikiArticle];
      wikiArticleContent.innerHTML = renderWikiArticleContent(article, data);
      // Reset scroll position when switching articles
      wikiArticleContent.scrollTop = 0;
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
          router.navigateToArticle(article.type as 'issue' | 'system' | 'principle' | 'primitive', articleId);
        }
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

        // Parse the href to extract article ID (e.g., "#/issue/water-scarcity-wars" -> "water-scarcity-wars")
        const match = href.match(/^#\/(issue|system)\/([a-z0-9-]+)$/);
        if (!match) return;

        const articleId = match[2];

        // Check if this article exists in our wiki
        if (data.articles && data.articles[articleId]) {
          // Navigate to the article (updates URL)
          const type = match[1] as 'issue' | 'system';
          router.navigateToArticle(type, articleId);
        } else {
          // No article exists - show the node in graph view with detail panel
          const targetNode = graph.getNodes().find(n => n.id === articleId);
          if (targetNode) {
            router.navigateToView('graph');
            setSelectedNode(targetNode);
            panelContent.innerHTML = renderDetailPanel(targetNode, data);
            panelContent.scrollTop = 0; // Reset scroll position for new node
            detailPanel.classList.remove('hidden');
            attachDetailPanelHandlers();

            // Pan to center on the node
            if (targetNode.x !== undefined && targetNode.y !== undefined) {
              const centerX = canvas.width / 2;
              const centerY = canvas.height / 2;
              currentTransform.x = centerX - targetNode.x * currentTransform.k;
              currentTransform.y = centerY - targetNode.y * currentTransform.k;
              hoverHandler.updateTransform(currentTransform);
              clickHandler.updateTransform(currentTransform);
              dragHandler.updateTransform(currentTransform);
              zoomHandler.setTransform(currentTransform);
              render();
            }
          }
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

  // Communities sidebar and article rendering
  const communitiesSidebar = document.getElementById('communities-sidebar');

  renderCommunitiesList = function() {
    if (!data.communities || Object.keys(data.communities).length === 0) {
      communitiesSidebarContent.innerHTML = `<div class="wiki-empty-sidebar">No communities detected</div>`;
      communitiesArticleContent.innerHTML = `
        <div class="wiki-welcome">
          <h2>Community Detection</h2>
          <p>Community data will appear here after analysis.</p>
        </div>
      `;
      return;
    }

    // Convert communities to array and sort by size (descending)
    const communities = Object.values(data.communities).sort((a, b) => b.size - a.size);

    // Mobile: collapse sidebar when a community is selected
    if (communitiesSidebar) {
      if (selectedCommunity) {
        communitiesSidebar.classList.add('collapsed');
      } else {
        communitiesSidebar.classList.remove('collapsed');
      }
    }

    // Render sidebar
    const renderSidebarItem = (community: typeof communities[0]) => {
      const communitySlug = `community-${community.id}`;
      return `
        <div class="wiki-sidebar-item${selectedCommunity === communitySlug ? ' active' : ''}" data-community-slug="${communitySlug}">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${getCommunityColor(community.id)}; flex-shrink: 0;"></div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; font-size: 0.85rem; line-height: 1.3;">${community.label}</div>
              <div style="font-size: 0.75rem; color: #94a3b8;">${community.size} issues</div>
            </div>
          </div>
        </div>
      `;
    };

    // Mobile expand button (shown only when collapsed)
    const expandButton = selectedCommunity
      ? `<button class="wiki-sidebar-expand" id="communities-sidebar-expand-btn">Browse all communities</button>`
      : '';

    const sidebarHtml = `
      ${expandButton}
      <div class="wiki-sidebar-section">
        <h3>Communities (${communities.length})</h3>
        <div class="wiki-sidebar-list">
          ${communities.map(renderSidebarItem).join('')}
        </div>
      </div>
    `;

    communitiesSidebarContent.innerHTML = sidebarHtml;

    // Render community article content or welcome message
    if (selectedCommunity && data.articles && data.articles[selectedCommunity]) {
      const article = data.articles[selectedCommunity];
      communitiesArticleContent.innerHTML = renderWikiArticleContent(article, data);
      // Reset scroll position when switching articles
      communitiesArticleContent.scrollTop = 0;
    } else {
      communitiesArticleContent.innerHTML = `
        <div class="wiki-welcome">
          <h2>Issue Communities</h2>
          <p class="wiki-welcome-subtitle">${communities.length} communities detected via Louvain algorithm</p>
          <p>Select a community from the sidebar to explore its issues and shared mechanics.</p>
        </div>
      `;
    }

    // Attach click handlers to sidebar items
    communitiesSidebarContent.querySelectorAll('.wiki-sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        const communitySlug = item.getAttribute('data-community-slug');
        if (communitySlug) {
          // Navigate via router to update URL
          router.navigateToCommunity(communitySlug);
        }
      });
    });

    // Attach click handler to expand button (mobile: expand collapsed sidebar)
    const expandBtn = document.getElementById('communities-sidebar-expand-btn');
    if (expandBtn && communitiesSidebar) {
      expandBtn.addEventListener('click', () => {
        communitiesSidebar.classList.remove('collapsed');
      });
    }

    // Attach click handlers to related content links (navigate within communities or to wiki)
    communitiesArticleContent.querySelectorAll('.related-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (!href) return;

        // Community links: #/communities/community-N
        const communityMatch = href.match(/^#\/communities\/(community-\d+)$/);
        if (communityMatch) {
          router.navigateToCommunity(communityMatch[1]);
          return;
        }

        // Wiki links: #/wiki/slug
        const wikiMatch = href.match(/^#\/wiki\/([a-z0-9-]+)$/);
        if (wikiMatch) {
          const articleId = wikiMatch[1];
          if (data.articles && data.articles[articleId]) {
            const article = data.articles[articleId];
            router.navigateToArticle(article.type as 'issue' | 'system' | 'principle' | 'primitive', articleId);
          }
        }
      });
    });

    // Attach click handlers to expand toggle buttons
    communitiesArticleContent.querySelectorAll('.expand-toggle').forEach(button => {
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

  // Re-trigger initial route handling now that all functions are defined
  const currentRoute = router.getCurrentRoute();
  if (currentRoute?.kind === 'article' && currentRoute.type === 'issue') {
    renderWikiList();
  } else if (currentRoute?.kind === 'view' && currentRoute.view === 'wiki') {
    renderWikiList();
  } else if (currentRoute?.kind === 'community') {
    renderCommunitiesList();
  } else if (currentRoute?.kind === 'view' && currentRoute.view === 'communities') {
    renderCommunitiesList();
  }
}

main().catch(console.error);
