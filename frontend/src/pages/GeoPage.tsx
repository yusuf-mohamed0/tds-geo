import { useState } from 'react';
import { Sparkles, CheckCircle, XCircle, Lightbulb, AlertTriangle, Target } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { apiFetch } from '../api/client';

interface GeoEngineScore {
  engine: string;
  score: number;
  passing: boolean;
  issues: string[];
  strengths: string[];
}

interface GeoAnalysis {
  overallScore: number;
  overallPassing: boolean;
  engines: GeoEngineScore[];
  suggestions: string[];
  entityDensity: number;
  definitionFirstScore: number;
  citationReadiness: number;
}

interface GeoResponse {
  success: boolean;
  data: GeoAnalysis;
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

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500/10 border-green-500/20';
  if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export default function GeoPage() {
  const [content, setContent] = useState('');
  const [result, setResult] = useState<GeoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await apiFetch<GeoResponse>('/api/geo/analyze', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setResult(res);
    } catch {
      setError('Analysis failed. Check API connection.');
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

      {loading && (
        <div className="card py-12 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-brand-muted mt-3">Analyzing content for GEO readiness...</p>
        </div>
      )}

      {error && (
        <div className="card py-8 text-center">
          <XCircle size={32} className="text-red-400 mx-auto" />
          <p className="text-sm text-red-400 mt-2">{error}</p>
        </div>
      )}

      {result?.data && (() => {
        const data = result.data;
        return (
          <>
            <div className="card text-center py-8">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-brand-border" />
                  <circle
                    cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8"
                    strokeDasharray={`${(data.overallScore / 100) * 339.292} 339.292`}
                    strokeLinecap="round"
                    className={scoreColor(data.overallScore)}
                  />
                </svg>
                <span className={`absolute text-3xl font-bold ${scoreColor(data.overallScore)}`}>
                  {data.overallScore}
                </span>
              </div>
              <p className="text-sm text-brand-muted mt-3">
                {data.overallPassing ? 'Passing — content is GEO-ready' : 'Needs improvement for AI engines'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Entity Density', value: `${Math.round(data.entityDensity)}%`, color: scoreColor(data.entityDensity * 33.3) },
                { label: 'Definition-First', value: `${data.definitionFirstScore}`, color: scoreColor(data.definitionFirstScore) },
                { label: 'Citation Readiness', value: `${data.citationReadiness}`, color: scoreColor(data.citationReadiness) },
              ].map((m) => (
                <div key={m.label} className="card text-center py-4">
                  <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-xs text-brand-muted mt-1">{m.label}</p>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Target size={16} className="text-brand-accent" />
                <h3 className="text-sm font-semibold">Engine Scores</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.engines.map((engine) => (
                  <div key={engine.engine} className={`rounded-lg border p-4 ${scoreBg(engine.score)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${engineColors[engine.engine]?.split(' ')[1] || 'text-brand-text'}`}>
                        {engine.engine}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-lg font-bold ${scoreColor(engine.score)}`}>{engine.score}</span>
                        {engine.passing ? (
                          <CheckCircle size={14} className="text-green-400" />
                        ) : (
                          <XCircle size={14} className="text-red-400" />
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-brand-border overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${engine.score >= 80 ? 'bg-green-400' : engine.score >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                        style={{ width: `${engine.score}%` }}
                      />
                    </div>
                    {engine.issues.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {engine.issues.map((issue, i) => (
                          <p key={i} className="text-xs text-red-400 flex items-start gap-1">
                            <AlertTriangle size={10} className="shrink-0 mt-0.5" /> {issue}
                          </p>
                        ))}
                      </div>
                    )}
                    {engine.strengths.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {engine.strengths.map((s, i) => (
                          <p key={i} className="text-xs text-green-400 flex items-start gap-1">
                            <CheckCircle size={10} className="shrink-0 mt-0.5" /> {s}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {data.suggestions.length > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb size={16} className="text-brand-accent" />
                  <h3 className="text-sm font-semibold">Suggestions</h3>
                </div>
                <ul className="space-y-2">
                  {data.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-brand-text/80">
                      <span className="text-brand-accent font-bold shrink-0">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
