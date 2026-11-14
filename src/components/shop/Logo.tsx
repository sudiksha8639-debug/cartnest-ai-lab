import { Link } from "react-router";

export function CartNestMark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={`grid ${className} place-items-center rounded-[11px] bg-primary text-primary-foreground`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5" strokeWidth="1.7">
        <path
          d="M4.2 9h15.6l-1.5 7.6A3.2 3.2 0 0 1 15.2 19H8.8a3.2 3.2 0 0 1-3.1-2.4L4.2 9Z"
          stroke="currentColor"
          strokeLinejoin="round"
        />
        <path
          d="M8.6 9V7.2a3.4 3.4 0 0 1 6.8 0V9"
          stroke="currentColor"
          strokeLinecap="round"
        />
        <path
          d="M9.4 12.4c.55 1.15 1.55 1.8 2.6 1.8s2.05-.65 2.6-1.8"
          stroke="currentColor"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      data-testid="logo-home-link"
      aria-label="CartNest home"
      className="flex items-center gap-2.5 rounded-xl transition-opacity hover:opacity-85"
    >
      <CartNestMark />
      <span className="flex flex-col leading-none">
        <span className="text-[19px] font-extrabold tracking-[-0.03em]">
          Cart<span className="text-primary">Nest</span>
        </span>
        {!compact && (
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Considered essentials
          </span>
        )}
      </span>
    </Link>
  );
}
