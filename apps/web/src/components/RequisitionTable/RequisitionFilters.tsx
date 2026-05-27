import type { RequisitionFilters } from '@sap-triage/shared';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: '01', label: 'In Process' },
  { value: '02', label: 'Released' },
  { value: 'N1', label: 'Ordered' },
  { value: 'N5', label: 'Closed' },
];

const RISK_OPTIONS = [
  { value: '', label: 'All Risk Levels' },
  { value: 'critical', label: '🔴 Critical' },
  { value: 'high', label: '🟠 High' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'low', label: '🟢 Low' },
];

interface RequisitionFiltersProps {
  filters: RequisitionFilters;
  onChange: (f: Partial<RequisitionFilters>) => void;
}

export function RequisitionFiltersBar({ filters, onChange }: RequisitionFiltersProps) {
  const hasActiveFilters = !!(filters.status || filters.riskLevel || filters.plant || filters.startDate || filters.endDate || filters.search);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="filter-status" className="block text-xs font-medium text-gray-600 mb-1">SAP Status</label>
          <select
            id="filter-status"
            value={filters.status ?? ''}
            onChange={(e) => onChange({ status: e.target.value || undefined, page: 1 })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[160px]">
          <label htmlFor="filter-risk" className="block text-xs font-medium text-gray-600 mb-1">Risk Level</label>
          <select
            id="filter-risk"
            value={filters.riskLevel ?? ''}
            onChange={(e) => onChange({ riskLevel: (e.target.value as RequisitionFilters['riskLevel']) || undefined, page: 1 })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {RISK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[160px]">
          <label htmlFor="filter-search" className="block text-xs font-medium text-gray-600 mb-1">Search</label>
          <input
            id="filter-search"
            type="text"
            placeholder="PR# or description..."
            value={filters.search ?? ''}
            onChange={(e) => onChange({ search: e.target.value || undefined, page: 1 })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div>
          <label htmlFor="filter-start" className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            id="filter-start"
            type="date"
            value={filters.startDate ?? ''}
            onChange={(e) => onChange({ startDate: e.target.value || undefined, page: 1 })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div>
          <label htmlFor="filter-end" className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            id="filter-end"
            type="date"
            value={filters.endDate ?? ''}
            onChange={(e) => onChange({ endDate: e.target.value || undefined, page: 1 })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => onChange({ status: undefined, riskLevel: undefined, plant: undefined, startDate: undefined, endDate: undefined, search: undefined, page: 1 })}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-2 whitespace-nowrap"
          >
            Clear all ×
          </button>
        )}
      </div>
    </div>
  );
}
