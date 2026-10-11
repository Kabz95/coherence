from fastapi import FastAPI
from pydantic import BaseModel

from lib.clinical_safety import GENERAL_DISCLAIMER


class HealthResponse(BaseModel):
    status: str
    service: str
    clinicalSafety: str


app = FastAPI(
    title="Coherence Neuro Backend",
    description="Supplementary, non-diagnostic neuroimaging and EEG processing service.",
    version="0.1.0",
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="coherence-neuro-backend",
        clinicalSafety=GENERAL_DISCLAIMER,
    )


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "coherence-neuro-backend",
        "mode": "api",
        "clinicalSafety": GENERAL_DISCLAIMER,
    }
