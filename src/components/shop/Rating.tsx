import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  count,
  size = "sm",
  className,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      aria-label={`Rated ${value} out of 5${count ? ` from ${count} reviews` : ""}`}
    >
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = rounded >= star;
          const half = !filled && rounded >= star - 0.5;
          return (
            <Star
              key={star}
              aria-hidden="true"
              className={cn(
                size === "sm" ? "size-3" : "size-3.5",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : half
                    ? "fill-amber-200 text-amber-400"
                    : "fill-transparent text-muted-foreground/35",
              )}
            />
          );
        })}
      </span>
      <span className="text-xs font-semibold text-foreground">{value.toFixed(1)}</span>
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground">
          ({count.toLocaleString("en-IN")})
        </span>
      )}
    </div>
  );
}
