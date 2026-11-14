import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductImage({
  src,
  alt,
  className,
  accent,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  accent?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 text-muted-foreground",
          className,
        )}
        style={{ backgroundColor: accent ?? "var(--secondary)" }}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="size-7 opacity-60" aria-hidden="true" />
        <span className="max-w-[70%] text-center text-[11px] font-medium leading-4">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
