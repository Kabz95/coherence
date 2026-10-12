# Coherence — Symposium Demo Playbook

This build covers **all five brain-data pipelines**: structural MRI, diffusion
MRI, fMRI, EEG, and MEG. Multimodal orchestration remains a marked **Roadmap**
item. The live demo site is published at
**https://kabz95.github.io/coherence/** (static export of the demo mode).

## Zero-config rehearsal

No Firebase setup is needed. With no `NEXT_PUBLIC_FIREBASE_*` values present,
the app runs in **demo mode** with seven seeded cases:

```bash
cd coherence/web
npm install
npm run dev
# open the forwarded port 3000
```

Seeded demo cases: A-104 (structural, two longitudinal timepoints), B-217
(live structural pipeline), C-309 (empty state), D-528 (diffusion), E-639
(fMRI), F-741 (EEG), G-852 (MEG). All measurements and viewer images are
fictional demo content.

To use live Firebase instead, copy `.env.local.example` to `.env.local`,
fill in the values, and restart the dev server.

## Republishing the demo site

The public demo is a static export on the `gh-pages` branch, built from
`coherence/web`:

```bash
cd coherence/web
COHERENCE_STATIC_EXPORT=1 COHERENCE_BASE_PATH=/coherence npm run build
rm -rf /tmp/coherence-pages && git clone -q ~/workspace/coherence/coherence-main /tmp/coherence-pages
cd /tmp/coherence-pages && git checkout --orphan gh-pages
git rm -rf . && cp -r ~/workspace/coherence/coherence-main/coherence/web/out/. .
touch .nojekyll && git add -A && git commit -m "Coherence demo site (static export)"
git remote set-url origin https://github.com/Kabz95/coherence.git
git push -f origin gh-pages
```

GitHub Pages is configured (repo Settings → Pages) to serve `gh-pages` at
`https://kabz95.github.io/coherence/`.

## The demo click path (one clean narrative)

1. **Sign in** — Open `/`. Click **Enter workspace** (or go to `/sign-in`).
   In demo mode, click **Continue with demo account**. You land on the dashboard
   with the topbar showing the **Demo mode** badge.

2. **Open dashboard** — `/dashboard` shows 3 cases, recent runs (2 completed,
   1 running), and the non-diagnostic disclaimer banner.

3. **Open a case** — Click **Case A-104** (`/cases/case-aurora-001`).
   The **Overview** tab shows the case summary: clinician-entered diagnoses,
   medications, therapies, and the run list.

4. **Review timeline and clinical context** — Switch to the **Timeline** tab:
   runs, medication changes (sertraline titration, bupropion augmentation),
   PHQ-9 / GAD-7 score trends with sparklines, therapy, and dated clinician
   notes — newest first, filterable by event type. The **Clinical context** tab
   holds the full context panels plus notes.

5. **Open latest structural MRI run** — From Overview, click
   **run-structural-latest** (2026-10-08, completed). The run page shows the
   pipeline orchestrator, the per-stage timeline, the **structural viewer**
   (2D slices / 3D volume tabs; diffusion and EEG shown as Roadmap), and the
   **report summary** with key measurements and QC flags.

6. **Show viewer plus report summary** — Toggle the viewer tabs, then click
   **Full report** to open `/reports/run-structural-latest`: the unified
   non-diagnostic report — administrative details, inputs, QC, measurements,
   limitations, evidence ledger, and the interpretation statement. There is a
   **Print** button for handouts.

7. **Compare with prior timepoint** — Back on the run page, click
   **Compare with prior timepoint**. This opens the case's **Longitudinal** tab
   with the October vs February comparison: measurement deltas
   (intracranial volume, cortical thickness, hippocampi), QC flag comparison,
   and the measurement-variability disclaimer. Emphasize: *supplementary
   context, not a diagnostic conclusion.*

8. **Point to future multimodal tabs as the roadmap** — On the viewer and the
   upload page, gesture at the **Roadmap**-badged diffusion / EEG / multimodal
   entries: "The data contract already supports them; structural comes first."

## Rehearsal checklist

- [ ] `npm run build` passes with no errors.
- [ ] Demo sign-in works from both `/` and `/sign-in`.
- [ ] Dashboard shows 3 cases and 3 runs with correct statuses.
- [ ] Case A-104 Timeline tab renders medication, scale, therapy, note, and run events.
- [ ] Run `run-structural-latest` shows viewer, report summary, and the Full report link.
- [ ] `/reports/run-structural-latest` renders all report sections + evidence ledger.
- [ ] Longitudinal tab compares Oct 2026 vs Feb 2026 with deltas and QC flags.
- [ ] Case C-309 shows the empty states (no runs yet).
- [ ] Upload page shows structural as available and other modalities as Roadmap.
- [ ] Every screen carries the non-diagnostic disclaimer; say it out loud once.

## What NOT to show

- Do not click into diffusion/EEG/multimodal creation — they are roadmap-only.
- Do not present any number as a diagnosis or prediction; the script's framing
  is "supplementary context for clinician review."
- Demo mode is read-only: case/run creation and uploads need Firebase config.
