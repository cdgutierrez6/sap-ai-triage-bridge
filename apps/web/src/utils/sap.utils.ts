export const PR_STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  '01': { label: 'In Process',         bg: 'bg-blue-100',   text: 'text-blue-800'   },
  '02': { label: 'Released',           bg: 'bg-green-100',  text: 'text-green-800'  },
  N1:   { label: 'Ordered',            bg: 'bg-purple-100', text: 'text-purple-800' },
  N5:   { label: 'Closed',             bg: 'bg-gray-100',   text: 'text-gray-600'   },
};

export function getPrStatusConfig(code: string) {
  return PR_STATUS_MAP[code] ?? { label: `Status: ${code}`, bg: 'bg-gray-100', text: 'text-gray-600' };
}

export const PR_TYPE_LABELS: Record<string, string> = {
  NB: 'Standard (NB)',
  UB: 'Stock Transfer (UB)',
  FO: 'Framework Order (FO)',
};

export const ACCOUNT_ASSIGNMENT_LABELS: Record<string, string> = {
  K: 'Cost Center (K)',
  P: 'Project/WBS (P)',
  F: 'Internal Order (F)',
  ' ': 'Stock',
};

export const ITEM_CATEGORY_LABELS: Record<string, string> = {
  '0': 'Standard',
  '9': 'Service',
  '2': 'Consignment',
};

export function formatCurrency(value: number | null, currency: string | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
