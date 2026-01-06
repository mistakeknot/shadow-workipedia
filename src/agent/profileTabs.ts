export type AgentProfileTab =
  | 'overview'
  | 'character'
  | 'life'
  | 'skills'
  | 'connections'
  | 'mind'
  | 'data';

export const AGENT_PROFILE_TABS: AgentProfileTab[] = [
  'overview',
  'character',
  'life',
  'skills',
  'connections',
  'mind',
  'data',
];

/** Human-readable labels for each tab */
export const AGENT_TAB_LABELS: Record<AgentProfileTab, string> = {
  overview: 'Overview',
  character: 'Character',
  life: 'Life',
  skills: 'Skills',
  connections: 'Connections',
  mind: 'Mind',
  data: 'Data',
};

/** Tab descriptions for tooltips */
export const AGENT_TAB_DESCRIPTIONS: Record<AgentProfileTab, string> = {
  overview: 'First impression: who is this person?',
  character: 'Inner life: personality, beliefs, motivations',
  life: 'Habits, tastes, spaces, routines',
  skills: 'Skills and aptitudes',
  connections: 'Social web: relationships, network, institution',
  mind: 'Thoughts, emotions, knowledge, beliefs',
  data: 'Technical data and export options',
};

export function isAgentProfileTab(value: string): value is AgentProfileTab {
  return (AGENT_PROFILE_TABS as readonly string[]).includes(value);
}

/** Map old tab names to new ones for URL backward compatibility */
export function migrateOldTabName(oldTab: string): AgentProfileTab {
  const migrations: Record<string, AgentProfileTab> = {
    overview: 'overview',
    portrait: 'overview',
    narrative: 'overview',
    identity: 'character',
    motivations: 'character',
    character: 'character',
    psychology: 'mind',
    epistemology: 'mind',
    cognitive: 'mind',
    connections: 'connections',
    social: 'connections',
    capabilities: 'skills',
    performance: 'skills',
    preferences: 'life',
    'daily-life': 'life',
    lifestyle: 'life',
    health: 'life',
    mind: 'mind',
    life: 'life',
    skills: 'skills',
    debug: 'data',
  };
  return migrations[oldTab] ?? 'overview';
}
