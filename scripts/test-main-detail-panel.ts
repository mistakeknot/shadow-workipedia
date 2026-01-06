#!/usr/bin/env node
import type { GraphData } from '../src/types';
import type { SimNode } from '../src/graph';
import type { ArticleRouter } from '../src/article';
import { createDetailPanelHelpers } from '../src/main/detailPanel';

const data: GraphData = {
  nodes: [],
  edges: [],
  metadata: {
    generatedAt: new Date().toISOString(),
    issueCount: 0,
    systemCount: 0,
    edgeCount: 0,
  },
};

const helpers = createDetailPanelHelpers({
  data,
  graph: {
    getNodes() {
      return [] as SimNode[];
    },
    getLinks() {
      return [] as unknown as Array<{ source: SimNode; target: SimNode }>;
    },
  } as unknown as { getNodes: () => SimNode[]; getLinks: () => Array<{ source: SimNode; target: SimNode }>; },
  panelContent: {} as HTMLElement,
  detailPanel: {} as HTMLElement,
  tooltip: {
    classList: {
      add() {},
      remove() {},
      contains() { return false; },
    },
  } as unknown as HTMLElement,
  canvas: { width: 100, height: 100 } as HTMLCanvasElement,
  router: { navigateToArticle() {} } as unknown as ArticleRouter,
  getCurrentTransform: () => ({ x: 0, y: 0, k: 1 }),
  setCurrentTransform: () => {},
  hoverHandler: { updateTransform() {} } as unknown as { updateTransform: (transform: { x: number; y: number; k: number }) => void },
  clickHandler: { updateTransform() {} } as unknown as { updateTransform: (transform: { x: number; y: number; k: number }) => void },
  dragHandler: { updateTransform() {} } as unknown as { updateTransform: (transform: { x: number; y: number; k: number }) => void },
  zoomHandler: { setTransform() {} } as unknown as { setTransform: (transform: { x: number; y: number; k: number }) => void },
  render: () => {},
  setSelectedNode: () => {},
  getShowSystems: () => true,
  setShowSystems: () => {},
  activateShowSystems: () => {},
});

if (typeof helpers.renderDetailPanel !== 'function' || typeof helpers.attachDetailPanelHandlers !== 'function') {
  throw new Error('Expected detail panel helpers.');
}

console.log('main detail panel test passed.');
