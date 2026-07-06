import { useState } from 'react';
import { Globe, Search, CheckCircle, XCircle, Lightbulb, Clock, Monitor } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { apiFetch } from '../api/client';

interface Engine {
  name: string;
  cited: boolean;
  url: string;
  snippet: string;
}

interface CitationData {
  clientId: string;
  domain: string;
  timestamp: string;
  engines: Engine[];
  citationCount: number;
  recommendations: string[];
}

interface CitationResponse {
  success: boolean;
  data: CitationData;
}

const engineColors: Record<string, string> = {
  ChatGPT: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  Perplexity: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Google AI Overviews': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Gemini: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  Claude: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Copilot: 'bg-green-500/10 text-green-400 border-green-500/20',
  Grok: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  DeepSeek: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

export default function CitationsPage() {
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<CitationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const check = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await apiFetch<CitationResponse>(`/api/ai-seo/citations/${encodeURIComponent(domain)}`);
      setResult(res);
    } catch {
      setError('Citation check failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const data = result?.data;

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

      {loading && (
        <div className="card py-12 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-brand-muted mt-3">Scanning AI engines...</p>
        </div>
      )}

      {error && (
        <div className="card text-center py-8">
          <XCircle size={32} className="text-red-400 mx-auto" />
          <p className="text-sm text-red-400 mt-2">{error}</p>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center py-5">
              <p className="text-3xl font-bold text-brand-accent">{data.citationCount}</p>
              <p className="text-xs text-brand-muted mt-1">Engines citing you</p>
            </div>
            <div className="card text-center py-5">
              <p className="text-3xl font-bold text-brand-text">{data.engines.length}</p>
              <p className="text-xs text-brand-muted mt-1">Engines checked</p>
            </div>
            <div className="card text-center py-5">
              <p className="text-3xl font-bold text-green-400">{data.recommendations.length}</p>
              <p className="text-xs text-brand-muted mt-1">Recommendations</p>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Monitor size={16} className="text-brand-accent" />
              <h3 className="text-sm font-semibold">Engine Results</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.engines.map((engine) => (
                <div
                  key={engine.name}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${engineColors[engine.name] || 'bg-brand-bg text-brand-text border-brand-border'}`}
                >
                  {engine.cited ? (
                    <CheckCircle size={18} className="text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{engine.name}</p>
                    <p className="text-xs opacity-70 mt-0.5 truncate">{engine.snippet || (engine.cited ? 'Cited' : 'Not cited')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-brand-border text-xs text-brand-muted">
              <span className="flex items-center gap-1">
                <Clock size={12} /> {new Date(data.timestamp).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Globe size={12} /> {data.domain}
              </span>
            </div>
          </div>

          {data.recommendations.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb size={16} className="text-brand-accent" />
                <h3 className="text-sm font-semibold">Recommendations</h3>
              </div>
              <ul className="space-y-2">
                {data.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-brand-text/80">
                    <span className="text-brand-accent font-bold shrink-0">{i + 1}.</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
