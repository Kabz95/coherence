import { AppShell } from "@/components/app-shell";
import { ReportDetailClient } from "@/components/report-detail-client";

type ReportPageProps = {
  params: Promise<{
    runId: string;
  }>;
};

export async function generateStaticParams() {
  return [{ runId: "_" }];
}

export default async function ReportPage({ params }: ReportPageProps) {
  await params;

  return (
    <AppShell>
      <ReportDetailClient />
    </AppShell>
  );
}
