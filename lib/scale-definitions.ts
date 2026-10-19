/**
 * Canonical definitions for validated symptom-scale instruments.
 *
 * Definitions are data, reviewed before any change: item wording, response
 * options, and scoring rules must never be modified casually, because every
 * recorded score depends on them being exactly what the instrument specifies.
 *
 * LICENSING (verified 2026-10-19):
 * - PHQ-9: Copyright Pfizer Inc. Developed by Drs. Robert L. Spitzer,
 *   Janet B.W. Williams, Kurt Kroenke and colleagues. No permission is
 *   required to reproduce, translate, display or distribute. Item wording
 *   below is unmodified; the copyright notice is retained.
 * - GAD-7: Copyright Pfizer Inc. Developed by Drs. Robert L. Spitzer,
 *   Janet B.W. Williams, Kurt Kroenke and colleagues. No permission is
 *   required to reproduce, translate, display or distribute. Item wording
 *   below is unmodified; the copyright notice is retained.
 */

export interface ScaleResponseOption {
  value: number;
  label: string;
}

export interface ScaleItem {
  /** Stable item number, 1-based, as printed on the instrument. */
  number: number;
  text: string;
}

export interface ScaleDefinition {
  id: string;
  /** Short name used as the scale key on recorded entries, e.g. "PHQ-9". */
  name: string;
  fullName: string;
  version: string;
  /** The instrument stem, shown above the items. */
  stem: string;
  items: ScaleItem[];
  responseOptions: ScaleResponseOption[];
  licensingNote: string;
  copyrightNotice: string;
}

const COMMON_RESPONSES: ScaleResponseOption[] = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
];

const PHQ9_ITEMS: string[] = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead or of hurting yourself in some way",
];

const GAD7_ITEMS: string[] = [
  "Feeling nervous, anxious or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
];

function toItems(texts: string[]): ScaleItem[] {
  return texts.map((text, index) => ({ number: index + 1, text }));
}

export const SCALE_DEFINITIONS: readonly ScaleDefinition[] = [
  {
    id: "phq-9",
    name: "PHQ-9",
    fullName: "Patient Health Questionnaire-9",
    version: "original",
    stem: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
    items: toItems(PHQ9_ITEMS),
    responseOptions: COMMON_RESPONSES,
    licensingNote:
      "No permission required to reproduce, translate, display or distribute. Free for clinical, research, and educational use.",
    copyrightNotice: "Copyright © Pfizer Inc. All rights reserved. Developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues.",
  },
  {
    id: "gad-7",
    name: "GAD-7",
    fullName: "Generalized Anxiety Disorder-7",
    version: "original",
    stem: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
    items: toItems(GAD7_ITEMS),
    responseOptions: COMMON_RESPONSES,
    licensingNote:
      "No permission required to reproduce, translate, display or distribute. Free for clinical, research, and educational use.",
    copyrightNotice: "Copyright © Pfizer Inc. All rights reserved. Developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues.",
  },
] as const;

export function getScaleDefinition(name: string): ScaleDefinition | undefined {
  return SCALE_DEFINITIONS.find((definition) => definition.name === name);
}

/** Sum of answered items; every item uses its response-option value directly. */
export function computeTotal(definition: ScaleDefinition, responses: Array<number | null | undefined>): number {
  return definition.items.reduce((sum, item, index) => sum + (responses[index] ?? 0), 0);
}

export function maxTotal(definition: ScaleDefinition): number {
  const top = Math.max(...definition.responseOptions.map((option) => option.value));
  return top * definition.items.length;
}
