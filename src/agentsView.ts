import { formatBand5, formatFixed01k, generateAgent, randomSeedString, type AgentPriorsV1, type AgentVocabV1, type Band5, type GeneratedAgent, type KnowledgeItem, type TierBand } from './agent';
import { renderCognitiveCard, renderCognitiveSection } from './agent/cognitiveSection';
import { renderCognitiveTabButton, renderCognitiveTabPanel } from './agent/cognitiveTab';
import { isAgentProfileTab, type AgentProfileTab } from './agent/profileTabs';
import { renderKnowledgeEntryList } from './agent/knowledgeEntry';
import { generateNarrative, pronounSetToMode } from './agentNarration';
import { buildHealthSummary } from './agent/healthSummary';
import { buildEverydayLifeSummary, buildMemoryTraumaSummary } from './agent/lifestyleSummary';

type RosterItem = {
  id: string;
  name: string;
  seed: string;
  createdAtIso: string;
  agent?: GeneratedAgent;
};

const ROSTER_STORAGE_KEY = 'swp.agents.roster.v1';
const COGNITIVE_DETAILS_KEY = 'profile:cognitive:details';

let agentVocabPromise: Promise<AgentVocabV1> | null = null;
let agentPriorsPromise: Promise<AgentPriorsV1> | null = null;
let shadowCountryMapPromise: Promise<Array<{ real: string; shadow: string; iso3?: string; continent?: string }>> | null = null;

function getAgentVocabV1(): Promise<AgentVocabV1> {
  if (agentVocabPromise) return agentVocabPromise;
  agentVocabPromise = (async () => {
    const res = await fetch('agent-vocab.v1.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load agent vocab (${res.status})`);
    const parsed = (await res.json()) as unknown;
    if (!parsed || typeof parsed !== 'object') throw new Error('Agent vocab JSON is not an object');
    const version = (parsed as { version?: unknown }).version;
    if (version !== 1) throw new Error(`Unsupported agent vocab version: ${String(version)}`);
    return parsed as AgentVocabV1;
  })();
  return agentVocabPromise;
}

function getAgentPriorsV1(): Promise<AgentPriorsV1> {
  if (agentPriorsPromise) return agentPriorsPromise;
  agentPriorsPromise = (async () => {
    const res = await fetch('agent-priors.v1.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load agent priors (${res.status})`);
    const parsed = (await res.json()) as unknown;
    if (!parsed || typeof parsed !== 'object') throw new Error('Agent priors JSON is not an object');
    const version = (parsed as { version?: unknown }).version;
    if (version !== 1) throw new Error(`Unsupported agent priors version: ${String(version)}`);
    return parsed as AgentPriorsV1;
  })();
  return agentPriorsPromise;
}

function getShadowCountryMap(): Promise<Array<{ real: string; shadow: string; iso3?: string; continent?: string }>> {
  if (shadowCountryMapPromise) return shadowCountryMapPromise;
  shadowCountryMapPromise = (async () => {
    const res = await fetch('shadow-country-map.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load shadow country map (${res.status})`);
    const parsed = (await res.json()) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Shadow country map JSON is not an array');
    return parsed as Array<{ real: string; shadow: string; iso3?: string; continent?: string }>;
  })();
  return shadowCountryMapPromise;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function loadRoster(): RosterItem[] {
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RosterItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(x =>
      x &&
      typeof x === 'object' &&
      typeof (x as { id?: unknown }).id === 'string' &&
      typeof (x as { seed?: unknown }).seed === 'string' &&
      typeof (x as { name?: unknown }).name === 'string'
    );
  } catch {
    return [];
  }
}

function saveRoster(items: RosterItem[]) {
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(items));
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toTitleCaseWords(input: string): string {
  const normalized = input
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!normalized) return normalized;

  const words = normalized.split(' ');
  const mapped = words.map((word) => {
    const w = word.toLowerCase();
    if (w === 'tv') return 'TV';
    if (w === 'ai') return 'AI';
    if (w === 'opsec') return 'OPSEC';
    if (w === 'df') return 'DF';
    if (w === 'r&d') return 'R&D';
    if (w === 'sci' || w === 'sci-fi' || w === 'scifi') return 'Sci-Fi';
    return w.charAt(0).toUpperCase() + w.slice(1);
  });

  // If we normalized sci-fi into two tokens ("Sci" "Fi"), stitch it back.
  return mapped.join(' ').replace(/\bSci Fi\b/g, 'Sci-Fi');
}

function displayLanguageCode(codeRaw: string): string {
  const code = codeRaw.trim().toLowerCase();
  if (!code) return codeRaw;
  // Prefer Intl when available; fall back to code.
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'language' });
    const name = dn.of(code);
    return name ? toTitleCaseWords(name) : code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function humanizeAgentForExport(agent: GeneratedAgent, shadowByIso3?: ReadonlyMap<string, { shadow: string; continent?: string }>): unknown {
  const { generationTrace: _generationTrace, ...agentWithoutTrace } = agent;
  const platformDiet: Record<string, number> = {};
  for (const [k, v] of Object.entries(agent.preferences.media.platformDiet)) {
    platformDiet[toTitleCaseWords(k)] = v;
  }

  const homeShadow = shadowByIso3?.get(agent.identity.homeCountryIso3)?.shadow ?? null;
  const citizenshipShadow = shadowByIso3?.get(agent.identity.citizenshipCountryIso3)?.shadow ?? null;
  const currentShadow = shadowByIso3?.get(agent.identity.currentCountryIso3)?.shadow ?? null;

  return {
    ...agentWithoutTrace,
    identity: {
      ...agent.identity,
      homeCountryShadow: homeShadow,
      citizenshipCountryShadow: citizenshipShadow,
      currentCountryShadow: currentShadow,
      tierBand: toTitleCaseWords(agent.identity.tierBand),
      roleSeedTags: agent.identity.roleSeedTags.map(toTitleCaseWords),
      educationTrackTag: toTitleCaseWords(agent.identity.educationTrackTag),
      careerTrackTag: toTitleCaseWords(agent.identity.careerTrackTag),
      redLines: agent.identity.redLines.map(toTitleCaseWords),
      languages: agent.identity.languages.map(displayLanguageCode),
      languageProficiencies: agent.identity.languageProficiencies.map(lp => ({
        ...lp,
        language: displayLanguageCode(lp.language),
        proficiencyBand: toTitleCaseWords(lp.proficiencyBand),
      })),
    },
    deepSimPreview: {
      ...agent.deepSimPreview,
      breakRiskBand: toTitleCaseWords(agent.deepSimPreview.breakRiskBand),
      breakTypesTopK: agent.deepSimPreview.breakTypesTopK.map(toTitleCaseWords),
      thoughts: agent.deepSimPreview.thoughts.map(t => ({
        ...t,
        tag: toTitleCaseWords(t.tag),
        source: toTitleCaseWords(t.source),
      })),
    },
    appearance: {
      ...agent.appearance,
      heightBand: toTitleCaseWords(agent.appearance.heightBand),
      buildTag: toTitleCaseWords(agent.appearance.buildTag),
      hair: {
        color: toTitleCaseWords(agent.appearance.hair.color),
        texture: toTitleCaseWords(agent.appearance.hair.texture),
      },
      eyes: { color: toTitleCaseWords(agent.appearance.eyes.color) },
      voiceTag: toTitleCaseWords(agent.appearance.voiceTag),
      distinguishingMarks: agent.appearance.distinguishingMarks.map(toTitleCaseWords),
    },
    preferences: {
      ...agent.preferences,
      food: {
        ...agent.preferences.food,
        comfortFoods: agent.preferences.food.comfortFoods.map(toTitleCaseWords),
        dislikes: agent.preferences.food.dislikes.map(toTitleCaseWords),
        restrictions: agent.preferences.food.restrictions.map(toTitleCaseWords),
        ritualDrink: toTitleCaseWords(agent.preferences.food.ritualDrink),
      },
      media: {
        ...agent.preferences.media,
        platformDiet,
        genreTopK: agent.preferences.media.genreTopK.map(toTitleCaseWords),
      },
      fashion: {
        ...agent.preferences.fashion,
        styleTags: agent.preferences.fashion.styleTags.map(toTitleCaseWords),
      },
      environment: {
        temperature: toTitleCaseWords(agent.preferences.environment.temperature),
        weatherMood: toTitleCaseWords(agent.preferences.environment.weatherMood),
      },
      livingSpace: {
        roomPreferences: agent.preferences.livingSpace.roomPreferences.map(toTitleCaseWords),
        comfortItems: agent.preferences.livingSpace.comfortItems.map(toTitleCaseWords),
      },
      social: {
        groupStyle: toTitleCaseWords(agent.preferences.social.groupStyle),
        communicationMethod: toTitleCaseWords(agent.preferences.social.communicationMethod),
        boundary: toTitleCaseWords(agent.preferences.social.boundary),
        emotionalSharing: toTitleCaseWords(agent.preferences.social.emotionalSharing),
      },
      work: {
        preferredOperations: agent.preferences.work.preferredOperations.map(toTitleCaseWords),
        avoidedOperations: agent.preferences.work.avoidedOperations.map(toTitleCaseWords),
      },
      equipment: {
        weaponPreference: toTitleCaseWords(agent.preferences.equipment.weaponPreference),
        gearPreferences: agent.preferences.equipment.gearPreferences.map(toTitleCaseWords),
      },
      quirks: {
        luckyItem: toTitleCaseWords(agent.preferences.quirks.luckyItem),
        rituals: agent.preferences.quirks.rituals.map(toTitleCaseWords),
        petPeeves: agent.preferences.quirks.petPeeves.map(toTitleCaseWords),
        mustHaves: agent.preferences.quirks.mustHaves.map(toTitleCaseWords),
      },
      time: {
        dailyRhythm: toTitleCaseWords(agent.preferences.time.dailyRhythm),
        planningStyle: toTitleCaseWords(agent.preferences.time.planningStyle),
      },
    },
    psych: {
      traits: {
        riskTolerance: agent.psych.traits.riskTolerance,
        conscientiousness: agent.psych.traits.conscientiousness,
        noveltySeeking: agent.psych.traits.noveltySeeking,
        agreeableness: agent.psych.traits.agreeableness,
        authoritarianism: agent.psych.traits.authoritarianism,
      },
    },
    visibility: {
      publicVisibility: agent.visibility.publicVisibility,
      paperTrail: agent.visibility.paperTrail,
      digitalHygiene: agent.visibility.digitalHygiene,
    },
    health: {
      chronicConditionTags: agent.health.chronicConditionTags.map(toTitleCaseWords),
      allergyTags: agent.health.allergyTags.map(toTitleCaseWords),
      injuryHistoryTags: agent.health.injuryHistoryTags.map(toTitleCaseWords),
      diseaseTags: agent.health.diseaseTags.map(toTitleCaseWords),
      fitnessBand: toTitleCaseWords(agent.health.fitnessBand),
      treatmentTags: agent.health.treatmentTags.map(toTitleCaseWords),
    },
    everydayLife: {
      thirdPlaces: agent.everydayLife.thirdPlaces.map(toTitleCaseWords),
      commuteMode: toTitleCaseWords(agent.everydayLife.commuteMode),
      weeklyAnchor: toTitleCaseWords(agent.everydayLife.weeklyAnchor),
      pettyHabits: agent.everydayLife.pettyHabits.map(toTitleCaseWords),
      caregivingObligation: toTitleCaseWords(agent.everydayLife.caregivingObligation),
    },
    memoryTrauma: {
      memoryTags: agent.memoryTrauma.memoryTags.map(toTitleCaseWords),
      traumaTags: agent.memoryTrauma.traumaTags.map(toTitleCaseWords),
      triggerPatterns: agent.memoryTrauma.triggerPatterns.map(toTitleCaseWords),
      responsePatterns: agent.memoryTrauma.responsePatterns.map(toTitleCaseWords),
    },
    covers: {
      coverAptitudeTags: agent.covers.coverAptitudeTags.map(toTitleCaseWords),
    },
    mobility: {
      ...agent.mobility,
      passportAccessBand: toTitleCaseWords(agent.mobility.passportAccessBand),
      mobilityTag: toTitleCaseWords(agent.mobility.mobilityTag),
      travelFrequencyBand: toTitleCaseWords(agent.mobility.travelFrequencyBand),
    },
    routines: {
      ...agent.routines,
      chronotype: toTitleCaseWords(agent.routines.chronotype),
      recoveryRituals: agent.routines.recoveryRituals.map(toTitleCaseWords),
    },
    vices: agent.vices.map(v => ({
      ...v,
      vice: toTitleCaseWords(v.vice),
      severity: toTitleCaseWords(v.severity),
      triggers: v.triggers.map(toTitleCaseWords),
    })),
    logistics: {
      identityKit: agent.logistics.identityKit.map(i => ({
        ...i,
        item: toTitleCaseWords(i.item),
        security: toTitleCaseWords(i.security),
      })),
    },
  };
}

async function copyJsonToClipboard(value: unknown): Promise<boolean> {
  const text = JSON.stringify(value, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for restricted clipboard contexts.
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function readSeedFromHash(): string | null {
  const hash = window.location.hash;
  const m = hash.match(/^#\/agents\/([^?]+)(?:\?(.*))?$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1] ?? '').trim() || null;
  } catch {
    return (m[1] ?? '').trim() || null;
  }
}

function readAgentsParamsFromHash(): URLSearchParams {
  const hash = window.location.hash;
  const m = hash.match(/^#\/agents\/[^?]+(?:\?(.*))?$/);
  if (!m) return new URLSearchParams();
  return new URLSearchParams(m[1] ?? '');
}

function setShareHash(seed: string, opts?: { asOfYear?: number; homeCountryIso3?: string | null }) {
  const params = new URLSearchParams();
  const asOf = opts?.asOfYear;
  if (typeof asOf === 'number' && Number.isFinite(asOf) && asOf !== 2025) params.set('asOf', String(Math.round(asOf)));
  const home = (opts?.homeCountryIso3 ?? '').trim();
  if (home) params.set('home', home.toUpperCase());
  const qs = params.toString();
  window.location.hash = `#/agents/${encodeURIComponent(seed)}${qs ? `?${qs}` : ''}`;
}

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

function setTemporaryButtonLabel(btn: HTMLButtonElement, nextLabel: string, ms = 1200) {
  const prev = btn.textContent ?? '';
  btn.textContent = nextLabel;
  btn.disabled = true;
  window.setTimeout(() => {
    btn.textContent = prev;
    btn.disabled = false;
  }, ms);
}

type DetailsOpenReader = (key: string, defaultOpen: boolean) => boolean;

function renderAgent(
  agent: GeneratedAgent,
  shadowByIso3: ReadonlyMap<string, { shadow: string; continent?: string }>,
  tab: AgentProfileTab,
  isDetailsOpen: DetailsOpenReader,
  asOfYear: number,
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
  const healthSummary = buildHealthSummary(agent.health, toTitleCaseWords);
  const everydaySummary = buildEverydayLifeSummary(agent.everydayLife, toTitleCaseWords);
  const memorySummary = buildMemoryTraumaSummary(agent.memoryTrauma, toTitleCaseWords);

  const platformDiet = Object.entries(agent.preferences.media.platformDiet)
    .map(([k, v]) => `<li><span class="kv-k">${escapeHtml(toTitleCaseWords(k))}</span><span class="kv-v">${escapeHtml(formatFixed01k(v))}</span></li>`)
    .join('');

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
      return renderKnowledgeEntryList(entries, []);
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

  const topThoughts = [...preview.thoughts]
    .slice()
    .sort((a, b) => (b.intensity01k - a.intensity01k) || a.tag.localeCompare(b.tag))
    .slice(0, 3);
  const thoughtsPills = topThoughts.length
    ? `<span class="agent-pill-wrap">${topThoughts.map(t => `<span class="pill pill-muted">${escapeHtml(toTitleCaseWords(t.tag))}</span>`).join('')}</span>`
    : `<span class="agent-inline-muted">—</span>`;

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
          <button type="button" class="agent-tab-btn ${tab === 'overview' ? 'active' : ''}" data-agent-tab="overview">Overview</button>
          ${renderCognitiveTabButton(tab === 'cognitive')}
          <button type="button" class="agent-tab-btn ${tab === 'performance' ? 'active' : ''}" data-agent-tab="performance">Performance</button>
          <button type="button" class="agent-tab-btn ${tab === 'lifestyle' ? 'active' : ''}" data-agent-tab="lifestyle">Lifestyle</button>
          <button type="button" class="agent-tab-btn ${tab === 'constraints' ? 'active' : ''}" data-agent-tab="constraints">Constraints</button>
          <button type="button" class="agent-tab-btn ${tab === 'debug' ? 'active' : ''}" data-agent-tab="debug">Debug</button>
        </div>
      </div>

      <div class="agent-tab-panels">
        <div class="agent-tab-panel ${tab === 'overview' ? 'active' : ''}" data-agent-tab-panel="overview">
          <div class="agent-grid agent-grid-tight">
            <section class="agent-card agent-card-span12">
              <h3>Overview</h3>
              ${narrative}
            </section>

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
              <h4 style="margin-top:0.75rem;font-size:0.85rem;color:#888">Character arc</h4>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Origin</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.identity.originTierBand))} → ${escapeHtml(toTitleCaseWords(agent.identity.tierBand))} ${agent.identity.socioeconomicMobility === 'upward' ? '↑' : agent.identity.socioeconomicMobility === 'downward' ? '↓' : '→'}</span></div>
                <div class="kv-row"><span class="kv-k">Network</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.network.role))} · ${escapeHtml(agent.network.leverageType)}</span></div>
                ${agent.eliteCompensators.length ? `<div class="kv-row"><span class="kv-k">Compensators</span><span class="kv-v">${escapeHtml(agent.eliteCompensators.map(toTitleCaseWords).join(', '))}</span></div>` : ''}
              </div>
              <h4 style="margin-top:0.75rem;font-size:0.85rem;color:#888">Identity & beliefs</h4>
              <div class="agent-kv">
                ${!['cisgender-man', 'cisgender-woman'].includes(agent.gender.identityTag) ? `<div class="kv-row"><span class="kv-k">Gender</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.gender.identityTag))} (${escapeHtml(agent.gender.pronounSet)})</span></div>` : ''}
                <div class="kv-row"><span class="kv-k">Pronouns</span><span class="kv-v">${escapeHtml(agent.gender.pronounSet)}</span></div>
                ${agent.orientation.orientationTag !== 'straight' ? `<div class="kv-row"><span class="kv-k">Orientation</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.orientation.orientationTag))} (${escapeHtml(toTitleCaseWords(agent.orientation.outnessLevel))})</span></div>` : ''}
                <div class="kv-row"><span class="kv-k">Spirituality</span><span class="kv-v">${agent.spirituality.tradition !== 'none' ? `${escapeHtml(toTitleCaseWords(agent.spirituality.tradition))} - ` : ''}${escapeHtml(toTitleCaseWords(agent.spirituality.affiliationTag))} (${escapeHtml(toTitleCaseWords(agent.spirituality.observanceLevel))})</span></div>
                ${agent.neurodivergence.indicatorTags.length && !agent.neurodivergence.indicatorTags.includes('neurotypical') ? `<div class="kv-row"><span class="kv-k">Neurodivergence</span><span class="kv-v">${escapeHtml(agent.neurodivergence.indicatorTags.map(toTitleCaseWords).join(', '))}</span></div>` : ''}
              </div>
              <h4 style="margin-top:0.75rem;font-size:0.85rem;color:#888">Culture axes</h4>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Heritage</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.culture.ethnolinguistic))} <span style="color:#666">(${Math.round(agent.culture.weights.ethnolinguistic / 10)}%)</span></span></div>
                <div class="kv-row"><span class="kv-k">Regional</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.culture.regional))} <span style="color:#666">(${Math.round(agent.culture.weights.regional / 10)}%)</span></span></div>
                <div class="kv-row"><span class="kv-k">Institutional</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.culture.institutional))} <span style="color:#666">(${Math.round(agent.culture.weights.institutional / 10)}%)</span></span></div>
              </div>
              <h4 style="margin-top:0.75rem;font-size:0.85rem;color:#888">Geography & family</h4>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Urbanicity</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.geography.urbanicity))}</span></div>
                <div class="kv-row"><span class="kv-k">Diaspora</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.geography.diasporaStatus))}</span></div>
                <div class="kv-row"><span class="kv-k">Marital</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.family.maritalStatus))}${agent.family.dependentCount > 0 ? ` · ${agent.family.dependentCount} dependent${agent.family.dependentCount > 1 ? 's' : ''}` : ''}</span></div>
                ${agent.minorityStatus.visibleMinority || agent.minorityStatus.linguisticMinority || agent.minorityStatus.religiousMinority ? `<div class="kv-row"><span class="kv-k">Minority</span><span class="kv-v">${[agent.minorityStatus.visibleMinority ? 'visible' : '', agent.minorityStatus.linguisticMinority ? 'linguistic' : '', agent.minorityStatus.religiousMinority ? 'religious' : ''].filter(Boolean).join(', ')}</span></div>` : ''}
              </div>
              <h4 style="margin-top:0.75rem;font-size:0.85rem;color:#888">Institution</h4>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Org</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.institution.orgType))}</span></div>
                <div class="kv-row"><span class="kv-k">Grade</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.institution.gradeBand))} · ${agent.institution.yearsInService}y</span></div>
                <div class="kv-row"><span class="kv-k">Clearance</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.institution.clearanceBand))}</span></div>
                <div class="kv-row"><span class="kv-k">Function</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.institution.functionalSpecialization))}</span></div>
              </div>
            </section>

            <section class="agent-card agent-card-span6">
              <h3>Highlights</h3>
              <div class="agent-mini">
                <div class="agent-mini-title">Top skills</div>
                <div class="agent-mini-list">${topSkillList || `<div class="agent-inline-muted">—</div>`}</div>
                <div class="agent-mini-title" style="margin-top:0.75rem">Top aptitudes</div>
                <div class="agent-mini-list">${topAptitudeList || `<div class="agent-inline-muted">—</div>`}</div>
              </div>
              <h4 style="margin-top:0.75rem;font-size:0.85rem;color:#888">Personality</h4>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Conflict</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.personality.conflictStyle))}</span></div>
                <div class="kv-row"><span class="kv-k">Epistemic</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.personality.epistemicStyle))}</span></div>
                <div class="kv-row"><span class="kv-k">Social</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.personality.socialEnergy))}</span></div>
                <div class="kv-row"><span class="kv-k">Risk</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.personality.riskPosture))}</span></div>
              </div>
              <h4 style="margin-top:0.75rem;font-size:0.85rem;color:#888">Work style</h4>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Writing</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.workStyle.writingStyle))}</span></div>
                <div class="kv-row"><span class="kv-k">Briefing</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.workStyle.briefingStyle))}</span></div>
                <div class="kv-row"><span class="kv-k">Confidence</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.workStyle.confidenceCalibration))}</span></div>
              </div>
              <h4 style="margin-top:0.75rem;font-size:0.85rem;color:#888">Conversation topics</h4>
              <div class="agent-kv">
                <div class="kv-row"><span class="kv-k">Talks about</span><span class="kv-v">${conversationPills}</span></div>
              </div>
            </section>

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
                <div class="kv-row"><span class="kv-k">Origin story</span><span class="kv-v">${escapeHtml(economicMobility.originStory || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Pattern</span><span class="kv-v">${escapeHtml(economicMobility.mobilityPattern || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Driver</span><span class="kv-v">${escapeHtml(economicMobility.moneyDriver || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Personality</span><span class="kv-v">${escapeHtml(economicMobility.moneyPersonality || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Class navigation</span><span class="kv-v">${escapeHtml(economicMobility.classNavigation || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Retirement</span><span class="kv-v">${escapeHtml(economicMobility.retirementMode || '—')}</span></div>
              </div>
            </section>

            ${agent.relationships.length ? `
            <section class="agent-card agent-card-span6">
              <h3>Key relationships</h3>
              <div class="agent-kv">
                ${agent.relationships.slice(0, 4).map(r => `
                  <div class="kv-row"><span class="kv-k">${escapeHtml(toTitleCaseWords(r.type))}</span><span class="kv-v">${escapeHtml(r.description)}</span></div>
                `).join('')}
              </div>
            </section>
            ` : ''}

            ${agent.timeline.length ? `
            <section class="agent-card agent-card-span6">
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

            <section class="agent-card agent-card-span12">
              <h3>Deep sim preview</h3>
              <div class="agent-card-grid">
                ${renderMoodGauge('Mood', preview.mood01k)}
                ${renderGauge('Stress', preview.stress01k)}
                ${renderGauge('Fatigue', preview.fatigue01k)}
                ${renderGauge('Break risk', preview.breakRisk01k)}
              </div>
              <div class="agent-kv" style="margin-top:10px">
                <div class="kv-row"><span class="kv-k">Likely breaks</span><span class="kv-v">${escapeHtml(preview.breakTypesTopK.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                <div class="kv-row"><span class="kv-k">Top thoughts</span><span class="kv-v">${thoughtsPills}</span></div>
              </div>
              <details class="agent-inline-details" data-agents-details="profile:overview:needs" ${isDetailsOpen('profile:overview:needs', false) ? 'open' : ''}>
                <summary>Show needs</summary>
                <div class="agent-card-grid" style="margin-top:0.75rem">
                  ${renderGauge('Sleep', preview.needs01k.sleep)}
                  ${renderGauge('Safety', preview.needs01k.safety)}
                  ${renderGauge('Belonging', preview.needs01k.belonging)}
                  ${renderGauge('Autonomy', preview.needs01k.autonomy)}
                  ${renderGauge('Competence', preview.needs01k.competence)}
                  ${renderGauge('Purpose', preview.needs01k.purpose)}
                  ${renderGauge('Comfort', preview.needs01k.comfort)}
                </div>
              </details>
            </section>
          </div>
        </div>

        ${renderCognitiveTabPanel(tab === 'cognitive', renderCognitiveSection(cognitiveCards, cognitiveDetailsOpen))}

        <div class="agent-tab-panel ${tab === 'performance' ? 'active' : ''}" data-agent-tab-panel="performance">
          <div class="agent-grid agent-grid-tight">
            <details class="agent-card agent-section" data-agents-details="profile:performance:capabilities" ${isDetailsOpen('profile:performance:capabilities', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Capabilities</span>
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

            <details class="agent-card agent-section" data-agents-details="profile:performance:skills" ${isDetailsOpen('profile:performance:skills', true) ? 'open' : ''}>
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
          </div>
        </div>

        <div class="agent-tab-panel ${tab === 'lifestyle' ? 'active' : ''}" data-agent-tab-panel="lifestyle">
          <div class="agent-grid agent-grid-tight">
            <details class="agent-card agent-section" data-agents-details="profile:lifestyle:preferences" ${isDetailsOpen('profile:lifestyle:preferences', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Preferences</span>
                <span class="agent-section-hint">${escapeHtml(agent.preferences.fashion.styleTags.slice(0, 2).map(toTitleCaseWords).join(', ') || '—')}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Comfort foods</span><span class="kv-v">${escapeHtml(agent.preferences.food.comfortFoods.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Dislikes</span><span class="kv-v">${escapeHtml(agent.preferences.food.dislikes.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Restrictions</span><span class="kv-v">${escapeHtml(agent.preferences.food.restrictions.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Ritual drink</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.food.ritualDrink))}</span></div>
                  <div class="kv-row"><span class="kv-k">Genres</span><span class="kv-v">${escapeHtml(agent.preferences.media.genreTopK.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Style</span><span class="kv-v">${escapeHtml(agent.preferences.fashion.styleTags.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Temperature</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.environment.temperature))}</span></div>
                  <div class="kv-row"><span class="kv-k">Weather mood</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.environment.weatherMood))}</span></div>
                  <div class="kv-row"><span class="kv-k">Room prefs</span><span class="kv-v">${escapeHtml(agent.preferences.livingSpace.roomPreferences.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Comfort items</span><span class="kv-v">${escapeHtml(agent.preferences.livingSpace.comfortItems.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Group style</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.social.groupStyle))}</span></div>
                  <div class="kv-row"><span class="kv-k">Communication</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.social.communicationMethod))}</span></div>
                  <div class="kv-row"><span class="kv-k">Boundaries</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.social.boundary))}</span></div>
                  <div class="kv-row"><span class="kv-k">Emotional sharing</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.social.emotionalSharing))}</span></div>
                  <div class="kv-row"><span class="kv-k">Preferred ops</span><span class="kv-v">${escapeHtml(agent.preferences.work.preferredOperations.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Avoided ops</span><span class="kv-v">${escapeHtml(agent.preferences.work.avoidedOperations.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Weapon</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.equipment.weaponPreference))}</span></div>
                  <div class="kv-row"><span class="kv-k">Gear prefs</span><span class="kv-v">${escapeHtml(agent.preferences.equipment.gearPreferences.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Lucky item</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.quirks.luckyItem))}</span></div>
                  <div class="kv-row"><span class="kv-k">Rituals</span><span class="kv-v">${escapeHtml(agent.preferences.quirks.rituals.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Pet peeves</span><span class="kv-v">${escapeHtml(agent.preferences.quirks.petPeeves.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Must-haves</span><span class="kv-v">${escapeHtml(agent.preferences.quirks.mustHaves.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Daily rhythm</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.time.dailyRhythm))}</span></div>
                  <div class="kv-row"><span class="kv-k">Planning style</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.time.planningStyle))}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:lifestyle:media" ${isDetailsOpen('profile:lifestyle:media', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Media</span>
                <span class="agent-section-hint">${escapeHtml(agent.preferences.media.genreTopK.slice(0, 2).map(toTitleCaseWords).join(', ') || '—')}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-card-grid">
                  ${renderGauge('Attention resilience', agent.preferences.media.attentionResilience)}
                  ${renderGauge('Doomscrolling risk', agent.preferences.media.doomscrollingRisk)}
                  ${renderGauge('Epistemic hygiene', agent.preferences.media.epistemicHygiene)}
                </div>
                <ul class="agent-kv-list">${platformDiet}</ul>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:lifestyle:routines" ${isDetailsOpen('profile:lifestyle:routines', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Routines</span>
                <span class="agent-section-hint">${escapeHtml(`${toTitleCaseWords(agent.routines.chronotype)} · ${agent.routines.sleepWindow}`)}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Chronotype</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.routines.chronotype))}</span></div>
                  <div class="kv-row"><span class="kv-k">Sleep</span><span class="kv-v">${escapeHtml(agent.routines.sleepWindow)}</span></div>
                  <div class="kv-row"><span class="kv-k">Recovery rituals</span><span class="kv-v">${escapeHtml(agent.routines.recoveryRituals.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:lifestyle:everydayLife" ${isDetailsOpen('profile:lifestyle:everydayLife', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Everyday life</span>
                <span class="agent-section-hint">${escapeHtml(everydaySummary.commuteMode)}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Third places</span><span class="kv-v">${escapeHtml(everydaySummary.thirdPlaces)}</span></div>
                  <div class="kv-row"><span class="kv-k">Commute</span><span class="kv-v">${escapeHtml(everydaySummary.commuteMode)}</span></div>
                  <div class="kv-row"><span class="kv-k">Weekly anchor</span><span class="kv-v">${escapeHtml(everydaySummary.weeklyAnchor)}</span></div>
                  <div class="kv-row"><span class="kv-k">Petty habits</span><span class="kv-v">${escapeHtml(everydaySummary.pettyHabits)}</span></div>
                  <div class="kv-row"><span class="kv-k">Caregiving</span><span class="kv-v">${escapeHtml(everydaySummary.caregivingObligation)}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:lifestyle:appearance" ${isDetailsOpen('profile:lifestyle:appearance', false) ? 'open' : ''}>
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

            <details class="agent-card agent-section" data-agents-details="profile:lifestyle:memoryTrauma" ${isDetailsOpen('profile:lifestyle:memoryTrauma', false) ? 'open' : ''}>
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
          </div>
        </div>

        <div class="agent-tab-panel ${tab === 'constraints' ? 'active' : ''}" data-agent-tab-panel="constraints">
          <div class="agent-grid agent-grid-tight">
            <details class="agent-card agent-section" data-agents-details="profile:constraints:traits" ${isDetailsOpen('profile:constraints:traits', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Traits</span>
                <span class="agent-section-hint">Disposition</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-card-grid">
                  ${renderGauge('Risk tolerance', agent.psych.traits.riskTolerance)}
                  ${renderGauge('Conscientiousness', agent.psych.traits.conscientiousness)}
                  ${renderGauge('Novelty seeking', agent.psych.traits.noveltySeeking)}
                  ${renderGauge('Agreeableness', agent.psych.traits.agreeableness)}
                  ${renderGauge('Authoritarianism', agent.psych.traits.authoritarianism)}
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:constraints:ethics" ${isDetailsOpen('profile:constraints:ethics', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Ethics</span>
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

            <details class="agent-card agent-section" data-agents-details="profile:constraints:visibility" ${isDetailsOpen('profile:constraints:visibility', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Visibility</span>
                <span class="agent-section-hint">Surface area</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-card-grid">
                  ${renderGauge('Public visibility', agent.visibility.publicVisibility)}
                  ${renderGauge('Paper trail', agent.visibility.paperTrail)}
                  ${renderGauge('Digital hygiene', agent.visibility.digitalHygiene)}
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:constraints:constraints" ${isDetailsOpen('profile:constraints:constraints', true) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Constraints</span>
                <span class="agent-section-hint">${escapeHtml(agent.identity.redLines.slice(0, 2).map(toTitleCaseWords).join(', ') || '—')}</span>
              </summary>
              <div class="agent-section-body">
                <div class="agent-kv">
                  <div class="kv-row"><span class="kv-k">Red lines</span><span class="kv-v">${escapeHtml(agent.identity.redLines.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Chronic</span><span class="kv-v">${escapeHtml(agent.health.chronicConditionTags.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Allergies</span><span class="kv-v">${escapeHtml(agent.health.allergyTags.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                  <div class="kv-row"><span class="kv-k">Injuries</span><span class="kv-v">${escapeHtml(healthSummary.injuries)}</span></div>
                  <div class="kv-row"><span class="kv-k">Diseases</span><span class="kv-v">${escapeHtml(healthSummary.diseases)}</span></div>
                  <div class="kv-row"><span class="kv-k">Fitness</span><span class="kv-v">${escapeHtml(healthSummary.fitness)}</span></div>
                  <div class="kv-row"><span class="kv-k">Treatments</span><span class="kv-v">${escapeHtml(healthSummary.treatments)}</span></div>
                  <div class="kv-row"><span class="kv-k">Cover aptitudes</span><span class="kv-v">${escapeHtml(agent.covers.coverAptitudeTags.map(toTitleCaseWords).join(', ') || '—')}</span></div>
                </div>
              </div>
            </details>

            <details class="agent-card agent-section" data-agents-details="profile:constraints:vices" ${isDetailsOpen('profile:constraints:vices', false) ? 'open' : ''}>
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

            <details class="agent-card agent-section" data-agents-details="profile:constraints:deepSimDetails" ${isDetailsOpen('profile:constraints:deepSimDetails', false) ? 'open' : ''}>
              <summary class="agent-section-summary">
                <span class="agent-section-title">Deep sim details</span>
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
          </div>
        </div>

        <div class="agent-tab-panel ${tab === 'debug' ? 'active' : ''}" data-agent-tab-panel="debug">
          <div class="agent-grid agent-grid-tight">
            ${traceSection}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initializeAgentsView(container: HTMLElement) {
  let roster = loadRoster();
  let selectedRosterId: string | null = roster[0]?.id ?? null;
  let activeAgent: GeneratedAgent | null = null;
  let agentVocab: AgentVocabV1 | null = null;
  let agentVocabError: string | null = null;
  let agentPriors: AgentPriorsV1 | null = null;
  let agentPriorsError: string | null = null;
  let shadowCountries: Array<{ shadow: string; iso3: string; continent?: string }> | null = null;
  let shadowCountriesError: string | null = null;
  let shadowByIso3 = new Map<string, { shadow: string; continent?: string }>();
  let useOverrides = false;
  let overrideRoleTags: string[] = [];
  let asOfYear = 2025;
  let homeCountryMode: 'random' | 'fixed' = 'random';
  let homeCountryIso3: string | null = null;
  let seedDraft = roster.find(x => x.id === selectedRosterId)?.seed ?? '';
  let pendingHashSeed: string | null = readSeedFromHash();
  let pendingHashParams: URLSearchParams | null = pendingHashSeed ? readAgentsParamsFromHash() : null;

  const PROFILE_TAB_KEY = 'agentsProfileTab:v1';
  const readProfileTab = (): AgentProfileTab | null => {
    try {
      const raw = window.localStorage.getItem(PROFILE_TAB_KEY);
      if (!raw) return null;
      if (isAgentProfileTab(raw)) return raw;
      return null;
    } catch {
      return null;
    }
  };
  const writeProfileTab = (next: AgentProfileTab) => {
    try {
      window.localStorage.setItem(PROFILE_TAB_KEY, next);
    } catch {
      // ignore
    }
  };
  let profileTab: AgentProfileTab = readProfileTab() ?? 'overview';

  const DETAILS_OPEN_KEY = 'agentsDetailsOpen:v1';
  type DetailsOpenMap = Record<string, boolean>;
  const readDetailsOpen = (): DetailsOpenMap => {
    try {
      const raw = window.localStorage.getItem(DETAILS_OPEN_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};
      const out: DetailsOpenMap = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'boolean') out[String(k)] = v;
      }
      return out;
    } catch {
      return {};
    }
  };
  const writeDetailsOpen = (next: DetailsOpenMap) => {
    try {
      window.localStorage.setItem(DETAILS_OPEN_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };
  let detailsOpen = readDetailsOpen();
  const isDetailsOpen: DetailsOpenReader = (key, defaultOpen) => {
    const v = detailsOpen[key];
    return typeof v === 'boolean' ? v : defaultOpen;
  };

  const SIDEBAR_PANELS_KEY = 'agentsSidebarPanelsOpen:v1';
  const readSidebarPanelsOpen = (): { generator: boolean; roster: boolean } | null => {
    try {
      const raw = window.localStorage.getItem(SIDEBAR_PANELS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { generator?: unknown; roster?: unknown };
      if (typeof parsed.generator !== 'boolean' || typeof parsed.roster !== 'boolean') return null;
      return { generator: parsed.generator, roster: parsed.roster };
    } catch {
      return null;
    }
  };
  const writeSidebarPanelsOpen = (v: { generator: boolean; roster: boolean }) => {
    try {
      window.localStorage.setItem(SIDEBAR_PANELS_KEY, JSON.stringify(v));
    } catch {
      // ignore
    }
  };

  const savedPanelsOpen = readSidebarPanelsOpen();
  let generatorPanelOpen = savedPanelsOpen?.generator ?? true;
  let rosterPanelOpen = savedPanelsOpen?.roster ?? false;

  if (pendingHashParams) {
    const asOfRaw = pendingHashParams.get('asOf');
    if (asOfRaw != null && asOfRaw.trim()) {
      const asOf = Number(asOfRaw);
      if (Number.isFinite(asOf)) asOfYear = Math.max(1800, Math.min(2525, Math.round(asOf)));
    }
    const home = (pendingHashParams.get('home') ?? '').trim().toUpperCase();
    if (home) {
      homeCountryMode = 'fixed';
      homeCountryIso3 = home;
    }
  }

  if (pendingHashSeed) {
    selectedRosterId = null;
    activeAgent = null;
    seedDraft = pendingHashSeed;
  } else if (!seedDraft) {
    seedDraft = randomSeedString();
  }

  const buildGenerateInput = (
    seed: string,
    opts?: { includeOverrides?: boolean; includeTrace?: boolean },
  ) => {
    if (!agentVocab || !shadowCountries || !agentPriors) return null;
    const includeOverrides = opts?.includeOverrides ?? useOverrides;
    const includeTrace = opts?.includeTrace ?? true;
    const birthYearEl = container.querySelector('#agents-birthyear') as HTMLInputElement | null;
    const tierEl = container.querySelector('#agents-tier') as HTMLSelectElement | null;

    const baseInput = {
      seed,
      vocab: agentVocab,
      countries: shadowCountries,
      priors: agentPriors,
      asOfYear,
      homeCountryIso3: homeCountryMode === 'fixed' ? homeCountryIso3 ?? undefined : undefined,
      includeTrace,
    };

    if (!includeOverrides) return baseInput;
    const fallbackBirthYear = activeAgent?.identity.birthYear ?? 1990;
    const fallbackTier = (activeAgent?.identity.tierBand ?? 'middle') as TierBand;
    return {
      ...baseInput,
      birthYear: Number(birthYearEl?.value || fallbackBirthYear),
      tierBand: (tierEl?.value as TierBand) ?? fallbackTier,
      roleSeedTags: overrideRoleTags,
    };
  };

  const maybeInitAgent = () => {
    if (!agentVocab || !shadowCountries || !agentPriors) return;

    if (pendingHashSeed) {
      const input = buildGenerateInput(pendingHashSeed, { includeTrace: true, includeOverrides: false });
      if (!input) return;
      activeAgent = generateAgent(input);
      seedDraft = activeAgent.seed;
      pendingHashSeed = null;
      pendingHashParams = null;
    } else if (!activeAgent) {
      const input = buildGenerateInput(seedDraft, { includeTrace: true, includeOverrides: false });
      if (!input) return;
      activeAgent = generateAgent(input);
      seedDraft = activeAgent.seed;
    }
  };

  void getAgentVocabV1()
    .then((v) => {
      agentVocab = v;
      agentVocabError = null;
      maybeInitAgent();
      render();
    })
    .catch((err: unknown) => {
      agentVocab = null;
      agentVocabError = err instanceof Error ? err.message : String(err);
      render();
    });

  void getAgentPriorsV1()
    .then((p) => {
      agentPriors = p;
      agentPriorsError = null;
      maybeInitAgent();
      render();
    })
    .catch((err: unknown) => {
      agentPriors = null;
      agentPriorsError = err instanceof Error ? err.message : String(err);
      render();
    });

  void getShadowCountryMap()
    .then((rows) => {
      shadowCountries = rows
        .map((r) => ({
          shadow: String(r.shadow ?? '').trim(),
          iso3: String(r.iso3 ?? '').trim().toUpperCase(),
          continent: r.continent ? String(r.continent).trim() : undefined,
        }))
        .filter((r) => r.shadow && r.iso3.length === 3);
      shadowByIso3 = new Map(shadowCountries.map((r) => [r.iso3, { shadow: r.shadow, continent: r.continent }]));
      shadowCountriesError = null;

      if (homeCountryMode === 'fixed' && homeCountryIso3) {
        const ok = shadowCountries.some(c => c.iso3 === homeCountryIso3);
        if (!ok) {
          homeCountryMode = 'random';
          homeCountryIso3 = null;
        }
      }

      maybeInitAgent();
      render();
    })
    .catch((err: unknown) => {
      shadowCountries = null;
      shadowByIso3 = new Map();
      shadowCountriesError = err instanceof Error ? err.message : String(err);
      render();
    });

  function render() {
    const birthYear = activeAgent?.identity.birthYear ?? 1990;
    const tierBand = (activeAgent?.identity.tierBand ?? 'middle') as TierBand;
    const roleSeedTags = activeAgent?.identity.roleSeedTags ?? [];
    if (!overrideRoleTags.length) overrideRoleTags = [...roleSeedTags];

    const vocabTierBands = (agentVocab?.identity.tierBands?.length ? agentVocab.identity.tierBands : (['elite', 'middle', 'mass'] as const)) as readonly TierBand[];
    const vocabRoleSeeds = agentVocab?.identity.roleSeedTags?.length ? agentVocab.identity.roleSeedTags : overrideRoleTags;

    const availableCountries = (shadowCountries ?? []).slice().sort((a, b) => a.shadow.localeCompare(b.shadow));
    const selectedHomeIso3 = homeCountryMode === 'fixed' && homeCountryIso3 ? homeCountryIso3 : '';
    const countryOptions = [
      `<option value="" ${selectedHomeIso3 ? '' : 'selected'}>Random (uniform)</option>`,
      ...availableCountries.map(c => `<option value="${escapeHtml(c.iso3)}" ${c.iso3 === selectedHomeIso3 ? 'selected' : ''}>${escapeHtml(c.shadow)} (${escapeHtml(c.iso3)})</option>`),
    ].join('');

    const hintLines: string[] = [];
    if (agentVocab) hintLines.push('Vocabulary loaded.');
    else if (agentVocabError) hintLines.push('Vocabulary missing — run `pnpm extract-data` in `shadow-workipedia`.');
    else hintLines.push('Loading vocabulary…');

    if (agentPriors) hintLines.push('Priors loaded.');
    else if (agentPriorsError) hintLines.push('Priors missing — run `pnpm extract-data` in `shadow-workipedia`.');
    else hintLines.push('Loading priors…');

    if (shadowCountries) hintLines.push('Country map loaded.');
    else if (shadowCountriesError) hintLines.push('Country map missing — run `pnpm extract-data` in `shadow-workipedia`.');
    else hintLines.push('Loading country map…');

    const vocabHint = `<div class="agents-sidebar-subtitle agent-muted agents-hide-mobile">${escapeHtml(hintLines.join(' '))}</div>`;
    const seedSummary = seedDraft.length > 14 ? `${seedDraft.slice(0, 14)}…` : seedDraft;
    const homeSummary = selectedHomeIso3
      ? shadowByIso3.get(selectedHomeIso3)?.shadow
        ? `${shadowByIso3.get(selectedHomeIso3)?.shadow} (${selectedHomeIso3})`
        : selectedHomeIso3
      : 'Random';

    container.innerHTML = `
      <div class="agents-view">
        <div class="agents-body">
          <aside class="agents-sidebar">
            <details class="agents-sidebar-card agents-panel" id="agents-panel-generator" ${generatorPanelOpen ? 'open' : ''}>
              <summary class="agents-panel-summary">
                <div class="agents-panel-summary-top">
                  <h2>Generator</h2>
                  <div class="agents-panel-summary-seed">
                    <code>${escapeHtml(seedSummary)}</code>
                  </div>
                  <div class="agents-panel-summary-actions">
                    <button id="agents-random-quick" type="button" class="agents-btn agents-btn-random" ${agentVocab && agentPriors && shadowCountries ? '' : 'disabled'} title="Generate a random agent">
                      Random
                    </button>
                  </div>
                </div>
                <div class="agents-sidebar-subtitle agents-hide-mobile">Seed drives all derived traits by default.</div>
              </summary>
              <div class="agents-panel-body">
                ${vocabHint}
                <label class="agents-label agents-label-seed">
                  Seed
                  <input id="agents-seed" class="agents-input" type="text" value="${escapeHtml(seedDraft)}" spellcheck="false" />
                </label>

                <details class="agents-actions" data-agents-details="sidebar:settings" ${isDetailsOpen('sidebar:settings', false) ? 'open' : ''}>
                  <summary class="agents-actions-summary">
                    Settings
                    <span class="agents-actions-hint">${escapeHtml(`As-of ${asOfYear} · Home ${homeSummary}`)}</span>
                  </summary>
                  <div class="agents-actions-body">
                    <label class="agents-label">
                      As-of year
                      <input id="agents-asof" class="agents-input" type="number" min="1800" max="2525" value="${escapeHtml(String(asOfYear))}" />
                    </label>
                    <label class="agents-label">
                      Home country
                      <select id="agents-home-country" class="agents-input" ${agentVocab && agentPriors && shadowCountries ? '' : 'disabled'}>
                        ${countryOptions}
                      </select>
                    </label>
                  </div>
                </details>

                <div class="agents-btn-row agents-btn-row-primary agents-btn-grid">
                  <button id="agents-random" class="agents-btn" ${agentVocab && agentPriors && shadowCountries ? '' : 'disabled'}>Random</button>
                  <button id="agents-generate" class="agents-btn primary" ${agentVocab && agentPriors && shadowCountries ? '' : 'disabled'}>Generate</button>
                  <button id="agents-save" class="agents-btn primary" ${activeAgent ? '' : 'disabled'}>Save</button>
                  <button id="agents-share" class="agents-btn">Copy link</button>
                </div>

                <details class="agents-actions agents-roster" id="agents-panel-roster" ${rosterPanelOpen ? 'open' : ''}>
                  <summary class="agents-actions-summary">
                    Roster
                    <span class="agents-actions-hint">${roster.length === 1 ? '1 saved agent' : `${roster.length} saved agents`}</span>
                  </summary>
                  <div class="agents-actions-body">
                    <div class="agents-roster-header">
                      <div class="agents-panel-summary-meta agent-muted">Saved agents (local)</div>
                      <button id="agents-clear" class="agents-btn danger">Clear</button>
                    </div>
                    <div class="agents-roster-list">
                      ${roster.length
                        ? roster.map(item => `
                          <div class="agents-roster-item ${item.id === selectedRosterId ? 'active' : ''}" data-roster-id="${escapeHtml(item.id)}">
                            <div class="agents-roster-name">${escapeHtml(item.name)}</div>
                            <div class="agents-roster-meta"><code>${escapeHtml(item.seed)}</code></div>
                            <button class="agents-roster-delete" data-roster-delete="${escapeHtml(item.id)}" title="Delete">×</button>
                          </div>
                        `).join('')
                        : `<div class="agent-muted">No saved agents yet.</div>`}
                    </div>
                  </div>
                </details>

                <details class="agents-actions" data-agents-details="sidebar:moreActions" ${isDetailsOpen('sidebar:moreActions', false) ? 'open' : ''}>
                  <summary class="agents-actions-summary">
                    More actions
                    <span class="agents-actions-hint">JSON • trace • country</span>
                  </summary>
                  <div class="agents-actions-body">
                    <div class="agents-btn-row">
                      <button id="agents-export" class="agents-btn">Export JSON</button>
                      <button id="agents-copy-json" class="agents-btn">Copy JSON</button>
                      <button id="agents-copy-trace" class="agents-btn">Copy trace</button>
                      <button id="agents-lock-country" class="agents-btn" ${activeAgent ? '' : 'disabled'}>Lock to current</button>
                      <button id="agents-reroll-country" class="agents-btn agents-btn-span2" ${selectedHomeIso3 ? '' : 'disabled'}>Reroll (same country)</button>
                    </div>
                  </div>
                </details>

                <details class="agents-advanced" data-agents-details="sidebar:advancedOverrides" ${isDetailsOpen('sidebar:advancedOverrides', useOverrides) ? 'open' : ''}>
                  <summary class="agents-advanced-summary">
                    Advanced overrides
                    <span class="agents-advanced-hint">${useOverrides ? 'on' : 'off'}</span>
                  </summary>
                  <label class="agents-checkbox">
                    <input id="agents-use-overrides" type="checkbox" ${useOverrides ? 'checked' : ''} />
                    Override derived attributes (optional)
                  </label>
                  <div class="agents-advanced-body ${useOverrides ? '' : 'disabled'}">
                    <label class="agents-label">
                      Birth year
                      <input id="agents-birthyear" class="agents-input" type="number" min="1800" max="2525" value="${escapeHtml(String(birthYear))}" />
                    </label>
                    <label class="agents-label">
                      Tier
                      <select id="agents-tier" class="agents-input">
                        ${vocabTierBands.map(t => `<option value="${escapeHtml(t)}" ${t === tierBand ? 'selected' : ''}>${escapeHtml(toTitleCaseWords(t))}</option>`).join('')}
                      </select>
                    </label>
                    <div class="agents-label">
                      Role seeds
                      <div class="agents-chips" id="agents-role-chips">
                        ${vocabRoleSeeds.map(tag => `
                          <button type="button" class="chip ${overrideRoleTags.includes(tag) ? 'active' : ''}" data-role="${escapeHtml(tag)}">${escapeHtml(toTitleCaseWords(tag))}</button>
                        `).join('')}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </details>
          </aside>

          <main class="agents-main">
            ${activeAgent ? renderAgent(activeAgent, shadowByIso3, profileTab, isDetailsOpen, asOfYear) : `<div class="agent-muted">Generate an agent to begin.</div>`}
          </main>
        </div>
      </div>
    `;

    const seedEl = container.querySelector('#agents-seed') as HTMLInputElement | null;
    const asOfEl = container.querySelector('#agents-asof') as HTMLInputElement | null;
    const homeCountryEl = container.querySelector('#agents-home-country') as HTMLSelectElement | null;

    seedEl?.addEventListener('input', () => {
      seedDraft = seedEl.value;
    });

    for (const btn of Array.from(container.querySelectorAll<HTMLButtonElement>('[data-agent-tab]'))) {
      btn.addEventListener('click', () => {
        const next = (btn.dataset.agentTab ?? '').trim() as AgentProfileTab;
        if (!next) return;
        if (next === profileTab) return;
        if (!isAgentProfileTab(next)) return;
        profileTab = next;
        writeProfileTab(profileTab);
        render();
      });
    }

    asOfEl?.addEventListener('input', () => {
      const v = Number(asOfEl.value);
      if (Number.isFinite(v)) asOfYear = Math.max(1800, Math.min(2525, Math.round(v)));
    });

    homeCountryEl?.addEventListener('change', () => {
      const v = (homeCountryEl.value ?? '').trim().toUpperCase();
      if (!v) {
        homeCountryMode = 'random';
        homeCountryIso3 = null;
      } else {
        homeCountryMode = 'fixed';
        homeCountryIso3 = v;
      }
      render();
    });

    const roleChips = Array.from(container.querySelectorAll<HTMLButtonElement>('#agents-role-chips .chip'));
    for (const chip of roleChips) {
      chip.addEventListener('click', () => {
        if (!useOverrides) return;
        const role = chip.dataset.role ?? '';
        if (!role) return;
        if (overrideRoleTags.includes(role)) overrideRoleTags = overrideRoleTags.filter(x => x !== role);
        else overrideRoleTags = [...overrideRoleTags, role].slice(0, 4);
        render();
      });
    }

    const btnRandomQuick = container.querySelector('#agents-random-quick') as HTMLButtonElement | null;
    const btnRandom = container.querySelector('#agents-random') as HTMLButtonElement | null;
    const btnGenerate = container.querySelector('#agents-generate') as HTMLButtonElement | null;
    const btnLockCountry = container.querySelector('#agents-lock-country') as HTMLButtonElement | null;
    const btnRerollCountry = container.querySelector('#agents-reroll-country') as HTMLButtonElement | null;
    const btnShare = container.querySelector('#agents-share') as HTMLButtonElement | null;
    const btnSave = container.querySelector('#agents-save') as HTMLButtonElement | null;
    const btnExport = container.querySelector('#agents-export') as HTMLButtonElement | null;
    const btnCopyJson = container.querySelector('#agents-copy-json') as HTMLButtonElement | null;
    const btnCopyTrace = container.querySelector('#agents-copy-trace') as HTMLButtonElement | null;
    const btnClear = container.querySelector('#agents-clear') as HTMLButtonElement | null;
    const overridesToggle = container.querySelector('#agents-use-overrides') as HTMLInputElement | null;
    const generatorPanelEl = container.querySelector('#agents-panel-generator') as HTMLDetailsElement | null;
    const rosterPanelEl = container.querySelector('#agents-panel-roster') as HTMLDetailsElement | null;

    for (const d of Array.from(container.querySelectorAll<HTMLDetailsElement>('details[data-agents-details]'))) {
      const key = (d.dataset.agentsDetails ?? '').trim();
      if (!key) continue;
      d.addEventListener('toggle', () => {
        detailsOpen = { ...detailsOpen, [key]: d.open };
        writeDetailsOpen(detailsOpen);
      });
    }

    const cognitiveDetailsToggle = container.querySelector('[data-cognitive-details-toggle]') as HTMLButtonElement | null;
    cognitiveDetailsToggle?.addEventListener('click', () => {
      const next = !isDetailsOpen(COGNITIVE_DETAILS_KEY, false);
      detailsOpen = { ...detailsOpen, [COGNITIVE_DETAILS_KEY]: next };
      writeDetailsOpen(detailsOpen);
      render();
    });

    if (generatorPanelEl) {
      generatorPanelEl.open = generatorPanelOpen;
      generatorPanelEl.addEventListener('toggle', () => {
        generatorPanelOpen = generatorPanelEl.open;
        writeSidebarPanelsOpen({ generator: generatorPanelOpen, roster: rosterPanelOpen });
      });
    }

    if (rosterPanelEl) {
      rosterPanelEl.open = rosterPanelOpen;
      rosterPanelEl.addEventListener('toggle', () => {
        rosterPanelOpen = rosterPanelEl.open;
        writeSidebarPanelsOpen({ generator: generatorPanelOpen, roster: rosterPanelOpen });
      });
    }

    overridesToggle?.addEventListener('change', () => {
      useOverrides = !!overridesToggle.checked;
      render();
    });

    const runRandom = () => {
      if (!agentVocab || !agentPriors || !shadowCountries) return;
      const seed = randomSeedString();
      if (seedEl) seedEl.value = seed;
      seedDraft = seed;
      const input = buildGenerateInput(seed);
      if (!input) return;
      activeAgent = generateAgent(input);
      render();
    };

    btnRandom?.addEventListener('click', runRandom);

    if (btnRandomQuick) {
      const stopDetailsToggle = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };

      btnRandomQuick.addEventListener('pointerdown', stopDetailsToggle);
      btnRandomQuick.addEventListener('pointerup', stopDetailsToggle);
      btnRandomQuick.addEventListener('touchstart', stopDetailsToggle, { passive: false });
      btnRandomQuick.addEventListener('click', (e) => {
        stopDetailsToggle(e);
        runRandom();
      });
    }

    btnGenerate?.addEventListener('click', () => {
      if (!agentVocab || !agentPriors || !shadowCountries) return;
      const seed = (seedEl?.value ?? '').trim();
      if (!seed) return;
      seedDraft = seed;
      const input = buildGenerateInput(seed);
      if (!input) return;
      activeAgent = generateAgent(input);
      render();
    });

    btnLockCountry?.addEventListener('click', () => {
      if (!activeAgent) return;
      homeCountryMode = 'fixed';
      homeCountryIso3 = activeAgent.identity.homeCountryIso3.trim().toUpperCase();
      render();
    });

    btnRerollCountry?.addEventListener('click', () => {
      if (!agentVocab || !agentPriors || !shadowCountries) return;
      if (!(homeCountryMode === 'fixed' && homeCountryIso3)) return;
      const seed = randomSeedString();
      if (seedEl) seedEl.value = seed;
      seedDraft = seed;
      const input = buildGenerateInput(seed);
      if (!input) return;
      activeAgent = generateAgent(input);
      render();
    });

    btnShare?.addEventListener('click', async () => {
      if (!btnShare) return;
      const seed = (seedEl?.value ?? '').trim();
      if (!seed) return;
      setShareHash(seed, { asOfYear, homeCountryIso3: homeCountryMode === 'fixed' ? homeCountryIso3 : null });
      const url = window.location.href;
      let ok = false;
      try {
        await navigator.clipboard.writeText(url);
        ok = true;
      } catch {
        ok = false;
      }
      setTemporaryButtonLabel(btnShare, ok ? 'Copied' : 'Copy failed', ok ? 1100 : 1600);
    });

    btnSave?.addEventListener('click', () => {
      if (!activeAgent) return;
      const item: RosterItem = {
        id: activeAgent.id,
        name: activeAgent.identity.name,
        seed: activeAgent.seed,
        createdAtIso: activeAgent.createdAtIso,
        agent: { ...activeAgent, generationTrace: undefined },
      };
      roster = [item, ...roster.filter(x => x.id !== item.id)].slice(0, 100);
      selectedRosterId = item.id;
      saveRoster(roster);
      render();
    });

    btnExport?.addEventListener('click', () => {
      if (!activeAgent) return;
      downloadJson(`agent-${activeAgent.id}.json`, humanizeAgentForExport(activeAgent, shadowByIso3));
    });

    btnCopyJson?.addEventListener('click', async () => {
      if (!btnCopyJson) return;
      if (!activeAgent) return;
      const ok = await copyJsonToClipboard(humanizeAgentForExport(activeAgent, shadowByIso3));
      setTemporaryButtonLabel(btnCopyJson, ok ? 'Copied' : 'Copy failed', ok ? 1100 : 1600);
    });

    btnCopyTrace?.addEventListener('click', async () => {
      if (!btnCopyTrace) return;
      const trace = activeAgent?.generationTrace;
      if (!trace) {
        setTemporaryButtonLabel(btnCopyTrace, 'No trace', 1600);
        return;
      }
      const ok = await copyJsonToClipboard(trace);
      setTemporaryButtonLabel(btnCopyTrace, ok ? 'Copied' : 'Copy failed', ok ? 1100 : 1600);
    });

    btnClear?.addEventListener('click', () => {
      roster = [];
      selectedRosterId = null;
      saveRoster(roster);
      render();
    });

    for (const el of Array.from(container.querySelectorAll<HTMLElement>('[data-roster-id]'))) {
      el.addEventListener('click', () => {
        const id = el.dataset.rosterId ?? '';
        const found = roster.find(x => x.id === id);
        if (!found) return;
        selectedRosterId = found.id;
        seedDraft = found.seed;
        pendingHashSeed = null;
        const input = buildGenerateInput(seedDraft);
        activeAgent = input ? generateAgent(input) : null;
        render();
      });
    }

    for (const del of Array.from(container.querySelectorAll<HTMLButtonElement>('[data-roster-delete]'))) {
      del.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = del.dataset.rosterDelete ?? '';
        roster = roster.filter(x => x.id !== id);
        if (selectedRosterId === id) {
          selectedRosterId = roster[0]?.id ?? null;
          const next = selectedRosterId ? roster.find(x => x.id === selectedRosterId) : null;
          seedDraft = next?.seed ?? seedDraft;
          const input = next ? buildGenerateInput(seedDraft) : null;
          activeAgent = input ? generateAgent(input) : null;
        }
        saveRoster(roster);
        render();
      });
    }
  }

  window.addEventListener('hashchange', () => {
    if (!window.location.hash.startsWith('#/agents')) return;
    const seed = readSeedFromHash();
    if (seed) {
      selectedRosterId = null;
      seedDraft = seed;
      const params = readAgentsParamsFromHash();
      const asOfRaw = params.get('asOf');
      if (asOfRaw != null && asOfRaw.trim()) {
        const asOf = Number(asOfRaw);
        if (Number.isFinite(asOf)) asOfYear = Math.max(1800, Math.min(2525, Math.round(asOf)));
      }
      const home = (params.get('home') ?? '').trim().toUpperCase();
      if (home) {
        homeCountryMode = 'fixed';
        homeCountryIso3 = home;
      } else {
        homeCountryMode = 'random';
        homeCountryIso3 = null;
      }

      const input = buildGenerateInput(seed, { includeOverrides: false, includeTrace: true });
      if (input) activeAgent = generateAgent(input);
      else {
        pendingHashSeed = seed;
        pendingHashParams = params;
      }
      render();
    }
  });

  render();
}
