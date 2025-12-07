/**
 * extract-principles.ts
 *
 * Extracts Design Principles from System Walk 2.0 ARCHITECTURE docs
 * and generates wiki articles for Shadow Workipedia.
 *
 * Pattern: **Principle-Name-In-Kebab-Case**: Description with mechanics...
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const PARENT_REPO = join(process.cwd(), '..');
const ARCHITECTURE_DIR = join(PARENT_REPO, 'docs/technical/simulation-systems');
const PRINCIPLES_OUTPUT_DIR = join(process.cwd(), 'wiki/principles');
const DATA_FLOWS_OUTPUT = join(process.cwd(), 'data/system-data-flows.json');

interface ExtractedPrinciple {
  id: string;           // kebab-case-id
  name: string;         // Human-readable name
  description: string;  // Full description text
  sourceFile: string;   // Source ARCHITECTURE file
  sourceSystem: string; // System Walk number and name
  lineNumber: number;   // Line number in source
  thresholds: string[]; // Extracted threshold values
  relatedPrinciples: string[]; // Other principles mentioned
  systems: string[];    // Connected systems
}

interface DataFlow {
  source: string;       // Source system
  target: string;       // Target system
  data: string[];       // Data elements flowing
  direction: 'reads' | 'writes';
}

interface ExtractionResult {
  principles: ExtractedPrinciple[];
  dataFlows: DataFlow[];
  stats: {
    filesProcessed: number;
    principlesFound: number;
    dataFlowsFound: number;
  };
}

// Pattern to match design principles: **Principle-Name**: Description
// Must have at least 2 kebab-case parts and a colon
const PRINCIPLE_PATTERN = /\*\*([A-Z][a-zA-Z]+-[A-Za-z-]+)\*\*:\s*(.+?)(?=\n\n|\n\d+\.|$)/gs;

// Pattern to extract thresholds: numbers with units, percentages, comparisons
const THRESHOLD_PATTERN = /(?:>|<|>=|<=|=)\s*[\d.]+%?|[\d.]+[×x]\s*|[\d.]+%|[\d,]+\s*(?:ton|kg|km|GW|MW|year|month|week|day|hour)/gi;

// Pattern to match system references: SW#NN, #NN, System #NN
const SYSTEM_REF_PATTERN = /(?:SW|#|System\s+#?)(\d+)/gi;

function extractPrinciplesFromFile(filePath: string): ExtractedPrinciple[] {
  const content = readFileSync(filePath, 'utf-8');
  const fileName = basename(filePath);
  const principles: ExtractedPrinciple[] = [];

  // Extract system info from filename (e.g., "44-climate-insurance-collapse-ARCHITECTURE.md")
  const systemMatch = fileName.match(/^(\d+[a-z]?)-(.+)-ARCHITECTURE\.md$/);
  const systemNumber = systemMatch?.[1] || 'unknown';
  const systemName = systemMatch?.[2]?.replace(/-/g, ' ') || fileName;

  let match;
  while ((match = PRINCIPLE_PATTERN.exec(content)) !== null) {
    const rawName = match[1];
    const description = match[2].trim();

    // Skip if it's too short or doesn't look like a real principle
    if (rawName.length < 10 || description.length < 50) continue;

    // Skip common non-principle patterns
    if (rawName.match(/^(Sub-System|Cross-System|Key-Insight)$/i)) continue;

    // Convert kebab-case to id and readable name
    const id = rawName.toLowerCase();
    const name = rawName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // Find line number
    const lineNumber = content.substring(0, match.index).split('\n').length;

    // Extract thresholds from description
    const thresholds = [...description.matchAll(THRESHOLD_PATTERN)].map(m => m[0]);

    // Extract system references
    const systemRefs = [...description.matchAll(SYSTEM_REF_PATTERN)].map(m => m[1]);

    // Find related principles mentioned in description
    const relatedPrinciples: string[] = [];
    const relatedMatch = description.matchAll(/\*\*([A-Z][a-zA-Z]+-[A-Za-z-]+)\*\*/g);
    for (const rm of relatedMatch) {
      if (rm[1] !== rawName) {
        relatedPrinciples.push(rm[1].toLowerCase());
      }
    }

    principles.push({
      id,
      name,
      description,
      sourceFile: fileName,
      sourceSystem: `SW#${systemNumber}: ${systemName}`,
      lineNumber,
      thresholds: [...new Set(thresholds)],
      relatedPrinciples: [...new Set(relatedPrinciples)],
      systems: [...new Set(systemRefs)],
    });
  }

  return principles;
}

function extractDataFlowsFromFile(filePath: string): DataFlow[] {
  const content = readFileSync(filePath, 'utf-8');
  const dataFlows: DataFlow[] = [];
  const fileName = basename(filePath);

  // Extract system number from filename
  const systemMatch = fileName.match(/^(\d+)/);
  const sourceSystem = systemMatch ? `SW#${systemMatch[1]}` : fileName;

  // Pattern for "READS FROM:" sections
  const readsPattern = /READS\s+FROM[:\s]+([^\n]+)/gi;
  let match;
  while ((match = readsPattern.exec(content)) !== null) {
    const targets = match[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
    for (const target of targets) {
      const systemRef = target.match(/(?:SW)?#?(\d+)/);
      if (systemRef) {
        dataFlows.push({
          source: `SW#${systemRef[1]}`,
          target: sourceSystem,
          data: [],
          direction: 'reads',
        });
      }
    }
  }

  // Pattern for "WRITES TO:" sections
  const writesPattern = /WRITES\s+TO[:\s]+([^\n]+)/gi;
  while ((match = writesPattern.exec(content)) !== null) {
    const targets = match[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
    for (const target of targets) {
      const systemRef = target.match(/(?:SW)?#?(\d+)/);
      if (systemRef) {
        dataFlows.push({
          source: sourceSystem,
          target: `SW#${systemRef[1]}`,
          data: [],
          direction: 'writes',
        });
      }
    }
  }

  // Also extract from Integration Flow ASCII diagrams
  // Pattern: "→ SW#NN" or "──► SW#NN"
  const flowArrowPattern = /(?:→|──►|--►)\s*(?:SW)?#?(\d+)/gi;
  while ((match = flowArrowPattern.exec(content)) !== null) {
    dataFlows.push({
      source: sourceSystem,
      target: `SW#${match[1]}`,
      data: [],
      direction: 'writes',
    });
  }

  return dataFlows;
}

function generatePrincipleArticle(principle: ExtractedPrinciple): string {
  // Note: Thresholds are already embedded in the description with full context
  // Extracting them separately loses meaning, so we skip the thresholds section

  const relatedSection = principle.relatedPrinciples.length > 0
    ? `\n## Related Principles\n\n${principle.relatedPrinciples.map(p => `- [[${p}]]`).join('\n')}\n`
    : '';

  const systemsSection = principle.systems.length > 0
    ? `\n## Connected Systems\n\n${principle.systems.map(s => `- System #${s}`).join('\n')}\n`
    : '';

  // Extract issue slug from filename: "44-climate-insurance-collapse-ARCHITECTURE.md" → "climate-insurance-collapse"
  const issueSlug = principle.sourceFile.match(/^\d+[a-z]?-(.+)-ARCHITECTURE\.md$/)?.[1] || '';
  // Convert slug to readable name: "climate-insurance-collapse" → "Climate Insurance Collapse"
  const issueName = issueSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const sourceLink = issueSlug
    ? `[${issueName}](#/wiki/${issueSlug})`
    : `**${principle.sourceSystem}**`;

  return `---
name: "${principle.name}"
id: ${principle.id}
source: ${principle.sourceFile}
system: "${principle.sourceSystem}"
category: principle
---

# ${principle.name}

${principle.description}
${relatedSection}${systemsSection}
## Source

Extracted from ${sourceLink} at line ${principle.lineNumber}.
`;
}

async function main() {
  console.log('🔍 Extracting Design Principles from System Walk 2.0 docs...\n');

  // Create output directories
  if (!existsSync(PRINCIPLES_OUTPUT_DIR)) {
    mkdirSync(PRINCIPLES_OUTPUT_DIR, { recursive: true });
  }

  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Find all ARCHITECTURE files
  const archFiles: string[] = [];

  function scanDir(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'archive') {
        scanDir(fullPath);
      } else if (entry.name.endsWith('-ARCHITECTURE.md')) {
        archFiles.push(fullPath);
      }
    }
  }

  scanDir(ARCHITECTURE_DIR);
  console.log(`📁 Found ${archFiles.length} ARCHITECTURE files\n`);

  // Extract principles and data flows
  const allPrinciples: ExtractedPrinciple[] = [];
  const allDataFlows: DataFlow[] = [];

  for (const file of archFiles) {
    const principles = extractPrinciplesFromFile(file);
    const dataFlows = extractDataFlowsFromFile(file);

    if (principles.length > 0) {
      console.log(`  ✅ ${basename(file)}: ${principles.length} principles`);
    }

    allPrinciples.push(...principles);
    allDataFlows.push(...dataFlows);
  }

  // Deduplicate principles by ID
  const principleMap = new Map<string, ExtractedPrinciple>();
  for (const p of allPrinciples) {
    if (!principleMap.has(p.id) || p.description.length > principleMap.get(p.id)!.description.length) {
      principleMap.set(p.id, p);
    }
  }
  const uniquePrinciples = Array.from(principleMap.values());

  // Sort principles by name
  uniquePrinciples.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\n📊 Extraction Summary:`);
  console.log(`   - Files processed: ${archFiles.length}`);
  console.log(`   - Principles found: ${allPrinciples.length} (${uniquePrinciples.length} unique)`);
  console.log(`   - Data flows found: ${allDataFlows.length}`);

  // Generate principle articles
  console.log(`\n📝 Generating principle articles...`);
  let articlesWritten = 0;

  for (const principle of uniquePrinciples) {
    const articleContent = generatePrincipleArticle(principle);
    const articlePath = join(PRINCIPLES_OUTPUT_DIR, `${principle.id}.md`);
    writeFileSync(articlePath, articleContent);
    articlesWritten++;
  }

  console.log(`   - Wrote ${articlesWritten} article files to wiki/principles/`);

  // Write data flows JSON
  const dataFlowsData = {
    generatedAt: new Date().toISOString(),
    flows: allDataFlows,
    stats: {
      totalFlows: allDataFlows.length,
      uniqueSources: [...new Set(allDataFlows.map(f => f.source))].length,
      uniqueTargets: [...new Set(allDataFlows.map(f => f.target))].length,
    },
  };

  writeFileSync(DATA_FLOWS_OUTPUT, JSON.stringify(dataFlowsData, null, 2));
  console.log(`   - Wrote data flows to data/system-data-flows.json`);

  // Write principles index
  const principlesIndex = {
    generatedAt: new Date().toISOString(),
    count: uniquePrinciples.length,
    principles: uniquePrinciples.map(p => ({
      id: p.id,
      name: p.name,
      system: p.sourceSystem,
      sourceFile: p.sourceFile,
      thresholdCount: p.thresholds.length,
    })),
  };

  writeFileSync(join(dataDir, 'principles-index.json'), JSON.stringify(principlesIndex, null, 2));
  console.log(`   - Wrote principles index to data/principles-index.json`);

  console.log(`\n✅ Done!`);
}

main().catch(console.error);
