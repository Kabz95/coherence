import { AppShell } from "@/components/app-shell";
import { RunDetailClient } from "@/components/run-detail-client";
import { mockRuns } from "@/lib/mock-data";

type RunPageProps = {
  params: Promise<{
    caseId: string;
    runId: string;
  }>;
};

export async function generateStaticParams() {
  return mockRuns.map((r) => ({ caseId: r.caseId, runId: r.id }));
}

export default async function RunPage({ params }: RunPageProps) {
  const { caseId, runId } = await params;

  return (
    <AppShell>
      <RunDetailClient caseId={caseId} runId={runId} />
    </AppShell>
  );
}
