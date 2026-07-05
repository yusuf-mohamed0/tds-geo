import { useState } from 'react';
import { ScrollText, Globe, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
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
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="AI Citation Tracking" description="Check if your domain is cited across 7 AI engines" />

      <div className="card">
        <label className="text-sm font-medium mb-2 block">Domain</label>
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input
              className="input pl-9"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              onKeyDown={(e) => e.key === 'Enter' && check()}
            />
          </div>
          <button onClick={check} disabled={loading || !domain.trim()} className="btn-primary flex items-center gap-2">
            {loading ? (
              <div className="animate-spin w-4 h-4 border-2 border-brand-bg border-t-transparent rounded-full" />
            ) : (
              <Search size={16} />
            )}
            {loading ? 'Checking...' : 'Check'}
          </button>
        </div>
        <p className="text-xs text-brand-muted mt-2">Powered by 7 AI engines: ChatGPT, Perplexity, Gemini, Claude, Copilot, Grok, DeepSeek</p>
      </div>

      {citations && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ScrollText size={16} className="text-brand-accent" />
            <h3 className="text-sm font-semibold">Citation Results</h3>
          </div>
          {citations.error ? (
            <p className="text-sm text-red-400">{citations.error as string}</p>
          ) : (
            <pre className="text-xs overflow-auto max-h-96 leading-relaxed text-brand-text/80">
              {JSON.stringify(citations, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
