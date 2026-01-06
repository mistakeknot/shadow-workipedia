#!/usr/bin/env node
import { initializeCommandPalette } from '../src/main/palette';

const makeStubElement = () =>
  ({
    classList: {
      add() {},
      remove() {},
      contains() {
        return false;
      },
    },
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    scrollIntoView() {},
    focus() {},
    getAttribute() {
      return null;
    },
    setAttribute() {},
    innerHTML: '',
    value: '',
  }) as unknown as HTMLElement;

const stubDoc = {
  activeElement: null,
  getElementById(_id: string) {
    return makeStubElement();
  },
  addEventListener() {},
} as Document;

const result = initializeCommandPalette({
  doc: stubDoc,
  router: {
    navigateToView() {},
    navigateToArticle() {},
    navigateToCommunity() {},
  },
  graph: {
    getNodes() {
      return [];
    },
  },
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
  canvas: { width: 100, height: 100 } as HTMLCanvasElement,
  hoverHandler: { updateTransform() {}, setVisibleNodes() {} },
  clickHandler: { updateTransform() {}, setVisibleNodes() {} },
  dragHandler: { updateTransform() {}, setVisibleNodes() {} },
  zoomHandler: { setTransform() {} },
  getCurrentTransform: () => ({ x: 0, y: 0, k: 1 }),
  getCurrentView: () => 'graph',
  getShowIssues: () => true,
  getShowSystems: () => true,
  getShowPrinciples: () => true,
  setSelectedNode() {},
  panelContent: makeStubElement() as HTMLDivElement,
  detailPanel: makeStubElement() as HTMLDivElement,
  tooltip: makeStubElement() as HTMLDivElement,
  renderDetailPanel() {
    return '';
  },
  attachDetailPanelHandlers() {},
  render() {},
  resetBtn: makeStubElement() as HTMLButtonElement,
});

if (!result || typeof result.openPalette !== 'function' || typeof result.closePalette !== 'function') {
  throw new Error('Expected command palette initializer to return open/close handlers.');
}

console.log('main palette test passed.');
