import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/15 bg-black/20 p-10 text-center">
      {icon ? <div className="mb-4 text-copper-200">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  body,
  onRetry,
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-6 text-center">
      <h3 className="text-lg font-semibold text-rose-100">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-rose-100/80">{body}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl border border-rose-300/40 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-300/10"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
