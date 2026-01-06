#!/usr/bin/env node
import { createInteractionHandlers } from '../src/main/interactionsSetup';

const canvas = {
  width: 100,
  height: 100,
  style: { cursor: '' },
  addEventListener() {},
} as unknown as HTMLCanvasElement;

const helpers = createInteractionHandlers({
  canvas,
  graph: {
    getNodes() {
      return [] as unknown as Array<{ id: string }>;
    },
    restart() {},
  } as unknown as { getNodes: () => unknown[]; restart: () => void },
  data: {
    nodes: [],
    edges: [],
    metadata: {
      generatedAt: new Date().toISOString(),
      issueCount: 0,
      systemCount: 0,
      edgeCount: 0,
    },
  },
  tooltip: {
    classList: { add() {}, remove() {}, contains() { return false; } },
    style: { left: '', top: '' },
    innerHTML: '',
  } as unknown as HTMLElement,
  panelContent: {} as HTMLElement,
  detailPanel: { classList: { add() {}, remove() {} } } as unknown as HTMLElement,
  render: () => {},
  setSelectedNode: () => {},
  setHoveredNode: () => {},
  getCurrentTransform: () => ({ x: 0, y: 0, k: 1 }),
  setCurrentTransform: () => {},
  renderDetailPanel: () => '',
  attachDetailPanelHandlers: () => {},
  syncZoomTransform: () => {},
});

if (!helpers.dragHandler || !helpers.hoverHandler || !helpers.clickHandler) {
  throw new Error('Expected interaction handlers.');
}

console.log('main interactions setup test passed.');
