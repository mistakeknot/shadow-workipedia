import type {
  AgentGenerationTraceV1,
  AgentVocabV1,
  DecisionStyleResult,
  DecisionTemplateCategory,
  DecisionTendency,
  Latents,
  Fixed,
} from '../types';
import { clampInt, facetSeed, makeRng, traceFacet, traceSet, uniqueStrings, weightedPick } from '../utils';
import type { Aptitudes } from './aptitudes';
import type { PsychTraits } from './traits';

type Ethics = {
  harmAversion: Fixed;
  missionUtilitarianism: Fixed;
};

type TemplatePools = Record<DecisionTemplateCategory, string[]>;

type CategoryWeight = {
  category: DecisionTemplateCategory;
  items: string[];
  weight: number;
};

const DEFAULT_READ_COUNT_RANGE: readonly [number, number] = [3, 5];

function normalizePool(items: string[] | undefined): string[] {
  return uniqueStrings(items ?? []);
}

function buildPools(vocab: AgentVocabV1): TemplatePools {
  const templates = vocab.decisionTemplates ?? {};
  return {
    mission: normalizePool(templates.mission),
    resource: normalizePool(templates.resource),
    social: normalizePool(templates.social),
    crisis: normalizePool(templates.crisis),
    information: normalizePool(templates.information),
    moral: normalizePool(templates.moral),
    resourceManagement: normalizePool(templates.resourceManagement),
    longTerm: normalizePool(templates.longTerm),
  };
}

export function computeDecisionStyle(
  seed: string,
  vocab: AgentVocabV1,
  latents: Latents,
  traits: PsychTraits,
  aptitudes: Aptitudes,
  ethics: Ethics,
  trace?: AgentGenerationTraceV1,
): DecisionStyleResult {
  traceFacet(trace, seed, 'decisionStyle');
  const rng = makeRng(facetSeed(seed, 'decisionStyle'));

  const pools = buildPools(vocab);
  const fallbackPools: TemplatePools = {
    mission: ['Volunteers for high-risk missions', 'Refuses civilian harm'],
    resource: ['Reports found resources', 'Accepts bribes if desperate'],
    social: ['Avoids open conflict', 'Builds trust slowly'],
    crisis: ['Seeks cover first', 'Shields allies under fire'],
    information: ['Investigates rumors before sharing', 'Reports secrets up-chain'],
    moral: ['Spare defeated enemies', 'Questions orders that cross a line'],
    resourceManagement: ['Rations supplies strictly', 'Improvises when equipment fails'],
    longTerm: ['Pursues leadership roles', 'Plans a quiet exit'],
  };

  (Object.keys(fallbackPools) as DecisionTemplateCategory[]).forEach((category) => {
    if (!pools[category].length) pools[category] = fallbackPools[category];
  });

  const risk01 = traits.riskTolerance / 1000;
  const cons01 = traits.conscientiousness / 1000;
  const agree01 = traits.agreeableness / 1000;
  const auth01 = traits.authoritarianism / 1000;
  const stress01 = latents.stressReactivity / 1000;
  const public01 = latents.publicness / 1000;
  const frugal01 = latents.frugality / 1000;
  const plan01 = latents.planningHorizon / 1000;
  const curiosity01 = latents.curiosityBandwidth / 1000;
  const social01 = latents.socialBattery / 1000;
  const empathy01 = aptitudes.empathy / 1000;
  const harm01 = ethics.harmAversion / 1000;
  const util01 = ethics.missionUtilitarianism / 1000;

  const categories: CategoryWeight[] = [
    { category: 'mission', items: pools.mission, weight: 0.7 + 0.6 * risk01 + 0.2 * util01 + 0.2 * (1 - harm01) },
    { category: 'resource', items: pools.resource, weight: 0.6 + 0.6 * (1 - frugal01) + 0.2 * public01 },
    { category: 'social', items: pools.social, weight: 0.6 + 0.5 * agree01 + 0.3 * social01 + 0.1 * empathy01 },
    { category: 'crisis', items: pools.crisis, weight: 0.6 + 0.5 * stress01 + 0.3 * risk01 },
    { category: 'information', items: pools.information, weight: 0.6 + 0.5 * curiosity01 + 0.2 * plan01 },
    { category: 'moral', items: pools.moral, weight: 0.7 + 0.7 * harm01 + 0.4 * empathy01 + 0.2 * (1 - util01) },
    { category: 'resourceManagement', items: pools.resourceManagement, weight: 0.6 + 0.6 * cons01 + 0.2 * (1 - risk01) },
    { category: 'longTerm', items: pools.longTerm, weight: 0.6 + 0.6 * plan01 + 0.3 * cons01 + 0.2 * auth01 },
  ].filter((entry) => entry.items.length);

  const targetCount = clampInt(rng.int(DEFAULT_READ_COUNT_RANGE[0], DEFAULT_READ_COUNT_RANGE[1]), 3, 5);
  const tendencies: DecisionTendency[] = [];
  const usedItems = new Set<string>();

  const remaining = new Map<DecisionTemplateCategory, CategoryWeight>();
  for (const entry of categories) remaining.set(entry.category, entry);

  while (tendencies.length < targetCount && remaining.size) {
    const options = [...remaining.values()].map((entry) => ({
      item: entry.category,
      weight: Math.max(0.15, entry.weight),
    }));
    const pickedCategory = weightedPick(rng, options) as DecisionTemplateCategory;
    const entry = remaining.get(pickedCategory);
    if (!entry) {
      remaining.delete(pickedCategory);
      continue;
    }
    const available = entry.items.filter((item) => !usedItems.has(item));
    if (!available.length) {
      remaining.delete(pickedCategory);
      continue;
    }
    const item = rng.pick(available);
    usedItems.add(item);
    tendencies.push({ category: pickedCategory, item });
    remaining.delete(pickedCategory);
  }

  if (tendencies.length < targetCount) {
    const allRemaining: DecisionTendency[] = [];
    for (const entry of categories) {
      for (const item of entry.items) {
        if (!item || usedItems.has(item)) continue;
        allRemaining.push({ category: entry.category, item });
      }
    }
    while (tendencies.length < targetCount && allRemaining.length) {
      const idx = rng.int(0, allRemaining.length - 1);
      const [entry] = allRemaining.splice(idx, 1);
      if (!entry || usedItems.has(entry.item)) continue;
      usedItems.add(entry.item);
      tendencies.push(entry);
    }
  }

  const result: DecisionStyleResult = {
    tendencies: tendencies.slice(0, targetCount),
  };

  traceSet(trace, 'decisionStyle', result, { method: 'weightedPick', dependsOn: { vocab: 'decisionTemplates' } });
  return result;
}
