import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, FileText, Target, DollarSign, Activity, ChevronRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import { fetchDashboard, fetchHealth } from '../api/admin';

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
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
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Dashboard</h2>
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

  if (!dashboard) {
    return <div className="text-brand-muted">Failed to load dashboard.</div>;
  }

  const d = dashboard as Record<string, Record<string, unknown>>;
  const clients = (d.clients || {}) as Record<string, number>;
  const articles = (d.articles || {}) as Record<string, number>;
  const keywords = (d.keywords || {}) as Record<string, number | string>;
  const publishing = (d.publishing || {}) as Record<string, number>;
  const costs = (d.costs || {}) as Record<string, number | string>;
  const activity = (d.activity || []) as Array<Record<string, unknown>>;
  const recentArticles = (d.recentArticles || []) as Array<Record<string, unknown>>;
  const checks = (health?.checks || {}) as Record<string, Record<string, string>>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Dashboard</h2>
        <p className="text-sm text-brand-muted mt-0.5">Overview of your platform performance and activity</p>
      </div>

      {/* System Health */}
      {Object.keys(checks).length > 0 && (
        <div className="card py-3 px-5">
          <div className="flex items-center gap-1 text-xs text-brand-muted mb-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5" />
            System Status
          </div>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(checks).map(([key, val]) => {
              const status = val?.status || 'unknown';
              return (
                <div key={key} className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-brand-bg/50">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    status === 'healthy' ? 'bg-green-400' :
                    status === 'configured' ? 'bg-blue-400' :
                    status.includes('unreachable') || status.includes('not') ? 'bg-red-400' :
                    'bg-yellow-400'
                  }`} />
                  <span className="capitalize text-xs text-brand-text">{key}</span>
                  <span className="text-[10px] text-brand-muted/60">{status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard icon={<Users size={20} />} label="Total Clients" value={clients.total ?? 0} subtitle={`${clients.active ?? 0} active · ${clients.new_30d ?? 0} new`} color="#818CF8" />
        <MetricCard icon={<FileText size={20} />} label="Articles" value={articles.total ?? 0} subtitle={`${articles.published ?? 0} published · ${articles.pending_review ?? 0} pending`} color="#34D399" />
        <MetricCard icon={<Target size={20} />} label="Avg Keyword Relevance" value={`${keywords.avg_relevance ?? '0'}%`} subtitle={`${keywords.total ?? 0} keywords tracked`} color="#F472B6" />
        <MetricCard icon={<DollarSign size={20} />} label="MTD Costs" value={`$${parseFloat(String(costs.total_cost_mtd || '0')).toFixed(2)}`} subtitle={`${publishing.this_week ?? 0} published this week`} color="#FBBF24" />
      </div>

      {/* Activity Chart + Recent Articles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">30-Day Activity</h3>
            <div className="flex items-center gap-1.5 text-xs text-brand-muted">
              <div className="w-2 h-2 rounded-full bg-brand-accent" />
              <span>Events</span>
            </div>
          </div>
          {activity.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={activity as Array<{ date: string; count: number }>}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2A2A" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1F1B1B', border: '1px solid #2D2A2A', borderRadius: 8, color: '#FCF6F2', fontSize: 12 }} />
                <Bar dataKey="count" fill="#FCB900" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-brand-muted text-sm py-12 text-center">No activity data yet.</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Recent Articles</h3>
            <span className="text-xs text-brand-muted">{recentArticles.length}</span>
          </div>
          <div className="space-y-1">
            {recentArticles.slice(0, 8).map((article) => {
              const a = article as Record<string, unknown>;
              return (
                <button key={String(a.id)} onClick={() => navigate(`/articles/${a.id}`)} className="w-full text-left p-3 rounded-xl hover:bg-brand-border/60 transition-all duration-150 group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm truncate flex-1 group-hover:text-brand-accent transition-colors">{String(a.title)}</p>
                    <ChevronRight size={14} className="text-brand-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <StatusBadge status={String(a.status || 'draft')} />
                    {a.seo_score && <span className="text-[11px] text-brand-muted/60">SEO: {a.seo_score}</span>}
                  </div>
                </button>
              );
            })}
            {recentArticles.length > 0 && (
              <button onClick={() => navigate('/articles')} className="w-full text-left p-2.5 mt-1 text-sm text-brand-accent/80 hover:text-brand-accent transition-colors rounded-lg hover:bg-brand-border/30">
                View all articles →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
