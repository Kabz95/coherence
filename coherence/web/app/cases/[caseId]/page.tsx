import { AppShell } from "@/components/app-shell";
import { CaseDetailClient } from "@/components/case-detail-client";

type CasePageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

export async function generateStaticParams() {
  return [{ caseId: "_" }];
}

export default async function CasePage({ params }: CasePageProps) {
  const { caseId } = await params;

  return (
    <AppShell>
      <CaseDetailClient caseId={caseId} />
    </AppShell>
  );
}
