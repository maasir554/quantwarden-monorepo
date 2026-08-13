import { cn } from "@/lib/utils";

interface PqcScoreMeterProps {
  score: number;
  className?: string;
  compact?: boolean;
  showValue?: boolean;
}

const meterSegments = [
  { path: "M 25 105 A 85 85 0 0 1 49.9 44.9", color: "#dc2626" },
  { path: "M 49.9 44.9 A 85 85 0 0 1 110 20", color: "#d97706" },
  { path: "M 110 20 A 85 85 0 0 1 170.1 44.9", color: "#315f9f" },
  { path: "M 170.1 44.9 A 85 85 0 0 1 195 105", color: "#168267" },
];

export function PqcScoreMeter({ score, className, compact = false, showValue = true }: PqcScoreMeterProps) {
  const normalizedScore = Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0));
  const needleRotation = normalizedScore * 1.8 - 90;

  return (
    <div
      className={cn("relative mx-auto", compact ? "w-40" : "w-52", className)}
      role="img"
      aria-label={`PQC readiness score ${Math.round(normalizedScore)} out of 100`}
    >
      <svg viewBox="0 0 220 132" className="h-auto w-full overflow-visible" aria-hidden="true">
        <path
          d="M 25 105 A 85 85 0 0 1 195 105"
          fill="none"
          stroke="rgba(138, 93, 51, 0.12)"
          strokeWidth="20"
          strokeLinecap="round"
        />
        {meterSegments.map((segment) => (
          <path
            key={segment.path}
            d={segment.path}
            fill="none"
            stroke={segment.color}
            strokeWidth="16"
            strokeLinecap="butt"
          />
        ))}
        <line
          x1="110"
          y1="105"
          x2="110"
          y2="43"
          stroke="#3d200a"
          strokeWidth="5"
          strokeLinecap="round"
          transform={`rotate(${needleRotation} 110 105)`}
        />
        <circle cx="110" cy="105" r="10" fill="#fff8e8" stroke="#3d200a" strokeWidth="5" />
        <circle cx="110" cy="105" r="3" fill="#3d200a" />
        {showValue ? (
          <text x="110" y="130" textAnchor="middle" fill="#3d200a" fontSize="18" fontWeight="800">
            {Math.round(normalizedScore)}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
