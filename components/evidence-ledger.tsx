import type { EvidenceItem } from "@/lib/types";

export function EvidenceLedger({ items }: { items: EvidenceItem[] }) {
  return (
    <section className="rounded-lg border border-paper-line bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Evidence ledger</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-4">Source</th>
              <th className="py-2 pr-4">Value</th>
              <th className="py-2 pr-4">Method</th>
              <th className="py-2 pr-4">Limitations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-line">
            {items.length ? (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-4 font-medium text-slate-900">{item.source}</td>
                  <td className="py-3 pr-4 text-slate-600">{item.value}{item.unit ? ` ${item.unit}` : ""}</td>
                  <td className="py-3 pr-4 text-slate-600">{item.method}</td>
                  <td className="py-3 pr-4 text-slate-600">{item.limitations}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">Evidence entries will appear after backend processing.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
