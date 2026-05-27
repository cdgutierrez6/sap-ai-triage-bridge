import { useSearchParams } from 'react-router-dom';
import type { RequisitionFilters } from '@sap-triage/shared';
import { useRequisitions } from '../hooks/useRequisitions';
import { RequisitionTable } from '../components/RequisitionTable/RequisitionTable';
import { RequisitionFiltersBar } from '../components/RequisitionTable/RequisitionFilters';
import { apiClient } from '../services/api.client';
import { useState } from 'react';

function filtersFromParams(params: URLSearchParams): RequisitionFilters {
  return {
    status: params.get('status') ?? undefined,
    riskLevel: (params.get('riskLevel') as RequisitionFilters['riskLevel']) ?? undefined,
    plant: params.get('plant') ?? undefined,
    startDate: params.get('startDate') ?? undefined,
    endDate: params.get('endDate') ?? undefined,
    search: params.get('search') ?? undefined,
    page: Number(params.get('page') ?? 1),
    pageSize: 20,
  };
}

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSyncing, setIsSyncing] = useState(false);
  const filters = filtersFromParams(searchParams);

  const { data, isLoading, error, refetch } = useRequisitions(filters);

  function handleFilterChange(partial: Partial<RequisitionFilters>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(partial).forEach(([k, v]) => {
      if (v === undefined || v === null) next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      await apiClient.sync.trigger();
      refetch();
    } finally {
      setIsSyncing(false);
    }
  }

  const stats = data
    ? {
        total: data.meta.total,
        high: data.data.filter((r) => r.triage?.riskLevel === 'high').length,
        critical: data.data.filter((r) => r.triage?.riskLevel === 'critical').length,
      }
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Purchase Requisitions</h2>
          <p className="text-sm text-gray-500 mt-0.5">SAP MM purchase requisition triage via AI analysis</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isSyncing ? (
              <><span className="w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />Syncing...</>
            ) : (
              <>🔄 Sync OData</>
            )}
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total PRs', value: stats.total, color: 'text-gray-900' },
            { label: 'High Risk', value: stats.high, color: 'text-orange-600' },
            { label: 'Critical', value: stats.critical, color: 'text-red-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <RequisitionFiltersBar filters={filters} onChange={handleFilterChange} />
      <RequisitionTable
        data={data}
        isLoading={isLoading}
        error={error}
        onPageChange={(page) => handleFilterChange({ page })}
      />
    </div>
  );
}
