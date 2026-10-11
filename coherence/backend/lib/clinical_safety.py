GENERAL_DISCLAIMER = (
    "Coherence provides supplementary, non-diagnostic neuroimaging and neurophysiology summaries for clinician review. "
    "It does not establish, confirm, predict, or rule out any DSM or ICD diagnosis. Outputs must be interpreted alongside "
    "clinical history, psychiatric assessment, symptom scales, functional outcomes, and clinician judgment."
)

FORBIDDEN_CLAIMS = (
    "diagnoses",
    "predicts",
    "confirms",
    "rules out",
    "detects mental illness",
)


def evidence_item(source: str, value: str, method: str, limitations: str, unit: str | None = None) -> dict:
    item = {
        "source": source,
        "value": value,
        "method": method,
        "limitations": limitations,
    }
    if unit:
        item["unit"] = unit
    return item
