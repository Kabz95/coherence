"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileUp, XCircle } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { isDemoMode } from "@/lib/demo";
import { phiWarning } from "@/lib/clinical-copy";
import type { Modality, PatientCase } from "@/lib/types";
import { createNeuroRun, attachInputFilesToRun } from "@/lib/runs";
import { uploadInputFile } from "@/lib/storage";
import { startRunPipeline } from "@/lib/pipeline";
import { useAuth } from "./auth-provider";
import { ModalityCard } from "./modality-card";
import { ProgressBar } from "./progress-bar";

/** All five brain-data pipelines are available in this build. */
const ENABLED_MODALITIES: Modality[] = ["structural_mri", "diffusion_mri", "fmri", "eeg", "meg"];
const ROADMAP_MODALITIES: Modality[] = ["multimodal"];

const acceptedExtensions: Record<Modality, string[]> = {
  structural_mri: [".zip", ".nii", ".nii.gz", ".dcm"],
  diffusion_mri: [".zip", ".nii", ".nii.gz", ".bval", ".bvec"],
  fmri: [".zip", ".nii", ".nii.gz", ".json"],
  eeg: [".edf", ".bdf", ".csv"],
  meg: [".fif", ".fif.gz", ".ds", ".csv"],
  multimodal: [".zip", ".nii", ".nii.gz", ".edf", ".bdf"],
};
const acceptedExamples: Record<Modality, string[]> = {
  structural_mri: ["DICOM ZIP", "NIfTI .nii", "NIfTI .nii.gz"],
  diffusion_mri: ["DICOM ZIP", "NIfTI", "bval files", "bvec files"],
  fmri: ["BOLD NIfTI", "BIDS sidecar JSON", "DICOM ZIP"],
  eeg: ["EDF", "BDF", "CSV"],
  meg: ["FIF", "CTF .ds", "CSV"],
  multimodal: ["Structural MRI inputs", "Diffusion inputs", "EEG inputs", "Timepoint metadata"],
};

const MAX_TOTAL_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB guard for browser uploads
const MAX_FILES = 10;

function fileExtension(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".nii.gz")) return ".nii.gz";
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot) : "";
}

interface FileProblem {
  name: string;
  reason: string;
}

export function UploadPanel({ cases }: { cases: PatientCase[] }) {
  const router = useRouter();
  const { identityEmail } = useAuth();
  const configured = isFirebaseConfigured();
  const demoMode = isDemoMode();
  const [modality, setModality] = useState<Modality>("structural_mri");
  const [files, setFiles] = useState<File[]>([]);
  const [problems, setProblems] = useState<FileProblem[]>([]);
  const [message, setMessage] = useState<string>("");
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  // Clinical context is canonical at the case level. The run snapshots
  // whatever the case holds at creation time; it is edited on the case.
  const selectedCase = cases.find((patientCase) => patientCase.id === caseId);
  const inheritedContext = selectedCase?.clinicalContext;
  const inheritedSummary = useMemo(() => {
    if (!inheritedContext) return null;
    const parts: string[] = [];
    if (inheritedContext.establishedDiagnoses.length)
      parts.push(`${inheritedContext.establishedDiagnoses.length} diagnos${inheritedContext.establishedDiagnoses.length === 1 ? "is" : "es"}`);
    if (inheritedContext.medications.length)
      parts.push(`${inheritedContext.medications.length} medication${inheritedContext.medications.length === 1 ? "" : "s"}`);
    if (inheritedContext.therapies.length)
      parts.push(`${inheritedContext.therapies.length} ${inheritedContext.therapies.length === 1 ? "therapy" : "therapies"}`);
    return parts.length ? parts.join(" · ") : null;
  }, [inheritedContext]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const accepted = acceptedExtensions[modality];
    const ok: File[] = [];
    const bad: FileProblem[] = [];

    for (const file of selected) {
      const ext = fileExtension(file.name);
      if (!accepted.includes(ext)) {
        bad.push({ name: file.name, reason: `Unsupported extension "${ext || "none"}". Expected: ${accepted.join(", ")}.` });
        continue;
      }
      ok.push(file);
    }

    if (ok.length > MAX_FILES) {
      bad.push({ name: `${ok.length} files selected`, reason: `At most ${MAX_FILES} files per run.` });
    }
    const kept = ok.slice(0, MAX_FILES);
    const keptSize = kept.reduce((sum, file) => sum + file.size, 0);
    if (keptSize > MAX_TOTAL_BYTES) {
      bad.push({ name: "Total size", reason: `Selection exceeds the ${(MAX_TOTAL_BYTES / 1024 ** 3).toFixed(0)} GB browser-upload guard.` });
    }

    setFiles(keptSize > MAX_TOTAL_BYTES ? [] : kept);
    setProblems(bad);
    // Reset the input so the same file can be re-selected after an error.
    event.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) {
      setMessage(
        demoMode
          ? "Demo mode is read-only: uploads are disabled. Configure Firebase to create live runs."
          : "Firebase is not configured. Add .env.local values before creating upload-backed runs.",
      );
      return;
    }
    if (!identityEmail) {
      setMessage("Please sign in before creating a run or uploading files.");
      return;
    }
    if (!caseId) {
      setMessage("Select a case before creating a run.");
      return;
    }
    if (problems.length) {
      setMessage("Resolve the file problems below before creating the run.");
      return;
    }
    if (!files.length) {
      setMessage("Select at least one file to upload.");
      return;
    }

    setBusy(true);
    setMessage("Creating run...");

    try {
      // Snapshot the case's clinical context onto the run so the run keeps
      // the context that was true at creation time. The case stays the
      // editable source; a per-run snapshot never rewrites it.
      const hasContext =
        inheritedContext &&
        (inheritedContext.establishedDiagnoses.length > 0 ||
          inheritedContext.medications.length > 0 ||
          inheritedContext.therapies.length > 0);
      const run = await createNeuroRun({
        caseId,
        modality,
        clinicalContext: hasContext ? { ...inheritedContext } : undefined
      });
      setMessage(`Uploading ${files.length} file(s)...`);

      const uploadedFiles = await Promise.all(
        files.map((file) => uploadInputFile(caseId, run.id, file, modality)),
      );

      await attachInputFilesToRun(run.id, uploadedFiles);
      setMessage("Upload complete. Starting secure pipeline orchestration...");
      await startRunPipeline(run.id);
      router.push(`/cases/${caseId}/runs/${run.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed. Check Firebase Auth, Firestore rules, and Storage rules.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      {!configured ? (
        <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          {demoMode
            ? "Demo mode: seeded symposium cases are loaded and uploads are disabled. Configure Firebase for live runs."
            : "Firebase public web config is missing. Add .env.local values before creating upload-backed runs."}
        </div>
      ) : null}

      <div className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-50">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 flex-none" />
          <p>{phiWarning}</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-white" htmlFor="case">Case</label>
        {cases.length ? (
          <select id="case" value={caseId} onChange={(event) => setCaseId(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-midnight px-3 py-2 text-sm text-white">
            {cases.map((patientCase) => (
              <option key={patientCase.id} value={patientCase.id}>{patientCase.displayName}</option>
            ))}
          </select>
        ) : (
          <div className="mt-2 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
            No cases are available. Create a case first, then return to upload.
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-medium text-white">Modality</div>
        <p className="mt-1 text-xs text-slate-500">Each modality runs its own open-source pipeline (FastSurfer, DIPY, fMRIPrep, MNE-Python). Multimodal orchestration is on the roadmap.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ENABLED_MODALITIES.map((item) => (
            <ModalityCard
              key={item}
              modality={item}
              selected={item === modality}
              onSelect={(next) => {
                setModality(next);
                setFiles([]);
                setProblems([]);
              }}
              badge="Available"
            />
          ))}
          {ROADMAP_MODALITIES.map((item) => (
            <ModalityCard key={item} modality={item} disabled badge="Roadmap" />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-copper-300/35 bg-copper-300/5 p-6">
        <label className="flex cursor-pointer flex-col items-center text-center" htmlFor="files">
          <FileUp className="h-10 w-10 text-copper-200" />
          <span className="mt-3 font-medium text-white">Select neuro data files</span>
          <span className="mt-1 text-sm text-slate-300">{acceptedExamples[modality].join(", ")}</span>
          <span className="mt-1 text-xs text-slate-500">Up to {MAX_FILES} files · {(MAX_TOTAL_BYTES / 1024 ** 3).toFixed(0)} GB total</span>
        </label>
        <input
          id="files"
          type="file"
          multiple
          accept={acceptedExtensions[modality].join(",")}
          className="sr-only"
          onChange={handleFiles}
          disabled={!configured || busy}
        />
      </div>

      {problems.length ? (
        <ul className="space-y-2">
          {problems.map((problem) => (
            <li key={problem.name} className="flex items-start gap-2 rounded-lg border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">
              <XCircle className="mt-0.5 h-4 w-4 flex-none" />
              <span><strong>{problem.name}:</strong> {problem.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {files.length ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          <div className="mb-2 font-medium text-white">
            {files.length} file(s) selected, {(totalSize / 1024 / 1024).toFixed(1)} MB total.
          </div>
          <ul className="space-y-1">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/25 p-4">
        <div className="text-sm font-medium text-white">Clinical context</div>
        <p className="mt-1 text-xs text-slate-500">
          Inherited from the case record and snapshotted onto this run. Edit it on the case, not here.
        </p>
        {caseId ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-300">
              {inheritedSummary ?? "No clinical context recorded yet."}
            </span>
            <Link href={`/cases/${caseId}/edit`} className="text-sm text-copper-200 hover:text-copper-100">
              Edit case context →
            </Link>
          </div>
        ) : null}
      </div>

      <button type="submit" className="rounded-lg bg-copper-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-copper-200" disabled={!configured || busy || !cases.length}>
        {busy ? "Working..." : "Create run and upload"}
      </button>
      {busy ? <ProgressBar label="Processing upload" detail={message || "Please keep this page open"} /> : null}
      {message ? <p className="text-sm text-slate-300">{message}</p> : null}
    </form>
  );
}
