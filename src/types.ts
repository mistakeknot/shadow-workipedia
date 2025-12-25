export type NodeType = 'issue' | 'system' | 'principle' | 'primitive';

// Simulation primitives from Rust engine
export type PrimitiveName =
  | 'TrustErosion'
  | 'DeathSpiral'
  | 'ThresholdCascade'
  | 'CapacityStress'
  | 'ContagionPropagation'
  | 'LegitimacyDynamics'
  | 'FeedbackLoop'
  | 'PolicyContagion'
  | 'ResourceDepletion'
  | 'ExodusMigration'
  | 'CaptureConcentration'
  | 'ResistanceBacklash'
  | 'QueueBacklog'
  | 'AdaptiveResistance';

export type IssueCategory =
  | 'Existential'
  | 'Economic'
  | 'Social'
  | 'Political'
  | 'Environmental'
  | 'Security'
  | 'Technological'
  | 'Cultural'
  | 'Infrastructure';

export type IssueUrgency = 'Critical' | 'High' | 'Medium' | 'Low' | 'Latent';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;

  // Issue-specific
  categories?: IssueCategory[]; // Multi-category support
  urgency?: IssueUrgency;
  description?: string;
  publicConcern?: number;
  economicImpact?: number;
  socialImpact?: number;
  affectedSystems?: string[]; // System tags from curated mappings
  primitives?: PrimitiveName[]; // Simulation primitives from mapping
  triggerConditions?: string;
  peakYears?: string;
  crisisExamples?: string[];
  evolutionPaths?: string[];
  systemWalk?: {
    hasSystemWalk: boolean;
    subsystems: string[];
    architectureFile?: string;
    totalLines?: number;
  };

  // System-specific
  domain?: string;
  connectionCount?: number;

  // Wiki article
  hasArticle?: boolean;
  wordCount?: number;

  // Community assignment (from Louvain detection)
  communityId?: number;
  communityLabel?: string;
  isBridgeNode?: boolean;

  // Principle-specific
  thresholds?: string[];        // Quantified thresholds from the principle
  relatedPrinciples?: string[]; // IDs of related principles
  sourceSystem?: string;        // Source System Walk
  sourceFile?: string;          // Source ARCHITECTURE file

  // Primitive-specific
  pattern?: string;             // Pattern formula (e.g., "A↓ → B↓ → collapse")
  usageCount?: number;          // Number of ARCHITECTURE files using this primitive
  relatedPrimitives?: string[]; // Related primitive IDs

  // Visualization
  color: string;
  size: number;
}

export type EdgeType =
  | 'issue-issue'
  | 'issue-system'
  | 'issue-primitive'     // Issue uses a simulation primitive
  | 'system-system'
  | 'principle-system'    // Principle governs a system
  | 'principle-issue'     // Principle affects an issue
  | 'principle-principle' // Related principles
  | 'data-flow';          // Directed data flow between systems

export interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
  strength: number;
  label?: string;
  bidirectional?: boolean;
  directed?: boolean;     // If true, draw arrow from source to target
  flowDirection?: 'reads' | 'writes'; // For data-flow edges
}

export interface IssueEvent {
  id: string;
  name: string;
  description: string;
}

export interface WikiArticle {
  id: string;
  title: string;
  type: 'issue' | 'system' | 'principle' | 'primitive' | 'mechanic' | 'countryIndex' | 'country' | 'vocabIndex' | 'vocabList' | 'vocabItem';
  frontmatter: Record<string, any>;
  content: string;
  html: string;
  wordCount: number;
  lastUpdated: string;
  events?: IssueEvent[];
}

export interface CommunityMechanicInfo {
  pattern: string;
  mechanic: string;
  count: number;
  percentage: number;
  issues: string[];
}

export interface CommunityInfo {
  id: number;
  size: number;
  label: string;
  topCategory: string;
  mechanicScore: number;
  sharedMechanics: CommunityMechanicInfo[];
}

export interface PrincipleInfo {
  id: string;
  name: string;
  description: string;
  sourceSystem: string;
  sourceFile: string;
  thresholds: string[];
  relatedPrinciples: string[];
  systems: string[];
}

export interface DataFlowInfo {
  source: string;
  target: string;
  direction: 'reads' | 'writes';
  data: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  articles?: Record<string, WikiArticle>;
  communities?: Record<number, CommunityInfo>;
  principles?: PrincipleInfo[];       // Extracted design principles
  dataFlows?: DataFlowInfo[];         // System-to-system data flows
  issueIdRedirects?: Record<string, string>;      // alias/merged-id -> canonical issue id
  canonicalIssueAliases?: Record<string, string[]>; // canonical issue id -> aliases[]
  metadata: {
    generatedAt: string;
    issueCount: number;
    systemCount: number;
    edgeCount: number;
    articleCount?: number;
    communityCount?: number;
    principleCount?: number;
    dataFlowCount?: number;
  };
}
