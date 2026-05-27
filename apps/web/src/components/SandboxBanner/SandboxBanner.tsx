const IS_SANDBOX = import.meta.env.VITE_SAP_MODE === 'sandbox' || !import.meta.env.VITE_SAP_MODE;

export function SandboxBanner() {
  if (!IS_SANDBOX) return null;

  return (
    <aside
      role="alert"
      aria-live="polite"
      className="w-full bg-amber-50 border-b-2 border-amber-400 px-4 py-3 flex items-start gap-2"
    >
      <span className="text-amber-600 text-lg flex-shrink-0" aria-hidden="true">⚠️</span>
      <p className="text-amber-900 text-sm font-medium">
        <span className="font-bold">SANDBOX MODE</span> —{' '}
        The data shown is simulated and does not come from a real SAP system.
        Set <code className="bg-amber-100 px-1 rounded font-mono text-xs">SAP_MODE=live</code> to connect to SAP BTP.
      </p>
    </aside>
  );
}
