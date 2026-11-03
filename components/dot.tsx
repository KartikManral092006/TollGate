// A middle-dot separator with even spacing (Overpass's "·" sits off-centre on its own).
export function Dot() {
  return (
    <span
      aria-hidden
      className="mx-1.5 inline-block size-[3px] translate-y-[-3px] rounded-full bg-current opacity-60"
    />
  );
}
