#!/usr/bin/env node
import { createWikiRenderer } from '../src/main/wiki';

const makeStubElement = () =>
  ({
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return null; },
    innerHTML: '',
    scrollTop: 0,
  }) as unknown as HTMLElement;

const renderWikiList = createWikiRenderer({
  data: { nodes: [], edges: [], metadata: { generatedAt: '', issueCount: 0, systemCount: 0, edgeCount: 0 } },
  graph: { getNodes() { return []; } },
  router: {
    navigateToView() {},
    navigateToArticle() {},
    navigateToCommunity() {},
  },
  resolveIssueId: (id: string) => id,
  getSelectedWikiArticle: () => null,
  getSelectedCommunity: () => null,
  getWikiSection: () => 'articles',
  wikiSidebarContent: makeStubElement() as HTMLDivElement,
  wikiArticleContent: makeStubElement() as HTMLDivElement,
  wikiSidebar: makeStubElement() as HTMLDivElement,
  panelContent: makeStubElement() as HTMLDivElement,
  detailPanel: makeStubElement() as HTMLDivElement,
  canvas: { width: 100, height: 100 } as HTMLCanvasElement,
  getCurrentTransform: () => ({ x: 0, y: 0, k: 1 }),
  setCurrentTransform() {},
  hoverHandler: { updateTransform() {}, setVisibleNodes() {} },
  clickHandler: { updateTransform() {}, setVisibleNodes() {} },
  dragHandler: { updateTransform() {}, setVisibleNodes() {} },
  zoomHandler: { setTransform() {} },
  render() {},
  setSelectedNode() {},
  renderDetailPanel() { return ''; },
  renderWikiArticleContent() { return ''; },
  attachDetailPanelHandlers() {},
});

if (typeof renderWikiList !== 'function') {
  throw new Error('Expected createWikiRenderer to return a function.');
}

console.log('main wiki test passed.');
