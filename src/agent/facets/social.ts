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
  CulturalDynamicsResult,
  NeedsRelationshipsResult,
} from '../types';

import {
  makeRng,
  facetSeed,
  band5From01k,
  clampInt,
  weightedPick,
  weightedPickKUnique,
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
  // Country indicator priors (0..1 normalized)
  urbanPopulation01?: number;

  // Derived values for network position
  cosmo01: number;
  opsec01: number;
  inst01: number;
  principledness01: number;
  adaptability01: number;
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
  conversationTopics: string[];
};

export type CulturalDynamicsInput = {
  seed: string;
  vocab: AgentVocabV1;
  latents: Latents;
  tierBand: TierBand;
  roleSeedTags: string[];
  trace?: AgentGenerationTraceV1;
};

export type NeedsRelationshipsInput = {
  seed: string;
  vocab: AgentVocabV1;
  latents: Latents;
  tierBand: TierBand;
  age: number;
  roleSeedTags: string[];
  diasporaStatus: DiasporaStatus;
  family: {
    maritalStatus: MaritalStatus;
    dependentCount: number;
  };
  trace?: AgentGenerationTraceV1;
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

  // Cultural/social dynamics
  culturalDynamics: CulturalDynamicsResult;

  // Needs and relationship archetypes
  needsRelationships: NeedsRelationshipsResult;
};

// ============================================================================
// Cultural Dynamics Snapshot
// ============================================================================

function computeCulturalDynamics({
  seed,
  vocab,
  latents,
  tierBand,
  roleSeedTags,
  trace,
}: CulturalDynamicsInput): CulturalDynamicsResult {
  traceFacet(trace, seed, 'culturalDynamics');
  const rng = makeRng(facetSeed(seed, 'culturalDynamics'));

  const communicationPool = vocab.culturalDynamics?.communicationNorms ?? [];
  const powerPool = vocab.culturalDynamics?.powerDynamics ?? [];
  const bondingPool = vocab.culturalDynamics?.bondingMechanisms ?? [];
  const clashPool = vocab.culturalDynamics?.clashPoints ?? [];

  const public01 = latents.publicness / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const social01 = latents.socialBattery / 1000;
  const adapt01 = latents.adaptability / 1000;

  const pickFrom = (pool: string[], count: number, weightFn: (item: string) => number): string[] => {
    if (!pool.length) return [];
    const weights = pool.map((item) => ({ item, weight: weightFn(item) }));
    return weightedPickKUnique(rng, weights, clampInt(count, 1, Math.min(4, pool.length)));
  };

  const communicationNorms = pickFrom(
    communicationPool,
    2 + rng.int(0, 2),
    (item) => {
      const lower = item.toLowerCase();
      let w = 1;
      if (lower.includes('direct')) w += 1.2 * (1 - opsec01);
      if (lower.includes('face-saving') || lower.includes('formal')) w += 1.1 * opsec01;
      if (lower.includes('punctual') || lower.includes('schedule')) w += 1.2 * (tierBand === 'elite' ? 1 : 0.6);
      if (lower.includes('relationship') || lower.includes('proximity')) w += 1.1 * social01;
      if (lower.includes('personal space')) w += 0.8 + 0.6 * (1 - public01);
      if (lower.includes('silence')) w += 0.6 + 0.6 * adapt01;
      return w;
    },
  );

  const powerDynamics = pickFrom(
    powerPool,
    2 + rng.int(0, 2),
    (item) => {
      const lower = item.toLowerCase();
      let w = 1;
      if (lower.includes('rank') || lower.includes('seniority')) w += tierBand === 'elite' ? 1.6 : 0.8;
      if (lower.includes('competence')) w += 1.2 * (latents.techFluency / 1000);
      if (lower.includes('charisma')) w += 1.1 * social01;
      if (lower.includes('information')) w += 1.0 * opsec01;
      if (lower.includes('coalition')) w += 0.8 + 0.6 * social01;
      if (lower.includes('undermining')) w += 0.5 + 0.8 * (1 - opsec01);
      return w;
    },
  );

  const bondingMechanisms = pickFrom(
    bondingPool,
    2 + rng.int(0, 2),
    (item) => {
      const lower = item.toLowerCase();
      let w = 1;
      if (lower.includes('danger')) w += roleSeedTags.includes('operative') ? 1.6 : 0.6;
      if (lower.includes('ritual')) w += 1.0 + 0.6 * opsec01;
      if (lower.includes('reciprocity')) w += 0.8 + 0.6 * social01;
      if (lower.includes('training')) w += roleSeedTags.includes('security') ? 1.2 : 0.7;
      if (lower.includes('travel')) w += 0.6 + 0.6 * adapt01;
      if (lower.includes('jokes')) w += 0.6 + 0.8 * social01;
      return w;
    },
  );

  const clashPoints = pickFrom(
    clashPool,
    2 + rng.int(0, 2),
    (item) => {
      const lower = item.toLowerCase();
      let w = 1;
      if (lower.includes('privacy')) w += 0.8 + 0.6 * (1 - public01);
      if (lower.includes('time')) w += 0.8 + 0.6 * (1 - adapt01);
      if (lower.includes('conflict')) w += 0.6 + 0.8 * (1 - latents.principledness / 1000);
      if (lower.includes('food') || lower.includes('noise') || lower.includes('cleanliness')) w += 0.8 + 0.6 * social01;
      if (lower.includes('humor')) w += 0.6 + 0.6 * (1 - social01);
      return w;
    },
  );

  const result: CulturalDynamicsResult = {
    communicationNorms,
    powerDynamics,
    bondingMechanisms,
    clashPoints,
  };
  traceSet(trace, 'culturalDynamics', result, { method: 'weightedPickKUnique' });
  return result;
}

// ============================================================================
// Needs & Relationships Archetypes
// ============================================================================

function computeNeedsRelationships({
  seed,
  vocab,
  latents,
  tierBand,
  age,
  roleSeedTags,
  diasporaStatus,
  family,
  trace,
}: NeedsRelationshipsInput): NeedsRelationshipsResult {
  traceFacet(trace, seed, 'needsRelationships');
  const rng = makeRng(facetSeed(seed, 'needsRelationships'));

  const needsPool = vocab.needsRelationships?.needsArchetypes ?? [
    'physiology-anchored',
    'safety-vigilant',
    'opsec-guarded',
    'stability-seeking',
    'belonging-driven',
    'intimacy-seeking',
    'respect-attuned',
    'status-advancing',
    'autonomy-protective',
    'purpose-aligned',
    'mastery-driven',
    'creative-release',
    'moral-integrity',
    'comfort-seeking',
  ];
  const relationshipPool = vocab.needsRelationships?.relationshipArchetypes ?? [
    'guarded-loyalist',
    'found-family-builder',
    'mentor-seeker',
    'mentor-guardian',
    'team-bonded',
    'mission-partner',
    'transactional-ally',
    'bond-by-fire',
    'slow-trust',
    'intimacy-avoidant',
    'romantic-steadfast',
    'family-duty-bound',
    'cultural-anchor',
    'independence-protective',
  ];

  const public01 = latents.publicness / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const social01 = latents.socialBattery / 1000;
  const adapt01 = latents.adaptability / 1000;
  const risk01 = latents.riskAppetite / 1000;
  const principled01 = latents.principledness / 1000;
  const frugal01 = latents.frugality / 1000;
  const curiosity01 = latents.curiosityBandwidth / 1000;
  const aesthetic01 = latents.aestheticExpressiveness / 1000;
  const planning01 = latents.planningHorizon / 1000;
  const conditioning01 = latents.physicalConditioning / 1000;
  const inst01 = latents.institutionalEmbeddedness / 1000;

  const needsWeights = needsPool.map((item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('physiology')) w += 1.2 * (tierBand === 'mass' ? 1 : 0.5) + 1.0 * (1 - conditioning01) + 0.4 * (age > 45 ? 1 : 0);
    if (lower.includes('safety')) w += 1.1 * opsec01 + 0.7 * (1 - risk01);
    if (lower.includes('opsec')) w += 1.2 * opsec01 + (roleSeedTags.includes('operative') ? 0.6 : 0);
    if (lower.includes('stability')) w += 1.1 * (1 - adapt01) + 0.5 * (1 - risk01) + 0.4 * planning01;
    if (lower.includes('belonging')) w += 1.2 * social01 + (family.dependentCount > 0 ? 0.6 : 0);
    if (lower.includes('intimacy')) w += 0.9 * social01 + (family.maritalStatus !== 'single' ? 0.5 : 0.1);
    if (lower.includes('respect')) w += 0.7 * inst01 + 0.5 * principled01;
    if (lower.includes('status')) w += 0.9 * public01 + (tierBand === 'elite' ? 1.1 : 0.4);
    if (lower.includes('autonomy')) w += 1.0 * (1 - inst01) + 0.4 * risk01;
    if (lower.includes('purpose')) w += 1.1 * principled01 + 0.5 * planning01;
    if (lower.includes('mastery')) w += 0.9 * curiosity01 + 0.5 * planning01;
    if (lower.includes('creative')) w += 1.0 * aesthetic01 + 0.4 * adapt01;
    if (lower.includes('moral')) w += 1.2 * principled01;
    if (lower.includes('comfort')) w += 0.6 * frugal01 + 0.5 * (1 - risk01);
    return { item, weight: w };
  });

  const relationshipWeights = relationshipPool.map((item) => {
    const lower = item.toLowerCase();
    let w = 1;
    if (lower.includes('guarded')) w += 1.1 * opsec01 + 0.6 * (1 - social01);
    if (lower.includes('found-family')) w += 1.1 * social01 + (family.dependentCount === 0 ? 0.3 : 0);
    if (lower.includes('mentor-seeker')) w += (age < 30 ? 1.2 : 0.2);
    if (lower.includes('mentor-guardian')) w += (age > 40 ? 1.2 : 0.2);
    if (lower.includes('team-bonded')) w += 0.8 * inst01 + 0.6 * social01;
    if (lower.includes('mission-partner')) w += 0.7 * risk01 + (roleSeedTags.includes('operative') || roleSeedTags.includes('security') ? 0.7 : 0.2);
    if (lower.includes('transactional')) w += 0.7 * inst01 + 0.4 * risk01 + (roleSeedTags.includes('operative') ? 0.6 : 0);
    if (lower.includes('bond-by-fire')) w += 0.8 * risk01 + (roleSeedTags.includes('operative') ? 0.6 : 0);
    if (lower.includes('slow-trust')) w += 0.7 * opsec01 + 0.4 * (1 - social01);
    if (lower.includes('intimacy-avoidant')) w += 0.6 * opsec01 + (family.maritalStatus === 'single' ? 0.4 : 0);
    if (lower.includes('romantic')) w += (family.maritalStatus !== 'single' ? 0.8 : 0.3) + 0.4 * social01;
    if (lower.includes('family-duty')) w += (family.dependentCount > 0 ? 1.2 : 0.2) + (family.maritalStatus !== 'single' ? 0.4 : 0);
    if (lower.includes('cultural')) {
      w += (['expat', 'refugee', 'diaspora-child', 'dual-citizen'].includes(diasporaStatus) ? 0.9 : 0.2) + 0.4 * social01;
    }
    if (lower.includes('independence')) w += 0.7 * (1 - inst01) + 0.3 * (1 - social01);
    return { item, weight: w };
  });

  const pickPrimarySecondary = (
    weights: Array<{ item: string; weight: number }>,
    secondaryChance: number,
  ): { primary: string; secondary?: string } => {
    if (!weights.length) return { primary: 'unspecified' };
    const primary = weightedPick(rng, weights) as string;
    let secondary: string | undefined;
    if (weights.length > 1 && rng.next01() < secondaryChance) {
      const secondaryWeights = weights
        .filter((entry) => entry.item !== primary)
        .map((entry) => ({ item: entry.item, weight: entry.weight * 0.9 }));
      secondary = weightedPick(rng, secondaryWeights) as string;
    }
    return { primary, secondary };
  };

  const result: NeedsRelationshipsResult = {
    needs: pickPrimarySecondary(needsWeights, 0.55),
    relationships: pickPrimarySecondary(relationshipWeights, 0.5),
  };

  traceSet(trace, 'needsRelationships', result, { method: 'weightedPick' });
  return result;
}

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
    urbanPopulation01 = 0.5,
    cosmo01,
    opsec01,
    inst01,
    principledness01,
    adaptability01,
    aptitudes,
  } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // GEOGRAPHY (Correlate #5: Cosmopolitanism ↔ Diaspora)
  // ─────────────────────────────────────────────────────────────────────────────
  // High cosmopolitanism → more likely expat, dual-citizen, diaspora-child
  // Low cosmopolitanism → more likely native, internal-migrant
  traceFacet(trace, seed, 'geography');
  const geoRng = makeRng(facetSeed(seed, 'geography'));
  const urbanicityTags = vocab.geography?.urbanicityTags ?? ['rural', 'small-town', 'secondary-city', 'capital', 'megacity', 'peri-urban'];
  const diasporaStatusTags = vocab.geography?.diasporaStatusTags ?? ['native', 'internal-migrant', 'expat', 'refugee', 'dual-citizen', 'borderland', 'diaspora-child'];

  // Urbanicity based on tier
  // FIX: Enforce geographic constraints for special territories
  const cityStates = ['SGP', 'MCO', 'VAT', 'SMR', 'AND', 'GIB', 'MAC', 'HKG'];
  const tinyTerritories = ['TKL', 'SHN', 'SJM', 'PCN', 'NRU', 'PLW', 'MHL', 'FSM', 'NIU', 'COK', 'WLF', 'SPM', 'BLM', 'MAF', 'AIA', 'MSR', 'VGB', 'TCA', 'CYM', 'BMU', 'FLK', 'GRL', 'FRO'];
  // Countries too small for megacities (population under ~5M, no city over 10M)
  // Includes: small island nations, small gulf states, small European states, small African states
  const noMegacityCountries = [
    // Caribbean & Small Islands
    'ABW', 'ATG', 'BHS', 'BRB', 'VGB', 'CYM', 'DMA', 'GRD', 'KNA', 'LCA', 'VCT', 'TTO', 'TCA',
    // Pacific Islands
    'FJI', 'KIR', 'MHL', 'FSM', 'NRU', 'PLW', 'WSM', 'SLB', 'TON', 'TUV', 'VUT',
    // Small Gulf/Middle East
    'BHR', 'QAT', 'KWT',
    // Small European
    'ISL', 'LUX', 'MLT', 'CYP', 'EST', 'LVA', 'LTU', 'SVN', 'MKD', 'MNE', 'ALB',
    // Small African
    'GMB', 'GNB', 'CPV', 'STP', 'SYC', 'COM', 'MUS', 'SWZ', 'LSO', 'DJI', 'ERI',
    // Central Asian/Caucasus small
    'MNG', 'BTN', 'BRN', 'TLS', 'MDV',
    // Other small
    'GUY', 'SUR', 'BLZ', 'LBR',
  ];
  const isCityState = cityStates.includes(currentCountryIso3);
  const isTinyTerritory = tinyTerritories.includes(currentCountryIso3);
  const cannotHaveMegacity = noMegacityCountries.includes(currentCountryIso3) || isTinyTerritory || isCityState;

  const urb01 = Number.isFinite(urbanPopulation01) ? Math.max(0, Math.min(1, urbanPopulation01)) : 0.5;
  const urbanicityWeights = urbanicityTags.map(u => {
    let w = 1;

    // CONSTRAINT: City-states cannot have rural/small-town
    if (isCityState && (u === 'rural' || u === 'small-town' || u === 'peri-urban')) {
      return { item: u as Urbanicity, weight: 0 };
    }
    // CONSTRAINT: Tiny territories cannot have megacity/secondary-city
    if (isTinyTerritory && (u === 'megacity' || u === 'secondary-city')) {
      return { item: u as Urbanicity, weight: 0 };
    }
    // CONSTRAINT: Small countries cannot have megacity (no city over 10M population)
    if (cannotHaveMegacity && u === 'megacity') {
      return { item: u as Urbanicity, weight: 0 };
    }

    if (u === 'capital' && tierBand === 'elite') w = 10;
    if (u === 'megacity' && tierBand === 'elite') w = 5;
    if (u === 'secondary-city' && tierBand === 'middle') w = 5;
    if (u === 'rural' && tierBand === 'mass') w = 4;
    if (u === 'small-town' && tierBand === 'mass') w = 3;
    // Cosmopolitanism → urban preference
    if ((u === 'capital' || u === 'megacity') && cosmo01 > 0.6) w += 3;
    if ((u === 'rural' || u === 'small-town') && cosmo01 < 0.3) w += 2;
    // City-states default to capital
    if (isCityState && u === 'capital') w += 20;
    // Tiny territories default to small-town or rural
    if (isTinyTerritory && (u === 'small-town' || u === 'rural')) w += 10;

    // Indicator prior: high-urban countries skew toward city categories; low-urban toward rural/small-town.
    if (u === 'megacity' || u === 'capital' || u === 'secondary-city') w += 3.0 * urb01;
    if (u === 'rural' || u === 'small-town') w += 2.5 * (1 - urb01);
    if (u === 'peri-urban') w += 1.0 * (1 - Math.abs(urb01 - 0.6));
    return { item: u as Urbanicity, weight: w };
  });
  const urbanicity = weightedPick(geoRng, urbanicityWeights) as Urbanicity;

  // Diaspora status strongly correlated with cosmopolitanism
  // FIX: Enforce logical constraints based on home vs current country
  const sameCountry = homeCountryIso3 === currentCountryIso3;
  const diasporaWeights = diasporaStatusTags.map(d => {
    let w = 1;

    // CONSTRAINT: If same country, cannot be expat/refugee/diaspora-child
    if (sameCountry && (d === 'expat' || d === 'refugee' || d === 'diaspora-child')) {
      return { item: d as DiasporaStatus, weight: 0 };
    }
    // CONSTRAINT: If different country, cannot be native or internal-migrant
    if (!sameCountry && (d === 'native' || d === 'internal-migrant')) {
      return { item: d as DiasporaStatus, weight: 0 };
    }

    // Base: natives are common when home=current
    if (d === 'native' && sameCountry) {
      w = 50 + 30 * (1 - cosmo01) + 6 * (1 - adaptability01); // Low cosmo/adapt → more likely native
    }
    // High cosmopolitanism → expat, dual-citizen, diaspora-child
    if (d === 'expat') {
      w += 15; // Already enforced !sameCountry above
      w += 25 * cosmo01; // Strong cosmo correlation
      w += 8 * adaptability01;
      if (tierBand === 'elite') w += 10;
    }
    if (d === 'dual-citizen') {
      w += 20 * cosmo01; // High cosmo → more likely dual citizen
      w += 6 * adaptability01;
      if (tierBand === 'elite') w += 5;
    }
    if (d === 'diaspora-child') {
      w += 15 * cosmo01; // Diaspora children often more cosmopolitan
      w += 4 * adaptability01;
    }
    // Internal migration: moderate cosmo, less rooted (only if same country)
    if (d === 'internal-migrant' && sameCountry) {
      if (urbanicity === 'capital' || urbanicity === 'megacity') w += 8;
      w += 5 * cosmo01;
      w += 3 * adaptability01;
    }
    // Security-driven: refugee status (only if different country)
    if (d === 'refugee' && securityPressure01k > 600) w += 5 + securityPressure01k / 200;
    // Borderland: geographic, can apply to both same/different country scenarios
    if (d === 'borderland') w += 2;
    return { item: d as DiasporaStatus, weight: w };
  });
  const diasporaStatus = weightedPick(geoRng, diasporaWeights) as DiasporaStatus;

  // Origin region - null for now, could be enhanced with country-specific data
  const originRegion: string | null = null;

  traceSet(trace, 'geography', { urbanicity, diasporaStatus, originRegion }, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────────
  // FAMILY (Correlate #4: Age ↔ Family Structure)
  // ─────────────────────────────────────────────────────────────────────────────
  // Strong correlation between age and family milestones:
  // - <25: Almost always single, rarely partnered
  // - 25-35: Transition years, partnered/married becoming common
  // - 35-50: Peak marriage/children years
  // - 50+: Empty nest, widowhood becomes possible
  traceFacet(trace, seed, 'family');
  const familyRng = makeRng(facetSeed(seed, 'family'));
  const maritalStatusTags = vocab.family?.maritalStatusTags ?? ['single', 'partnered', 'married', 'divorced', 'widowed', 'its-complicated'];

  // Marital status strongly correlated with age
  const maritalWeights = maritalStatusTags.map(m => {
    let w = 1;
    // Under 25: predominantly single
    if (age < 25) {
      if (m === 'single') w = 90;
      if (m === 'partnered') w = 10;
      if (m === 'married') w = 0.6;
      if (m === 'divorced' || m === 'widowed') w = 0.05;
    }
    // 25-30: transition period
    else if (age < 30) {
      if (m === 'single') w = 45;
      if (m === 'partnered') w = 30;
      if (m === 'married') w = 20;
      if (m === 'divorced') w = 3;
      if (m === 'widowed') w = 0.1;
    }
    // 30-40: peak partnership/marriage years
    else if (age < 40) {
      if (m === 'single') w = 15;
      if (m === 'partnered') w = 25;
      if (m === 'married') w = 45;
      if (m === 'divorced') w = 12;
      if (m === 'widowed') w = 1;
    }
    // 40-55: established family or divorce
    else if (age < 55) {
      if (m === 'single') w = 10;
      if (m === 'partnered') w = 15;
      if (m === 'married') w = 50;
      if (m === 'divorced') w = 20;
      if (m === 'widowed') w = 3;
    }
    // 55+: widowhood becomes more common
    else {
      if (m === 'single') w = 8;
      if (m === 'partnered') w = 10;
      if (m === 'married') w = 45;
      if (m === 'divorced') w = 18;
      if (m === 'widowed') w = 15;
    }
    // Role modifiers
    if (m === 'its-complicated' && roleSeedTags.includes('operative')) w += 5;
    if (m === 'single' && roleSeedTags.includes('operative')) w *= 1.3; // Operatives more likely single
    return { item: m as MaritalStatus, weight: w };
  });
  let maritalStatus = weightedPick(familyRng, maritalWeights) as MaritalStatus;
  if (age < 22 && (maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed')) {
    maritalStatus = familyRng.next01() < 0.25 ? 'partnered' : 'single';
  }

  // Dependents strongly correlated with age: peak childbearing 28-45, teenagers/adult children 45+
  const dependentChance = (() => {
    if (age < 22) return maritalStatus === 'partnered' ? 0.03 : 0.01;
    if (age < 25) return maritalStatus === 'married' ? 0.10 : 0.04;
    if (age < 28) return maritalStatus === 'married' ? 0.25 : 0.08;
    if (age < 35) return maritalStatus === 'married' ? 0.65 : maritalStatus === 'partnered' ? 0.35 : 0.12;
    if (age < 45) return maritalStatus === 'married' ? 0.80 : maritalStatus === 'divorced' ? 0.60 : 0.20;
    if (age < 55) return maritalStatus === 'married' ? 0.70 : maritalStatus === 'divorced' ? 0.50 : 0.15;
    return maritalStatus === 'married' ? 0.40 : 0.10; // Adult children, fewer dependents
  })();
  const maxDependents = age < 30 ? 1 : age < 40 ? 2 : age < 50 ? 3 : 2;
  const dependentCount = familyRng.next01() < dependentChance ? familyRng.int(1, maxDependents) : 0;

  // Living parents: probability decreases with age
  const parentSurvivalChance = age < 35 ? 0.95 : age < 45 ? 0.85 : age < 55 ? 0.70 : age < 65 ? 0.45 : 0.20;
  const hasLivingParents = familyRng.next01() < parentSurvivalChance;
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
  // NETWORK POSITION (Correlate #6: Age ↔ Network Role)
  // ─────────────────────────────────────────────────────────────────────────────
  // Young agents: peripheral, building networks
  // Mid-career: connectors, brokers - actively networking
  // Senior: hubs, gatekeepers - established positions, controlling access
  traceFacet(trace, seed, 'network');
  const networkRng = makeRng(facetSeed(seed, 'network'));

  // Age-based network role modifiers
  const ageNetworkBias = (() => {
    if (age < 25) return { isolate: 0.4, peripheral: 2.4, connector: 0.6, hub: 0.08, broker: 0.12, gatekeeper: 0.05 };
    if (age < 30) return { isolate: 0.3, peripheral: 1.7, connector: 0.9, hub: 0.25, broker: 0.5, gatekeeper: 0.15 };
    if (age < 40) return { isolate: 0.5, peripheral: 0.8, connector: 1.5, hub: 1.0, broker: 1.2, gatekeeper: 0.6 };
    if (age < 50) return { isolate: 0.8, peripheral: 0.6, connector: 1.2, hub: 1.5, broker: 1.4, gatekeeper: 1.2 };
    return { isolate: 1.0, peripheral: 0.5, connector: 0.8, hub: 1.2, broker: 1.0, gatekeeper: 2.0 }; // 50+: gatekeepers
  })();

  // ─────────────────────────────────────────────────────────────────────────────
  // Correlate #11: Empathy+Deception ↔ Network Role
  // ─────────────────────────────────────────────────────────────────────────────
  // High empathy → connectors, hubs (understanding others builds social ties)
  // High deception → brokers (manipulating information flow requires skill)
  // Low empathy + low deception → isolates, peripherals
  const empathy01 = aptitudes.empathy / 1000;
  const deception01 = aptitudes.deceptionAptitude / 1000;

  const networkRoleWeights: Array<{ item: NetworkRole; weight: number }> = [
    { item: 'isolate', weight: (1 + 2.0 * (1 - latents.socialBattery / 1000) + (opsec01 > 0.7 ? 1.5 : 0) + 1.2 * (1 - empathy01)) * ageNetworkBias.isolate },
    { item: 'peripheral', weight: (1.5 + 0.8 * (1 - latents.publicness / 1000) + 0.8 * (1 - empathy01)) * ageNetworkBias.peripheral },
    { item: 'connector', weight: (1 + 2.5 * cosmo01 + 1.8 * empathy01 + (roleSeedTags.includes('diplomat') ? 2.0 : 0)) * ageNetworkBias.connector },
    { item: 'hub', weight: (0.5 + 2.0 * (latents.socialBattery / 1000) + 1.5 * empathy01 + (roleSeedTags.includes('media') ? 1.5 : 0)) * ageNetworkBias.hub },
    { item: 'broker', weight: (0.5 + 2.5 * deception01 + 0.8 * empathy01 + (roleSeedTags.includes('operative') ? 1.5 : 0)) * ageNetworkBias.broker },
    { item: 'gatekeeper', weight: (0.5 + 2.0 * inst01 + 0.5 * deception01 + (roleSeedTags.includes('security') ? 2.0 : 0)) * ageNetworkBias.gatekeeper },
  ];
  let networkRole = weightedPick(networkRng, networkRoleWeights) as NetworkRole;
  if (age < 25 && (networkRole === 'hub' || networkRole === 'broker' || networkRole === 'gatekeeper')) {
    const softened = networkRoleWeights.map(w => ({
      item: w.item,
      weight: w.item === 'hub' || w.item === 'broker' || w.item === 'gatekeeper' ? 0 : w.weight,
    }));
    networkRole = weightedPick(networkRng, softened) as NetworkRole;
  }

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

  // ─────────────────────────────────────────────────────────────────────────────
  // Age ↔ Community Status Correlate
  // ─────────────────────────────────────────────────────────────────────────────
  // Young agents (<30): predominantly newcomers, occasionally regular
  // Mid-career (30-45): regular, building toward respected
  // Senior (45-60): respected, potentially pillars
  // Elder (60+): pillars of community, high status from tenure
  const ageStatusBias = (() => {
    if (age < 25) return { pillar: 0.05, respected: 0.2, regular: 0.8, newcomer: 5.0, outsider: 1.5, controversial: 0.8 };
    if (age < 35) return { pillar: 0.2, respected: 1.0, regular: 3.0, newcomer: 2.0, outsider: 1.0, controversial: 1.0 };
    if (age < 45) return { pillar: 0.8, respected: 2.5, regular: 2.0, newcomer: 0.5, outsider: 0.8, controversial: 1.0 };
    if (age < 55) return { pillar: 2.0, respected: 3.0, regular: 1.5, newcomer: 0.2, outsider: 0.5, controversial: 0.8 };
    return { pillar: 4.0, respected: 2.5, regular: 1.0, newcomer: 0.1, outsider: 0.8, controversial: 0.6 }; // 55+: community pillars
  })();

  const statusWeights = communityStatuses.map(s => {
    let w = 1;
    // Base tier modifiers (kept from original)
    if (s === 'pillar' && tierBand === 'elite') w = 3;
    if (s === 'respected' && tierBand !== 'mass') w = 3;
    if (s === 'regular') w = 5;
    if (s === 'outsider' && latents.socialBattery < 350) w = 2;

    // Age correlate modifiers
    const bias = ageStatusBias[s as keyof typeof ageStatusBias] ?? 1;
    w *= bias;

    return { item: s as CommunityStatus, weight: w };
  });
  const communityStatus = weightedPick(commRng, statusWeights) as CommunityStatus;

  const communities: CommunitiesResult = { memberships, onlineCommunities, communityStatus };
  traceSet(trace, 'communities', communities, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────────
  // REPUTATION (Oracle recommendation)
  // Correlate #14: Visibility ↔ Reputation
  // ─────────────────────────────────────────────────────────────────────────────
  // High visibility → reputations are more defined (less 'unknown')
  // High visibility → polarizing reputations more likely (brilliant, ruthless, loudmouth)
  // Low visibility → more likely 'unknown', 'discreet'
  traceFacet(trace, seed, 'reputation');
  const repRng = makeRng(facetSeed(seed, 'reputation'));
  const repTags = vocab.reputation?.tags ?? [
    'reliable', 'brilliant', 'ruthless', 'corrupt', 'principled', 'reckless',
    'discreet', 'loudmouth', 'fixer', 'by-the-book', 'unpredictable', 'unknown',
  ];

  const publicness01 = latents.publicness / 1000;

  const pickReputation = (contextBias: Partial<Record<string, number>>): ReputationTag => {
    const weights = repTags.map(r => {
      let w = 1 + (contextBias[r] ?? 0);
      if (r === 'reliable' && latents.institutionalEmbeddedness > 600) w += 2;
      if (r === 'principled' && latents.principledness > 650) w += 2;
      if (r === 'discreet' && latents.opsecDiscipline > 600) w += 2;
      if (r === 'reckless' && latents.riskAppetite > 700) w += 2;

      // Correlate #14: Visibility ↔ Reputation
      // High visibility reduces 'unknown' and increases defined reputations
      if (r === 'unknown') {
        w += 4 * (1 - publicness01); // Low publicness → more likely unknown
        w *= Math.max(0.1, 1 - publicness01); // High publicness heavily reduces unknown
      }
      // High visibility increases polarizing reputations
      if (r === 'brilliant' || r === 'ruthless' || r === 'loudmouth') {
        w += 1.5 * publicness01;
      }
      // Low visibility correlates with discreet
      if (r === 'discreet') {
        w += 1.5 * (1 - publicness01);
      }

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
  const convoPool = vocab.civicLife?.conversationTopics ?? [
    'recent operations',
    'training memories',
    'equipment reviews',
    'travel stories',
    'work frustrations',
    'news rumors',
  ];

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
  const conversationTopics = civicRng.pickK(convoPool, civicRng.int(3, 5));

  const civicLife: CivicLifeResult = { engagement, ideology, tabooTopics, conversationTopics };
  traceSet(trace, 'civicLife', civicLife, { method: 'weighted' });

  const culturalDynamics = computeCulturalDynamics({
    seed,
    vocab,
    latents,
    tierBand,
    roleSeedTags,
    trace,
  });
  const needsRelationships = computeNeedsRelationships({
    seed,
    vocab,
    latents,
    tierBand,
    age,
    roleSeedTags,
    diasporaStatus,
    family: { maritalStatus, dependentCount },
    trace,
  });

  return {
    geography: { originRegion, urbanicity, diasporaStatus },
    family: { maritalStatus, dependentCount, hasLivingParents, hasSiblings },
    relationships,
    network,
    communities,
    reputation,
    attachments,
    civicLife,
    culturalDynamics,
    needsRelationships,
  };
}
