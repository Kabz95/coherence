import { AppShell } from "@/components/app-shell";
import { CaseDetailClient } from "@/components/case-detail-client";
import { mockCases } from "@/lib/mock-data";

type CasePageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

export async function generateStaticParams() {
  // Pre-render every demo case so static hosts (GitHub Pages) serve real
  // deep links. Live deployments resolve any caseId client-side.
  return mockCases.map((c) => ({ caseId: c.id }));
}

export default async function CasePage({ params }: CasePageProps) {
  const { caseId } = await params;

  return (
    <AppShell>
      <CaseDetailClient caseId={caseId} />
    </AppShell>
  );
}
