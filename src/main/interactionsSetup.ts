import type { GraphData } from '../types';
import type { GraphSimulation, SimNode } from '../graph';
import { ClickHandler, DragHandler, HoverHandler } from '../interactions';

type Transform = { x: number; y: number; k: number };

type InteractionDeps = {
  canvas: HTMLCanvasElement;
  graph: GraphSimulation;
  data: GraphData;
  tooltip: HTMLElement;
  panelContent: HTMLElement;
  detailPanel: HTMLElement;
  render: () => void;
  setSelectedNode: (node: SimNode | null) => void;
  setHoveredNode: (node: SimNode | null) => void;
  getCurrentTransform: () => Transform;
  setCurrentTransform: (transform: Transform) => void;
  getRenderDetailPanel: () => (node: SimNode, data: GraphData) => string;
  getAttachDetailPanelHandlers: () => () => void;
  syncZoomTransform: (transform: Transform) => void;
};

export function createInteractionHandlers({
  canvas,
  graph,
  data,
  tooltip,
  panelContent,
  detailPanel,
  render,
  setSelectedNode,
  setHoveredNode,
  getCurrentTransform,
  setCurrentTransform,
  getRenderDetailPanel,
  getAttachDetailPanelHandlers,
  syncZoomTransform,
}: InteractionDeps) {
  const dragHandler = new DragHandler(canvas, graph.getNodes(), render, {
    onReheatSimulation: () => graph.restart(),
  });

  const hoverHandler = new HoverHandler(canvas, graph.getNodes(), (node) => {
    setHoveredNode(node);

    if (node) {
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
      canvas.style.cursor = 'pointer';
    } else {
      tooltip.classList.add('hidden');
      canvas.style.cursor = 'grab';
    }

    render();
  });

  canvas.addEventListener('mousemove', (event) => {
    if (!tooltip.classList.contains('hidden')) {
      tooltip.style.left = `${event.clientX + 16}px`;
      tooltip.style.top = `${event.clientY + 16}px`;
    }
  });

  const clickHandler = new ClickHandler(canvas, graph.getNodes(), (node) => {
    setSelectedNode(node);

    if (node && node.x !== undefined && node.y !== undefined) {
      panelContent.innerHTML = getRenderDetailPanel()(node, data);
      panelContent.scrollTop = 0;
      detailPanel.classList.remove('hidden');
      tooltip.classList.add('hidden');

      const transform = getCurrentTransform();
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const newX = centerX - node.x * transform.k;
      const newY = centerY - node.y * transform.k;

      const startX = transform.x;
      const startY = transform.y;
      const duration = 500;
      const startTime = Date.now();

      const applyTransform = (next: Transform) => {
        setCurrentTransform(next);
        hoverHandler.updateTransform(next);
        clickHandler.updateTransform(next);
        dragHandler.updateTransform(next);
        render();
      };

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
          syncZoomTransform(nextTransform);
        }
      };

      animate();
      getAttachDetailPanelHandlers()();
    } else {
      detailPanel.classList.add('hidden');
    }

    render();
  });

  return { dragHandler, hoverHandler, clickHandler };
}
