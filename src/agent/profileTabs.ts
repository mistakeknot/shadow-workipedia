export type AgentProfileTab =
  | 'overview'
  | 'narrative'
  | 'identity'
  | 'social'
  | 'motivations'
  | 'health'
  | 'cognitive'
  | 'performance'
  | 'lifestyle'
  | 'debug';

export const AGENT_PROFILE_TABS: AgentProfileTab[] = [
  'overview',
  'narrative',
  'identity',
  'social',
  'motivations',
  'health',
  'cognitive',
  'performance',
  'lifestyle',
  'debug',
];

export function isAgentProfileTab(value: string): value is AgentProfileTab {
  return (AGENT_PROFILE_TABS as readonly string[]).includes(value);
}
