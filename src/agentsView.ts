import { formatBand5, formatFixed01k, generateAgent, randomSeedString, type AgentPriorsV1, type AgentVocabV1, type GeneratedAgent, type TierBand } from './agentGenerator';

type RosterItem = {
  id: string;
  name: string;
  seed: string;
  createdAtIso: string;
  agent?: GeneratedAgent;
};

const ROSTER_STORAGE_KEY = 'swp.agents.roster.v1';

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

function humanizeSkillKey(key: string): string {
  // camelCase -> space words; preserves existing snake/space tags via toTitleCaseWords.
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return toTitleCaseWords(spaced);
}

function renderAgent(agent: GeneratedAgent, shadowByIso3: ReadonlyMap<string, { shadow: string; continent?: string }>): string {
  const apt = agent.capabilities.aptitudes;
  const skills = agent.capabilities.skills;

  const homeShadow = shadowByIso3.get(agent.identity.homeCountryIso3)?.shadow;
  const citizenshipShadow = shadowByIso3.get(agent.identity.citizenshipCountryIso3)?.shadow;
  const currentShadow = shadowByIso3.get(agent.identity.currentCountryIso3)?.shadow;

  const originLabel = homeShadow ?? agent.identity.homeCountryIso3;
  const citizenshipLabel = citizenshipShadow ?? agent.identity.citizenshipCountryIso3;
  const currentLabel = currentShadow ?? agent.identity.currentCountryIso3;

  const platformDiet = Object.entries(agent.preferences.media.platformDiet)
    .map(([k, v]) => `<li><span class="kv-k">${escapeHtml(toTitleCaseWords(k))}</span><span class="kv-v">${escapeHtml(formatFixed01k(v))}</span></li>`)
    .join('');

  const roleTags = agent.identity.roleSeedTags.map(t => `<span class="pill">${escapeHtml(toTitleCaseWords(t))}</span>`).join('');
  const langTags = agent.identity.languages.map(t => `<span class="pill pill-muted">${escapeHtml(displayLanguageCode(t))}</span>`).join('');

  const skillRows = Object.entries(skills)
    .map(([k, v]) => `
      <div class="agent-skill-row">
        <div class="agent-skill-name">${escapeHtml(humanizeSkillKey(k))}</div>
        <div class="agent-skill-band">${escapeHtml(toTitleCaseWords(formatBand5(v.value)))}</div>
        <div class="agent-skill-pct">${escapeHtml(formatFixed01k(v.value))}</div>
      </div>
    `)
    .join('');

  const traceSection = agent.generationTrace
    ? `
      <details class="agent-trace">
        <summary>Generation trace</summary>
        <pre class="agent-trace-pre">${escapeHtml(JSON.stringify(agent.generationTrace, null, 2))}</pre>
      </details>
    `
    : '';

  return `
    <div class="agent-profile">
      <div class="agent-profile-header">
        <div>
          <h2>${escapeHtml(agent.identity.name)}</h2>
          <div class="agent-meta">
            <span class="agent-meta-item">Seed: <code>${escapeHtml(agent.seed)}</code></span>
            <span class="agent-meta-item">Origin: ${escapeHtml(originLabel)} <code>${escapeHtml(agent.identity.homeCountryIso3)}</code></span>
            <span class="agent-meta-item">Citizenship: ${escapeHtml(citizenshipLabel)} <code>${escapeHtml(agent.identity.citizenshipCountryIso3)}</code></span>
            <span class="agent-meta-item">Location: ${escapeHtml(currentLabel)} <code>${escapeHtml(agent.identity.currentCountryIso3)}</code></span>
            <span class="agent-meta-item">Born: ${escapeHtml(String(agent.identity.birthYear))}</span>
            <span class="agent-meta-item">Tier: ${escapeHtml(toTitleCaseWords(agent.identity.tierBand))}</span>
            <span class="agent-meta-item">Culture: ${escapeHtml(agent.identity.homeCulture)}</span>
          </div>
          <div class="agent-pill-row">${roleTags} ${langTags}</div>
        </div>
      </div>

      <div class="agent-grid">
        <section class="agent-card">
          <h3>Identity</h3>
          <div class="agent-kv">
            <div class="kv-row"><span class="kv-k">Languages</span><span class="kv-v">${escapeHtml(agent.identity.languageProficiencies.map(lp => `${displayLanguageCode(lp.language)} (${toTitleCaseWords(lp.proficiencyBand)})`).join(', '))}</span></div>
            <div class="kv-row"><span class="kv-k">Education</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.identity.educationTrackTag))}</span></div>
            <div class="kv-row"><span class="kv-k">Career</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.identity.careerTrackTag))}</span></div>
            <div class="kv-row"><span class="kv-k">Mobility</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.mobility.mobilityTag))}</span></div>
            <div class="kv-row"><span class="kv-k">Passport access</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.mobility.passportAccessBand))}</span></div>
            <div class="kv-row"><span class="kv-k">Travel frequency</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.mobility.travelFrequencyBand))}</span></div>
          </div>
        </section>

        <section class="agent-card">
          <h3>Capabilities</h3>
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
        </section>

        <section class="agent-card">
          <h3>Skills</h3>
          <div class="agent-skill-header">
            <span>Skill</span><span>Band</span><span>Value</span>
          </div>
          <div class="agent-skill-list">${skillRows}</div>
        </section>

        <section class="agent-card">
          <h3>Traits</h3>
          <div class="agent-card-grid">
            ${renderGauge('Risk tolerance', agent.psych.traits.riskTolerance)}
            ${renderGauge('Conscientiousness', agent.psych.traits.conscientiousness)}
            ${renderGauge('Novelty seeking', agent.psych.traits.noveltySeeking)}
            ${renderGauge('Agreeableness', agent.psych.traits.agreeableness)}
            ${renderGauge('Authoritarianism', agent.psych.traits.authoritarianism)}
          </div>
        </section>

        <section class="agent-card">
          <h3>Visibility</h3>
          <div class="agent-card-grid">
            ${renderGauge('Public visibility', agent.visibility.publicVisibility)}
            ${renderGauge('Paper trail', agent.visibility.paperTrail)}
            ${renderGauge('Digital hygiene', agent.visibility.digitalHygiene)}
          </div>
        </section>

        <section class="agent-card">
          <h3>Preferences</h3>
          <div class="agent-kv">
            <div class="kv-row"><span class="kv-k">Comfort foods</span><span class="kv-v">${escapeHtml(agent.preferences.food.comfortFoods.map(toTitleCaseWords).join(', '))}</span></div>
            <div class="kv-row"><span class="kv-k">Dislikes</span><span class="kv-v">${escapeHtml(agent.preferences.food.dislikes.map(toTitleCaseWords).join(', '))}</span></div>
            <div class="kv-row"><span class="kv-k">Restrictions</span><span class="kv-v">${escapeHtml(agent.preferences.food.restrictions.map(toTitleCaseWords).join(', ') || '—')}</span></div>
            <div class="kv-row"><span class="kv-k">Ritual drink</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.preferences.food.ritualDrink))}</span></div>
            <div class="kv-row"><span class="kv-k">Genres</span><span class="kv-v">${escapeHtml(agent.preferences.media.genreTopK.map(toTitleCaseWords).join(', '))}</span></div>
            <div class="kv-row"><span class="kv-k">Style</span><span class="kv-v">${escapeHtml(agent.preferences.fashion.styleTags.map(toTitleCaseWords).join(', '))}</span></div>
          </div>
        </section>

        <section class="agent-card">
          <h3>Media</h3>
          <div class="agent-card-grid">
            ${renderGauge('Attention resilience', agent.preferences.media.attentionResilience)}
            ${renderGauge('Doomscrolling risk', agent.preferences.media.doomscrollingRisk)}
            ${renderGauge('Epistemic hygiene', agent.preferences.media.epistemicHygiene)}
          </div>
          <ul class="agent-kv-list">${platformDiet}</ul>
        </section>

        <section class="agent-card">
          <h3>Routines</h3>
          <div class="agent-kv">
            <div class="kv-row"><span class="kv-k">Chronotype</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.routines.chronotype))}</span></div>
            <div class="kv-row"><span class="kv-k">Sleep</span><span class="kv-v">${escapeHtml(agent.routines.sleepWindow)}</span></div>
            <div class="kv-row"><span class="kv-k">Recovery rituals</span><span class="kv-v">${escapeHtml(agent.routines.recoveryRituals.map(toTitleCaseWords).join(', '))}</span></div>
          </div>
        </section>

        <section class="agent-card">
          <h3>Appearance</h3>
          <div class="agent-kv">
            <div class="kv-row"><span class="kv-k">Height</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.appearance.heightBand))}</span></div>
            <div class="kv-row"><span class="kv-k">Build</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.appearance.buildTag))}</span></div>
            <div class="kv-row"><span class="kv-k">Hair</span><span class="kv-v">${escapeHtml(`${toTitleCaseWords(agent.appearance.hair.color)}, ${toTitleCaseWords(agent.appearance.hair.texture)}`)}</span></div>
            <div class="kv-row"><span class="kv-k">Eyes</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.appearance.eyes.color))}</span></div>
            <div class="kv-row"><span class="kv-k">Voice</span><span class="kv-v">${escapeHtml(toTitleCaseWords(agent.appearance.voiceTag))}</span></div>
            <div class="kv-row"><span class="kv-k">Marks</span><span class="kv-v">${escapeHtml(agent.appearance.distinguishingMarks.map(toTitleCaseWords).join(', ') || '—')}</span></div>
          </div>
        </section>

        <section class="agent-card">
          <h3>Constraints</h3>
          <div class="agent-kv">
            <div class="kv-row"><span class="kv-k">Red lines</span><span class="kv-v">${escapeHtml(agent.identity.redLines.map(toTitleCaseWords).join(', ') || '—')}</span></div>
            <div class="kv-row"><span class="kv-k">Chronic</span><span class="kv-v">${escapeHtml(agent.health.chronicConditionTags.map(toTitleCaseWords).join(', ') || '—')}</span></div>
            <div class="kv-row"><span class="kv-k">Allergies</span><span class="kv-v">${escapeHtml(agent.health.allergyTags.map(toTitleCaseWords).join(', ') || '—')}</span></div>
            <div class="kv-row"><span class="kv-k">Cover aptitudes</span><span class="kv-v">${escapeHtml(agent.covers.coverAptitudeTags.map(toTitleCaseWords).join(', ') || '—')}</span></div>
          </div>
        </section>

        <section class="agent-card">
          <h3>Vices</h3>
          ${agent.vices.length
            ? agent.vices.map(v => `
              <div class="agent-vice-row">
                <span class="pill">${escapeHtml(toTitleCaseWords(v.vice))}</span>
                <span class="pill pill-muted">${escapeHtml(toTitleCaseWords(v.severity))}</span>
                <span class="agent-vice-triggers">${escapeHtml(v.triggers.map(toTitleCaseWords).join(', '))}</span>
              </div>
            `).join('')
            : `<div class="agent-muted">None</div>`}
        </section>

        <section class="agent-card">
          <h3>Identity kit</h3>
          <div class="agent-kv">
            ${agent.logistics.identityKit.map(i => `
              <div class="kv-row">
                <span class="kv-k">${escapeHtml(toTitleCaseWords(i.item))}</span>
                <span class="kv-v">${escapeHtml(toTitleCaseWords(i.security))}${i.compromised ? ' (compromised)' : ''}</span>
              </div>
            `).join('')}
          </div>
        </section>
      </div>

      ${traceSection}
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
    const asOf = Number(pendingHashParams.get('asOf'));
    if (Number.isFinite(asOf)) asOfYear = Math.max(1800, Math.min(2525, Math.round(asOf)));
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

    const vocabHint = `<div class="agents-sidebar-subtitle agent-muted">${escapeHtml(hintLines.join(' '))}</div>`;
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
                  <div class="agents-panel-summary-actions">
                    <button id="agents-random-quick" type="button" class="agents-btn agents-btn-compact" ${agentVocab && agentPriors && shadowCountries ? '' : 'disabled'} title="Generate a random agent">
                      Random
                    </button>
                  </div>
                </div>
                <div class="agents-panel-summary-meta">
                  <span class="agent-muted">Seed</span> <code>${escapeHtml(seedSummary)}</code>
                </div>
                <div class="agents-sidebar-subtitle">Seed drives all derived traits by default.</div>
              </summary>
              <div class="agents-panel-body">
                ${vocabHint}
                <label class="agents-label agents-label-seed">
                  Seed
                  <input id="agents-seed" class="agents-input" type="text" value="${escapeHtml(seedDraft)}" spellcheck="false" />
                </label>

                <details class="agents-actions">
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

                <div class="agents-btn-row agents-btn-row-primary">
                  <button id="agents-random" class="agents-btn" ${agentVocab && agentPriors && shadowCountries ? '' : 'disabled'}>Random</button>
                  <button id="agents-generate" class="agents-btn primary" ${agentVocab && agentPriors && shadowCountries ? '' : 'disabled'}>Generate</button>
                  <button id="agents-save" class="agents-btn primary" ${activeAgent ? '' : 'disabled'}>Save</button>
                  <button id="agents-share" class="agents-btn agents-btn-span2">Copy link</button>
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

                <details class="agents-actions">
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

                <details class="agents-advanced" ${useOverrides ? 'open' : ''}>
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
            ${activeAgent ? renderAgent(activeAgent, shadowByIso3) : `<div class="agent-muted">Generate an agent to begin.</div>`}
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
      const seed = (seedEl?.value ?? '').trim();
      if (!seed) return;
      setShareHash(seed, { asOfYear, homeCountryIso3: homeCountryMode === 'fixed' ? homeCountryIso3 : null });
      const url = window.location.href;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // ignore
      }
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
      if (!activeAgent) return;
      const ok = await copyJsonToClipboard(humanizeAgentForExport(activeAgent, shadowByIso3));
      if (!ok) {
        // Last-resort UX without bringing in toast infra.
        alert('Could not copy JSON to clipboard (browser blocked clipboard access).');
      }
    });

    btnCopyTrace?.addEventListener('click', async () => {
      const trace = activeAgent?.generationTrace;
      if (!trace) {
        alert('No generation trace available for this agent.');
        return;
      }
      const ok = await copyJsonToClipboard(trace);
      if (!ok) {
        alert('Could not copy trace JSON to clipboard (browser blocked clipboard access).');
      }
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
      const asOf = Number(params.get('asOf'));
      if (Number.isFinite(asOf)) asOfYear = Math.max(1800, Math.min(2525, Math.round(asOf)));
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
