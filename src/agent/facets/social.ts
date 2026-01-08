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
  /** Correlate #N3: Conscientiousness ↔ Network Role */
  conscientiousness01: number;
  /** Correlate #NEW1: Vice Tendency ↔ Relationship Stability (derived, includes publicness confound) */
  viceTendency01: number;
  /** Correlate #NEW1: Raw inputs for relationship hostility (excludes publicness) */
  risk01: number;
  impulseControl01: number;
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
    conscientiousness01,
    risk01,
    impulseControl01,
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
  let diasporaStatus = weightedPick(geoRng, diasporaWeights) as DiasporaStatus;

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAUSIBILITY GATE NAR-10: Elite tier + refugee status is incompatible
  // Elite status implies established position incompatible with refugee displacement
  // ═══════════════════════════════════════════════════════════════════════════
  if (tierBand === 'elite' && diasporaStatus === 'refugee') {
    diasporaStatus = 'expat'; // Use 'expat' instead of 'immigrant' as it's in the vocab
    if (trace) {
      trace.derived = trace.derived ?? {};
      trace.derived.nar10EliteRefugeeGate = {
        tierBand: 'elite',
        originalDiaspora: 'refugee',
        adjustedDiaspora: 'expat',
        reason: 'NAR-10: Elite tier incompatible with refugee status',
      };
    }
  }

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

    // Correlate #NEW34: Elite tier delays marriage (tier+age interaction)
    // Elite young agents (<30) focus on career advancement, delaying marriage
    if (tierBand === 'elite' && age < 30) {
      if (m === 'married') w *= 0.3; // Strong reduction in marriage probability
      if (m === 'single') w *= 1.4; // Boost single probability
    }

    // Correlate #NEW44: Young widowhood is rare
    // Widowhood under 40 is statistically very uncommon
    if (age < 40 && m === 'widowed') {
      w *= 0.1; // Reduce by 90%
    }

    return { item: m as MaritalStatus, weight: w };
  });
  let maritalStatus = weightedPick(familyRng, maritalWeights) as MaritalStatus;
  if (age < 22 && (maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed')) {
    maritalStatus = familyRng.next01() < 0.25 ? 'partnered' : 'single';
  }

  // Correlate #4: Age ↔ Has Family (positive)
  // Dependents strongly correlated with age: peak childbearing 28-45, teenagers/adult children 45+
  // Strengthened age effect to ensure clear correlation
  const dependentChance = (() => {
    const isPartnered = maritalStatus === 'married' || maritalStatus === 'partnered';
    if (age < 22) return isPartnered ? 0.02 : 0.005; // Very rare for young singles
    if (age < 25) return isPartnered ? 0.08 : 0.02;
    if (age < 28) return isPartnered ? 0.25 : 0.05;
    if (age < 35) return isPartnered ? 0.70 : 0.08; // Peak family formation
    if (age < 45) return isPartnered ? 0.85 : 0.15; // Peak family years
    if (age < 55) return isPartnered ? 0.75 : 0.12;
    return isPartnered ? 0.50 : 0.08; // Adult children, some still at home
  })();
  const maxDependents = age < 30 ? 1 : age < 40 ? 2 : age < 50 ? 3 : 2;
  let dependentCount = familyRng.next01() < dependentChance ? familyRng.int(1, maxDependents) : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // DETERMINISTIC POST-HOC ADJUSTMENT for #4 Age ↔ Has Family
  // hasFamily = (married OR partnered) AND dependentCount > 0
  // We need to ensure: older → more likely hasFamily, younger → less likely
  // ─────────────────────────────────────────────────────────────────────────
  const isPartnered = maritalStatus === 'married' || maritalStatus === 'partnered';

  // Older partnered people should have family (dependents)
  if (age >= 30 && isPartnered && dependentCount === 0) {
    // Age 30-40: 60% should have dependents if partnered
    // Age 40+: 80% should have dependents if partnered
    const forceFamilyChance = age >= 40 ? 0.80 : 0.60;
    if (familyRng.next01() < forceFamilyChance) {
      dependentCount = familyRng.int(1, maxDependents);
    }
  }

  // Younger people (under 28) should rarely have family
  if (age < 28 && dependentCount > 0) {
    // 70% chance to remove dependents for young people
    if (familyRng.next01() < 0.70) {
      dependentCount = 0;
    }
  }

  // Young singles should almost never have dependents
  if (age < 25 && maritalStatus === 'single' && dependentCount > 0) {
    dependentCount = 0;
  }

  // Living parents: probability decreases with age
  const parentSurvivalChance = age < 35 ? 0.95 : age < 45 ? 0.85 : age < 55 ? 0.70 : age < 65 ? 0.45 : 0.20;
  let hasLivingParents = familyRng.next01() < parentSurvivalChance;
  const hasSiblings = familyRng.next01() < 0.75;

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAUSIBILITY GATE NEW38: Age 70+ implies deceased parents
  // By age 70, biological parents would be 90+ with very low survival probability
  // ═══════════════════════════════════════════════════════════════════════════
  if (age >= 70 && hasLivingParents) {
    hasLivingParents = false;
    if (trace) {
      trace.derived = trace.derived ?? {};
      trace.derived.new38AgeParentGate = {
        age,
        originalHasLivingParents: true,
        adjustedHasLivingParents: false,
        reason: 'NEW38: Age 70+ implies deceased parents',
      };
    }
  }

  traceSet(trace, 'family', { maritalStatus, dependentCount, hasLivingParents, hasSiblings }, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────────
  // RELATIONSHIPS (Oracle recommendation)
  // Correlate #N4: Deception ↔ Relationship Count (negative)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'relationships');
  const relRng = makeRng(facetSeed(seed, 'relationships'));
  const relationshipTypes = vocab.family?.relationshipTypes ?? ['patron', 'mentor', 'rival', 'protege', 'handler', 'asset', 'ex-partner', 'family-tie', 'old-classmate', 'debt-holder'];

  // Correlate #N4: High deception → fewer genuine relationships (manipulators have shallow connections)
  // Correlate #NEW1: Vice Tendency ↔ Relationship Stability (negative)
  // High vice tendency → fewer stable relationships (addiction/vices strain connections)
  //
  // NOTE: The derived viceTendency includes 12% publicness, creating a confound where
  // high-vice people have more social opportunities. Instead, we use a "relationship hostility"
  // factor computed from raw inputs (risk, conscientiousness, impulse control) that excludes
  // publicness to avoid the confound.
  const deception01 = aptitudes.deceptionAptitude / 1000;
  const empathy01 = aptitudes.empathy / 1000;
  // risk01, impulseControl01, conscientiousness01 already destructured from ctx at function start

  // #NEW1: Relationship hostility factor - excludes publicness to avoid confound
  // High risk + low conscientiousness + low impulse control → fewer stable relationships
  const relationshipHostility =
    0.40 * risk01 +
    0.30 * (1 - conscientiousness01) +
    0.30 * (1 - impulseControl01);

  // Base range 1-5, modified by deception (negative), empathy (positive)
  const baseMin = Math.max(1, Math.round(2 - 1.5 * deception01 + 0.5 * empathy01));
  const baseMax = Math.max(baseMin + 1, Math.round(5 - 2.0 * deception01 + 1.0 * empathy01));
  let relationshipCount = relRng.int(baseMin, baseMax);

  // #NEW1: DETERMINISTIC caps based on relationship hostility
  // Very high hostility (>0.65) → max 2 relationships
  // High hostility (>0.50) → max 3 relationships
  if (relationshipHostility > 0.65) {
    relationshipCount = Math.min(relationshipCount, 2);
  } else if (relationshipHostility > 0.50) {
    relationshipCount = Math.min(relationshipCount, 3);
  }
  const relationships: RelationshipEntry[] = [];
  const usedTypes = new Set<string>();

  // ─────────────────────────────────────────────────────────────────────────
  // Plausibility Gate #PG4: Marital Status → Relationship Types Consistency
  // ─────────────────────────────────────────────────────────────────────────
  // - Single agents should not have 'ex-partner' (never been partnered)
  // - Widowed agents should only have 'ex-partner', 'family-tie', 'old-classmate' (no active romance)
  const pg4AllowedForWidowed: RelationshipType[] = ['ex-partner', 'family-tie', 'old-classmate', 'mentor', 'protege', 'patron', 'debt-holder'];

  for (let i = 0; i < relationshipCount; i++) {
    // Pick unused type, applying PG4 filters
    let availableTypes = relationshipTypes.filter(t => !usedTypes.has(t));

    // PG4: Single agents cannot have 'ex-partner' - they've never been partnered
    if (maritalStatus === 'single') {
      availableTypes = availableTypes.filter(t => t !== 'ex-partner');
    }

    // PG4: Widowed agents - filter to appropriate relationship types
    // No active romantic relationships, focus on past connections and family
    if (maritalStatus === 'widowed') {
      availableTypes = availableTypes.filter(t => pg4AllowedForWidowed.includes(t as RelationshipType));
    }

    // Deterministic Cap DC6: Age ↔ Relationship Types
    // Young agents (<25) cannot have patronage relationships - not established enough
    if (age < 25) {
      availableTypes = availableTypes.filter(t => t !== 'patron');
    }
    // Older agents (>60) cannot be proteges - too old for that role
    if (age > 60) {
      availableTypes = availableTypes.filter(t => t !== 'protege');
    }

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

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW46: Siblings → Family Tie Type
  // If has siblings, ensure "family-tie" appears in relationships
  // ═══════════════════════════════════════════════════════════════════════════
  if (hasSiblings && !relationships.some(r => r.type === 'family-tie')) {
    const siblingDescriptions = [
      'a sibling with complicated history',
      'a brother or sister who stayed close',
      'family bonds that persist despite distance',
    ];
    relationships.push({
      type: 'family-tie',
      strength: band5From01k(relRng.int(400, 800)),
      description: siblingDescriptions[relRng.int(0, siblingDescriptions.length - 1)]!,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW48: Very High Deception → Relationship Trust Floor
  // If deception > 800, ensure at least one relationship has low trust (very_low or low)
  // Habitual deceivers damage trust in their relationships
  // ═══════════════════════════════════════════════════════════════════════════
  if (aptitudes.deceptionAptitude > 800 && relationships.length > 0) {
    const lowTrustBands: Band5[] = ['very_low', 'low'];
    const hasLowTrustRel = relationships.some(r => lowTrustBands.includes(r.strength));
    if (!hasLowTrustRel) {
      // Downgrade a random relationship to low trust
      const targetIdx = relRng.int(0, relationships.length - 1);
      relationships[targetIdx]!.strength = relRng.next01() < 0.5 ? 'very_low' : 'low';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW50: Elite + Young → Mentor Seeker
  // If tier == "elite" AND age < 30, ensure at least one "mentor" relationship
  // Young elite seek guidance from experienced figures
  // ═══════════════════════════════════════════════════════════════════════════
  if (tierBand === 'elite' && age < 30 && !relationships.some(r => r.type === 'mentor')) {
    const mentorDescriptions = [
      'a senior figure who recognized potential early',
      'an experienced hand guiding career advancement',
      'a powerful mentor who opened crucial doors',
    ];
    relationships.push({
      type: 'mentor',
      strength: band5From01k(relRng.int(500, 900)),
      description: mentorDescriptions[relRng.int(0, mentorDescriptions.length - 1)]!,
    });
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
  // Correlate #N3: Conscientiousness ↔ Network Role
  // ─────────────────────────────────────────────────────────────────────────────
  // High empathy → connectors, hubs (understanding others builds social ties)
  // High deception → brokers (manipulating information flow requires skill)
  // High conscientiousness → hubs, gatekeepers (reliable, maintain relationships)
  // Low empathy + low deception → isolates, peripherals
  // (empathy01 and deception01 already defined above for relationship count)

  // Correlate #NEW17: Tier ↔ Network Role (positive)
  // Elite tier → hub/gatekeeper positions (controlling resources/access)
  // Mass tier → more likely isolate/peripheral (fewer resources to network)
  const tierNetworkBias = tierBand === 'elite' ? 1.8 : tierBand === 'mass' ? 0.6 : 1.0;

  const networkRoleWeights: Array<{ item: NetworkRole; weight: number }> = [
    // #N3: Low conscientiousness → more likely isolate (unreliable, don't maintain connections)
    // #NEW17: Mass tier more likely isolate
    { item: 'isolate', weight: (1 + 2.0 * (1 - latents.socialBattery / 1000) + (opsec01 > 0.7 ? 1.5 : 0) + 1.2 * (1 - empathy01) + 1.5 * (1 - conscientiousness01) + (tierBand === 'mass' ? 1.0 : 0)) * ageNetworkBias.isolate },
    { item: 'peripheral', weight: (1.5 + 0.8 * (1 - latents.publicness / 1000) + 0.8 * (1 - empathy01)) * ageNetworkBias.peripheral },
    { item: 'connector', weight: (1 + 2.5 * cosmo01 + 1.8 * empathy01 + (roleSeedTags.includes('diplomat') ? 2.0 : 0)) * ageNetworkBias.connector },
    // #N3: High conscientiousness → more likely hub (reliable networkers maintain many relationships)
    // #NEW17: Elite tier more likely hub (resources to maintain extensive networks)
    { item: 'hub', weight: (0.5 + 2.0 * (latents.socialBattery / 1000) + 1.5 * empathy01 + 2.0 * conscientiousness01 + (roleSeedTags.includes('media') ? 1.5 : 0)) * ageNetworkBias.hub * tierNetworkBias },
    // #NEW11: Principledness ↔ Network Role (negative for broker) - principled people don't facilitate shady dealings
    // Strengthened: multiply by (1 - 0.8*principledness) to ensure strong negative correlation
    { item: 'broker', weight: Math.max(0.1, (0.5 + 2.5 * deception01 + 0.8 * empathy01 + (roleSeedTags.includes('operative') ? 1.5 : 0)) * (1 - 0.8 * principledness01)) * ageNetworkBias.broker },
    // #N3: High conscientiousness → more likely gatekeeper (dutiful, reliable, follow procedures)
    // #NEW17: Elite tier more likely gatekeeper (institutional power)
    { item: 'gatekeeper', weight: (0.5 + 2.0 * inst01 + 0.5 * deception01 + 1.8 * conscientiousness01 + (roleSeedTags.includes('security') ? 2.0 : 0)) * ageNetworkBias.gatekeeper * tierNetworkBias },
  ];
  let networkRole = weightedPick(networkRng, networkRoleWeights) as NetworkRole;
  if (age < 25 && (networkRole === 'hub' || networkRole === 'broker' || networkRole === 'gatekeeper')) {
    const softened = networkRoleWeights.map(w => ({
      item: w.item,
      weight: w.item === 'hub' || w.item === 'broker' || w.item === 'gatekeeper' ? 0 : w.weight,
    }));
    networkRole = weightedPick(networkRng, softened) as NetworkRole;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETERMINISTIC POST-HOC ADJUSTMENT for #N3 Conscientiousness ↔ Network Role
  // High conscientiousness → hub/gatekeeper, Low conscientiousness → isolate/peripheral
  // ─────────────────────────────────────────────────────────────────────────
  const highStatusRoles: NetworkRole[] = ['hub', 'gatekeeper'];
  const lowStatusRoles: NetworkRole[] = ['isolate', 'peripheral'];

  if (conscientiousness01 > 0.65 && lowStatusRoles.includes(networkRole)) {
    // High conscientiousness with low-status role: upgrade to connector or hub
    networkRole = networkRng.next01() < 0.6 ? 'connector' : 'hub';
  } else if (conscientiousness01 < 0.35 && highStatusRoles.includes(networkRole)) {
    // Low conscientiousness with high-status role: downgrade to peripheral or isolate
    networkRole = networkRng.next01() < 0.6 ? 'peripheral' : 'isolate';
  }

  // Correlate #NEW33: High Opsec → Cannot be Hub/Gatekeeper (CONTINUOUS + DETERMINISTIC)
  // Discretion-seekers avoid visible network positions that expose them
  // Continuous effect: opsec reduces probability of visible roles
  if (opsec01 > 0.50 && (networkRole === 'hub' || networkRole === 'gatekeeper')) {
    // Higher opsec = higher probability of reassignment (50% at 0.5 opsec, 95% at 1.0)
    const reassignProb = 0.5 + 0.45 * (opsec01 - 0.5) / 0.5;
    if (networkRng.next01() < reassignProb) {
      networkRole = networkRng.next01() < 0.6 ? 'broker' : 'peripheral'; // Hidden influence roles
    }
  }

  // Correlate #NEW11: Principledness → Not Broker (CONTINUOUS + DETERMINISTIC)
  // Principled people refuse to be information brokers who exploit others
  // Continuous effect: higher principledness = higher probability of reassignment
  if (principledness01 > 0.45 && networkRole === 'broker') {
    // Higher principledness = higher probability of reassignment (40% at 0.45, 95% at 1.0)
    const reassignProb = 0.4 + 0.55 * (principledness01 - 0.45) / 0.55;
    if (networkRng.next01() < reassignProb) {
      networkRole = networkRng.next01() < 0.7 ? 'connector' : 'peripheral';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAUSIBILITY GATE NEW35: Parents with dependents cannot be network isolates
  // Raising children requires social support networks (school, activities, healthcare)
  // ═══════════════════════════════════════════════════════════════════════════
  if (dependentCount > 0 && networkRole === 'isolate') {
    networkRole = 'peripheral';
    if (trace) {
      trace.derived = trace.derived ?? {};
      trace.derived.new35ParentIsolateGate = {
        dependentCount,
        originalRole: 'isolate',
        adjustedRole: 'peripheral',
        reason: 'NEW35: Parents with dependents cannot be network isolates',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW53: High Risk + Isolate → Vulnerability Flag
  // Risk-taking isolates lack support network, making them vulnerable
  // This is tracked in trace for downstream systems to use
  // ═══════════════════════════════════════════════════════════════════════════
  const isVulnerableIsolate = risk01 > 0.7 && networkRole === 'isolate';
  if (isVulnerableIsolate && trace) {
    trace.derived = trace.derived ?? {};
    trace.derived.new53VulnerableIsolate = {
      riskAppetite: latents.riskAppetite,
      networkRole: 'isolate',
      vulnerability: 'high-risk isolate lacks support network',
    };
  }

  const factionAlignment = (() => {
    // Operatives and security types are less likely to have public faction alignment
    if (roleSeedTags.includes('operative') || roleSeedTags.includes('security')) {
      return networkRng.next01() < 0.3 ? null : null; // 70% no faction
    }

    // Correlate #NEW43: High risk + low institutional → avoid formal factions (continuous)
    // Risk-takers with low institutional ties prefer informal networks over formal faction membership
    // Combine: high riskInstitutionalScore = (riskAppetite * (1 - institutional)) → less faction
    const riskInstScore = risk01 * (1 - inst01);
    // If score > 0.4, increasingly likely to skip faction alignment
    if (riskInstScore > 0.3 && networkRng.next01() < riskInstScore * 1.5) {
      return null; // These agents avoid formal factional commitments
    }

    // Others might have faction alignment based on institutional embeddedness
    if (networkRng.next01() < 0.35 + 0.35 * inst01) {
      const factions = ['reform', 'establishment', 'progressive', 'conservative', 'pragmatist', 'idealist'];
      return networkRng.pick(factions);
    }
    return null;
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW54: Institutional → Formal Faction
  // If institutionalEmbeddedness > 700, ensure faction alignment exists
  // Highly embedded people join formal organizations
  // ═══════════════════════════════════════════════════════════════════════════
  let finalFactionAlignment = factionAlignment;
  if (inst01 > 0.7 && !finalFactionAlignment) {
    const formalFactions = ['establishment', 'reform', 'conservative', 'progressive'];
    finalFactionAlignment = networkRng.pick(formalFactions);
  }

  // Correlate #NEW37: Low socialBattery cannot do favor leverage
  // Correlate #NEW42: Low empathy cannot have care-based leverage
  const socialBatteryForLeverage = latents.socialBattery / 1000;
  const leverageWeights: Array<{ item: LeverageType; weight: number }> = [
    // #NEW37: Favor leverage requires social energy to maintain reciprocal relationships
    { item: 'favors', weight: socialBatteryForLeverage < 0.3 ? 0.05 : (1 + 1.5 * socialBatteryForLeverage) },
    { item: 'information', weight: 1 + 2.0 * (aptitudes.cognitiveSpeed / 1000) + (roleSeedTags.includes('analyst') ? 2.0 : 0) },
    { item: 'money', weight: 0.5 + 2.0 * (tierBand === 'elite' ? 1 : tierBand === 'middle' ? 0.5 : 0.2) },
    { item: 'ideology', weight: 1 + 2.0 * principledness01 + (roleSeedTags.includes('organizer') ? 1.5 : 0) },
    // #NEW42: Care-based leverage requires empathy to genuinely connect with others
    { item: 'care', weight: empathy01 < 0.3 ? 0.05 : (1 + 2.0 * empathy01) },
  ];
  let leverageType = weightedPick(networkRng, leverageWeights) as LeverageType;

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW49: Empathy + Family → Care Leverage
  // If empathy > 700 AND hasFamily, increase "care" leverage probability
  // Empathetic family people are vulnerable through loved ones
  // ═══════════════════════════════════════════════════════════════════════════
  const hasFamily = (maritalStatus === 'married' || maritalStatus === 'partnered') && dependentCount > 0;
  if (aptitudes.empathy > 700 && hasFamily && leverageType !== 'care') {
    // 60% chance to switch to care leverage
    if (networkRng.next01() < 0.6) {
      leverageType = 'care';
    }
  }

  const network = { role: networkRole, factionAlignment: finalFactionAlignment, leverageType };
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
  // Correlate #NEW36: Diaspora status maintains community networks
  // Non-native agents (expats, refugees, etc.) maintain at least one community connection
  const baseMembershipCount = Math.floor(latents.socialBattery / 350) + commRng.int(-1, 1);
  const diasporaCommunityMin = diasporaStatus !== 'native' ? 1 : 0;
  const membershipCount = Math.max(diasporaCommunityMin, Math.min(3, baseMembershipCount));
  const memberships: CommunityMembership[] = [];
  const usedCommunityTypes = new Set<string>();

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW47: Controversial Views → Leadership Penalty
  // If agent has controversial community status AND is a public figure,
  // reduce leadership community role probability
  // We'll check this after generating memberships and apply a post-hoc adjustment
  // ═══════════════════════════════════════════════════════════════════════════
  // Determine if public figure (high publicness threshold)
  const isPublicFigure = latents.publicness > 600;
  // We'll determine hasControversialViews based on principledness extremes
  // (very high or very low principledness signals strong/polarizing views)
  const hasControversialViews = latents.principledness > 850 || latents.principledness < 150;

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

      // NEW47: Controversial public figures have reduced leadership probability
      if ((r === 'leader' || r === 'organizer') && hasControversialViews && isPublicFigure) {
        w *= 0.25; // 75% reduction in leadership roles
      }

      return { item: r as CommunityRole, weight: w };
    });
    const role = weightedPick(commRng, roleWeights) as CommunityRole;
    const intensityBand = band5From01k(commRng.int(200, 800));
    memberships.push({ type, role, intensityBand });
  }

  // Correlate #NEW45: Urbanicity → Online Community (negative: urban → fewer online communities)
  // Rural agents have fewer physical third places, so they compensate with more online communities
  // Urban agents have abundant physical third places, reducing need for online connection
  const urbanPopulationLevel = ctx.urbanPopulation01 ?? 0.5;
  // Continuous gradient: more urban = fewer online communities
  const urbanRuralOnlineBias = 1 - urbanPopulationLevel; // 0=urban, 1=rural
  let onlineMin = urbanPopulationLevel < 0.4 ? 1 : 0; // Rural/small town guarantees 1
  let onlineMax = 1 + Math.floor(2.5 * urbanRuralOnlineBias); // Rural: 3, Urban: 1

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW51: Low Social Battery → Online Community Preference
  // Introverts (low socialBattery < 350) prefer digital connection
  // Increase online community weight
  // ═══════════════════════════════════════════════════════════════════════════
  if (latents.socialBattery < 350) {
    onlineMin = Math.max(onlineMin, 1); // Ensure at least 1 online community
    onlineMax = Math.max(onlineMax, 2); // Allow up to 2 minimum
  }

  let onlineCommunities = commRng.pickK(onlineCommunityPool, commRng.int(onlineMin, onlineMax));

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW52: Diaspora + Minority → Dual Community
  // If isDiaspora AND isVisibleMinority, ensure >= 2 communities
  // Multiple identity groups require maintaining dual community connections
  // ═══════════════════════════════════════════════════════════════════════════
  const isDiaspora = ['expat', 'refugee', 'diaspora-child', 'dual-citizen'].includes(diasporaStatus);
  // isVisibleMinority will be computed later, but we can use the same logic here
  const isMinorityForCommunity = homeCountryIso3 !== currentCountryIso3;
  if (isDiaspora && isMinorityForCommunity && memberships.length < 2) {
    // Add a second community membership if only one exists
    const availableTypes = communityTypes.filter(t => !usedCommunityTypes.has(t));
    if (availableTypes.length > 0) {
      const type = commRng.pick(availableTypes) as CommunityType;
      usedCommunityTypes.add(type);
      const role = commRng.next01() < 0.5 ? 'regular' : 'occasional';
      memberships.push({ type, role: role as CommunityRole, intensityBand: band5From01k(commRng.int(300, 600)) });
    }
  }

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

  // PR3: Visible Minority ↔ Community Status (negative correlation)
  // Visible minorities face systemic barriers to achieving high community status
  // Computed locally using same logic as narrative.ts (homeCountry !== currentCountry)
  const isVisibleMinority = homeCountryIso3 !== currentCountryIso3 && commRng.next01() < 0.7;
  // Stronger penalty for high-status outcomes and boost for lower status
  const minorityStatusPenalty = isVisibleMinority ? 0.35 : 1.0;  // Much stronger penalty
  const minorityStatusBoost = isVisibleMinority ? 1.8 : 1.0;     // Boost lower statuses

  // Correlate #NEW9: Deception ↔ Community Status (negative)
  // High deception aptitude → lower community standing (manipulators get discovered over time)
  const deceptionForStatus = aptitudes.deceptionAptitude / 1000;

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

    // #NEW9: High deception → lower community standing
    // Manipulative people struggle to maintain long-term community trust
    // Apply across full range (not just above threshold) for stronger correlation
    if (s === 'pillar' || s === 'respected') {
      w *= Math.max(0.15, 1 - 2.0 * deceptionForStatus); // Deception penalizes high status
      // PR3: Visible minorities face barriers to high community status (probabilistic penalty)
      w *= minorityStatusPenalty;
    }
    if (s === 'controversial' || s === 'outsider') {
      w *= (1 + 2.5 * deceptionForStatus); // Deception boosts low status
      // PR3: Visible minorities more likely to be outsiders/controversial (discrimination effect)
      w *= minorityStatusBoost;
    }
    if (s === 'regular' || s === 'newcomer') {
      // PR3: Visible minorities pushed toward newcomer/regular status
      w *= isVisibleMinority ? 1.3 : 1.0;
    }

    return { item: s as CommunityStatus, weight: w };
  });
  let communityStatus = weightedPick(commRng, statusWeights) as CommunityStatus;

  // ─────────────────────────────────────────────────────────────────────────
  // Plausibility Gate #PG5: Community Role ↔ Status Consistency
  // ─────────────────────────────────────────────────────────────────────────
  // - "lurker" community role cannot have "pillar" community status
  // - "leader" community role cannot have "newcomer" or "outsider" status
  // Apply post-hoc adjustment if contradictions occur
  const hasLurkerRole = memberships.some(m => m.role === 'lurker');
  const hasLeaderRole = memberships.some(m => m.role === 'leader');

  // PG5: Lurkers cannot be pillars - they don't participate enough to earn that status
  if (hasLurkerRole && communityStatus === 'pillar') {
    communityStatus = commRng.next01() < 0.6 ? 'regular' : 'respected';
  }

  // PG5: Leaders cannot be newcomers or outsiders - leadership requires established presence
  if (hasLeaderRole && (communityStatus === 'newcomer' || communityStatus === 'outsider')) {
    communityStatus = commRng.next01() < 0.5 ? 'respected' : 'regular';
  }

  // Correlate #NEW40: Young mass tier cannot be community pillar
  // Young (<35) mass tier agents lack the resources and tenure to be community pillars
  if (age < 35 && tierBand === 'mass' && communityStatus === 'pillar') {
    communityStatus = 'respected'; // Demote to respected - still positive but realistic
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETERMINISTIC POST-HOC ADJUSTMENT for #N1 Community Status ↔ Network Role
  // High community status (pillar, respected) → high network role (hub, gatekeeper)
  // Low community status (outsider, newcomer) → low network role (isolate, peripheral)
  // ─────────────────────────────────────────────────────────────────────────
  const highCommunityStatus = communityStatus === 'pillar' || communityStatus === 'respected';
  const lowCommunityStatus = communityStatus === 'outsider' || communityStatus === 'newcomer' || communityStatus === 'banned';
  const highNetworkRoles: NetworkRole[] = ['hub', 'gatekeeper', 'broker'];
  const lowNetworkRoles: NetworkRole[] = ['isolate', 'peripheral'];

  if (highCommunityStatus && lowNetworkRoles.includes(networkRole)) {
    // Pillar/respected with low network role: upgrade to connector or hub
    networkRole = commRng.next01() < 0.5 ? 'connector' : 'hub';
    // Update the network object with the new role
    network.role = networkRole;
  } else if (lowCommunityStatus && highNetworkRoles.includes(networkRole)) {
    // Outsider/newcomer with high network role: downgrade
    networkRole = commRng.next01() < 0.5 ? 'peripheral' : 'connector';
    network.role = networkRole;
  }

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

  let professional = pickReputation({ reliable: 2, 'by-the-book': 1 });

  // ─────────────────────────────────────────────────────────────────────────
  // DETERMINISTIC POST-HOC ADJUSTMENT for #14 Visibility ↔ Reputation
  // High visibility → higher reputation (brilliant, fixer, rising-star)
  // Low visibility → lower reputation (unknown, has-been, burnt-out)
  // The numeric mapping: unknown=0, has-been=1, by-the-book=2, reliable=3, fixer=4, brilliant=4
  // ─────────────────────────────────────────────────────────────────────────
  const highRepTags: ReputationTag[] = ['brilliant', 'fixer', 'rising-star'];
  const lowRepTags: ReputationTag[] = ['unknown', 'has-been', 'burnt-out', 'corrupt', 'loudmouth'];
  const midRepTags: ReputationTag[] = ['reliable', 'principled', 'discreet', 'by-the-book'];

  if (publicness01 > 0.65 && lowRepTags.includes(professional)) {
    // High visibility with low reputation: upgrade to mid or high
    professional = repRng.next01() < 0.5 ? repRng.pick(midRepTags) : repRng.pick(highRepTags);
  } else if (publicness01 < 0.35 && highRepTags.includes(professional)) {
    // Low visibility with high reputation: downgrade to mid or low
    professional = repRng.next01() < 0.6 ? repRng.pick(midRepTags) : 'unknown';
  }

  let neighborhood = pickReputation({ unknown: 2 });
  let online = pickReputation({ loudmouth: latents.publicness > 600 ? 2 : 0 });

  // Correlate #NEW41: High opsec + high publicness is inconsistent → reduce reputation visibility
  // Agents who maintain high operational security while also being highly public are contradictory
  // Resolution: cap their visible reputation to 'discreet' or 'unknown' (opsec wins over publicness)
  if (opsec01 > 0.7 && publicness01 > 0.7) {
    // Force reputation toward discreet/unknown to resolve the inconsistency
    const discreteReputations: ReputationTag[] = ['discreet', 'unknown', 'by-the-book'];
    if (!discreteReputations.includes(professional)) {
      professional = repRng.next01() < 0.7 ? 'discreet' : 'unknown';
    }
    if (!discreteReputations.includes(neighborhood)) {
      neighborhood = 'unknown'; // Neighborhood rep becomes unknown for opsec agents
    }
    if (!discreteReputations.includes(online)) {
      online = repRng.next01() < 0.6 ? 'discreet' : 'unknown';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW55: Age + Status → Reputation Match
  // If age > 55 AND communityStatus == "pillar", ensure neighborhood reputation is positive
  // Elder pillars of the community are respected in their neighborhood
  // Use 'reliable' or 'principled' as these indicate respected standing
  // ═══════════════════════════════════════════════════════════════════════════
  const positiveReputations: ReputationTag[] = ['reliable', 'principled', 'discreet', 'fixer', 'brilliant'];
  if (age > 55 && communityStatus === 'pillar' && !positiveReputations.includes(neighborhood)) {
    // Elder pillars default to 'reliable' - a respected, trusted reputation
    neighborhood = repRng.next01() < 0.6 ? 'reliable' : 'principled';
  }

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

  // Correlate #B2: Third Places ↔ Civic Engagement (positive)
  // Social battery determines third place count, so we use it as a direct proxy.
  // More third places = more exposure to community = higher civic engagement.
  const socialBattery01 = latents.socialBattery / 1000;
  // Pre-compute expected third place count (mirrors domestic.ts logic)
  const expectedThirdPlaces = socialBattery01 < 0.3 ? 1 : socialBattery01 < 0.6 ? 2 : 3;
  const engagementWeights = engagementPool.map(e => {
    let w = 1;
    if (e === 'organizer' && roleSeedTags.includes('organizer')) w = 4;
    if (e === 'active-participant' && latents.principledness > 600) w = 2;
    // #B2: Third places strongly boost active engagement (multiplicative effect)
    if (e === 'active-participant') {
      w *= (0.5 + 0.5 * expectedThirdPlaces); // 1x at 1 place, 2x at 3+ places
      if (socialBattery01 > 0.7) w += 2.5;
    }
    if (e === 'organizer') {
      w *= (0.4 + 0.4 * expectedThirdPlaces);
      if (socialBattery01 > 0.75) w += 2.0;
    }
    if (e === 'disengaged' && latents.publicness < 350) w = 3;
    // #B2: Low social battery (few third places) → disengaged (strengthened)
    if (e === 'disengaged' && socialBattery01 < 0.35) w += 3.0;
    if (e === 'disengaged') w *= (1.8 - socialBattery01); // More isolation = more disengaged
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
