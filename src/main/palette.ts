import type { ArticleRouter, ViewType } from '../article';
import type { GraphSimulation, SimNode } from '../graph';
import type { ClickHandler, DragHandler, HoverHandler, ZoomPanHandler } from '../interactions';
import type { CommunityInfo, GraphData } from '../types';

type PaletteKind = 'command' | 'node' | 'case-study' | 'community' | 'mechanic';

type PaletteItem = {
  kind: PaletteKind;
  id: string;
  title: string;
  subtitle?: string;
  rightHint?: string;
  group: string;
  searchText: string;
  run: () => void;
};

type ViewToggleButtons = {
  showIssuesBtn: HTMLButtonElement | null;
  showSystemsBtn: HTMLButtonElement | null;
  showPrinciplesBtn: HTMLButtonElement | null;
  showPrimitivesBtn: HTMLButtonElement | null;
  showDataFlowsBtn: HTMLButtonElement | null;
};

type CommandPaletteDeps = {
  doc?: Document;
  router: ArticleRouter;
  graph: GraphSimulation;
  data: GraphData;
  canvas: HTMLCanvasElement;
  hoverHandler: HoverHandler;
  clickHandler: ClickHandler;
  dragHandler: DragHandler;
  zoomHandler: ZoomPanHandler;
  getCurrentTransform: () => { x: number; y: number; k: number };
  getCurrentView: () => ViewType;
  getShowIssues: () => boolean;
  getShowSystems: () => boolean;
  getShowPrinciples: () => boolean;
  setSelectedNode: (node: SimNode | null) => void;
  panelContent: HTMLDivElement;
  detailPanel: HTMLDivElement;
  tooltip: HTMLDivElement;
  renderDetailPanel: (node: SimNode, data: GraphData) => string;
  attachDetailPanelHandlers: () => void;
  render: () => void;
  resetBtn: HTMLButtonElement | null;
};

export function initializeCommandPalette({
  doc,
  router,
  graph,
  data,
  canvas,
  hoverHandler,
  clickHandler,
  dragHandler,
  zoomHandler,
  getCurrentTransform,
  getCurrentView,
  getShowIssues,
  getShowSystems,
  getShowPrinciples,
  setSelectedNode,
  panelContent,
  detailPanel,
  tooltip,
  renderDetailPanel,
  attachDetailPanelHandlers,
  render,
  resetBtn,
}: CommandPaletteDeps) {
  const rootDoc = doc ?? document;
  const paletteOverlay = rootDoc.getElementById('command-palette-overlay') as HTMLDivElement | null;
  const paletteInput = rootDoc.getElementById('command-palette-input') as HTMLInputElement | null;
  const paletteResults = rootDoc.getElementById('command-palette-results') as HTMLDivElement | null;

  const viewToggleButtons: ViewToggleButtons = {
    showIssuesBtn: rootDoc.getElementById('show-issues-btn') as HTMLButtonElement | null,
    showSystemsBtn: rootDoc.getElementById('show-systems-btn') as HTMLButtonElement | null,
    showPrinciplesBtn: rootDoc.getElementById('show-principles-btn') as HTMLButtonElement | null,
    showPrimitivesBtn: rootDoc.getElementById('show-primitives-btn') as HTMLButtonElement | null,
    showDataFlowsBtn: rootDoc.getElementById('show-dataflows-btn') as HTMLButtonElement | null,
  };

  function isEditableTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  // Header tab shortcuts: 1/2/3/4 => Graph/Table/Wiki/Agents (5 opens communities inside wiki)
  rootDoc.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditableTarget(rootDoc.activeElement)) return;
    if (paletteOverlay && !paletteOverlay.classList.contains('hidden')) return;

    if (e.key === '1') {
      e.preventDefault();
      router.navigateToView('graph');
    } else if (e.key === '2') {
      e.preventDefault();
      router.navigateToView('table');
    } else if (e.key === '3') {
      e.preventDefault();
      router.navigateToView('wiki');
    } else if (e.key === '4') {
      e.preventDefault();
      router.navigateToView('agents');
    } else if (e.key === '5') {
      e.preventDefault();
      router.navigateToView('communities');
    }
  });

  function normalizeQuery(raw: string): string[] {
    return raw
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function scoreMatch(tokens: string[], haystack: string): number | null {
    if (tokens.length === 0) return 0;

    let score = 0;
    let lastIndex = 0;

    for (const token of tokens) {
      let idx = haystack.indexOf(token, lastIndex);
      if (idx === -1) idx = haystack.indexOf(token);
      if (idx === -1) return null;

      score += idx;
      if (idx === 0) score -= 12;
      if (idx > 0 && haystack[idx - 1] === ' ') score -= 4;

      lastIndex = idx + token.length;
    }

    score += Math.min(40, Math.floor(haystack.length / 8));
    return score;
  }

  function animatePanToNode(node: SimNode) {
    if (node.x === undefined || node.y === undefined) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const currentTransform = getCurrentTransform();
    const newX = centerX - node.x * currentTransform.k;
    const newY = centerY - node.y * currentTransform.k;

    const startX = currentTransform.x;
    const startY = currentTransform.y;
    const duration = 450;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const transform = getCurrentTransform();
      transform.x = startX + (newX - startX) * eased;
      transform.y = startY + (newY - startY) * eased;

      hoverHandler.updateTransform(transform);
      clickHandler.updateTransform(transform);
      dragHandler.updateTransform(transform);
      render();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        zoomHandler.setTransform(transform);
      }
    };

    animate();
  }

  function ensureNodeTypeVisible(node: SimNode) {
    if (node.type === 'issue' && !getShowIssues()) viewToggleButtons.showIssuesBtn?.click();
    if (node.type === 'system' && !getShowSystems()) viewToggleButtons.showSystemsBtn?.click();
    if (node.type === 'principle' && !getShowPrinciples()) viewToggleButtons.showPrinciplesBtn?.click();
  }

  function focusNodeInGraph(nodeId: string) {
    const targetNode = graph.getNodes().find((n) => n.id === nodeId);
    if (!targetNode) return;

    ensureNodeTypeVisible(targetNode);

    setSelectedNode(targetNode);
    panelContent.innerHTML = renderDetailPanel(targetNode, data);
    panelContent.scrollTop = 0;
    detailPanel.classList.remove('hidden');
    tooltip.classList.add('hidden');
    attachDetailPanelHandlers();
    animatePanToNode(targetNode);
    render();
  }

  function getCaseStudyParentTitle(caseStudyId: string): string | undefined {
    const article = data.articles?.[caseStudyId];
    const parentId =
      typeof article?.frontmatter?.caseStudyOf === 'string'
        ? article.frontmatter.caseStudyOf.trim()
        : '';
    if (!parentId) return undefined;
    return data.articles?.[parentId]?.title ?? graph.getNodes().find((n) => n.id === parentId)?.label ?? parentId;
  }

  function buildPaletteItems(): PaletteItem[] {
    const items: PaletteItem[] = [];

    items.push(
      {
        kind: 'command',
        id: 'view:graph',
        title: 'View: Graph',
        subtitle: 'Switch to graph view',
        rightHint: 'Enter',
        group: 'Commands',
        searchText: 'view graph switch',
        run: () => router.navigateToView('graph'),
      },
      {
        kind: 'command',
        id: 'view:table',
        title: 'View: Table',
        subtitle: 'Switch to table view',
        rightHint: 'Enter',
        group: 'Commands',
        searchText: 'view table switch',
        run: () => router.navigateToView('table'),
      },
      {
        kind: 'command',
        id: 'view:wiki',
        title: 'View: Wiki',
        subtitle: 'Switch to wiki view',
        rightHint: 'Enter',
        group: 'Commands',
        searchText: 'view wiki switch',
        run: () => router.navigateToView('wiki'),
      },
      {
        kind: 'command',
        id: 'view:communities',
        title: 'View: Communities',
        subtitle: 'Switch to communities view',
        rightHint: 'Enter',
        group: 'Commands',
        searchText: 'view communities switch',
        run: () => router.navigateToView('communities'),
      },
      {
        kind: 'command',
        id: 'toggle:issues',
        title: 'Toggle: Issues',
        subtitle: 'Show/hide issue nodes',
        group: 'Commands',
        searchText: 'toggle issues show hide',
        run: () => viewToggleButtons.showIssuesBtn?.click(),
      },
      {
        kind: 'command',
        id: 'toggle:systems',
        title: 'Toggle: Systems',
        subtitle: 'Show/hide system nodes',
        group: 'Commands',
        searchText: 'toggle systems show hide',
        run: () => viewToggleButtons.showSystemsBtn?.click(),
      },
      {
        kind: 'command',
        id: 'toggle:principles',
        title: 'Toggle: Principles',
        subtitle: 'Show/hide principle nodes',
        group: 'Commands',
        searchText: 'toggle principles show hide',
        run: () => viewToggleButtons.showPrinciplesBtn?.click(),
      },
      {
        kind: 'command',
        id: 'toggle:primitives',
        title: 'Toggle: Primitives',
        subtitle: 'Show/hide primitives panel',
        group: 'Commands',
        searchText: 'toggle primitives panel show hide',
        run: () => viewToggleButtons.showPrimitivesBtn?.click(),
      },
      {
        kind: 'command',
        id: 'toggle:dataflows',
        title: 'Toggle: Data Flows',
        subtitle: 'Show/hide system data flows',
        group: 'Commands',
        searchText: 'toggle data flows show hide',
        run: () => viewToggleButtons.showDataFlowsBtn?.click(),
      },
      {
        kind: 'command',
        id: 'reset',
        title: 'Reset',
        subtitle: 'Reset filters, search, and selection',
        group: 'Commands',
        searchText: 'reset clear',
        run: () => resetBtn?.click(),
      }
    );

    for (const node of data.nodes) {
      const group =
        node.type === 'issue'
          ? 'Issues'
          : node.type === 'system'
            ? 'Systems'
            : node.type === 'principle'
              ? 'Principles'
              : null;

      if (!group) continue;

      const subtitle =
        node.type === 'issue'
          ? `${(node.categories ?? []).join(', ') || 'Issue'} • ${node.urgency ?? ''}`.trim()
          : node.type === 'system'
            ? `${node.domain ?? 'System'} • ${node.connectionCount ?? 0} connections`
            : node.type === 'principle'
              ? node.sourceSystem
                ? `From ${node.sourceSystem}`
                : 'Principle'
              : '';

      items.push({
        kind: 'node',
        id: node.id,
        title: node.label,
        subtitle,
        rightHint: node.type,
        group,
        searchText: `${node.label} ${node.id} ${subtitle}`.toLowerCase(),
        run: () => {
          if (getCurrentView() === 'graph') {
            focusNodeInGraph(node.id);
          } else {
            router.navigateToArticle(node.type, node.id);
          }
        },
      });
    }

    if (data.articles) {
      for (const article of Object.values(data.articles)) {
        if (article.type !== 'issue') continue;
        const caseStudyOf =
          typeof article.frontmatter?.caseStudyOf === 'string'
            ? article.frontmatter.caseStudyOf.trim()
            : '';
        if (!caseStudyOf) continue;

        const parentTitle = getCaseStudyParentTitle(article.id);
        const subtitle = parentTitle ? `Case Study of ${parentTitle}` : 'Case Study';
        items.push({
          kind: 'case-study',
          id: article.id,
          title: article.title,
          subtitle,
          rightHint: 'case study',
          group: 'Case Studies',
          searchText: `${article.title} ${article.id} ${subtitle}`.toLowerCase(),
          run: () => router.navigateToArticle('issue', article.id),
        });
      }
    }

    if (data.articles) {
      for (const article of Object.values(data.articles)) {
        if (article.type !== 'mechanic') continue;
        if (article.frontmatter?.hidden === true) continue;
        const mergedInto =
          typeof article.frontmatter?.mergedInto === 'string'
            ? article.frontmatter.mergedInto.trim()
            : '';
        if (mergedInto) continue;
        const subtitleParts: string[] = [];
        if (typeof article.frontmatter?.pattern === 'string') subtitleParts.push(article.frontmatter.pattern);
        if (typeof article.frontmatter?.mechanic === 'string') subtitleParts.push(article.frontmatter.mechanic);
        const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' • ') : 'Mechanic';

        items.push({
          kind: 'mechanic',
          id: article.id,
          title: article.title,
          subtitle,
          rightHint: 'mechanic',
          group: 'Mechanics',
          searchText: `${article.title} ${article.id} ${subtitle}`.toLowerCase(),
          run: () => router.navigateToArticle('mechanic', article.id),
        });
      }
    }

    if (data.communities) {
      for (const [idStr, info] of Object.entries(data.communities as Record<string, CommunityInfo>)) {
        const id = Number(idStr);
        const slug = `community-${id}`;
        const title = info.label || `Community ${id}`;
        const subtitle = `${info.size} nodes • ${info.topCategory}`;
        items.push({
          kind: 'community',
          id: slug,
          title,
          subtitle,
          rightHint: 'community',
          group: 'Communities',
          searchText: `${title} ${slug} ${subtitle}`.toLowerCase(),
          run: () => router.navigateToCommunity(slug),
        });
      }
    }

    return items;
  }

  const paletteItems = buildPaletteItems();
  let paletteOpen = false;
  let paletteActiveId: string | null = null;
  let paletteVisibleItems: PaletteItem[] = [];
  let paletteRenderScheduled = false;

  function openPalette() {
    if (!paletteOverlay || !paletteInput || !paletteResults) return;
    paletteOpen = true;
    paletteOverlay.classList.remove('hidden');
    paletteInput.value = '';
    paletteActiveId = null;
    schedulePaletteRender();
    requestAnimationFrame(() => paletteInput.focus());
  }

  function closePalette() {
    if (!paletteOverlay) return;
    paletteOpen = false;
    paletteOverlay.classList.add('hidden');
    paletteActiveId = null;
  }

  function schedulePaletteRender() {
    if (paletteRenderScheduled) return;
    paletteRenderScheduled = true;
    requestAnimationFrame(() => {
      paletteRenderScheduled = false;
      renderPalette();
    });
  }

  function setActiveByIndex(index: number) {
    const item = paletteVisibleItems[index];
    if (!item) return;
    paletteActiveId = item.id;
    if (!paletteResults) return;

    paletteResults.querySelectorAll('.palette-item').forEach((el) => el.classList.remove('active'));
    const activeEl = paletteResults.querySelector(
      `.palette-item[data-id="${CSS.escape(item.id)}"]`
    ) as HTMLElement | null;
    if (activeEl) {
      activeEl.classList.add('active');
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function runActive() {
    const item = paletteVisibleItems.find((i) => i.id === paletteActiveId) ?? paletteVisibleItems[0];
    if (!item) return;
    closePalette();
    item.run();
  }

  function renderPalette() {
    if (!paletteResults || !paletteInput) return;

    const tokens = normalizeQuery(paletteInput.value);
    const scored: Array<{ item: PaletteItem; score: number }> = [];

    for (const item of paletteItems) {
      const score = scoreMatch(tokens, item.searchText);
      if (score === null) continue;

      if (tokens.length === 0 && item.kind !== 'command') continue;

      scored.push({ item, score });
    }

    scored.sort((a, b) => a.score - b.score || a.item.title.localeCompare(b.item.title));

    const maxResults = tokens.length === 0 ? 12 : 40;
    const results = scored.slice(0, maxResults).map((s) => s.item);
    paletteVisibleItems = results;

    if (results.length === 0) {
      paletteResults.innerHTML = `<div class="palette-empty">No matches.</div>`;
      paletteActiveId = null;
      return;
    }

    const groups = new Map<string, PaletteItem[]>();
    for (const item of results) {
      const group = item.group;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(item);
    }

    const groupOrder = [
      'Commands',
      'Issues',
      'Systems',
      'Principles',
      'Case Studies',
      'Mechanics',
      'Communities',
    ];

    paletteResults.innerHTML = groupOrder
      .filter((g) => groups.has(g))
      .map((group) => {
        const items = groups.get(group)!;
        const rows = items
          .map(
            (i) => `
          <div class="palette-item" role="option" data-id="${i.id}">
            <div class="palette-item-left">
              <div class="palette-item-title">${escapeHtml(i.title)}</div>
              ${i.subtitle ? `<div class="palette-item-subtitle">${escapeHtml(i.subtitle)}</div>` : ''}
            </div>
            ${i.rightHint ? `<div class="palette-item-right">${escapeHtml(i.rightHint)}</div>` : ''}
          </div>
        `
          )
          .join('');
        return `<div class="palette-group">${escapeHtml(group)}</div>${rows}`;
      })
      .join('');

    paletteResults.querySelectorAll('.palette-item').forEach((el) => {
      const row = el as HTMLElement;
      const id = row.getAttribute('data-id');
      if (!id) return;

      row.addEventListener('mouseenter', () => {
        paletteActiveId = id;
        paletteResults.querySelectorAll('.palette-item').forEach((n) => n.classList.remove('active'));
        row.classList.add('active');
      });

      row.addEventListener('click', () => {
        paletteActiveId = id;
        runActive();
      });
    });

    if (!paletteActiveId || !results.some((r) => r.id === paletteActiveId)) {
      paletteActiveId = results[0].id;
    }
    setActiveByIndex(results.findIndex((r) => r.id === paletteActiveId));
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (paletteOverlay && paletteInput && paletteResults) {
    paletteOverlay.addEventListener('click', (e) => {
      if (e.target === paletteOverlay) closePalette();
    });

    paletteInput.addEventListener('input', () => schedulePaletteRender());

    paletteInput.addEventListener('keydown', (e) => {
      if (!paletteOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        runActive();
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (paletteVisibleItems.length === 0) return;

        const currentIndex = Math.max(
          0,
          paletteVisibleItems.findIndex((i) => i.id === paletteActiveId)
        );
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = (currentIndex + delta + paletteVisibleItems.length) % paletteVisibleItems.length;
        setActiveByIndex(nextIndex);
      }
    });

    rootDoc.addEventListener('keydown', (e) => {
      const isK = e.key.toLowerCase() === 'k';
      const wantsPalette = isK && (e.metaKey || e.ctrlKey);
      if (!wantsPalette) return;

      e.preventDefault();
      if (paletteOpen) {
        closePalette();
      } else {
        openPalette();
      }
    });
  }

  return { openPalette, closePalette };
}
