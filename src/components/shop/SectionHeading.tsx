import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  actionLabel = "View all",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  action?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-[26px] font-bold leading-[1.15] tracking-tight sm:text-[32px]">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Link
          to={action}
          className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition-colors hover:border-primary/40 hover:text-primary"
        >
          {actionLabel}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
