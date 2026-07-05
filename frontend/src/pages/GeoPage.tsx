import { useState } from 'react';
import { apiFetch } from '../api/client';

export default function GeoPage() {
  const [content, setContent] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch<Record<string, unknown>>('/api/geo/analyze', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setResult(res);
    } catch {
      setResult({ error: 'Analysis failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-xl font-bold">GEO Content Analysis</h2>
      <textarea
        className="input h-48 resize-y"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste article content to analyze GEO readiness..."
      />
      <button onClick={analyze} disabled={loading} className="btn-primary">
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>
      {result && (
        <pre className="card text-sm overflow-auto max-h-96">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
