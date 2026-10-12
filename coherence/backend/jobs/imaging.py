"""Shared imaging utilities for Coherence backend jobs.

All helpers are honest about their methods: they implement standard,
well-understood image operations (reorientation, intensity normalization,
threshold-based masking, slice montages) with numpy/nibabel/scipy. Anything
requiring surface reconstruction or atlas registration is explicitly out of
scope and labelled as such in manifests and evidence items.
"""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")  # headless rendering for Cloud Run Jobs
import matplotlib.pyplot as plt
import numpy as np


def workspace(job_kind: str) -> Path:
    """Create an isolated working directory for one job execution."""
    path = Path(tempfile.mkdtemp(prefix=f"coherence-{job_kind}-"))
    return path


def gcs_prefix(context: Any, job_kind: str) -> str:
    case_id = context.case_id or "unknown-case"
    return f"cases/{case_id}/runs/{context.run_id}/outputs/{job_kind}"


def resolve_input_file(context: Any, file_meta: dict[str, Any], dest_dir: Path) -> Path:
    """Materialize one run input file locally.

    Production path: download from GCS via the file's storagePath.
    Local-dev path: if COHERENCE_LOCAL_INPUTS is set, copy a same-named file
    from that directory instead (used by the offline smoke test).
    """
    from lib.storage import download_blob

    name = str(file_meta.get("name") or "input")
    dest = dest_dir / name

    local_inputs = os.getenv("COHERENCE_LOCAL_INPUTS")
    if local_inputs:
        candidates = [(Path(local_inputs) / name, dest)]
        # The converter may rename files (e.g. bold.nii -> bold.nii.gz);
        # fall back to the pre-conversion source name for local resolution,
        # keeping the real filename so downstream readers see the right
        # extension.
        source_name = file_meta.get("sourceName")
        if source_name and str(source_name) != name:
            candidates.append(
                (Path(local_inputs) / str(source_name), dest_dir / str(source_name))
            )
        for candidate, target in candidates:
            if candidate.exists():
                dest_dir.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(candidate, target)
                return target

    storage_path = str(file_meta.get("storagePath") or "")
    if not storage_path:
        raise FileNotFoundError(f"Input file '{name}' has no storagePath.")
    return download_blob(context.config.gcs_bucket, storage_path, dest)


def upload_artifact(context: Any, job_kind: str, local_path: Path, name: str | None = None, content_type: str | None = None) -> str:
    """Upload one artifact to the job's GCS output prefix.

    Returns the GCS *path* (not a URI) so downstream jobs can re-resolve the
    blob via its storagePath. The full URI is logged by lib.storage.
    """
    from lib.storage import upload_file

    blob_name = name or local_path.name
    dest = f"{gcs_prefix(context, job_kind)}/{blob_name}"
    upload_file(context.config.gcs_bucket, local_path, dest, content_type=content_type)
    return dest


# ---------------------------------------------------------------------------
# NIfTI helpers
# ---------------------------------------------------------------------------

def load_nifti(path: Path):
    import nibabel as nib

    img = nib.load(str(path))
    data = np.asanyarray(img.dataobj)
    return img, data


def reorient_to_ras(img):
    """Reorient an image to RAS orientation (canonical)."""
    import nibabel as nib

    return nib.as_closest_canonical(img)


def voxel_volume_ml(img) -> float:
    zooms = img.header.get_zooms()[:3]
    return float(np.prod(zooms) / 1000.0)


def otsu_threshold(data: np.ndarray, nbins: int = 256) -> float:
    """Otsu's threshold on finite, positive intensities."""
    values = data[np.isfinite(data) & (data > 0)]
    if values.size == 0:
        return 0.0
    hist, edges = np.histogram(values, bins=nbins)
    centers = (edges[:-1] + edges[1:]) / 2.0
    total = values.size
    sum_total = float(np.dot(hist, centers))
    sum_bg, weight_bg, best, thresh = 0.0, 0, 0.0, centers[0]
    for i in range(nbins):
        weight_bg += hist[i]
        if weight_bg == 0:
            continue
        weight_fg = total - weight_bg
        if weight_fg == 0:
            break
        sum_bg += hist[i] * centers[i]
        mean_bg = sum_bg / weight_bg
        mean_fg = (sum_total - sum_bg) / weight_fg
        between = weight_bg * weight_fg * (mean_bg - mean_fg) ** 2
        if between > best:
            best, thresh = between, centers[i]
    return float(thresh)


def rough_brain_mask(data: np.ndarray) -> np.ndarray:
    """Threshold-based brain-ish mask: Otsu + largest connected component + hole fill.

    This is a rough estimate, NOT a segmentation. Suitable for volume
    estimation and QC; not for morphometry claims.
    """
    from scipy import ndimage

    thresh = otsu_threshold(data)
    binary = data > thresh
    labeled, n_labels = ndimage.label(binary)
    if n_labels == 0:
        return np.zeros_like(data, dtype=bool)
    sizes = ndimage.sum(binary, labeled, range(1, n_labels + 1))
    largest = int(np.argmax(sizes)) + 1
    mask = labeled == largest
    mask = ndimage.binary_fill_holes(mask)
    mask = ndimage.binary_closing(mask, structure=np.ones((3, 3, 3)))
    return mask.astype(bool)


def intensity_stats(data: np.ndarray, mask: np.ndarray | None = None) -> dict[str, float]:
    region = data[mask] if mask is not None else data
    region = region[np.isfinite(region)]
    if region.size == 0:
        return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0, "median": 0.0, "voxels": 0}
    return {
        "mean": float(np.mean(region)),
        "std": float(np.std(region)),
        "min": float(np.min(region)),
        "max": float(np.max(region)),
        "median": float(np.median(region)),
        "voxels": int(region.size),
    }


def hemisphere_volumes_ml(mask: np.ndarray, voxel_ml: float) -> dict[str, float]:
    """Split a RAS-oriented mask at the mid-sagittal plane (x = mid)."""
    mid = mask.shape[0] // 2
    left = mask[:mid].sum()
    right = mask[mid:].sum()
    return {
        "leftHemisphereVolumeMl": float(left * voxel_ml),
        "rightHemisphereVolumeMl": float(right * voxel_ml),
    }


# ---------------------------------------------------------------------------
# Cross-job chaining helpers
# ---------------------------------------------------------------------------

def read_json_artifact(ref: str) -> dict:
    """Read a JSON artifact from a gs:// URI or a local path."""
    import json as _json

    if ref.startswith("gs://"):
        from lib.storage import download_blob

        rest = ref[5:]
        bucket, _, path = rest.partition("/")
        tmp = Path(tempfile.mkdtemp(prefix="coherence-artifact-")) / "artifact.json"
        download_blob(bucket, path, tmp)
        return _json.loads(tmp.read_text(encoding="utf-8"))

    local = Path(ref)
    if local.exists():
        import json as _json2

        return _json2.loads(local.read_text(encoding="utf-8"))
    # Offline-test fallback: write_json's local fallback lands under local_outputs/
    offline = Path("local_outputs") / ref
    if offline.exists():
        import json as _json3

        return _json3.loads(offline.read_text(encoding="utf-8"))
    raise FileNotFoundError(f"Artifact not found: {ref}")


def upstream_manifest_outputs(context: Any, job_kind: str) -> dict | None:
    """Return the `outputs` dict of an upstream job's manifest, if available."""
    run_doc = context.run_doc or {}
    outputs = run_doc.get("outputs") or {}
    entry = outputs.get(job_kind) or {}
    ref = entry.get("manifestPath")
    if not ref:
        return None
    try:
        manifest = read_json_artifact(str(ref))
        outs = manifest.get("outputs")
        return outs if isinstance(outs, dict) else None
    except Exception:
        return None


def download_first_matching(context: Any, files: list[dict], suffixes: tuple[str, ...], dest_dir: Path):
    """Download the first input file matching suffixes. Returns (meta, path) or (None, None)."""
    from jobs.common import first_matching_file

    meta = first_matching_file(files, suffixes)
    if meta is None:
        return None, None
    return meta, resolve_input_file(context, meta, dest_dir)


def fetch_artifact(ref: str, dest: Path, bucket: str) -> Path:
    """Fetch an artifact reference (gs:// URI, local path, or bucket-relative path) to dest."""
    from lib.storage import download_blob

    dest.parent.mkdir(parents=True, exist_ok=True)
    if ref.startswith("gs://"):
        rest = ref[5:]
        ref_bucket, _, ref_path = rest.partition("/")
        download_blob(ref_bucket, ref_path, dest)
        return dest
    local = Path(ref)
    if local.exists():
        shutil.copyfile(local, dest)
        return dest
    # Offline-test fallback: upload_file's local fallback lands under local_outputs/
    offline = Path("local_outputs") / ref
    if offline.exists():
        shutil.copyfile(offline, dest)
        return dest
    download_blob(bucket, ref, dest)
    return dest


# ---------------------------------------------------------------------------
# Visualization helpers
# ---------------------------------------------------------------------------

def save_slice_montage(data: np.ndarray, out_path: Path, title: str = "", n_slices: int = 9, cmap: str = "gray") -> Path:
    """Save an axial/coronal/sagittal montage of middle slices."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig, axes = plt.subplots(3, n_slices, figsize=(2.2 * n_slices, 6.6))
    fig.suptitle(title, fontsize=12)
    views = [
        ("axial", lambda d, i: d[:, :, i]),
        ("coronal", lambda d, i: d[:, i, :]),
        ("sagittal", lambda d, i: d[i, :, :]),
    ]
    vmin, vmax = float(np.percentile(data[np.isfinite(data)], 1)), float(np.percentile(data[np.isfinite(data)], 99))
    for row, (label, slicer) in enumerate(views):
        axis_len = data.shape[2 - row] if row == 0 else (data.shape[1] if row == 1 else data.shape[0])
        idx = np.linspace(axis_len * 0.25, axis_len * 0.75, n_slices).astype(int)
        for col, k in enumerate(idx):
            ax = axes[row, col]
            ax.imshow(np.rot90(slicer(data, int(k))), cmap=cmap, vmin=vmin, vmax=vmax)
            ax.axis("off")
            if col == 0:
                ax.set_ylabel(label, fontsize=9)
    fig.tight_layout()
    fig.savefig(out_path, dpi=110, bbox_inches="tight")
    plt.close(fig)
    return out_path


def save_trace_plot(times: np.ndarray, signals: np.ndarray, channel_names: list[str], out_path: Path, title: str = "") -> Path:
    """Save a multi-channel trace plot (signals: n_channels x n_times)."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    n_channels = min(signals.shape[0], 12)
    fig, axes = plt.subplots(n_channels, 1, figsize=(12, 1.6 * n_channels), sharex=True)
    if n_channels == 1:
        axes = [axes]
    for i in range(n_channels):
        axes[i].plot(times, signals[i], linewidth=0.6)
        axes[i].set_ylabel(channel_names[i] if i < len(channel_names) else f"ch{i}", fontsize=8)
        axes[i].tick_params(labelsize=7)
    axes[-1].set_xlabel("Time (s)", fontsize=9)
    fig.suptitle(title, fontsize=12)
    fig.tight_layout()
    fig.savefig(out_path, dpi=110, bbox_inches="tight")
    plt.close(fig)
    return out_path


def save_spectrogram_plot(spectra: np.ndarray, freqs: np.ndarray, out_path: Path, title: str = "") -> Path:
    """Save a mean power-spectral-density plot (spectra: n_channels x n_freqs)."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(10, 5))
    mean_psd = np.mean(spectra, axis=0)
    ax.semilogy(freqs, mean_psd)
    ax.set_xlabel("Frequency (Hz)")
    ax.set_ylabel("Power spectral density")
    ax.set_title(title or "Mean power spectral density")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=110, bbox_inches="tight")
    plt.close(fig)
    return out_path
