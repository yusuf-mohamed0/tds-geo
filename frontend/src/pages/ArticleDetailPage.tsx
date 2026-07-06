import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Calendar, Hash, BarChart3 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { apiFetch } from '../api/client';

interface ArticleDetail {
  id: string;
  title: string;
  content_md: string;
  content_html: string;
  meta_title: string;
  meta_description: string;
  tags: string[];
  word_count: number;
  status: string;
  seo_score: string | number;
  keyword: string;
  created_at: string;
  updated_at: string;
}

export default function ArticleDetailPage() {
  const { id } = useParams();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch<ArticleDetail>(`/api/articles/${id}`)
      .then(setArticle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-24 bg-brand-border rounded animate-pulse" />
        <div className="card animate-pulse space-y-3">
          <div className="h-8 w-3/4 bg-brand-border rounded" />
          <div className="h-4 w-1/2 bg-brand-border rounded" />
          <div className="h-32 bg-brand-border rounded" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="space-y-6">
        <Link to="/articles" className="btn-ghost flex items-center gap-1.5 text-sm w-fit">
          ← Back to articles
        </Link>
        <div className="card text-center py-16">
          <FileText size={40} className="mx-auto text-brand-muted/40" />
          <p className="text-brand-muted mt-4">Article not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/articles" className="btn-ghost flex items-center gap-1.5 text-sm w-fit">
        ← Back to articles
      </Link>

      <div className="card">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-brand-accent/10 text-brand-accent shrink-0">
            <FileText size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{article.title}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <StatusBadge status={article.status} />
              {article.seo_score && (
                <span className="text-xs text-brand-muted flex items-center gap-1">
                  <BarChart3 size={12} /> SEO: {article.seo_score}
                </span>
              )}
              {article.word_count && (
                <span className="text-xs text-brand-muted flex items-center gap-1">
                  <Hash size={12} /> {article.word_count} words
                </span>
              )}
              {article.created_at && (
                <span className="text-xs text-brand-muted flex items-center gap-1">
                  <Calendar size={12} /> {new Date(article.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {article.meta_title && (
        <div className="card">
          <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-2">SEO Preview</h3>
          <p className="text-sm text-blue-400 truncate">https://example.com/{article.id}</p>
          <p className="text-sm font-semibold text-brand-text mt-1">{article.meta_title}</p>
          <p className="text-sm text-brand-muted mt-0.5">{article.meta_description}</p>
          {article.tags?.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {article.tags.map((tag) => (
                <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-border text-brand-muted">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Content</h3>
        <div
          className="prose prose-invert prose-sm max-w-none text-brand-text/80 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: article.content_html || '<p>No content</p>' }}
        />
      </div>
    </div>
  );
}
