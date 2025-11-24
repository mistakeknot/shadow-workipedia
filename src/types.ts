export type NodeType = 'issue' | 'system';

export type IssueCategory =
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

  // Visualization
  color: string;
  size: number;
}

export type EdgeType = 'issue-issue' | 'issue-system' | 'system-system';

export interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
  strength: number;
  label?: string;
  bidirectional?: boolean;
}

export interface WikiArticle {
  id: string;
  title: string;
  type: 'issue' | 'system';
  frontmatter: Record<string, any>;
  content: string;
  html: string;
  wordCount: number;
  lastUpdated: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  articles?: Record<string, WikiArticle>;
  metadata: {
    generatedAt: string;
    issueCount: number;
    systemCount: number;
    edgeCount: number;
    articleCount?: number;
  };
}
