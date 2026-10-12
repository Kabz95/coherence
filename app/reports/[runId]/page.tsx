import { AppShell } from "@/components/app-shell";
import { ReportDetailClient } from "@/components/report-detail-client";
import { mockRuns } from "@/lib/mock-data";

type ReportPageProps = {
  params: Promise<{
    runId: string;
  }>;
};

export async function generateStaticParams() {
  return mockRuns.map((r) => ({ runId: r.id }));
}

export default async function ReportPage({ params }: ReportPageProps) {
  await params;

  return (
    <AppShell>
      <ReportDetailClient />
    </AppShell>
  );
}
