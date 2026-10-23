import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EditCaseForm } from "@/components/edit-case-form";

type EditCasePageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

export default async function EditCasePage({ params }: EditCasePageProps) {
  const { caseId } = await params;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href={`/cases/${caseId}`} className="text-sm text-copper-200 hover:text-copper-100">
            ← Back to case
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Edit case</h1>
          <p className="mt-1 text-sm text-slate-400">
            Case details and clinical context are editable. Changes are saved to the case record;
            runs keep the context snapshot taken when they were created.
          </p>
        </div>
        <EditCaseForm caseId={caseId} />
      </div>
    </AppShell>
  );
}
