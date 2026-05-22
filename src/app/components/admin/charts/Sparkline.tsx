interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, color = "#6366f1", width = 64, height = 20 }: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height}>
        <line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke={color} strokeWidth={1} strokeOpacity={0.25} strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const allZero = data.every((d) => d === 0);
  if (allZero) {
    return (
      <svg width={width} height={height}>
        <line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke={color} strokeWidth={1} strokeOpacity={0.25} strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - pad - ((v - min) / range) * (height - 2 * pad),
  ] as [number, number]);

  const d = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path
        d={d}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
