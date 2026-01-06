import type { ViewType } from '../article';

type ViewControllerDeps = {
  graphView: HTMLElement;
  tableView: HTMLElement;
  wikiView: HTMLElement;
  agentsView: HTMLElement;
  articleView: HTMLElement;
  header: HTMLElement | null;
  tabNav: HTMLElement | null;
  filterBar: HTMLElement | null;
  viewModeToggles: HTMLElement | null;
  categoryFilters: HTMLElement | null;
  clusterToggle: HTMLElement | null;
  tabGraph: HTMLElement | null;
  tabTable: HTMLElement | null;
  tabWiki: HTMLElement | null;
  tabAgents: HTMLElement | null;
  renderWikiList: () => void;
  onViewChange?: (view: ViewType) => void;
};

export function createViewController({
  graphView,
  tableView,
  wikiView,
  agentsView,
  articleView,
  header,
  tabNav,
  filterBar,
  viewModeToggles,
  categoryFilters,
  clusterToggle,
  tabGraph,
  tabTable,
  tabWiki,
  tabAgents,
  renderWikiList,
  onViewChange,
}: ViewControllerDeps) {
  function showView(view: ViewType) {
    onViewChange?.(view);

    const tooltipEl = document.getElementById('tooltip');
    if (tooltipEl) tooltipEl.classList.add('hidden');

    tabGraph?.classList.remove('active');
    tabTable?.classList.remove('active');
    tabWiki?.classList.remove('active');
    tabAgents?.classList.remove('active');

    articleView?.classList.add('hidden');
    if (header) header.classList.remove('hidden');
    if (tabNav) tabNav.classList.remove('hidden');
    if (filterBar) filterBar.classList.remove('hidden');

    if (viewModeToggles) viewModeToggles.style.display = '';
    if (categoryFilters) categoryFilters.style.display = '';
    if (clusterToggle) clusterToggle.style.display = '';

    if (view === 'graph') {
      tabGraph?.classList.add('active');
      graphView?.classList.remove('hidden');
      tableView?.classList.add('hidden');
      wikiView?.classList.add('hidden');
      agentsView?.classList.add('hidden');
      if (filterBar) filterBar.classList.remove('hidden');
      window.dispatchEvent(new Event('resize'));
    } else if (view === 'table') {
      tabTable?.classList.add('active');
      graphView?.classList.add('hidden');
      tableView?.classList.remove('hidden');
      wikiView?.classList.add('hidden');
      agentsView?.classList.add('hidden');
      if (filterBar) filterBar.classList.remove('hidden');
      if (viewModeToggles) viewModeToggles.style.display = '';
      if (categoryFilters) categoryFilters.style.display = '';
      if (clusterToggle) clusterToggle.style.display = 'none';
    } else if (view === 'wiki' || view === 'communities') {
      tabWiki?.classList.add('active');
      graphView?.classList.add('hidden');
      tableView?.classList.add('hidden');
      wikiView?.classList.remove('hidden');
      agentsView?.classList.add('hidden');
      if (filterBar) filterBar.classList.add('hidden');
      if (viewModeToggles) viewModeToggles.style.display = 'none';
      if (categoryFilters) categoryFilters.style.display = 'none';
      if (clusterToggle) clusterToggle.style.display = 'none';
      renderWikiList();
    } else if (view === 'agents') {
      tabAgents?.classList.add('active');
      graphView?.classList.add('hidden');
      tableView?.classList.add('hidden');
      wikiView?.classList.add('hidden');
      agentsView?.classList.remove('hidden');
      if (filterBar) filterBar.classList.add('hidden');
      if (viewModeToggles) viewModeToggles.style.display = 'none';
      if (categoryFilters) categoryFilters.style.display = 'none';
      if (clusterToggle) clusterToggle.style.display = 'none';
    }
  }

  return { showView };
}
