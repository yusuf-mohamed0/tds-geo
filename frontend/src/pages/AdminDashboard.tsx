import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, FileText, Target, DollarSign, Activity, ChevronRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import { fetchDashboard, fetchHealth } from '../api/admin';
import type { AdminDashboard, HealthStatus } from '../types';

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([fetchDashboard(), fetchHealth()])
      .then(([d, h]) => { setDashboard(d); setHealth(h); })
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

  if (!dashboard) {
    return <div className="text-brand-muted">Failed to load dashboard.</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Dashboard</h2>

      {/* System Health */}
      {health?.checks && (
        <div className="flex gap-4 text-sm flex-wrap">
          {Object.entries(health.checks).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 card py-2 px-3">
              <span className="capitalize text-brand-muted">{key}:</span>
              <StatusBadge status={(val as { status: string })?.status || 'unknown'} />
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Users size={20} />}
          label="Total Clients"
          value={dashboard.clients.total}
          subtitle={`${dashboard.clients.active} active · ${dashboard.clients.new_30d} new (30d)`}
        />
        <MetricCard
          icon={<FileText size={20} />}
          label="Articles"
          value={dashboard.articles.total}
          subtitle={`${dashboard.articles.published} published · ${dashboard.articles.pending_review} pending`}
        />
        <MetricCard
          icon={<Target size={20} />}
          label="Avg Keyword Relevance"
          value={`${dashboard.keywords.avg_relevance}%`}
          subtitle={`${dashboard.keywords.total} keywords`}
        />
        <MetricCard
          icon={<DollarSign size={20} />}
          label="MTD Costs"
          value={`$${parseFloat(dashboard.costs.total_cost_mtd || '0').toFixed(2)}`}
          subtitle={`${dashboard.publishing.this_week} published this week`}
        />
      </div>

      {/* Activity Chart + Recent Articles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h3 className="text-sm font-semibold mb-4">30-Day Activity</h3>
          {dashboard.activity.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dashboard.activity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2A2A" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F1B1B', border: '1px solid #2D2A2A', borderRadius: 8, color: '#FCF6F2', fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#FCB900" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-brand-muted text-sm py-12 text-center">No activity data yet.</p>
          )}
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold mb-4">Recent Articles</h3>
          <div className="space-y-2">
            {dashboard.recentArticles.slice(0, 8).map((article) => (
              <button
                key={article.id}
                onClick={() => navigate(`/articles/${article.id}`)}
                className="w-full text-left p-2.5 rounded-lg hover:bg-brand-border transition-colors"
              >
                <p className="text-sm truncate">{article.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={article.status} />
                  {article.seoScore && (
                    <span className="text-xs text-brand-muted">SEO: {article.seoScore}</span>
                  )}
                </div>
              </button>
            ))}
            <button
              onClick={() => navigate('/articles')}
              className="flex items-center gap-1 text-sm text-brand-accent hover:underline mt-2"
            >
              View all <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
