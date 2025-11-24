import './style.css';
import type { GraphData, IssueCategory } from './types';
import { GraphSimulation } from './graph';
import type { SimNode } from './graph';
import { ZoomPanHandler, HoverHandler, ClickHandler, DragHandler } from './interactions';
import { ArticleRouter, renderArticleView, renderArticleNotFound } from './article';

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
  if (node.type === 'issue') {
    return `
      <h2>${node.label}</h2>
      <div class="node-badges">
        ${node.categories?.map(cat => `<span class="badge category-badge" style="background: ${getCategoryColor(cat)}">${cat}</span>`).join('') || ''}
        <span class="badge urgency-${node.urgency?.toLowerCase()}">${node.urgency}</span>
      </div>
      <p class="description">${node.description || 'No description available.'}</p>

      ${node.hasArticle ? `
        <button class="read-article-btn" onclick="window.location.hash='#/${node.type}/${node.id}'">
          📄 Read Full Article (${node.wordCount?.toLocaleString()} words)
        </button>
      ` : ''}

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

      ${node.systemWalk?.hasSystemWalk ? `
        <h3>System Walk Subsystems <span class="badge system-walk-complete">✓ Complete</span></h3>
        <div class="subsystems">
          ${node.systemWalk.subsystems.map(subsystem => `<div class="subsystem-item">${subsystem}</div>`).join('')}
        </div>
        <p class="system-walk-info">${node.systemWalk.subsystems.length} subsystems • ${node.systemWalk.totalLines?.toLocaleString()} total lines</p>
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

      ${node.evolutionPaths && node.evolutionPaths.length > 0 ? `
        <h3>Evolution Paths</h3>
        <ul class="evolution-list">
          ${node.evolutionPaths.map(path => `
            <li>${path}</li>
          `).join('')}
        </ul>
      ` : ''}

      <h3>Connected Nodes (${getConnections(node, data).length})</h3>
      <div class="connections">
        ${getConnections(node, data).map(conn => `
          <div class="connection-item" data-node-id="${conn.id}">
            <span class="connection-type">${conn.type}</span>
            <span class="connection-name">${conn.label}</span>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    return `
      <h2>${node.label}</h2>
      <div class="node-badges">
        <span class="badge" style="background: ${node.color}">System</span>
      </div>
      <p class="description">${node.description || 'Simulation system'}</p>

      ${node.hasArticle ? `
        <button class="read-article-btn" onclick="window.location.hash='#/${node.type}/${node.id}'">
          📄 Read Full Article (${node.wordCount?.toLocaleString()} words)
        </button>
      ` : ''}

      <h3>Stats</h3>
      <div class="stat-item">
        <span>Connections:</span>
        <strong>${node.connectionCount}</strong>
      </div>

      <h3>Connected Nodes</h3>
      <div class="connections">
        ${getConnections(node, data).map(conn => `
          <div class="connection-item" data-node-id="${conn.id}">
            <span class="connection-type">${conn.type}</span>
            <span class="connection-name">${conn.label}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
}

function getConnections(node: SimNode, data: GraphData): Array<{id: string, label: string, type: string}> {
  const connections: Array<{id: string, label: string, type: string}> = [];

  for (const edge of data.edges) {
    if (edge.source === node.id) {
      const target = data.nodes.find(n => n.id === edge.target);
      if (target) {
        connections.push({
          id: target.id,
          label: target.label,
          type: edge.type.replace('-', ' → '),
        });
      }
    } else if (edge.target === node.id) {
      const source = data.nodes.find(n => n.id === edge.source);
      if (source) {
        connections.push({
          id: source.id,
          label: source.label,
          type: edge.type.replace('-', ' ← '),
        });
      }
    }
  }

  return connections.slice(0, 20); // Limit to 20 connections
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
  const articleView = document.getElementById('article-view');
  const articleContainer = document.getElementById('article-container');
  const header = document.getElementById('header');
  const tabNav = document.getElementById('tab-nav');
  const filterBar = document.getElementById('filter-bar');

  if (!graphView || !tableView || !articleView || !articleContainer) {
    throw new Error('Required view elements not found');
  }

  // Initialize article router
  const router = new ArticleRouter((route) => {
    if (route) {
      // Article view - hide graph/table, show article
      graphView.classList.add('hidden');
      tableView.classList.add('hidden');
      articleView.classList.remove('hidden');
      if (header) header.classList.add('hidden');
      if (tabNav) tabNav.classList.add('hidden');
      if (filterBar) filterBar.classList.add('hidden');

      // Get route info and render article
      const routeInfo = router.getCurrentRoute();
      if (routeInfo && data.articles) {
        const article = data.articles[routeInfo.slug];
        if (article) {
          articleContainer.innerHTML = renderArticleView(article, data);
        } else {
          articleContainer.innerHTML = renderArticleNotFound(routeInfo.type, routeInfo.slug);
        }
      }
    } else {
      // Graph/table view - show navigation, hide article
      articleView.classList.add('hidden');
      if (header) header.classList.remove('hidden');
      if (tabNav) tabNav.classList.remove('hidden');
      if (filterBar) filterBar.classList.remove('hidden');

      // Show active tab view (graph or table)
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab?.id === 'tab-table') {
        graphView.classList.add('hidden');
        tableView.classList.remove('hidden');
      } else {
        graphView.classList.remove('hidden');
        tableView.classList.add('hidden');
      }
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
    // Calculate header + tab nav + filter bar height dynamically
    const header = document.getElementById('header');
    const tabNav = document.getElementById('tab-nav');
    const filterBar = document.getElementById('filter-bar');
    const headerHeight = header?.offsetHeight || 0;
    const tabNavHeight = tabNav?.offsetHeight || 0;
    const filterHeight = filterBar?.offsetHeight || 0;
    canvas.height = window.innerHeight - headerHeight - tabNavHeight - filterHeight;

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

  // View state (needed early for category filter handlers)
  let currentView: 'graph' | 'table' = 'graph';
  let tableSortColumn: string | null = null;
  let tableSortDirection: 'asc' | 'desc' = 'asc';

  // Forward declare renderTable function (implemented later)
  let renderTable: () => void;

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
        const attachConnectionHandlers = () => {
          // Handle connection item clicks
          const connectionItems = panelContent.querySelectorAll('.connection-item');
          connectionItems.forEach(item => {
            item.addEventListener('click', () => {
              const nodeId = item.getAttribute('data-node-id');
              const targetNode = graph.getNodes().find(n => n.id === nodeId);
              if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined) {
                selectedNode = targetNode;
                panelContent.innerHTML = renderDetailPanel(targetNode, data);
                attachConnectionHandlers(); // Re-attach handlers for new connections
                // Hide tooltip to prevent overlap
                tooltip.classList.add('hidden');

                // Pan to center the selected node in the viewport
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const newX = centerX - targetNode.x * currentTransform.k;
                const newY = centerY - targetNode.y * currentTransform.k;

                // Smooth transition to new position
                const startX = currentTransform.x;
                const startY = currentTransform.y;
                const duration = 500; // ms
                const startTime = Date.now();

                const animate = () => {
                  const elapsed = Date.now() - startTime;
                  const progress = Math.min(elapsed / duration, 1);
                  // Ease-out curve
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
              }
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
                attachConnectionHandlers(); // Re-attach handlers
                // Hide tooltip to prevent overlap
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
        };

        attachConnectionHandlers();
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

  // Set up reset button
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Reset zoom
      zoomHandler.reset();
      graph.restart();

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
  const tableContainer = document.getElementById('table-container') as HTMLDivElement;

  function switchToView(view: 'graph' | 'table') {
    currentView = view;

    if (view === 'graph') {
      tabGraph.classList.add('active');
      tabTable.classList.remove('active');
      graphView?.classList.remove('hidden');
      tableView?.classList.add('hidden');
    } else {
      tabGraph.classList.remove('active');
      tabTable.classList.add('active');
      graphView?.classList.add('hidden');
      tableView?.classList.remove('hidden');
      renderTable();
    }
  }

  tabGraph.addEventListener('click', () => switchToView('graph'));
  tabTable.addEventListener('click', () => switchToView('table'));

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
          const attachConnectionHandlers = () => {
            const connectionItems = panelContent.querySelectorAll('.connection-item');
            connectionItems.forEach(item => {
              item.addEventListener('click', () => {
                const targetNodeId = item.getAttribute('data-node-id');
                const targetNode = graph.getNodes().find(n => n.id === targetNodeId);
                if (targetNode) {
                  selectedNode = targetNode;
                  panelContent.innerHTML = renderDetailPanel(targetNode, data);
                  attachConnectionHandlers(); // Re-attach for new connections
                  // Hide tooltip to prevent overlap
                  tooltip.classList.add('hidden');
                }
              });
            });
          };

          attachConnectionHandlers();
        }
      });
    });
  }
}

main().catch(console.error);
