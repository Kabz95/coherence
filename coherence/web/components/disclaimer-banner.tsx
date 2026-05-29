import { ShieldCheck } from "lucide-react";
import { GENERAL_DISCLAIMER } from "@/lib/clinical-copy";

export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-lg border border-gold/35 bg-gold/10 p-4 text-sm text-amber-50">
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-gold" aria-hidden />
        <p className={compact ? "leading-6" : "max-w-5xl leading-6"}>{GENERAL_DISCLAIMER}</p>
      </div>
    </div>
  );
}
