import { useState, useEffect, useCallback } from 'react';
import type { PaginatedResponse, RequisitionListItem, RequisitionFilters } from '@sap-triage/shared';
import { apiClient } from '../services/api.client';

interface UseRequisitionsResult {
  data: PaginatedResponse<RequisitionListItem> | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRequisitions(filters: RequisitionFilters): UseRequisitionsResult {
  const [data, setData] = useState<PaginatedResponse<RequisitionListItem> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient.requisitions.list(filters)
      .then((res) => { if (!cancelled) { setData(res); setIsLoading(false); } })
      .catch((err: Error) => { if (!cancelled) { setError(err.message); setIsLoading(false); } });

    return () => { cancelled = true; };
  }, [
    filters.status, filters.riskLevel, filters.plant, filters.startDate,
    filters.endDate, filters.search, filters.page, filters.pageSize, trigger,
  ]);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);
  return { data, isLoading, error, refetch };
}
