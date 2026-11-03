import { cn } from "@/lib/utils";

// A gate's number as a route shield, like the markers that name a highway.
export function RouteShield({ code, className }: { code: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 min-w-12 items-center justify-center gap-1 rounded-[0.6rem_0.6rem_1rem_1rem] border-2 border-foreground/85 bg-card px-2 font-bold tabular-nums shadow-xs",
        className,
      )}
      aria-label={`Gate TG-${code}`}
    >
      <span className="text-[10px] font-semibold text-muted-foreground">TG</span>
      <span className="text-base leading-none">{code}</span>
    </span>
  );
}
