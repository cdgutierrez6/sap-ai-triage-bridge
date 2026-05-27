import type { RiskLevel } from '@sap-triage/shared';
import { getRiskConfig } from '../../utils/risk.utils';

interface RiskDonutProps {
  score: number;
  riskLevel: RiskLevel;
}

export function RiskDonut({ score, riskLevel }: RiskDonutProps) {
  const config = getRiskConfig(riskLevel);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        aria-label={`Risk score: ${score} out of 100, level: ${riskLevel.toUpperCase()}`}
        role="img"
      >
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={config.stroke}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
        />
        <text x="70" y="65" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold" style={{ fontSize: '28px', fontWeight: 700, fill: '#111827' }}>
          {score}
        </text>
        <text x="70" y="88" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '11px', fill: '#6b7280', fontWeight: 500 }}>
          / 100
        </text>
      </svg>
      <span className={`text-sm font-bold ${config.text}`}>{config.label} RISK</span>
    </div>
  );
}
