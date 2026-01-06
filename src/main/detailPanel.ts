import type { GraphData } from '../types';
import type { GraphSimulation, SimNode } from '../graph';
import type { ArticleRouter } from '../article';
import type { ClickHandler, DragHandler, HoverHandler, ZoomPanHandler } from '../interactions';
import { getCategoryColor } from './graphUtils';

type Transform = { x: number; y: number; k: number };

type DetailPanelDeps = {
  data: GraphData;
  graph: GraphSimulation;
  panelContent: HTMLElement;
  detailPanel: HTMLElement;
  tooltip: HTMLElement;
  canvas: HTMLCanvasElement;
  router: ArticleRouter;
  getCurrentTransform: () => Transform;
  setCurrentTransform: (transform: Transform) => void;
  hoverHandler: HoverHandler;
  clickHandler: ClickHandler;
  dragHandler: DragHandler;
  zoomHandler: ZoomPanHandler;
  render: () => void;
  setSelectedNode: (node: SimNode | null) => void;
  getShowSystems: () => boolean;
  setShowSystems: (value: boolean) => void;
  activateShowSystems: () => void;
};

type ConnectionItem = { id: string; label: string; type: string };

export function createDetailPanelHelpers({
  data,
  graph,
  panelContent,
  detailPanel,
  tooltip,
  canvas,
  router,
  getCurrentTransform,
  setCurrentTransform,
  hoverHandler,
  clickHandler,
  dragHandler,
  zoomHandler,
  render,
  setSelectedNode,
  getShowSystems,
  setShowSystems,
  activateShowSystems,
}: DetailPanelDeps) {
  function getConnections(node: SimNode, dataSource: GraphData, limit?: number): ConnectionItem[] {
    const connections: ConnectionItem[] = [];
    const seen = new Set<string>();

    for (const edge of dataSource.edges) {
      if (edge.source === node.id) {
        const target = dataSource.nodes.find((n) => n.id === edge.target);
        if (target && !seen.has(target.id)) {
          seen.add(target.id);
          connections.push({
            id: target.id,
            label: target.label,
            type: edge.type.replace('-', ' &rarr; '),
          });
        }
      } else if (edge.target === node.id) {
        const source = dataSource.nodes.find((n) => n.id === edge.source);
        if (source && !seen.has(source.id)) {
          seen.add(source.id);
          connections.push({
            id: source.id,
            label: source.label,
            type: edge.type.replace('-', ' &larr; '),
          });
        }
      }
    }

    connections.sort((a, b) => a.label.localeCompare(b.label));

    return limit ? connections.slice(0, limit) : connections;
  }

  function renderPanelRelatedContent(node: SimNode, dataSource: GraphData): string {
    const connections = getConnections(node, dataSource);
    const connectedIssues = connections.filter((c) => {
      const n = dataSource.nodes.find((other) => other.id === c.id);
      return n?.type === 'issue';
    });
    const connectedSystems = connections.filter((c) => {
      const n = dataSource.nodes.find((other) => other.id === c.id);
      return n?.type === 'system';
    });

    const caseStudies = node.type === 'issue' && dataSource.articles
      ? Object.values(dataSource.articles)
          .filter((article) => {
            const parent = article.frontmatter?.caseStudyOf;
            return article.type === 'issue' && typeof parent === 'string' && parent.trim() === node.id;
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
              ${connectedIssues.map((conn) => `
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
              ${caseStudies.map((article) => `
                <a class="connection-item" href="#/wiki/${article.id}">
                  <span class="connection-name">${article.title}</span>
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${connectedSystems.length > 0 ? `
          <div class="related-section">
            <h3>Related Systems (${connectedSystems.length})</h3>
            <div class="connections">
              ${connectedSystems.map((conn) => `
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

  function renderDetailPanel(node: SimNode, dataSource: GraphData): string {
    if (node.hasArticle && dataSource.articles && dataSource.articles[node.id]) {
      const article = dataSource.articles[node.id];
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
          ${renderPanelRelatedContent(node, dataSource)}
          <div class="article-footer">
            ${isFileBacked ? `
              <a
                href="https://github.com/mistakeknot/shadow-workipedia/edit/main/wiki/${article.type}s/${article.id}.md"
                target="_blank"
                class="edit-link"
              >
                 Edit this article on GitHub
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }

    if (node.type === 'issue') {
      return `
        <h2>${node.label}</h2>
        <div class="node-badges">
          ${node.categories?.map((cat) => `<span class="badge category-badge" style="background: ${getCategoryColor(cat)}">${cat}</span>`).join('') || ''}
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
            ${node.affectedSystems.map((system) => {
              const systemId = system
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
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
            ${node.crisisExamples.map((example) => `
              <li>${example}</li>
            `).join('')}
          </ul>
        ` : ''}

        <h3>Connected Nodes (${getConnections(node, dataSource).length})</h3>
        <div class="connections">
          ${getConnections(node, dataSource, 20).map((conn) => `
            <div class="connection-item" data-node-id="${conn.id}">
              <span class="connection-type">${conn.type}</span>
              <span class="connection-name">${conn.label}</span>
            </div>
          `).join('')}
          ${getConnections(node, dataSource).length > 20 ? `<span class="more-count">+${getConnections(node, dataSource).length - 20} more</span>` : ''}
        </div>
      `;
    }

    const allConnections = getConnections(node, dataSource);
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
        ${allConnections.slice(0, 30).map((conn) => `
          <div class="connection-item" data-node-id="${conn.id}">
            <span class="connection-type">${conn.type}</span>
            <span class="connection-name">${conn.label}</span>
          </div>
        `).join('')}
        ${allConnections.length > 30 ? `<span class="more-count">+${allConnections.length - 30} more</span>` : ''}
      </div>
    `;
  }

  function applyTransform(transform: Transform) {
    setCurrentTransform(transform);
    hoverHandler.updateTransform(transform);
    clickHandler.updateTransform(transform);
    dragHandler.updateTransform(transform);
    render();
  }

  function panToNode(targetNode: SimNode) {
    const transform = getCurrentTransform();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const newX = centerX - targetNode.x * transform.k;
    const newY = centerY - targetNode.y * transform.k;

    const startX = transform.x;
    const startY = transform.y;
    const duration = 500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const nextTransform = {
        x: startX + (newX - startX) * eased,
        y: startY + (newY - startY) * eased,
        k: transform.k,
      };

      applyTransform(nextTransform);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        zoomHandler.setTransform(nextTransform);
      }
    };

    animate();
  }

  function attachDetailPanelHandlers() {
    const connectionItems = panelContent.querySelectorAll('.connection-item');
    connectionItems.forEach((item) => {
      item.addEventListener('click', () => {
        const nodeId = item.getAttribute('data-node-id');
        const targetNode = graph.getNodes().find((n) => n.id === nodeId);
        if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined) {
          setSelectedNode(targetNode);
          panelContent.innerHTML = renderDetailPanel(targetNode, data);
          panelContent.scrollTop = 0;
          attachDetailPanelHandlers();
          tooltip.classList.add('hidden');
          panToNode(targetNode);
        }
      });
    });

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
        router.navigateToArticle(type, articleId);
      });
    });

    const systemBadges = panelContent.querySelectorAll('.clickable-badge[data-system-id]');
    systemBadges.forEach((badge) => {
      badge.addEventListener('click', () => {
        const systemId = badge.getAttribute('data-system-id');
        const systemName = badge.getAttribute('data-system-name');
        const targetNode = graph.getNodes().find((n) => n.id === systemId && n.type === 'system');

        if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined) {
          if (!getShowSystems()) {
            setShowSystems(true);
            activateShowSystems();
          }

          setSelectedNode(targetNode);
          panelContent.innerHTML = renderDetailPanel(targetNode, data);
          panelContent.scrollTop = 0;
          attachDetailPanelHandlers();
          tooltip.classList.add('hidden');
          panToNode(targetNode);
        } else {
          console.warn(`System node not found: ${systemName} (${systemId})`);
        }
      });
    });
  }

  return { renderDetailPanel, attachDetailPanelHandlers };
}
