import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, DollarSign, Target, ArrowLeft, Store } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import { apiFetch } from '../api/client';

export default function ClientDashboard() {
  const { clientId } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    apiFetch<Record<string, unknown>>(`/api/analytics/${clientId}/overview`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-24 bg-brand-border rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-brand-border" />
              <div className="mt-4 space-y-2">
                <div className="h-8 w-24 bg-brand-border rounded" />
                <div className="h-4 w-32 bg-brand-border rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Link to="/clients" className="btn-ghost flex items-center gap-1.5 text-sm w-fit">
          ← Back to clients
        </Link>
        <div className="card text-center py-16">
          <Store size={40} className="mx-auto text-brand-muted/40" />
          <p className="text-brand-muted mt-4">Client not found</p>
        </div>
      </div>
    );
  }

  const articleStats = (data.articleStats || data.articles || {}) as Record<string, number>;
  const pipeline = {
    total: articleStats.total || 0,
    draft: articleStats.draft || articleStats.drafts || 0,
    generated: articleStats.generated || 0,
    approved: articleStats.approved || 0,
    published: articleStats.published || 0,
  };

  const costs = (data.costs || {}) as Record<string, number | string>;
  const costTotal = parseFloat(String(costs.total_cost_mtd || costs.total || costs.mtd || '0'));
  const costOpenai = parseFloat(String(costs.openai || costs.openai_cost || '0'));
  const costSerp = parseFloat(String(costs.serp || costs.serpapi || '0'));

  const keywordStats = (data.keywordStats || data.keywords || {}) as Record<string, number>;

  return (
    <div className="space-y-6">
      <Link to="/admin/clients" className="btn-ghost flex items-center gap-1.5 text-sm w-fit">
        ← Back to clients
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard icon={<FileText size={20} />} label="Total Articles" value={pipeline.total} color="#818CF8" />
        <MetricCard icon={<FileText size={20} />} label="Published" value={pipeline.published} color="#34D399" />
        <MetricCard icon={<Target size={20} />} label="Keywords" value={keywordStats.total || 0} color="#F472B6" />
        <MetricCard icon={<DollarSign size={20} />} label="MTD Costs" value={`$${costTotal.toFixed(2)}`} color="#FBBF24" />
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold mb-4">Article Pipeline</h3>
        <div className="flex items-end gap-3 h-32">
          {[
            { label: 'Draft', value: pipeline.draft, color: 'bg-gray-600' },
            { label: 'Generated', value: pipeline.generated, color: 'bg-yellow-600' },
            { label: 'Approved', value: pipeline.approved, color: 'bg-blue-600' },
            { label: 'Published', value: pipeline.published, color: 'bg-green-500' },
          ].map((stage) => {
            const max = Math.max(pipeline.draft, pipeline.generated, pipeline.approved, pipeline.published, 1);
            const height = (stage.value / max) * 100;
            return (
              <div key={stage.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-lg font-bold">{stage.value}</span>
                <div className="w-full rounded-t-md transition-all duration-300" style={{ height: `${Math.max(height, 4)}%`, backgroundColor: stage.color.replace('bg-', '').replace('-', '') }} />
                <span className="text-xs text-brand-muted">{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {(costOpenai > 0 || costSerp > 0) && (
        <div className="card">
          <h3 className="text-sm font-semibold mb-4">Cost Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">OpenAI</span>
              <span>${costOpenai.toFixed(2)}</span>
            </div>
            <div className="w-full h-2 bg-brand-border rounded-full overflow-hidden">
              <div className="h-full bg-brand-accent rounded-full transition-all duration-300" style={{ width: `${costTotal > 0 ? (costOpenai / costTotal) * 100 : 0}%` }} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">SerpAPI</span>
              <span>${costSerp.toFixed(2)}</span>
            </div>
            <div className="w-full h-2 bg-brand-border rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${costTotal > 0 ? (costSerp / costTotal) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
