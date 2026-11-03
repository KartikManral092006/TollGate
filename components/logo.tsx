import Link from "next/link";
import { cn } from "@/lib/utils";

// A striped toll-gate arm: the product's mark everywhere.
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md text-lg font-extrabold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-3 w-9 rounded-full bg-[repeating-linear-gradient(-45deg,#c8102e_0_6px,#ffffff_6px_12px)] ring-1 ring-black/15"
      />
      Tollgate
    </Link>
  );
}
