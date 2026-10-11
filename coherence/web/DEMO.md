# Coherence — Symposium Demo Playbook

This build is **structural-MRI-first**: a polished structural MRI + clinical
context + longitudinal review prototype. Diffusion, EEG, and multimodal tabs
are visible only as marked **Roadmap** items — do not try to demo them live.

## Zero-config rehearsal

No Firebase setup is needed. With no `NEXT_PUBLIC_FIREBASE_*` values present,
the app runs in **demo mode** with three seeded cases:

```bash
cd coherence/web
npm install
npm run dev
# open the forwarded port 3000
```

To use live Firebase instead, copy `.env.local.example` to `.env.local`,
fill in the values, and restart the dev server.

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
