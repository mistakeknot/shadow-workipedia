export type HealthSummaryInput = {
  chronicConditionTags: string[];
  allergyTags: string[];
  injuryHistoryTags: string[];
  diseaseTags: string[];
  fitnessBand: string;
  treatmentTags: string[];
};

export type HealthSummary = {
  chronic: string;
  allergies: string;
  injuries: string;
  diseases: string;
  fitness: string;
  treatments: string;
};

const DEFAULT_EMPTY = '—';

function joinOrPlaceholder(values: string[], format: (value: string) => string): string {
  if (!values.length) return DEFAULT_EMPTY;
  return values.map(format).join(', ');
}

export function buildHealthSummary(
  health: HealthSummaryInput,
  format: (value: string) => string = (value) => value,
): HealthSummary {
  return {
    chronic: joinOrPlaceholder(health.chronicConditionTags, format),
    allergies: joinOrPlaceholder(health.allergyTags, format),
    injuries: joinOrPlaceholder(health.injuryHistoryTags, format),
    diseases: joinOrPlaceholder(health.diseaseTags, format),
    fitness: health.fitnessBand ? format(health.fitnessBand) : DEFAULT_EMPTY,
    treatments: joinOrPlaceholder(health.treatmentTags, format),
  };
}
