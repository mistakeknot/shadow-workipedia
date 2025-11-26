import './style.css';
import type { GraphData, IssueCategory } from './types';
import { GraphSimulation } from './graph';
import type { SimNode } from './graph';
import { ZoomPanHandler, HoverHandler, ClickHandler, DragHandler } from './interactions';
import { ArticleRouter, renderWikiArticleContent, type RouteType, type ViewType } from './article';

// Category color mapping (must match extract-data.ts)
const CATEGORY_COLORS: Record<IssueCategory, string> = {
  Economic: '#3b82f6',
  Social: '#8b5cf6',
  Political: '#ef4444',
  Environmental: '#10b981',
  Security: '#f59e0b',
  Technological: '#06b6d4',
  Cultural: '#ec4899',
  Infrastructure: '#6366f1',
};

function getCategoryColor(category: IssueCategory): string {
  return CATEGORY_COLORS[category];
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

  // Hide loading indicator
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');

  // Get view elements
  const graphView = document.getElementById('graph-view');
  const tableView = document.getElementById('table-view');
  const wikiView = document.getElementById('wiki-view');
  const wikiSidebarContent = document.getElementById('wiki-sidebar-content');
  const wikiArticleContent = document.getElementById('wiki-article-content');
  const articleView = document.getElementById('article-view');
  const articleContainer = document.getElementById('article-container');
  const header = document.getElementById('header');
  const tabNav = document.getElementById('tab-nav');
  const filterBar = document.getElementById('filter-bar');

  if (!graphView || !tableView || !wikiView || !wikiSidebarContent || !wikiArticleContent || !articleView || !articleContainer) {
    throw new Error('Required view elements not found');
  }

  // Track selected wiki article
  let selectedWikiArticle: string | null = null;

  // View state (needed early for router initialization)
  let currentView: 'graph' | 'table' | 'wiki' = 'graph';

  // Forward declare render functions (implemented later)
  let renderTable: () => void;
  let renderWikiList: () => void;

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

    tabGraph?.classList.remove('active');
    tabTable?.classList.remove('active');
    tabWiki?.classList.remove('active');

    articleView?.classList.add('hidden');
    if (header) header.classList.remove('hidden');
    if (tabNav) tabNav.classList.remove('hidden');
    if (filterBar) filterBar.classList.remove('hidden');

    // View mode selector and category filters are only relevant for graph view
    const viewModeSelector = document.getElementById('view-mode-selector');
    const categoryFilters = document.getElementById('category-filters');

    if (view === 'graph') {
      tabGraph?.classList.add('active');
      graphView?.classList.remove('hidden');
      tableView?.classList.add('hidden');
      wikiView?.classList.add('hidden');
      // Show view mode selector and category filters for graph
      if (viewModeSelector) viewModeSelector.style.display = '';
      if (categoryFilters) categoryFilters.style.display = '';
    } else if (view === 'table') {
      tabTable?.classList.add('active');
      graphView?.classList.add('hidden');
      tableView?.classList.remove('hidden');
      wikiView?.classList.add('hidden');
      // Hide view mode selector for table, but keep category filters
      if (viewModeSelector) viewModeSelector.style.display = 'none';
      if (categoryFilters) categoryFilters.style.display = '';
      renderTable();
    } else if (view === 'wiki') {
      tabWiki?.classList.add('active');
      graphView?.classList.add('hidden');
      tableView?.classList.add('hidden');
      wikiView?.classList.remove('hidden');
      // Hide both view mode selector and category filters for wiki
      if (viewModeSelector) viewModeSelector.style.display = 'none';
      if (categoryFilters) categoryFilters.style.display = 'none';
      if (renderWikiList) renderWikiList();
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
      showView(route.view);
    } else if (route.kind === 'article') {
      // Both issue and system articles show in wiki view with sidebar
      selectedWikiArticle = route.slug;
      showView('wiki');
      // Re-render to update selection and article content
      if (renderWikiList) renderWikiList();
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
  const detailPanel = document.getElementById('detail-panel') as HTMLDivElement;
  const panelContent = document.getElementById('panel-content') as HTMLDivElement;
  const closeBtn = document.getElementById('close-panel') as HTMLButtonElement;

  // Filter state
  const activeCategories = new Set<string>([
    'Economic', 'Social', 'Political', 'Environmental',
    'Security', 'Technological', 'Cultural', 'Infrastructure'
  ]);

  // View mode state ('issues', 'systems', 'full')
  let viewMode: 'issues' | 'systems' | 'full' = 'issues';

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
          selectedNode = targetNode;
          panelContent.innerHTML = renderDetailPanel(targetNode, data);
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
          selectedNode = null;
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
          // Switch to Full Network mode to show systems
          if (viewMode !== 'full' && viewMode !== 'systems') {
            viewMode = 'full';
            const viewModeBtns = document.querySelectorAll('.view-mode-btn');
            viewModeBtns.forEach(btn => {
              if ((btn as HTMLElement).dataset.mode === 'full') {
                btn.classList.add('active');
              } else {
                btn.classList.remove('active');
              }
            });
          }

          selectedNode = targetNode;
          panelContent.innerHTML = renderDetailPanel(targetNode, data);
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
      selectedNode = node;

      if (node && node.x !== undefined && node.y !== undefined) {
        // Show detail panel
        panelContent.innerHTML = renderDetailPanel(node, data);
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
    selectedNode = null;
    detailPanel.classList.add('hidden');
    render();
  });

  // View mode selector
  const viewModeBtns = document.querySelectorAll('.view-mode-btn');
  viewModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = (btn as HTMLElement).dataset.mode as 'issues' | 'systems' | 'full';
      viewMode = mode;

      // Update active button
      viewModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update visibility of category filters based on mode
      const categoryFilters = document.getElementById('category-filters') as HTMLDivElement;
      const searchInput = document.getElementById('search') as HTMLInputElement;

      if (mode === 'systems') {
        // Hide category filters and search for systems-only view
        categoryFilters.style.display = 'none';
        searchInput.placeholder = 'Search systems...';
      } else if (mode === 'full') {
        categoryFilters.style.display = 'flex';
        searchInput.placeholder = 'Search issues & systems...';
      } else {
        categoryFilters.style.display = 'flex';
        searchInput.placeholder = 'Search issues...';
      }

      render();
      if (currentView === 'table') {
        renderTable();
      }
    });
  });

  // Create category filter buttons
  const categoryFilters = document.getElementById('category-filters') as HTMLDivElement;
  const categories = [
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

  // Render loop
  function render() {
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transform
    ctx.save();
    ctx.translate(currentTransform.x, currentTransform.y);
    ctx.scale(currentTransform.k, currentTransform.k);

    // Draw edges
    for (const link of graph.getLinks()) {
      // View mode filtering
      const sourceType = link.source.type;
      const targetType = link.target.type;

      if (viewMode === 'issues' && (sourceType === 'system' || targetType === 'system')) {
        continue; // Skip edges connected to systems in issues-only mode
      }
      if (viewMode === 'systems' && (sourceType === 'issue' || targetType === 'issue')) {
        continue; // Skip edges connected to issues in systems-only mode
      }

      // Show edge only if ALL categories of both source and target are active
      const sourceAllCategoriesActive = link.source.categories?.every(cat => activeCategories.has(cat)) ?? true;
      const targetAllCategoriesActive = link.target.categories?.every(cat => activeCategories.has(cat)) ?? true;

      if (!sourceAllCategoriesActive || !targetAllCategoriesActive) continue;

      const isConnected = selectedNode &&
        (link.source.id === selectedNode.id || link.target.id === selectedNode.id);

      ctx.strokeStyle = isConnected
        ? 'rgba(148, 163, 184, 0.8)'
        : 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = (isConnected ? 2 : 1) / currentTransform.k;

      ctx.beginPath();
      ctx.moveTo(link.source.x!, link.source.y!);
      ctx.lineTo(link.target.x!, link.target.y!);
      ctx.stroke();
    }

    // Draw nodes
    for (const node of graph.getNodes()) {
      // View mode filtering
      if (viewMode === 'issues' && node.type === 'system') {
        continue; // Skip systems in issues-only mode
      }
      if (viewMode === 'systems' && node.type === 'issue') {
        continue; // Skip issues in systems-only mode
      }

      // Show node only if ALL of its categories are active (hide if ANY category is disabled)
      const allCategoriesActive = node.categories?.every(cat => activeCategories.has(cat)) ?? true;

      if (!allCategoriesActive) continue;

      const isHovered = hoveredNode && node.id === hoveredNode.id;
      const isSelected = selectedNode && node.id === selectedNode.id;
      const isSearchMatch = searchTerm !== '' && searchResults.has(node.id);
      const isConnected = selectedNode
        ? data.edges.some(e =>
            (e.source === selectedNode!.id && e.target === node.id) ||
            (e.target === selectedNode!.id && e.source === node.id)
          )
        : false;

      // Determine relevance
      let isRelevant = true;
      if (searchTerm !== '') {
        isRelevant = isSearchMatch;
      } else if (selectedNode) {
        isRelevant = isSelected || isConnected;
      }

      ctx.fillStyle = node.color;
      ctx.globalAlpha = isRelevant ? (isHovered ? 1.0 : 0.9) : 0.1;

      const size = (isHovered || isSelected) ? node.size * 1.2 : node.size;

      // Draw main circle (primary category color)
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
      ctx.fill();

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

  graph.onTick(render);

  // Now that all dependencies (activeCategories, searchTerm, etc.) are initialized,
  // we can safely call resizeCanvas which calls render
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  render();

  // Fit graph to view after simulation settles (500ms delay)
  setTimeout(fitToView, 500);

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
      selectedNode = null;
      detailPanel.classList.add('hidden');

      render();
    });
  }

  // Set up tab navigation
  const tabGraph = document.getElementById('tab-graph') as HTMLButtonElement;
  const tabTable = document.getElementById('tab-table') as HTMLButtonElement;
  const tabWiki = document.getElementById('tab-wiki') as HTMLButtonElement;
  const tableContainer = document.getElementById('table-container') as HTMLDivElement;

  // Tab clicks navigate via router (which updates URL and calls showView)
  tabGraph.addEventListener('click', () => router.navigateToView('graph'));
  tabTable.addEventListener('click', () => router.navigateToView('table'));
  tabWiki.addEventListener('click', () => router.navigateToView('wiki'));

  // Table rendering (assign to forward-declared function)
  renderTable = function() {
    // Get filtered nodes
    const nodes = graph.getNodes().filter(node => {
      // Apply view mode filter
      if (viewMode === 'issues' && node.type === 'system') return false;
      if (viewMode === 'systems' && node.type === 'issue') return false;

      // Apply category filter - show only if ALL categories are active
      const allCategoriesActive = node.categories?.every(cat => activeCategories.has(cat)) ?? true;
      if (!allCategoriesActive) return false;

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
          selectedNode = node;
          panelContent.innerHTML = renderDetailPanel(node, data);
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
    const issueArticles = articles.filter(a => a.type === 'issue');
    const systemArticles = articles.filter(a => a.type === 'system');

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

      ${systemArticles.length > 0 ? `
        <div class="wiki-sidebar-section">
          <h3>Systems (${systemArticles.length})</h3>
          <div class="wiki-sidebar-list">
            ${systemArticles.map(renderSidebarItem).join('')}
          </div>
        </div>
      ` : ''}
    `;

    wikiSidebarContent.innerHTML = sidebarHtml;

    // Render article content or welcome message
    if (selectedWikiArticle && data.articles[selectedWikiArticle]) {
      const article = data.articles[selectedWikiArticle];
      wikiArticleContent.innerHTML = renderWikiArticleContent(article, data);
    } else {
      wikiArticleContent.innerHTML = `
        <div class="wiki-welcome">
          <h2>Shadow Workipedia</h2>
          <p class="wiki-welcome-subtitle">${articles.length} articles documenting global issues and systems</p>
          <p>Select an article from the sidebar to start reading.</p>
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
          router.navigateToArticle(article.type as 'issue' | 'system', articleId);
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
            selectedNode = targetNode;
            panelContent.innerHTML = renderDetailPanel(targetNode, data);
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
            selectedNode = targetNode;
            panelContent.innerHTML = renderDetailPanel(targetNode, data);
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

  // Re-trigger initial route handling now that all functions are defined
  const currentRoute = router.getCurrentRoute();
  if (currentRoute?.kind === 'article' && currentRoute.type === 'issue') {
    renderWikiList();
  } else if (currentRoute?.kind === 'view' && currentRoute.view === 'wiki') {
    renderWikiList();
  }
}

main().catch(console.error);
