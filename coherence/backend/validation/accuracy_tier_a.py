"""Tier A accuracy-axis checks for the Coherence backend pipelines.

Accuracy = agreement with ground truth or independent implementations
(distinct from test-retest reliability). All checks are PRELIMINARY
engineering validation; nothing here is clinical validation.

Checks (see accuracy_tier_a_report.md for design, bars, and results):
  B1a: DTI tensor-fit accuracy vs SYNTHETIC ground truth (known tensors,
       dipy.sims.voxel.single_tensor on the phantom64 gradient table).
  B1b: tensor fit on the ISBI2013 phantom64; bundle-core FA/MD vs the
       documented single-fiber simulation reference range. (The challenge's
       published ground truth covers fiber geometries, not DTI scalars,
       so no strict per-ROI bar applies.)
  B2 : DTI cross-implementation: pipeline DIPY WLS fit vs from-scratch
       NumPy linearized fit (Basser et al. 1994) on ds000114 sub-01 DWI.
  C2 : fMRI independent recomputation: tSNR/DVARS from raw BOLD and
       ALFF/fALFF from the pipeline's denoised BOLD (ds000114 sub-01),
       vs the pipeline's reported values.
  D  : EEG/MEG band powers: from-scratch reimplementation + MNE
       psd_array_welch cross-check vs pipeline-reported band powers.

Usage (from backend/):  python validation/accuracy_tier_a.py [--check b1a|b1b|b2|c2|d]
Requires the backend scientific stack (dipy, mne, nibabel, scipy).
Reads cached validation data; writes nothing except stdout.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

HOME = Path.home()
DIPY_ISBI = HOME / ".dipy/isbi2013/phantom64"
ONV = HOME / "coherence-validation-data/openneuro"
LOCAL_OUT = BACKEND_ROOT / "local_outputs/cases/validation-case/runs"

BANDS = {"delta": (1.0, 4.0), "theta": (4.0, 8.0), "alpha": (8.0, 13.0),
         "beta": (13.0, 30.0), "gamma": (30.0, 40.0)}


def _fa_of(evals):
    import numpy as np
    e = np.asarray(evals, float)
    m = e.mean()
    return float(np.sqrt(1.5) * np.sqrt(((e - m) ** 2).sum()) / np.sqrt((e ** 2).sum()))


def check_b1a():
    """Synthetic DTI ground truth.

    10 Rician-noise realizations (SNR 30) per ground-truth tensor; bars
    apply to the MEAN error: |mean dFA| <= 0.05, |mean dMD| <= 10%.
    (A single noise draw is luck; the mean tests systematic bias.)
    """
    import numpy as np
    from dipy.core.gradients import gradient_table
    from dipy.io.gradients import read_bvals_bvecs
    from dipy.reconst.dti import TensorModel
    from dipy.sims.voxel import single_tensor

    np.random.seed(0)  # belt-and-braces; noise rng is passed explicitly below
    bvals, bvecs = read_bvals_bvecs(str(DIPY_ISBI) + ".bval", str(DIPY_ISBI) + ".bvec")
    gtab = gradient_table(bvals=bvals, bvecs=bvecs)
    rng = np.random.default_rng(0)
    cases = [(1.6e-3, 0.25e-3), (1.4e-3, 0.35e-3), (1.2e-3, 0.45e-3),
             (1.0e-3, 0.55e-3), (0.9e-3, 0.65e-3), (1.7e-3, 0.20e-3)]
    fails = 0
    for ci, (ad, rd) in enumerate(cases):
        evals = (ad, rd, rd)
        tfa, tmd = _fa_of(evals), np.mean(evals)
        dfa, dmd = [], []
        for rep in range(10):
            theta, phi = rng.uniform(0, np.pi), rng.uniform(0, 2 * np.pi)
            pdir = np.array([np.sin(theta) * np.cos(phi), np.sin(theta) * np.sin(phi), np.cos(theta)])
            tmp = np.array([0., 0., 1.]) if abs(pdir[2]) < 0.9 else np.array([0., 1., 0.])
            e2 = np.cross(pdir, tmp); e2 /= np.linalg.norm(e2)
            evecs = np.stack([pdir, e2, np.cross(pdir, e2)])
            nrng = np.random.default_rng(1000 * ci + rep)  # deterministic noise
            sig = single_tensor(gtab, S0=1000.0, evals=evals, evecs=evecs, snr=30, rng=nrng)
            fit = TensorModel(gtab).fit(sig[np.newaxis, np.newaxis, np.newaxis, :])
            dfa.append(float(np.nan_to_num(fit.fa)[0, 0, 0]) - tfa)
            dmd.append(100 * (float(np.nan_to_num(fit.md)[0, 0, 0]) - tmd) / tmd)
        mfa, sfa, mmd, smd = np.mean(dfa), np.std(dfa), np.mean(dmd), np.std(dmd)
        ok = abs(mfa) <= 0.05 and abs(mmd) <= 10
        fails += not ok
        print(f"  true FA {tfa:.4f}: mean dFA {mfa:+.4f} +/- {sfa:.4f}; "
              f"mean dMD {mmd:+.2f}% +/- {smd:.2f}% {'PASS' if ok else 'FAIL'}")
    print(f"B1a: {len(cases)-fails}/{len(cases)} mean-errors within bars")


def check_b1b():
    """ISBI2013 phantom bundle cores vs single-fiber reference range."""
    import numpy as np
    import nibabel as nib
    from dipy.core.gradients import gradient_table
    from dipy.io.gradients import read_bvals_bvecs
    from dipy.reconst.dti import TensorModel
    from scipy import ndimage

    img = nib.load(str(DIPY_ISBI) + ".nii.gz")
    data = np.asanyarray(img.dataobj, dtype=np.float64)
    bvals, bvecs = read_bvals_bvecs(str(DIPY_ISBI) + ".bval", str(DIPY_ISBI) + ".bvec")
    gtab = gradient_table(bvals=bvals, bvecs=bvecs)
    pmask = data[..., 0] > data[..., 0].max() * 0.01
    fit = TensorModel(gtab).fit(data, mask=pmask)
    fa = np.nan_to_num(fit.fa); md = np.nan_to_num(fit.md)
    lab, n = ndimage.label((fa > 0.6) & pmask)
    sizes = ndimage.sum((fa > 0.6) & pmask, lab, range(1, n + 1))
    core = np.isin(lab, np.where(sizes > 50)[0] + 1)
    print(f"B1b: bundle cores (n={core.sum()}): FA {fa[core].mean():.4f} +/- {fa[core].std():.4f}, "
          f"MD {md[core].mean()*1e3:.4f}e-3 (reference range FA ~0.7-0.9)")


def check_b2():
    """DIPY WLS vs from-scratch Basser-1994 linearized fit. Bar: r >= 0.95."""
    import numpy as np
    import nibabel as nib
    from dipy.core.gradients import gradient_table
    from dipy.io.gradients import read_bvals_bvecs
    from dipy.reconst.dti import TensorModel, fractional_anisotropy, mean_diffusivity

    dd = ONV / "ds000114"
    data = np.asanyarray(nib.load(dd / "sub-01_ses-test_dwi.nii.gz").dataobj, dtype=np.float64)
    bvals, bvecs = read_bvals_bvecs(dd / "dwi.bval", dd / "dwi.bvec")
    gtab = gradient_table(bvals=bvals, bvecs=bvecs)
    b0 = data[..., gtab.b0s_mask].mean(axis=3)
    mask = b0 > np.percentile(b0[b0 > 0], 50)
    fit = TensorModel(gtab).fit(data, mask=mask)
    fa_r = np.nan_to_num(fit.fa)[mask]; md_r = np.nan_to_num(fit.md)[mask]
    b, g = gtab.bvals[~gtab.b0s_mask], gtab.bvecs[~gtab.b0s_mask]
    S0 = b0[mask]
    with np.errstate(divide="ignore", invalid="ignore"):
        y = np.log(np.clip(data[mask][:, ~gtab.b0s_mask] / S0[:, None], 1e-9, None))
    X = np.stack([b*g[:, 0]**2, b*g[:, 1]**2, b*g[:, 2]**2,
                  2*b*g[:, 0]*g[:, 1], 2*b*g[:, 0]*g[:, 2], 2*b*g[:, 1]*g[:, 2]], axis=1)
    Dv, *_ = np.linalg.lstsq(X, y.T, rcond=None); Dv = -Dv
    Dt = np.zeros((Dv.shape[1], 3, 3))
    Dt[:, 0, 0], Dt[:, 1, 1], Dt[:, 2, 2] = Dv[0], Dv[1], Dv[2]
    Dt[:, 0, 1] = Dt[:, 1, 0] = Dv[3]; Dt[:, 0, 2] = Dt[:, 2, 0] = Dv[4]
    Dt[:, 1, 2] = Dt[:, 2, 1] = Dv[5]
    ev = np.clip(np.linalg.eigvalsh(Dt)[:, ::-1], 0, None)
    fa_i, md_i = fractional_anisotropy(ev), mean_diffusivity(ev)
    wm = fa_r > 0.2
    for name, a, bb in [("FA", fa_r[wm], fa_i[wm]), ("MD", md_r[wm], md_i[wm])]:
        r = float(np.corrcoef(a, bb)[0, 1])
        print(f"B2 WM {name}: r={r:.4f} {'PASS' if r >= 0.95 else 'FAIL'}")


def check_c2():
    """Independent fMRI metric recomputation vs pipeline values."""
    import numpy as np
    import nibabel as nib

    raw = np.asanyarray(nib.load(
        ONV / "ds000114/sub-01_ses-test_task-fingerfootlips_bold.nii.gz").dataobj, dtype=np.float64)
    run = LOCAL_OUT / "onv-fmri-15/outputs"
    den = np.asanyarray(nib.load(run / "fmri_prep/denoised-bold.nii.gz").dataobj, dtype=np.float64)
    TR = 2.5
    # tSNR / DVARS on raw (pipeline mask convention: rough mask of mean bold)
    import sys as _s; _s.path.insert(0, str(BACKEND_ROOT))
    from jobs.imaging import rough_brain_mask
    m = rough_brain_mask(raw.mean(axis=3).astype(np.float32))
    v = raw[m]
    tsnr = float(np.median(v.mean(axis=1) / (v.std(axis=1) + 1e-9)))
    dv = np.sqrt((np.diff(v, axis=1) ** 2).mean(axis=0))
    spk = int((dv > dv.median() + 3 * dv.std()).sum())
    print(f"C2 tSNR: pipeline 31.14 | indep {tsnr:.2f} "
          f"{'PASS' if abs(tsnr-31.14)/31.14 <= 0.05 else 'FAIL'}")
    print(f"C2 DVARS spikes: pipeline 2 | indep {spk} {'PASS' if spk == 2 else 'FAIL'}")
    # fALFF on denoised (pipeline mask convention: nonzero voxels)
    am = np.abs(den).sum(axis=3) > 0
    vx = den[am]; nv = vx.shape[1]
    fr = np.fft.rfftfreq(nv, d=TR); sp = np.abs(np.fft.rfft(vx, axis=1))
    bd = (fr >= 0.01) & (fr <= 0.08)
    faf = float((sp[:, bd].sum(axis=1) / (sp.sum(axis=1) + 1e-9)).mean())
    print(f"C2 fALFF: pipeline 0.1007 | indep {faf:.4f} "
          f"{'PASS' if abs(faf-0.1007)/0.1007 <= 0.05 else 'FAIL'} "
          f"(whole-volume mean convention; see report)")


def check_d():
    """EEG/MEG band powers: reimplementation + MNE cross-check. Bar: +/-1%."""
    import numpy as np
    from scipy import signal

    targets = {
        "eeg": (LOCAL_OUT / "val-eeg/outputs/eeg_prep/preprocessed-eeg.npz",
                {"delta": 0.584, "theta": 0.1572, "alpha": 0.112, "beta": 0.1246, "gamma": 0.0221}),
        "meg": (LOCAL_OUT / "val-meg/outputs/meg_prep/preprocessed-meg.npz",
                {"delta": 0.178, "theta": 0.1539, "alpha": 0.3968, "beta": 0.246, "gamma": 0.0252}),
    }
    for mod, (path, rep) in targets.items():
        z = np.load(path, allow_pickle=True)
        data, sfreq = z["data"].astype(float), float(z["sfreq"])
        f1, p1 = signal.welch(data, fs=sfreq, nperseg=min(1024, data.shape[1]), axis=1)
        from mne.time_frequency import psd_array_welch
        p2, f2 = psd_array_welch(data, sfreq=sfreq, fmin=0, fmax=sfreq/2,
                                 n_fft=1024, n_overlap=512, window="hann", verbose=False)
        worst = 0
        for (f, p) in [(f1, p1), (f2, p2)]:
            tot = p[:, (f >= 1.0) & (f < 40.0)].sum(axis=1, keepdims=True)
            for bnd, (lo, hi) in BANDS.items():
                v = float((p[:, (f >= lo) & (f < hi)].sum(axis=1) / np.where(tot > 0, tot, 1e-300)[:, 0]).mean())
                worst = max(worst, abs(v - rep[bnd]) / rep[bnd])
        print(f"D {mod}: worst rel.diff {worst*100:.3f}% {'PASS' if worst <= 0.01 else 'FAIL'}")


CHECKS = {"b1a": check_b1a, "b1b": check_b1b, "b2": check_b2, "c2": check_c2, "d": check_d}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", choices=list(CHECKS), default=None)
    args = ap.parse_args()
    for name in ([args.check] if args.check else list(CHECKS)):
        print(f"--- {name} ---")
        CHECKS[name]()


if __name__ == "__main__":
    main()
