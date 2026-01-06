import { formatBand5, formatFixed01k, type AgentVocabV1, type Band5, type GeneratedAgent, type KnowledgeItem } from '../agent';
import { renderCognitiveCard, renderCognitiveSection } from '../agent/cognitiveSection';
import { AGENT_TAB_LABELS, type AgentProfileTab } from '../agent/profileTabs';
import { renderKnowledgeEntryList } from '../agent/knowledgeEntry';
import { formatCopingMeta, formatEmotionMeta, formatThoughtMeta, renderPsychologyEntryList } from '../agent/psychologyEntry';
import { renderPsychologyCard, renderPsychologySection } from '../agent/psychologySection';
import { generateNarrative, pronounSetToMode } from '../agentNarration';
import { buildHealthSummary } from '../agent/healthSummary';
import { buildEverydayLifeSummary, buildMemoryTraumaSummary } from '../agent/lifestyleSummary';
import { displayLanguageCode, escapeHtml, toTitleCaseWords } from './formatting';

export type DetailsOpenReader = (key: string, defaultOpen: boolean) => boolean;

const COGNITIVE_DETAILS_KEY = 'profile:cognitive:details';
const PSYCHOLOGY_DETAILS_KEY = 'profile:psychology:details';

function renderGauge(label: string, value01k: number): string {
  const pct = Math.max(0, Math.min(100, Math.round((value01k / 1000) * 100)));
  return `
    <div class="agent-gauge">
      <div class="agent-gauge-row">
        <span class="agent-gauge-label">${escapeHtml(label)}</span>
        <span class="agent-gauge-value">${escapeHtml(toTitleCaseWords(formatBand5(value01k)))}</span>
      </div>
      <div class="agent-gauge-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="agent-gauge-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

function moodBandFromSigned(value01k: number): Band5 {
  if (value01k <= -600) return 'very_low';
  if (value01k <= -200) return 'low';
  if (value01k < 200) return 'medium';
  if (value01k < 600) return 'high';
  return 'very_high';
}

function renderMoodGauge(label: string, signed01k: number): string {
  const pct = Math.max(0, Math.min(100, Math.round(((signed01k + 1000) / 2000) * 100)));
  return `
    <div class="agent-gauge">
      <div class="agent-gauge-row">
        <span class="agent-gauge-label">${escapeHtml(label)}</span>
        <span class="agent-gauge-value">${escapeHtml(toTitleCaseWords(moodBandFromSigned(signed01k)))}</span>
      </div>
      <div class="agent-gauge-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="agent-gauge-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

function humanizeSkillKey(key: string): string {
  // camelCase -> space words; preserves existing snake/space tags via toTitleCaseWords.
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return toTitleCaseWords(spaced);
}
export function renderAgent(
  agent: GeneratedAgent,
  shadowByIso3: ReadonlyMap<string, { shadow: string; continent?: string }>,
  tab: AgentProfileTab,
  isDetailsOpen: DetailsOpenReader,
  asOfYear: number,
  agentVocab?: AgentVocabV1 | null,
): string {
  const apt = agent.capabilities.aptitudes;
  const skills = agent.capabilities.skills;
  const preview = agent.deepSimPreview;

  const homeShadow = shadowByIso3.get(agent.identity.homeCountryIso3)?.shadow;
  const citizenshipShadow = shadowByIso3.get(agent.identity.citizenshipCountryIso3)?.shadow;
  const currentShadow = shadowByIso3.get(agent.identity.currentCountryIso3)?.shadow;

  const originLabel = homeShadow ?? agent.identity.homeCountryIso3;
  const citizenshipLabel = citizenshipShadow ?? agent.identity.citizenshipCountryIso3;
  const currentLabel = currentShadow ?? agent.identity.currentCountryIso3;

  // Use agent's actual pronouns for narration consistency (mixed sets pick deterministically from seed)
  const agentPronounMode = pronounSetToMode(agent.gender.pronounSet, agent.seed);
  const narrativeMode = tab === 'overview' ? 'synopsis' : 'full';
  const narrativeResult = generateNarrative(
    agent,
    { originLabel, citizenshipLabel, currentLabel },
    asOfYear,
    agentPronounMode,
    narrativeMode,
  );
  const narrative = narrativeResult.html;
  const narrativeSynopsis = narrativeMode === 'synopsis'
    ? narrative
    : generateNarrative(
      agent,
      { originLabel, citizenshipLabel, currentLabel },
      asOfYear,
      agentPronounMode,
      'synopsis',
    ).html;
  const healthSummary = buildHealthSummary(agent.health, toTitleCaseWords);
  const everydaySummary = buildEverydayLifeSummary(agent.everydayLife, toTitleCaseWords);
  const memorySummary = buildMemoryTraumaSummary(agent.memoryTrauma, toTitleCaseWords);
  const dependencyProfiles = agent.dependencyProfiles ?? [];
  const dependencyHint = dependencyProfiles.length
    ? `${toTitleCaseWords(dependencyProfiles[0].stage)} · ${toTitleCaseWords(dependencyProfiles[0].substance)}`
    : 'None';
  const culturalDynamics = agent.culturalDynamics;
  const needsRelationships = agent.needsRelationships;
  const relationshipPatterns = agent.relationshipPatterns;
  const psychologyType = agent.psychologyType;
  const artisticPrefs = agent.preferences.artistic;
  const platformDietSummary = Object.entries(agent.preferences.media.platformDiet)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([platform, value]) => `${toTitleCaseWords(platform)} ${formatFixed01k(value)}`)
    .join(', ') || '—';
  const renderDynamicsPills = (items: string[] | undefined): string => (
    items && items.length
      ? `<span class="agent-pill-wrap agent-pill-wrap-left">${items.slice(0, 4).map(item => `<span class="pill pill-muted">${escapeHtml(item)}</span>`).join('')}</span>`
      : `<span class="agent-inline-muted">—</span>`
  );
  const renderArchetypePills = (primary?: string, secondary?: string): string => {
    if (!primary) return '<span class="agent-inline-muted">—</span>';
    const items = [primary, secondary].filter(Boolean) as string[];
    return `<span class="agent-pill-wrap agent-pill-wrap-left">${items.map(item => `<span class="pill pill-muted">${escapeHtml(toTitleCaseWords(item))}</span>`).join('')}</span>`;
  };

  const roleTags = agent.identity.roleSeedTags.map(t => `<span class="pill">${escapeHtml(toTitleCaseWords(t))}</span>`).join('');
  const langTags = agent.identity.languages.map(t => `<span class="pill pill-muted">${escapeHtml(displayLanguageCode(t))}</span>`).join('');

  const sortedSkills = Object.entries(skills)
    .map(([key, v]) => ({ key, value: v.value }))
    .sort((a, b) => (b.value - a.value) || a.key.localeCompare(b.key));
  const topSkills = sortedSkills.slice(0, 6);

  const skillRows = sortedSkills
    .map((s) => `
      <div class="agent-skill-row">
        <div class="agent-skill-name">${escapeHtml(humanizeSkillKey(s.key))}</div>
        <div class="agent-skill-band">${escapeHtml(toTitleCaseWords(formatBand5(s.value)))}</div>
        <div class="agent-skill-pct">${escapeHtml(formatFixed01k(s.value))}</div>
      </div>
    `)
    .join('');

  const topSkillList = topSkills
    .map(s => `<div class="agent-mini-row"><span class="agent-mini-k">${escapeHtml(humanizeSkillKey(s.key))}</span><span class="agent-mini-v">${escapeHtml(formatFixed01k(s.value))}</span></div>`)
    .join('');

  const detailItems = agent.details ?? [];
  const detailPills = detailItems.length
    ? `<span class="agent-pill-wrap agent-pill-wrap-left">${detailItems.map(detail => `<span class="pill pill-muted">${escapeHtml(detail.item)}</span>`).join('')}</span>`
    : `<span class="agent-inline-muted">—</span>`;

  const behaviorLens = agent.behaviorLens;
  const behaviorReads = behaviorLens?.reads ?? [];
  const behaviorList = behaviorReads.length
    ? `
      <div class="agent-detail-list">
        ${behaviorReads.map(read => `
          <div class="agent-detail-row">
            <span class="agent-detail-dot">•</span>
            <span class="agent-detail-text">${escapeHtml(read.item)}</span>
          </div>
        `).join('')}
      </div>
    `
    : `<div class="agent-inline-muted">—</div>`;

  const decisionStyle = agent.decisionStyle;
  const decisionReads = decisionStyle?.tendencies ?? [];
  const decisionList = decisionReads.length
    ? `
      <div class="agent-detail-list">
        ${decisionReads.map(read => `
          <div class="agent-detail-row">
            <span class="agent-detail-dot">•</span>
            <span class="agent-detail-text">${escapeHtml(read.item)}</span>
          </div>
        `).join('')}
      </div>
    `
    : `<div class="agent-inline-muted">—</div>`;

  const physicalDetails = agent.physicalDetails ?? [];
  const physicalList = physicalDetails.length
    ? `
      <div class="agent-detail-list">
        ${physicalDetails.map(detail => `
          <div class="agent-detail-row">
            <span class="agent-detail-dot">•</span>
            <span class="agent-detail-text">${escapeHtml(detail.item)}</span>
          </div>
        `).join('')}
      </div>
    `
    : `<div class="agent-inline-muted">—</div>`;

  const preferenceNarrativeBeats = agent.preferenceNarrativeBeats ?? [];
  const livingSpaceNarrativeBeats = agent.livingSpaceNarrativeBeats ?? [];
  const renderBeatList = (beats: string[]): string => (
    beats.length
      ? `
        <div class="agent-detail-list">
          ${beats.map(beat => `
            <div class="agent-detail-row">
              <span class="agent-detail-dot">•</span>
              <span class="agent-detail-text">${escapeHtml(beat)}</span>
            </div>
          `).join('')}
        </div>
      `
      : `<div class="agent-inline-muted">—</div>`
  );

  const skillsEvolution = agent.skillsEvolution;
  const evolutionValue = (value?: string) => (
    value ? escapeHtml(toTitleCaseWords(value)) : `<span class="agent-inline-muted">—</span>`
  );
  const renderEvolutionPills = (items?: string[]) => (
    items && items.length
      ? `<span class="agent-pill-wrap agent-pill-wrap-left">${items.map(item => `<span class="pill pill-muted">${escapeHtml(toTitleCaseWords(item))}</span>`).join('')}</span>`
      : `<span class="agent-inline-muted">—</span>`
  );
  const evolutionHint = skillsEvolution?.arc && skillsEvolution?.phase
    ? `${toTitleCaseWords(skillsEvolution.arc)} · ${toTitleCaseWords(skillsEvolution.phase)}`
    : '—';

  const aptitudePairs = ([
    ['Strength', apt.strength],
    ['Endurance', apt.endurance],
    ['Dexterity', apt.dexterity],
    ['Reflexes', apt.reflexes],
    ['Hand‑eye', apt.handEyeCoordination],
    ['Cognitive speed', apt.cognitiveSpeed],
    ['Attention control', apt.attentionControl],
    ['Working memory', apt.workingMemory],
    ['Risk calibration', apt.riskCalibration],
    ['Charisma', apt.charisma],
    ['Empathy', apt.empathy],
    ['Assertiveness', apt.assertiveness],
    ['Deception', apt.deceptionAptitude],
  ] as const)
    .slice()
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  const topAptitudes = aptitudePairs.slice(0, 4);
  const topAptitudeList = topAptitudes
    .map(([label, v]) => `<div class="agent-mini-row"><span class="agent-mini-k">${escapeHtml(label)}</span><span class="agent-mini-v">${escapeHtml(formatFixed01k(v))}</span></div>`)
    .join('');

  const conversationTopics = agent.civicLife?.conversationTopics ?? [];
  const conversationPills = conversationTopics.length
    ? `<span class="agent-pill-wrap">${conversationTopics.slice(0, 4).map(topic => `<span class="pill pill-muted">${escapeHtml(topic)}</span>`).join('')}</span>`
    : `<span class="agent-inline-muted">—</span>`;

  const knowledgeIgnorance = agent.knowledgeIgnorance;
  const knowledgeStrengths = knowledgeIgnorance?.knowledgeStrengths ?? [];
  const knowledgeGaps = knowledgeIgnorance?.knowledgeGaps ?? [];
  const falseBeliefs = knowledgeIgnorance?.falseBeliefs ?? [];
  const informationSources = knowledgeIgnorance?.informationSources ?? [];
  const informationBarriers = knowledgeIgnorance?.informationBarriers ?? [];
  const knowledgeDepths = knowledgeIgnorance?.depths01k;
  const knowledgeItems = knowledgeIgnorance?.items;
  const renderKnowledgePills = (items: string[]): string => (
    `<span class="agent-pill-wrap">${items.slice(0, 4).map(item => `<span class="pill pill-muted">${escapeHtml(item)}</span>`).join('')}</span>`
  );
  const renderKnowledgeEntries = (entries: KnowledgeItem[] | undefined, fallback: string[]): string => {
    if (entries && entries.length) {
      return renderKnowledgeEntryList(entries, [], 'left');
    }
    if (fallback.length) return renderKnowledgePills(fallback);
    return `<span class="agent-inline-muted">—</span>`;
  };
  const buildKnowledgeCard = (label: string, depth: number | undefined, entries: KnowledgeItem[] | undefined, fallback: string[]): string => {
    if (!(entries?.length || fallback.length)) return '';
    const body = `<div class="agent-kv">${renderKnowledgeEntries(entries, fallback)}</div>`;
    return renderCognitiveCard(escapeHtml(label), depth, body);
  };
  const cognitiveDetailsOpen = isDetailsOpen(COGNITIVE_DETAILS_KEY, false);
  const cognitiveCards = [
    buildKnowledgeCard('Strengths', knowledgeDepths?.strengths, knowledgeItems?.strengths, knowledgeStrengths),
    buildKnowledgeCard('Gaps', knowledgeDepths?.gaps, knowledgeItems?.gaps, knowledgeGaps),
    buildKnowledgeCard('False beliefs', knowledgeDepths?.falseBeliefs, knowledgeItems?.falseBeliefs, falseBeliefs),
    buildKnowledgeCard('Sources', knowledgeDepths?.sources, knowledgeItems?.sources, informationSources),
    buildKnowledgeCard('Barriers', knowledgeDepths?.barriers, knowledgeItems?.barriers, informationBarriers),
  ]
    .filter(Boolean)
    .join('');

  const psychologyDetailsOpen = isDetailsOpen(PSYCHOLOGY_DETAILS_KEY, false);
  const existenceCrisis = agent.existenceCrisis;
  const thoughtsEmotions = agent.thoughtsEmotions;
  const toPsychEntries = <T extends { item: string }>(entries: T[] | undefined, formatter: (entry: T) => string) =>
    (entries ?? []).map(entry => ({ item: entry.item, meta: formatter(entry) }));
  const buildPsychologyCard = (title: string, entries: Array<{ item: string; meta?: string }>): string => {
    const body = renderPsychologyEntryList(entries, 'left');
    return renderPsychologyCard(escapeHtml(title), body);
  };
  const psychologyCards = [
    buildPsychologyCard(
      'Immediate observations',
      toPsychEntries(thoughtsEmotions?.thoughts.immediateObservations, formatThoughtMeta),
    ),
    buildPsychologyCard(
      'Reflections',
      toPsychEntries(thoughtsEmotions?.thoughts.reflections, formatThoughtMeta),
    ),
    buildPsychologyCard(
      'Memories',
      toPsychEntries(thoughtsEmotions?.thoughts.memories, formatThoughtMeta),
    ),
    buildPsychologyCard(
      'Worries',
      toPsychEntries(thoughtsEmotions?.thoughts.worries, formatThoughtMeta),
    ),
    buildPsychologyCard(
      'Desires',
      toPsychEntries(thoughtsEmotions?.thoughts.desires, formatThoughtMeta),
    ),
    buildPsychologyCard(
      'Social thoughts',
      toPsychEntries(thoughtsEmotions?.thoughts.socialThoughts, formatThoughtMeta),
    ),
    buildPsychologyCard(
      'Primary emotions',
      toPsychEntries(thoughtsEmotions?.emotions.primary, formatEmotionMeta),
    ),
    buildPsychologyCard(
      'Complex emotions',
      toPsychEntries(thoughtsEmotions?.emotions.complex, formatEmotionMeta),
    ),
    buildPsychologyCard(
      'Healthy coping',
      toPsychEntries(thoughtsEmotions?.coping.healthy, formatCopingMeta),
    ),
    buildPsychologyCard(
      'Unhealthy coping',
      toPsychEntries(thoughtsEmotions?.coping.unhealthy, formatCopingMeta),
    ),
  ]
    .filter(Boolean)
    .join('');

  const facetScores = agent.personality.facets ?? [];
  const sortedFacets = facetScores.slice().sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
  const topFacets = sortedFacets.slice(0, 4);
  const lowFacets = sortedFacets.slice(-4).reverse();
  const formatFacetScore = (score: number): string => `${Math.round(score)}%`;
  const highlightBlock = facetScores.length
    ? `
      <div class="agent-facet-highlights">
        <div>
          <div class="agent-mini-title">High</div>
          <div class="agent-pill-wrap agent-pill-wrap-left">
            ${topFacets.map(f => `<span class="pill">${escapeHtml(`${f.name} ${formatFacetScore(f.score)}`)}</span>`).join('')}
          </div>
        </div>
        <div>
          <div class="agent-mini-title">Low</div>
          <div class="agent-pill-wrap agent-pill-wrap-left">
            ${lowFacets.map(f => `<span class="pill pill-muted">${escapeHtml(`${f.name} ${formatFacetScore(f.score)}`)}</span>`).join('')}
          </div>
        </div>
      </div>
    `
    : `<div class="agent-inline-muted">—</div>`;
  const facetCategoryMap = (agentVocab?.personality?.facetCategories ?? {}) as Record<string, string[]>;
  const categoryEntries: Array<[string, string[]]> = Object.keys(facetCategoryMap).length
    ? Object.entries(facetCategoryMap)
    : [['Facets', facetScores.map(f => f.name)]];
  const facetByName = new Map(facetScores.map(f => [f.name.toLowerCase(), f]));
  const categoryCards = categoryEntries.map(([category, names]) => {
    const resolved = (names ?? [])
      .map(name => facetByName.get(String(name).toLowerCase()))
      .filter((f): f is typeof facetScores[number] => !!f);
    const preview = resolved.slice(0, 3)
      .map(f => `<div class="agent-mini-row"><span class="agent-mini-k">${escapeHtml(f.name)}</span><span class="agent-mini-v">${escapeHtml(formatFacetScore(f.score))}</span></div>`)
      .join('');
    const full = resolved
      .map(f => `<div class="agent-mini-row"><span class="agent-mini-k">${escapeHtml(f.name)}</span><span class="agent-mini-v">${escapeHtml(formatFacetScore(f.score))}</span></div>`)
      .join('');
    const details = resolved.length > 3
      ? `<details class="agent-inline-details"><summary>Show all</summary><div class="agent-mini-list">${full}</div></details>`
      : '';
    const body = resolved.length
      ? `<div class="agent-mini-list">${preview}</div>${details}`
      : `<div class="agent-inline-muted">—</div>`;
    return renderPsychologyCard(escapeHtml(category), body);
  }).join('');

  const aspirations = agent.motivations?.dreams ?? [];
  const aspirationsPills = aspirations.length
    ? `<span class="agent-pill-wrap">${aspirations.slice(0, 4).map(item => `<span class="pill pill-muted">${escapeHtml(item)}</span>`).join('')}</span>`
    : `<span class="agent-inline-muted">—</span>`;
  const dreamImagery = agent.dreamsNightmares?.dreams ?? [];
  const dreamImageryPills = dreamImagery.length
    ? `<span class="agent-pill-wrap">${dreamImagery.slice(0, 4).map(item => `<span class="pill pill-muted">${escapeHtml(item)}</span>`).join('')}</span>`
    : `<span class="agent-inline-muted">—</span>`;
  const nightmares = agent.dreamsNightmares?.nightmares ?? [];
  const nightmaresPills = nightmares.length
    ? `<span class="agent-pill-wrap">${nightmares.slice(0, 4).map(item => `<span class="pill pill-muted">${escapeHtml(item)}</span>`).join('')}</span>`
    : `<span class="agent-inline-muted">—</span>`;
  const economicMobility = agent.economicMobility;
  const secondaryGoals = agent.motivations.secondaryGoals.length
    ? agent.motivations.secondaryGoals.map(toTitleCaseWords).join(', ')
    : '—';

  const traceSection = agent.generationTrace
    ? `
      <details class="agent-trace" data-agents-details="profile:debug:trace" ${isDetailsOpen('profile:debug:trace', false) ? 'open' : ''}>
        <summary>Generation trace</summary>
        <pre class="agent-trace-pre">${escapeHtml(JSON.stringify(agent.generationTrace, null, 2))}</pre>
      </details>
    `
    : '';

  return `
    <div class="agent-profile">
      <div class="agent-profile-sticky">
        <div class="agent-profile-header">
          <h2>${escapeHtml(agent.identity.name)}</h2>
          <div class="agent-meta">
            <span class="agent-meta-item agent-meta-hide-mobile">Seed: <code>${escapeHtml(agent.seed)}</code></span>
            <span class="agent-meta-item">Origin: ${escapeHtml(originLabel)} <code class="agent-meta-hide-mobile">${escapeHtml(agent.identity.homeCountryIso3)}</code></span>
            <span class="agent-meta-item agent-meta-hide-mobile">Citizenship: ${escapeHtml(citizenshipLabel)} <code>${escapeHtml(agent.identity.citizenshipCountryIso3)}</code></span>
            ${agent.identity.currentCountryIso3 !== agent.identity.homeCountryIso3 ? `<span class="agent-meta-item">Location: ${escapeHtml(currentLabel)} <code class="agent-meta-hide-mobile">${escapeHtml(agent.identity.currentCountryIso3)}</code></span>` : ''}
            <span class="agent-meta-item">Born: ${escapeHtml(String(agent.identity.birthYear))}</span>
            <span class="agent-meta-item">Tier: ${escapeHtml(toTitleCaseWords(agent.identity.tierBand))}</span>
            <span class="agent-meta-item agent-meta-hide-mobile">Culture: ${escapeHtml(toTitleCaseWords(agent.identity.homeCulture))}</span>
          </div>
          <div class="agent-pill-row">${roleTags} <span class="agent-meta-hide-mobile">${langTags}</span></div>
        </div>

        <div class="agent-tabs">
          <button type="button" class="agent-tab-btn ${tab === 'overview' ? 'active' : ''}" data-agent-tab="overview" title="First impression: who is this person?">${AGENT_TAB_LABELS.overview}</button>
          <button type="button" class="agent-tab-btn ${tab === 'character' ? 'active' : ''}" data-agent-tab="character" title="Inner life: personality, beliefs, motivations">${AGENT_TAB_LABELS.character}</button>
          <button type="button" class="agent-tab-btn ${tab === 'life' ? 'active' : ''}" data-agent-tab="life" title="Habits, tastes, spaces, routines">${AGENT_TAB_LABELS.life}</button>
          <button type="button" class="agent-tab-btn ${tab === 'skills' ? 'active' : ''}" data-agent-tab="skills" title="Skills and aptitudes">${AGENT_TAB_LABELS.skills}</button>
          <button type="button" class="agent-tab-btn ${tab === 'connections' ? 'active' : ''}" data-agent-tab="connections" title="Social web: relationships, network, institution">${AGENT_TAB_LABELS.connections}</button>
          <button type="button" class="agent-tab-btn ${tab === 'mind' ? 'active' : ''}" data-agent-tab="mind" title="Thoughts, emotions, knowledge, beliefs">${AGENT_TAB_LABELS.mind}</button>
          <button type="button" class="agent-tab-btn agent-tab-btn-muted ${tab === 'data' ? 'active' : ''}" data-agent-tab="data" title="Technical data and export options">${AGENT_TAB_LABELS.data}</button>
        </div>
      </div>

        <div class="agent-tab-panels">
          <!-- OVERVIEW TAB: First impression - who is this person? -->
          <div class="agent-tab-panel ${tab === 'overview' ? 'active' : ''}" data-agent-tab-panel="overview">
            <div class="agent-grid agent-grid-tight">
              <!-- Synopsis: the narrative hook -->
              <section class="agent-card agent-card-span12">
                <h3>Synopsis</h3>
                ${narrativeSynopsis}
              </section>

              <!-- At a glance: quick reference for writers -->
              <section class="agent-card agent-card-span6">
                <h3>At a glance</h3>
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Languages</span><span class="kv-v">${escapeHtml(agent.identity.languageProficiencies.map(lp => `${displayLanguageCode(lp.language)} (${toTitleCaseWords(lp.proficiencyBand)})`).join(', '))}</span></div>
                  <div class="kv-row"><span class="kv-k">Education</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.identity.educationTrackTag))}</span></div>
                  <div class="kv-row"><span class="kv-k">Career</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.identity.careerTrackTag))}</span></div>
                  <div class="kv-row"><span class="kv-k">Mobility</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.mobility.mobilityTag))}</span></div>
                  <div class="kv-row"><span class="kv-k">Passport</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.mobility.passportAccessBand))}</span></div>
                  <div class="kv-row"><span class="kv-k">Travel</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.mobility.travelFrequencyBand))}</span></div>
                </div>
              </section>

              <!-- Highlights: top capabilities -->
              <section class="agent-card agent-card-span6">
                <h3>Highlights</h3>
                <div class="agent-mini">
                  <div class="agent-mini-title">Top skills</div>
                  <div class="agent-mini-list">${topSkillList || `<div class="agent-inline-muted">—</div>`}</div>
                  <div class="agent-mini-title" style="margin-top:0.75rem">Top aptitudes</div>
                  <div class="agent-mini-list">${topAptitudeList || `<div class="agent-inline-muted">—</div>`}</div>
                </div>
              </section>

              <section class="agent-card agent-card-span12">
                <h3>Detail markers</h3>
                <div class="agent-kv">${detailPills}</div>
              </section>

              <section class="agent-card agent-card-span12">
                <h3>Behavior lens</h3>
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Archetype</span><span class="kv-v">${escapeHtml(behaviorLens?.archetype ?? '—')}</span></div>
                </div>
                ${behaviorList}
              </section>

              <section class="agent-card agent-card-span12">
                <h3>Decision style</h3>
                ${decisionList}
              </section>

              <section class="agent-card agent-card-span12">
                <h3>Physical details</h3>
                ${physicalList}
              </section>

              <!-- Life timeline: visual journey (merged from Narrative tab) -->
              ${agent.timeline.length ? `
              <section class="agent-card agent-card-span12">
                <h3>Life timeline</h3>
                <div class="agent-timeline">
                  ${agent.timeline.slice(0, 6).map(e => `
                    <div class="agent-timeline-event">
                      <span class="agent-timeline-year">${agent.identity.birthYear + e.yearOffset}</span>
                      <span class="agent-timeline-type pill pill-muted">${escapeHtml(toTitleCaseWords(e.type))}</span>
                      <span class="agent-timeline-desc">${escapeHtml(e.description)}</span>
                    </div>
                  `).join('')}
                </div>
              </section>
              ` : ''}

              <!-- Full narrative (collapsed by default, for writers who want more) -->
              <details class="agent-card agent-card-span12 agent-section" data-agents-details="profile:portrait:narrative" ${isDetailsOpen('profile:portrait:narrative', false) ? 'open' : ''}>
                <summary class="agent-section-summary">
                  <span class="agent-section-title">Full narrative</span>
                  <span class="agent-section-hint">Detailed character description</span>
                </summary>
                <div class="agent-section-body">
                  ${narrative}
                </div>
              </details>
            </div>
          </div>

        <!-- CHARACTER TAB: Inner life - personality, beliefs, motivations -->
        <div class="agent-tab-panel ${tab === 'character' ? 'active' : ''}" data-agent-tab-panel="character">
          <div class="agent-grid agent-grid-tight">
            <!-- Personality & Work Style -->
            <section class="agent-card agent-card-span6">
              <h3>Personality</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Conflict</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.personality.conflictStyle))}</span></div>
                <div class="kv-row"><span class="kv-k">Epistemic</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.personality.epistemicStyle))}</span></div>
                <div class="kv-row"><span class="kv-k">Social</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.personality.socialEnergy))}</span></div>
                <div class="kv-row"><span class="kv-k">Risk</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.personality.riskPosture))}</span></div>
              </div>
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Work style</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Writing</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.workStyle.writingStyle))}</span></div>
                <div class="kv-row"><span class="kv-k">Briefing</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.workStyle.briefingStyle))}</span></div>
                <div class="kv-row"><span class="kv-k">Confidence</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.workStyle.confidenceCalibration))}</span></div>
              </div>
            </section>

            <!-- Motivations (merged from Motivations tab) -->
            <section class="agent-card agent-card-span6">
              <h3>Dreams &amp; goals</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Primary</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.motivations.primaryGoal))}</span></div>
                <div class="kv-row"><span class="kv-k">Secondary</span><span class="kv-v">${escapeHtml(secondaryGoals)}</span></div>
                <div class="kv-row"><span class="kv-k">Core need</span><span class="kv-v">${escapeHtml(agent.motivations.coreNeed)}</span></div>
                <div class="kv-row"><span class="kv-k">Aspirations</span><span class="kv-v">${aspirationsPills}</span></div>
                <div class="kv-row"><span class="kv-k">Dreams</span><span class="kv-v">${dreamImageryPills}</span></div>
                <div class="kv-row"><span class="kv-k">Nightmares</span><span class="kv-v">${nightmaresPills}</span></div>
              </div>
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Economic mobility</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Origin</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.identity.originTierBand))} → ${escapeHtml(toTitleCaseWords(agent.identity.tierBand))} ${agent.identity.socioeconomicMobility === 'upward' ? '↑' : agent.identity.socioeconomicMobility === 'downward' ? '↓' : '→'}</span></div>
                <div class="kv-row"><span class="kv-k">Pattern</span><span class="kv-v">${escapeHtml(economicMobility.mobilityPattern || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Driver</span><span class="kv-v">${escapeHtml(economicMobility.moneyDriver || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Personality</span><span class="kv-v">${escapeHtml(economicMobility.moneyPersonality || '—')}</span></div>
                ${agent.eliteCompensators.length ? `<div class="kv-row"><span class="kv-k">Compensators</span><span class="kv-v">${escapeHtml(agent.eliteCompensators.map(toTitleCaseWords).join(', '))}</span></div>` : ''}
              </div>
            </section>

            <!-- Identity & Beliefs -->
            <section class="agent-card agent-card-span6">
              <h3>Identity &amp; beliefs</h3>
              <div class="agent-kv">
                ${!['cisgender-man', 'cisgender-woman'].includes(agent.gender.identityTag) ? `<div class="kv-row"><span class="kv-k">Gender</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.gender.identityTag))} (${escapeHtml(agent.gender.pronounSet)})</span></div>` : ''}
                <div class="kv-row"><span class="kv-k">Pronouns</span><span class="kv-v">${escapeHtml(agent.gender.pronounSet)}</span></div>
                ${agent.orientation.orientationTag !== 'straight' ? `<div class="kv-row"><span class="kv-k">Orientation</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.orientation.orientationTag))} (${escapeHtml(toTitleCaseWords(agent.orientation.outnessLevel))})</span></div>` : ''}
                <div class="kv-row"><span class="kv-k">Spirituality</span><span class="kv-v">${agent.spirituality.tradition !== 'none' ? `${escapeHtml(toTitleCaseWords(agent.spirituality.tradition))} - ` : ''}${escapeHtml(toTitleCaseWords(agent.spirituality.affiliationTag))} (${escapeHtml(toTitleCaseWords(agent.spirituality.observanceLevel))})</span></div>
                ${agent.neurodivergence.indicatorTags.length && !agent.neurodivergence.indicatorTags.includes('neurotypical') ? `<div class="kv-row"><span class="kv-k">Neurodivergence</span><span class="kv-v">${escapeHtml(agent.neurodivergence.indicatorTags.map(toTitleCaseWords).join(', '))}</span></div>` : ''}
              </div>
            </section>

            <!-- Ethics (merged from Health tab) -->
            <details class="agent-card agent-section" data-agents-details="profile:character:ethics" ${isDetailsOpen('profile:character:ethics', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Ethics &amp; red lines</span>
                <span class="agent-section-hint">${escapeHtml(toTitleCaseWords(agent.psych.ethics.loyaltyScope))} loyalty</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-card-grid">
                  ${renderGauge('Rule adherence', agent.psych.ethics.ruleAdherence)}
                  ${renderGauge('Harm aversion', agent.psych.ethics.harmAversion)}
                  ${renderGauge('Mission utilitarianism', agent.psych.ethics.missionUtilitarianism)}
                </div>
                <div class="agent-kv" style="margin-top:10px">
                  <div class="kv-row"><span class="kv-k">Loyalty scope</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.psych.ethics.loyaltyScope))}</span></div>
                  <div class="kv-row"><span class="kv-k">Red lines</span><span class="kv-v">${escapeHtml(agent.identity.redLines.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                </div>
                ${agent.psych.contradictions.length ? `
                  <div style="margin-top:0.75rem">
                    <div class="agent-mini-title">Internal contradictions</div>
                    ${agent.psych.contradictions.slice(0, 2).map(c => `
                      <div class="agent-contradiction-row">
                        <span class="pill pill-muted">${escapeHtml(toTitleCaseWords(c.trait1))}</span>
                        <span class="agent-contradiction-vs">vs</span>
                        <span class="pill pill-muted">${escapeHtml(toTitleCaseWords(c.trait2))}</span>
                        <span class="agent-contradiction-label">→ ${escapeHtml(c.tension)}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </details>

        </div>
      </div>

        <!-- MIND TAB: Thoughts, emotions, knowledge, beliefs -->
        <div class="agent-tab-panel ${tab === 'mind' ? 'active' : ''}" data-agent-tab-panel="mind">
          <div class="agent-grid agent-grid-tight">
            <div class="agent-tab-section-title agent-card-span12">Psychology</div>
            <section class="agent-card agent-card-span6">
              <h3>Psychology type</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Type</span><span class="kv-v">${escapeHtml(toTitleCaseWords(psychologyType.name))}</span></div>
                <div class="kv-row"><span class="kv-k">Values</span><span class="kv-v">${escapeHtml(psychologyType.values.slice(0, 3).map(toTitleCaseWords).join(', ') || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Coping</span><span class="kv-v">${escapeHtml(psychologyType.copingMechanism)}</span></div>
                <div class="kv-row"><span class="kv-k">Breaking point</span><span class="kv-v">${escapeHtml(psychologyType.breakingPoint)}</span></div>
                <div class="kv-row"><span class="kv-k">Missions</span><span class="kv-v">${escapeHtml(psychologyType.missionPreferences.slice(0, 3).map(toTitleCaseWords).join(', ') || '—')}</span></div>
              </div>
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Existence crisis</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Type</span><span class="kv-v">${escapeHtml(existenceCrisis?.name ?? '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Trigger</span><span class="kv-v">${escapeHtml(existenceCrisis?.trigger ?? '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Stage</span><span class="kv-v">${escapeHtml(existenceCrisis?.stage ?? '—')}</span></div>
                ${psychologyDetailsOpen ? `
                  <div class="kv-row"><span class="kv-k">Behaviors</span><span class="kv-v">${escapeHtml(existenceCrisis?.behaviors?.join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Outcomes</span><span class="kv-v">${escapeHtml(existenceCrisis?.outcomes?.join(', ') || '—')}</span></div>
                ` : ''}
              </div>
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Creativity</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Mediums</span><span class="kv-v">${escapeHtml(artisticPrefs.mediums.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Specializations</span><span class="kv-v">${escapeHtml(artisticPrefs.specializations.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Themes</span><span class="kv-v">${escapeHtml(artisticPrefs.themes.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Inspiration</span><span class="kv-v">${escapeHtml(toTitleCaseWords(artisticPrefs.inspirationSource))}</span></div>
                <div class="kv-row"><span class="kv-k">Driver</span><span class="kv-v">${escapeHtml(toTitleCaseWords(artisticPrefs.expressionDriver))}</span></div>
                <div class="kv-row"><span class="kv-k">Practice</span><span class="kv-v">${escapeHtml(toTitleCaseWords(artisticPrefs.practiceRhythm))}</span></div>
                <div class="kv-row"><span class="kv-k">Sharing</span><span class="kv-v">${escapeHtml(toTitleCaseWords(artisticPrefs.sharingStyle))}</span></div>
                <div class="kv-row"><span class="kv-k">Workspace</span><span class="kv-v">${escapeHtml(toTitleCaseWords(artisticPrefs.workspacePreference))}</span></div>
                <div class="kv-row"><span class="kv-k">Learning</span><span class="kv-v">${escapeHtml(toTitleCaseWords(artisticPrefs.learningMode))}</span></div>
                <div class="kv-row"><span class="kv-k">Challenge</span><span class="kv-v">${escapeHtml(toTitleCaseWords(artisticPrefs.challenge))}</span></div>
              </div>
            </section>

            <details class="agent-card agent-section agent-card-span12" data-agents-details="profile:psychology:thoughts" ${isDetailsOpen('profile:psychology:thoughts', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Thoughts &amp; emotions</span>
                <span class="agent-section-hint">Stream snapshot</span>
              </summary>
              <div class="agent-section-body">
                ${renderPsychologySection(psychologyCards, psychologyDetailsOpen)}
              </div>
            </details>

            <details class="agent-card agent-section agent-card-span12" data-agents-details="profile:psychology:facets" ${isDetailsOpen('profile:psychology:facets', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Facets</span>
                <span class="agent-section-hint">Highs, lows, categories</span>
              </summary>
              <div class="agent-section-body">
                ${highlightBlock}
                <div class="agent-grid agent-grid-tight" style="margin-top:0.75rem">
                  ${categoryCards}
                </div>
              </div>
            </details>

            <div class="agent-tab-section-title agent-card-span12">Knowledge &amp; beliefs</div>
            ${renderCognitiveSection(cognitiveCards, cognitiveDetailsOpen)}
          </div>
        </div>

        <!-- CONNECTIONS TAB: Social web - relationships, network, institution -->
        <div class="agent-tab-panel ${tab === 'connections' ? 'active' : ''}" data-agent-tab-panel="connections">
          <div class="agent-grid agent-grid-tight">
            <section class="agent-card agent-card-span6">
              <h3>Institution</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Org</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.institution.orgType))}</span></div>
                <div class="kv-row"><span class="kv-k">Grade</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.institution.gradeBand))} · ${agent.institution.yearsInService}y</span></div>
                <div class="kv-row"><span class="kv-k">Clearance</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.institution.clearanceBand))}</span></div>
                <div class="kv-row"><span class="kv-k">Function</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.institution.functionalSpecialization))}</span></div>
              </div>
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Network</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Role</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.network.role))}</span></div>
                <div class="kv-row"><span class="kv-k">Leverage</span><span class="kv-v">${escapeHtml(agent.network.leverageType)}</span></div>
                ${agent.eliteCompensators.length ? `<div class="kv-row"><span class="kv-k">Compensators</span><span class="kv-v">${escapeHtml(agent.eliteCompensators.map(toTitleCaseWords).join(', '))}</span></div>` : ''}
              </div>
            </section>

            ${agent.relationships.length ? `
            <section class="agent-card agent-card-span6">
              <h3>Key relationships</h3>
              <div class="agent-kv">
                ${agent.relationships.slice(0, 6).map(r => `
                  <div class="kv-row"><span class="kv-k">${escapeHtml(toTitleCaseWords(r.type))}</span><span class="kv-v">${escapeHtml(r.description)}</span></div>
                `).join('')}
              </div>
            </section>
            ` : ''}

            <section class="agent-card agent-card-span6">
              <h3>Needs archetype</h3>
              ${renderArchetypePills(needsRelationships?.needs?.primary, needsRelationships?.needs?.secondary)}
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Relationship archetype</h3>
              ${renderArchetypePills(needsRelationships?.relationships?.primary, needsRelationships?.relationships?.secondary)}
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Relationship patterns</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Conflict</span><span class="kv-v">${escapeHtml(toTitleCaseWords(relationshipPatterns.conflictStyle))}</span></div>
                <div class="kv-row"><span class="kv-k">Repair</span><span class="kv-v">${escapeHtml(toTitleCaseWords(relationshipPatterns.repairStyle))}</span></div>
                <div class="kv-row"><span class="kv-k">Trust</span><span class="kv-v">${escapeHtml(toTitleCaseWords(relationshipPatterns.trustFormation))}</span></div>
                <div class="kv-row"><span class="kv-k">Attachment</span><span class="kv-v">${escapeHtml(toTitleCaseWords(relationshipPatterns.attachmentStyle))}</span></div>
              </div>
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Conversation topics</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Talks about</span><span class="kv-v">${conversationPills}</span></div>
              </div>
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Communication norms</h3>
              ${renderDynamicsPills(culturalDynamics?.communicationNorms)}
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Power dynamics</h3>
              ${renderDynamicsPills(culturalDynamics?.powerDynamics)}
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Bonding mechanisms</h3>
              ${renderDynamicsPills(culturalDynamics?.bondingMechanisms)}
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Clash points</h3>
              ${renderDynamicsPills(culturalDynamics?.clashPoints)}
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Culture &amp; community</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Heritage</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.culture.ethnolinguistic))} <span style="color:#666">(${Math.round(agent.culture.weights.ethnolinguistic / 10)}%)</span></span></div>
                <div class="kv-row"><span class="kv-k">Regional</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.culture.regional))} <span style="color:#666">(${Math.round(agent.culture.weights.regional / 10)}%)</span></span></div>
                <div class="kv-row"><span class="kv-k">Institutional</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.culture.institutional))} <span style="color:#666">(${Math.round(agent.culture.weights.institutional / 10)}%)</span></span></div>
              </div>
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Geography &amp; family</h3>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Urbanicity</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.geography.urbanicity))}</span></div>
                <div class="kv-row"><span class="kv-k">Diaspora</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.geography.diasporaStatus))}</span></div>
                <div class="kv-row"><span class="kv-k">Marital</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.family.maritalStatus))}${agent.family.dependentCount > 0 ? ` · ${agent.family.dependentCount} dependent${agent.family.dependentCount > 1 ? 's' : ''}` : ''}</span></div>
                ${agent.minorityStatus.visibleMinority || agent.minorityStatus.linguisticMinority || agent.minorityStatus.religiousMinority ? `<div class="kv-row"><span class="kv-k">Minority</span><span class="kv-v">${[agent.minorityStatus.visibleMinority ? 'visible' : '', agent.minorityStatus.linguisticMinority ? 'linguistic' : '', agent.minorityStatus.religiousMinority ? 'religious' : ''].filter(Boolean).join(', ')}</span></div>` : ''}
              </div>
            </section>
          </div>
        </div>

        <!-- SKILLS TAB: Skills and aptitudes -->
        <div class="agent-tab-panel ${tab === 'skills' ? 'active' : ''}" data-agent-tab-panel="skills">
          <div class="agent-grid agent-grid-tight">
            <details class="agent-card agent-section" data-agents-details="profile:capabilities:aptitudes" ${isDetailsOpen('profile:capabilities:aptitudes', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Aptitudes</span>
                <span class="agent-section-hint">${escapeHtml(topAptitudes.map(([label]) => label).join(', '))}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-card-grid">
                  ${renderGauge('Strength', apt.strength)}
                  ${renderGauge('Endurance', apt.endurance)}
                  ${renderGauge('Dexterity', apt.dexterity)}
                  ${renderGauge('Reflexes', apt.reflexes)}
                  ${renderGauge('Hand‑eye', apt.handEyeCoordination)}
                  ${renderGauge('Cognitive speed', apt.cognitiveSpeed)}
                  ${renderGauge('Attention control', apt.attentionControl)}
                  ${renderGauge('Working memory', apt.workingMemory)}
                  ${renderGauge('Risk calibration', apt.riskCalibration)}
                  ${renderGauge('Charisma', apt.charisma)}
                  ${renderGauge('Empathy', apt.empathy)}
                  ${renderGauge('Assertiveness', apt.assertiveness)}
                  ${renderGauge('Deception', apt.deceptionAptitude)}
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:capabilities:skills" ${isDetailsOpen('profile:capabilities:skills', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Skills</span>
                <span class="agent-section-hint">${escapeHtml(topSkills.map(s => humanizeSkillKey(s.key)).join(', '))}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-skill-header">
                  <span>Skill</span><span>Band</span><span>Value</span>
                </div>
                <div class="agent-skill-list">${skillRows}</div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:capabilities:evolution" ${isDetailsOpen('profile:capabilities:evolution', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Skills evolution</span>
                <span class="agent-section-hint">${escapeHtml(evolutionHint)}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Arc</span><span class="kv-v">${skillsEvolution ? evolutionValue(skillsEvolution.arc) : `<span class="agent-inline-muted">—</span>`}</span></div>
                  <div class="kv-row"><span class="kv-k">Phase</span><span class="kv-v">${skillsEvolution ? evolutionValue(skillsEvolution.phase) : `<span class="agent-inline-muted">—</span>`}</span></div>
                  <div class="kv-row"><span class="kv-k">Focus</span><span class="kv-v">${renderEvolutionPills(skillsEvolution?.skillFocuses)}</span></div>
                  <div class="kv-row"><span class="kv-k">Shifts</span><span class="kv-v">${renderEvolutionPills(skillsEvolution?.personalityShifts)}</span></div>
                  <div class="kv-row"><span class="kv-k">Growth driver</span><span class="kv-v">${skillsEvolution ? evolutionValue(skillsEvolution.growthDriver) : `<span class="agent-inline-muted">—</span>`}</span></div>
                  <div class="kv-row"><span class="kv-k">Decay pressure</span><span class="kv-v">${skillsEvolution ? evolutionValue(skillsEvolution.decayPressure) : `<span class="agent-inline-muted">—</span>`}</span></div>
                  <div class="kv-row"><span class="kv-k">Trigger</span><span class="kv-v">${skillsEvolution ? evolutionValue(skillsEvolution.trigger) : `<span class="agent-inline-muted">—</span>`}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:capabilities:visibility" ${isDetailsOpen('profile:capabilities:visibility', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Visibility profile</span>
                <span class="agent-section-hint">Surface area</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-card-grid">
                  ${renderGauge('Public visibility', agent.visibility.publicVisibility)}
                  ${renderGauge('Paper trail', agent.visibility.paperTrail)}
                  ${renderGauge('Digital hygiene', agent.visibility.digitalHygiene)}
                </div>
                <div class="agent-kv" style="margin-top:10px">
                  <div class="kv-row"><span class="kv-k">Cover aptitudes</span><span class="kv-v">${escapeHtml(agent.covers.coverAptitudeTags.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                </div>
              </div>
            </details>
          </div>
        </div>

        <!-- LIFE TAB: Habits, tastes, spaces, routines -->
        <div class="agent-tab-panel ${tab === 'life' ? 'active' : ''}" data-agent-tab-panel="life">
          <div class="agent-grid agent-grid-tight">
            <div class="agent-tab-section-title agent-card-span12">Preferences</div>
            <details class="agent-card agent-section" data-agents-details="profile:preferences:food" ${isDetailsOpen('profile:preferences:food', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Food &amp; drink</span>
                <span class="agent-section-hint">${escapeHtml(agent.preferences.food.cuisineFavorites.slice(0, 2).map(toTitleCaseWords).join(', ') || '—')}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Comfort foods</span><span class="kv-v">${escapeHtml(agent.preferences.food.comfortFoods.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Cuisines</span><span class="kv-v">${escapeHtml(agent.preferences.food.cuisineFavorites.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Taste</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.food.tastePreference))}</span></div>
                  <div class="kv-row"><span class="kv-k">Texture</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.food.texturePreference))}</span></div>
                  <div class="kv-row"><span class="kv-k">Temperature</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.food.temperaturePreference))}</span></div>
                  <div class="kv-row"><span class="kv-k">Spice</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.food.spiceTolerance))}</span></div>
                  <div class="kv-row"><span class="kv-k">Portions</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.food.portionPreference))}</span></div>
                  <div class="kv-row"><span class="kv-k">Ritual drink</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.food.ritualDrink))}</span></div>
                  <div class="kv-row"><span class="kv-k">Caffeine</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.food.caffeineHabit))}</span></div>
                  <div class="kv-row"><span class="kv-k">Alcohol</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.food.alcoholPreference))}</span></div>
                  <div class="kv-row"><span class="kv-k">Loves</span><span class="kv-v">${escapeHtml(agent.preferences.food.specificLoves.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Absolute hates</span><span class="kv-v">${escapeHtml(agent.preferences.food.absoluteHates.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Dislikes</span><span class="kv-v">${escapeHtml(agent.preferences.food.dislikes.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Restrictions</span><span class="kv-v">${escapeHtml(agent.preferences.food.restrictions.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Conditional</span><span class="kv-v">${escapeHtml(agent.preferences.food.conditionalPreferences.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:preferences:environment" ${isDetailsOpen('profile:preferences:environment', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Environment &amp; space</span>
                <span class="agent-section-hint">${escapeHtml(`${toTitleCaseWords(agent.preferences.environment.temperature)} · ${toTitleCaseWords(agent.preferences.environment.weatherMood)}`)}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Temperature</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.environment.temperature))}</span></div>
                  <div class="kv-row"><span class="kv-k">Weather mood</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.environment.weatherMood))}</span></div>
                  <div class="kv-row"><span class="kv-k">Rooms</span><span class="kv-v">${escapeHtml(agent.preferences.livingSpace.roomPreferences.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Comfort items</span><span class="kv-v">${escapeHtml(agent.preferences.livingSpace.comfortItems.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Space</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.livingSpace.spaceType))}</span></div>
                  <div class="kv-row"><span class="kv-k">Decor</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.livingSpace.decorStyle))}</span></div>
                  <div class="kv-row"><span class="kv-k">Organization</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.livingSpace.organizationStyle))}</span></div>
                  <div class="kv-row"><span class="kv-k">Security habit</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.livingSpace.securityHabit))}</span></div>
                  <div class="kv-row"><span class="kv-k">Visitors</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.livingSpace.visitorPolicy))}</span></div>
                  <div class="kv-row"><span class="kv-k">Light</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.livingSpace.lightPreference))}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:preferences:aesthetics" ${isDetailsOpen('profile:preferences:aesthetics', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Aesthetics &amp; style</span>
                <span class="agent-section-hint">${escapeHtml(agent.preferences.fashion.styleTags.slice(0, 2).map(toTitleCaseWords).join(', ') || '—')}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Style tags</span><span class="kv-v">${escapeHtml(agent.preferences.fashion.styleTags.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Formality</span><span class="kv-v">${escapeHtml(toTitleCaseWords(formatBand5(agent.preferences.fashion.formality)))}</span></div>
                  <div class="kv-row"><span class="kv-k">Conformity</span><span class="kv-v">${escapeHtml(toTitleCaseWords(formatBand5(agent.preferences.fashion.conformity)))}</span></div>
                  <div class="kv-row"><span class="kv-k">Status signaling</span><span class="kv-v">${escapeHtml(toTitleCaseWords(formatBand5(agent.preferences.fashion.statusSignaling)))}</span></div>
                  <div class="kv-row"><span class="kv-k">Palette</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.aesthetics.colorPalette))}</span></div>
                  <div class="kv-row"><span class="kv-k">Patterns</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.aesthetics.patternPreference))}</span></div>
                  <div class="kv-row"><span class="kv-k">Lighting</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.aesthetics.lightingPreference))}</span></div>
                  <div class="kv-row"><span class="kv-k">Visual complexity</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.aesthetics.visualComplexityPreference))}</span></div>
                  <div class="kv-row"><span class="kv-k">Decor</span><span class="kv-v">${escapeHtml([
                    agent.preferences.aesthetics.decorPreferences.map(toTitleCaseWords).join(', '),
                    toTitleCaseWords(agent.preferences.aesthetics.architectureStyle),
                  ].filter(Boolean).join(' · ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Soundscape</span><span class="kv-v">${escapeHtml(`${toTitleCaseWords(agent.preferences.aesthetics.soundscape)} · ${toTitleCaseWords(agent.preferences.aesthetics.noiseTolerancePreference)}`)}</span></div>
                  <div class="kv-row"><span class="kv-k">Tactile</span><span class="kv-v">${escapeHtml([
                    toTitleCaseWords(agent.preferences.aesthetics.texturePreference),
                    toTitleCaseWords(agent.preferences.aesthetics.materialPreference),
                    toTitleCaseWords(agent.preferences.aesthetics.touchPreference),
                  ].join(' · '))}</span></div>
                  <div class="kv-row"><span class="kv-k">Scents</span><span class="kv-v">${escapeHtml(`${toTitleCaseWords(agent.preferences.aesthetics.scentAttraction)} · ${toTitleCaseWords(agent.preferences.aesthetics.scentAversion)}`)}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:preferences:culture" ${isDetailsOpen('profile:preferences:culture', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Culture &amp; hobbies</span>
                <span class="agent-section-hint">${escapeHtml(agent.preferences.hobbies.primary.slice(0, 2).map(toTitleCaseWords).join(', ') || '—')}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Media genres</span><span class="kv-v">${escapeHtml(agent.preferences.media.genreTopK.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Platform diet</span><span class="kv-v">${escapeHtml(platformDietSummary)}</span></div>
                  <div class="kv-row"><span class="kv-k">Hobbies</span><span class="kv-v">${escapeHtml([...agent.preferences.hobbies.primary, ...agent.preferences.hobbies.secondary].slice(0, 6).map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Artistic mediums</span><span class="kv-v">${escapeHtml(artisticPrefs.mediums.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Artistic themes</span><span class="kv-v">${escapeHtml(artisticPrefs.themes.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Expression</span><span class="kv-v">${escapeHtml([
                    toTitleCaseWords(artisticPrefs.inspirationSource),
                    toTitleCaseWords(artisticPrefs.expressionDriver),
                    toTitleCaseWords(artisticPrefs.sharingStyle),
                  ].join(' · '))}</span></div>
                  <div class="kv-row"><span class="kv-k">Practice</span><span class="kv-v">${escapeHtml(`${toTitleCaseWords(artisticPrefs.practiceRhythm)} · ${toTitleCaseWords(artisticPrefs.workspacePreference)}`)}</span></div>
                  <div class="kv-row"><span class="kv-k">Learning mode</span><span class="kv-v">${escapeHtml(toTitleCaseWords(artisticPrefs.learningMode))}</span></div>
                  <div class="kv-row"><span class="kv-k">Challenge</span><span class="kv-v">${escapeHtml(toTitleCaseWords(artisticPrefs.challenge))}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:preferences:social" ${isDetailsOpen('profile:preferences:social', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Social &amp; communication</span>
                <span class="agent-section-hint">${escapeHtml(`${toTitleCaseWords(agent.preferences.social.groupStyle)} · ${toTitleCaseWords(agent.preferences.social.communicationMethod)}`)}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Group style</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.social.groupStyle))}</span></div>
                  <div class="kv-row"><span class="kv-k">Communication</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.social.communicationMethod))}</span></div>
                  <div class="kv-row"><span class="kv-k">Boundaries</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.social.boundary))}</span></div>
                  <div class="kv-row"><span class="kv-k">Emotional sharing</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.social.emotionalSharing))}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:preferences:work" ${isDetailsOpen('profile:preferences:work', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Work &amp; equipment</span>
                <span class="agent-section-hint">${escapeHtml(agent.preferences.work.preferredOperations.slice(0, 2).map(toTitleCaseWords).join(', ') || '—')}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Preferred ops</span><span class="kv-v">${escapeHtml(agent.preferences.work.preferredOperations.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Avoided ops</span><span class="kv-v">${escapeHtml(agent.preferences.work.avoidedOperations.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Weapon</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.equipment.weaponPreference))}</span></div>
                  <div class="kv-row"><span class="kv-k">Gear</span><span class="kv-v">${escapeHtml(agent.preferences.equipment.gearPreferences.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:preferences:quirks" ${isDetailsOpen('profile:preferences:quirks', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Quirks &amp; time</span>
                <span class="agent-section-hint">${escapeHtml(toTitleCaseWords(agent.preferences.quirks.luckyItem))}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Lucky item</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.quirks.luckyItem))}</span></div>
                  <div class="kv-row"><span class="kv-k">Rituals</span><span class="kv-v">${escapeHtml(agent.preferences.quirks.rituals.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Pet peeves</span><span class="kv-v">${escapeHtml(agent.preferences.quirks.petPeeves.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Must-haves</span><span class="kv-v">${escapeHtml(agent.preferences.quirks.mustHaves.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Daily rhythm</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.time.dailyRhythm))}</span></div>
                  <div class="kv-row"><span class="kv-k">Planning</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.time.planningStyle))}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:preferences:beats" ${isDetailsOpen('profile:preferences:beats', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Preference beats</span>
                <span class="agent-section-hint">${escapeHtml(preferenceNarrativeBeats[0] ?? '—')}</span>
              </summary>
              <div class="agent-section-body">
                ${renderBeatList(preferenceNarrativeBeats)}
              </div>
            </details>
            <div class="agent-tab-section-title agent-card-span12">Daily life</div>
            <details class="agent-card agent-section" data-agents-details="profile:daily-life:appearance" ${isDetailsOpen('profile:daily-life:appearance', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Appearance</span>
                <span class="agent-section-hint">${escapeHtml(`${toTitleCaseWords(agent.appearance.heightBand)} · ${toTitleCaseWords(agent.appearance.buildTag)}`)}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Height</span><span class="kv-v">${escapeHtml(`${agent.appearance.heightCm} cm / ${agent.appearance.heightIn} in (${toTitleCaseWords(agent.appearance.heightBand)})`)}</span></div>
                  <div class="kv-row"><span class="kv-k">Build</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.appearance.buildTag))}</span></div>
                  <div class="kv-row"><span class="kv-k">Weight</span><span class="kv-v">${escapeHtml(`${agent.appearance.weightKg} kg / ${agent.appearance.weightLb} lb`)}</span></div>
                  <div class="kv-row"><span class="kv-k">Hair</span><span class="kv-v">${escapeHtml(`${toTitleCaseWords(agent.appearance.hair.color)}, ${toTitleCaseWords(agent.appearance.hair.texture)}`)}</span></div>
                  <div class="kv-row"><span class="kv-k">Eyes</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.appearance.eyes.color))}</span></div>
                  <div class="kv-row"><span class="kv-k">Voice</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.appearance.voiceTag))}</span></div>
                  <div class="kv-row"><span class="kv-k">Marks</span><span class="kv-v">${escapeHtml(agent.appearance.distinguishingMarks.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:daily-life:routines" ${isDetailsOpen('profile:daily-life:routines', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Routines</span>
                <span class="agent-section-hint">${escapeHtml(`${toTitleCaseWords(agent.routines.chronotype)} · ${agent.routines.sleepWindow}`)}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Chronotype</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.routines.chronotype))}</span></div>
                  <div class="kv-row"><span class="kv-k">Sleep</span><span class="kv-v">${escapeHtml(agent.routines.sleepWindow)}</span></div>
                  <div class="kv-row"><span class="kv-k">Recovery rituals</span><span class="kv-v">${escapeHtml(agent.routines.recoveryRituals.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Third places</span><span class="kv-v">${escapeHtml(everydaySummary.thirdPlaces)}</span></div>
                  <div class="kv-row"><span class="kv-k">Commute</span><span class="kv-v">${escapeHtml(everydaySummary.commuteMode)}</span></div>
                  <div class="kv-row"><span class="kv-k">Weekly anchor</span><span class="kv-v">${escapeHtml(everydaySummary.weeklyAnchor)}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:daily-life:livingSpaceBeats" ${isDetailsOpen('profile:daily-life:livingSpaceBeats', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Living space beats</span>
                <span class="agent-section-hint">${escapeHtml(livingSpaceNarrativeBeats[0] ?? '—')}</span>
              </summary>
              <div class="agent-section-body">
                ${renderBeatList(livingSpaceNarrativeBeats)}
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:daily-life:health" ${isDetailsOpen('profile:daily-life:health', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Health</span>
                <span class="agent-section-hint">${escapeHtml(healthSummary.fitness)}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Chronic</span><span class="kv-v">${escapeHtml(agent.health.chronicConditionTags.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Allergies</span><span class="kv-v">${escapeHtml(agent.health.allergyTags.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Injuries</span><span class="kv-v">${escapeHtml(healthSummary.injuries)}</span></div>
                  <div class="kv-row"><span class="kv-k">Fitness</span><span class="kv-v">${escapeHtml(healthSummary.fitness)}</span></div>
                  <div class="kv-row"><span class="kv-k">Treatments</span><span class="kv-v">${escapeHtml(healthSummary.treatments)}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:daily-life:memoryTrauma" ${isDetailsOpen('profile:daily-life:memoryTrauma', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Memory &amp; trauma</span>
                <span class="agent-section-hint">${escapeHtml(memorySummary.traumaTags)}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Memories</span><span class="kv-v">${escapeHtml(memorySummary.memoryTags)}</span></div>
                  <div class="kv-row"><span class="kv-k">Trauma</span><span class="kv-v">${escapeHtml(memorySummary.traumaTags)}</span></div>
                  <div class="kv-row"><span class="kv-k">Triggers</span><span class="kv-v">${escapeHtml(memorySummary.triggerPatterns)}</span></div>
                  <div class="kv-row"><span class="kv-k">Responses</span><span class="kv-v">${escapeHtml(memorySummary.responsePatterns)}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:daily-life:vices" ${isDetailsOpen('profile:daily-life:vices', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Vices</span>
                <span class="agent-section-hint">${escapeHtml(agent.vices[0]?.vice ? toTitleCaseWords(agent.vices[0].vice) : 'None')}</span>
              </summary>
              <div class="agent-section-body">
                ${agent.vices.length
                  ? agent.vices.map(v => `
                    <div class="agent-vice-row">
                      <span class="pill">${escapeHtml(toTitleCaseWords(v.vice))}</span>
                      <span class="pill pill-muted">${escapeHtml(toTitleCaseWords(v.severity))}</span>
                      <span class="agent-vice-triggers">${escapeHtml(v.triggers.map(toTitleCaseWords).join(', '))}</span>
                    </div>
                  `).join('')
                  : `<div class="agent-muted">None</div>`}
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:daily-life:dependencies" ${isDetailsOpen('profile:daily-life:dependencies', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Dependencies</span>
                <span class="agent-section-hint">${escapeHtml(dependencyHint)}</span>
              </summary>
              <div class="agent-section-body">
                ${dependencyProfiles.length
                  ? dependencyProfiles.map(p => `
                    <div class="agent-dependency-row">
                      <span class="pill">${escapeHtml(toTitleCaseWords(p.substance))}</span>
                      <span class="pill pill-muted">${escapeHtml(toTitleCaseWords(p.stage))}</span>
                      <span class="pill pill-muted">${escapeHtml(toTitleCaseWords(p.pattern))}</span>
                      <span class="agent-dependency-meta">${escapeHtml(`${toTitleCaseWords(p.ritual)} · ${toTitleCaseWords(p.withdrawal)}`)}</span>
                      <span class="pill pill-muted">${escapeHtml(toTitleCaseWords(p.recovery))}</span>
                      <span class="pill pill-meta">${escapeHtml(toTitleCaseWords(p.riskFlag))}</span>
                    </div>
                  `).join('')
                  : `<div class="agent-muted">None</div>`}
              </div>
            </details>
          </div>
        </div>

        <!-- DATA TAB: Technical/debug info -->
        <div class="agent-tab-panel ${tab === 'data' ? 'active' : ''}" data-agent-tab-panel="data">
          <div class="agent-grid agent-grid-tight">
            <details class="agent-card agent-section" data-agents-details="profile:data:deepSim" ${isDetailsOpen('profile:data:deepSim', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Deep sim preview</span>
                <span class="agent-section-hint">${escapeHtml(`${toTitleCaseWords(preview.breakRiskBand)} break risk`)}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-card-grid">
                  ${renderMoodGauge('Mood', preview.mood01k)}
                  ${renderGauge('Stress', preview.stress01k)}
                  ${renderGauge('Fatigue', preview.fatigue01k)}
                  ${renderGauge('Break risk', preview.breakRisk01k)}
                  ${renderGauge('Sleep', preview.needs01k.sleep)}
                  ${renderGauge('Safety', preview.needs01k.safety)}
                  ${renderGauge('Belonging', preview.needs01k.belonging)}
                  ${renderGauge('Autonomy', preview.needs01k.autonomy)}
                  ${renderGauge('Competence', preview.needs01k.competence)}
                  ${renderGauge('Purpose', preview.needs01k.purpose)}
                  ${renderGauge('Comfort', preview.needs01k.comfort)}
                </div>
                <div class="agent-kv" style="margin-top:10px">
                  <div class="kv-row"><span class="kv-k">Likely breaks</span><span class="kv-v">${escapeHtml(preview.breakTypesTopK.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Thoughts</span><span class="kv-v">${escapeHtml(preview.thoughts.map(t => toTitleCaseWords(t.tag)).join(', ') || '—')}</span></div>
                </div>
              </div>
            </details>

            ${traceSection}
          </div>
        </div>
      </div>
    </div>
  `;
}
