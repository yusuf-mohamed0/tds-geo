import { useEffect, useState } from 'react';
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
      <h2 className="text-xl font-bold">Quality Scores</h2>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full" />
        </div>
      ) : lowQuality.length > 0 ? (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-brand-muted">
                <th className="text-left p-4 font-medium">Article ID</th>
                <th className="text-left p-4 font-medium">Score</th>
                <th className="text-left p-4 font-medium">Dimensions</th>
                <th className="text-left p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {lowQuality.map((e) => (
                <tr key={e.id} className="border-b border-brand-border">
                  <td className="p-4 font-mono text-xs">{e.articleId}</td>
                  <td className="p-4">
                    <span className={e.score < 50 ? 'text-red-400' : 'text-yellow-400'}>{e.score}/100</span>
                  </td>
                  <td className="p-4 text-brand-muted text-xs">
                    {e.dimensions ? Object.entries(e.dimensions).map(([k, v]) => `${k}: ${v}`).join(', ') : '-'}
                  </td>
                  <td className="p-4 text-brand-muted text-xs">
                    {new Date(e.evaluatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card text-center py-12 text-brand-muted">
          <p>No low-quality articles found. All scores are healthy.</p>
        </div>
      )}

      <div className="card">
        <h3 className="text-sm font-semibold mb-3">Evaluate Content</h3>
        <p className="text-sm text-brand-muted mb-4">
          Use the API directly to evaluate content quality:
        </p>
        <code className="text-xs bg-brand-bg p-3 rounded-lg block">
          POST /api/quality/evaluate {'{'} "articleId": "...", "content": "..." {'}'}
        </code>
      </div>
    </div>
  );
}
