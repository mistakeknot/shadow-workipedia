// Agent Types - extracted from agentGenerator.ts
// This file contains all type definitions for agent generation

export type TierBand = 'elite' | 'middle' | 'mass';

export type Band5 = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export type Fixed = number; // fixed-point int, typically 0..1000

export type HeightBand = 'very_short' | 'short' | 'average' | 'tall' | 'very_tall';

export type NeedTag = 'sleep' | 'safety' | 'belonging' | 'autonomy' | 'competence' | 'purpose' | 'comfort';

export type ThoughtSource = 'ops' | 'exposure' | 'media' | 'relationship' | 'health' | 'obligation';

export type DeepSimPreviewV1 = {
  version: 1;
  day0: number;
  needs01k: Record<NeedTag, Fixed>;
  baselineMood01k: number; // -1000..+1000
  mood01k: number; // -1000..+1000
  stress01k: Fixed;
  fatigue01k: Fixed;
  thoughts: Array<{ tag: string; source: ThoughtSource; valence: number; intensity01k: Fixed; expiresDay: number }>;
  breakRisk01k: Fixed;
  breakRiskBand: Band5;
  breakTypesTopK: string[];
};

export type AgentPriorsV1 = {
  version: 1;
  generatedAtIso: string;
  buckets: number[];
  countries: Record<
    string,
    {
      iso3: string;
      buckets: Record<
        string,
        {
          cohortBucketStartYear: number;
          indicators?: Record<string, unknown>;
          languages01k?: Record<string, Fixed>;
          foodEnvironment01k?: Partial<
            Record<
              | 'meat'
              | 'dairy'
              | 'seafood'
              | 'spice'
              | 'sweets'
              | 'friedOily'
              | 'caffeine'
              | 'streetFood'
              | 'fineDining'
              | 'plantForward',
              Fixed
            >
          >;
          cultureEnvironment01k?: Partial<Record<'cosmopolitanism' | 'traditionalism' | 'mediaOpenness', Fixed>>;
          cultureProfileWeights01k?: Record<string, Fixed>;
          securityEnvironment01k?: Partial<Record<'conflict' | 'stateViolence' | 'militarization', Fixed>>;
          appearance?: { heightBandWeights01k?: Partial<Record<HeightBand, Fixed>> };
          mediaEnvironment01k?: Partial<Record<'print' | 'radio' | 'tv' | 'social' | 'closed', Fixed>>;
          educationTrackWeights?: Record<string, number>;
          careerTrackWeights?: Record<string, number>;
          mobility01k?: Partial<Record<'passportAccess' | 'travelFrequency', Fixed>>;
        }
      >;
    }
  >;
};

export type CultureProfileV1 = {
  weights?: {
    namesPrimaryWeight?: number;
    languagesPrimaryWeight?: number;
    foodPrimaryWeight?: number;
    mediaPrimaryWeight?: number;
    fashionPrimaryWeight?: number;
  };
  identity?: {
    firstNames?: string[];
    maleFirstNames?: string[];
    femaleFirstNames?: string[];
    lastNames?: string[];
    languages?: string[];
  };
  preferences?: {
    food?: {
      comfortFoods?: string[];
      ritualDrinks?: string[];
    };
    media?: {
      genres?: string[];
    };
    fashion?: {
      styleTags?: string[];
    };
  };
};

// === ORTHOGONAL CULTURE AXES ===
// Three independent dimensions that combine to form a character's cultural identity

/**
 * Ethnolinguistic Heritage: ancestry/family background
 * Affects: names, languages, traditional practices, family expectations
 */
export type EthnolinguisticHeritage =
  // East Asian
  | 'han-mandarin' | 'han-cantonese' | 'japanese' | 'korean' | 'vietnamese'
  // South Asian
  | 'hindi-belt' | 'tamil' | 'bengali' | 'punjabi' | 'malayalam' | 'pakistani-punjabi' | 'sindhi' | 'pashto'
  // Southeast Asian
  | 'thai' | 'malay' | 'indonesian-javanese' | 'filipino-tagalog' | 'khmer' | 'burmese'
  // Middle East & Central Asia
  | 'arab-levantine' | 'arab-gulf' | 'arab-maghrebi' | 'arab-egyptian' | 'persian' | 'turkish' | 'kurdish' | 'uzbek' | 'kazakh'
  // Sub-Saharan Africa
  | 'yoruba' | 'igbo' | 'hausa' | 'amhara' | 'oromo' | 'swahili-coast' | 'zulu' | 'xhosa' | 'akan' | 'wolof' | 'fulani'
  // European
  | 'anglo' | 'germanic' | 'french' | 'iberian' | 'italian' | 'slavic-east' | 'slavic-west' | 'slavic-south' | 'greek' | 'nordic' | 'celtic' | 'baltic' | 'balkan' | 'hungarian'
  // Americas (non-colonial descent)
  | 'mestizo-mexican' | 'mestizo-andean' | 'afro-caribbean' | 'afro-brazilian' | 'indigenous-andean' | 'indigenous-mesoamerican'
  // Jewish diaspora
  | 'ashkenazi' | 'sephardi' | 'mizrahi'
  // Mixed/global
  | 'mixed-heritage' | 'third-culture';

/**
 * Regional Socialization: where you grew up / formative environment
 * Affects: accent, urban/rural attitudes, regional foods, local customs
 */
export type RegionalSocialization =
  // Urban tiers
  | 'global-city-core' | 'global-city-periphery' | 'national-capital' | 'secondary-city' | 'small-town' | 'rural-agricultural' | 'rural-remote'
  // Special environments
  | 'expat-compound' | 'refugee-camp' | 'military-base' | 'diplomatic-circuit' | 'boarding-school' | 'university-town'
  // Diaspora patterns
  | 'diaspora-enclave' | 'diaspora-assimilated' | 'diaspora-bicultural' | 'returnee'
  // Mobility patterns
  | 'nomadic' | 'borderland' | 'maritime';

/**
 * Institutional Culture: professional tribe
 * Affects: jargon, dress code, work norms, social networks, values
 */
export type InstitutionalCulture =
  // Government/state
  | 'military-enlisted' | 'military-officer' | 'intelligence' | 'diplomatic-service' | 'civil-service' | 'law-enforcement'
  // Professional
  | 'academic' | 'corporate-finance' | 'corporate-tech' | 'corporate-consulting' | 'legal' | 'medical' | 'engineering'
  // Civil society
  | 'ngo-humanitarian' | 'ngo-advocacy' | 'journalist' | 'think-tank'
  // Other
  | 'religious-institution' | 'political-party' | 'labor-union' | 'informal-economy' | 'criminal-organization';

/**
 * Combined culture axes for an agent
 */
export type CultureAxes = {
  ethnolinguistic: EthnolinguisticHeritage;
  regional: RegionalSocialization;
  institutional: InstitutionalCulture;
  // Strength of identification with each axis (0-1000)
  weights: {
    ethnolinguistic: Fixed; // how strongly they identify with heritage
    regional: Fixed;        // how much regional upbringing shows
    institutional: Fixed;   // how much professional culture dominates
  };
};

/**
 * Ethnolinguistic data: names, languages, traditions for each heritage
 */
export type EthnolinguisticDataV1 = {
  // Names
  maleFirstNames?: string[];
  femaleFirstNames?: string[];
  familyNames?: string[];
  namingPatterns?: NameStructure[];
  // Languages
  primaryLanguages?: string[];
  heritageLanguages?: string[]; // learned at home but not primary
  // Cultural markers
  traditionalFoods?: string[];
  traditionalDrinks?: string[];
  holidays?: string[];
  familyValues?: string[]; // e.g., 'filial-piety', 'hospitality', 'honor'
};

/**
 * Regional data: environment-specific culture markers
 */
export type RegionalDataV1 = {
  // Environment
  typicalAccents?: string[];
  localFoods?: string[];
  socialNorms?: string[]; // e.g., 'punctuality', 'directness', 'formality'
  // Lifestyle
  fashionInfluences?: string[];
  mediaHabits?: string[];
  // Values shaped by environment
  regionalValues?: string[]; // e.g., 'self-reliance', 'community', 'mobility'
};

/**
 * Institutional data: professional culture markers
 */
export type InstitutionalDataV1 = {
  // Professional identity
  jargonExamples?: string[];
  dressCode?: string[];
  workNorms?: string[]; // e.g., 'hierarchy', 'consensus', 'initiative'
  // Social
  networkTypes?: string[]; // e.g., 'alumni', 'guild', 'rank-based'
  socialEvents?: string[];
  // Values
  institutionalValues?: string[]; // e.g., 'loyalty', 'discretion', 'results'
  statusMarkers?: string[];
};

export type AgentVocabV1 = {
  version: 1;
  identity: {
    tierBands: TierBand[];
    homeCultures: string[];
    roleSeedTags: string[];
    firstNames: string[];
    lastNames: string[];
    languages: string[];
    educationTracks?: string[];
    careerTracks?: string[];
  };
  appearance: {
    heightBands: HeightBand[];
    buildTags: string[];
    hairColors: string[];
    hairTextures: string[];
    eyeColors: string[];
    voiceTags: string[];
    distinguishingMarks: string[];
  };
  capabilities: {
    skillKeys: string[];
    roleSkillBumps: Record<string, Record<string, number>>;
  };
  preferences: {
    food: {
      comfortFoods: string[];
      dislikes: string[];
      restrictions: string[];
      ritualDrinks: string[];
    };
    media: {
      genres: string[];
      platforms: string[];
    };
    fashion: {
      styleTags: string[];
    };
    hobbies?: {
      physical?: string[];
      creative?: string[];
      intellectual?: string[];
      technical?: string[];
      social?: string[];
      outdoor?: string[];
      culinary?: string[];
    };
    environment?: {
      temperatureTags?: string[];
      weatherMoodTags?: string[];
    };
    livingSpace?: {
      roomPreferenceTags?: string[];
      comfortItemTags?: string[];
    };
    social?: {
      groupStyleTags?: string[];
      communicationMethodTags?: string[];
      boundaryTags?: string[];
      emotionalSharingTags?: string[];
    };
    work?: {
      preferredOperationTags?: string[];
      avoidedOperationTags?: string[];
    };
    equipment?: {
      weaponPreferenceTags?: string[];
      gearPreferenceTags?: string[];
    };
    quirks?: {
      luckyItemTags?: string[];
      ritualTags?: string[];
      petPeeveTags?: string[];
      mustHaveTags?: string[];
    };
    time?: {
      dailyRhythmTags?: string[];
      planningStyleTags?: string[];
    };
  };
  routines: {
    chronotypes: string[];
    recoveryRituals: string[];
  };
  vices: {
    vicePool: string[];
    triggers: string[];
  };
  deepSimPreview?: {
    needTags?: string[];
    thoughtTags?: string[];
    breakTypes?: string[];
  };
  logistics: {
    identityKitItems: string[];
  };
  psych?: {
    redLines?: string[];
    redLineByRole?: Record<string, string[]>;
  };
  visibility?: {
    publicRoleTags?: string[];
    stealthRoleTags?: string[];
  };
  health?: {
    chronicConditionTags?: string[];
    allergyTags?: string[];
  };
  covers?: {
    coverAptitudeTags?: string[];
  };
  mobility?: {
    mobilityTags?: string[];
    passportAccessBands?: Band5[];
  };
  neurodivergence?: {
    indicatorTags?: string[];
    copingStrategies?: string[];
  };
  spirituality?: {
    traditions?: string[];
    affiliationTags?: string[];
    observanceLevels?: string[];
    practiceTypes?: string[];
    tensionTypes?: string[];
  };
  background?: {
    adversityTags?: string[];
    resilienceIndicators?: string[];
  };
  gender?: {
    identityTags?: string[];
    pronounSets?: string[];
  };
  // Sexual orientation & outness
  orientation?: {
    orientationTags?: string[];
    outnessLevels?: string[];
  };
  // Naming conventions by culture
  naming?: {
    structureTags?: string[];
    honorificStyles?: string[];
    callSignPrefixes?: string[];
    aliasPatterns?: string[];
  };
  // Subnational geography
  geography?: {
    urbanicityTags?: string[];
    diasporaStatusTags?: string[];
  };
  // Family & relationships
  family?: {
    maritalStatusTags?: string[];
    relationshipTypes?: string[];
    dependentTypes?: string[];
  };
  // Institutional identity
  institution?: {
    orgTypes?: string[];
    gradeBands?: string[];
    clearanceBands?: string[];
    functionalSpecializations?: string[];
  };
  // Personality & cognition
  personality?: {
    conflictStyles?: string[];
    epistemicStyles?: string[];
    socialEnergyTags?: string[];
    riskPostures?: string[];
    attachmentStyles?: string[];
    emotionalRegulation?: string[];
    stressResponses?: string[];
    decisionMaking?: string[];
    motivationalDrivers?: string[];
    communicationStyles?: string[];
    trustFormation?: string[];
    adaptability?: string[];
    ambiguityTolerance?: string[];
    feedbackOrientation?: string[];
    timeOrientation?: string[];
    moralReasoning?: string[];
    humorStyles?: string[];
    learningStyles?: string[];
  };
  // Work products (analyst/diplomat)
  workStyle?: {
    writingStyles?: string[];
    briefingStyles?: string[];
    confidenceCalibrations?: string[];
    jargonDensityTags?: string[];
  };
  // Life timeline event templates
  timeline?: {
    eventTypes?: string[];
    eventTemplates?: Record<string, string[]>;
  };
  // Expanded red lines for institutional realism
  institutionalRedLines?: string[];
  // Vice categorization
  viceCategorization?: Record<string, ViceCategory>;
  cultureProfiles?: Record<string, CultureProfileV1>;
  microCultureProfiles?: Record<string, CultureProfileV1>;
  // Orthogonal culture axes vocabulary
  cultureAxes?: {
    ethnolinguisticTags?: string[];
    regionalTags?: string[];
    institutionalTags?: string[];
    // Per-axis cultural data (names, foods, values, etc.)
    ethnolinguisticData?: Record<string, EthnolinguisticDataV1>;
    regionalData?: Record<string, RegionalDataV1>;
    institutionalData?: Record<string, InstitutionalDataV1>;
  };
  // === ORACLE-RECOMMENDED VOCAB ===
  everydayLife?: {
    thirdPlaces?: string[];
    commuteModes?: string[];
    weeklyAnchors?: string[];
    pettyHabits?: string[];
    caregivingObligations?: string[];
  };
  communities?: {
    types?: string[];
    roles?: string[];
    statuses?: string[];
    onlineCommunities?: string[];
  };
  reputation?: {
    tags?: string[];
  };
  affect?: {
    baselineAffects?: string[];
    regulationStyles?: string[];
    stressTells?: string[];
    repairStyles?: string[];
  };
  selfConcept?: {
    selfStories?: string[];
    socialMasks?: string[];
  };
  lifeSkills?: {
    competenceBands?: string[];
    etiquetteLiteracies?: string[];
  };
  home?: {
    housingStabilities?: string[];
    householdCompositions?: string[];
    privacyLevels?: string[];
    neighborhoodTypes?: string[];
  };
  attachments?: {
    keepsakeTypes?: string[];
    placeAttachments?: string[];
    dependentNonHumans?: string[];
  };
  legalAdmin?: {
    residencyStatuses?: string[];
    legalExposures?: string[];
    credentialTypes?: string[];
  };
  civicLife?: {
    engagements?: string[];
    ideologies?: string[];
    tabooTopics?: string[];
  };
};

export type SocioeconomicMobility = 'upward' | 'stable' | 'downward';

export type NetworkRole = 'isolate' | 'peripheral' | 'connector' | 'hub' | 'broker' | 'gatekeeper';

export type ContradictionPair = {
  trait1: string;
  trait2: string;
  tension: string;
  narrativeHook: string;
};

export type EliteCompensator = 'patronage' | 'dynasty' | 'institutional-protection' | 'media-shield' | 'political-cover' | 'wealth-buffer';

// === TYPES (Oracle recommendations) ===

// Naming system types
export type NameStructure = 'western' | 'eastern-family-first' | 'patronymic' | 'matronymic' | 'single-name' | 'clan-name' | 'compound-surname';
export type HonorificStyle = 'title-first' | 'given-name' | 'surname' | 'patronymic' | 'teknonym' | 'none';

// Subnational geography
export type Urbanicity = 'rural' | 'small-town' | 'secondary-city' | 'capital' | 'megacity' | 'peri-urban';
export type DiasporaStatus = 'native' | 'internal-migrant' | 'expat' | 'refugee' | 'dual-citizen' | 'borderland' | 'diaspora-child';

// Family & relationships
export type MaritalStatus = 'single' | 'partnered' | 'married' | 'divorced' | 'widowed' | 'its-complicated';
export type RelationshipType =
  // Professional/spy
  | 'patron' | 'mentor' | 'rival' | 'protege' | 'handler' | 'asset' | 'debt-holder'
  // Personal history
  | 'ex-partner' | 'old-classmate' | 'childhood-friend' | 'college-roommate'
  // Family
  | 'family-tie' | 'estranged-family' | 'chosen-family'
  // Civilian professional
  | 'coworker' | 'boss' | 'subordinate' | 'business-partner' | 'client'
  // Community
  | 'neighbor' | 'gym-buddy' | 'drinking-buddy' | 'online-friend' | 'hobby-group'
  // Support
  | 'therapist' | 'spiritual-advisor' | 'AA-sponsor';

// Institutional identity
export type OrgType = 'foreign-ministry' | 'interior-ministry' | 'defense' | 'intel-agency' | 'regulator' | 'think-tank' | 'party-apparatus' | 'state-enterprise' | 'ngo' | 'private-security' | 'media-outlet' | 'academia' | 'corporate' | 'international-org';
export type GradeBand = 'junior' | 'mid-level' | 'senior' | 'executive' | 'political-appointee';
export type ClearanceBand = 'none' | 'basic' | 'secret' | 'top-secret' | 'compartmented';
export type FunctionalSpecialization =
  // Diplomatic
  | 'consular' | 'political-officer' | 'economic-officer' | 'public-diplomacy' | 'protocol' | 'legal-affairs' | 'sanctions' | 'development'
  // Intelligence
  | 'humint-ops' | 'counterintel' | 'liaison' | 'intel-analysis' | 'osint' | 'technical-collection' | 'security-ops' | 'influence-ops' | 'targeting'
  // Analyst
  | 'regional-desk' | 'energy-policy' | 'cyber-policy' | 'wmd-policy' | 'finance-policy' | 'migration-policy' | 'climate-policy' | 'health-security'
  // Other
  | 'general-admin' | 'logistics-ops' | 'communications' | 'it-security';

// Personality & cognition (Big Five-lite + extras)
export type ConflictStyle = 'avoidant' | 'accommodating' | 'competing' | 'compromising' | 'collaborative' | 'assertive' | 'yielding';
export type EpistemicStyle = 'data-driven' | 'narrative-driven' | 'authority-driven' | 'intuitive' | 'consensus-seeking' | 'skeptical' | 'systems-thinking';
export type SocialEnergy = 'introvert' | 'ambivert' | 'extrovert' | 'loner' | 'social-butterfly';
export type RiskPosture = 'risk-averse' | 'risk-neutral' | 'risk-seeking' | 'context-dependent' | 'reckless' | 'calculated';
export type AttachmentStyle = 'secure' | 'anxious-preoccupied' | 'dismissive-avoidant' | 'fearful-avoidant';
export type EmotionalRegulation = 'stoic' | 'expressive' | 'volatile' | 'suppressed' | 'compartmentalized' | 'even-tempered' | 'hot-tempered';
export type StressResponse = 'fight' | 'flight' | 'freeze' | 'fawn' | 'analytical-detachment' | 'panic';
export type DecisionMaking = 'deliberative' | 'intuitive-fast' | 'consensus-seeking' | 'authoritative' | 'paralysis-prone' | 'decisive';
export type MotivationalDriver = 'achievement' | 'affiliation' | 'power' | 'security' | 'autonomy' | 'purpose' | 'recognition' | 'mastery' | 'justice' | 'belonging';
export type CommunicationStyle = 'direct' | 'indirect' | 'formal' | 'informal' | 'socratic' | 'storytelling' | 'blunt' | 'diplomatic';
export type TrustFormation = 'fast-trusting' | 'slow-trusting' | 'trust-but-verify' | 'paranoid' | 'conditional' | 'guarded';
export type Adaptability = 'rigid' | 'flexible' | 'chameleon' | 'selectively-adaptive';
export type AmbiguityTolerance = 'needs-clarity' | 'comfortable-ambiguous' | 'thrives-in-chaos' | 'context-dependent';
export type FeedbackOrientation = 'feedback-seeking' | 'feedback-averse' | 'selective-listener' | 'defensive';
export type TimeOrientation = 'past-focused' | 'present-focused' | 'future-focused' | 'balanced';
export type MoralReasoning = 'deontological' | 'consequentialist' | 'virtue-based' | 'care-based' | 'pragmatic';
export type HumorStyle = 'dry-wit' | 'self-deprecating' | 'sarcastic' | 'absurdist' | 'observational' | 'dark' | 'none' | 'jovial' | 'deadpan';
export type LearningStyle = 'visual' | 'auditory' | 'kinesthetic' | 'reading-writing' | 'multimodal' | 'experiential';

// Work products & communication style (analysts)
export type WritingStyle = 'terse' | 'verbose' | 'structured' | 'freeform' | 'hedged' | 'assertive';
export type BriefingStyle = 'slides' | 'memos' | 'verbal' | 'data-heavy' | 'narrative';
export type ConfidenceCalibration = 'overconfident' | 'underconfident' | 'well-calibrated' | 'variable';

// Sexual orientation & outness
export type SexualOrientation = 'straight' | 'gay' | 'lesbian' | 'bisexual' | 'pansexual' | 'asexual' | 'queer' | 'questioning' | 'undisclosed';
export type OutnessLevel = 'closeted' | 'selectively-out' | 'out-to-friends' | 'professionally-out' | 'publicly-out';

// Vice categorization (split from single pool)
export type ViceCategory = 'substance' | 'behavioral' | 'maladaptive-coping' | 'interpersonal-dysfunction';

// Life timeline events
export type TimelineEventType =
  | 'upbringing' | 'education-milestone' | 'first-job' | 'first-posting' | 'promotion' | 'career-break'
  | 'scandal' | 'injury' | 'burnout' | 'family-crisis' | 'mentorship' | 'betrayal' | 'moral-injury'
  | 'success' | 'failure' | 'recruitment' | 'defection-attempt' | 'security-incident' | 'romantic' | 'loss';

// === NEW FACET TYPES ===

// Motivations & Goals
export type GoalType = 'career' | 'financial' | 'relational' | 'creative' | 'legacy' | 'security' | 'freedom' | 'mastery' | 'recognition' | 'service';
export type FearType = 'failure' | 'exposure' | 'abandonment' | 'loss-of-control' | 'irrelevance' | 'poverty' | 'violence' | 'humiliation' | 'betrayal' | 'mortality';

// Financial stress
export type DebtLevel = 'none' | 'manageable' | 'strained' | 'crushing' | 'default';
export type IncomeStability = 'unstable' | 'variable' | 'stable' | 'guaranteed' | 'independent';

// Secrets
export type SecretType = 'identity' | 'relationship' | 'financial' | 'health' | 'criminal' | 'political' | 'professional' | 'family' | 'addiction' | 'belief';
export type SecretSeverity = 'embarrassing' | 'damaging' | 'career-ending' | 'criminal' | 'life-threatening';

// Decision under pressure
export type PressureResponse = 'freezes' | 'deliberates' | 'delegates' | 'rushes' | 'thrives' | 'avoids';

// Physical presence
export type GaitStyle = 'brisk' | 'measured' | 'slouching' | 'military' | 'graceful' | 'heavy' | 'nervous';
export type EyeContactPattern = 'steady' | 'avoidant' | 'intense' | 'darting' | 'warm' | 'cold';
export type NervousHabit = 'nail-biting' | 'hair-touching' | 'fidgeting' | 'pacing' | 'throat-clearing' | 'lip-biting' | 'pen-clicking' | 'leg-bouncing' | 'none';

// === ORACLE-RECOMMENDED FACETS ===

// Everyday life anchors
export type CommuteMode =
  | 'walk'
  | 'bicycle'
  | 'motorbike'
  | 'bus'
  | 'metro'
  | 'train'
  | 'driver'
  | 'rideshare'
  | 'scooter'
  | 'carpool'
  | 'remote'
  | 'mixed';
export type WeeklyAnchor =
  | 'friday-prayer'
  | 'sunday-service'
  | 'saturday-synagogue'
  | 'weekly-market'
  | 'market-day'
  | 'religious-service'
  | 'sports-match'
  | 'family-dinner'
  | 'meal-prep'
  | 'group-training'
  | 'board-game-night'
  | 'night-class'
  | 'volunteer-shift'
  | 'therapy-session'
  | 'book-club'
  | 'none';
export type CaregivingObligation =
  | 'elder-care'
  | 'child-pickup'
  | 'childcare'
  | 'sibling-support'
  | 'disabled-family'
  | 'pet-care'
  | 'foster-care'
  | 'none';
export type PettyHabit =
  | 'always-early'
  | 'always-late'
  | 'multiple-alarms'
  | 'coffee-first'
  | 'to-do-lists'
  | 'headphones-always'
  | 'desk-eater'
  | 'cluttered-desk'
  | 'organized-desk'
  | 'forgets-keys'
  | 'forgets-meals'
  | 'checks-locks'
  | 'overpacks'
  | 'skips-breakfast'
  | 'double-checks-everything'
  | 'loses-phone'
  | 'hoards-receipts'
  | 'leaves-lights-on';

// Community memberships
export type CommunityType = 'professional-society' | 'alumni-network' | 'religious-committee' | 'union-chapter' | 'hobby-club' | 'sports-league' | 'mutual-aid' | 'veterans-group' | 'parent-group' | 'political-org' | 'online-forum' | 'gaming-guild' | 'neighborhood-watch';
export type CommunityRole = 'leader' | 'organizer' | 'regular' | 'occasional' | 'lurker' | 'former';
export type CommunityStatus = 'pillar' | 'respected' | 'regular' | 'newcomer' | 'outsider' | 'controversial' | 'banned';

// Reputation
export type ReputationTag = 'reliable' | 'brilliant' | 'ruthless' | 'corrupt' | 'principled' | 'reckless' | 'discreet' | 'loudmouth' | 'fixer' | 'by-the-book' | 'unpredictable' | 'burnt-out' | 'rising-star' | 'has-been' | 'unknown';

// Emotional regulation (affect)
export type BaselineAffect = 'warm' | 'flat' | 'intense' | 'guarded' | 'mercurial' | 'melancholic' | 'anxious' | 'cheerful' | 'numb' | 'irritable' | 'hopeful' | 'restless';
export type RegulationStyle = 'ruminates' | 'suppresses' | 'externalizes' | 'reframes' | 'compartmentalizes' | 'avoids' | 'seeks-support' | 'meditates' | 'exercises' | 'isolates' | 'distracts';
export type StressTell = 'overexplains' | 'goes-quiet' | 'snaps' | 'jokes-deflect' | 'micromanages' | 'withdraws' | 'overeats' | 'insomnia' | 'hyperactive' | 'cries-easily' | 'jaw-clench' | 'pacing' | 'fidgeting' | 'tunnel-vision' | 'cold-sweat';
export type RepairStyle = 'apologizes-fast' | 'stonewalls' | 'buys-gifts' | 'explains-endlessly' | 'pretends-nothing-happened' | 'seeks-mediation' | 'writes-letters' | 'gives-space' | 'humor' | 'acts-of-service';

// Self-concept and masking
export type SelfStory = 'self-made' | 'wronged' | 'caretaker' | 'chosen' | 'survivor' | 'reformer' | 'outsider' | 'loyalist' | 'pragmatist' | 'idealist' | 'avenger' | 'guardian' | 'skeptic' | 'seeker';
export type SocialMask = 'bureaucrat' | 'charmer' | 'patriot' | 'cynic' | 'true-believer' | 'everyman' | 'intellectual' | 'tough-guy' | 'helper' | 'rebel' | 'professional' | 'joker' | 'stoic' | 'caretaker' | 'martyr';

// Life skills
export type CompetenceBand = 'incompetent' | 'struggles' | 'adequate' | 'competent' | 'expert';
export type EtiquetteLiteracy = 'protocol-native' | 'code-switcher' | 'rough-edged' | 'clueless' | 'deliberately-transgressive';

// Home and domestic life
export type HousingStability = 'owned' | 'stable-rental' | 'tenuous' | 'transient' | 'couch-surfing' | 'institutional';
export type HouseholdComposition = 'alone' | 'roommates' | 'partner' | 'partner-and-kids' | 'extended-family' | 'multigenerational' | 'group-house';
export type PrivacyLevel = 'isolated' | 'private' | 'thin-walls' | 'communal' | 'surveilled';
export type NeighborhoodType = 'elite-enclave' | 'gentrifying' | 'tight-knit' | 'anonymous' | 'insecure' | 'informal-settlement' | 'gated' | 'rural-isolated';

// Sentimental attachments
export type KeepsakeType = 'family-heirloom' | 'service-medal' | 'childhood-toy' | 'photo-album' | 'letter-bundle' | 'religious-item' | 'inherited-jewelry' | 'old-notebook' | 'none';
export type PlaceAttachment = 'hometown-street' | 'family-farm' | 'childhood-school' | 'first-apartment' | 'favorite-cafe' | 'ancestral-village' | 'grave-site' | 'none';
export type DependentNonHuman = 'dog' | 'cat' | 'birds' | 'fish' | 'stray-colony' | 'plants' | 'livestock' | 'none';

// Legal and administrative status
export type ResidencyStatus = 'citizen' | 'permanent-resident' | 'work-visa' | 'student-visa' | 'irregular' | 'asylum-pending' | 'refugee' | 'stateless' | 'diplomatic';
export type LegalExposure = 'clean' | 'old-conviction' | 'pending-case' | 'tax-dispute' | 'custody-battle' | 'debt-collection' | 'sealed-record' | 'under-investigation';
export type CredentialType = 'bar-license' | 'medical-license' | 'security-clearance' | 'pilot-license' | 'hazmat-cert' | 'teaching-cert' | 'press-credentials' | 'diplomatic-passport' | 'contractor-badge';

// Civic and political life
export type CivicEngagement = 'disengaged' | 'quiet-voter' | 'active-participant' | 'organizer' | 'candidate' | 'disillusioned';
export type IdeologyTag = 'conservative' | 'progressive' | 'libertarian' | 'socialist' | 'nationalist' | 'centrist' | 'apolitical' | 'single-issue' | 'cynical-pragmatist';

// Latents - internal type used for agent generation tracing
export type Latents = {
  cosmopolitanism: Fixed;
  publicness: Fixed;
  opsecDiscipline: Fixed;
  institutionalEmbeddedness: Fixed;
  riskAppetite: Fixed;
  stressReactivity: Fixed;
  impulseControl: Fixed;
  techFluency: Fixed;
  socialBattery: Fixed;
  aestheticExpressiveness: Fixed;
  frugality: Fixed;
  curiosityBandwidth: Fixed;
  adaptability: Fixed;
  planningHorizon: Fixed;
  principledness: Fixed;
  physicalConditioning: Fixed;
};

export type AgentGenerationTraceV1 = {
  version: 1;
  normalizedSeed: string;
  facetSeeds: Record<string, number>;
  latents: {
    values: Latents;
    raw: Record<keyof Latents, Fixed>;
    tierBias: Record<keyof Latents, number>;
    roleBias: Record<keyof Latents, number>;
  };
  derived: Record<string, unknown>;
  fields: Record<string, { value: unknown; method?: string; dependsOn?: Record<string, unknown> }>;
};

export type GeneratedAgent = {
  version: 1;
  id: string;
  seed: string;
  createdAtIso: string;

  generationTrace?: AgentGenerationTraceV1;
  deepSimPreview: DeepSimPreviewV1;

  identity: {
    name: string;
    homeCountryIso3: string;
    citizenshipCountryIso3: string;
    currentCountryIso3: string;
    homeCulture: string; // legacy - kept for backwards compat
    birthYear: number;
    tierBand: TierBand;
    originTierBand: TierBand; // where they came from
    socioeconomicMobility: SocioeconomicMobility; // trajectory
    roleSeedTags: string[];
    languages: string[];
    languageProficiencies: Array<{ language: string; proficiencyBand: Band5 }>;
    educationTrackTag: string;
    careerTrackTag: string;
    redLines: string[];
  };

  // Orthogonal culture axes (replaces flat homeCulture)
  culture: CultureAxes;

  appearance: {
    heightBand: HeightBand;
    buildTag: string;
    hair: { color: string; texture: string };
    eyes: { color: string };
    voiceTag: string;
    distinguishingMarks: string[];
  };

  capabilities: {
    aptitudes: {
      strength: Fixed;
      endurance: Fixed;
      dexterity: Fixed;
      reflexes: Fixed;
      handEyeCoordination: Fixed;

      cognitiveSpeed: Fixed;
      attentionControl: Fixed;
      workingMemory: Fixed;
      riskCalibration: Fixed;

      charisma: Fixed;
      empathy: Fixed;
      assertiveness: Fixed;
      deceptionAptitude: Fixed;
    };
    skills: Record<string, { value: Fixed; xp: Fixed; lastUsedDay: number | null }>;
  };

  preferences: {
    food: {
      comfortFoods: string[];
      dislikes: string[];
      restrictions: string[];
      ritualDrink: string;
    };
    media: {
      platformDiet: Record<string, Fixed>;
      genreTopK: string[];
      attentionResilience: Fixed;
      doomscrollingRisk: Fixed;
      epistemicHygiene: Fixed;
    };
    fashion: {
      styleTags: string[];
      formality: Fixed;
      conformity: Fixed;
      statusSignaling: Fixed;
    };
    hobbies: {
      primary: string[];
      secondary: string[];
      categories: string[];
    };
    environment: {
      temperature: string;
      weatherMood: string;
    };
    livingSpace: {
      roomPreferences: string[];
      comfortItems: string[];
    };
    social: {
      groupStyle: string;
      communicationMethod: string;
      boundary: string;
      emotionalSharing: string;
    };
    work: {
      preferredOperations: string[];
      avoidedOperations: string[];
    };
    equipment: {
      weaponPreference: string;
      gearPreferences: string[];
    };
    quirks: {
      luckyItem: string;
      rituals: string[];
      petPeeves: string[];
      mustHaves: string[];
    };
    time: {
      dailyRhythm: string;
      planningStyle: string;
    };
  };

  psych: {
    traits: {
      riskTolerance: Fixed;
      conscientiousness: Fixed;
      noveltySeeking: Fixed;
      agreeableness: Fixed;
      authoritarianism: Fixed;
    };
    // Decomposed principledness (Oracle recommendation)
    ethics: {
      ruleAdherence: Fixed; // follows rules vs bends them
      harmAversion: Fixed; // cares about harm to others
      missionUtilitarianism: Fixed; // does dirty work if needed
      loyaltyScope: 'institution' | 'people' | 'ideals' | 'self';
    };
    contradictions: ContradictionPair[]; // story-engine tensions
  };

  // Network position (Oracle recommendation)
  network: {
    role: NetworkRole;
    factionAlignment: string | null;
    leverageType: 'favors' | 'information' | 'money' | 'ideology' | 'care';
  };

  // Elite compensators (Oracle recommendation)
  eliteCompensators: EliteCompensator[];

  visibility: {
    publicVisibility: Fixed;
    paperTrail: Fixed;
    digitalHygiene: Fixed;
  };

  health: {
    chronicConditionTags: string[];
    allergyTags: string[];
  };

  covers: {
    coverAptitudeTags: string[];
  };

  mobility: {
    passportAccessBand: Band5;
    mobilityTag: string;
    travelFrequencyBand: Band5;
  };

  routines: {
    chronotype: string;
    sleepWindow: string;
    recoveryRituals: string[];
  };

  vices: Array<{
    vice: string;
    severity: Band5;
    triggers: string[];
  }>;

  logistics: {
    identityKit: Array<{ item: string; security: Band5; compromised: boolean }>;
  };

  neurodivergence: {
    indicatorTags: string[];
    copingStrategies: string[];
  };

  spirituality: {
    tradition: string;
    affiliationTag: string;
    observanceLevel: string;
    practiceTypes: string[];
  };

  background: {
    adversityTags: string[];
    resilienceIndicators: string[];
  };

  gender: {
    identityTag: string;
    pronounSet: string;
  };

  // Sexual orientation & outness (Oracle recommendation)
  orientation: {
    orientationTag: SexualOrientation;
    outnessLevel: OutnessLevel;
  };

  // Naming system (Oracle recommendation)
  naming: {
    structure: NameStructure;
    honorificStyle: HonorificStyle;
    callSign: string | null;
    aliases: string[];
    romanizedName: string | null; // for non-Latin scripts
  };

  // Subnational geography (Oracle recommendation)
  geography: {
    originRegion: string | null; // province/state/region
    urbanicity: Urbanicity;
    diasporaStatus: DiasporaStatus;
  };

  // Family & relationships (Oracle recommendation)
  family: {
    maritalStatus: MaritalStatus;
    dependentCount: number;
    hasLivingParents: boolean;
    hasSiblings: boolean;
  };

  // Key relationships (Oracle recommendation)
  relationships: Array<{
    type: RelationshipType;
    strength: Band5;
    description: string;
  }>;

  // Institutional identity (Oracle recommendation)
  institution: {
    orgType: OrgType;
    gradeBand: GradeBand;
    clearanceBand: ClearanceBand;
    functionalSpecialization: FunctionalSpecialization;
    yearsInService: number;
    coverStatus: 'official' | 'non-official' | 'none';
  };

  // Personality core (Oracle recommendation - Big Five-lite + extended dimensions)
  personality: {
    conflictStyle: ConflictStyle;
    epistemicStyle: EpistemicStyle;
    socialEnergy: SocialEnergy;
    riskPosture: RiskPosture;
    attachmentStyle: AttachmentStyle;
    emotionalRegulation: EmotionalRegulation;
    stressResponse: StressResponse;
    decisionMaking: DecisionMaking;
    motivationalDrivers: MotivationalDriver[];
    communicationStyle: CommunicationStyle;
    trustFormation: TrustFormation;
    adaptability: Adaptability;
    ambiguityTolerance: AmbiguityTolerance;
    feedbackOrientation: FeedbackOrientation;
    timeOrientation: TimeOrientation;
    moralReasoning: MoralReasoning;
    humorStyle: HumorStyle;
    learningStyle: LearningStyle;
  };

  // Work style (Oracle recommendation - analyst/diplomat focus)
  workStyle: {
    writingStyle: WritingStyle;
    briefingStyle: BriefingStyle;
    confidenceCalibration: ConfidenceCalibration;
    jargonDensity: Band5;
    meetingTolerance: Band5;
  };

  // Life timeline (Oracle recommendation)
  timeline: Array<{
    yearOffset: number; // years from birth
    type: TimelineEventType;
    description: string;
    impact: 'positive' | 'negative' | 'neutral' | 'mixed';
  }>;

  // Minority status flags (Oracle recommendation)
  minorityStatus: {
    localMajority: boolean; // majority in their current location
    visibleMinority: boolean; // visually identifiable as different
    linguisticMinority: boolean; // primary language differs from locale
    religiousMinority: boolean; // faith differs from locale majority
  };

  // === NEW FACETS ===

  // Motivations & goals - what drives them
  motivations: {
    primaryGoal: GoalType;
    secondaryGoals: GoalType[];
    fears: FearType[];
    coreNeed: string; // narrative description
  };

  // Attachment style - how they form relationships
  attachmentStyle: AttachmentStyle;

  // Economics - financial situation and stress
  economics: {
    debtLevel: DebtLevel;
    incomeStability: IncomeStability;
    financialAnxiety01k: Fixed;
    spendingStyle: 'frugal' | 'measured' | 'generous' | 'impulsive' | 'status-driven';
  };

  // Secrets - what they hide
  secrets: Array<{
    type: SecretType;
    severity: SecretSeverity;
    knownBy: string[]; // 'no-one' | 'partner' | 'family' | 'close-friends' | 'employer' | 'public'
    narrativeHook: string;
  }>;

  // Humor style
  humorStyle: HumorStyle;

  // How they behave under pressure
  pressureResponse: PressureResponse;

  // Physical presence & mannerisms
  physicalPresence: {
    gait: GaitStyle;
    eyeContact: EyeContactPattern;
    nervousHabits: NervousHabit[];
    personalSpacePref: 'close' | 'normal' | 'distant';
    gestureFrequency: Band5;
  };

  // Deception ability (separate from aptitude - this is skill/practice)
  deceptionSkill: {
    lyingAbility: Fixed; // how good they are at lying
    tellAwareness: Fixed; // how aware they are of their own tells
    detectsLies: Fixed; // how good at spotting others' lies
  };

  // === ORACLE-RECOMMENDED FACETS ===

  // Everyday life anchors - where they are, when
  everydayLife: {
    thirdPlaces: string[]; // gym, cafe, aunt's place, etc.
    commuteMode: CommuteMode;
    weeklyAnchor: WeeklyAnchor;
    pettyHabits: PettyHabit[];
    caregivingObligation: CaregivingObligation;
  };

  // Community memberships - where they belong
  communities: {
    memberships: Array<{
      type: CommunityType;
      role: CommunityRole;
      intensityBand: Band5;
    }>;
    onlineCommunities: string[];
    communityStatus: CommunityStatus;
  };

  // Reputation - what people think of them
  reputation: {
    professional: ReputationTag;
    neighborhood: ReputationTag;
    online: ReputationTag;
    scandalSensitivity: Band5;
  };

  // Emotional regulation - how feelings behave
  affect: {
    baseline: BaselineAffect;
    regulationStyle: RegulationStyle;
    stressTells: StressTell[];
    repairStyle: RepairStyle;
  };

  // Self-concept - the story they tell themselves
  selfConcept: {
    selfStory: SelfStory;
    impostorRisk: Fixed;
    socialMask: SocialMask;
  };

  // Life skills - competence outside the job
  lifeSkills: {
    domesticCompetence: CompetenceBand;
    bureaucracyNavigation: CompetenceBand;
    streetSmarts: CompetenceBand;
    etiquetteLiteracy: EtiquetteLiteracy;
  };

  // Home - domestic reality
  home: {
    housingStability: HousingStability;
    householdComposition: HouseholdComposition;
    privacyLevel: PrivacyLevel;
    neighborhoodType: NeighborhoodType;
  };

  // Sentimental attachments - soft leverage points
  attachments: {
    keepsake: KeepsakeType;
    placeAttachment: PlaceAttachment;
    dependentNonHuman: DependentNonHuman;
  };

  // Legal/administrative status - paperwork friction
  legalAdmin: {
    residencyStatus: ResidencyStatus;
    legalExposure: LegalExposure;
    credentials: CredentialType[];
  };

  // Civic and political life
  civicLife: {
    engagement: CivicEngagement;
    ideology: IdeologyTag;
    tabooTopics: string[];
  };
};

export type GenerateAgentInput = {
  vocab: AgentVocabV1;
  countries: { iso3: string; shadow: string; continent?: string }[];
  priors?: AgentPriorsV1;
  seed: string;
  birthYear?: number;
  asOfYear?: number;
  tierBand?: TierBand;
  roleSeedTags?: string[];
  homeCountryIso3?: string;
  citizenshipCountryIso3?: string;
  currentCountryIso3?: string;
  includeTrace?: boolean;
};
