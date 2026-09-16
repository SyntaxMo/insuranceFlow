import { formatDateTime } from "@/lib/format";
import { historyActionLabel } from "@/lib/claims/workflow";
import type { ClaimStatusHistory } from "@/types/database";

export function ClaimHistory({
  history,
  showActor = false,
}: {
  history: Array<ClaimStatusHistory & { actorName?: string | null }>;
  showActor?: boolean;
}) {
  if (history.length === 0) return <p className="text-sm text-slate-600">No claim history is available yet.</p>;
  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-5">
      {history.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--brand-teal)] ring-4 ring-white" aria-hidden="true" />
          <p className="font-semibold text-[var(--brand-navy)]">{historyActionLabel(event.action)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(event.created_at)}{showActor && event.actorName ? ` · ${event.actorName}` : ""}</p>
          {event.note ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{event.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
