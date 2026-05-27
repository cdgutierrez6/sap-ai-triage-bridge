import type { RiskLevel } from '@sap-triage/shared';

export const RISK_CONFIG: Record<RiskLevel, { label: string; bg: string; text: string; ring: string; dot: string; stroke: string }> = {
  low:      { label: 'LOW',      bg: 'bg-green-100',  text: 'text-green-800',  ring: 'ring-green-200',  dot: 'bg-green-500',  stroke: '#22c55e' },
  medium:   { label: 'MEDIUM',   bg: 'bg-yellow-100', text: 'text-yellow-800', ring: 'ring-yellow-200', dot: 'bg-yellow-500', stroke: '#eab308' },
  high:     { label: 'HIGH',     bg: 'bg-orange-100', text: 'text-orange-800', ring: 'ring-orange-200', dot: 'bg-orange-500', stroke: '#f97316' },
  critical: { label: 'CRITICAL', bg: 'bg-red-100',    text: 'text-red-800',    ring: 'ring-red-200',    dot: 'bg-red-500',    stroke: '#ef4444' },
};

export function getRiskConfig(level: RiskLevel) {
  return RISK_CONFIG[level];
}
