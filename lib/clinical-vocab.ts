/**
 * Versioned clinical vocabularies for structured case-level capture.
 *
 * DRAFT — pending clinical review and approval before use in production.
 * Vocabulary changes silently alter every timeline label, filter, and
 * aggregate built on these terms, so additions require clinical review.
 */

/** Bump when the curated lists below change; recorded wherever terms are stored. */
export const CLINICAL_VOCAB_VERSION = "2026-10-19-draft";

/**
 * Curated diagnosis categories for the case-level multi-select.
 * Deliberately short: a full classification runs to hundreds of items and
 * will not be scrolled. Comorbidity is the norm, so selection is multi.
 * Anything not listed goes through the free-text "other" field.
 * DRAFT list — the initial scope is subject to clinician approval.
 */
export const DIAGNOSIS_OPTIONS: readonly string[] = [
  "Major depressive disorder",
  "Persistent depressive disorder",
  "Bipolar I disorder",
  "Bipolar II disorder",
  "Generalized anxiety disorder",
  "Panic disorder",
  "Social anxiety disorder",
  "Obsessive-compulsive disorder",
  "Post-traumatic stress disorder",
  "Attention-deficit/hyperactivity disorder",
  "Autism spectrum disorder",
  "Schizophrenia",
  "Schizoaffective disorder",
  "Borderline personality disorder",
  "Anorexia nervosa",
  "Bulimia nervosa",
  "Binge-eating disorder",
  "Substance use disorder",
  "Insomnia disorder",
  "Epilepsy",
  "Parkinson's disease",
  "Multiple sclerosis",
  "Traumatic brain injury",
  "Major neurocognitive disorder",
  "Migraine",
] as const;

/**
 * Common psychiatric/neurological medications offered as type-ahead
 * suggestions. Free text is always allowed — this list standardises common
 * entries without blocking uncommon ones. DRAFT list — pending approval.
 */
export const COMMON_MEDICATIONS: readonly string[] = [
  "Sertraline",
  "Escitalopram",
  "Fluoxetine",
  "Paroxetine",
  "Citalopram",
  "Venlafaxine",
  "Duloxetine",
  "Desvenlafaxine",
  "Bupropion",
  "Mirtazapine",
  "Trazodone",
  "Vortioxetine",
  "Aripiprazole",
  "Quetiapine",
  "Olanzapine",
  "Risperidone",
  "Lurasidone",
  "Lithium",
  "Lamotrigine",
  "Valproate",
  "Methylphenidate",
  "Lisdexamfetamine",
  "Atomoxetine",
  "Guanfacine",
  "Lorazepam",
  "Clonazepam",
  "Zopiclone",
  "Propranolol",
] as const;
