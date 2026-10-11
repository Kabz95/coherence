import { AppShell } from "@/components/app-shell";
import { RunDetailClient } from "@/components/run-detail-client";

export const dynamic = "force-dynamic";

export default function RunDetailPage() {
  return (
    <AppShell>
      <RunDetailClient />
    </AppShell>
  );
}
