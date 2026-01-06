#!/usr/bin/env node
import { createGraphViewHelpers } from '../src/main/graphView';

const helpers = createGraphViewHelpers({
  graph: { getNodes() { return []; } },
  canvas: { width: 100, height: 100 } as HTMLCanvasElement,
  getShowIssues: () => true,
  getShowSystems: () => true,
  getShowPrinciples: () => true,
  activeCategories: new Set<string>(),
  setCurrentTransform() {},
  onTransformApplied() {},
});

if (typeof helpers.getVisibleNodes !== 'function' || typeof helpers.fitToView !== 'function') {
  throw new Error('Expected graph view helpers.');
}

console.log('main graph view test passed.');
