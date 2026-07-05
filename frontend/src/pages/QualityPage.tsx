import { useEffect, useState } from 'react';
import { CheckSquare, TrendingDown, TrendingUp } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { apiFetch } from '../api/client';

interface Evaluation {
  id: string;
  articleId: string;
  score: number;
  dimensions: Record<string, number>;
  evaluatedAt: string;
}

export default function QualityPage() {
  const [lowQuality, setLowQuality] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: Evaluation[] }>('/api/quality/low-quality')
      .then((res) => setLowQuality(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Quality Scores" description="Article quality evaluation and scoring" />

      {loading ? (
        <div className="card animate-pulse space-y-3 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-brand-border rounded-lg" />
          ))}
        </div>
      ) : lowQuality.length > 0 ? (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-brand-muted text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-medium">Article ID</th>
                <th className="text-left p-4 font-medium">Score</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Dimensions</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {lowQuality.map((e) => (
                <tr key={e.id} className="border-b border-brand-border/60 hover:bg-brand-border/30 transition-colors">
                  <td className="p-4 font-mono text-xs text-brand-muted">{e.id.slice(0, 8)}...</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {e.score < 50 ? <TrendingDown size={14} className="text-red-400" /> : <TrendingUp size={14} className="text-yellow-400" />}
                      <span className={e.score < 50 ? 'text-red-400 font-medium' : 'text-yellow-400 font-medium'}>{e.score}/100</span>
                    </div>
                  </td>
                  <td className="p-4 text-brand-muted text-xs hidden md:table-cell">
                    {e.dimensions ? Object.entries(e.dimensions).map(([k, v]) => `${k}: ${v}`).join(', ') : '-'}
                  </td>
                  <td className="p-4 text-brand-muted text-xs hidden sm:table-cell">
                    {new Date(e.evaluatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card text-center py-16">
          <CheckSquare size={40} className="mx-auto text-green-400/40" />
          <p className="text-brand-muted mt-4 font-medium">All articles are healthy</p>
          <p className="text-sm text-brand-muted/60 mt-1">No low-quality scores detected</p>
        </div>
      )}

      <div className="card bg-brand-accent/5 border-brand-accent/20">
        <div className="flex items-center gap-2 mb-3">
          <CheckSquare size={16} className="text-brand-accent" />
          <h3 className="text-sm font-semibold">Evaluate Content</h3>
        </div>
        <p className="text-sm text-brand-muted mb-3">Use the API to evaluate content quality programmatically:</p>
        <code className="text-xs bg-brand-bg p-3 rounded-lg block">
          POST /api/quality/evaluate {'{'} "articleId": "...", "content": "..." {'}'}
        </code>
      </div>
    </div>
  );
}
