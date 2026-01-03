import type { KnowledgeItem } from './types';
import { formatFixed01k } from './utils';

export function formatKnowledgeItemLine(item: KnowledgeItem): string {
  const accuracy = item.accuracy ?? 'unknown';
  const confidence = formatFixed01k(item.confidence01k);
  const decay = formatFixed01k(item.decayRate01k);
  const lastUsed = `${item.lastUsedDays}d`;
  return `${item.item} · ${accuracy} · c${confidence} · d${decay} · last ${lastUsed}`;
}
