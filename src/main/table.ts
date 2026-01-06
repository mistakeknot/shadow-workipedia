import type { GraphData, IssueCategory, PrimitiveName } from '../types';
import type { GraphSimulation, SimNode } from '../graph';

type TableDeps = {
  graph: GraphSimulation;
  data: GraphData;
  getShowIssues: () => boolean;
  getShowSystems: () => boolean;
  activeCategories: Set<string>;
  getSelectedPrimitive: () => PrimitiveName | null;
  getSearchTerm: () => string;
  searchResults: Set<string>;
  getTableSortColumn: () => string | null;
  setTableSortColumn: (value: string | null) => void;
  getTableSortDirection: () => 'asc' | 'desc';
  setTableSortDirection: (value: 'asc' | 'desc') => void;
  getCategoryColor: (category: IssueCategory) => string;
  tableContainer: HTMLDivElement;
  setSelectedNode: (node: SimNode | null) => void;
  panelContent: HTMLDivElement;
  detailPanel: HTMLDivElement;
  tooltip: HTMLDivElement;
  renderDetailPanel: (node: SimNode, data: GraphData) => string;
  attachDetailPanelHandlers: () => void;
};

export function createTableRenderer({
  graph,
  data,
  getShowIssues,
  getShowSystems,
  activeCategories,
  getSelectedPrimitive,
  getSearchTerm,
  searchResults,
  getTableSortColumn,
  setTableSortColumn,
  getTableSortDirection,
  setTableSortDirection,
  getCategoryColor,
  tableContainer,
  setSelectedNode,
  panelContent,
  detailPanel,
  tooltip,
  renderDetailPanel,
  attachDetailPanelHandlers,
}: TableDeps) {
  return function renderTable() {
    const nodes = graph.getNodes().filter((node) => {
      if (node.type === 'issue' && !getShowIssues()) return false;
      if (node.type === 'system' && !getShowSystems()) return false;

      const anyCategoryActive =
        !node.categories?.length || node.categories.some((cat) => activeCategories.has(cat));
      if (!anyCategoryActive) return false;

      const selectedPrimitive = getSelectedPrimitive();
      if (selectedPrimitive) {
        if (!node.primitives?.includes(selectedPrimitive)) return false;
      }

      if (getSearchTerm() !== '') {
        return searchResults.has(node.id);
      }

      return true;
    });

    let sortedNodes = [...nodes];
    const tableSortColumn = getTableSortColumn();
    const tableSortDirection = getTableSortDirection();
    if (tableSortColumn) {
      sortedNodes.sort((a, b) => {
        let aVal: string | number | undefined;
        let bVal: string | number | undefined;

        switch (tableSortColumn) {
          case 'name':
            aVal = a.label;
            bVal = b.label;
            break;
          case 'categories':
            aVal = a.categories?.join(', ') || '';
            bVal = b.categories?.join(', ') || '';
            break;
          case 'urgency': {
            const urgencyOrder = { Critical: 4, High: 3, Medium: 2, Low: 1, Latent: 0 };
            aVal = a.type === 'system' ? -1 : urgencyOrder[a.urgency || 'Latent'];
            bVal = b.type === 'system' ? -1 : urgencyOrder[b.urgency || 'Latent'];
            break;
          }
          case 'connections':
            aVal = data.edges.filter((e) => e.source === a.id || e.target === a.id).length;
            bVal = data.edges.filter((e) => e.source === b.id || e.target === b.id).length;
            break;
        }

        if (aVal === undefined || bVal === undefined) return 0;

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return tableSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return tableSortDirection === 'asc'
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      });
    }

    const html = `
      <table>
        <thead>
          <tr>
            <th data-column="name">Issue ${
              tableSortColumn === 'name' ? (tableSortDirection === 'asc' ? '▲' : '▼') : ''
            }</th>
            <th data-column="categories">Categories ${
              tableSortColumn === 'categories' ? (tableSortDirection === 'asc' ? '▲' : '▼') : ''
            }</th>
            <th data-column="urgency">Urgency ${
              tableSortColumn === 'urgency' ? (tableSortDirection === 'asc' ? '▲' : '▼') : ''
            }</th>
            <th data-column="connections">Connections ${
              tableSortColumn === 'connections' ? (tableSortDirection === 'asc' ? '▲' : '▼') : ''
            }</th>
          </tr>
        </thead>
        <tbody>
          ${sortedNodes
            .map((node) => {
              const connectionCount = data.edges.filter((e) => e.source === node.id || e.target === node.id)
                .length;
              return `
              <tr data-node-id="${node.id}">
                <td>${node.label}</td>
                <td>
                  <div class="table-categories">
                    ${
                      node.categories
                        ?.map((cat) => {
                          const color = getCategoryColor(cat);
                          return `<span class="table-category-badge" style="background: ${color}; color: #0f172a;">${cat}</span>`;
                        })
                        .join('') || ''
                    }
                  </div>
                </td>
                <td>
                  ${
                    node.type === 'system'
                      ? '<span class="badge system-badge">N/A</span>'
                      : `<span class="badge urgency-${node.urgency || 'latent'}">${node.urgency || 'latent'}</span>`
                  }
                </td>
                <td>${connectionCount}</td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    `;

    tableContainer.innerHTML = html;

    tableContainer.querySelectorAll('th[data-column]').forEach((th) => {
      th.addEventListener('click', () => {
        const column = th.getAttribute('data-column');
        if (column === getTableSortColumn()) {
          setTableSortDirection(getTableSortDirection() === 'asc' ? 'desc' : 'asc');
        } else {
          setTableSortColumn(column);
          setTableSortDirection('asc');
        }
        renderTable();
      });
    });

    tableContainer.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', () => {
        const nodeId = tr.getAttribute('data-node-id');
        const node = graph.getNodes().find((n) => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
          panelContent.innerHTML = renderDetailPanel(node, data);
          panelContent.scrollTop = 0;
          detailPanel.classList.remove('hidden');
          tooltip.classList.add('hidden');
          attachDetailPanelHandlers();
        }
      });
    });
  };
}
