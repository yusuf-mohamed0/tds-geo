import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

interface CostReport {
  total: number;
  daily: { date: string; cost: number }[];
  byProvider: { provider: string; cost: number }[];
}

export default function CostsPage() {
  const [report, setReport] = useState<CostReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<CostReport>('/api/cost/report/global')
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Cost Tracking</h2>
        <p className="text-sm text-brand-muted">Cost report endpoint requires a client ID. Navigate to a client dashboard for cost details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Cost Tracking</h2>
      <div className="card">
        <p className="text-3xl font-bold">${report.total.toFixed(2)}</p>
        <p className="text-sm text-brand-muted mt-1">Total costs (30 days)</p>
      </div>
      {report.byProvider && (
        <div className="card">
          <h3 className="text-sm font-semibold mb-3">By Provider</h3>
          <div className="space-y-2">
            {report.byProvider.map((p) => (
              <div key={p.provider} className="flex justify-between text-sm">
                <span className="text-brand-muted">{p.provider}</span>
                <span>${p.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
