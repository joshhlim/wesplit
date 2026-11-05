// WeSplit mark: a disc cut in two, the right half dropped slightly. Pure SVG so it renders in Satori too.
export const BRAND = '#0B7A5A';
export const INK = '#0F1A17';

export function Mark({ size = 28, bg = BRAND, fg = '#fff', radius = 0.28, pad = 0 }: { size?: number; bg?: string; fg?: string; radius?: number; pad?: number }) {
  const s = 32, r = s * radius;
  const k = 1 - pad;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width={s} height={s} rx={r} fill={bg} />
      <g transform={`translate(${16 - 16 * k} ${16 - 16 * k}) scale(${k})`}>
        <path d="M14.75 7.2a8.8 8.8 0 0 0 0 17.6z" fill={fg} />
        <path d="M17.25 9.2a8.8 8.8 0 0 1 0 17.6z" fill={fg} />
      </g>
    </svg>
  );
}
