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

const SYSTEM_COLOR = '#64748b'; // Used for system nodes

interface RawIssue {
  id: string;
  name: string;
  category: IssueCategory;
  urgency: IssueUrgency;
  description: string;
  tags: string[];
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

      // Look ahead for description (first line after header that's not empty or metadata)
      let description = '';
      let urgency: IssueUrgency = 'Medium'; // Default

      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const nextLine = lines[j].trim();

        // Extract peak years to determine urgency
        if (nextLine.startsWith('**Peak Years**:')) {
          const peakYears = nextLine.substring(15).trim();
          // Issues peaking soon are more urgent
          if (peakYears.includes('2024') || peakYears.includes('2025')) {
            urgency = 'Critical';
          } else if (peakYears.includes('202') && parseInt(peakYears.match(/202(\d)/)?.[1] || '9') < 5) {
            urgency = 'High';
          } else if (peakYears.includes('21') || peakYears.includes('22')) {
            urgency = 'Latent';
          }
        }

        // Skip metadata lines
        if (nextLine.startsWith('**') || nextLine.startsWith('-') || !nextLine) {
          continue;
        }

        // First non-metadata text is description
        if (!description && nextLine.length > 10) {
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

function issueToNode(issue: RawIssue): GraphNode {
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

function systemToNode(system: ConnectivitySystem): GraphNode {
  // Size scales logarithmically with connections (10-20px)
  const size = 10 + Math.log(system.connections + 1) * 2;

  return {
    id: `system-${system.name.toLowerCase().replace(/\s+/g, '-')}`,
    type: 'system',
    label: system.name,
    domain: system.name,
    connectionCount: system.connections,
    description: `${system.name} simulation system`,
    color: SYSTEM_COLOR,
    size: Math.min(20, Math.max(10, size)),
  };
}

function extractIssueEdges(issues: RawIssue[]): GraphEdge[] {
  const edges: GraphEdge[] = [];

  // Strategy: Connect issues with shared tags (simple heuristic)
  for (let i = 0; i < issues.length; i++) {
    for (let j = i + 1; j < issues.length; j++) {
      const issueA = issues[i];
      const issueB = issues[j];

      // Calculate shared tags
      const sharedTags = issueA.tags.filter(tag => issueB.tags.includes(tag));

      if (sharedTags.length > 0) {
        // Strength based on shared tag count
        const strength = Math.min(1.0, sharedTags.length * 0.3);

        edges.push({
          source: issueA.id,
          target: issueB.id,
          type: 'issue-issue',
          strength,
          label: `Shared: ${sharedTags.slice(0, 2).join(', ')}`,
          bidirectional: true,
        });
      }

      // Also connect same-category issues (but lower strength)
      if (issueA.category === issueB.category && sharedTags.length === 0) {
        edges.push({
          source: issueA.id,
          target: issueB.id,
          type: 'issue-issue',
          strength: 0.2,
          label: `Same category: ${issueA.category}`,
          bidirectional: true,
        });
      }
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

function extractIssueSystemEdges(
  issues: RawIssue[],
  systems: ConnectivitySystem[]
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const systemNames = new Set(systems.map(s => s.name.toLowerCase()));

  // Load curated human-reviewed mappings
  const curatedMappings = loadCuratedMappings();
  console.log(`📋 Loaded ${curatedMappings.size} curated issue-system mappings`);

  for (const issue of issues) {
    // Use curated mappings if available
    const curatedSystems = curatedMappings.get(issue.id);

    if (curatedSystems && curatedSystems.length > 0) {
      // Use human-reviewed mappings
      for (const systemName of curatedSystems) {
        const systemKey = systemName.toLowerCase();

        // Check if system exists in actual data
        if (!systemNames.has(systemKey)) {
          console.warn(`⚠️  System "${systemName}" from mapping not found in connectivity data`);
          continue;
        }

        const systemId = `system-${systemKey}`;

        // All curated mappings get same strength (manually reviewed)
        edges.push({
          source: issue.id,
          target: systemId,
          type: 'issue-system',
          strength: 0.6,
          label: `Affects ${systemName}`,
          bidirectional: false,
        });
      }
    } else {
      // Fallback to category-based mapping if no curated data
      console.warn(`⚠️  No curated mapping for "${issue.name}", using category fallback`);

      const categoryMap: Record<IssueCategory, string[]> = {
        Economic: ['economy', 'trade'],
        Social: ['population', 'culture'],
        Political: ['politics'],
        Environmental: ['climate'],
        Security: ['military'],
        Technological: ['technology'],
        Cultural: ['culture'],
        Infrastructure: ['infrastructure'],
      };

      const fallbackSystems = categoryMap[issue.category] || [];
      fallbackSystems.forEach(s => {
        if (systemNames.has(s)) {
          edges.push({
            source: issue.id,
            target: `system-${s}`,
            type: 'issue-system',
            strength: 0.4,
            label: `Category: ${s}`,
            bidirectional: false,
          });
        }
      });
    }
  }

  return edges;
}

function extractSystemEdges(): GraphEdge[] {
  const connectivityPath = join(PARENT_REPO, 'docs/technical/simulation-systems/CONNECTIVITY-INDEX.json');

  if (!existsSync(connectivityPath)) {
    console.warn('⚠️  No connectivity data, skipping system-system edges');
    return [];
  }

  const data = JSON.parse(readFileSync(connectivityPath, 'utf-8'));
  const edges: GraphEdge[] = [];

  if (data.connections && Array.isArray(data.connections)) {
    for (const edge of data.connections) {
      const source = edge.source;
      const target = edge.target;
      const status = edge.implementation || 'Planned';

      // Strength based on implementation status
      const strengthMap: Record<string, number> = {
        Live: 0.8,
        Partial: 0.5,
        Planned: 0.3,
      };

      edges.push({
        source: `system-${source.toLowerCase().replace(/\s+/g, '-')}`,
        target: `system-${target.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'system-system',
        strength: strengthMap[status] || 0.5,
        label: edge.forwardMechanic?.description || '',
        bidirectional: false,
      });
    }
  }

  return edges;
}

async function main() {
  console.log('🔍 Extracting data from Shadow Work...');

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Extract issues
  const rawIssues = parseIssueCatalog();
  console.log(`📋 Found ${rawIssues.length} issues in catalog`);

  const issueNodes = rawIssues.map(issueToNode);
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
