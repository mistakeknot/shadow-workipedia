import type { KnowledgeItem } from './types';
import { formatKnowledgeItemMeta } from './knowledgeFormat';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderKnowledgeEntry(entry: KnowledgeItem, align: 'left' | 'right' = 'right'): string {
  const alignClass = align === 'left' ? 'knowledge-entry-left' : 'knowledge-entry-right';
  return `
    <div class="knowledge-entry ${alignClass}">
      <span class="pill pill-muted">${escapeHtml(entry.item)}</span>
      <div class="knowledge-entry-meta">${formatKnowledgeItemMeta(entry)}</div>
    </div>
  `;
}

export function renderKnowledgeEntryList(
  entries: KnowledgeItem[] | undefined,
  fallback: string[],
  align: 'left' | 'right' = 'right',
): string {
  const listAlignClass = align === 'left' ? 'knowledge-entry-list-left' : 'knowledge-entry-list-right';
  const entryAlignClass = align === 'left' ? 'knowledge-entry-left' : 'knowledge-entry-right';
  if (entries && entries.length) {
    return `<div class="knowledge-entry-list ${listAlignClass}">${entries.map(entry => renderKnowledgeEntry(entry, align)).join('')}</div>`;
  }
  if (fallback.length) {
    return `<div class="knowledge-entry-list ${listAlignClass}">${fallback.map(item => `
      <div class="knowledge-entry ${entryAlignClass}">
        <span class="pill pill-muted">${escapeHtml(item)}</span>
      </div>
    `).join('')}</div>`;
  }
  return `<span class="agent-inline-muted">—</span>`;
}
