#!/usr/bin/env node
import { createViewController } from '../src/main/views';

const makeStubElement = () =>
  ({
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {},
    style: {},
  }) as unknown as HTMLElement;

const controller = createViewController({
  graphView: makeStubElement(),
  tableView: makeStubElement(),
  wikiView: makeStubElement(),
  agentsView: makeStubElement(),
  articleView: makeStubElement(),
  header: makeStubElement(),
  tabNav: makeStubElement(),
  filterBar: makeStubElement(),
  viewModeToggles: makeStubElement(),
  categoryFilters: makeStubElement(),
  clusterToggle: makeStubElement(),
  tabGraph: makeStubElement(),
  tabTable: makeStubElement(),
  tabWiki: makeStubElement(),
  tabAgents: makeStubElement(),
  renderWikiList() {},
});

if (!controller || typeof controller.showView !== 'function') {
  throw new Error('Expected createViewController to return showView.');
}

console.log('main views test passed.');
