import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { apiFetch } from '../api/client';
import type { ArticleSummary, PaginatedResponse } from '../types';

export default function ArticlesPage() {
  const [data, setData] = useState<PaginatedResponse<ArticleSummary> | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit) });
    if (statusFilter) params.set('status', statusFilter);
    apiFetch<PaginatedResponse<ArticleSummary>>(`/api/articles?${params}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Articles</h2>
        <button className="btn-primary flex items-center gap-2" onClick={() => navigate('/articles/generate')}>
          <Plus size={16} /> Generate
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'draft', 'generated', 'approved', 'published', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === s
                ? 'bg-brand-accent text-brand-bg font-medium'
                : 'bg-brand-surface text-brand-muted hover:text-brand-text'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full" />
          </div>
        ) : data && data.data.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-brand-muted">
                <th className="text-left p-4 font-medium">Title</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Client</th>
                <th className="text-left p-4 font-medium">Words</th>
                <th className="text-left p-4 font-medium">SEO</th>
                <th className="text-left p-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((article) => (
                <tr
                  key={article.id}
                  onClick={() => navigate(`/articles/${article.id}`)}
                  className="border-b border-brand-border hover:bg-brand-border/50 cursor-pointer transition-colors"
                >
                  <td className="p-4 font-medium truncate max-w-xs">{article.title}</td>
                  <td className="p-4"><StatusBadge status={article.status} /></td>
                  <td className="p-4 text-brand-muted">{article.clientName || '-'}</td>
                  <td className="p-4 text-brand-muted">{article.wordCount || '-'}</td>
                  <td className="p-4">{article.seoScore ?? '-'}</td>
                  <td className="p-4 text-brand-muted text-xs">
                    {new Date(article.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-brand-muted">No articles found.</div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > limit && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm ${
                p === page
                  ? 'bg-brand-accent text-brand-bg font-medium'
                  : 'bg-brand-surface text-brand-muted hover:text-brand-text'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
