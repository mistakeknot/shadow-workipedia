export type AgentProfileTab =
  | 'portrait'
  | 'character'
  | 'connections'
  | 'capabilities'
  | 'daily-life'
  | 'data';

export const AGENT_PROFILE_TABS: AgentProfileTab[] = [
  'portrait',
  'character',
  'connections',
  'capabilities',
  'daily-life',
  'data',
];

/** Human-readable labels for each tab */
export const AGENT_TAB_LABELS: Record<AgentProfileTab, string> = {
  portrait: 'Portrait',
  character: 'Character',
  connections: 'Connections',
  capabilities: 'Capabilities',
  'daily-life': 'Daily Life',
  data: 'Data',
};

/** Tab descriptions for tooltips */
export const AGENT_TAB_DESCRIPTIONS: Record<AgentProfileTab, string> = {
  portrait: 'First impression: who is this person?',
  character: 'Inner life: personality, beliefs, motivations',
  connections: 'Social web: relationships, network, institution',
  capabilities: 'Skills, aptitudes, and knowledge',
  'daily-life': 'Appearance, routines, preferences, health',
  data: 'Technical data and export options',
};

export function isAgentProfileTab(value: string): value is AgentProfileTab {
  return (AGENT_PROFILE_TABS as readonly string[]).includes(value);
}

/** Map old tab names to new ones for URL backward compatibility */
export function migrateOldTabName(oldTab: string): AgentProfileTab {
  const migrations: Record<string, AgentProfileTab> = {
    overview: 'portrait',
    narrative: 'portrait',
    identity: 'character',
    motivations: 'character',
    cognitive: 'character',
    social: 'connections',
    performance: 'capabilities',
    lifestyle: 'daily-life',
    health: 'daily-life',
    debug: 'data',
  };
  return migrations[oldTab] ?? 'portrait';
}
