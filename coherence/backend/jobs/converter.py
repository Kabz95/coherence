"""Input conversion: normalize source files into analysis-ready NIfTI.

Supported inputs:
- NIfTI (.nii, .nii.gz): validated, reoriented to RAS, cast to float32.
- DICOM ZIP (.zip): converted with dcm2niix when the binary is available;
  otherwise a best-effort pydicom stacking of axial slices is attempted.
- Single DICOM (.dcm): pydicom read of one slice (warns: single-slice).

Outputs per converted file are written to
`.../outputs/converter/converted/<name>.nii.gz` plus a `conversion.json`
index consumed by downstream jobs.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

from jobs.common import (
    add_safe_evidence,
    binary_available,
    create_manifest,
    input_files_from_run,
    module_available,
)
from jobs.imaging import (
    gcs_prefix,
    load_nifti,
    reorient_to_ras,
    resolve_input_file,
    upload_artifact,
    workspace,
)
from lib.storage import write_json


NIFTI_SUFFIXES = (".nii", ".nii.gz")


def _save_ras_float32(img, out_path: Path) -> Path:
    import nibabel as nib
    import numpy as np

    ras = reorient_to_ras(img)
    data = np.asanyarray(ras.dataobj, dtype=np.float32)
    out = nib.Nifti1Image(data, ras.affine, ras.header)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    nib.save(out, str(out_path))
    return out_path


def _convert_nifti(src: Path, dest: Path) -> dict:
    img, data = load_nifti(src)
    info = {
        "shape": list(data.shape),
        "dtype": str(data.dtype),
        "zooms": [float(z) for z in img.header.get_zooms()[:3]],
    }
    if data.ndim == 4 and data.shape[3] > 1:
        info["note"] = "4D input kept as-is; downstream structural steps use the first volume."
    _save_ras_float32(img, dest)
    return info


def _convert_dicom_zip_dcm2niix(src: Path, dest_dir: Path) -> list[Path]:
    import subprocess

    dest_dir.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["dcm2niix", "-z", "y", "-f", "converted", "-o", str(dest_dir), str(src)],
        capture_output=True,
        text=True,
        timeout=600,
    )
    if result.returncode != 0:
        raise RuntimeError(f"dcm2niix failed: {result.stderr[-2000:]}")
    return sorted(dest_dir.glob("converted*.nii*"))


def _convert_dicom_zip_pydicom(src: Path, dest: Path) -> dict:
    """Best-effort stacking of DICOM slices into a 3D NIfTI."""
    import nibabel as nib
    import numpy as np
    import pydicom

    tmp = dest.parent / "dicom_unpack"
    tmp.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(src) as archive:
        archive.extractall(tmp)

    dicom_files = [p for p in tmp.rglob("*") if p.is_file()]
    slices = []
    for p in dicom_files:
        try:
            ds = pydicom.dcmread(str(p), stop_before_pixels=False)
            if hasattr(ds, "pixel_array"):
                slices.append(ds)
        except Exception:
            continue
    if not slices:
        raise RuntimeError("No readable DICOM pixel data found in the archive.")

    def sort_key(ds):
        pos = getattr(ds, "ImagePositionPatient", [0, 0, 0])
        try:
            return float(pos[2])
        except Exception:
            return 0.0

    slices.sort(key=sort_key)
    volume = np.stack([np.asanyarray(ds.pixel_array, dtype=np.float32) for ds in slices], axis=-1)

    first = slices[0]
    try:
        ipp = [float(x) for x in first.ImagePositionPatient]
        iop = [float(x) for x in first.ImageOrientationPatient]
        spacing = [float(x) for x in first.PixelSpacing]
        row = np.array(iop[0:3]) * spacing[0]
        col = np.array(iop[3:6]) * spacing[1]
        n_slices = len(slices)
        last_ipp = [float(x) for x in slices[-1].ImagePositionPatient]
        normal = (np.array(last_ipp) - np.array(ipp)) / max(n_slices - 1, 1)
        affine = np.eye(4)
        affine[:3, 0], affine[:3, 1], affine[:3, 2] = row, col, normal
        affine[:3, 3] = ipp
    except Exception:
        affine = np.eye(4)

    img = nib.Nifti1Image(volume, affine)
    _save_ras_float32(img, dest)
    return {"slices": len(slices), "method": "pydicom slice stacking (best effort)"}


def run(context) -> object:
    manifest = create_manifest(context.run_id, "converter")
    files = input_files_from_run(context.run_doc)
    manifest.inputs["files"] = [{"name": f.get("name"), "storagePath": f.get("storagePath")} for f in files]

    if not files:
        return manifest.fail("No input files are attached to this run.")

    work = workspace("converter")
    prefix = gcs_prefix(context, "converter")
    converted: list[dict] = []

    for file_meta in files:
        name = str(file_meta.get("name") or "input")
        lower = name.lower()
        try:
            local = resolve_input_file(context, file_meta, work / "inputs")
        except Exception as exc:
            manifest.warnings.append(f"Could not download '{name}': {exc}")
            continue

        try:
            if lower.endswith(NIFTI_SUFFIXES):
                dest = work / "converted" / (Path(name).name.split(".nii")[0] + ".nii.gz")
                info = _convert_nifti(local, dest)
                method = "NIfTI validation + RAS reorientation + float32 cast"
            elif lower.endswith(".zip"):
                dest_dir = work / "converted_zip"
                if binary_available("dcm2niix"):
                    produced = _convert_dicom_zip_dcm2niix(local, dest_dir)
                    if not produced:
                        raise RuntimeError("dcm2niix produced no NIfTI output.")
                    dest = work / "converted" / "converted.nii.gz"
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    produced[0].rename(dest)
                    info = {"method": "dcm2niix"}
                elif module_available("pydicom"):
                    dest = work / "converted" / (Path(name).stem + ".nii.gz")
                    info = _convert_dicom_zip_pydicom(local, dest)
                else:
                    raise RuntimeError("DICOM ZIP input requires dcm2niix or pydicom; neither is available.")
                method = info.get("method", "DICOM to NIfTI conversion")
            elif lower.endswith(".dcm"):
                if not module_available("pydicom"):
                    raise RuntimeError("Single DICOM input requires pydicom.")
                import pydicom
                import nibabel as nib
                import numpy as np

                ds = pydicom.dcmread(str(local))
                data = np.asanyarray(ds.pixel_array, dtype=np.float32)[..., np.newaxis]
                dest = work / "converted" / (Path(name).stem + ".nii.gz")
                _save_ras_float32(nib.Nifti1Image(data, np.eye(4)), dest)
                info = {"note": "Single DICOM slice converted to a one-slice volume."}
                method = "pydicom single-slice conversion"
            else:
                manifest.warnings.append(f"Skipped '{name}': unsupported extension for conversion.")
                continue

            gcs_path = upload_artifact(context, "converter", dest, f"converted/{dest.name}", "application/gzip")
            converted.append({"name": dest.name, "sourceName": name, "gcsPath": gcs_path, **info})
            add_safe_evidence(
                manifest,
                "Input conversion",
                dest.name,
                method,
                "Conversion preserves voxel data; acquisition quality is assessed by the QC job, not here.",
            )
        except Exception as exc:
            manifest.warnings.append(f"Failed to convert '{name}': {exc}")

    if not converted:
        return manifest.fail("No input files could be converted.")

    index = {"convertedFiles": converted}
    write_json(context.config.gcs_bucket, f"{prefix}/conversion.json", index)
    manifest.outputs["conversionJson"] = f"{prefix}/conversion.json"
    manifest.outputs["convertedFiles"] = converted
    manifest.outputs["count"] = len(converted)
    return manifest.complete()
