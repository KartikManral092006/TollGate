import { cn } from "@/lib/utils";

// A highway guide sign: deep green panel, white inset border, white type. The same green in
// both themes, because real signs don't change colour at night.
export function SignPanel({
  children,
  className,
  innerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-[#00704a] p-1.5 text-white shadow-lg", className)}>
      <div className={cn("rounded-xl border-2 border-white/90 px-5 py-5", innerClassName)}>
        {children}
      </div>
    </div>
  );
}

// The little tab that hangs off a guide sign ("Exit 3"); used for counts and calls to action.
export function ExitTab({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-lg border-2 border-white bg-[#00704a] px-2.5 py-1 text-sm font-bold text-white shadow ring-2 ring-[#00704a]",
        className,
      )}
    >
      {children}
    </span>
  );
}

// A small guide sign that carries a section's icon, so long pages read like a route.
export function SignIcon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg border-2 border-white bg-[#00704a] text-white shadow-sm ring-1 ring-[#00704a] [&>svg]:size-4",
        className,
      )}
    >
      {children}
    </span>
  );
}
