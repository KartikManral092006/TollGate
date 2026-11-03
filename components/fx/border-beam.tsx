import { cn } from "@/lib/utils";

// A short streak of light travelling around the parent's border. The parent needs
// `relative` and rounded corners; `radius` should match them.
export function BorderBeam({
  radius = 16,
  duration = 6,
  delay = 0,
  colorFrom = "#2eb67d",
  colorTo = "#f2a900",
  className,
}: {
  radius?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)] [mask-composite:intersect] [mask-clip:padding-box,border-box]",
        className,
      )}
    >
      <span
        className="absolute aspect-square w-24 bg-gradient-to-l from-[var(--beam-from)] via-[var(--beam-to)] to-transparent"
        style={
          {
            "--beam-from": colorFrom,
            "--beam-to": colorTo,
            offsetPath: `rect(0 auto auto 0 round ${radius}px)`,
            animation: `fx-beam ${duration}s linear ${delay}s infinite`,
          } as React.CSSProperties
        }
      />
    </span>
  );
}
