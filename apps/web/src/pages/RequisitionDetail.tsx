import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import type { RequisitionDetail as IRequisitionDetail, TriageResult } from '@sap-triage/shared';
import { apiClient } from '../services/api.client';
import { useTriage } from '../hooks/useTriage';
import { TriagePanel } from '../components/TriagePanel/TriagePanel';
import { RiskBadge } from '../components/RiskBadge/RiskBadge';
import { getPrStatusConfig, formatCurrency, formatDate, PR_TYPE_LABELS, ACCOUNT_ASSIGNMENT_LABELS, ITEM_CATEGORY_LABELS } from '../utils/sap.utils';

export function RequisitionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pr, setPr] = useState<IRequisitionDetail | null>(null);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const { run, isRunning, error: triageError } = useTriage();

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    apiClient.requisitions.getById(id)
      .then(({ data }) => {
        setPr(data);
        if (data.triage) setTriage(data.triage);
        setIsLoading(false);
      })
      .catch((err: Error) => { setLoadError(err.message); setIsLoading(false); });
  }, [id]);

  async function handleRunTriage() {
    if (!id) return;
    const result = await run(id);
    if (result) setTriage(result);
  }

  function handleBack() {
    const backParams = searchParams.toString();
    navigate(backParams ? `/?${backParams}` : '/');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (loadError || !pr) {
    return (
      <div className="py-20 text-center">
        <p className="text-red-600 font-medium">{loadError ?? 'Requisition not found'}</p>
        <button onClick={handleBack} className="mt-4 text-sm text-indigo-600 hover:underline">← Back to Dashboard</button>
      </div>
    );
  }

  const status = getPrStatusConfig(pr.processingStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-900 font-mono">{pr.purchaseRequisition}</h2>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>{status.label}</span>
            {triage && <RiskBadge riskLevel={triage.riskLevel} />}
          </div>
          <p className="text-sm text-gray-500 mt-1">{pr.description ?? 'No description'}</p>
        </div>
        {pr.sandboxMode && (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">⚠️ Sandbox Data</span>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">PR Details</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'PR Number', value: pr.purchaseRequisition, mono: true },
                { label: 'Type', value: PR_TYPE_LABELS[pr.purchaseRequisitionType] ?? pr.purchaseRequisitionType },
                { label: 'Company Code', value: pr.companyCode, mono: true },
                { label: 'Created By', value: pr.createdByUser, mono: true },
                { label: 'Creation Date', value: formatDate(pr.creationDate) },
                { label: 'Last Changed', value: formatDate(pr.lastChangeDateTime) },
                { label: 'SAP Status', value: status.label },
                { label: 'Items', value: String(pr.itemCount) },
              ].map(({ label, value, mono }) => (
                <div key={label}>
                  <dt className="text-xs text-gray-500 font-medium">{label}</dt>
                  <dd className={`text-gray-800 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowRawPayload((v) => !v)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {showRawPayload ? '▲ Hide' : '▼ Show'} raw SAP payload
              </button>
              {showRawPayload && (
                <pre className="mt-3 text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-64 border border-gray-200 text-gray-700">
                  {JSON.stringify(pr.rawSapPayload, null, 2)}
                </pre>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Line Items ({pr.items.length})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead>
                  <tr>
                    {['Item', 'Material', 'Description', 'Category', 'Qty', 'Unit Price', 'Total', 'Delivery'].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pr.items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs font-mono text-gray-600 whitespace-nowrap">{item.purchaseRequisitionItem}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-700 whitespace-nowrap">{item.material ?? <span className="text-gray-400">—</span>}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 max-w-[160px] truncate" title={item.shortText ?? ''}>{item.shortText ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{item.purchReqnItemCategory ? ITEM_CATEGORY_LABELS[item.purchReqnItemCategory] ?? item.purchReqnItemCategory : '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{item.requestedQuantity ?? '—'} {item.requestedQuantityUnit}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap text-right">{formatCurrency(item.priceInDocumentCurrency, item.documentCurrency)}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap text-right font-medium">{formatCurrency(item.totalPrice, item.documentCurrency)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(item.deliveryDate)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-3 py-2 text-xs font-semibold text-gray-600 text-right">TOTAL</td>
                    <td className="px-3 py-2 text-xs font-bold text-gray-900 text-right whitespace-nowrap">
                      {formatCurrency(pr.totalValue, pr.currency)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <TriagePanel
            triageResult={triage}
            isRunning={isRunning}
            error={triageError}
            onRunTriage={handleRunTriage}
          />
        </div>
      </div>
    </div>
  );
}
