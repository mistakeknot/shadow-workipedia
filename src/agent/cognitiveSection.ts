export function renderCognitiveCard(title: string, depth: number | undefined, bodyHtml: string): string {
  const depthLabel = typeof depth === 'number' ? ` (${Math.round(depth / 10)}%)` : '';
  return `
    <section class="agent-card agent-card-span6 agent-card-compact">
      <h3>${title}${depthLabel}</h3>
      ${bodyHtml || '<div class="agent-inline-muted">—</div>'}
    </section>
  `;
}

export function renderCognitiveSection(cardsHtml: string, showDetails: boolean): string {
  const detailsLabel = showDetails ? 'Hide details' : 'Show details';
  return `
    <section class="agent-card agent-card-span12 ${showDetails ? 'cognitive-details-on' : ''}">
      <div class="agent-card-header">
        <h3>Cognitive</h3>
        <button type="button" class="pill pill-muted agent-card-toggle ${showDetails ? 'active' : ''}" data-cognitive-details-toggle="1">${detailsLabel}</button>
      </div>
      <div class="agent-grid agent-grid-tight">
        ${cardsHtml || '<div class="agent-inline-muted">—</div>'}
      </div>
    </section>
  `;
}
