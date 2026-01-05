import type {
  AgentGenerationTraceV1,
  AgentVocabV1,
  Latents,
  PhysicalDetailCategory,
  PhysicalDetailItem,
} from '../types';
import { clampInt, facetSeed, makeRng, traceFacet, traceSet, uniqueStrings, weightedPick } from '../utils';
import type { Aptitudes } from './aptitudes';

const DEFAULT_DETAIL_COUNT_RANGE: readonly [number, number] = [3, 5];

type DetailPool = {
  category: PhysicalDetailCategory;
  items: string[];
  weight: number;
};

function collectPool(primary?: string[], extra?: string[]): string[] {
  return uniqueStrings([...(primary ?? []), ...(extra ?? [])]);
}

export function computePhysicalDetails(
  seed: string,
  vocab: AgentVocabV1,
  latents: Latents,
  aptitudes: Aptitudes,
  age: number,
  roleSeedTags: readonly string[],
  trace?: AgentGenerationTraceV1,
): PhysicalDetailItem[] {
  traceFacet(trace, seed, 'physicalDetails');
  const rng = makeRng(facetSeed(seed, 'physicalDetails'));

  const detailVocab = vocab.physicalDetails ?? {};
  const face = collectPool(detailVocab.faceStructure);
  const eyes = collectPool(detailVocab.eyeDetails);
  const hair = collectPool(detailVocab.hairDetails);
  const build = collectPool(detailVocab.bodyBuild);
  const posture = collectPool(detailVocab.postureMovement);
  const mods = collectPool(detailVocab.bodyMods);
  const scars = collectPool(detailVocab.scarsInjuries);
  const sensory = collectPool(detailVocab.sensoryLimits);
  const fitness = collectPool(detailVocab.fitnessMarkers);

  const roleSet = new Set(roleSeedTags);
  const securityRole = roleSet.has('security') || roleSet.has('operative');

  const age01 = Math.max(0, Math.min(1, (age - 30) / 30));
  const conditioning01 = latents.physicalConditioning / 1000;
  const express01 = latents.aestheticExpressiveness / 1000;
  const risk01 = aptitudes.riskCalibration / 1000;

  const pools: DetailPool[] = [
    { category: 'face', items: face, weight: 1.0 },
    { category: 'eyes', items: eyes, weight: 1.0 },
    { category: 'hair', items: hair, weight: 1.0 },
    { category: 'build', items: build, weight: 0.9 + 0.4 * conditioning01 },
    { category: 'posture', items: posture, weight: 0.9 + 0.3 * conditioning01 + (securityRole ? 0.3 : 0) },
    { category: 'mods', items: mods, weight: 0.6 + 0.5 * express01 },
    { category: 'scars', items: scars, weight: 0.6 + 0.7 * age01 + (securityRole ? 0.4 : 0) },
    { category: 'sensory', items: sensory, weight: 0.5 + 0.8 * age01 },
    { category: 'fitness', items: fitness, weight: 0.7 + 0.8 * conditioning01 + 0.2 * risk01 },
  ];
  const filteredPools = pools.filter((entry) => entry.items.length);

  const targetCount = clampInt(rng.int(DEFAULT_DETAIL_COUNT_RANGE[0], DEFAULT_DETAIL_COUNT_RANGE[1]), 3, 5);
  const picks: PhysicalDetailItem[] = [];
  const usedItems = new Set<string>();

  const pickFromCategory = (category: PhysicalDetailCategory, items: string[]): void => {
    if (!items.length || picks.length >= targetCount) return;
    const available = items.filter((item) => !usedItems.has(item));
    if (!available.length) return;
    const item = rng.pick(available);
    usedItems.add(item);
    picks.push({ category, item });
  };

  pickFromCategory('eyes', eyes.length ? eyes : face);
  if (picks.length < targetCount) {
    pickFromCategory('hair', hair.length ? hair : face);
  }
  if (picks.length < targetCount) {
    pickFromCategory('posture', posture.length ? posture : build);
  }

  const remaining = new Map<PhysicalDetailCategory, DetailPool>();
  for (const pool of filteredPools) {
    remaining.set(pool.category, pool);
  }

  while (picks.length < targetCount && remaining.size) {
    const options = [...remaining.values()].map((pool) => ({
      item: pool.category,
      weight: Math.max(0.15, pool.weight),
    }));
    const pickedCategory = weightedPick(rng, options) as PhysicalDetailCategory;
    const pool = remaining.get(pickedCategory);
    if (!pool) {
      remaining.delete(pickedCategory);
      continue;
    }
    const available = pool.items.filter((item) => !usedItems.has(item));
    if (!available.length) {
      remaining.delete(pickedCategory);
      continue;
    }
    const item = rng.pick(available);
    usedItems.add(item);
    picks.push({ category: pool.category, item });
    remaining.delete(pickedCategory);
  }

  const result = picks.slice(0, targetCount);
  traceSet(trace, 'physicalDetails', result, { method: 'weightedPick', dependsOn: { vocab: 'physicalDetails' } });
  return result;
}
