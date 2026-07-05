import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, DollarSign, Target, ArrowLeft } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import { apiFetch } from '../api/client';
import type { ClientAnalyticsOverview } from '../types';

export default function ClientDashboard() {
  const { clientId } = useParams();
  const [data, setData] = useState<ClientAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    apiFetch<ClientAnalyticsOverview>(`/api/analytics/${clientId}/overview`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-brand-muted">Client not found.</div>;
  }

  const pipeline = data.articleStats;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/clients" className="btn-ghost p-1.5">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="text-xl font-bold">Client Analytics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={<FileText size={20} />} label="Total Articles" value={pipeline.total} />
        <MetricCard icon={<FileText size={20} />} label="Published" value={pipeline.published} />
        <MetricCard icon={<Target size={20} />} label="Keywords" value={data.keywordStats.total} />
        <MetricCard
          icon={<DollarSign size={20} />}
          label="MTD Costs"
          value={`$${data.costs.total.toFixed(2)}`}
        />
      </div>

      {/* Pipeline Funnel */}
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
                <div className="w-full rounded-t-md" style={{ height: `${Math.max(height, 4)}%`, backgroundColor: stage.color }} />
                <span className="text-xs text-brand-muted">{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4">Cost Breakdown</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-brand-muted">OpenAI</span>
            <span>${data.costs.openai.toFixed(2)}</span>
          </div>
          <div className="w-full h-2 bg-brand-border rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-accent rounded-full"
              style={{ width: `${data.costs.total > 0 ? (data.costs.openai / data.costs.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-brand-muted">SerpAPI</span>
            <span>${data.costs.serp.toFixed(2)}</span>
          </div>
          <div className="w-full h-2 bg-brand-border rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${data.costs.total > 0 ? (data.costs.serp / data.costs.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
