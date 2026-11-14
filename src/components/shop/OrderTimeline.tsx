import { ORDER_STATUS_FLOW, formatDateTime, statusIndex } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { Check, Circle, Package, Truck } from "lucide-react";

export function OrderTimeline({
  status,
  history,
}: {
  status: string;
  history: { status: string; at: number; note?: string }[];
}) {
  const current = statusIndex(status);

  return (
    <ol className="relative mt-4 space-y-0" aria-label="Order tracking progress">
      {ORDER_STATUS_FLOW.map((entry, index) => {
        const reached = index <= current;
        const active = index === current;
        const event = history.find((item) => item.status === entry);
        const isLast = index === ORDER_STATUS_FLOW.length - 1;
        return (
          <li key={entry} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                className={cn(
                  "absolute left-[13px] top-7 h-[calc(100%-18px)] w-px",
                  index < current ? "bg-primary/60" : "bg-border",
                )}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border",
                reached
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground",
                active && "ring-4 ring-primary/15",
              )}
            >
              {reached ? (
                index === ORDER_STATUS_FLOW.length - 1 ? (
                  <Package className="size-3.5" aria-hidden="true" />
                ) : index >= 2 ? (
                  <Truck className="size-3.5" aria-hidden="true" />
                ) : (
                  <Check className="size-3.5" aria-hidden="true" />
                )
              ) : (
                <Circle className="size-2.5 fill-current" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "text-xs font-semibold",
                  reached ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {entry}
                {active && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                    Current
                  </span>
                )}
              </p>
              {event ? (
                <>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(event.at)}</p>
                  {event.note && (
                    <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground/90">{event.note}</p>
                  )}
                </>
              ) : (
                <p className="mt-0.5 text-[11px] text-muted-foreground">Pending</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
