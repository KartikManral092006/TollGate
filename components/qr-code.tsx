import { encode } from "uqr";

// A QR code drawn as one SVG path, so it stays sharp at any size and needs no canvas. Always
// dark on white with a quiet zone: phone cameras read inverted or low-contrast codes badly.
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const { size, data } = encode(value, { ecc: "M", border: 2 });
  let path = "";
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#111418" />
    </svg>
  );
}
