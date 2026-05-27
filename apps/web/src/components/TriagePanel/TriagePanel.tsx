import type { TriageResult } from '@sap-triage/shared';
import { RiskDonut } from './RiskDonut';

const SEVERITY_CONFIG = {
  high:   { bg: 'bg-red-50',    text: 'text-red-800',    badge: 'bg-red-100 text-red-700' },
  medium: { bg: 'bg-orange-50', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-700' },
  low:    { bg: 'bg-yellow-50', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' },
};

interface TriagePanelProps {
  triageResult: TriageResult | null;
  isRunning: boolean;
  error: string | null;
  onRunTriage: () => void;
}

export function TriagePanel({ triageResult, isRunning, error, onRunTriage }: TriagePanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">🤖 AI Triage Analysis</h2>
        {triageResult && (
          <span className="text-xs text-gray-400">{triageResult.aiProvider} / {triageResult.aiModel}</span>
        )}
      </div>

      {!triageResult && !isRunning && !error && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <span className="text-5xl" aria-hidden="true">🤖</span>
          <p className="text-sm text-gray-500">This PR has not been analyzed yet.</p>
          <button
            onClick={onRunTriage}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            🤖 Run Triage
          </button>
        </div>
      )}

      {isRunning && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" aria-hidden="true" />
          <p className="text-sm text-gray-500 animate-pulse">Analyzing with Claude AI...</p>
        </div>
      )}

      {error && !isRunning && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2">
          <p className="text-sm text-red-800 font-medium">⚠️ Triage failed</p>
          <p className="text-xs text-red-600">{error}</p>
          <button
            onClick={onRunTriage}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {triageResult && !isRunning && (
        <>
          <div className="flex justify-center">
            <RiskDonut score={triageResult.riskScore} riskLevel={triageResult.riskLevel} />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">🔍 Anomalies Detected</h3>
            {triageResult.anomalies.length === 0 ? (
              <p className="text-sm text-gray-400">No anomalies detected.</p>
            ) : (
              <ul className="space-y-2">
                {triageResult.anomalies.map((anomaly, i) => {
                  const sc = SEVERITY_CONFIG[anomaly.severity];
                  return (
                    <li key={i} className={`rounded-lg ${sc.bg} p-3`}>
                      <div className="flex items-start gap-2">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${sc.badge} flex-shrink-0`}>
                          {anomaly.severity.toUpperCase()}
                        </span>
                        <div>
                          <p className={`text-xs font-semibold ${sc.text}`}>{anomaly.type.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{anomaly.description}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">📝 AI Summary</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{triageResult.aiSummary}</p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">✅ Recommendations</h3>
            <ul className="space-y-1.5">
              {triageResult.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 w-4 h-4 flex-shrink-0 border border-gray-300 rounded text-center text-xs text-gray-400" aria-hidden="true" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={onRunTriage}
              disabled={isRunning}
              aria-disabled={isRunning}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              🔄 Re-run Triage
            </button>
            <div className="mt-3 text-xs text-gray-400 space-y-0.5">
              <p>Provider: {triageResult.aiProvider} · Model: {triageResult.aiModel}</p>
              {triageResult.promptTokens && (
                <p>Tokens: {triageResult.promptTokens} in / {triageResult.completionTokens} out</p>
              )}
              {triageResult.processingTimeMs && (
                <p>Latency: {triageResult.processingTimeMs.toLocaleString()}ms</p>
              )}
              <p>Triaged: {new Date(triageResult.triagedAt).toLocaleString()}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
