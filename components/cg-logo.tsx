/**
 * cartograf logo — 4 cardinal spokes + arc segments + accent center dot.
 * Drawn inline as SVG; inherits currentColor for the structural strokes.
 * Single source of truth used by all pages.
 */
export function CgLogo({
  size = 22,
  bg = "var(--bg)",
  color = "var(--ink)",
  accent = "var(--accent)",
}: {
  size?: number;
  bg?: string;
  color?: string;
  accent?: string;
}) {
  const c = size / 2;
  const r = size * 0.34;
  const dot = size * 0.115;
  const ep = size * 0.078;
  const sw = size * 0.068;
  const GAP = 22 * (Math.PI / 180);

  const cardAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const endpoints = cardAngles.map((a) => ({
    x: c + r * Math.cos(a),
    y: c + r * Math.sin(a),
  }));

  const arcPairs = [
    [0 + GAP, Math.PI / 2 - GAP],
    [Math.PI / 2 + GAP, Math.PI - GAP],
    [Math.PI + GAP, (3 * Math.PI) / 2 - GAP],
    [(3 * Math.PI) / 2 + GAP, 2 * Math.PI - GAP],
  ];
  const arcs = arcPairs.map(([a0, a1]) => {
    const x0 = (c + r * Math.cos(a0)).toFixed(2);
    const y0 = (c + r * Math.sin(a0)).toFixed(2);
    const x1 = (c + r * Math.cos(a1)).toFixed(2);
    const y1 = (c + r * Math.sin(a1)).toFixed(2);
    return `M ${x0} ${y0} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x1} ${y1}`;
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      fill="none"
      style={{ display: "block" }}
    >
      {endpoints.map((p, i) => (
        <line
          key={`spoke-${i}`}
          x1={c}
          y1={c}
          x2={p.x}
          y2={p.y}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      ))}
      {arcs.map((d, i) => (
        <path
          key={`arc-${i}`}
          d={d}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      ))}
      {endpoints.map((p, i) => (
        <circle
          key={`ep-${i}`}
          cx={p.x}
          cy={p.y}
          r={ep}
          fill={bg}
          stroke={color}
          strokeWidth={sw * 0.85}
        />
      ))}
      <circle cx={c} cy={c} r={dot} fill={accent} />
    </svg>
  );
}

/** Wordmark + symbol for use in nav and footers. */
export function CgWordmark({
  size = 22,
  color = "var(--ink)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        color,
      }}
    >
      <CgLogo size={size} color={color} />
      <span
        style={{
          fontFamily: "var(--font-display), Inter, system-ui, sans-serif",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          fontSize: Math.round(size * 0.82),
          color,
        }}
      >
        cartogra<span style={{ color: "var(--accent)" }}>f</span>
      </span>
    </span>
  );
}
