// What the viewer's device can comfortably do, for the optional effects (3D scenes, inertial
// scrolling). Browser-only; every check falls back to "capable" where a browser doesn't say.

type NavigatorHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

// Skip heavy decorative effects: the person asked to save data, or the device is low-end
// (2 GB of memory or less, or two cores or fewer). Reduced motion is each effect's own call:
// some show a still frame instead.
export function prefersLightEffects(): boolean {
  if (typeof window === "undefined") return true;
  const nav = navigator as NavigatorHints;
  if (nav.connection?.saveData === true) return true;
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return true;
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2) return true;
  return false;
}

// A touch screen with no mouse: native scrolling is already smooth and expected there.
export function isTouchOnly(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

// Runs `work` once the browser is idle, so an effect never competes with the page becoming
// usable. Safari has no requestIdleCallback; a short timeout stands in. Returns a cancel.
export function whenIdle(work: () => void, timeout = 1500): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(work, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(work, 200);
  return () => window.clearTimeout(id);
}
