from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from lib.logging import log_event


def get_storage_client():
    from google.cloud import storage

    return storage.Client()


def write_json(bucket_name: str, path: str, payload: dict[str, Any]) -> str:
    try:
        client = get_storage_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(path)
        blob.upload_from_string(
            json.dumps(payload, indent=2, sort_keys=True),
            content_type="application/json",
        )
        uri = f"gs://{bucket_name}/{path}"
        log_event("storage.write_json", uri=uri)
        return uri
    except Exception as exc:
        local_path = Path("local_outputs") / path
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        log_event("storage.write_json.local_fallback", path=str(local_path), error=str(exc))
        return str(local_path)


def download_blob(bucket_name: str, path: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    client = get_storage_client()
    client.bucket(bucket_name).blob(path).download_to_filename(destination)
    return destination


def upload_file(bucket_name: str, source: Path, path: str, content_type: str | None = None) -> str:
    client = get_storage_client()
    blob = client.bucket(bucket_name).blob(path)
    blob.upload_from_filename(source, content_type=content_type)
    uri = f"gs://{bucket_name}/{path}"
    log_event("storage.upload_file", uri=uri)
    return uri
