#!/usr/bin/env node
import { createTableRenderer } from '../src/main/table';

const makeStubElement = () =>
  ({
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {},
    querySelectorAll() { return []; },
    setAttribute() {},
    getAttribute() { return null; },
    innerHTML: '',
  }) as unknown as HTMLElement;

const renderTable = createTableRenderer({
  graph: { getNodes() { return []; } },
  data: { nodes: [], edges: [], metadata: { generatedAt: '', issueCount: 0, systemCount: 0, edgeCount: 0 } },
  getShowIssues: () => true,
  getShowSystems: () => true,
  activeCategories: new Set<string>(),
  getSelectedPrimitive: () => null,
  getSearchTerm: () => '',
  searchResults: new Set<string>(),
  getTableSortColumn: () => null,
  setTableSortColumn() {},
  getTableSortDirection: () => 'asc',
  setTableSortDirection() {},
  getCategoryColor() { return '#000'; },
  tableContainer: makeStubElement() as HTMLDivElement,
  setSelectedNode() {},
  panelContent: makeStubElement() as HTMLDivElement,
  detailPanel: makeStubElement() as HTMLDivElement,
  tooltip: makeStubElement() as HTMLDivElement,
  renderDetailPanel() { return ''; },
  attachDetailPanelHandlers() {},
});

if (typeof renderTable !== 'function') {
  throw new Error('Expected createTableRenderer to return a function.');
}

console.log('main table test passed.');
