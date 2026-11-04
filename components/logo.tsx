import Link from "next/link";
import { cn } from "@/lib/utils";

// The mark: a road stop-sign octagon with a shell prompt cut into it. Agent commands stop
// here until the team says go. The same drawing is app/icon.svg.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="8 8 84 84" aria-hidden className={cn("size-7 shrink-0", className)}>
      <polygon
        points="65.3,13 87,34.7 87,65.3 65.3,87 34.7,87 13,65.3 13,34.7 34.7,13"
        fill="#c8102e"
        stroke="#c8102e"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <polyline
        points="33,35 49,50 33,65"
        fill="none"
        stroke="#fff"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="55" y1="65" x2="69" y2="65" stroke="#fff" strokeWidth="8.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md text-lg font-extrabold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <LogoMark />
      Tollgate
    </Link>
  );
}
