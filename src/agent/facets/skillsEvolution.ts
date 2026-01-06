import type {
  AgentGenerationTraceV1,
  AgentVocabV1,
  Latents,
  SkillsEvolutionSnapshot,
} from '../types';
import { facetSeed, makeRng, traceFacet, traceSet, uniqueStrings, weightedPick, weightedPickKUnique } from '../utils';
import type { Aptitudes } from './aptitudes';
import type { PsychTraits } from './traits';
import type { SkillEntry } from './skills';

const DEFAULT_FOCUS_COUNT = 2;
const DEFAULT_SHIFT_COUNT = 2;

const FALLBACK_EVOLUTION = {
  evolutionArcs: [
    'protector',
    'teacher',
    'redeemed',
    'hardened-killer',
    'paranoid-mastermind',
    'broken-idealist',
    'adaptive-survivor',
    'integrated-warrior',
  ],
  skillFocuses: [
    'combat-mastery',
    'intelligence-expertise',
    'social-manipulation',
    'technical-problem-solving',
    'medical-care',
    'survival-endurance',
    'leadership-command',
  ],
  personalityShifts: [
    'hardened',
    'paranoid',
    'nurturing',
    'cynical',
    'stoic',
    'mentor-identity',
    'guardian-instinct',
    'risk-averse',
    'risk-seeking',
    'analytical',
    'secretive',
    'empathetic',
  ],
  growthDrivers: ['active-use', 'training', 'observation', 'teaching', 'failure-lessons'],
  decayPressures: ['unused-skill-decay', 'age-physical-decline', 'injury-cap', 'burnout', 'role-shift'],
  timePhases: ['rookie-phase', 'experience-peak', 'veteran-phase', 'old-guard-phase'],
  experienceTriggers: [
    'first-kill',
    'civilian-casualties',
    'betrayal',
    'deep-trust',
    'love-found',
    'loss-grief',
    'successful-command',
    'failed-leadership',
    'long-term-stress',
    'isolation',
    'cultural-immersion',
    'luxury-exposure',
  ],
};

type SkillRecord = Record<string, SkillEntry>;

export function computeSkillsEvolution(
  seed: string,
  vocab: AgentVocabV1,
  latents: Latents,
  traits: PsychTraits,
  aptitudes: Aptitudes,
  skills: SkillRecord,
  age: number,
  roleSeedTags: readonly string[],
  trace?: AgentGenerationTraceV1,
): SkillsEvolutionSnapshot {
  traceFacet(trace, seed, 'skillsEvolution');
  const rng = makeRng(facetSeed(seed, 'skillsEvolution'));

  const evolution = vocab.skillsEvolution ?? FALLBACK_EVOLUTION;
  const evolutionArcs = uniqueStrings(evolution.evolutionArcs ?? FALLBACK_EVOLUTION.evolutionArcs);
  const skillFocuses = uniqueStrings(evolution.skillFocuses ?? FALLBACK_EVOLUTION.skillFocuses);
  const personalityShifts = uniqueStrings(evolution.personalityShifts ?? FALLBACK_EVOLUTION.personalityShifts);
  const growthDrivers = uniqueStrings(evolution.growthDrivers ?? FALLBACK_EVOLUTION.growthDrivers);
  const decayPressures = uniqueStrings(evolution.decayPressures ?? FALLBACK_EVOLUTION.decayPressures);
  const timePhases = uniqueStrings(evolution.timePhases ?? FALLBACK_EVOLUTION.timePhases);
  const experienceTriggers = uniqueStrings(evolution.experienceTriggers ?? FALLBACK_EVOLUTION.experienceTriggers);

  const empathy01 = aptitudes.empathy / 1000;
  const tech01 = latents.techFluency / 1000;
  const opsec01 = latents.opsecDiscipline / 1000;
  const stress01 = latents.stressReactivity / 1000;
  const risk01 = latents.riskAppetite / 1000;
  const social01 = latents.socialBattery / 1000;
  const principled01 = latents.principledness / 1000;
  const adapt01 = latents.adaptability / 1000;
  const cosmo01 = latents.cosmopolitanism / 1000;
  const conscientious01 = traits.conscientiousness / 1000;
  const isOperative = roleSeedTags.includes('operative') || roleSeedTags.includes('security');

  const skill01 = (key: string) => (skills[key]?.value ?? 0) / 1000;

  const arc = weightedPick(rng, evolutionArcs.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('protector')) w += 1.2 * empathy01 + 0.9 * principled01 + 0.3 * social01;
    if (s.includes('teacher')) w += 0.9 * conscientious01 + 0.6 * social01 + 0.4 * Math.min(1, age / 50);
    if (s.includes('redeemed')) w += 0.7 * principled01 + 0.5 * stress01;
    if (s.includes('hardened')) w += 1.1 * (1 - empathy01) + 0.7 * stress01 + 0.3 * risk01;
    if (s.includes('paranoid')) w += 0.9 * opsec01 + 0.7 * stress01 + 0.4 * tech01;
    if (s.includes('broken')) w += 0.8 * stress01 + 0.6 * principled01 + 0.4 * (1 - adapt01);
    if (s.includes('adaptive')) w += 0.9 * adapt01 + 0.4 * stress01;
    if (s.includes('integrated')) w += 0.7 * principled01 + 0.6 * conscientious01 + 0.5 * empathy01;
    return { item, weight: Math.max(0.15, w) };
  })) as string;

  const phase = weightedPick(rng, timePhases.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('rookie')) w += age < 30 ? 1.5 : 0.2;
    if (s.includes('physical')) w += age >= 25 && age <= 35 ? 1.3 : 0.2;
    if (s.includes('experience')) w += age >= 30 && age <= 45 ? 1.4 : 0.3;
    if (s.includes('veteran')) w += age > 45 && age <= 60 ? 1.4 : 0.3;
    if (s.includes('old')) w += age > 60 ? 1.6 : 0.2;
    return { item, weight: Math.max(0.15, w) };
  })) as string;

  const focusWeights = skillFocuses.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('combat')) w += 1.1 * skill01('shooting') + 0.8 * skill01('tradecraft') + 0.4 * skill01('driving');
    if (s.includes('intelligence')) w += 1.0 * skill01('surveillance') + 0.8 * skill01('tradecraft') + 0.4 * skill01('bureaucracy');
    if (s.includes('social')) w += 1.2 * skill01('negotiation') + 0.8 * skill01('mediaHandling');
    if (s.includes('technical')) w += 0.9 * skill01('financeOps') + 0.7 * skill01('legalOps') + 0.5 * skill01('bureaucracy');
    if (s.includes('medical')) w += 1.3 * skill01('firstAid');
    if (s.includes('survival')) w += 0.9 * skill01('driving') + 0.6 * skill01('tradecraft');
    if (s.includes('leadership')) w += 0.9 * skill01('negotiation') + 0.6 * skill01('bureaucracy') + 0.4 * skill01('mediaHandling');
    if (s.includes('counter')) w += 0.9 * skill01('surveillance') + 0.5 * skill01('tradecraft');
    return { item, weight: Math.max(0.2, w) };
  });
  const focusCount = Math.min(DEFAULT_FOCUS_COUNT, focusWeights.length);
  const focusPicks = weightedPickKUnique(rng, focusWeights, focusCount);

  const growthDriver = weightedPick(rng, growthDrivers.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('active')) w += (isOperative ? 0.9 : 0.3) + 0.4 * (skill01('tradecraft') + skill01('surveillance')) / 2;
    if (s.includes('training')) w += 0.7 * conscientious01;
    if (s.includes('observation')) w += 0.6 * tech01 + 0.3 * cosmo01;
    if (s.includes('teaching')) w += 0.7 * social01 + 0.4 * Math.min(1, age / 50);
    if (s.includes('failure')) w += 0.6 * stress01;
    return { item, weight: Math.max(0.15, w) };
  })) as string;

  const shiftWeights = personalityShifts.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('hardened')) w += 0.9 * (1 - empathy01) + 0.6 * stress01;
    if (s.includes('paranoid')) w += 0.9 * opsec01 + 0.6 * stress01;
    if (s.includes('nurtur') || s.includes('empathetic')) w += 0.9 * empathy01 + 0.4 * social01;
    if (s.includes('cynical')) w += 0.7 * (1 - principled01) + 0.4 * stress01;
    if (s.includes('stoic')) w += 0.6 * conscientious01 + 0.4 * opsec01;
    if (s.includes('mentor')) w += 0.7 * conscientious01 + 0.6 * Math.min(1, age / 50);
    if (s.includes('guardian')) w += 0.7 * principled01 + 0.6 * empathy01;
    if (s.includes('risk-averse')) w += 0.7 * (1 - risk01);
    if (s.includes('risk-seeking')) w += 0.7 * risk01;
    if (s.includes('analytical')) w += 0.6 * tech01 + 0.3 * conscientious01;
    if (s.includes('secretive')) w += 0.7 * opsec01;
    return { item, weight: Math.max(0.15, w) };
  });
  const shiftCount = Math.min(DEFAULT_SHIFT_COUNT, shiftWeights.length);
  const shiftPicks = weightedPickKUnique(rng, shiftWeights, shiftCount);

  const decayPressure = weightedPick(rng, decayPressures.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('unused')) w += 0.4 * (1 - conscientious01);
    if (s.includes('age')) w += age > 45 ? 1.2 : 0.2;
    if (s.includes('injury')) w += 0.6 * (1 - latents.physicalConditioning / 1000);
    if (s.includes('burnout')) w += 0.8 * stress01;
    if (s.includes('role')) w += 0.4 * (isOperative ? 0.2 : 1);
    return { item, weight: Math.max(0.15, w) };
  })) as string;

  const trigger = weightedPick(rng, experienceTriggers.map((item) => {
    const s = item.toLowerCase();
    let w = 1;
    if (s.includes('kill') || s.includes('casualties')) w += (isOperative ? 0.9 : 0.2) + 0.6 * stress01;
    if (s.includes('betrayal')) w += 0.7 * opsec01 + 0.4 * (1 - social01);
    if (s.includes('trust') || s.includes('love')) w += 0.7 * social01 + 0.4 * empathy01;
    if (s.includes('loss') || s.includes('grief')) w += 0.8 * stress01;
    if (s.includes('command')) w += 0.6 * conscientious01 + 0.4 * (roleSeedTags.includes('leader') ? 1 : 0.2);
    if (s.includes('fail')) w += 0.6 * stress01 + 0.3 * (1 - conscientious01);
    if (s.includes('stress')) w += 0.8 * stress01;
    if (s.includes('isolation')) w += 0.6 * (1 - social01);
    if (s.includes('cultural')) w += 0.7 * cosmo01 + 0.4 * adapt01;
    if (s.includes('luxury')) w += 0.5 * latents.publicness / 1000 + 0.4 * (1 - latents.frugality / 1000);
    return { item, weight: Math.max(0.15, w) };
  })) as string;

  const result: SkillsEvolutionSnapshot = {
    arc,
    phase,
    skillFocuses: focusPicks,
    growthDriver,
    personalityShifts: shiftPicks,
    decayPressure,
    trigger,
  };

  traceSet(trace, 'skillsEvolution', result, { method: 'weightedPick' });
  return result;
}
