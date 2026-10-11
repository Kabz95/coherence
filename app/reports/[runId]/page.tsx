import { AppShell } from "@/components/app-shell";
import { ReportDetailClient } from "@/components/report-detail-client";

export const dynamic = "force-dynamic";

export default function ReportPage() {
  return (
    <AppShell>
      <ReportDetailClient />
    </AppShell>
  );
}
