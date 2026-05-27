import { useNavigate } from 'react-router-dom';
import type { RequisitionListItem, PaginatedResponse } from '@sap-triage/shared';
import { RiskBadge } from '../RiskBadge/RiskBadge';
import { getPrStatusConfig, formatCurrency, formatRelativeTime } from '../../utils/sap.utils';

interface RequisitionTableProps {
  data: PaginatedResponse<RequisitionListItem> | null;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
}

export function RequisitionTable({ data, isLoading, error, onPageChange }: RequisitionTableProps) {
  const navigate = useNavigate();

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
        <p className="text-red-600 font-medium">⚠️ Error loading requisitions</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['PR Number', 'Description', 'Plant', 'Status', 'Total Value', 'Risk', 'Triaged'].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100" aria-busy={isLoading}>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.data.map((pr) => {
                  const status = getPrStatusConfig(pr.processingStatus);
                  const plantValues = pr.currency ? pr.totalValue : null;
                  return (
                    <tr
                      key={pr.id}
                      onClick={() => navigate(`/requisitions/${pr.id}`)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-gray-800 whitespace-nowrap">{pr.purchaseRequisition}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate" title={pr.description ?? ''}>
                        {pr.description ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600 whitespace-nowrap">
                        {/* Plant from items is not directly on the list item — show company code instead */}
                        {pr.companyCode}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap text-right">
                        {formatCurrency(plantValues, pr.currency)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {pr.triage ? (
                          <RiskBadge riskLevel={pr.triage.riskLevel} size="sm" />
                        ) : (
                          <span className="text-xs text-gray-400 italic">pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {pr.triage ? formatRelativeTime(pr.triage.triagedAt) : '—'}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {!isLoading && data?.data.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🔍</p>
          <p className="text-gray-500 text-sm">No requisitions found with the selected filters.</p>
        </div>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {(data.meta.page - 1) * data.meta.pageSize + 1}–{Math.min(data.meta.page * data.meta.pageSize, data.meta.total)} of {data.meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(data.meta.page - 1)}
              disabled={data.meta.page <= 1}
              className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-600">
              Page {data.meta.page} of {data.meta.totalPages}
            </span>
            <button
              onClick={() => onPageChange(data.meta.page + 1)}
              disabled={data.meta.page >= data.meta.totalPages}
              className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
