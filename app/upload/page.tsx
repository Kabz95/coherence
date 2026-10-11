import { AppShell } from "@/components/app-shell";
import { UploadPageClient } from "@/components/upload-page-client";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-white">Upload or register neuro data</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Create a run shell with optional clinical context. Processing jobs should be triggered later through a secure backend or orchestrator.
          </p>
        </div>
        <UploadPageClient />
      </div>
    </AppShell>
  );
}
