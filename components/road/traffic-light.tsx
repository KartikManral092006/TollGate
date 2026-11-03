import { cn } from "@/lib/utils";

export type Light = "red" | "amber" | "green" | "off";

// Three lamps; the lit one says where a gate stands. Paired with a word, never colour alone.
export function TrafficLight({ lit, className }: { lit: Light; className?: string }) {
  const lamp = (color: Exclude<Light, "off">, on: string) =>
    cn(
      "size-2.5 rounded-full transition-[background-color,box-shadow] duration-300",
      lit === color ? on : "bg-white/15",
    );
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-asphalt px-1.5 py-1",
        className,
      )}
    >
      <span className={lamp("red", "bg-[#e5485d] shadow-[0_0_8px_#e5485d]")} />
      <span className={lamp("amber", "bg-signal shadow-[0_0_8px_var(--signal)]")} />
      <span className={lamp("green", "bg-[#2eb67d] shadow-[0_0_8px_#2eb67d]")} />
    </span>
  );
}
