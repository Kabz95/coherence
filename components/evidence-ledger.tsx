import type { EvidenceItem } from "@/lib/types";

export function EvidenceLedger({ items }: { items: EvidenceItem[] }) {
  return (
    <section className="rounded-lg border border-line bg-panel/75 p-5">
      <h2 className="text-base font-semibold text-white">Evidence ledger</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2 pr-4">Source</th>
              <th className="py-2 pr-4">Value</th>
              <th className="py-2 pr-4">Method</th>
              <th className="py-2 pr-4">Limitations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {items.length ? (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-4 text-white">{item.source}</td>
                  <td className="py-3 pr-4 text-slate-300">{item.value}{item.unit ? ` ${item.unit}` : ""}</td>
                  <td className="py-3 pr-4 text-slate-300">{item.method}</td>
                  <td className="py-3 pr-4 text-slate-300">{item.limitations}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400">Evidence entries will appear after backend processing.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
