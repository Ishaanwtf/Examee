"use client";

type Segment = {
  value: number;
  color: string; // stroke color (hex or tailwind-resolved css color)
};

export default function DonutChart({
  segments,
  size = 132,
  strokeWidth = 16
}: {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  let cumulative = 0;
  const arcs = segments.map((s) => {
    const length = (s.value / total) * circumference;
    const offset = circumference - cumulative;
    cumulative += length;
    return { ...s, length, offset };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
    >
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc.length} ${circumference - arc.length}`}
          strokeDashoffset={arc.offset}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}
