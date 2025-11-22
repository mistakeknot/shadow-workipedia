import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { GraphData, GraphNode, GraphEdge, IssueCategory, IssueUrgency } from '../src/types';

const PARENT_REPO = join(process.cwd(), '..');
const OUTPUT_PATH = join(process.cwd(), 'public', 'data.json');

// Color palette for categories (will be used in future extraction logic)
const CATEGORY_COLORS: Record<IssueCategory, string> = {
  Economic: '#3b82f6',
  Social: '#8b5cf6',
  Political: '#ef4444',
  Environmental: '#10b981',
  Security: '#f59e0b',
  Technological: '#06b6d4',
  Cultural: '#ec4899',
  Infrastructure: '#6366f1',
};

interface RawIssue {
  id: string;
  name: string;
  category: IssueCategory;
  urgency: IssueUrgency;
  description: string;
  tags: string[];
  triggerConditions?: string;
  peakYears?: string;
  crisisExamples?: string[];
  evolutionPaths?: string[];
}

function parseIssueCatalog(): RawIssue[] {
  const catalogPath = join(PARENT_REPO, 'docs/technical/simulation-systems/ISSUE-CATALOG.md');

  if (!existsSync(catalogPath)) {
    console.warn('⚠️  ISSUE-CATALOG.md not found, using mock data');
    return getMockIssues();
  }

  const content = readFileSync(catalogPath, 'utf-8');
  const issues: RawIssue[] = [];

  // Split by ##### to find issues
  const lines = content.split('\n');
  let currentCategory: IssueCategory = 'Technological'; // Default fallback

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track current category from #### headers
    if (line.startsWith('#### ')) {
      const categoryText = line.substring(4).trim();
      // Map category names to IssueCategory
      if (categoryText.includes('Technology') || categoryText.includes('Technological')) {
        currentCategory = 'Technological';
      } else if (categoryText.includes('Economic') || categoryText.includes('Financial')) {
        currentCategory = 'Economic';
      } else if (categoryText.includes('Social') || categoryText.includes('Cultural')) {
        currentCategory = 'Social';
      } else if (categoryText.includes('Political') || categoryText.includes('Governance')) {
        currentCategory = 'Political';
      } else if (categoryText.includes('Environmental') || categoryText.includes('Climate')) {
        currentCategory = 'Environmental';
      } else if (categoryText.includes('Security') || categoryText.includes('Conflict')) {
        currentCategory = 'Security';
      } else if (categoryText.includes('Infrastructure') || categoryText.includes('System')) {
        currentCategory = 'Infrastructure';
      }
    }

    // Parse issue headers (##### Issue Name)
    if (line.startsWith('##### ')) {
      const name = line.substring(6).trim();

      // Generate ID from name (kebab-case)
      const id = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Look ahead for metadata and description
      let description = '';
      let urgency: IssueUrgency = 'Medium'; // Default
      let triggerConditions: string | undefined;
      let peakYears: string | undefined;
      const crisisExamples: string[] = [];
      const evolutionPaths: string[] = [];
      let inCrisisExamples = false;
      let inEvolutionPaths = false;

      for (let j = i + 1; j < Math.min(i + 100, lines.length); j++) {
        const nextLine = lines[j].trim();

        // Stop at next issue
        if (nextLine.startsWith('##### ') || nextLine.startsWith('#### ')) {
          break;
        }

        // Extract trigger conditions
        if (nextLine.startsWith('**Trigger Conditions**:')) {
          triggerConditions = nextLine.substring(23).trim();
        }

        // Extract peak years
        if (nextLine.startsWith('**Peak Years**:')) {
          peakYears = nextLine.substring(15).trim();
          // Issues peaking soon are more urgent
          if (peakYears.includes('2024') || peakYears.includes('2025')) {
            urgency = 'Critical';
          } else if (peakYears.includes('202') && parseInt(peakYears.match(/202(\d)/)?.[1] || '9') < 5) {
            urgency = 'High';
          } else if (peakYears.includes('21') || peakYears.includes('22')) {
            urgency = 'Latent';
          }
        }

        // Extract crisis examples
        if (nextLine.startsWith('**Crisis Examples**:')) {
          inCrisisExamples = true;
          inEvolutionPaths = false;
          continue;
        }

        // Extract evolution paths
        if (nextLine.startsWith('**Evolution Paths**:')) {
          inEvolutionPaths = true;
          inCrisisExamples = false;
          continue;
        }

        // Stop collecting examples/paths at next section
        if (nextLine.startsWith('**') && !nextLine.startsWith('- **')) {
          inCrisisExamples = false;
          inEvolutionPaths = false;
        }

        // Collect crisis examples (lines starting with - **)
        if (inCrisisExamples && nextLine.startsWith('- **')) {
          const example = nextLine.substring(4).replace(/\*\*/g, '').trim();
          if (example) crisisExamples.push(example);
        }

        // Collect evolution paths (lines starting with -)
        if (inEvolutionPaths && nextLine.startsWith('- ') && !nextLine.startsWith('- **')) {
          const path = nextLine.substring(2).trim();
          if (path) evolutionPaths.push(path);
        }

        // First non-metadata paragraph is description (simplified)
        if (!description && nextLine.length > 20 && !nextLine.startsWith('**') && !nextLine.startsWith('-')) {
          description = nextLine;
        }
      }

      // Extract tags from name
      const tags = name
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4)
        .slice(0, 3);

      issues.push({
        id,
        name,
        category: currentCategory,
        urgency,
        description: description || name,
        tags,
        triggerConditions,
        peakYears,
        crisisExamples: crisisExamples.length > 0 ? crisisExamples : undefined,
        evolutionPaths: evolutionPaths.length > 0 ? evolutionPaths : undefined,
      });
    }
  }

  return issues;
}

function getMockIssues(): RawIssue[] {
  // Fallback mock data for development
  return [
    {
      id: 'climate-change-crisis',
      name: 'Climate Change Crisis',
      category: 'Environmental',
      urgency: 'Critical',
      description: 'Accelerating global warming causing extreme weather and ecosystem collapse.',
      tags: ['climate', 'environment', 'crisis'],
    },
    {
      id: 'ai-job-displacement',
      name: 'AI Job Displacement Tsunami',
      category: 'Technological',
      urgency: 'High',
      description: 'Rapid automation eliminating millions of jobs across multiple sectors.',
      tags: ['ai', 'employment', 'automation'],
    },
    {
      id: 'wealth-inequality',
      name: 'Extreme Wealth Inequality',
      category: 'Economic',
      urgency: 'Critical',
      description: 'Growing gap between rich and poor destabilizing economies.',
      tags: ['inequality', 'economics', 'social'],
    },
    {
      id: 'democratic-backsliding',
      name: 'Democratic Backsliding',
      category: 'Political',
      urgency: 'High',
      description: 'Erosion of democratic institutions and norms worldwide.',
      tags: ['democracy', 'politics', 'governance'],
    },
    {
      id: 'cyber-warfare',
      name: 'Cyber Warfare Escalation',
      category: 'Security',
      urgency: 'High',
      description: 'State-sponsored cyber attacks threatening critical infrastructure.',
      tags: ['security', 'cyber', 'warfare'],
    },
  ];
}

function issueToNode(issue: RawIssue, curatedMappings: Map<string, string[]>): GraphNode {
  const urgencySizes = {
    Critical: 16,
    High: 12,
    Medium: 8,
    Low: 6,
    Latent: 4,
  };

  return {
    id: issue.id,
    type: 'issue',
    label: issue.name,
    category: issue.category,
    urgency: issue.urgency,
    description: issue.description,
    publicConcern: Math.floor(Math.random() * 40) + 60, // Mock: 60-100
    economicImpact: Math.floor(Math.random() * 50) + 50, // Mock: 50-100
    socialImpact: Math.floor(Math.random() * 50) + 50,   // Mock: 50-100
    affectedSystems: curatedMappings.get(issue.id) || [],
    triggerConditions: issue.triggerConditions,
    peakYears: issue.peakYears,
    crisisExamples: issue.crisisExamples,
    evolutionPaths: issue.evolutionPaths,
    color: CATEGORY_COLORS[issue.category],
    size: urgencySizes[issue.urgency],
  };
}

interface ConnectivitySystem {
  name: string;
  connections: number;
}

function parseSystemsFromConnectivity(): ConnectivitySystem[] {
  const connectivityPath = join(PARENT_REPO, 'docs/technical/simulation-systems/CONNECTIVITY-INDEX.json');

  if (!existsSync(connectivityPath)) {
    console.warn('⚠️  CONNECTIVITY-INDEX.json not found, using mock systems');
    return getMockSystems();
  }

  const content = readFileSync(connectivityPath, 'utf-8');
  const data = JSON.parse(content);

  // Count connections per system
  const systemConnections = new Map<string, number>();

  if (data.connections && Array.isArray(data.connections)) {
    for (const edge of data.connections) {
      const source = edge.source;
      const target = edge.target;

      if (source) {
        systemConnections.set(source, (systemConnections.get(source) || 0) + 1);
      }
      if (target) {
        systemConnections.set(target, (systemConnections.get(target) || 0) + 1);
      }
    }
  }

  return Array.from(systemConnections.entries()).map(([name, connections]) => ({
    name,
    connections,
  }));
}

function getMockSystems(): ConnectivitySystem[] {
  return [
    { name: 'Climate', connections: 42 },
    { name: 'Economy', connections: 38 },
    { name: 'Politics', connections: 35 },
    { name: 'Healthcare', connections: 28 },
    { name: 'Technology', connections: 31 },
    { name: 'Education', connections: 22 },
    { name: 'Military', connections: 18 },
    { name: 'Trade', connections: 25 },
  ];
}

function loadCuratedConnections(): Map<string, Array<{targetId: string, relationshipType: string, reasoning: string}>> {
  const connectionsPath = join(process.cwd(), 'issue-issue-connections.json');

  if (!existsSync(connectionsPath)) {
    console.warn('⚠️  Curated connections not found, returning empty map');
    return new Map();
  }

  const content = readFileSync(connectionsPath, 'utf-8');
  const data = JSON.parse(content);

  const connectionMap = new Map();

  if (data.connections && Array.isArray(data.connections)) {
    for (const conn of data.connections) {
      connectionMap.set(conn.issueId, conn.connectedTo);
    }
  }

  return connectionMap;
}

function extractIssueEdges(issues: RawIssue[]): GraphEdge[] {
  const edges: GraphEdge[] = [];

  // Load curated human-reviewed connections
  const curatedConnections = loadCuratedConnections();
  console.log(`📋 Loaded ${curatedConnections.size} issues with curated connections`);

  const issueIds = new Set(issues.map(i => i.id));

  // Create edges from curated connections
  for (const issue of issues) {
    const connections = curatedConnections.get(issue.id);

    if (!connections || connections.length === 0) {
      continue;
    }

    for (const conn of connections) {
      // Verify target exists
      if (!issueIds.has(conn.targetId)) {
        console.warn(`⚠️  Target issue "${conn.targetId}" not found for "${issue.id}"`);
        continue;
      }

      // Map relationship type to edge strength
      const strengthMap: Record<string, number> = {
        'causal': 0.8,
        'reinforcing': 0.7,
        'sequential': 0.6,
        'thematic': 0.5,
      };

      edges.push({
        source: issue.id,
        target: conn.targetId,
        type: 'issue-issue',
        strength: strengthMap[conn.relationshipType] || 0.5,
        label: `${conn.relationshipType}: ${conn.reasoning.substring(0, 60)}...`,
        bidirectional: false,
      });
    }
  }

  return edges;
}

function loadCuratedMappings(): Map<string, string[]> {
  const mappingsPath = join(process.cwd(), 'issue-system-mappings.json');

  if (!existsSync(mappingsPath)) {
    console.warn('⚠️  Curated mappings not found, returning empty map');
    return new Map();
  }

  const content = readFileSync(mappingsPath, 'utf-8');
  const data = JSON.parse(content);

  const mappingMap = new Map<string, string[]>();

  if (data.mappings && Array.isArray(data.mappings)) {
    for (const mapping of data.mappings) {
      mappingMap.set(mapping.issueId, mapping.systems);
    }
  }

  return mappingMap;
}

async function main() {
  console.log('🔍 Extracting data from Shadow Work...');

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Load curated mappings
  const curatedMappings = loadCuratedMappings();
  console.log(`📋 Loaded ${curatedMappings.size} curated issue-system mappings`);

  // Extract issues
  const rawIssues = parseIssueCatalog();
  console.log(`📋 Found ${rawIssues.length} issues in catalog`);

  const issueNodes = rawIssues.map(issue => issueToNode(issue, curatedMappings));
  nodes.push(...issueNodes);

  // Extract systems (for metadata only, not as nodes)
  const systems = parseSystemsFromConnectivity();
  console.log(`🎯 Found ${systems.length} systems (metadata only, not rendered as nodes)`);

  // Extract edges (issue-to-issue only)
  console.log('🔗 Extracting issue connections...');

  const issueEdges = extractIssueEdges(rawIssues);
  console.log(`  - ${issueEdges.length} issue-issue edges`);
  edges.push(...issueEdges);

  const data: GraphData = {
    nodes,
    edges,
    metadata: {
      generatedAt: new Date().toISOString(),
      issueCount: nodes.filter(n => n.type === 'issue').length,
      systemCount: nodes.filter(n => n.type === 'system').length,
      edgeCount: edges.length,
    },
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`✅ Extracted ${data.metadata.issueCount} issues, ${data.metadata.systemCount} systems, ${data.metadata.edgeCount} edges`);
  console.log(`📦 Wrote to ${OUTPUT_PATH}`);
}

main().catch(console.error);
