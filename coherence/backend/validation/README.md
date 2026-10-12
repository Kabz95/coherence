# Real-data validation pack

Runs every Coherence pipeline chain against small **public** neuroimaging /
neurophysiology datasets — the first thing to try before trusting any
measurement the pipelines produce.

## Quick start

From `coherence/backend/`:

```bash
# one-time: backend stack + nilearn (validation-only downloader)
pip install -r requirements.txt nilearn

python validation/real_data_validation.py
```

Datasets download once to `~/coherence-validation-data` (or `~/nilearn_data`,
`~/.dipy`, `~/mne_data` per each library's convention) and are reused on
re-runs. Options:

```bash
python validation/real_data_validation.py --modality fmri   # one chain only
python validation/real_data_validation.py --quick           # skip the slow dMRI fit
```

## What it runs

| Modality | Dataset (public) | Chain |
|---|---|---|
| sMRI | ICBM152 2009a T1 template (nilearn) | converter → qc → structural_prep → structural_analysis → structural_3d_prep → report_builder |
| dMRI | ISBI2013 HARDI phantom64 (dipy) | converter → diffusion_prep → diffusion_analysis → diffusion_3d_prep → report_builder |
| fMRI | SPM auditory MoAEpilot BOLD, 84 vols (nilearn, BIDS) | converter → fmri_ingest → fmri_prep → fmri_analysis → fmri_visualization_prep → report_builder |
| EEG | eegbci S001R01, 64 ch @ 160 Hz (mne / PhysioNet) | eeg_ingest → eeg_prep → eeg_analysis → eeg_visualization_prep → report_builder |
| MEG | somato sub-01 MEG, 306 ch @ 300 Hz cropped to 120 s (mne) | meg_ingest → meg_prep → meg_analysis → meg_visualization_prep → report_builder |

Two harness-authored test fixtures (documented in the script, not the
pipelines): a `bold.json` BIDS sidecar carrying the documented TR=2.0 s
(the MoAEpilot tree ships none), and the 120 s MEG crop for validation speed.

## Reading the report

The script prints a per-modality section and saves
`validation/last_validation_report.md`:

- **Chain status** — every job should read `completed`. Anything else is a bug.
- **Key metrics** — the actual numbers the pipeline produced.
- **Sanity checks** — range checks (e.g. FA in [0,1], TICV in a plausible
  adult range, band powers summing to ~1). A ⚠️ REVIEW flag means "a human
  should look at this", not "the pipeline is wrong" — real data is messy and
  these pipelines are honest approximations.
- **Pipeline warnings** — expected on real data; read them, they describe the
  pipeline's known limitations against this dataset.

This validates **pipeline behavior on real data**, not clinical validity.
Nothing in the outputs is diagnostic, and passing validation does not make
any measurement a biomarker.

## Notes for proxied / sandboxed environments

Dataset downloads go through each library's own downloader. If your network
intercepts TLS (common in sandboxes), Python may need the proxy CA:

```bash
cat "$CURL_CA_BUNDLE" >> "$(python -c 'import certifi; print(certifi.where())')"
```

nilearn also prompts-freezes without `update_path=True` in some loaders —
the script already passes it.
