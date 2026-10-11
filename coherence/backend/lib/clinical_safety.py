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


def report_interpretation_statement() -> str:
    return (
        "This report is a structured, non-diagnostic summary of available measurements, "
        "quality-control flags, and comparison across timepoints. Any possible correlate "
        "requires clinical interpretation and should be weighed with measurement uncertainty."
    )


def check_copy_safety(text: str) -> list[str]:
    """Return forbidden diagnostic-sounding phrases found in generated copy."""
    lowered = text.lower()
    return [phrase for phrase in FORBIDDEN_CLAIMS if phrase in lowered]


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
