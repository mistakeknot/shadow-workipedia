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

  // Traits for correlates (Correlate #13: Conscientiousness ↔ Housing)
  traits?: {
    conscientiousness: number; // 0-1000
  };

  // Family status for housing constraints
  maritalStatus?: string;
  dependentCount?: number;
};

/** Everyday life anchors */
export type EverydayLifeResult = {
  thirdPlaces: string[];
  commuteMode: CommuteMode;
  weeklyAnchor: WeeklyAnchor;
  pettyHabits: PettyHabit[];
  caregivingObligation: CaregivingObligation;
};

/** Home and domestic situation */
export type HomeResult = {
  housingStability: HousingStability;
  householdComposition: HouseholdComposition;
  privacyLevel: PrivacyLevel;
  neighborhoodType: NeighborhoodType;
};

/** Legal and administrative status */
export type LegalAdminResult = {
  residencyStatus: ResidencyStatus;
  legalExposure: LegalExposure;
  credentials: CredentialType[];
};

/** Life skills - competence outside the job */
export type LifeSkillsResult = {
  domesticCompetence: CompetenceBand;
  bureaucracyNavigation: CompetenceBand;
  streetSmarts: CompetenceBand;
  etiquetteLiteracy: EtiquetteLiteracy;
};

export type DomesticResult = {
  everydayLife: EverydayLifeResult;
  home: HomeResult;
  legalAdmin: LegalAdminResult;
  lifeSkills: LifeSkillsResult;
};

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
  const thirdPlaceCountBase = socialBattery01 < 0.3 ? 1 : socialBattery01 < 0.6 ? 2 : 3;
  const thirdPlaceCountVariance = lifeRng.int(0, 1);
  const thirdPlaceCount = Math.max(1, Math.min(thirdPlacePool.length, thirdPlaceCountBase + thirdPlaceCountVariance));
  const thirdPlaces = lifeRng.pickK(thirdPlacePool, thirdPlaceCount);

  const commuteModePool = vocab.everydayLife?.commuteModes ?? [
    'walk', 'bicycle', 'motorbike', 'bus', 'metro', 'driver', 'rideshare', 'mixed',
  ];
  const commuteWeights = commuteModePool.map(c => {
    let w = 1;
    if (c === 'driver' && tierBand === 'elite') w = 5;
    if (c === 'metro' && (urbanicity === 'capital' || urbanicity === 'megacity')) w = 4;
    if (c === 'bus' && tierBand === 'mass') w = 3;
    if (c === 'walk' && urbanicity === 'small-town') w = 3;
    if (c === 'bicycle' && urbanicity === 'secondary-city') w = 2;
    return { item: c as CommuteMode, weight: w };
  });
  const commuteMode = weightedPick(lifeRng, commuteWeights) as CommuteMode;

  const weeklyAnchorPool = vocab.everydayLife?.weeklyAnchors ?? [
    'friday-prayer', 'sunday-service', 'saturday-synagogue', 'weekly-market',
    'sports-match', 'family-dinner', 'night-class', 'volunteer-shift', 'therapy-session', 'none',
  ];
  const weeklyAnchor = lifeRng.pick(weeklyAnchorPool) as WeeklyAnchor;

  const pettyHabitPool = vocab.everydayLife?.pettyHabits ?? [
    'always-early', 'always-late', 'forgets-keys', 'checks-locks', 'overpacks',
    'skips-breakfast', 'double-checks-everything', 'loses-phone',
  ];
  const pettyHabits = lifeRng.pickK(pettyHabitPool, lifeRng.int(1, 2)) as PettyHabit[];

  const caregivingPool = vocab.everydayLife?.caregivingObligations ?? [
    'elder-care', 'child-pickup', 'sibling-support', 'disabled-family', 'none',
  ];
  const caregivingWeights = caregivingPool.map(c => {
    let w = c === 'none' ? 5 : 1;
    if (c === 'elder-care' && age > 35) w = 3;
    if (c === 'child-pickup' && age > 28 && age < 50) w = 3;
    return { item: c as CaregivingObligation, weight: w };
  });
  const caregivingObligation = weightedPick(lifeRng, caregivingWeights) as CaregivingObligation;

  const everydayLife: EverydayLifeResult = {
    thirdPlaces, commuteMode, weeklyAnchor, pettyHabits, caregivingObligation,
  };
  traceSet(trace, 'everydayLife', everydayLife, { method: 'weighted' });

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

  // Family constraints for housing
  const isMarried = ctx.maritalStatus === 'married' || ctx.maritalStatus === 'partnered';
  const hasDependents = (ctx.dependentCount ?? 0) > 0;
  const hasFamily = isMarried && hasDependents;

  const housingPool = vocab.home?.housingStabilities ?? [
    'owned', 'stable-rental', 'tenuous', 'transient', 'couch-surfing', 'institutional',
  ];
  // Estimate years of professional experience (starts around age 22)
  const estimatedYearsWorking = Math.max(0, age - 22);
  const isSeniorProfessional = estimatedYearsWorking >= 15 && tierBand !== 'mass';

  const housingWeights = housingPool.map(h => {
    let w = 1;

    // HARD CONSTRAINT: Married with dependents cannot be couch-surfing or transient
    if (hasFamily && (h === 'couch-surfing' || h === 'transient')) {
      return { item: h as HousingStability, weight: 0 };
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

    // Tier correlates
    if (h === 'owned' && tierBand === 'elite') w = 6;
    if (h === 'owned' && tierBand === 'middle' && age > 35) w = 3;
    if (h === 'stable-rental' && tierBand === 'middle') w = 4;
    if (h === 'tenuous' && tierBand === 'mass') w = 3;
    if (h === 'transient' && roleSeedTags.includes('operative')) w = 3;

    // Correlate #13: Conscientiousness ↔ Housing
    // High conscientiousness → more stable housing (owned, stable-rental)
    // Low conscientiousness → more chaotic housing (tenuous, transient, couch-surfing)
    if (h === 'owned' || h === 'stable-rental') {
      w += 2.5 * conscientiousness01; // High conscientious → stable
    }
    if (h === 'tenuous' || h === 'transient' || h === 'couch-surfing') {
      w += 2.0 * (1 - conscientiousness01); // Low conscientious → unstable
    }

    // Correlate #15: Risk ↔ Housing
    // High risk appetite → more likely transient/unconventional housing
    // Low risk appetite → prefers stable, predictable housing
    if (h === 'transient' || h === 'couch-surfing') {
      w += 1.5 * riskAppetite01; // Risk takers more likely transient
    }
    if (h === 'owned' || h === 'stable-rental') {
      w += 1.0 * (1 - riskAppetite01); // Risk averse prefer stability
    }

    // Soft bias: families prefer stable housing
    if (hasFamily && (h === 'owned' || h === 'stable-rental')) {
      w += 3;
    }

    return { item: h as HousingStability, weight: w };
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
  const privacyLevel = weightedPick(homeRng, privacyWeights) as PrivacyLevel;

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
    return { item: n as NeighborhoodType, weight: w };
  });
  const neighborhoodType = weightedPick(homeRng, neighborhoodWeights) as NeighborhoodType;

  const home: HomeResult = { housingStability, householdComposition, privacyLevel, neighborhoodType };
  traceSet(trace, 'home', home, { method: 'weighted' });

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
    return { item: r as ResidencyStatus, weight: w };
  });
  const residencyStatus = weightedPick(legalRng, residencyWeights) as ResidencyStatus;

  const exposurePool = vocab.legalAdmin?.legalExposures ?? [
    'clean', 'old-conviction', 'pending-case', 'tax-dispute', 'custody-battle', 'sealed-record',
  ];
  const exposureWeights = exposurePool.map(e => {
    let w = e === 'clean' ? 10 : 1;
    if (e === 'sealed-record' && roleSeedTags.includes('operative')) w = 2;
    if (e === 'tax-dispute' && tierBand === 'elite') w = 2;
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

  const legalAdmin: LegalAdminResult = { residencyStatus, legalExposure, credentials };
  traceSet(trace, 'legalAdmin', legalAdmin, { method: 'weighted' });

  // ─────────────────────────────────────────────────────────────────────────────
  // LIFE SKILLS (Oracle recommendation)
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

  // Bureaucracy navigation - influenced by institutional embeddedness
  const bureauBias = Math.round((latents.institutionalEmbeddedness - 500) / 5);
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

  const lifeSkills: LifeSkillsResult = {
    domesticCompetence, bureaucracyNavigation, streetSmarts, etiquetteLiteracy,
  };
  traceSet(trace, 'lifeSkills', lifeSkills, { method: 'weighted' });

  return { everydayLife, home, legalAdmin, lifeSkills };
}
