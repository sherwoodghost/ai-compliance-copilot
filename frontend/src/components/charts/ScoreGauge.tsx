'use client';

interface ScoreGaugeProps {
  score: number; // 0–100
  size?: number;
}

export function ScoreGauge({ score, size = 160 }: ScoreGaugeProps) {
  const r = (size - 24) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r; // half-circle
  const arcLen = (score / 100) * circumference;
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';

  return (
    <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
      {/* Track */}
      <path
        d={`M 12,${cy} A ${r},${r} 0 0,1 ${size - 12},${cy}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={12}
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M 12,${cy} A ${r},${r} 0 0,1 ${size - 12},${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={`${arcLen} ${circumference}`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* Score text */}
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize={size * 0.2}
        fontWeight="700"
        fill={color}
      >
        {score}
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="12" fill="#9ca3af">
        / 100
      </text>
    </svg>
  );
}
