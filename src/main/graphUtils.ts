import type { CommunityInfo, IssueCategory, PrimitiveName } from '../types';
import type { SimNode } from '../graph';
import { polygonCentroid, polygonHull } from 'd3-polygon';

// Category color mapping (must match extract-data.ts)
const CATEGORY_COLORS: Record<IssueCategory, string> = {
  Existential: '#dc2626',
  Economic: '#3b82f6',
  Social: '#8b5cf6',
  Political: '#ef4444',
  Environmental: '#10b981',
  Security: '#f59e0b',
  Technological: '#06b6d4',
  Cultural: '#ec4899',
  Infrastructure: '#6366f1',
};

// Community color palette (23 distinct colors for 23 communities)
const COMMUNITY_COLORS: Record<number, string> = {
  0: '#3b82f6',
  1: '#10b981',
  2: '#ef4444',
  3: '#8b5cf6',
  4: '#f59e0b',
  5: '#06b6d4',
  6: '#ec4899',
  7: '#6366f1',
  8: '#14b8a6',
  9: '#f97316',
  10: '#a855f7',
  11: '#22c55e',
  12: '#eab308',
  13: '#e11d48',
  14: '#0ea5e9',
  15: '#84cc16',
  16: '#f43f5e',
  17: '#06b6d4',
  18: '#d946ef',
  19: '#64748b',
  20: '#0891b2',
  21: '#dc2626',
  22: '#7c3aed',
};

// Primitive colors for hull overlays (matching simulation primitives)
const PRIMITIVE_COLORS: Record<string, { color: string; label: string }> = {
  TrustErosion: { color: '#ef4444', label: 'Trust Erosion' },
  DeathSpiral: { color: '#dc2626', label: 'Death Spiral' },
  ThresholdCascade: { color: '#f97316', label: 'Threshold Cascade' },
  CapacityStress: { color: '#eab308', label: 'Capacity Stress' },
  ContagionPropagation: { color: '#84cc16', label: 'Contagion' },
  LegitimacyDynamics: { color: '#22c55e', label: 'Legitimacy' },
  FeedbackLoop: { color: '#14b8a6', label: 'Feedback Loop' },
  PolicyContagion: { color: '#06b6d4', label: 'Policy Contagion' },
  ResourceDepletion: { color: '#0ea5e9', label: 'Resource Depletion' },
  ExodusMigration: { color: '#3b82f6', label: 'Exodus Migration' },
  CaptureConcentration: { color: '#6366f1', label: 'Capture' },
  ResistanceBacklash: { color: '#8b5cf6', label: 'Resistance' },
  QueueBacklog: { color: '#a855f7', label: 'Queue Backlog' },
  AdaptiveResistance: { color: '#d946ef', label: 'Adaptive Resistance' },
};

export function getCategoryColor(category: IssueCategory): string {
  return CATEGORY_COLORS[category];
}

export function getCategoryKeys(): IssueCategory[] {
  return Object.keys(CATEGORY_COLORS) as IssueCategory[];
}

export function getCommunityColor(communityId: number): string {
  return COMMUNITY_COLORS[communityId] || '#64748b';
}

export function getPrimitiveColor(primitive: PrimitiveName): string {
  return PRIMITIVE_COLORS[primitive]?.color || '#64748b';
}

export function getPrimitiveLabel(primitive: PrimitiveName): string {
  return PRIMITIVE_COLORS[primitive]?.label || primitive;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function renderCommunityHulls(
  ctx: CanvasRenderingContext2D,
  nodes: SimNode[],
  communities: Record<number, CommunityInfo> | undefined,
  transform: { x: number; y: number; k: number }
) {
  if (!communities) return;

  const communityNodes = new Map<number, Array<[number, number]>>();
  for (const node of nodes) {
    if (node.communityId !== undefined && node.x !== undefined && node.y !== undefined) {
      if (!communityNodes.has(node.communityId)) {
        communityNodes.set(node.communityId, []);
      }
      communityNodes.get(node.communityId)!.push([node.x, node.y]);
    }
  }

  for (const [communityId, points] of communityNodes) {
    if (points.length < 3) continue;

    const hull = polygonHull(points);
    if (!hull) continue;

    const centroid = polygonCentroid(hull);
    const expandedHull = hull.map(([x, y]: [number, number]) => {
      const dx = x - centroid[0];
      const dy = y - centroid[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      const padding = 30;
      return [x + (dx / len) * padding, y + (dy / len) * padding] as [number, number];
    });

    ctx.beginPath();
    const [first, ...rest] = expandedHull;
    ctx.moveTo(first[0] * transform.k + transform.x, first[1] * transform.k + transform.y);
    for (const [x, y] of rest) {
      ctx.lineTo(x * transform.k + transform.x, y * transform.k + transform.y);
    }
    ctx.closePath();

    const color = getCommunityColor(communityId);
    ctx.fillStyle = hexToRgba(color, 0.08);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(color, 0.3);
    ctx.lineWidth = 2 / transform.k;
    ctx.stroke();
  }
}

export function renderCommunityLabels(
  ctx: CanvasRenderingContext2D,
  nodes: SimNode[],
  communities: Record<number, CommunityInfo> | undefined,
  transform: { x: number; y: number; k: number }
) {
  if (!communities) return;

  const centroids = new Map<number, { x: number; y: number; count: number }>();
  for (const node of nodes) {
    if (node.communityId !== undefined && node.x !== undefined && node.y !== undefined) {
      if (!centroids.has(node.communityId)) {
        centroids.set(node.communityId, { x: 0, y: 0, count: 0 });
      }
      const c = centroids.get(node.communityId)!;
      c.x += node.x;
      c.y += node.y;
      c.count++;
    }
  }

  for (const [communityId, { x, y, count }] of centroids) {
    const community = communities[communityId];
    if (!community) continue;

    const cx = (x / count) * transform.k + transform.x;
    const cy = (y / count) * transform.k + transform.y;

    const fontSize = Math.max(10, Math.min(16, 14 / transform.k));
    ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const label = community.topCategory;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(label, cx + 1, cy + 1);
    ctx.fillStyle = getCommunityColor(communityId);
    ctx.fillText(label, cx, cy);
  }
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  nodeRadius: number,
  arrowSize: number
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const tipX = toX - nodeRadius * Math.cos(angle);
  const tipY = toY - nodeRadius * Math.sin(angle);

  const wingAngle = Math.PI / 6;
  const leftX = tipX - arrowSize * Math.cos(angle - wingAngle);
  const leftY = tipY - arrowSize * Math.sin(angle - wingAngle);
  const rightX = tipX - arrowSize * Math.cos(angle + wingAngle);
  const rightY = tipY - arrowSize * Math.sin(angle + wingAngle);

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(leftX, leftY);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fill();
}

export function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
}
