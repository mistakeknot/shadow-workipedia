#!/usr/bin/env node
import type { GraphData } from '../src/types';
import { applyDataLoadWarning, createIssueIdResolver, loadGraphData } from '../src/main/dataLoad';

type FakeResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<GraphData>;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const fetchFail: Fetcher = async () => {
  const response: FakeResponse = {
    ok: false,
    status: 500,
    statusText: 'Server Error',
    json: async () => ({
      nodes: [],
      edges: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        issueCount: 0,
        systemCount: 0,
        edgeCount: 0,
      },
    }),
  };
  return response as unknown as Response;
};

const data: GraphData = {
  nodes: [],
  edges: [],
  metadata: {
    generatedAt: new Date().toISOString(),
    issueCount: 0,
    systemCount: 0,
    edgeCount: 0,
  },
  issueIdRedirects: {
    a: 'b',
    b: 'c',
    c: 'c',
    x: 'y',
    y: 'x',
  },
};

class FakeClassList {
  private classes = new Set<string>();

  add(value: string) {
    this.classes.add(value);
  }

  remove(value: string) {
    this.classes.delete(value);
  }

  contains(value: string) {
    return this.classes.has(value);
  }
}

const banner = {
  classList: new FakeClassList(),
  innerHTML: '',
  textContent: '',
};

(async () => {
  const result = await loadGraphData(fetchFail);
  if (!result.dataLoadError || result.data.metadata.issueCount !== 0) {
    throw new Error('loadGraphData did not return fallback data on error.');
  }

  const resolveIssueId = createIssueIdResolver(data);
  if (resolveIssueId('a') !== 'c') {
    throw new Error('resolveIssueId did not follow redirects.');
  }
  if (resolveIssueId('x') !== 'x') {
    throw new Error('resolveIssueId did not handle cycles.');
  }

  applyDataLoadWarning({
    warningBanner: banner as unknown as HTMLElement,
    dataLoadError: 'Missing data',
    data,
    protocol: 'file:',
  });

  if (banner.classList.contains('hidden')) {
    throw new Error('applyDataLoadWarning should show banner when data is missing.');
  }
  if (!banner.innerHTML.includes('/data.json')) {
    throw new Error('applyDataLoadWarning should mention data.json.');
  }

  console.log('main data load test passed.');
})();
