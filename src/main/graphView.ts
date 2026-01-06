import type { GraphSimulation, SimNode } from '../graph';

type GraphViewDeps = {
  graph: GraphSimulation;
  canvas: HTMLCanvasElement;
  getShowIssues: () => boolean;
  getShowSystems: () => boolean;
  getShowPrinciples: () => boolean;
  activeCategories: Set<string>;
  setCurrentTransform: (value: { x: number; y: number; k: number }) => void;
  onTransformApplied: (transform: { x: number; y: number; k: number }) => void;
};

export function createGraphViewHelpers({
  graph,
  canvas,
  getShowIssues,
  getShowSystems,
  getShowPrinciples,
  activeCategories,
  setCurrentTransform,
  onTransformApplied,
}: GraphViewDeps) {
  function getVisibleNodes(): SimNode[] {
    return graph.getNodes().filter((node) => {
      if (node.type === 'issue' && !getShowIssues()) return false;
      if (node.type === 'system' && !getShowSystems()) return false;
      if (node.type === 'principle' && !getShowPrinciples()) return false;

      if (node.type === 'principle') return true;
      if (!node.categories || node.categories.length === 0) return true;
      const anyCategoryActive = node.categories.some((cat) => activeCategories.has(cat));
      return anyCategoryActive;
    });
  }

  function fitToView() {
    const nodes = graph.getNodes();
    if (nodes.length === 0) return;

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

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

    const padding = 0.1;
    const availableWidth = canvas.width * (1 - 2 * padding);
    const availableHeight = canvas.height * (1 - 2 * padding);

    const scaleX = availableWidth / graphWidth;
    const scaleY = availableHeight / graphHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const canvasCenterX = canvas.width / 2;
    const canvasCenterY = canvas.height / 2;
    const translateX = canvasCenterX - graphCenterX * scale;
    const translateY = canvasCenterY - graphCenterY * scale;

    const nextTransform = { x: translateX, y: translateY, k: scale };
    setCurrentTransform(nextTransform);
    onTransformApplied(nextTransform);
  }

  return { getVisibleNodes, fitToView };
}
