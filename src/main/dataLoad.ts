import type { GraphData } from '../types';

type DataLoadResult = {
  data: GraphData;
  dataLoadError: string | null;
};

type WarningOptions = {
  warningBanner: HTMLElement | null;
  dataLoadError: string | null;
  data: GraphData;
  protocol?: string;
};

export async function loadGraphData(fetcher: typeof fetch = fetch): Promise<DataLoadResult> {
  let data: GraphData;
  let dataLoadError: string | null = null;

  try {
    const response = await fetcher('/data.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    data = (await response.json()) as GraphData;
  } catch (err) {
    dataLoadError = (err instanceof Error ? err.message : String(err)) || 'Unknown error';
    console.warn(`[Shadow Workipedia] Failed to load /data.json: ${dataLoadError}`);
    const now = new Date().toISOString();
    data = {
      nodes: [],
      edges: [],
      metadata: {
        generatedAt: now,
        issueCount: 0,
        systemCount: 0,
        edgeCount: 0,
      },
    };
  }

  return { data, dataLoadError };
}

export function createIssueIdResolver(data: GraphData) {
  return (id: string) => {
    const redirects = data.issueIdRedirects;
    if (!redirects) return id;

    let current = id;
    const visited = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const next = redirects[current];
      if (!next || next === current) return current;
      if (visited.has(current)) return current;
      visited.add(current);
      current = next;
    }
    return current;
  };
}

export function applyDataLoadWarning({
  warningBanner,
  dataLoadError,
  data,
  protocol,
}: WarningOptions) {
  if (!warningBanner) return;

  if (dataLoadError) {
    warningBanner.classList.remove('hidden');
    const resolvedProtocol =
      protocol ?? (typeof window !== 'undefined' ? window.location.protocol : 'http:');
    const extra =
      resolvedProtocol === 'file:'
        ? ' You appear to be opening the site via <code>file://</code>; use <code>pnpm dev</code> or <code>pnpm preview</code> instead.'
        : '';
    warningBanner.innerHTML = `No <code>/data.json</code> found. Run <code>pnpm -C shadow-workipedia extract-data</code> (or <code>pnpm -C shadow-workipedia build:full</code>) then reload.${extra}`;
  } else if (data.nodes.length === 0) {
    warningBanner.classList.remove('hidden');
    warningBanner.innerHTML = 'Loaded <code>/data.json</code> but it contains 0 nodes. Re-run <code>pnpm -C shadow-workipedia extract-data</code> and reload.';
  } else {
    warningBanner.classList.add('hidden');
    warningBanner.textContent = '';
  }
}
