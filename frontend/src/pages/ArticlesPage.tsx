import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, FileText } from 'lucide-react';
import PageHeader from '../components/PageHeader';
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
      <PageHeader
        title="Articles"
        description={data ? `${data.total} article${data.total !== 1 ? 's' : ''} total` : 'Manage your content'}
        action={
          <button className="btn-primary flex items-center gap-2 opacity-60 cursor-not-allowed" title="Coming soon">
            <Plus size={16} /> Generate
          </button>
        }
      />

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: '', label: 'All' },
          { value: 'draft', label: 'Draft' },
          { value: 'generated', label: 'Generated' },
          { value: 'approved', label: 'Approved' },
          { value: 'published', label: 'Published' },
          { value: 'rejected', label: 'Rejected' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              statusFilter === f.value
                ? 'bg-brand-accent text-brand-bg shadow-sm'
                : 'bg-brand-surface text-brand-muted hover:text-brand-text hover:bg-brand-border'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-brand-border animate-pulse">
                <div className="flex-1 h-4 bg-brand-border rounded" />
                <div className="w-16 h-4 bg-brand-border rounded" />
                <div className="w-20 h-4 bg-brand-border rounded" />
              </div>
            ))}
          </div>
        ) : data && data.data.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-brand-muted text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-medium">Title</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Words</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">SEO</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Created</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {data.data.map((article) => (
                <tr
                  key={article.id}
                  onClick={() => navigate(`/admin/articles/${article.id}`)}
                  className="border-b border-brand-border/60 hover:bg-brand-border/30 cursor-pointer transition-colors group"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-brand-accent/10 text-brand-accent shrink-0">
                        <FileText size={14} />
                      </div>
                      <span className="font-medium truncate max-w-xs group-hover:text-brand-accent transition-colors">{article.title}</span>
                    </div>
                  </td>
                  <td className="p-4"><StatusBadge status={article.status} /></td>
                  <td className="p-4 text-brand-muted hidden md:table-cell">{article.word_count || '-'}</td>
                  <td className="p-4 hidden md:table-cell">
                    {article.seo_score ? (
                      <span className={`font-medium ${Number(article.seo_score) >= 90 ? 'text-green-400' : Number(article.seo_score) >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {article.seo_score}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-4 text-brand-muted text-xs hidden sm:table-cell">
                    {new Date(article.created_at || article.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <ChevronRight size={14} className="text-brand-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-16">
            <FileText size={40} className="mx-auto text-brand-muted/40" />
            <p className="text-brand-muted mt-4">No articles found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > limit && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                p === page
                  ? 'bg-brand-accent text-brand-bg'
                  : 'bg-brand-surface text-brand-muted hover:text-brand-text hover:bg-brand-border'
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
