#!/usr/bin/env node
import {
  getCategoryColor,
  getCommunityColor,
  getPrimitiveColor,
  getPrimitiveLabel,
  renderCommunityHulls,
  renderCommunityLabels,
  drawArrow,
  drawDiamond,
} from '../src/main/graphUtils';

const ctx = {
  beginPath() {},
  moveTo() {},
  lineTo() {},
  closePath() {},
  fill() {},
  stroke() {},
  arc() {},
  fillText() {},
  save() {},
  restore() {},
  setLineDash() {},
  translate() {},
  scale() {},
  clearRect() {},
  font: '',
  textAlign: '',
  textBaseline: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
} as unknown as CanvasRenderingContext2D;

const color = getCategoryColor('Economic');
if (!color) {
  throw new Error('Expected category color for Economic.');
}

if (!getCommunityColor(1)) {
  throw new Error('Expected community color fallback.');
}

if (!getPrimitiveColor('TrustErosion')) {
  throw new Error('Expected primitive color.');
}

if (!getPrimitiveLabel('TrustErosion')) {
  throw new Error('Expected primitive label.');
}

renderCommunityHulls(ctx, [], {}, { x: 0, y: 0, k: 1 });
renderCommunityLabels(ctx, [], {}, { x: 0, y: 0, k: 1 });
drawArrow(ctx, 0, 0, 10, 10, 2, 4);
drawDiamond(ctx, 0, 0, 5);

console.log('main graph utils test passed.');
