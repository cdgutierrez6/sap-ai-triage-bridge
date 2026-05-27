const IS_SANDBOX = import.meta.env.VITE_SAP_MODE === 'sandbox' || !import.meta.env.VITE_SAP_MODE;

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">🔷</span>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">SAP AI Triage Bridge</h1>
            <p className="text-xs text-gray-500">Purchase Requisition Intelligence Layer</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {IS_SANDBOX ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
              SANDBOX MODE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
              LIVE — SAP BTP
            </span>
          )}
          <span className="text-xs text-gray-400 hidden sm:block">v1.0.0</span>
        </div>
      </div>
    </header>
  );
}
