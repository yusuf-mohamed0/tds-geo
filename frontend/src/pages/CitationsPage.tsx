import { useState } from 'react';
import { apiFetch } from '../api/client';

export default function CitationsPage() {
  const [domain, setDomain] = useState('');
  const [citations, setCitations] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch<Record<string, unknown>>(`/api/ai-seo/citations/${encodeURIComponent(domain)}`);
      setCitations(res);
    } catch {
      setCitations({ error: 'Citation check failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-xl font-bold">AI Citation Tracking</h2>
      <p className="text-sm text-brand-muted">
        Check if your domain is cited across 7 AI engines (ChatGPT, Perplexity, Gemini, Claude, etc.)
      </p>
      <div className="flex gap-3">
        <input
          className="input max-w-sm"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
        />
        <button onClick={check} disabled={loading} className="btn-primary">
          {loading ? 'Checking...' : 'Check Citations'}
        </button>
      </div>
      {citations && (
        <pre className="card text-sm overflow-auto max-h-96">
          {JSON.stringify(citations, null, 2)}
        </pre>
      )}
    </div>
  );
}
