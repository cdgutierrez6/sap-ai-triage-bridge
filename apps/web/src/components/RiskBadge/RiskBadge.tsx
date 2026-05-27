import type { RiskLevel } from '@sap-triage/shared';
import { getRiskConfig } from '../../utils/risk.utils';

interface RiskBadgeProps {
  riskLevel: RiskLevel;
  size?: 'sm' | 'md';
}

export function RiskBadge({ riskLevel, size = 'md' }: RiskBadgeProps) {
  const config = getRiskConfig(riskLevel);
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${padding} rounded-full text-xs font-semibold ${config.bg} ${config.text} ring-1 ${config.ring}`}
      aria-label={`Risk level: ${riskLevel}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
