import type { CurvePoint } from "@/lib/backtest";

export function EquityCurve({ points }: { points: CurvePoint[] }) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.equity);
  const min = Math.min(...values, 1);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const width = 800;
  const height = 280;
  const pad = 28;
  const coords = points.map((point, index) => {
    const x = pad + (index / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((point.equity - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const path = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const baseline = height - pad - ((1 - min) / span) * (height - pad * 2);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Simulated equity curve">
      <line x1={pad} x2={width - pad} y1={baseline} y2={baseline} stroke="#FF2BD6" strokeOpacity="0.45" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="#3EF0FF" strokeWidth="2.2" />
    </svg>
  );
}
