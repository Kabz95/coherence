"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileUp } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { phiWarning } from "@/lib/clinical-copy";
import type { Modality, PatientCase } from "@/lib/types";
import { createNeuroRun, attachInputFilesToRun } from "@/lib/runs";
import { uploadInputFile } from "@/lib/storage";
import { startRunPipeline } from "@/lib/pipeline";
import { useAuth } from "./auth-provider";
import { ModalityCard } from "./modality-card";
import { ProgressBar } from "./progress-bar";

const acceptedExamples: Record<Modality, string[]> = {
  structural_mri: ["DICOM ZIP", "NIfTI .nii", "NIfTI .nii.gz"],
  diffusion_mri: ["DICOM ZIP", "NIfTI", "bval files", "bvec files"],
  eeg: ["EDF", "BDF", "CSV placeholder", "Vendor export placeholder"],
  multimodal: ["Structural MRI inputs", "Diffusion inputs", "EEG inputs", "Timepoint metadata"]
};

export function UploadPanel({ cases }: { cases: PatientCase[] }) {
  const router = useRouter();
  const { user } = useAuth();
  const configured = isFirebaseConfigured();
  const [modality, setModality] = useState<Modality>("structural_mri");
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string>("");
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [diagnoses, setDiagnoses] = useState("");
  const [careContext, setCareContext] = useState("");
  const [busy, setBusy] = useState(false);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) {
      setMessage("Firebase is not configured. Add .env.local values before creating upload-backed runs.");
      return;
    }
    if (!user) {
      setMessage("Please sign in before creating a run or uploading files.");
      return;
    }
    if (!caseId) {
      setMessage("Select a case before creating a run.");
      return;
    }
    if (!files.length) {
      setMessage("Select at least one file to upload.");
      return;
    }

    setBusy(true);
    setMessage("Creating run...");

    try {
      const clinicalContext = {
        establishedDiagnoses: diagnoses.split(",").map((item) => item.trim()).filter(Boolean),
        medications: careContext ? [{ name: careContext, notes: "Clinician-entered context from upload workflow." }] : [],
        therapies: [],
        symptomScales: [],
        clinicianNotes: "Clinician-entered context only. Coherence does not generate diagnoses."
      };

      const run = await createNeuroRun({ caseId, modality, clinicalContext });
      setMessage(`Uploading ${files.length} file(s)...`);

      const uploadedFiles = await Promise.all(
        files.map((file) => uploadInputFile(caseId, run.id, file, modality))
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
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-line bg-panel/75 p-5">
      {!configured ? (
        <div className="rounded-lg border border-gold/35 bg-gold/10 p-4 text-sm text-gold">
          Firebase public web config is missing. Mock mode is enabled and file uploads are disabled.
        </div>
      ) : null}
      <div className="rounded-lg border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-50">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 flex-none" />
          <p>{phiWarning}</p>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-white" htmlFor="case">Case</label>
        {cases.length ? (
          <select id="case" value={caseId} onChange={(event) => setCaseId(event.target.value)} className="mt-2 w-full rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white">
            {cases.map((patientCase) => (
              <option key={patientCase.id} value={patientCase.id}>{patientCase.displayName}</option>
            ))}
          </select>
        ) : (
          <div className="mt-2 rounded-md border border-gold/35 bg-gold/10 p-3 text-sm text-gold">
            No Firestore cases are available for this signed-in user. Create a case first, then return to upload.
          </div>
        )}
      </div>
      <div>
        <div className="text-sm font-medium text-white">Modality</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(["structural_mri", "diffusion_mri", "eeg", "multimodal"] as Modality[]).map((item) => (
            <ModalityCard key={item} modality={item} selected={item === modality} onSelect={setModality} />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-cyan-300/35 bg-cyan-300/5 p-6">
        <label className="flex cursor-pointer flex-col items-center text-center" htmlFor="files">
          <FileUp className="h-10 w-10 text-cyan-200" />
          <span className="mt-3 font-medium text-white">Select neuro data files</span>
          <span className="mt-1 text-sm text-slate-300">{acceptedExamples[modality].join(", ")}</span>
        </label>
        <input id="files" type="file" multiple className="sr-only" onChange={handleFiles} disabled={!configured || busy} />
      </div>
      {files.length ? (
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          {files.length} file(s) selected, {(totalSize / 1024 / 1024).toFixed(1)} MB total.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <input value={diagnoses} onChange={(event) => setDiagnoses(event.target.value)} className="rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white" placeholder="Clinician-entered diagnoses, comma separated optional context" />
        <input value={careContext} onChange={(event) => setCareContext(event.target.value)} className="rounded-md border border-white/10 bg-midnight px-3 py-2 text-sm text-white" placeholder="Medication or therapy context, optional" />
      </div>
      <button type="submit" className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={!configured || busy || !cases.length}>
        {busy ? "Working..." : "Create run and upload"}
      </button>
      {busy ? <ProgressBar label="Processing upload" detail={message || "Please keep this page open"} /> : null}
      {message ? <p className="text-sm text-slate-300">{message}</p> : null}
    </form>
  );
}
