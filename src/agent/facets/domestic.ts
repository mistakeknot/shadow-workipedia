/**
 * Domestic Facet - Daily life, home, administrative status, and life skills
 *
 * Handles (Oracle recommendations):
 * - Everyday life: third places, commute, weekly anchors, petty habits, caregiving
 * - Home: housing stability, household composition, privacy, neighborhood
 * - Legal/admin: residency status, legal exposure, credentials
 * - Life skills: domestic competence, bureaucracy navigation, street smarts, etiquette
 */

import type {
  TierBand,
  AgentVocabV1,
  AgentGenerationTraceV1,
  Latents,
  CommuteMode,
  WeeklyAnchor,
  CaregivingObligation,
  PettyHabit,
  HousingStability,
  HouseholdComposition,
  PrivacyLevel,
  NeighborhoodType,
  ResidencyStatus,
  LegalExposure,
  CredentialType,
  CompetenceBand,
  EtiquetteLiteracy,
} from '../types';

import {
  makeRng,
  facetSeed,
  weightedPick,
  weightedPickKUnique,
  clampFixed01k,
  traceSet,
  traceFacet,
} from '../utils';

// ============================================================================
// Types
// ============================================================================

export type DomesticContext = {
  seed: string;
  vocab: AgentVocabV1;
  latents: Latents;
  tierBand: TierBand;
  age: number;
  roleSeedTags: string[];
  careerTrackTag: string;
  trace?: AgentGenerationTraceV1;

  // Country context
  homeCountryIso3: string;
  currentCountryIso3: string;
  citizenshipCountryIso3: string;

  // Urbanicity for home context
  urbanicity: string;

  // Country indicator priors (0..1 normalized)
  gdpPerCap01?: number;

  // Traits for correlates
  traits?: {
    conscientiousness: number; // 0-1000 (Correlate #13: Conscientiousness ↔ Housing)
    authoritarianism: number;  // 0-1000 (Correlate #X6: Authoritarianism ↔ Home Orderliness)
  };

  // Family status for housing constraints
  maritalStatus?: string;
  dependentCount?: number;

  // Mobility context for plausibility gates (from lifestyle facet)
  mobilityTag?: string;

  // Diaspora status for DC-D16 correlate (from geography facet)
  diasporaStatus?: string;

  // Education track for NEW13 correlate (Education ↔ Bureaucracy Navigation)
  educationTrackTag?: string;
};

/** Everyday life anchors */
export type EverydayLifeResult = {
  thirdPlaces: string[];
  commuteMode: CommuteMode;
  weeklyAnchor: WeeklyAnchor;
  pettyHabits: PettyHabit[];
  caregivingObligation: CaregivingObligation;
  /** Correlate #X6: Authoritarianism ↔ Home Orderliness (0-1000) */
  homeOrderliness: number;
  /** Correlate #DC-D22: High stressReactivity + low homeOrderliness → hoarding risk flag */
  hoardingRiskFlag: boolean;
};

/** Home and domestic situation */
export type HomeResult = {
  housingStability: HousingStability;
  householdComposition: HouseholdComposition;
  privacyLevel: PrivacyLevel;
  neighborhoodType: NeighborhoodType;
  /** Correlate #DC-D16: Refugee status housing instability score reduction (0-1000, lower = less stable) */
  housingStabilityScore: number;
  /** Correlate #DC-D17: Elite + family household size minimum */
  householdSizeMin: number;
  /** Correlate #DC-D18: Age > 70 accessibility preference flag */
  requiresAccessibility: boolean;
  /** Correlate #DC-D19: Very high opsec requires private entry */
  requiresPrivateEntry: boolean;
};

// DC-D4: Credential validity status based on residency
export type CredentialValidity = 'valid' | 'unrecognized' | 'foreign' | 'expired';

export type CredentialWithValidity = {
  type: CredentialType;
  validity: CredentialValidity;
};

/** Legal and administrative status */
export type LegalAdminResult = {
  residencyStatus: ResidencyStatus;
  legalExposure: LegalExposure;
  credentials: CredentialType[];
  // DC-D4: Enhanced credentials with validity status
  credentialsWithValidity: CredentialWithValidity[];
};

/** Life skills - competence outside the job */
export type LifeSkillsResult = {
  domesticCompetence: CompetenceBand;
  bureaucracyNavigation: CompetenceBand;
  streetSmarts: CompetenceBand;
  etiquetteLiteracy: EtiquetteLiteracy;
  // DC-D9: Skill categories affected by urbanicity
  primarySkillDomain: 'urban' | 'rural' | 'mixed';
};

export type DomesticResult = {
  everydayLife: EverydayLifeResult;
  home: HomeResult;
  legalAdmin: LegalAdminResult;
  lifeSkills: LifeSkillsResult;
};

export type HousingWeightsInput = {
  housingPool: HousingStability[];
  tierBand: TierBand;
  age: number;
  roleSeedTags: string[];
  gdp01: number;
  conscientiousness01: number;
  riskAppetite01: number;
  frugality01: number;
  hasFamily: boolean;
  /** Correlate #NEW39: Married status (with or without kids) affects housing */
  isMarried: boolean;
  isSeniorProfessional: boolean;
  /** Correlate #H3: Cosmopolitanism ↔ Housing Stability (negative) - nomads avoid stable housing */
  cosmopolitanism01: number;
  /** Correlate #H1: Household size affects housing stability needs */
  householdSize: number;
  /** Correlate #NEW2: Institutional Embeddedness ↔ Housing Stability (positive) */
  inst01: number;
  /** Correlate #NEW34: Career Track → Housing Stability gate */
  careerTrackTag: string;
};

export function computeHousingWeights({
  housingPool,
  tierBand,
  age,
  roleSeedTags: _roleSeedTags, // Reserved for future role-based housing preferences
  gdp01,
  conscientiousness01,
  riskAppetite01,
  frugality01,
  hasFamily,
  isMarried,
  isSeniorProfessional,
  cosmopolitanism01,
  householdSize,
  inst01,
  careerTrackTag,
}: HousingWeightsInput): Array<{ item: HousingStability; weight: number }> {
  return housingPool.map(h => {
    let w = 1;
    const isStable = h === 'owned' || h === 'stable-rental';
    const isUnstable = h === 'tenuous' || h === 'transient' || h === 'couch-surfing';

    // HARD CONSTRAINT: Married with dependents cannot be couch-surfing or transient
    if (hasFamily && (h === 'couch-surfing' || h === 'transient')) {
      return { item: h as HousingStability, weight: 0 };
    }
    // Correlate #NEW39: Marital status affects housing (cross-facet)
    // Married agents (even without kids) have reduced couch-surfing probability
    // Marriage implies household stability expectations from partner
    if (isMarried && !hasFamily && h === 'couch-surfing') {
      // Married without kids: soft constraint (not zero, but heavily reduced)
      return { item: h as HousingStability, weight: 0.1 };
    }
    // HARD CONSTRAINTS: Elite tier housing stability
    // Elite agents cannot be couch-surfing, transient, or tenuous
    if (tierBand === 'elite' && (h === 'couch-surfing' || h === 'transient' || h === 'tenuous')) {
      return { item: h as HousingStability, weight: 0 };
    }
    // HARD CONSTRAINT: Senior professionals (15+ years experience, not mass tier)
    // cannot be couch-surfing - this housing status is incompatible with established career
    if (isSeniorProfessional && h === 'couch-surfing') {
      return { item: h as HousingStability, weight: 0 };
    }
    // HARD CONSTRAINT: Very low risk appetite avoids unstable housing entirely
    if (riskAppetite01 <= 0.2 && (h === 'tenuous' || h === 'transient' || h === 'couch-surfing')) {
      return { item: h as HousingStability, weight: 0 };
    }
    // HARD CONSTRAINT #NEW34: Credibility-requiring careers cannot have unstable housing
    // Diplomats, corporate executives, foreign service need stable address for credibility
    const credibilityCareerTracks = ['foreign-service', 'corporate-ops', 'diplomacy', 'politics', 'civil-service', 'law'];
    if (credibilityCareerTracks.includes(careerTrackTag) && (h === 'couch-surfing' || h === 'transient')) {
      return { item: h as HousingStability, weight: 0 };
    }

    // Pre-compute cosmopolitanism/frugality multipliers
    // #H3: Cosmopolitanism ↔ Housing Stability (negative - high cosmo → unstable)
    // #H4: Frugality ↔ Housing Stability (positive - high frug → stable)
    //
    // VERY STRONG multipliers to overcome 54% hard-constrained population
    // For STABLE housing: high cosmo → penalty, high frug → boost
    // For UNSTABLE housing: high cosmo → boost, high frug → penalty
    const stableMultiplier = (0.2 + 2.0 * (1 - cosmopolitanism01)) * (0.3 + 2.0 * frugality01);
    //  - High cosmo, low frug: (0.2) * (0.3) = 0.06
    //  - Low cosmo, high frug: (2.2) * (2.3) = 5.06
    const unstableMultiplier = (0.2 + 3.5 * cosmopolitanism01) * (0.2 + 2.5 * (1 - frugality01));
    //  - High cosmo, low frug: (3.7) * (2.7) = 9.99
    //  - Low cosmo, high frug: (0.2) * (0.2) = 0.04

    // Tier correlates (primary effect - tier determines baseline housing options)
    if (h === 'owned' && tierBand === 'elite') w = 6;
    if (h === 'owned' && tierBand === 'middle' && age > 35) w = 3;
    if (h === 'stable-rental' && tierBand === 'middle') w = 4;
    if (h === 'tenuous' && tierBand === 'mass') w = 3;

    // GDP per cap indicator
    if (h === 'owned' || h === 'stable-rental') w += 1.2 * gdp01;
    if (h === 'tenuous' || h === 'transient' || h === 'couch-surfing') w += 1.2 * (1 - gdp01);

    // Correlate #13: Conscientiousness ↔ Housing (limited by hard constraints)
    // NOTE: 60% of population has housing constrained by tier/family/risk
    // This correlation is structurally weak due to hard constraints
    if (isStable) {
      w += 2.0 * conscientiousness01;
    }
    if (isUnstable) {
      w += 2.0 * (1 - conscientiousness01);
    }

    // Correlate #NEW2: Institutional Embeddedness ↔ Housing Stability (positive)
    // People deeply embedded in institutions (career, organizations) prefer stable housing
    // High embeddedness → stable jobs → stable housing; low embeddedness → transient lifestyle
    // Use multiplicative factor for stronger correlation (stable: 1x-3x, unstable: 1x-2.5x)
    if (isStable) {
      w *= (1.0 + 2.0 * inst01); // High embedded: 3x stable weight
    }
    if (isUnstable) {
      w *= (1.0 + 1.5 * (1 - inst01)); // Low embedded: 2.5x unstable weight
    }

    // Correlate #15: Risk Appetite ↔ Housing Instability
    // High risk appetite → more likely transient/unconventional housing
    // Low risk appetite → prefers stable, predictable housing
    // Strong multiplicative + additive effect to overcome tier/family constraints
    const riskFactor = 0.5 + riskAppetite01; // Range: 0.5 to 1.5
    if (h === 'tenuous' || h === 'transient' || h === 'couch-surfing') {
      w *= riskFactor; // High risk = higher unstable weight
      w += 4.0 * riskAppetite01; // Strong additive boost for risk takers
    }
    if (h === 'owned' || h === 'stable-rental') {
      w *= (2.0 - riskFactor); // Low risk = higher stable weight
      w += 3.0 * (1 - riskAppetite01); // Risk averse prefer stability
    }

    // Soft bias: families prefer stable housing
    if (hasFamily && (h === 'owned' || h === 'stable-rental')) {
      w += 3;
    }

    // Correlate #H1: Household Size ↔ Housing Stability (positive)
    // Larger households need stable housing to function
    if (householdSize > 1) {
      if (isStable) {
        w += 2.5 * Math.min(4, householdSize - 1); // Each additional person adds stability need
        w *= (1 + 0.15 * Math.min(3, householdSize - 1)); // Multiplicative boost for larger households
      }
      if (householdSize > 2 && isUnstable) {
        w *= Math.max(0.2, 1 - 0.25 * (householdSize - 2)); // Households 3+ heavily penalize unstable
      }
    }

    // Correlate #A2/A3: Age ↔ Housing Stability
    // Young adults more likely unstable (just starting out), older adults more stable (settled)
    if (age < 28) {
      if (isUnstable) w += 3.0; // Young people in transient housing
      if (isStable) w *= 0.6; // Young people less likely to own
    } else if (age < 35) {
      // Transitional period - slight unstable bias
      if (isUnstable) w += 1.5;
    } else if (age >= 45) {
      if (isStable) w += 4.0; // Older adults settled
      if (isUnstable) w *= 0.4; // Older adults rarely couch-surf
    }

    // Apply cosmo/frugality multipliers at END to scale final weight
    // This ensures the effect survives tier/age/risk domination
    if (isStable) {
      w *= stableMultiplier;
      // Within stable, differentiate owned vs rental
      // High cosmo prefers rental (mobility), high frug prefers owned (equity)
      // Stronger multipliers to create more variance
      if (h === 'owned') {
        w *= (0.4 + 1.2 * frugality01); // Frugal → owned (0.4→1.6)
        w *= (1.4 - 0.8 * cosmopolitanism01); // Cosmo → avoid owned (0.6→1.4)
      }
      if (h === 'stable-rental') {
        w *= (1.4 - 0.8 * frugality01); // Non-frugal → rental (0.6→1.4)
        w *= (0.4 + 1.2 * cosmopolitanism01); // Cosmo → rental (0.4→1.6)
      }
    }
    if (isUnstable) {
      w *= unstableMultiplier;
    }

    return { item: h as HousingStability, weight: w };
  });
}

// ============================================================================
// Main Computation
// ============================================================================

export function computeDomestic(ctx: DomesticContext): DomesticResult {
  const {
    seed,
    vocab,
    latents,
    tierBand,
    age,
    roleSeedTags,
    careerTrackTag,
    trace,
    homeCountryIso3,
    currentCountryIso3,
    citizenshipCountryIso3,
    urbanicity,
  } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // EVERYDAY LIFE (Oracle recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'everydayLife');
  const lifeRng = makeRng(facetSeed(seed, 'everydayLife'));

  const thirdPlacePool = vocab.everydayLife?.thirdPlaces ?? [
    'gym', 'cafe', 'bar', 'library', 'mosque', 'church', 'park', 'community-center',
    'barber-shop', 'market', 'tea-house', 'sports-club', 'pub', 'diner',
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // Social Battery ↔ Third Places Correlate
  // ─────────────────────────────────────────────────────────────────────────────
  // High social battery → more third places (extroverts frequent multiple social venues)
  // Low social battery → fewer third places (introverts need fewer social outlets)
  const socialBattery01 = latents.socialBattery / 1000;
  const urbanicityAdjust =
    (urbanicity === 'megacity' || urbanicity === 'capital' || urbanicity === 'major-city') ? 1
      : (urbanicity === 'rural' || urbanicity === 'rural-remote' || urbanicity === 'small-town') ? -1
        : 0;
  // Correlate #N2: Dependent Count ↔ Third Places (negative)
  // Caregivers have less free time for social venues
  const dependentPenalty = Math.min(2, ctx.dependentCount ?? 0);
  const thirdPlaceCountBase = (socialBattery01 < 0.3 ? 1 : socialBattery01 < 0.6 ? 2 : 3) + urbanicityAdjust - dependentPenalty;
  const thirdPlaceCountVariance = lifeRng.int(0, 1);
  const thirdPlaceCount = Math.max(1, Math.min(thirdPlacePool.length, thirdPlaceCountBase + thirdPlaceCountVariance));
  const thirdPlaces = lifeRng.pickK(thirdPlacePool, thirdPlaceCount);

  const commuteModePool = vocab.everydayLife?.commuteModes ?? [
    'walk', 'bicycle', 'motorbike', 'bus', 'metro', 'driver', 'rideshare', 'mixed',
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // Correlate #DC-D12: Low physical conditioning limits commute options
  // People with poor physical conditioning (< 350/1000) avoid physically demanding
  // commute methods like cycling. This reflects realistic physical limitations.
  // ─────────────────────────────────────────────────────────────────────────────
  const conditioning01k = latents.physicalConditioning;
  const lowConditioning = conditioning01k < 350;

  // DC-D20: Rural → Vehicle Dependency check
  // If urbanicity == "rural", commute style must include vehicle option
  const isRuralArea = urbanicity === 'rural' || urbanicity === 'rural-remote' || urbanicity === 'rural-isolated';

  const commuteWeights = commuteModePool.map(c => {
    let w = 1;
    if (c === 'driver' && tierBand === 'elite') w = 5;
    if (c === 'metro' && (urbanicity === 'capital' || urbanicity === 'megacity')) w = 4;
    if (c === 'bus' && tierBand === 'mass') w = 3;
    if (c === 'walk' && urbanicity === 'small-town') w = 3;
    if (c === 'bicycle' && urbanicity === 'secondary-city') w = 2;
    if (c === 'remote' && (roleSeedTags.includes('analyst') || roleSeedTags.includes('research') || tierBand === 'elite')) w = 3;

    // ─────────────────────────────────────────────────────────────────────────────
    // DC-D20: Rural → Vehicle Dependency
    // If urbanicity == "rural", commute must include vehicle option
    // Rationale: Rural areas require driving due to distance/lack of transit
    // ─────────────────────────────────────────────────────────────────────────────
    if (isRuralArea) {
      const vehicleModes = ['driver', 'motorbike', 'carpool', 'rideshare'];
      const nonVehicleModes = ['metro', 'bus', 'walk', 'bicycle'];
      if (vehicleModes.includes(c)) {
        w *= 5; // Strongly prefer vehicle-based commutes in rural areas
      }
      if (nonVehicleModes.includes(c)) {
        w *= 0.1; // Metro/bus rarely available in rural areas; walk/bike impractical for distances
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Correlate #DC-D12 + DC-D21: Low physical conditioning limits commute options
    // DC-D12: Low conditioning (< 350) restricts physically demanding commutes
    // DC-D21: Low conditioning (< 300) reduces bicycle commute weight specifically
    // Rationale: Unfit people avoid strenuous commute
    // ─────────────────────────────────────────────────────────────────────────────
    if (lowConditioning) {
      if (c === 'bicycle' || c === 'cyclist') w *= 0.1; // Very unlikely to cycle
      if (c === 'walk' && urbanicity !== 'small-town') w *= 0.5; // Less likely to walk long distances
    }
    // DC-D21 enhancement: Very low conditioning (< 300) makes bicycle nearly impossible
    if (conditioning01k < 300) {
      if (c === 'bicycle' || c === 'cyclist') w *= 0.02; // Near-zero probability
    }
    // Higher conditioning makes active commutes more attractive
    if (conditioning01k > 700) {
      if (c === 'bicycle' || c === 'cyclist') w *= 1.8;
      if (c === 'walk') w *= 1.3;
    }

    return { item: c as CommuteMode, weight: w };
  });
  let commuteMode = weightedPick(lifeRng, commuteWeights) as CommuteMode;

  // DC-D20 post-hoc gate: Ensure rural agents have vehicle access
  // If rural and selected non-vehicle mode, force to driver/motorbike
  if (isRuralArea) {
    const nonVehicleModes: CommuteMode[] = ['metro', 'bus', 'walk', 'bicycle'];
    if (nonVehicleModes.includes(commuteMode)) {
      commuteMode = 'driver'; // Default to driver in rural areas
      if (trace) {
        trace.derived = trace.derived ?? {};
        trace.derived.dcD20RuralVehicleGate = {
          urbanicity,
          originalCommute: commuteMode,
          adjustedCommute: 'driver',
          reason: 'DC-D20: Rural areas require vehicle-based commute',
        };
      }
    }
  }

  const weeklyAnchorPool = vocab.everydayLife?.weeklyAnchors ?? [
    'friday-prayer', 'sunday-service', 'saturday-synagogue', 'weekly-market',
    'sports-match', 'family-dinner', 'night-class', 'volunteer-shift', 'therapy-session', 'none',
  ];

  // Correlate #DC-D3: Dependents require stable weekly schedule
  // Agents with dependents cannot have 'none' or chaotic schedules - children need routine
  const hasDependentsForSchedule = (ctx.dependentCount ?? 0) > 0;
  let weeklyAnchor: WeeklyAnchor;
  if (hasDependentsForSchedule) {
    // Filter out 'none' - dependents need structured routine
    const stableAnchors = weeklyAnchorPool.filter(a => a !== 'none');
    weeklyAnchor = (stableAnchors.length > 0 ? lifeRng.pick(stableAnchors) : 'family-dinner') as WeeklyAnchor;
  } else {
    weeklyAnchor = lifeRng.pick(weeklyAnchorPool) as WeeklyAnchor;
  }

  const pettyHabitPool = vocab.everydayLife?.pettyHabits ?? [
    'always-early', 'always-late', 'forgets-keys', 'checks-locks', 'overpacks',
    'skips-breakfast', 'double-checks-everything', 'loses-phone',
  ];
  // Correlate #B1: Conscientiousness ↔ Petty Habits
  // High conscientiousness → organized habits (early, checks-locks, double-checks)
  // Low conscientiousness → disorganized habits (late, forgets-keys, loses-phone)
  const cons01 = (ctx.traits?.conscientiousness ?? 500) / 1000;
  const organizedHabits = new Set(['always-early', 'checks-locks', 'double-checks-everything', 'overpacks']);
  const disorganizedHabits = new Set(['always-late', 'forgets-keys', 'loses-phone', 'skips-breakfast']);
  const pettyHabitWeights = pettyHabitPool.map(h => {
    let w = 1;
    if (organizedHabits.has(h)) {
      w += 4.0 * cons01; // High conscientiousness → organized
      w *= (0.4 + 1.2 * cons01); // Multiplicative effect
    }
    if (disorganizedHabits.has(h)) {
      w += 4.0 * (1 - cons01); // Low conscientiousness → disorganized
      w *= (1.6 - 1.2 * cons01);
    }
    return { item: h as PettyHabit, weight: w };
  });
  const pettyHabits = weightedPickKUnique(lifeRng, pettyHabitWeights, lifeRng.int(1, 2)) as PettyHabit[];

  const caregivingPool = vocab.everydayLife?.caregivingObligations ?? [
    'elder-care', 'child-pickup', 'sibling-support', 'disabled-family', 'none',
  ];
  const caregivingWeights = caregivingPool.map(c => {
    let w = c === 'none' ? 5 : 1;
    // Correlate #DC-D1: Age affects caregiving obligation
    // Age 50-70: increased eldercare probability (sandwich generation caring for aging parents)
    // Age 70+: decreased childcare (children are grown, agent may need care themselves)
    if (c === 'elder-care') {
      if (age > 50 && age < 70) w = 5; // Peak eldercare years
      else if (age > 35) w = 3;
    }
    if (c === 'child-pickup') {
      if (age > 70) w = 0.3; // Elderly rarely do school pickups
      else if (age > 28 && age < 50) w = 3;
    }
    return { item: c as CaregivingObligation, weight: w };
  });
  // Note: DC-D6 (Household composition affects caregiving) is applied post-hoc after household is determined
  let caregivingObligation = weightedPick(lifeRng, caregivingWeights) as CaregivingObligation;

  // Correlate #X6: Authoritarianism ↔ Home Orderliness (positive)
  // Authoritarian personalities prefer order, structure, and cleanliness at home
  // Correlate #NEW15: Adaptability ↔ Home Order Tolerance (negative)
  // Adaptable people tolerate disorder; rigid people demand structure
  // Correlate #DC-D11: Stress → Home Order (negative, continuous)
  // Stress-reactive individuals struggle to maintain home order under pressure
  const stressReactivity01 = latents.stressReactivity / 1000;
  // Formula: 35% authoritarianism + 25% conscientiousness - 20% stress - 10% adaptability + 10% random
  let homeOrderliness = clampFixed01k(Math.round(
    0.35 * (ctx.traits?.authoritarianism ?? 500) +
    0.25 * (ctx.traits?.conscientiousness ?? 500) -
    0.20 * latents.stressReactivity + // #DC-D11: stress reduces home order (continuous)
    -0.10 * latents.adaptability + // #NEW15: adaptable = tolerates mess
    0.10 * lifeRng.int(0, 1000)
  ));

  // DC-D11 threshold effect: Very high stress caps orderliness (additional penalty)
  if (stressReactivity01 > 0.7) {
    homeOrderliness = Math.min(homeOrderliness, 550); // Cap at 550 if very stressed
  }

  // Note: everydayLife result is created after home section to allow DC-D6 adjustment
  // (caregivingObligation may be modified based on householdComposition)

  // ─────────────────────────────────────────────────────────────────────────────
  // HOME (Oracle recommendation)
  // Correlate #13: Conscientiousness ↔ Housing
  // Correlate #15: Risk ↔ Housing
  // FIX: Housing constraints based on family situation
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'home');
  const homeRng = makeRng(facetSeed(seed, 'home'));

  // Extract traits for correlates
  const conscientiousness01 = (ctx.traits?.conscientiousness ?? 500) / 1000;
  const riskAppetite01 = latents.riskAppetite / 1000;
  const frugality01 = latents.frugality / 1000;
  const cosmopolitanism01 = latents.cosmopolitanism / 1000;
  const inst01 = latents.institutionalEmbeddedness / 1000; // #NEW2: Institutional Embeddedness ↔ Housing
  const gdp01 = Number.isFinite(ctx.gdpPerCap01 ?? NaN) ? Math.max(0, Math.min(1, ctx.gdpPerCap01 as number)) : 0.5;

  // Family constraints for housing
  const isMarried = ctx.maritalStatus === 'married' || ctx.maritalStatus === 'partnered';
  const hasDependents = (ctx.dependentCount ?? 0) > 0;
  const hasFamily = isMarried && hasDependents;

  // Estimate household size for housing weights (#H1 correlate)
  // This is an estimate before household composition is determined
  const estimatedHouseholdSize = 1 + (isMarried ? 1 : 0) + (ctx.dependentCount ?? 0);

  const housingPool = (vocab.home?.housingStabilities?.length
    ? vocab.home.housingStabilities
    : ['owned', 'stable-rental', 'tenuous', 'transient', 'couch-surfing', 'institutional']
  ) as HousingStability[];
  // Estimate years of professional experience (starts around age 22)
  const estimatedYearsWorking = Math.max(0, age - 22);
  const isSeniorProfessional = estimatedYearsWorking >= 15 && tierBand !== 'mass';

  const housingWeights = computeHousingWeights({
    housingPool,
    tierBand,
    age,
    roleSeedTags,
    gdp01,
    conscientiousness01,
    riskAppetite01,
    frugality01,
    hasFamily,
    isMarried, // #NEW39: Married status affects housing
    isSeniorProfessional,
    cosmopolitanism01,
    householdSize: estimatedHouseholdSize,
    inst01, // #NEW2: Institutional Embeddedness ↔ Housing Stability
    careerTrackTag, // #NEW34: Credibility careers require stable housing
  });
  const housingStability = weightedPick(homeRng, housingWeights) as HousingStability;

  const householdPool = vocab.home?.householdCompositions ?? [
    'alone', 'roommates', 'partner', 'partner-and-kids', 'extended-family', 'multigenerational',
  ];

  // Note: isMarried (line 208) and hasDependents (line 209) already defined above
  // isPartnered is same as isMarried for household constraints
  const isPartnered = isMarried;

  const householdWeights = householdPool.map(h => {
    let w = 1;

    // HARD CONSTRAINTS for household-family coherence
    // Cannot live "alone" if married/partnered
    if (h === 'alone' && isPartnered) {
      return { item: h as HouseholdComposition, weight: 0 };
    }
    // Cannot live "alone" if has dependents (kids)
    if (h === 'alone' && hasDependents) {
      return { item: h as HouseholdComposition, weight: 0 };
    }
    // Cannot be "partner-and-kids" if no dependents
    if (h === 'partner-and-kids' && !hasDependents) {
      return { item: h as HouseholdComposition, weight: 0 };
    }
    // Cannot be "partner" composition if has dependents (should be partner-and-kids)
    if (h === 'partner' && hasDependents) {
      w *= 0.1; // Very unlikely but not impossible (kids may not live with them)
    }
    // Strong preference for partner-and-kids if partnered with dependents
    if (h === 'partner-and-kids' && isPartnered && hasDependents) {
      w += 10;
    }

    // Soft preferences
    if (h === 'alone' && age < 30) w = 4;
    if (h === 'alone' && roleSeedTags.includes('operative')) w = 3;
    if (h === 'partner' && age > 28 && isPartnered && !hasDependents) w = 5;
    if (h === 'partner-and-kids' && age > 32) w = 3;
    if (h === 'extended-family' && tierBand === 'mass') w = 2;
    if (h === 'extended-family' && hasDependents) w += 2; // Kids often live with extended family

    return { item: h as HouseholdComposition, weight: w };
  });
  const householdComposition = weightedPick(homeRng, householdWeights) as HouseholdComposition;

  // Correlate #DC-D6: Household composition affects caregiving
  // If household includes elderly (multigenerational, extended-family), set hasEldercare = true
  const elderlyHouseholds: HouseholdComposition[] = ['multigenerational', 'extended-family'];
  if (elderlyHouseholds.includes(householdComposition) && caregivingObligation === 'none') {
    // Living with elderly almost always means some caregiving responsibility
    caregivingObligation = 'elder-care';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAUSIBILITY GATE DC-D2: Transient housing cannot have driver commute
  // People in transient/unstable housing typically cannot own/maintain a vehicle
  // ═══════════════════════════════════════════════════════════════════════════
  const unstableHousingTypes = ['transient', 'couch-surfing'];
  if (unstableHousingTypes.includes(housingStability) && commuteMode === 'driver') {
    commuteMode = 'bus'; // Use 'bus' as public transit fallback
    if (trace) {
      trace.derived = trace.derived ?? {};
      trace.derived.dcD2HousingCommuteGate = {
        housingStability,
        originalCommute: 'driver',
        adjustedCommute: 'bus',
        reason: 'DC-D2: Transient/couch-surfing housing incompatible with driver commute',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DC-D22: Stress + Disorder → Hoarding Flag
  // If stressReactivity > 750 AND homeOrderliness < 300, flag potential hoarding behavior
  // Rationale: Stress + disorder = hoarding risk
  // ─────────────────────────────────────────────────────────────────────────────
  const stressReactivity01k = latents.stressReactivity;
  const hoardingRiskFlag = stressReactivity01k > 750 && homeOrderliness < 300;
  if (hoardingRiskFlag && trace) {
    trace.derived = trace.derived ?? {};
    trace.derived.dcD22HoardingRisk = {
      stressReactivity: stressReactivity01k,
      homeOrderliness,
      reason: 'DC-D22: High stress reactivity (>750) combined with low home orderliness (<300) indicates hoarding risk',
    };
  }

  // Now create the everydayLife result after DC-D6, DC-D2, and DC-D22 adjustments
  const everydayLife: EverydayLifeResult = {
    thirdPlaces, commuteMode, weeklyAnchor, pettyHabits, caregivingObligation, homeOrderliness, hoardingRiskFlag,
  };
  traceSet(trace, 'everydayLife', everydayLife, { method: 'weighted' });

  const privacyPool = vocab.home?.privacyLevels ?? [
    'isolated', 'private', 'thin-walls', 'communal', 'surveilled',
  ];
  const privacyWeights = privacyPool.map(p => {
    let w = 1;
    if (p === 'isolated' && tierBand === 'elite') w = 3;
    if (p === 'private' && tierBand !== 'mass') w = 4;
    if (p === 'thin-walls' && tierBand === 'mass') w = 3;
    if (p === 'surveilled' && roleSeedTags.includes('operative')) w = 2;
    return { item: p as PrivacyLevel, weight: w };
  });
  let privacyLevel = weightedPick(homeRng, privacyWeights) as PrivacyLevel;

  // Note: DC-D5 (Neighborhood type affects privacy) is applied post-hoc after neighborhood is determined

  const neighborhoodPool = vocab.home?.neighborhoodTypes ?? [
    'elite-enclave', 'gentrifying', 'tight-knit', 'anonymous', 'insecure', 'gated', 'rural-isolated',
  ];
  const neighborhoodWeights = neighborhoodPool.map(n => {
    // Start with very low base - neighborhoods must be earned/match tier
    let w = 0.1;
    // Elite-enclave: only elite tier
    if (n === 'elite-enclave') {
      w = tierBand === 'elite' ? 8 : 0.01;
    }
    // Gated: elite or upper middle
    if (n === 'gated') {
      w = tierBand === 'elite' ? 5 : (tierBand === 'middle' ? 1 : 0.05);
    }
    // Insecure/informal: primarily mass tier, elite cannot have insecure neighborhoods
    if (n === 'insecure') {
      w = tierBand === 'elite' ? 0 : (tierBand === 'mass' ? 5 : (tierBand === 'middle' ? 1 : 0.1));
    }
    if (n === 'informal-settlement') {
      // Elite tier cannot live in informal settlements
      w = tierBand === 'elite' ? 0 : (tierBand === 'mass' ? 4 : 0.05);
    }
    // Anonymous: urbanicity-driven
    if (n === 'anonymous') {
      w = urbanicity === 'megacity' ? 5 : (urbanicity === 'major-city' ? 3 : 1);
    }
    // Tight-knit: smaller communities
    if (n === 'tight-knit') {
      w = urbanicity === 'small-town' ? 5 : (urbanicity === 'rural' ? 4 : (urbanicity === 'mid-city' ? 2 : 1));
    }
    // Rural-isolated: rural areas only
    if (n === 'rural-isolated') {
      w = urbanicity === 'rural' ? 8 : 0.1;
    }
    // Gentrifying: middle tier in cities
    if (n === 'gentrifying') {
      w = tierBand === 'middle' ? 4 : (tierBand === 'mass' ? 2 : 1);
    }

    // Correlate #DC-D7: Frugality affects neighborhood choice
    // High frugality (>700) weights modest/affordable neighborhoods
    if (frugality01 > 0.7) {
      // Frugal agents avoid expensive elite neighborhoods
      if (n === 'elite-enclave' || n === 'gated') {
        w *= 0.3; // Strong penalty for expensive areas
      }
      // Frugal agents prefer affordable options
      if (n === 'tight-knit' || n === 'anonymous' || n === 'gentrifying') {
        w *= 1.5; // Boost for more affordable neighborhoods
      }
    }

    return { item: n as NeighborhoodType, weight: w };
  });
  const neighborhoodType = weightedPick(homeRng, neighborhoodWeights) as NeighborhoodType;

  // ─────────────────────────────────────────────────────────────────────────────
  // PLAUSIBILITY GATES (post-hoc deterministic adjustments)
  // ─────────────────────────────────────────────────────────────────────────────

  // Plausibility Gate PG2: Nomadic Mobility → Unstable Housing
  // If mobilityTag === "nomadic", housing cannot be "owned" - force to "transient" or "couch-surfing"
  let gatedHousingStability = housingStability;
  if (ctx.mobilityTag === 'nomadic' && housingStability === 'owned') {
    // Nomads cannot own stable housing - pick transient or couch-surfing based on tier
    gatedHousingStability = tierBand === 'elite' ? 'transient' : 'couch-surfing';
    traceSet(trace, 'home.plausibilityGate.PG2', {
      original: housingStability,
      forced: gatedHousingStability,
      reason: 'nomadic mobility incompatible with owned housing',
    }, { method: 'gate' });
  }

  // Plausibility Gate PG3: Elite Tier ↔ Housing Quality
  // Part A: Privacy Level - elite cannot have "thin-walls" or "communal"
  // Part B: Neighborhood - elite cannot have "insecure" or "informal-settlement"
  //                        mass cannot have "gated" or "elite-enclave"
  let gatedPrivacyLevel = privacyLevel;
  let gatedNeighborhoodType = neighborhoodType;

  // PG3 Part A: Elite tier privacy constraints
  const eliteExcludedPrivacy: PrivacyLevel[] = ['thin-walls', 'communal'];
  if (tierBand === 'elite' && eliteExcludedPrivacy.includes(privacyLevel)) {
    // Elite cannot have thin-walls or communal privacy - upgrade to private
    gatedPrivacyLevel = 'private';
    traceSet(trace, 'home.plausibilityGate.PG3.privacy', {
      original: privacyLevel,
      forced: gatedPrivacyLevel,
      reason: 'elite tier incompatible with thin-walls/communal privacy',
    }, { method: 'gate' });
  }

  // PG3 Part B: Neighborhood tier constraints
  const eliteExcludedNeighborhoods: NeighborhoodType[] = ['insecure', 'informal-settlement'];
  const massExcludedNeighborhoods: NeighborhoodType[] = ['gated', 'elite-enclave'];

  if (tierBand === 'elite' && eliteExcludedNeighborhoods.includes(neighborhoodType)) {
    // Elite cannot live in insecure or informal settlements - upgrade to anonymous
    gatedNeighborhoodType = urbanicity === 'rural' ? 'rural-isolated' : 'anonymous';
    traceSet(trace, 'home.plausibilityGate.PG3.neighborhood', {
      original: neighborhoodType,
      forced: gatedNeighborhoodType,
      reason: 'elite tier incompatible with insecure/informal neighborhoods',
    }, { method: 'gate' });
  } else if (tierBand === 'mass' && massExcludedNeighborhoods.includes(neighborhoodType)) {
    // Mass cannot live in gated or elite-enclave - downgrade to tight-knit or anonymous
    gatedNeighborhoodType = urbanicity === 'rural' ? 'tight-knit' : 'anonymous';
    traceSet(trace, 'home.plausibilityGate.PG3.neighborhood', {
      original: neighborhoodType,
      forced: gatedNeighborhoodType,
      reason: 'mass tier incompatible with gated/elite-enclave neighborhoods',
    }, { method: 'gate' });
  }

  // Correlate #DC-D5: Neighborhood type affects privacy level
  // Gated and rural-isolated neighborhoods provide higher privacy
  const highPrivacyNeighborhoods: NeighborhoodType[] = ['gated', 'rural-isolated', 'elite-enclave'];
  if (highPrivacyNeighborhoods.includes(gatedNeighborhoodType)) {
    // Upgrade privacy if in a high-privacy neighborhood
    const lowPrivacyLevels: PrivacyLevel[] = ['thin-walls', 'communal', 'surveilled'];
    if (lowPrivacyLevels.includes(gatedPrivacyLevel)) {
      gatedPrivacyLevel = 'private'; // Minimum private in gated/rural areas
    }
  }

  // Correlate #DC-D10: Elite tier maintains privacy even if transient
  // Elite agents maintain at least 'moderate' privacy regardless of housing instability
  if (tierBand === 'elite') {
    const veryLowPrivacy: PrivacyLevel[] = ['communal', 'thin-walls'];
    if (veryLowPrivacy.includes(gatedPrivacyLevel)) {
      gatedPrivacyLevel = 'private'; // Elite always at least private
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW CORRELATES DC-D14 through DC-D19 (post-hoc deterministic adjustments)
  // ─────────────────────────────────────────────────────────────────────────────

  // DC-D14: Institutional Embeddedness → Housing Type
  // If institutionalEmbeddedness > 800, ensure housing is NOT "couch-surfing" or "homeless-shelter"
  // Rationale: Highly institutional people have stable housing
  const institutionalEmbeddedness01k = latents.institutionalEmbeddedness;
  if (institutionalEmbeddedness01k > 800) {
    const unstableHousingForInstitutional: HousingStability[] = ['couch-surfing', 'transient'];
    if (unstableHousingForInstitutional.includes(gatedHousingStability)) {
      gatedHousingStability = 'tenuous'; // Upgrade from most unstable to merely tenuous
      if (trace) {
        trace.derived = trace.derived ?? {};
        trace.derived.dcD14InstitutionalHousingGate = {
          institutionalEmbeddedness: institutionalEmbeddedness01k,
          originalHousing: housingStability,
          adjustedHousing: gatedHousingStability,
          reason: 'DC-D14: High institutional embeddedness (>800) incompatible with couch-surfing/transient housing',
        };
      }
    }
  }

  // DC-D16: Refugee → Housing Instability Score
  // If diasporaStatus == "refugee", housing stability score reduced
  // Rationale: Refugees face housing challenges
  let housingStabilityScore = 500; // Default neutral score
  const isRefugee = ctx.diasporaStatus === 'refugee';
  if (isRefugee) {
    // Reduce stability score significantly for refugees
    housingStabilityScore = Math.max(100, housingStabilityScore - 300);
    if (trace) {
      trace.derived = trace.derived ?? {};
      trace.derived.dcD16RefugeeHousingScore = {
        diasporaStatus: ctx.diasporaStatus,
        housingStabilityScore,
        reason: 'DC-D16: Refugee status reduces housing stability score',
      };
    }
  }
  // Adjust score based on actual housing type
  if (gatedHousingStability === 'owned') housingStabilityScore = Math.min(1000, housingStabilityScore + 400);
  else if (gatedHousingStability === 'stable-rental') housingStabilityScore = Math.min(1000, housingStabilityScore + 200);
  else if (gatedHousingStability === 'tenuous') housingStabilityScore = Math.max(0, housingStabilityScore - 100);
  else if (gatedHousingStability === 'transient') housingStabilityScore = Math.max(0, housingStabilityScore - 200);
  else if (gatedHousingStability === 'couch-surfing') housingStabilityScore = Math.max(0, housingStabilityScore - 350);

  // DC-D17: Elite + Family → Large Household
  // If tier == "elite" AND hasFamily, household size >= 3
  // Rationale: Elite families have staff/larger homes
  let householdSizeMin = 1;
  if (tierBand === 'elite' && hasFamily) {
    householdSizeMin = 3; // Elite families have at least 3 (couple + dependent/staff)
    if (trace) {
      trace.derived = trace.derived ?? {};
      trace.derived.dcD17EliteFamilyHousehold = {
        tierBand,
        hasFamily,
        householdSizeMin,
        reason: 'DC-D17: Elite families have larger households (staff/larger homes)',
      };
    }
  }

  // DC-D18: Age > 70 → Accessible Housing
  // If age > 70, reduce probability of "walk-up" housing types (mark accessibility requirement)
  // Rationale: Elderly need accessibility
  const requiresAccessibility = age > 70;
  if (requiresAccessibility && trace) {
    trace.derived = trace.derived ?? {};
    trace.derived.dcD18AccessibilityRequired = {
      age,
      reason: 'DC-D18: Age > 70 requires accessible housing (no walk-ups)',
    };
  }

  // DC-D19: Very High Opsec → Private Entry
  // If opsecDiscipline > 850, ensure dwelling has private entry
  // Rationale: Security requires controlled access
  const opsecDiscipline01k = latents.opsecDiscipline;
  const requiresPrivateEntry = opsecDiscipline01k > 850;
  if (requiresPrivateEntry) {
    // Upgrade privacy if too low for someone with high opsec
    if (gatedPrivacyLevel === 'communal' || gatedPrivacyLevel === 'thin-walls') {
      gatedPrivacyLevel = 'private';
    }
    if (trace) {
      trace.derived = trace.derived ?? {};
      trace.derived.dcD19PrivateEntryRequired = {
        opsecDiscipline: opsecDiscipline01k,
        reason: 'DC-D19: Very high opsec (>850) requires private entry',
      };
    }
  }

  const home: HomeResult = {
    housingStability: gatedHousingStability,
    householdComposition,
    privacyLevel: gatedPrivacyLevel,
    neighborhoodType: gatedNeighborhoodType,
    housingStabilityScore,
    householdSizeMin,
    requiresAccessibility,
    requiresPrivateEntry,
  };
  traceSet(trace, 'home', home, { method: 'weighted+gates' });

  // ─────────────────────────────────────────────────────────────────────────────
  // LEGAL/ADMIN (Oracle recommendation)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'legalAdmin');
  const legalRng = makeRng(facetSeed(seed, 'legalAdmin'));

  const residencyPool = vocab.legalAdmin?.residencyStatuses ?? [
    'citizen', 'permanent-resident', 'work-visa', 'student-visa', 'irregular', 'diplomatic',
  ];
  // Check if agent has valid citizenship
  const hasCitizenship = citizenshipCountryIso3 && citizenshipCountryIso3.length === 3;

  // Housing influences residency (#H2: Residency Status ↔ Housing Stability)
  const isStableHousing = housingStability === 'owned' || housingStability === 'stable-rental';
  const isUnstableHousing = housingStability === 'tenuous' || housingStability === 'transient' || housingStability === 'couch-surfing';

  const residencyWeights = residencyPool.map(r => {
    let w = 1;

    // HARD CONSTRAINT: Cannot be stateless if you have a citizenship
    if (r === 'stateless' && hasCitizenship) {
      return { item: r as ResidencyStatus, weight: 0 };
    }

    // HARD CONSTRAINT: Elite tier cannot be refugee/asylum-pending/irregular/stateless/student-visa
    // Elite status by definition means established position in society
    if (tierBand === 'elite' && ['refugee', 'asylum-pending', 'irregular', 'stateless', 'student-visa'].includes(r)) {
      return { item: r as ResidencyStatus, weight: 0 };
    }

    if (r === 'citizen' && homeCountryIso3 === currentCountryIso3) w = 20;
    if (r === 'diplomatic' && roleSeedTags.includes('diplomat')) w = 10;
    if (r === 'work-visa' && homeCountryIso3 !== currentCountryIso3 && tierBand !== 'mass') w = 5;
    if (r === 'permanent-resident' && homeCountryIso3 !== currentCountryIso3) w = 3;

    // Correlate #H2: Housing Stability ↔ Residency Status (positive)
    // Stable housing correlates with stable residency (citizen, permanent-resident)
    // Unstable housing correlates with precarious residency (irregular, refugee)
    const stableResidencies = ['citizen', 'permanent-resident', 'diplomatic'];
    const unstableResidencies = ['irregular', 'asylum-pending', 'refugee', 'stateless'];
    if (stableResidencies.includes(r)) {
      if (isStableHousing) w *= 1.8;
      if (isUnstableHousing) w *= 0.5;
    }
    if (unstableResidencies.includes(r)) {
      if (isUnstableHousing) w *= 2.5;
      if (isStableHousing) w *= 0.4;
    }

    return { item: r as ResidencyStatus, weight: w };
  });
  let residencyStatus = weightedPick(legalRng, residencyWeights) as ResidencyStatus;

  // ─────────────────────────────────────────────────────────────────────────────
  // DC-D15: Diplomat Career → Residency Status
  // If career involves diplomacy/foreign-service, ensure residency is "diplomatic" or "citizen"
  // Rationale: Diplomats have special status
  // ─────────────────────────────────────────────────────────────────────────────
  const diplomaticCareerTracks = ['foreign-service', 'diplomacy', 'diplomatic'];
  const isDiplomaticCareer = diplomaticCareerTracks.includes(careerTrackTag) || roleSeedTags.includes('diplomat');
  if (isDiplomaticCareer) {
    const validDiplomatResidencies: ResidencyStatus[] = ['diplomatic', 'citizen'];
    if (!validDiplomatResidencies.includes(residencyStatus)) {
      // Upgrade to diplomatic status for diplomats
      residencyStatus = 'diplomatic';
      if (trace) {
        trace.derived = trace.derived ?? {};
        trace.derived.dcD15DiplomatResidencyGate = {
          careerTrackTag,
          roleSeedTags,
          originalResidency: residencyStatus,
          adjustedResidency: 'diplomatic',
          reason: 'DC-D15: Diplomatic career requires diplomatic or citizen residency status',
        };
      }
    }
  }

  const exposurePool = vocab.legalAdmin?.legalExposures ?? [
    'clean', 'old-conviction', 'pending-case', 'tax-dispute', 'custody-battle', 'sealed-record',
  ];
  const opsec01 = latents.opsecDiscipline / 1000;
  const impulse01 = latents.impulseControl / 1000;
  const principled01 = latents.principledness / 1000;

  // Correlate #DC-D13: Low impulseControl increases legal exposure
  // Impulsive agents are more likely to make decisions that lead to legal trouble
  const impulseLegalBoost = impulse01 < 0.35 ? 2.5 : 1.0; // Strong boost for very low impulse control

  const exposureWeights = exposurePool.map(e => {
    let w = e === 'clean' ? 10 : 1;
    if (e === 'sealed-record' && roleSeedTags.includes('operative')) w = 2;
    if (e === 'tax-dispute' && tierBand === 'elite') w = 2;
    if (e === 'clean') w += 2.0 * opsec01 + 1.6 * principled01 + 0.6 * impulse01;
    if (e === 'sealed-record') w += 1.4 * opsec01;
    if (e === 'pending-case' || e === 'under-investigation' || e === 'tax-dispute' || e === 'debt-collection') {
      w += 1.6 * (1 - opsec01) + 1.2 * (1 - impulse01) + 0.8 * (1 - principled01);
      // #DC-D13: Low impulse control strongly increases legal exposure
      w *= impulseLegalBoost;
    }
    // #DC-D13: Also boost old-conviction for low impulse control (past mistakes)
    if (e === 'old-conviction' && impulse01 < 0.35) {
      w *= 2.0;
    }
    return { item: e as LegalExposure, weight: w };
  });
  const legalExposure = weightedPick(legalRng, exposureWeights) as LegalExposure;

  const credentialPool = vocab.legalAdmin?.credentialTypes ?? [
    'bar-license', 'medical-license', 'security-clearance', 'pilot-license',
    'hazmat-cert', 'teaching-cert', 'press-credentials', 'diplomatic-passport',
  ];
  const careerCredentialMap: Record<string, string[]> = {
    law: ['bar-license'],
    'public-health': ['medical-license'],
    intelligence: ['security-clearance'],
    military: ['security-clearance'],
    journalism: ['press-credentials'],
    'foreign-service': ['diplomatic-passport'],
    academia: ['teaching-cert'],
  };
  // Certain residency statuses cannot have certain credentials
  const noHighCredentialStatuses = ['asylum-pending', 'refugee', 'stateless', 'irregular'];
  const restrictedCredentials = ['security-clearance', 'diplomatic-passport'];

  let careerCreds = careerCredentialMap[careerTrackTag] ?? [];
  // Filter out restricted credentials for problematic residency statuses
  if (noHighCredentialStatuses.includes(residencyStatus)) {
    careerCreds = careerCreds.filter(c => !restrictedCredentials.includes(c));
  }

  const availableExtras = credentialPool.filter(c => {
    if (careerCreds.includes(c)) return false;
    // Also filter restricted credentials for problematic residency
    if (noHighCredentialStatuses.includes(residencyStatus) && restrictedCredentials.includes(c)) return false;
    return true;
  });
  const extraCreds = legalRng.pickK(availableExtras, legalRng.int(0, 1));
  const credentials = [...careerCreds, ...extraCreds] as CredentialType[];

  // ─────────────────────────────────────────────────────────────────────────────
  // DC-D4: Residency status affects credential validity
  // Irregular/asylum-pending/refugee residents may have credentials that are
  // 'unrecognized' (foreign) or 'expired' in the current country
  // ─────────────────────────────────────────────────────────────────────────────
  const irregularResidencies = ['irregular', 'asylum-pending', 'refugee', 'stateless'];
  const foreignResidencies = ['work-visa', 'student-visa', 'temporary-protected'];

  const credentialsWithValidity: CredentialWithValidity[] = credentials.map(cred => {
    let validity: CredentialValidity = 'valid';

    // Irregular residents: high chance credentials are unrecognized or foreign
    if (irregularResidencies.includes(residencyStatus)) {
      const roll = legalRng.next01();
      if (roll < 0.5) {
        validity = 'unrecognized'; // 50%: credential not recognized in current country
      } else if (roll < 0.75) {
        validity = 'foreign'; // 25%: valid foreign credential, needs conversion
      } else if (roll < 0.90) {
        validity = 'expired'; // 15%: credential expired during migration
      }
      // 10%: still valid (maintained through hardship)
    }
    // Foreign residents on temporary visas: some chance credentials are foreign
    else if (foreignResidencies.includes(residencyStatus)) {
      const roll = legalRng.next01();
      if (roll < 0.20) {
        validity = 'foreign'; // 20%: valid foreign credential
      } else if (roll < 0.25) {
        validity = 'unrecognized'; // 5%: not recognized
      }
      // 75%: valid (working professionals usually have recognized credentials)
    }
    // Citizens and permanent residents: credentials almost always valid (default)

    return { type: cred, validity };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAUSIBILITY GATE DC-D8: High legal exposure limits credential types
  // Agents with active legal issues cannot maintain security clearances
  // ═══════════════════════════════════════════════════════════════════════════
  const highLegalExposureTypes = ['pending-case', 'under-investigation', 'debt-collection'];
  let gatedCredentials = credentials;
  let gatedCredentialsWithValidity = credentialsWithValidity;
  if (highLegalExposureTypes.includes(legalExposure) && credentials.includes('security-clearance')) {
    gatedCredentials = credentials.filter(c => c !== 'security-clearance');
    gatedCredentialsWithValidity = credentialsWithValidity.filter(c => c.type !== 'security-clearance');
    if (trace) {
      trace.derived = trace.derived ?? {};
      trace.derived.dcD8LegalCredentialGate = {
        legalExposure,
        originalCredentials: credentials,
        adjustedCredentials: gatedCredentials,
        reason: 'DC-D8: High legal exposure (pending-case/under-investigation) incompatible with security clearance',
      };
    }
  }

  const legalAdmin: LegalAdminResult = {
    residencyStatus,
    legalExposure,
    credentials: gatedCredentials,
    credentialsWithValidity: gatedCredentialsWithValidity,
  };
  traceSet(trace, 'legalAdmin', legalAdmin, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────────
  // LIFE SKILLS (Oracle recommendation + DC-D9)
  // ─────────────────────────────────────────────────────────────────────────────
  traceFacet(trace, seed, 'lifeSkills');
  const skillsRng = makeRng(facetSeed(seed, 'lifeSkills'));

  const competencePool = vocab.lifeSkills?.competenceBands ?? [
    'incompetent', 'struggles', 'adequate', 'competent', 'expert',
  ];

  const pickCompetence = (bias: number): CompetenceBand => {
    const base = 400 + bias + skillsRng.int(-200, 200);
    // Map Fixed value (0-1000) to index (0-4)
    let index: number;
    if (base < 200) index = 0;
    else if (base < 400) index = 1;
    else if (base < 600) index = 2;
    else if (base < 800) index = 3;
    else index = 4;
    return competencePool[index] as CompetenceBand;
  };

  // Domestic competence - influenced by tier (elites often outsource)
  const domesticBias = tierBand === 'elite' ? -150 : tierBand === 'mass' ? 100 : 0;
  const domesticCompetence = pickCompetence(domesticBias);

  // Bureaucracy navigation - influenced by institutional embeddedness and education
  // NEW13: Education ↔ Bureaucracy Navigation (positive correlation)
  // Higher education improves ability to navigate institutional systems
  const educationBureauBias = (() => {
    switch (ctx.educationTrackTag) {
      case 'doctorate': return 150;
      case 'graduate': return 100;
      case 'civil-service-track': return 130; // Explicit bureaucracy training
      case 'undergraduate': return 50;
      case 'military-academy': return 40;
      case 'trade-certification': return 10;
      case 'secondary': return -30;
      case 'self-taught': return -50;
      default: return 0;
    }
  })();
  const bureauBias = Math.round((latents.institutionalEmbeddedness - 500) / 5) +
                     Math.round(educationBureauBias / 3);
  const bureaucracyNavigation = pickCompetence(bureauBias);

  // Street smarts - influenced by tier (mass has more, elites less)
  const streetBias = tierBand === 'mass' ? 150 : tierBand === 'elite' ? -100 : 0;
  const streetSmarts = pickCompetence(streetBias);

  const etiquettePool = vocab.lifeSkills?.etiquetteLiteracies ?? [
    'protocol-native', 'code-switcher', 'rough-edged', 'clueless', 'deliberately-transgressive',
  ];
  const etiquetteWeights = etiquettePool.map(e => {
    let w = 1;
    if (e === 'protocol-native' && tierBand === 'elite') w = 5;
    if (e === 'code-switcher' && tierBand === 'middle') w = 4;
    if (e === 'rough-edged' && tierBand === 'mass') w = 3;
    if (e === 'deliberately-transgressive' && latents.riskAppetite > 700) w = 2;
    return { item: e as EtiquetteLiteracy, weight: w };
  });
  const etiquetteLiteracy = weightedPick(skillsRng, etiquetteWeights) as EtiquetteLiteracy;

  // ─────────────────────────────────────────────────────────────────────────────
  // DC-D9: Urbanicity affects life skills mix
  // Rural environments weight mechanical/agricultural skills
  // Urban environments weight transit/networking skills
  // ─────────────────────────────────────────────────────────────────────────────
  const ruralUrbanities = ['rural', 'rural-remote', 'small-town'];
  const urbanUrbanities = ['megacity', 'capital', 'major-city', 'secondary-city'];

  let primarySkillDomain: 'urban' | 'rural' | 'mixed';
  if (ruralUrbanities.includes(urbanicity)) {
    // Rural: mechanical, agricultural, practical self-sufficiency skills
    primarySkillDomain = 'rural';
  } else if (urbanUrbanities.includes(urbanicity)) {
    // Urban: transit navigation, networking, service economy skills
    primarySkillDomain = 'urban';
  } else {
    // Suburban, mid-city, or unknown: mixed skill set
    primarySkillDomain = 'mixed';
  }

  const lifeSkills: LifeSkillsResult = {
    domesticCompetence,
    bureaucracyNavigation,
    streetSmarts,
    etiquetteLiteracy,
    primarySkillDomain,
  };
  traceSet(trace, 'lifeSkills', lifeSkills, { method: 'weighted' });

  return { everydayLife, home, legalAdmin, lifeSkills };
}

// ============================================================================
// Plausibility Gate PG1 (exported for use by generator)
// ============================================================================

/**
 * Plausibility Gate PG1: High Opsec → No Compromised Identity Kit
 *
 * If opsecDiscipline > 0.75 (750/1000), force `compromised: false` on all identity kit items.
 * High opsec agents maintain strict security discipline and would never allow their
 * identity materials to become compromised.
 *
 * This gate should be applied after lifestyle.logistics.identityKit is computed.
 *
 * @param identityKit - The identity kit items from lifestyle result
 * @param opsec01 - Opsec discipline normalized to 0-1 range (latents.opsecDiscipline / 1000)
 * @returns The gated identity kit with compromised flags adjusted
 */
export function applyPG1IdentityKitGate<T extends { item: string; compromised: boolean }>(
  identityKit: T[],
  opsec01: number,
): T[] {
  // Plausibility Gate PG1: High Opsec → No Compromised Identity Kit
  // If opsec01 > 0.75, force `compromised: false` on all identity kit items
  if (opsec01 > 0.75) {
    return identityKit.map(kit => ({
      ...kit,
      compromised: false,
    }));
  }
  return identityKit;
}
