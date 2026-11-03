import { cn } from "@/lib/utils";

// An endless horizontal strip. The children are rendered twice so the loop is seamless;
// the copy is hidden from screen readers. Pauses on hover.
export function Marquee({
  children,
  reverse = false,
  seconds = 40,
  className,
}: {
  children: React.ReactNode;
  reverse?: boolean;
  seconds?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group/marquee flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]",
        className,
      )}
    >
      <div
        className="flex w-max shrink-0 gap-4 group-hover/marquee:[animation-play-state:paused]"
        style={{
          animation: `fx-marquee ${seconds}s linear infinite`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        <div className="flex shrink-0 gap-4">{children}</div>
        <div className="flex shrink-0 gap-4" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
