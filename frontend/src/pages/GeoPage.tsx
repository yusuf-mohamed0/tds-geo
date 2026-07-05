import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import PageHeader from '../components/PageHeader';
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
      setResult({ error: 'Analysis failed. Check API connection.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="GEO Analysis" description="Analyze content for Generative Engine Optimization readiness" />

      <div className="card">
        <label className="text-sm font-medium mb-2 block">Content</label>
        <textarea
          className="input h-48 resize-y font-mono text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste article content to analyze GEO readiness across ChatGPT, Perplexity, Gemini, Claude..."
        />
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-brand-muted">{content.length} characters</span>
          <button onClick={analyze} disabled={loading || !content.trim()} className="btn-primary flex items-center gap-2">
            {loading ? (
              <div className="animate-spin w-4 h-4 border-2 border-brand-bg border-t-transparent rounded-full" />
            ) : (
              <Sparkles size={16} />
            )}
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Search size={16} className="text-brand-accent" />
            <h3 className="text-sm font-semibold">Results</h3>
          </div>
          <pre className="text-xs overflow-auto max-h-96 leading-relaxed text-brand-text/80">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
