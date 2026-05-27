import { useState, useCallback } from 'react';
import type { TriageResult } from '@sap-triage/shared';
import { apiClient } from '../services/api.client';

interface UseTriageResult {
  run: (requisitionId: string) => Promise<TriageResult | null>;
  isRunning: boolean;
  error: string | null;
}

export function useTriage(): UseTriageResult {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (requisitionId: string): Promise<TriageResult | null> => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await apiClient.triage.run(requisitionId);
      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Triage failed');
      return null;
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { run, isRunning, error };
}
