import { AppShell } from "@/components/app-shell";
import { CaseDetailClient } from "@/components/case-detail-client";

export const dynamic = "force-dynamic";

export default function CaseDetailPage() {
  return (
    <AppShell>
      <CaseDetailClient />
    </AppShell>
  );
}
