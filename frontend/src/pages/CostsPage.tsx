import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp } from 'lucide-react';
import PageHeader from '../components/PageHeader';
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
      <div className="space-y-6">
        <PageHeader title="Cost Tracking" description="Monitor your AI service spending" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-8 w-20 bg-brand-border rounded" />
              <div className="h-4 w-32 bg-brand-border rounded mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Cost Tracking" description="Monitor your AI service spending" />

      {report ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="card relative overflow-hidden">
              <svg className="absolute top-0 right-0 w-24 h-20 opacity-[0.04]" viewBox="0 0 200 120" fill="none">
                <path d="M0 80C40 40 60 100 100 60C140 20 160 80 200 40V120H0V80Z" fill="currentColor" />
              </svg>
              <DollarSign size={20} className="text-green-400" />
              <p className="text-3xl font-bold mt-3">${report.total.toFixed(2)}</p>
              <p className="text-sm text-brand-muted mt-0.5">Total (30 days)</p>
            </div>
            {report.byProvider?.map((p) => (
              <div key={p.provider} className="card relative overflow-hidden">
                <svg className="absolute top-0 right-0 w-24 h-20 opacity-[0.04]" viewBox="0 0 200 120" fill="none">
                  <path d="M0 80C40 40 60 100 100 60C140 20 160 80 200 40V120H0V80Z" fill="currentColor" />
                </svg>
                <TrendingUp size={20} className="text-brand-accent" />
                <p className="text-3xl font-bold mt-3">${p.cost.toFixed(2)}</p>
                <p className="text-sm text-brand-muted mt-0.5 capitalize">{p.provider}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card text-center py-16">
          <DollarSign size={40} className="mx-auto text-brand-muted/40" />
          <p className="text-brand-muted mt-4">Cost report requires a client ID. Navigate to a client dashboard for details.</p>
        </div>
      )}
    </div>
  );
}
