import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PARENT_REPO = join(process.cwd(), '..');
const WIKI_SYSTEMS_DIR = join(process.cwd(), 'wiki', 'systems');

// Core systems with their doc file mappings
const CORE_SYSTEMS = new Map([
  ['climate', '01-climate-system.md'],
  ['technology', '02-technology-system.md'],
  ['diplomacy', '03-diplomacy-system.md'],
  ['economy', '04-economy-system.md'],
  ['population', '05-population-system.md'],
  ['pandemic', '06-pandemic-system.md'],
  ['politics', '11-politics-system.md'],
  ['culture', '12-culture-system.md'],
  ['institutions', '13-institutions-system.md'],
  ['healthcare', '19-healthcare-system.md'],
]);

// System descriptions for those without detailed docs
const SYSTEM_DESCRIPTIONS: Record<string, {
  overview: string;
  simulates: string[];
  gameplay: string[];
}> = {
  'geography': {
    overview: 'The Geography system models physical terrain, natural resources distribution, strategic locations, and how geographical features shape political and economic possibilities.',
    simulates: ['Terrain types and natural barriers', 'Resource distribution and accessibility', 'Strategic chokepoints and trade routes', 'Climate zones and habitability'],
    gameplay: ['Geographic advantages/disadvantages shape development paths', 'Resource locations drive conflict and cooperation', 'Natural barriers affect military and trade'],
  },
  'infrastructure': {
    overview: 'The Infrastructure system tracks physical networks—roads, ports, power grids, communications—that enable economic activity and state capacity.',
    simulates: ['Transportation networks (roads, rail, ports, airports)', 'Energy infrastructure (power plants, grids, pipelines)', 'Communications (internet, telecom)', 'Water and sanitation systems'],
    gameplay: ['Infrastructure investment enables growth', 'Network vulnerabilities create cascade risks', 'Modernization vs. maintenance tradeoffs'],
  },
  'resources': {
    overview: 'The Resources system models natural resource extraction, depletion, trade, and the economic/political consequences of resource abundance or scarcity.',
    simulates: ['Fossil fuels, minerals, and rare earths', 'Renewable resources and sustainability', 'Resource depletion and discovery', 'Resource curse dynamics'],
    gameplay: ['Resource wealth can fund development or fuel corruption', 'Depletion timelines force transition planning', 'Resource dependencies create vulnerabilities'],
  },
  'military': {
    overview: 'The Military system models armed forces capabilities, defense spending, military technology, and the use of force in international relations.',
    simulates: ['Force structure and capabilities', 'Defense spending and procurement', 'Military technology advancement', 'Power projection and deterrence'],
    gameplay: ['Military strength enables or constrains foreign policy', 'Arms races consume resources', 'War as failure of other systems'],
  },
  'trade': {
    overview: 'The Trade system models international commerce, supply chains, trade agreements, and the economic interdependencies between nations.',
    simulates: ['Import/export flows and trade balances', 'Supply chain networks and vulnerabilities', 'Trade agreements and tariffs', 'Currency exchange and financial flows'],
    gameplay: ['Trade creates mutual dependencies', 'Supply chain disruptions cascade globally', 'Trade policy as economic and political tool'],
  },
  'education': {
    overview: 'The Education system models human capital development, literacy, workforce skills, and the long-term effects of educational investment.',
    simulates: ['Primary/secondary enrollment and quality', 'Higher education and research', 'Vocational training and skills', 'Educational inequality'],
    gameplay: ['Education investment has 15-20 year lag', 'Workforce quality affects economic potential', 'Brain drain and retention challenges'],
  },
  'public-finance': {
    overview: 'The Public Finance system models government revenue, spending, debt, and the fiscal constraints that shape policy options.',
    simulates: ['Tax revenue and collection efficiency', 'Government spending priorities', 'Sovereign debt and borrowing', 'Budget deficits and surpluses'],
    gameplay: ['Fiscal capacity determines state options', 'Debt crises trigger austerity or default', 'Tax policy shapes economic incentives'],
  },
  'media': {
    overview: 'The Media system models information flows, press freedom, propaganda, and how public opinion is shaped and mobilized.',
    simulates: ['Traditional and social media reach', 'Press freedom and censorship', 'Information warfare and propaganda', 'Public opinion formation'],
    gameplay: ['Media shapes what issues become salient', 'Information control enables or constrains governance', 'Misinformation destabilizes'],
  },
  'international-organizations': {
    overview: 'The International Organizations system models multilateral institutions—UN, IMF, regional bodies—and their capacity to coordinate global action.',
    simulates: ['UN and specialized agencies', 'Regional organizations (EU, AU, ASEAN)', 'Financial institutions (IMF, World Bank)', 'Treaty regimes and compliance'],
    gameplay: ['IOs provide coordination mechanisms', 'Legitimacy affects compliance', 'Institutional reform is slow'],
  },
  'philanthropic-foundations': {
    overview: 'The Philanthropic Foundations system models private charitable giving, foundation activities, and their influence on public policy and development.',
    simulates: ['Foundation funding priorities', 'Public-private partnerships', 'Influence on policy and research', 'Accountability and effectiveness'],
    gameplay: ['Foundations can pilot innovations', 'Wealth concentration enables outsized influence', 'Sustainability without ongoing support'],
  },
  'civil-conflict': {
    overview: 'The Civil Conflict system models internal armed conflicts, insurgencies, civil wars, and the conditions that generate or resolve them.',
    simulates: ['Rebel group formation and capacity', 'Government counterinsurgency', 'Conflict duration and intensity', 'Peace processes and settlements'],
    gameplay: ['Civil wars devastate development', 'Conflict traps are hard to escape', 'External intervention shapes outcomes'],
  },
  'homelessness-crisis-response': {
    overview: 'The Homelessness Crisis Response system models housing instability, shelter systems, and policy responses to chronic and acute homelessness.',
    simulates: ['Housing affordability and availability', 'Shelter and supportive services', 'Mental health and addiction intersections', 'Policy interventions and effectiveness'],
    gameplay: ['Housing-first vs. conditional approaches', 'Cost-benefit of prevention vs. response', 'Visibility drives political pressure'],
  },
};

interface SystemData {
  id: string;
  label: string;
  connectionCount: number;
}

function extractOverviewFromDoc(docPath: string): string | null {
  if (!existsSync(docPath)) return null;

  const content = readFileSync(docPath, 'utf-8');
  const lines = content.split('\n');

  // Find ## Overview section
  let inOverview = false;
  const overviewLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## Overview') || line.startsWith('## System Overview')) {
      inOverview = true;
      continue;
    }
    if (inOverview && line.startsWith('## ')) {
      break;
    }
    if (inOverview && line.trim()) {
      // Skip markdown headers and lists for now
      if (!line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
        overviewLines.push(line);
      }
    }
  }

  return overviewLines.slice(0, 3).join(' ').trim() || null;
}

function generateSystemWiki(system: SystemData): string {
  const isSubsystem = system.label.includes('(');
  const parentSystem = isSubsystem ? system.label.split('(')[0].trim() : null;
  const subsystemName = isSubsystem ? system.label.match(/\(([^)]+)\)/)?.[1] : null;

  // Try to get overview from parent repo docs
  let overview = '';
  let simulates: string[] = [];
  let gameplay: string[] = [];

  if (CORE_SYSTEMS.has(system.id)) {
    const docFile = CORE_SYSTEMS.get(system.id)!;
    const docPath = join(PARENT_REPO, 'docs/technical/simulation-systems', docFile);
    const extractedOverview = extractOverviewFromDoc(docPath);
    if (extractedOverview) {
      overview = extractedOverview;
    }
  }

  // Fall back to predefined descriptions
  if (!overview && SYSTEM_DESCRIPTIONS[system.id]) {
    overview = SYSTEM_DESCRIPTIONS[system.id].overview;
    simulates = SYSTEM_DESCRIPTIONS[system.id].simulates;
    gameplay = SYSTEM_DESCRIPTIONS[system.id].gameplay;
  }

  // Generic fallback for subsystems
  if (!overview) {
    if (isSubsystem) {
      overview = `The ${system.label} subsystem extends the core ${parentSystem} system with specialized modeling of ${subsystemName?.toLowerCase() || 'specific'} dynamics. It tracks detailed interactions that affect how ${parentSystem?.toLowerCase() || 'the parent system'} evolves.`;
    } else {
      overview = `The ${system.label} system models key dynamics that shape global outcomes. It interacts with ${system.connectionCount} other systems in the simulation.`;
    }
  }

  const simulatesSection = simulates.length > 0
    ? `## What It Simulates

${simulates.map(s => `- **${s.split(':')[0]}**${s.includes(':') ? `: ${s.split(':')[1]}` : ''}`).join('\n')}`
    : '';

  const gameplaySection = gameplay.length > 0
    ? `## How It Affects Gameplay

${gameplay.map(g => `- ${g}`).join('\n')}`
    : '';

  return `---
id: ${system.id}
title: ${system.label}
domain: Simulation
relatedSystems: []
editedBy: Shadow Work Team
lastUpdated: 2025-11-25
---

# ${system.label}

## Overview

${overview}
${simulatesSection ? '\n' + simulatesSection : ''}
${gameplaySection ? '\n' + gameplaySection : ''}

## System Connections

This system has ${system.connectionCount} connections to other systems in the simulation graph. These connections represent data flows, dependencies, and feedback loops that create emergent behavior.

---

*Connected issues and related systems are automatically populated from the graph.*

**Contributors**: Shadow Work Team
**Last Updated**: 2025-11-25
**Edit on GitHub**: [Suggest changes](https://github.com/mistakeknot/shadow-workipedia/edit/main/wiki/systems/${system.id}.md)
`;
}

async function main() {
  // Load system data from data.json
  const dataPath = join(process.cwd(), 'public', 'data.json');
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

  const systems: SystemData[] = data.nodes
    .filter((n: any) => n.type === 'system')
    .map((n: any) => ({
      id: n.id,
      label: n.label,
      connectionCount: n.connectionCount || 0,
    }));

  console.log(`📋 Found ${systems.length} systems to generate wiki pages for`);

  let generated = 0;
  let skipped = 0;

  for (const system of systems) {
    const outputPath = join(WIKI_SYSTEMS_DIR, `${system.id}.md`);

    // Skip if already exists (like economy.md)
    if (existsSync(outputPath)) {
      console.log(`⏭️  Skipping ${system.id} (already exists)`);
      skipped++;
      continue;
    }

    const content = generateSystemWiki(system);
    writeFileSync(outputPath, content);
    console.log(`✅ Generated ${system.id}.md`);
    generated++;
  }

  console.log(`\n📊 Summary: ${generated} generated, ${skipped} skipped`);
}

main().catch(console.error);
