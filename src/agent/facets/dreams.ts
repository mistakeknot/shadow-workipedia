import type { GoalType, FearType } from '../types';
import type { Rng } from '../utils';
import { uniqueStrings, weightedPickKUnique } from '../utils';

export type DreamWeightContext = {
  primaryGoal: GoalType;
  secondaryGoals: GoalType[];
  fears: FearType[];
  roleSeedTags: readonly string[];
  age: number;
  publicness01: number;
  principled01: number;
  stress01: number;
  opsec01: number;
  conscientious01: number;
  risk01: number;
};

const GOAL_KEYWORDS: Record<GoalType, string[]> = {
  career: ['career', 'promotion', 'rank', 'assignment', 'agency', 'post'],
  financial: ['wealth', 'money', 'poverty', 'resources', 'rich'],
  relational: ['family', 'child', 'children', 'father', 'mother', 'marry', 'relationship', 'understand', 'love', 'reconciliation'],
  creative: ['create', 'write', 'build', 'invent', 'original', 'story'],
  legacy: ['legacy', 'outlast', 'posterity', 'next generation', 'culture survives', 'remember'],
  security: ['safety', 'secure', 'stability', 'safe', 'no missions', 'peaceful', 'without fear'],
  freedom: ['freedom', 'escape', 'free', 'normal life', 'no missions'],
  mastery: ['master', 'perfect', 'definitive', 'manual', 'tactics', 'technique', 'skill', 'sniper', 'encryption', 'surveillance'],
  recognition: ['respect', 'recognition', 'legend', 'famous', 'story told', 'named after', 'honor'],
  service: ['protect', 'save', 'help', 'mentor', 'teach', 'sacrifice', 'unity', 'democracy', 'eliminate poverty'],
};

const FEAR_KEYWORDS: Record<FearType, string[]> = {
  failure: ['forgetting', 'unprepared', 'objective', 'equipment', 'jam', 'deteriorating'],
  exposure: ['face', 'screen', 'password', 'documents', 'cover identity', 'everyone staring', 'watchers'],
  abandonment: ['empty chairs', 'vanishing', 'alone', 'no doors'],
  'loss-of-control': ['cannot move', 'slipping', 'smoke', 'no sound', 'ground gives way'],
  irrelevance: ['disappointment', 'ignored'],
  poverty: ['scarcity', 'empty', 'no resources'],
  violence: ['firefight', 'bullets', 'weapon', 'attack', 'blood'],
  humiliation: ['courtroom', 'judged', 'everyone staring', 'disappointment'],
  betrayal: ['friends', 'allies', 'reporting', 'faces shifting', 'betrayal'],
  mortality: ['dead', 'funerals', 'bodies', 'deceased'],
};

const ROLE_KEYWORDS: Array<[string, string[]]> = [
  ['operative', ['combat', 'sniper', 'tradecraft', 'mission', 'firefight']],
  ['analyst', ['encryption', 'surveillance', 'manual', 'intelligence']],
  ['security', ['safe house', 'security', 'counter-surveillance', 'defense']],
];

const EFFECT_LINE = /^[+-]\d/;

const includesAny = (text: string, keywords: string[]): boolean => {
  const lower = text.toLowerCase();
  return keywords.some(keyword => lower.includes(keyword));
};

const weightByGoals = (text: string, goals: GoalType[], bonus: number): number => (
  goals.reduce((acc, goal) => (includesAny(text, GOAL_KEYWORDS[goal]) ? acc + bonus : acc), 0)
);

const weightByFears = (text: string, fears: FearType[], bonus: number): number => (
  fears.reduce((acc, fear) => (includesAny(text, FEAR_KEYWORDS[fear]) ? acc + bonus : acc), 0)
);

const roleKeywordBoost = (text: string, roleSeedTags: readonly string[]): number => {
  let boost = 0;
  for (const [tag, keywords] of ROLE_KEYWORDS) {
    if (roleSeedTags.includes(tag) && includesAny(text, keywords)) {
      boost += 0.8;
    }
  }
  return boost;
};

const sanitizedWeight = (text: string, weight: number): number => {
  if (EFFECT_LINE.test(text) || text.includes('%')) {
    return Math.max(0.15, weight * 0.2);
  }
  return Math.max(0.15, weight);
};

const pickAnchoredItems = (
  rng: Rng,
  pool: string[],
  anchors: string[],
  weightFn: (item: string) => number,
  count: number,
): string[] => {
  if (!pool.length || count <= 0) return [];
  const selected: string[] = [];
  if (anchors.length) {
    selected.push(rng.pick(anchors));
  }
  const remaining = pool.filter(item => !selected.includes(item));
  const remainingCount = Math.min(count - selected.length, remaining.length);
  if (remainingCount > 0) {
    const weighted = remaining.map(item => ({ item, weight: weightFn(item) }));
    selected.push(...weightedPickKUnique(rng, weighted, remainingCount));
  }
  return uniqueStrings(selected);
};

export function pickMotivationDreams(
  rng: Rng,
  pool: string[],
  context: DreamWeightContext,
  count: number,
): string[] {
  const anchors = pool.filter(item => includesAny(item, GOAL_KEYWORDS[context.primaryGoal]));
  const weightFn = (item: string) => {
    let w = 1;
    w += weightByGoals(item, [context.primaryGoal], 2.4);
    w += weightByGoals(item, context.secondaryGoals, 1.1);
    w += weightByFears(item, context.fears, 0.8);
    w += roleKeywordBoost(item, context.roleSeedTags);
    if (context.publicness01 > 0.6 && includesAny(item, GOAL_KEYWORDS.recognition)) w += 0.6;
    if (context.age > 45 && includesAny(item, GOAL_KEYWORDS.legacy)) w += 0.5;
    if (context.principled01 > 0.7 && includesAny(item, GOAL_KEYWORDS.service)) w += 0.5;
    if (context.stress01 > 0.6 && includesAny(item, ['atone', 'forgive', 'sins', 'balance'])) w += 0.6;
    return sanitizedWeight(item, w);
  };
  return pickAnchoredItems(rng, pool, anchors, weightFn, count);
}

export function pickDreamImagery(
  rng: Rng,
  pool: string[],
  context: DreamWeightContext,
  count: number,
): string[] {
  const anchors = pool.filter(item => includesAny(item, GOAL_KEYWORDS[context.primaryGoal]));
  const weightFn = (item: string) => {
    let w = 1;
    w += weightByGoals(item, [context.primaryGoal], 1.6);
    w += weightByGoals(item, context.secondaryGoals, 0.8);
    w += roleKeywordBoost(item, context.roleSeedTags);
    if (context.stress01 > 0.6 && includesAny(item, ['peaceful', 'normal', 'family', 'comfort'])) w += 0.6;
    if (context.stress01 < 0.4 && includesAny(item, ['mission', 'defeating', 'saving', 'skills'])) w += 0.4;
    return Math.max(0.15, w);
  };
  return pickAnchoredItems(rng, pool, anchors, weightFn, count);
}

export function pickNightmareImagery(
  rng: Rng,
  pool: string[],
  context: DreamWeightContext,
  count: number,
): string[] {
  const fearAnchor = context.fears[0];
  const anchors = fearAnchor ? pool.filter(item => includesAny(item, FEAR_KEYWORDS[fearAnchor])) : [];
  const weightFn = (item: string) => {
    let w = 1;
    w += weightByFears(item, context.fears, 1.6);
    w += roleKeywordBoost(item, context.roleSeedTags);
    if (context.opsec01 > 0.6 && includesAny(item, ['watchers', 'hunters', 'screens'])) w += 0.6;
    if (context.stress01 > 0.6 && includesAny(item, ['guilt', 'judged', 'blood'])) w += 0.5;
    return Math.max(0.15, w);
  };
  return pickAnchoredItems(rng, pool, anchors, weightFn, count);
}
