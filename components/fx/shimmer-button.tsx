import { cn } from "@/lib/utils";

// A primary action with a band of light sweeping across it every few seconds.
export function ShimmerLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#2eb67d] px-6 text-base font-bold text-[#06140d] shadow-[0_0_0_1px_rgb(255_255_255/0.15)_inset,0_10px_40px_-10px_rgb(46_182_125/0.6)] transition-[transform,box-shadow] outline-none hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgb(255_255_255/0.25)_inset,0_14px_50px_-10px_rgb(46_182_125/0.8)] focus-visible:ring-2 focus-visible:ring-white",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 [animation:fx-shimmer_2.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/45 to-transparent"
      />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </a>
  );
}
