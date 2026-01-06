export type MainDom = {
  loading: HTMLElement | null;
  warningBanner: HTMLElement | null;
  graphView: HTMLElement;
  tableView: HTMLElement;
  wikiView: HTMLElement;
  agentsView: HTMLElement;
  agentsContainer: HTMLElement;
  wikiSidebarContent: HTMLElement;
  wikiArticleContent: HTMLElement;
  articleView: HTMLElement;
  header: HTMLElement | null;
  tabNav: HTMLElement | null;
  filterBar: HTMLElement | null;
  tooltip: HTMLDivElement;
  detailPanel: HTMLDivElement;
  panelContent: HTMLDivElement;
  closeBtn: HTMLButtonElement;
};

export function initializeMainDom(doc: Document = document): MainDom {
  const loading = doc.getElementById('loading');
  const warningBanner = doc.getElementById('data-warning-banner');

  const graphView = doc.getElementById('graph-view');
  const tableView = doc.getElementById('table-view');
  const wikiView = doc.getElementById('wiki-view');
  const agentsView = doc.getElementById('agents-view');
  const agentsContainer = doc.getElementById('agents-container');
  const wikiSidebarContent = doc.getElementById('wiki-sidebar-content');
  const wikiArticleContent = doc.getElementById('wiki-article-content');
  const articleView = doc.getElementById('article-view');
  const articleContainer = doc.getElementById('article-container');
  const header = doc.getElementById('header');
  const tabNav = doc.getElementById('tab-nav');
  const filterBar = doc.getElementById('filter-bar');

  if (
    !graphView ||
    !tableView ||
    !wikiView ||
    !agentsView ||
    !agentsContainer ||
    !wikiSidebarContent ||
    !wikiArticleContent ||
    !articleView ||
    !articleContainer
  ) {
    throw new Error('Required view elements not found');
  }

  const tooltip = doc.getElementById('tooltip') as HTMLDivElement;
  const detailPanel = doc.getElementById('detail-panel') as HTMLDivElement;
  const panelContent = doc.getElementById('panel-content') as HTMLDivElement;
  const closeBtn = doc.getElementById('close-panel') as HTMLButtonElement;

  return {
    loading,
    warningBanner,
    graphView,
    tableView,
    wikiView,
    agentsView,
    agentsContainer,
    wikiSidebarContent,
    wikiArticleContent,
    articleView,
    header,
    tabNav,
    filterBar,
    tooltip,
    detailPanel,
    panelContent,
    closeBtn,
  };
}
