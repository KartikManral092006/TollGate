const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3600],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });

export function timeAgo(iso: string | number, now: number = Date.now()): string {
  const at = typeof iso === "number" ? iso : Date.parse(iso);
  const seconds = Math.round((at - now) / 1000);
  if (Math.abs(seconds) < 45) return "just now";
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size || unit === "minute") {
      return relative.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

export function clockTime(iso: string | number): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function dayLabel(iso: string | number, now: Date = new Date()): string {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0]![0]}${parts.at(-1)![0]}` : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

// A stable hue per person, so the same teammate always has the same avatar colour.
export function avatarHue(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}
