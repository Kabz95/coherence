from __future__ import annotations

from typing import Any

from lib.logging import log_event


def get_client(project_id: str):
    from google.cloud import firestore

    return firestore.Client(project=project_id)


def update_run(project_id: str, collection: str, run_id: str, data: dict[str, Any]) -> None:
    try:
        client = get_client(project_id)
        client.collection(collection).document(run_id).set(data, merge=True)
        log_event("firestore.update_run", collection=collection, runId=run_id)
    except Exception as exc:
        log_event("firestore.update_failed", collection=collection, runId=run_id, error=str(exc))


def get_run(project_id: str, collection: str, run_id: str) -> dict[str, Any] | None:
    try:
        snapshot = get_client(project_id).collection(collection).document(run_id).get()
        return snapshot.to_dict() if snapshot.exists else None
    except Exception as exc:
        log_event("firestore.get_failed", collection=collection, runId=run_id, error=str(exc))
        return None
