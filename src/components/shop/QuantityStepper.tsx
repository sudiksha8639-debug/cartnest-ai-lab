import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  label = "Quantity",
  disabled = false,
  className,
  testId,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card",
        className,
      )}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={`Decrease ${label.toLowerCase()}`}
        data-testid={testId ? `${testId}-decrease` : undefined}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className="grid size-9 place-items-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:opacity-35"
      >
        <Minus className="size-3.5" aria-hidden="true" />
      </button>
      <span
        className="min-w-7 text-center text-sm font-semibold tabular-nums"
        aria-live="polite"
        data-testid={testId ? `${testId}-value` : undefined}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label.toLowerCase()}`}
        data-testid={testId ? `${testId}-increase` : undefined}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className="grid size-9 place-items-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:opacity-35"
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
