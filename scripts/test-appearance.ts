import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateAgent, type AgentVocabV1, type AgentPriorsV1, type ShadowCountryMapEntry } from '../src/agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJsonFile<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, '..', relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

const vocab = loadJsonFile<AgentVocabV1>('public/agent-vocab.v1.json');
const priors = loadJsonFile<AgentPriorsV1>('public/agent-priors.v1.json');
const countries = loadJsonFile<ShadowCountryMapEntry[]>('public/shadow-country-map.json');

// Debug: Check priors structure
console.log('Debug priors structure:');
console.log('  priors.countries type:', typeof priors.countries);
console.log('  priors.countries.USA exists:', !!priors.countries?.['USA']);
console.log('  USA bucket 2020 exists:', !!(priors.countries as Record<string, unknown>)?.['USA'] && !!(priors.countries as Record<string,{buckets:Record<string,unknown>}>)['USA']?.buckets?.['2020']);
const usaBucket = (priors.countries as Record<string,{buckets:Record<string,{cultureProfileWeights01k?:unknown}>}>)?.['USA']?.buckets?.['2020'];
console.log('  USA 2020 cultureProfileWeights01k exists:', !!usaBucket?.cultureProfileWeights01k);
if (usaBucket?.cultureProfileWeights01k) {
  const weights = usaBucket.cultureProfileWeights01k as Record<string,number>;
  const top = Object.entries(weights).sort((a,b)=>b[1]-a[1]).slice(0,3);
  console.log('  Top 3 culture weights:', top);
}

// All cultures with weights defined in appearance.ts
const definedCultures = new Set([
  // European
  'norrenic', 'teutonic', 'alvionic', 'gallicene', 'castillaran', 'lusitanic',
  'slavonic', 'helladic', 'illyric', 'aestic', 'bohemic', 'dacian', 'magyric',
  'boeric', 'laurentian',
  // East Asian
  'tianlongic', 'kamikuran', 'haedongic', 'hannic', 'yuehai', 'khalkhan',
  // Southeast Asian
  'nusantaran', 'siamic', 'maharlikan', 'melakan',
  // South Asian
  'bharatic', 'sindhukan', 'dravidic', 'gangetic', 'gorkhalic',
  // Middle East / Central Asia
  'aramaic', 'parsic', 'anatolian', 'levantic', 'khalijic', 'kedaric',
  'kartvelian', 'sogdian', 'hyperborean', 'post-severnyan',
  // African
  'deshretine', 'sawahili', 'oduwan', 'sahelian', 'khoiveldic', 'tamazight',
  'puntic', 'ashantic', 'cushitic', 'fulanic', 'wolofic', 'zagwenic',
  // Americas / Pacific
  'vesperic', 'turtleic', 'chicanic', 'afro-alvionic', 'afro-lusitanic',
  'antillean', 'antillean-gallicene', 'tawantinsuyan', 'oceanic',
  'pelagic-pidgin', 'mascarene', 'sarmatian',
  // Global
  'cosmopolitan'
]);
const targetCultures = [...definedCultures];
const appearanceByC = new Map<string, { hair: Map<string,number>, eyes: Map<string,number>, tex: Map<string,number>, count: number }>();

console.log('\nGenerating 500 agents...\n');
console.log('First 20 agents (name | macroCulture | microCulture | hair | eyes):');
console.log('-'.repeat(90));

for (let i = 0; i < 2000; i++) {
  const agent = generateAgent({ seed: 'test-app-' + i, vocab, priors, countries, asOfYear: 2024, includeTrace: true });

  // Get the micro culture from the generation trace
  const trace = agent.generationTrace;
  const microTop = trace?.derived?.microCultureProfilesTop as Array<{profileId: string, weight01k: number}> | undefined;
  const microCulture = microTop?.[0]?.profileId?.replace('profile:', '') ?? 'none';
  const macroCulture = agent.identity.homeCulture;

  // Debug first agent
  if (i === 0) {
    console.log('\nDebug first agent trace:');
    console.log('  trace.derived keys:', Object.keys(trace?.derived ?? {}));
    console.log('  microCultureProfilesTop:', microTop);
    console.log('  homeCountry:', agent.identity.homeCountryIso3);
    console.log('');
  }

  // Show first 20 agents
  if (i < 20) {
    const name = agent.identity.name.padEnd(22);
    const hair = `${agent.appearance.hair.color}, ${agent.appearance.hair.texture}`.padEnd(25);
    const eyes = agent.appearance.eyes.color;
    console.log(`${name} | ${macroCulture.padEnd(12)} | ${microCulture.padEnd(15)} | ${hair} | ${eyes}`);
  }

  // Track by micro-culture profile
  if (!appearanceByC.has(microCulture)) {
    appearanceByC.set(microCulture, { hair: new Map(), eyes: new Map(), tex: new Map(), count: 0 });
  }
  const stats = appearanceByC.get(microCulture)!;
  stats.count++;
  const h = agent.appearance.hair.color;
  const e = agent.appearance.eyes.color;
  const t = agent.appearance.hair.texture;
  stats.hair.set(h, (stats.hair.get(h) ?? 0) + 1);
  stats.eyes.set(e, (stats.eyes.get(e) ?? 0) + 1);
  stats.tex.set(t, (stats.tex.get(t) ?? 0) + 1);
}

// Show results for target cultures
console.log('\n' + '='.repeat(80));
console.log('APPEARANCE DISTRIBUTION BY MICRO-CULTURE');
console.log('='.repeat(80));

for (const c of targetCultures) {
  const stats = appearanceByC.get(c);
  if (!stats || stats.count < 3) continue;
  console.log('');
  console.log(`=== ${c} (n=${stats.count}) ===`);
  console.log('Hair color:', [...stats.hair.entries()].sort((a,b) => b[1]-a[1]).slice(0,5).map(([k,v]) => k + ':' + v).join(', '));
  console.log('Hair tex:', [...stats.tex.entries()].sort((a,b) => b[1]-a[1]).slice(0,4).map(([k,v]) => k + ':' + v).join(', '));
  console.log('Eye color:', [...stats.eyes.entries()].sort((a,b) => b[1]-a[1]).slice(0,5).map(([k,v]) => k + ':' + v).join(', '));
}

// Show which micro-cultures have no weight mappings
const unmapped = [...appearanceByC.keys()].filter(c => !definedCultures.has(c) && c !== 'none');
if (unmapped.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('MICRO-CULTURES WITHOUT CUSTOM WEIGHTS (using fallback):');
  console.log(unmapped.sort().join(', '));
}

// Count of none
const noneStats = appearanceByC.get('none');
if (noneStats && noneStats.count > 0) {
  console.log(`\nWARNING: ${noneStats.count} agents have no microCulture (using Global fallback)`);
}

console.log('\nDone!');
