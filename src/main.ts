import './style.css';
import type { GraphData } from './types';
import { GraphSimulation } from './graph';
import type { SimNode } from './graph';
import { ZoomPanHandler, HoverHandler, ClickHandler } from './interactions';

function renderDetailPanel(node: SimNode, data: GraphData): string {
  if (node.type === 'issue') {
    return `
      <h2>${node.label}</h2>
      <div class="node-badges">
        <span class="badge" style="background: ${node.color}">${node.category}</span>
        <span class="badge urgency-${node.urgency?.toLowerCase()}">${node.urgency}</span>
      </div>
      <p class="description">${node.description || 'No description available.'}</p>

      <h3>Impact Metrics</h3>
      <div class="metric">
        <span>Public Concern:</span>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${node.publicConcern}%; background: #3b82f6"></div>
        </div>
        <span>${node.publicConcern}%</span>
      </div>
      <div class="metric">
        <span>Economic Impact:</span>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${node.economicImpact}%; background: #f59e0b"></div>
        </div>
        <span>${node.economicImpact}%</span>
      </div>
      <div class="metric">
        <span>Social Impact:</span>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${node.socialImpact}%; background: #8b5cf6"></div>
        </div>
        <span>${node.socialImpact}%</span>
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
  } else {
    return `
      <h2>${node.label}</h2>
      <div class="node-badges">
        <span class="badge" style="background: ${node.color}">System</span>
      </div>
      <p class="description">${node.description || 'Simulation system'}</p>

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

  // Hide loading indicator
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');

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
    // Calculate header + filter bar height dynamically
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
              ? `${node.category} • ${node.urgency}`
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
    'Security', 'Technological', 'Cultural', 'Infrastructure',
    'System'
  ]);

  // Search state
  let searchTerm = '';
  let searchResults = new Set<string>();

  // Initialize click handler
  const clickHandler = new ClickHandler(
    canvas,
    graph.getNodes(),
    (node) => {
      selectedNode = node;

      if (node) {
        // Show detail panel
        panelContent.innerHTML = renderDetailPanel(node, data);
        detailPanel.classList.remove('hidden');

        // Add click handlers to connection items
        const connectionItems = panelContent.querySelectorAll('.connection-item');
        connectionItems.forEach(item => {
          item.addEventListener('click', () => {
            const nodeId = item.getAttribute('data-node-id');
            const targetNode = graph.getNodes().find(n => n.id === nodeId);
            if (targetNode) {
              selectedNode = targetNode;
              panelContent.innerHTML = renderDetailPanel(targetNode, data);
            }
          });
        });
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
    { name: 'System', color: '#64748b' },
  ];

  for (const cat of categories) {
    const btn = document.createElement('button');
    btn.className = 'category-filter-btn active';
    btn.textContent = cat.name;
    btn.style.borderColor = cat.color;
    btn.style.color = cat.color;

    btn.addEventListener('click', () => {
      if (activeCategories.has(cat.name)) {
        activeCategories.delete(cat.name);
        btn.classList.remove('active');
      } else {
        activeCategories.add(cat.name);
        btn.classList.add('active');
      }
      render();
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
      return;
    }

    // Find matching nodes
    for (const node of graph.getNodes()) {
      const matchesName = node.label.toLowerCase().includes(searchTerm);
      const matchesDesc = node.description?.toLowerCase().includes(searchTerm);
      const matchesCat = node.category?.toLowerCase().includes(searchTerm);

      if (matchesName || matchesDesc || matchesCat) {
        searchResults.add(node.id);
      }
    }

    console.log(`Found ${searchResults.size} matches for "${term}"`);
    render();
  }

  searchInput.addEventListener('input', (e) => {
    performSearch((e.target as HTMLInputElement).value);
  });

  // Initialize zoom/pan
  const zoomHandler = new ZoomPanHandler(canvas, (transform) => {
    currentTransform = transform;
    hoverHandler.updateTransform(transform);
    clickHandler.updateTransform(transform);
    render();
  });

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
      const sourceCat = link.source.type === 'issue' ? link.source.category : 'System';
      const targetCat = link.target.type === 'issue' ? link.target.category : 'System';

      const isSourceFiltered = !activeCategories.has(sourceCat || '');
      const isTargetFiltered = !activeCategories.has(targetCat || '');

      if (isSourceFiltered || isTargetFiltered) continue;

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
      const categoryKey = node.type === 'issue' ? node.category : 'System';
      const isFiltered = !activeCategories.has(categoryKey || '');

      if (isFiltered) continue;

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

      ctx.beginPath();
      ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
      ctx.fill();

      // Highlight ring for search matches
      if (isSearchMatch && !isSelected) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / currentTransform.k;
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
}

main().catch(console.error);
