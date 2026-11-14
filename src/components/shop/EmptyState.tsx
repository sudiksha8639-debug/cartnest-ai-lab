import type { ReactNode } from "react";
import { PackageOpen } from "lucide-react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        {icon ?? <PackageOpen className="size-6" aria-hidden="true" />}
      </div>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
