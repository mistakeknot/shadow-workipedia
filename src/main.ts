import './style.css';
import type { GraphData } from './types';
import { GraphSimulation } from './graph';
import type { SimNode } from './graph';
import { ZoomPanHandler, HoverHandler, ClickHandler, DragHandler } from './interactions';
import { ArticleRouter, renderWikiArticleContent } from './article';
import { initializeAgentsView } from './agentsView';
import { createCanvasContext } from './main/canvas';
import { initializeMainDom } from './main/dom';
import { attachMainHandlers } from './main/handlers';
import { initializeCommandPalette } from './main/palette';
import { createRenderLoop } from './main/render';
import { createRouter } from './main/router';
import { createTableRenderer } from './main/table';
import { createWikiRenderer } from './main/wiki';
import { createViewController } from './main/views';
import { createGraphViewHelpers } from './main/graphView';
import { initializeMainState } from './main/state';
import { createDetailPanelHelpers } from './main/detailPanel';
import { applyDataLoadWarning, createIssueIdResolver, loadGraphData } from './main/dataLoad';
import {
  drawArrow,
  drawDiamond,
  getCategoryColor,
  getCategoryKeys,
  getCommunityColor,
  getPrimitiveColor,
  getPrimitiveLabel,
  renderCommunityHulls,
  renderCommunityLabels,
} from './main/graphUtils';

let renderDetailPanel: (node: SimNode, data: GraphData) => string = () => '';
let attachDetailPanelHandlers: () => void = () => {};

async function main() {
  console.log('🚀 Shadow Workipedia initializing...');

  // Load data
  const { data, dataLoadError } = await loadGraphData();

  console.log(`📊 Loaded ${data.metadata.issueCount} issues, ${data.metadata.systemCount} systems`);
  if (data.metadata.articleCount) {
    console.log(`📚 ${data.metadata.articleCount} wiki articles available`);
  }

  const resolveIssueId = createIssueIdResolver(data);

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

  applyDataLoadWarning({ warningBanner, dataLoadError, data, protocol: window.location.protocol });

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
  router = createRouter({
    data,
    resolveIssueId,
    showView,
    renderWikiList: () => renderWikiList(),
    setSelectedWikiArticle: (value) => {
      selectedWikiArticle = value;
    },
    setSelectedCommunity: (value) => {
      selectedCommunity = value;
    },
    setWikiSection: (value) => {
      wikiSection = value;
    },
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

  const showSystemsBtn = document.getElementById('show-systems-btn') as HTMLButtonElement | null;
  const detailPanelHelpers = createDetailPanelHelpers({
    data,
    graph,
    panelContent,
    detailPanel,
    tooltip,
    canvas,
    router,
    getCurrentTransform: () => currentTransform,
    setCurrentTransform: (value) => {
      currentTransform = value;
    },
    hoverHandler,
    clickHandler,
    dragHandler,
    zoomHandler,
    render: () => render(),
    setSelectedNode,
    getShowSystems: () => showSystems,
    setShowSystems: (value) => {
      showSystems = value;
    },
    activateShowSystems: () => {
      if (showSystemsBtn) showSystemsBtn.classList.add('active');
    },
  });

  renderDetailPanel = detailPanelHelpers.renderDetailPanel;
  attachDetailPanelHandlers = detailPanelHelpers.attachDetailPanelHandlers;

  // Fit entire graph to view with padding
  const graphViewHelpers = createGraphViewHelpers({
    graph,
    canvas,
    getShowIssues: () => showIssues,
    getShowSystems: () => showSystems,
    getShowPrinciples: () => showPrinciples,
    activeCategories,
    setCurrentTransform: (value) => {
      currentTransform = value;
    },
    onTransformApplied: (transform) => {
      zoomHandler.setTransform(transform);
      hoverHandler.updateTransform(transform);
      clickHandler.updateTransform(transform);
      dragHandler.updateTransform(transform);
      render();
    },
  });

  const { fitToView, getVisibleNodes } = graphViewHelpers;

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
      getCategoryKeys().forEach((category) => {
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
