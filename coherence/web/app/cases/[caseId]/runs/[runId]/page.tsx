import { AppShell } from "@/components/app-shell";
import { RunDetailClient } from "@/components/run-detail-client";

type RunPageProps = {
  params: Promise<{
    caseId: string;
    runId: string;
  }>;
};

export async function generateStaticParams() {
  return [{ caseId: "_", runId: "_" }];
}

export default async function RunPage({ params }: RunPageProps) {
  const { caseId, runId } = await params;

  return (
    <AppShell>
      <RunDetailClient caseId={caseId} runId={runId} />
    </AppShell>
  );
}
