import { AppShell } from "@/components/app-shell";
import { CasesPageClient } from "@/components/cases-page-client";

export const dynamic = "force-dynamic";

export default function CasesPage() {
  return (
    <AppShell>
      <CasesPageClient />
    </AppShell>
  );
}
