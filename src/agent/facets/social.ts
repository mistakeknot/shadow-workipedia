/**
 * Social Facet - Agent social positioning and relationships
 *
 * Handles:
 * - Subnational geography (urbanicity, diaspora status)
 * - Family structure (marital status, dependents, living parents/siblings)
 * - Key relationships (patron, mentor, rival, etc.)
 * - Network position (role, faction alignment, leverage type)
 */

import type {
  Fixed,
  Band5,
  TierBand,
  AgentVocabV1,
  AgentGenerationTraceV1,
  Latents,
  Urbanicity,
  DiasporaStatus,
  MaritalStatus,
  RelationshipType,
  NetworkRole,
  CommunityType,
  CommunityRole,
  CommunityStatus,
  ReputationTag,
  KeepsakeType,
  PlaceAttachment,
  DependentNonHuman,
  CivicEngagement,
  IdeologyTag,
} from '../types';

import {
  makeRng,
  facetSeed,
  band5From01k,
  weightedPick,
  traceSet,
  traceFacet,
} from '../utils';

// ============================================================================
// Types
// ============================================================================

export type LeverageType = 'favors' | 'information' | 'money' | 'ideology' | 'care';

export type SocialContext = {
  seed: string;
  vocab: AgentVocabV1;
  latents: Latents;
  tierBand: TierBand;
  age: number;
  roleSeedTags: string[];
  trace?: AgentGenerationTraceV1;

  // Country context for diaspora weighting
  homeCountryIso3: string;
  currentCountryIso3: string;
  securityPressure01k?: number;

  // Derived values for network position
  cosmo01: number;
  opsec01: number;
  inst01: number;
  principledness01: number;
  aptitudes: {
    deceptionAptitude: Fixed;
    cognitiveSpeed: Fixed;
    empathy: Fixed;
  };
};

export type RelationshipEntry = {
  type: RelationshipType;
  strength: Band5;
  description: string;
};

/** Community membership entry */
export type CommunityMembership = {
  type: CommunityType;
  role: CommunityRole;
  intensityBand: Band5;
};

/** Reputation across different contexts */
export type ReputationResult = {
  professional: ReputationTag;
  neighborhood: ReputationTag;
  online: ReputationTag;
  scandalSensitivity: Band5;
};

/** Sentimental attachments */
export type AttachmentsResult = {
  keepsake: KeepsakeType;
  placeAttachment: PlaceAttachment;
  dependentNonHuman: DependentNonHuman;
};

/** Civic and political life */
export type CivicLifeResult = {
  engagement: CivicEngagement;
  ideology: IdeologyTag;
  tabooTopics: string[];
};

/** Communities result */
export type CommunitiesResult = {
  memberships: CommunityMembership[];
  onlineCommunities: string[];
  communityStatus: CommunityStatus;
};

export type SocialResult = {
  // Subnational geography
  geography: {
    originRegion: string | null;
    urbanicity: Urbanicity;
    diasporaStatus: DiasporaStatus;
  };

  // Family structure
  family: {
    maritalStatus: MaritalStatus;
    dependentCount: number;
    hasLivingParents: boolean;
    hasSiblings: boolean;
  };

  // Key relationships
  relationships: RelationshipEntry[];

  // Network position
  network: {
    role: NetworkRole;
    factionAlignment: string | null;
    leverageType: LeverageType;
  };

  // Oracle-recommended facets
  communities: CommunitiesResult;
  reputation: ReputationResult;
  attachments: AttachmentsResult;
  civicLife: CivicLifeResult;
};

// ============================================================================
// Main Computation
// ============================================================================

export function computeSocial(ctx: SocialContext): SocialResult {
  const {
    seed,
    vocab,
    latents,
    tierBand,
    age,
    roleSeedTags,
    trace,
    homeCountryIso3,
    currentCountryIso3,
    securityPressure01k = 0,
    cosmo01,
    opsec01,
    inst01,
    principledness01,
    aptitudes,
  } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // GEOGRAPHY (Oracle recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'geography');
  const geoRng = makeRng(facetSeed(seed, 'geography'));
  const urbanicityTags = vocab.geography?.urbanicityTags ?? ['rural', 'small-town', 'secondary-city', 'capital', 'megacity', 'peri-urban'];
  const diasporaStatusTags = vocab.geography?.diasporaStatusTags ?? ['native', 'internal-migrant', 'expat', 'refugee', 'dual-citizen', 'borderland', 'diaspora-child'];

  // Urbanicity based on tier
  const urbanicityWeights = urbanicityTags.map(u => {
    let w = 1;
    if (u === 'capital' && tierBand === 'elite') w = 10;
    if (u === 'megacity' && tierBand === 'elite') w = 5;
    if (u === 'secondary-city' && tierBand === 'middle') w = 5;
    if (u === 'rural' && tierBand === 'mass') w = 4;
    if (u === 'small-town' && tierBand === 'mass') w = 3;
    return { item: u as Urbanicity, weight: w };
  });
  const urbanicity = weightedPick(geoRng, urbanicityWeights) as Urbanicity;

  // Diaspora status
  const diasporaWeights = diasporaStatusTags.map(d => {
    let w = 1;
    if (d === 'native' && homeCountryIso3 === currentCountryIso3) w = 70;
    if (d === 'expat' && homeCountryIso3 !== currentCountryIso3 && tierBand === 'elite') w = 20;
    if (d === 'internal-migrant' && (urbanicity === 'capital' || urbanicity === 'megacity')) w = 8;
    if (d === 'refugee' && securityPressure01k > 600) w = 5;
    if (d === 'diaspora-child' && geoRng.next01() < 0.1) w = 3;
    return { item: d as DiasporaStatus, weight: w };
  });
  const diasporaStatus = weightedPick(geoRng, diasporaWeights) as DiasporaStatus;

  // Origin region - null for now, could be enhanced with country-specific data
  const originRegion: string | null = null;

  traceSet(trace, 'geography', { urbanicity, diasporaStatus, originRegion }, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────────
  // FAMILY (Oracle recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'family');
  const familyRng = makeRng(facetSeed(seed, 'family'));
  const maritalStatusTags = vocab.family?.maritalStatusTags ?? ['single', 'partnered', 'married', 'divorced', 'widowed', 'its-complicated'];

  // Marital status based on age
  const maritalWeights = maritalStatusTags.map(m => {
    let w = 1;
    if (m === 'single' && age < 30) w = 40;
    if (m === 'single' && age >= 30 && age < 45) w = 15;
    if (m === 'partnered' && age >= 25 && age < 40) w = 20;
    if (m === 'married' && age >= 30) w = 35;
    if (m === 'divorced' && age >= 35) w = 8;
    if (m === 'widowed' && age >= 50) w = 5;
    if (m === 'its-complicated' && roleSeedTags.includes('operative')) w = 3;
    return { item: m as MaritalStatus, weight: w };
  });
  const maritalStatus = weightedPick(familyRng, maritalWeights) as MaritalStatus;

  // Dependents based on age and marital status
  const baseDependentChance = maritalStatus === 'married' ? 0.7 : maritalStatus === 'divorced' ? 0.5 : 0.2;
  const dependentCount = age >= 28 && familyRng.next01() < baseDependentChance
    ? familyRng.int(1, age >= 40 ? 3 : 2)
    : 0;

  const hasLivingParents = age < 50 || familyRng.next01() < 0.6;
  const hasSiblings = familyRng.next01() < 0.75;

  traceSet(trace, 'family', { maritalStatus, dependentCount, hasLivingParents, hasSiblings }, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────────
  // RELATIONSHIPS (Oracle recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'relationships');
  const relRng = makeRng(facetSeed(seed, 'relationships'));
  const relationshipTypes = vocab.family?.relationshipTypes ?? ['patron', 'mentor', 'rival', 'protege', 'handler', 'asset', 'ex-partner', 'family-tie', 'old-classmate', 'debt-holder'];

  // Generate 2-4 key relationships
  const relationshipCount = relRng.int(2, 4);
  const relationships: RelationshipEntry[] = [];
  const usedTypes = new Set<string>();

  for (let i = 0; i < relationshipCount; i++) {
    // Pick unused type
    const availableTypes = relationshipTypes.filter(t => !usedTypes.has(t));
    if (availableTypes.length === 0) break;

    const typeWeights = availableTypes.map(t => {
      let w = 1;
      if (t === 'mentor' && age > 35) w = 3;
      if (t === 'protege' && age > 40 && tierBand !== 'mass') w = 3;
      if (t === 'patron' && tierBand === 'elite') w = 4;
      if (t === 'rival' && roleSeedTags.includes('operative')) w = 3;
      if (t === 'handler' && roleSeedTags.includes('operative')) w = 3;
      if (t === 'old-classmate') w = 2;
      return { item: t, weight: w };
    });

    const relType = weightedPick(relRng, typeWeights) as RelationshipType;
    usedTypes.add(relType);

    const strength = band5From01k(relRng.int(300, 900));

    // Generate relationship description
    const descriptions: Record<string, string[]> = {
      patron: ['a senior official who opened doors', 'an influential figure who took notice', 'a powerful ally from the early days'],
      mentor: ['a veteran who taught the craft', 'an old hand who shared hard lessons', 'a guide through the early years'],
      rival: ['a competitor from training', 'a peer with conflicting methods', 'someone with a grudge to settle'],
      protege: ['a promising junior taken under wing', 'a young talent being shaped', 'the next generation being trained'],
      handler: ['a controller from headquarters', 'the link to the organization', 'the person who gives the orders'],
      asset: ['a source developed over years', 'a contact with valuable access', 'someone who provides intelligence'],
      'ex-partner': ['a former lover from the field', 'a relationship that couldn\'t survive the work', 'an old flame with complicated history'],
      'family-tie': ['a relative in a sensitive position', 'family connections that complicate things', 'blood ties that create obligations'],
      'old-classmate': ['a friend from university days', 'someone from the same training cohort', 'a peer from the early career'],
      'debt-holder': ['someone owed a favor', 'a connection with leverage', 'an obligation that must be repaid'],
    };

    const descOptions = descriptions[relType] ?? ['a significant connection'];
    const description = descOptions[relRng.int(0, descOptions.length - 1)]!;

    relationships.push({ type: relType, strength, description });
  }

  traceSet(trace, 'relationships', { count: relationships.length }, { method: 'generated' });

  // ─────────────────────────────────────────────────────────────────────────────
  // NETWORK POSITION (Oracle P3 recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'network');
  const networkRng = makeRng(facetSeed(seed, 'network'));

  const networkRoleWeights: Array<{ item: NetworkRole; weight: number }> = [
    { item: 'isolate', weight: 1 + 2.0 * (1 - latents.socialBattery / 1000) + (opsec01 > 0.7 ? 1.5 : 0) },
    { item: 'peripheral', weight: 1.5 + 0.8 * (1 - latents.publicness / 1000) },
    { item: 'connector', weight: 1 + 2.5 * cosmo01 + (roleSeedTags.includes('diplomat') ? 2.0 : 0) },
    { item: 'hub', weight: 0.5 + 2.0 * (latents.socialBattery / 1000) + (roleSeedTags.includes('media') ? 1.5 : 0) },
    { item: 'broker', weight: 0.5 + 2.0 * (aptitudes.deceptionAptitude / 1000) + (roleSeedTags.includes('operative') ? 1.5 : 0) },
    { item: 'gatekeeper', weight: 0.5 + 2.0 * inst01 + (roleSeedTags.includes('security') ? 2.0 : 0) },
  ];
  const networkRole = weightedPick(networkRng, networkRoleWeights) as NetworkRole;

  const factionAlignment = (() => {
    // Operatives and security types are less likely to have public faction alignment
    if (roleSeedTags.includes('operative') || roleSeedTags.includes('security')) {
      return networkRng.next01() < 0.3 ? null : null; // 70% no faction
    }
    // Others might have faction alignment based on institutional embeddedness
    if (networkRng.next01() < 0.4 + 0.3 * inst01) {
      const factions = ['reform', 'establishment', 'progressive', 'conservative', 'pragmatist', 'idealist'];
      return networkRng.pick(factions);
    }
    return null;
  })();

  const leverageWeights: Array<{ item: LeverageType; weight: number }> = [
    { item: 'favors', weight: 1 + 1.5 * (latents.socialBattery / 1000) },
    { item: 'information', weight: 1 + 2.0 * (aptitudes.cognitiveSpeed / 1000) + (roleSeedTags.includes('analyst') ? 2.0 : 0) },
    { item: 'money', weight: 0.5 + 2.0 * (tierBand === 'elite' ? 1 : tierBand === 'middle' ? 0.5 : 0.2) },
    { item: 'ideology', weight: 1 + 2.0 * principledness01 + (roleSeedTags.includes('organizer') ? 1.5 : 0) },
    { item: 'care', weight: 1 + 2.0 * (aptitudes.empathy / 1000) },
  ];
  const leverageType = weightedPick(networkRng, leverageWeights) as LeverageType;

  const network = { role: networkRole, factionAlignment, leverageType };
  traceSet(trace, 'network', network, { method: 'weightedPick', dependsOn: { roleSeedTags, latents: { socialBattery: latents.socialBattery, publicness: latents.publicness } } });

  // ─────────────────────────────────────────────────────────────────────────────
  // COMMUNITIES (Oracle recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'communities');
  const commRng = makeRng(facetSeed(seed, 'communities'));
  const communityTypes = vocab.communities?.types ?? [
    'professional-society', 'alumni-network', 'religious-committee', 'union-chapter',
    'hobby-club', 'sports-league', 'mutual-aid', 'veterans-group', 'parent-group',
  ];
  const communityRoles = vocab.communities?.roles ?? ['leader', 'organizer', 'regular', 'occasional', 'lurker', 'former'];
  const communityStatuses = vocab.communities?.statuses ?? ['pillar', 'respected', 'regular', 'newcomer', 'outsider', 'controversial'];
  const onlineCommunityPool = vocab.communities?.onlineCommunities ?? ['twitter-sphere', 'reddit-community', 'discord-server', 'telegram-group'];

  // Number of memberships based on social battery
  const membershipCount = Math.max(0, Math.min(3, Math.floor(latents.socialBattery / 350) + commRng.int(-1, 1)));
  const memberships: CommunityMembership[] = [];
  const usedCommunityTypes = new Set<string>();

  for (let i = 0; i < membershipCount; i++) {
    const availableTypes = communityTypes.filter(t => !usedCommunityTypes.has(t));
    if (availableTypes.length === 0) break;
    const type = commRng.pick(availableTypes) as CommunityType;
    usedCommunityTypes.add(type);
    const roleWeights = communityRoles.map(r => {
      let w = 1;
      if (r === 'leader' && tierBand === 'elite') w = 3;
      if (r === 'organizer' && roleSeedTags.includes('organizer')) w = 3;
      if (r === 'regular') w = 4;
      if (r === 'lurker' && latents.socialBattery < 400) w = 3;
      return { item: r as CommunityRole, weight: w };
    });
    const role = weightedPick(commRng, roleWeights) as CommunityRole;
    const intensityBand = band5From01k(commRng.int(200, 800));
    memberships.push({ type, role, intensityBand });
  }

  const onlineCommunities = commRng.pickK(onlineCommunityPool, commRng.int(0, 2));
  const statusWeights = communityStatuses.map(s => {
    let w = 1;
    if (s === 'pillar' && tierBand === 'elite' && age > 40) w = 3;
    if (s === 'respected' && tierBand !== 'mass') w = 3;
    if (s === 'regular') w = 5;
    if (s === 'newcomer' && age < 30) w = 3;
    if (s === 'outsider' && latents.socialBattery < 350) w = 2;
    return { item: s as CommunityStatus, weight: w };
  });
  const communityStatus = weightedPick(commRng, statusWeights) as CommunityStatus;

  const communities: CommunitiesResult = { memberships, onlineCommunities, communityStatus };
  traceSet(trace, 'communities', communities, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────────
  // REPUTATION (Oracle recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'reputation');
  const repRng = makeRng(facetSeed(seed, 'reputation'));
  const repTags = vocab.reputation?.tags ?? [
    'reliable', 'brilliant', 'ruthless', 'corrupt', 'principled', 'reckless',
    'discreet', 'loudmouth', 'fixer', 'by-the-book', 'unpredictable', 'unknown',
  ];

  const pickReputation = (contextBias: Partial<Record<string, number>>): ReputationTag => {
    const weights = repTags.map(r => {
      let w = 1 + (contextBias[r] ?? 0);
      if (r === 'reliable' && latents.institutionalEmbeddedness > 600) w += 2;
      if (r === 'principled' && latents.principledness > 650) w += 2;
      if (r === 'discreet' && latents.opsecDiscipline > 600) w += 2;
      if (r === 'reckless' && latents.riskAppetite > 700) w += 2;
      if (r === 'unknown' && latents.publicness < 350) w += 3;
      return { item: r as ReputationTag, weight: w };
    });
    return weightedPick(repRng, weights) as ReputationTag;
  };

  const professional = pickReputation({ reliable: 2, 'by-the-book': 1 });
  const neighborhood = pickReputation({ unknown: 2 });
  const online = pickReputation({ loudmouth: latents.publicness > 600 ? 2 : 0 });
  const scandalSensitivity = band5From01k(
    tierBand === 'elite' ? 600 + repRng.int(-150, 150) :
    tierBand === 'middle' ? 400 + repRng.int(-150, 150) :
    250 + repRng.int(-100, 100),
  );

  const reputation: ReputationResult = { professional, neighborhood, online, scandalSensitivity };
  traceSet(trace, 'reputation', reputation, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────────
  // ATTACHMENTS (Oracle recommendation - sentimental leverage points)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'attachments');
  const attachRng = makeRng(facetSeed(seed, 'attachments'));
  const keepsakePool = vocab.attachments?.keepsakeTypes ?? [
    'family-heirloom', 'service-medal', 'childhood-toy', 'photo-album', 'letter-bundle', 'religious-item', 'none',
  ];
  const placePool = vocab.attachments?.placeAttachments ?? [
    'hometown-street', 'family-farm', 'childhood-school', 'first-apartment', 'favorite-cafe', 'ancestral-village', 'none',
  ];
  const petPool = vocab.attachments?.dependentNonHumans ?? ['dog', 'cat', 'birds', 'fish', 'plants', 'none'];

  const keepsake = attachRng.pick(keepsakePool) as KeepsakeType;
  const placeAttachment = attachRng.pick(placePool) as PlaceAttachment;
  const dependentNonHuman = attachRng.pick(petPool) as DependentNonHuman;

  const attachments: AttachmentsResult = { keepsake, placeAttachment, dependentNonHuman };
  traceSet(trace, 'attachments', attachments, { method: 'random' });

  // ─────────────────────────────────────────────────────────────────────────────
  // CIVIC LIFE (Oracle recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'civicLife');
  const civicRng = makeRng(facetSeed(seed, 'civicLife'));
  const engagementPool = vocab.civicLife?.engagements ?? ['disengaged', 'quiet-voter', 'active-participant', 'organizer', 'disillusioned'];
  const ideologyPool = vocab.civicLife?.ideologies ?? ['conservative', 'progressive', 'libertarian', 'centrist', 'apolitical', 'cynical-pragmatist'];
  const tabooPool = vocab.civicLife?.tabooTopics ?? ['politics', 'religion', 'money', 'family-drama', 'past-relationships', 'health-issues'];

  const engagementWeights = engagementPool.map(e => {
    let w = 1;
    if (e === 'organizer' && roleSeedTags.includes('organizer')) w = 4;
    if (e === 'active-participant' && latents.principledness > 600) w = 2;
    if (e === 'disengaged' && latents.publicness < 350) w = 3;
    if (e === 'quiet-voter') w = 4;
    if (e === 'disillusioned' && age > 45) w = 2;
    return { item: e as CivicEngagement, weight: w };
  });
  const engagement = weightedPick(civicRng, engagementWeights) as CivicEngagement;

  const ideologyWeights = ideologyPool.map(i => {
    let w = 1;
    if (i === 'apolitical' && roleSeedTags.includes('operative')) w = 3;
    if (i === 'cynical-pragmatist' && latents.adaptability > 600) w = 2;
    if (i === 'conservative' && latents.institutionalEmbeddedness > 650) w = 2;
    if (i === 'progressive' && latents.principledness > 600 && age < 40) w = 2;
    return { item: i as IdeologyTag, weight: w };
  });
  const ideology = weightedPick(civicRng, ideologyWeights) as IdeologyTag;

  const tabooTopics = civicRng.pickK(tabooPool, civicRng.int(1, 3));

  const civicLife: CivicLifeResult = { engagement, ideology, tabooTopics };
  traceSet(trace, 'civicLife', civicLife, { method: 'weighted' });

  return {
    geography: { originRegion, urbanicity, diasporaStatus },
    family: { maritalStatus, dependentCount, hasLivingParents, hasSiblings },
    relationships,
    network,
    communities,
    reputation,
    attachments,
    civicLife,
  };
}
