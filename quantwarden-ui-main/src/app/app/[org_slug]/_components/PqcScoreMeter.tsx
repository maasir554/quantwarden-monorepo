import { cn } from "@/lib/utils";

interface PqcScoreMeterProps {
  score: number;
  className?: string;
  compact?: boolean;
  showValue?: boolean;
}

const METER_CENTER_X = 110;
const METER_CENTER_Y = 105;
const METER_RADIUS = 85;

// These boundaries must stay aligned with calculatePqcScore():
// D 0-49, C 50-74, B 75-89, A 90-100.
const meterSegments = [
  { start: 0, end: 50, color: "#dc2626" },
  { start: 50, end: 75, color: "#d97706" },
  { start: 75, end: 90, color: "#315f9f" },
  { start: 90, end: 100, color: "#168267" },
];

function pointForScore(score: number) {
  const angle = Math.PI - (Math.PI * score) / 100;

  return {
    x: METER_CENTER_X + METER_RADIUS * Math.cos(angle),
    y: METER_CENTER_Y - METER_RADIUS * Math.sin(angle),
  };
}

function segmentPath(startScore: number, endScore: number) {
  const start = pointForScore(startScore);
  const end = pointForScore(endScore);

  return `M ${start.x} ${start.y} A ${METER_RADIUS} ${METER_RADIUS} 0 0 1 ${end.x} ${end.y}`;
}

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
            key={`${segment.start}-${segment.end}`}
            d={segmentPath(segment.start, segment.end)}
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
