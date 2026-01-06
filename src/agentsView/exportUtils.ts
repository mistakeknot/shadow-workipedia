import type { GeneratedAgent } from '../agent';
import { displayLanguageCode, toTitleCaseWords } from './formatting';

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function humanizeAgentForExport(
  agent: GeneratedAgent,
  shadowByIso3?: ReadonlyMap<string, { shadow: string; continent?: string }>,
): unknown {
  const { generationTrace: _generationTrace, ...agentWithoutTrace } = agent;
  const platformDiet: Record<string, number> = {};
  for (const [k, v] of Object.entries(agent.preferences.media.platformDiet)) {
    platformDiet[toTitleCaseWords(k)] = v;
  }

  const homeShadow = shadowByIso3?.get(agent.identity.homeCountryIso3)?.shadow ?? null;
  const citizenshipShadow = shadowByIso3?.get(agent.identity.citizenshipCountryIso3)?.shadow ?? null;
  const currentShadow = shadowByIso3?.get(agent.identity.currentCountryIso3)?.shadow ?? null;

  return {
    ...agentWithoutTrace,
    identity: {
      ...agent.identity,
      homeCountryShadow: homeShadow,
      citizenshipCountryShadow: citizenshipShadow,
      currentCountryShadow: currentShadow,
      tierBand: toTitleCaseWords(agent.identity.tierBand),
      roleSeedTags: agent.identity.roleSeedTags.map(toTitleCaseWords),
      educationTrackTag: toTitleCaseWords(agent.identity.educationTrackTag),
      careerTrackTag: toTitleCaseWords(agent.identity.careerTrackTag),
      redLines: agent.identity.redLines.map(toTitleCaseWords),
      languages: agent.identity.languages.map(displayLanguageCode),
      languageProficiencies: agent.identity.languageProficiencies.map(lp => ({
        ...lp,
        language: displayLanguageCode(lp.language),
        proficiencyBand: toTitleCaseWords(lp.proficiencyBand),
      })),
    },
    deepSimPreview: {
      ...agent.deepSimPreview,
      breakRiskBand: toTitleCaseWords(agent.deepSimPreview.breakRiskBand),
      breakTypesTopK: agent.deepSimPreview.breakTypesTopK.map(toTitleCaseWords),
      thoughts: agent.deepSimPreview.thoughts.map(t => ({
        ...t,
        tag: toTitleCaseWords(t.tag),
        source: toTitleCaseWords(t.source),
      })),
    },
    appearance: {
      ...agent.appearance,
      heightBand: toTitleCaseWords(agent.appearance.heightBand),
      buildTag: toTitleCaseWords(agent.appearance.buildTag),
      hair: {
        color: toTitleCaseWords(agent.appearance.hair.color),
        texture: toTitleCaseWords(agent.appearance.hair.texture),
      },
      eyes: { color: toTitleCaseWords(agent.appearance.eyes.color) },
      voiceTag: toTitleCaseWords(agent.appearance.voiceTag),
      distinguishingMarks: agent.appearance.distinguishingMarks.map(toTitleCaseWords),
    },
    preferences: {
      ...agent.preferences,
      food: {
        ...agent.preferences.food,
        comfortFoods: agent.preferences.food.comfortFoods.map(toTitleCaseWords),
        dislikes: agent.preferences.food.dislikes.map(toTitleCaseWords),
        restrictions: agent.preferences.food.restrictions.map(toTitleCaseWords),
        ritualDrink: toTitleCaseWords(agent.preferences.food.ritualDrink),
      },
      media: {
        ...agent.preferences.media,
        platformDiet,
        genreTopK: agent.preferences.media.genreTopK.map(toTitleCaseWords),
      },
      fashion: {
        ...agent.preferences.fashion,
        styleTags: agent.preferences.fashion.styleTags.map(toTitleCaseWords),
      },
      environment: {
        temperature: toTitleCaseWords(agent.preferences.environment.temperature),
        weatherMood: toTitleCaseWords(agent.preferences.environment.weatherMood),
      },
      livingSpace: {
        roomPreferences: agent.preferences.livingSpace.roomPreferences.map(toTitleCaseWords),
        comfortItems: agent.preferences.livingSpace.comfortItems.map(toTitleCaseWords),
      },
      social: {
        groupStyle: toTitleCaseWords(agent.preferences.social.groupStyle),
        communicationMethod: toTitleCaseWords(agent.preferences.social.communicationMethod),
        boundary: toTitleCaseWords(agent.preferences.social.boundary),
        emotionalSharing: toTitleCaseWords(agent.preferences.social.emotionalSharing),
      },
      work: {
        preferredOperations: agent.preferences.work.preferredOperations.map(toTitleCaseWords),
        avoidedOperations: agent.preferences.work.avoidedOperations.map(toTitleCaseWords),
      },
      equipment: {
        weaponPreference: toTitleCaseWords(agent.preferences.equipment.weaponPreference),
        gearPreferences: agent.preferences.equipment.gearPreferences.map(toTitleCaseWords),
      },
      quirks: {
        luckyItem: toTitleCaseWords(agent.preferences.quirks.luckyItem),
        rituals: agent.preferences.quirks.rituals.map(toTitleCaseWords),
        petPeeves: agent.preferences.quirks.petPeeves.map(toTitleCaseWords),
        mustHaves: agent.preferences.quirks.mustHaves.map(toTitleCaseWords),
      },
      time: {
        dailyRhythm: toTitleCaseWords(agent.preferences.time.dailyRhythm),
        planningStyle: toTitleCaseWords(agent.preferences.time.planningStyle),
      },
    },
    psych: {
      traits: {
        riskTolerance: agent.psych.traits.riskTolerance,
        conscientiousness: agent.psych.traits.conscientiousness,
        noveltySeeking: agent.psych.traits.noveltySeeking,
        agreeableness: agent.psych.traits.agreeableness,
        authoritarianism: agent.psych.traits.authoritarianism,
      },
    },
    visibility: {
      publicVisibility: agent.visibility.publicVisibility,
      paperTrail: agent.visibility.paperTrail,
      digitalHygiene: agent.visibility.digitalHygiene,
    },
    health: {
      chronicConditionTags: agent.health.chronicConditionTags.map(toTitleCaseWords),
      allergyTags: agent.health.allergyTags.map(toTitleCaseWords),
      injuryHistoryTags: agent.health.injuryHistoryTags.map(toTitleCaseWords),
      diseaseTags: agent.health.diseaseTags.map(toTitleCaseWords),
      fitnessBand: toTitleCaseWords(agent.health.fitnessBand),
      treatmentTags: agent.health.treatmentTags.map(toTitleCaseWords),
    },
    everydayLife: {
      thirdPlaces: agent.everydayLife.thirdPlaces.map(toTitleCaseWords),
      commuteMode: toTitleCaseWords(agent.everydayLife.commuteMode),
      weeklyAnchor: toTitleCaseWords(agent.everydayLife.weeklyAnchor),
      pettyHabits: agent.everydayLife.pettyHabits.map(toTitleCaseWords),
      caregivingObligation: toTitleCaseWords(agent.everydayLife.caregivingObligation),
    },
    memoryTrauma: {
      memoryTags: agent.memoryTrauma.memoryTags.map(toTitleCaseWords),
      traumaTags: agent.memoryTrauma.traumaTags.map(toTitleCaseWords),
      triggerPatterns: agent.memoryTrauma.triggerPatterns.map(toTitleCaseWords),
      responsePatterns: agent.memoryTrauma.responsePatterns.map(toTitleCaseWords),
    },
    covers: {
      coverAptitudeTags: agent.covers.coverAptitudeTags.map(toTitleCaseWords),
    },
    mobility: {
      ...agent.mobility,
      passportAccessBand: toTitleCaseWords(agent.mobility.passportAccessBand),
      mobilityTag: toTitleCaseWords(agent.mobility.mobilityTag),
      travelFrequencyBand: toTitleCaseWords(agent.mobility.travelFrequencyBand),
    },
    routines: {
      ...agent.routines,
      chronotype: toTitleCaseWords(agent.routines.chronotype),
      recoveryRituals: agent.routines.recoveryRituals.map(toTitleCaseWords),
    },
    vices: agent.vices.map(v => ({
      ...v,
      vice: toTitleCaseWords(v.vice),
      severity: toTitleCaseWords(v.severity),
      triggers: v.triggers.map(toTitleCaseWords),
    })),
    logistics: {
      identityKit: agent.logistics.identityKit.map(i => ({
        ...i,
        item: toTitleCaseWords(i.item),
        security: toTitleCaseWords(i.security),
      })),
    },
  };
}
