import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { GraphData, GraphNode, GraphEdge, IssueCategory, IssueUrgency } from '../src/types';
import { parseSystemWalkTracker, getSystemWalkData } from './parse-system-walks';
import { loadWikiContent, getWikiArticle, type WikiArticle } from './parse-wiki';

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
  categories: IssueCategory[]; // Multi-category support
  urgency: IssueUrgency;
  description: string;
  tags: string[];
  triggerConditions?: string;
  peakYears?: string;
  crisisExamples?: string[];
  evolutionPaths?: string[];
}

function parseIssueCatalog(multiCategoryData: Map<string, IssueCategory[]>): RawIssue[] {
  const catalogPath = join(PARENT_REPO, 'docs/technical/simulation-systems/ISSUE-CATALOG.md');

  if (!existsSync(catalogPath)) {
    console.warn('⚠️  ISSUE-CATALOG.md not found, using mock data');
    return getMockIssues();
  }

  // Load enhanced descriptions (v3-remapped with catalog IDs, 100% coverage)
  const enhancedDescPath = '/tmp/enhanced-descriptions-v3-remapped.json';
  let enhancedDescriptions: Record<string, { description: string }> = {};
  if (existsSync(enhancedDescPath)) {
    enhancedDescriptions = JSON.parse(readFileSync(enhancedDescPath, 'utf-8'));
    console.log(`✅ Loaded ${Object.keys(enhancedDescriptions).length} enhanced descriptions (v3-remapped, 100% catalog coverage)`);
  } else {
    console.warn('⚠️  Enhanced descriptions not found, using crisis examples as fallback');
  }

  const content = readFileSync(catalogPath, 'utf-8');
  const issues: RawIssue[] = [];

  // Split by ##### to find issues
  const lines = content.split('\n');
  let currentCategory: IssueCategory = 'Technological'; // Default fallback (used if no multi-category data)

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
        // Skip internal references (numbered lists, architecture files, line counts, etc.)
        const isInternalReference =
          /^\d+\.\s+\*\*/.test(nextLine) || // Numbered lists like "1. **46a. 1033 Program"
          /Architecture file:/.test(nextLine) || // Architecture references
          /See architecture:/.test(nextLine) || // Architecture links
          /\.md\]/.test(nextLine) || // Markdown file links
          /~\d+ lines/.test(nextLine) || // Line counts (any variant)
          /\*\*\d+ sub-systems?\*\*/.test(nextLine) || // "**N sub-systems**" or "**N sub-system**"
          /This issue requires/.test(nextLine) || // "This issue requires..."
          /Complete System Walk/.test(nextLine) || // "Complete System Walk with..."
          /^###?\s+/.test(nextLine) || // Markdown headers (### or ##)
          nextLine === name; // Skip if description is just the issue name

        if (!description && nextLine.length > 20 && !nextLine.startsWith('**') && !nextLine.startsWith('-') && !isInternalReference) {
          description = nextLine;
        }
      }

      // Extract tags from name
      const tags = name
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4)
        .slice(0, 3);

      // Use multi-category data if available, otherwise fall back to single category
      const categories = multiCategoryData.get(id) || [currentCategory];

      // Priority: enhanced description > prose description > crisis example > issue name
      let finalDescription = enhancedDescriptions[id]?.description || description;

      if (!finalDescription && crisisExamples.length > 0) {
        // Use first crisis example, clean up the format
        finalDescription = crisisExamples[0]
          .replace(/^[^:]+:\s*/, '') // Remove "Example Name: " prefix
          .trim();
      }
      if (!finalDescription) {
        finalDescription = name; // Last resort: use the issue name
      }

      issues.push({
        id,
        name,
        categories,
        urgency,
        description: finalDescription,
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
      categories: ['Environmental', 'Political'],
      urgency: 'Critical',
      description: 'Accelerating global warming causing extreme weather and ecosystem collapse.',
      tags: ['climate', 'environment', 'crisis'],
    },
    {
      id: 'ai-job-displacement',
      name: 'AI Job Displacement Tsunami',
      categories: ['Technological', 'Economic', 'Social'],
      urgency: 'High',
      description: 'Rapid automation eliminating millions of jobs across multiple sectors.',
      tags: ['ai', 'employment', 'automation'],
    },
    {
      id: 'wealth-inequality',
      name: 'Extreme Wealth Inequality',
      categories: ['Economic', 'Social'],
      urgency: 'Critical',
      description: 'Growing gap between rich and poor destabilizing economies.',
      tags: ['inequality', 'economics', 'social'],
    },
    {
      id: 'democratic-backsliding',
      name: 'Democratic Backsliding',
      categories: ['Political', 'Social'],
      urgency: 'High',
      description: 'Erosion of democratic institutions and norms worldwide.',
      tags: ['democracy', 'politics', 'governance'],
    },
    {
      id: 'cyber-warfare',
      name: 'Cyber Warfare Escalation',
      categories: ['Security', 'Technological'],
      urgency: 'High',
      description: 'State-sponsored cyber attacks threatening critical infrastructure.',
      tags: ['security', 'cyber', 'warfare'],
    },
  ];
}

function issueToNode(
  issue: RawIssue,
  issueNumber: number,
  curatedMappings: Map<string, string[]>,
  systemWalkMap: Map<string, { issueNumber: number; subsystemCount: number; totalLines: number }>
): GraphNode {
  const urgencySizes = {
    Critical: 16,
    High: 12,
    Medium: 8,
    Low: 6,
    Latent: 4,
  };

  // Use first category as primary color (will draw border rings for others)
  const primaryCategory = issue.categories[0];

  // Get system walk data for this issue
  const systemWalk = getSystemWalkData(issue.id, issueNumber, PARENT_REPO, systemWalkMap);

  return {
    id: issue.id,
    type: 'issue',
    label: issue.name,
    categories: issue.categories,
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
    systemWalk,
    color: CATEGORY_COLORS[primaryCategory],
    size: urgencySizes[issue.urgency],
  };
}

interface ConnectivitySystem {
  name: string;
  connections: number;
}

interface ConnectivityData {
  systems: ConnectivitySystem[];
  edges: Array<{ source: string; target: string; implementation: string; phase: string }>;
}

function parseSystemsFromConnectivity(): ConnectivityData {
  const connectivityPath = join(PARENT_REPO, 'docs/technical/simulation-systems/CONNECTIVITY-INDEX.json');

  if (!existsSync(connectivityPath)) {
    console.warn('⚠️  CONNECTIVITY-INDEX.json not found, using mock systems');
    const mockSystems = getMockSystems();
    return { systems: mockSystems, edges: [] };
  }

  const content = readFileSync(connectivityPath, 'utf-8');
  const data = JSON.parse(content);

  // Count connections per system
  const systemConnections = new Map<string, number>();
  const systemEdges: Array<{ source: string; target: string; implementation: string; phase: string }> = [];

  if (data.connections && Array.isArray(data.connections)) {
    for (const edge of data.connections) {
      const source = edge.source;
      const target = edge.target;

      if (source && target) {
        systemConnections.set(source, (systemConnections.get(source) || 0) + 1);
        systemConnections.set(target, (systemConnections.get(target) || 0) + 1);

        // Store edge for later processing
        systemEdges.push({
          source,
          target,
          implementation: edge.implementation || 'Planned',
          phase: edge.phase || 'P0',
        });
      }
    }
  }

  const systems = Array.from(systemConnections.entries()).map(([name, connections]) => ({
    name,
    connections,
  }));

  return { systems, edges: systemEdges };
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
  // Generate ID from system name (kebab-case)
  const id = system.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // System node color (distinct from issue categories)
  const systemColor = '#64748b'; // Slate gray

  // Size based on connection count (4-20px range)
  const size = Math.min(20, Math.max(6, 6 + system.connections / 10));

  return {
    id,
    type: 'system',
    label: system.name,
    description: `Simulation system with ${system.connections} connections`,
    connectionCount: system.connections,
    domain: 'Simulation',
    color: systemColor,
    size,
  };
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

function loadMultiCategoryData(): Map<string, IssueCategory[]> {
  const multiCategoryPath = join(process.cwd(), 'multi-category-all-issues.json');

  if (!existsSync(multiCategoryPath)) {
    console.warn('⚠️  Multi-category data not found, returning empty map');
    return new Map();
  }

  const content = readFileSync(multiCategoryPath, 'utf-8');
  const data = JSON.parse(content);

  const categoryMap = new Map<string, IssueCategory[]>();

  if (data.recategorizations && Array.isArray(data.recategorizations)) {
    for (const recat of data.recategorizations) {
      categoryMap.set(recat.issueId, recat.categories);
    }
  }

  return categoryMap;
}

async function main() {
  console.log('🔍 Extracting data from Shadow Work...');

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Load multi-category data
  const multiCategoryData = loadMultiCategoryData();
  console.log(`🏷️  Loaded ${multiCategoryData.size} multi-category assignments`);

  // Load curated mappings
  const curatedMappings = loadCuratedMappings();
  console.log(`📋 Loaded ${curatedMappings.size} curated issue-system mappings`);

  // Parse system walk tracker
  const systemWalkMap = parseSystemWalkTracker(PARENT_REPO);

  // Extract issues
  const rawIssues = parseIssueCatalog(multiCategoryData);
  console.log(`📋 Found ${rawIssues.length} issues in catalog`);

  const issueNodes = rawIssues.map((issue, index) => issueToNode(issue, index + 1, curatedMappings, systemWalkMap));
  nodes.push(...issueNodes);

  // Extract systems as nodes
  const connectivityData = parseSystemsFromConnectivity();
  console.log(`🎯 Found ${connectivityData.systems.length} systems`);

  const systemNodes = connectivityData.systems.map(system => systemToNode(system));
  nodes.push(...systemNodes);

  // Create system ID map for edge creation
  const systemIdMap = new Map(systemNodes.map(s => [s.label, s.id]));

  // Extract edges
  console.log('🔗 Extracting connections...');

  // 1. Issue-to-issue edges
  const issueEdges = extractIssueEdges(rawIssues);
  console.log(`  - ${issueEdges.length} issue-issue edges`);
  edges.push(...issueEdges);

  // 2. System-to-system edges
  for (const edge of connectivityData.edges) {
    const sourceId = systemIdMap.get(edge.source);
    const targetId = systemIdMap.get(edge.target);

    if (sourceId && targetId) {
      edges.push({
        source: sourceId,
        target: targetId,
        type: 'system-system',
        strength: edge.implementation === 'Live' ? 0.8 : edge.implementation === 'Partial' ? 0.5 : 0.3,
        label: `${edge.implementation} (${edge.phase})`,
        bidirectional: true,
      });
    }
  }
  console.log(`  - ${connectivityData.edges.length} system-system edges`);

  // 3. Issue-to-system edges
  let issueSystemEdgeCount = 0;
  for (const issue of issueNodes) {
    if (issue.affectedSystems && issue.affectedSystems.length > 0) {
      for (const systemName of issue.affectedSystems) {
        const systemId = systemIdMap.get(systemName);
        if (systemId) {
          edges.push({
            source: issue.id,
            target: systemId,
            type: 'issue-system',
            strength: 0.6,
            label: 'affects',
            bidirectional: false,
          });
          issueSystemEdgeCount++;
        }
      }
    }
  }
  console.log(`  - ${issueSystemEdgeCount} issue-system edges`);

  // Load wiki articles
  console.log('📚 Loading wiki articles...');
  const wikiContent = loadWikiContent();

  // Create wiki articles map for output
  const wikiArticles: Record<string, WikiArticle> = {};

  // Attach wiki article metadata to nodes
  for (const node of nodes) {
    const article = getWikiArticle(node.id, node.type as 'issue' | 'system', wikiContent);
    if (article) {
      // Add hasArticle flag to node
      node.hasArticle = true;
      node.wordCount = article.wordCount;

      // Store full article content separately
      wikiArticles[node.id] = article;
    }
  }

  console.log(`  - ${wikiContent.issues.size} issue articles`);
  console.log(`  - ${wikiContent.systems.size} system articles`);

  const data: GraphData = {
    nodes,
    edges,
    articles: wikiArticles, // Include full articles
    metadata: {
      generatedAt: new Date().toISOString(),
      issueCount: nodes.filter(n => n.type === 'issue').length,
      systemCount: nodes.filter(n => n.type === 'system').length,
      edgeCount: edges.length,
      articleCount: Object.keys(wikiArticles).length,
    },
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`✅ Extracted ${data.metadata.issueCount} issues, ${data.metadata.systemCount} systems, ${data.metadata.edgeCount} edges, ${data.metadata.articleCount} articles`);
  console.log(`📦 Wrote to ${OUTPUT_PATH}`);
}

main().catch(console.error);
