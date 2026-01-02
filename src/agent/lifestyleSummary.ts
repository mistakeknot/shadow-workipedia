export type EverydayLifeSummaryInput = {
  thirdPlaces: string[];
  commuteMode: string;
  weeklyAnchor: string;
  pettyHabits: string[];
  caregivingObligation: string;
};

export type EverydayLifeSummary = {
  thirdPlaces: string;
  commuteMode: string;
  weeklyAnchor: string;
  pettyHabits: string;
  caregivingObligation: string;
};

export type MemoryTraumaSummaryInput = {
  memoryTags: string[];
  traumaTags: string[];
  triggerPatterns: string[];
  responsePatterns: string[];
};

export type MemoryTraumaSummary = {
  memoryTags: string;
  traumaTags: string;
  triggerPatterns: string;
  responsePatterns: string;
};

const DEFAULT_EMPTY = '—';

function joinOrPlaceholder(values: string[], format: (value: string) => string): string {
  if (!values.length) return DEFAULT_EMPTY;
  return values.map(format).join(', ');
}

export function buildEverydayLifeSummary(
  everyday: EverydayLifeSummaryInput,
  format: (value: string) => string = (value) => value,
): EverydayLifeSummary {
  return {
    thirdPlaces: joinOrPlaceholder(everyday.thirdPlaces, format),
    commuteMode: everyday.commuteMode ? format(everyday.commuteMode) : DEFAULT_EMPTY,
    weeklyAnchor: everyday.weeklyAnchor ? format(everyday.weeklyAnchor) : DEFAULT_EMPTY,
    pettyHabits: joinOrPlaceholder(everyday.pettyHabits, format),
    caregivingObligation: everyday.caregivingObligation ? format(everyday.caregivingObligation) : DEFAULT_EMPTY,
  };
}

export function buildMemoryTraumaSummary(
  memory: MemoryTraumaSummaryInput,
  format: (value: string) => string = (value) => value,
): MemoryTraumaSummary {
  return {
    memoryTags: joinOrPlaceholder(memory.memoryTags, format),
    traumaTags: joinOrPlaceholder(memory.traumaTags, format),
    triggerPatterns: joinOrPlaceholder(memory.triggerPatterns, format),
    responsePatterns: joinOrPlaceholder(memory.responsePatterns, format),
  };
}
