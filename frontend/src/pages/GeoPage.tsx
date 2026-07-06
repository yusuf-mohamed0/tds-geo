import { useState } from 'react';
import { Sparkles, Globe, FileText, CheckCircle, XCircle, Lightbulb, AlertTriangle, Target, Zap, Search, TrendingUp, BookOpen } from 'lucide-react';
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

interface UrlResult {
  success: boolean;
  url: string;
  title: string;
  pageTitle: string;
  metaDescription: string;
  wordCount: number;
  headings: { level: number; text: string }[];
  analysis: GeoAnalysis;
  deepAnalysis: {
    summary: string;
    engineSpecific: { engine: string; verdict: string; details: string[] }[];
    topIssues: string[];
    quickWins: string[];
    strategicRecommendations: string[];
  };
}

interface GeoResponse {
  success: boolean;
  data: GeoAnalysis;
}

interface UrlResponse {
  success: boolean;
  data: UrlResult;
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

function ScoreRing({ score, label }: { score: number; label: string }) {
  return (
    <div className="card text-center py-6">
      <div className="relative inline-flex items-center justify-center">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-brand-border" />
          <circle
            cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8"
            strokeDasharray={`${(score / 100) * 339.292} 339.292`}
            strokeLinecap="round"
            className={scoreColor(score)}
          />
        </svg>
        <span className={`absolute text-2xl font-bold ${scoreColor(score)}`}>{score}</span>
      </div>
      <p className="text-xs text-brand-muted mt-2">{label}</p>
    </div>
  );
}

function EngineCard({ engine }: { engine: GeoEngineScore }) {
  return (
    <div className={`rounded-lg border p-4 ${scoreBg(engine.score)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${engineColors[engine.engine]?.split(' ')[1] || 'text-brand-text'}`}>
          {engine.engine}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`text-lg font-bold ${scoreColor(engine.score)}`}>{engine.score}</span>
          {engine.passing ? <CheckCircle size={14} className="text-green-400" /> : <XCircle size={14} className="text-red-400" />}
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
            <p key={i} className="text-xs text-red-400 flex items-start gap-1"><AlertTriangle size={10} className="shrink-0 mt-0.5" /> {issue}</p>
          ))}
        </div>
      )}
      {engine.strengths.length > 0 && (
        <div className="mt-2 space-y-1">
          {engine.strengths.map((s, i) => (
            <p key={i} className="text-xs text-green-400 flex items-start gap-1"><CheckCircle size={10} className="shrink-0 mt-0.5" /> {s}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisSummary({ analysis }: { analysis: GeoAnalysis }) {
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <ScoreRing score={analysis.overallScore} label="Overall GEO Score" />
        <ScoreRing score={analysis.definitionFirstScore} label="Definition-First" />
        <ScoreRing score={Math.round(analysis.entityDensity)} label="Entity Density" />
        <ScoreRing score={analysis.citationReadiness} label="Citation Readiness" />
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4"><Target size={16} className="text-brand-accent" /><h3 className="text-sm font-semibold">Engine Scores</h3></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {analysis.engines.map((engine) => <EngineCard key={engine.engine} engine={engine} />)}
        </div>
      </div>
    </>
  );
}

function DeepAnalysisSection({ deepAnalysis }: { deepAnalysis: UrlResult['deepAnalysis'] }) {
  if (!deepAnalysis.summary && deepAnalysis.topIssues.length === 0) return null;

  return (
    <>
      {deepAnalysis.summary && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3"><Search size={16} className="text-brand-accent" /><h3 className="text-sm font-semibold">LLM Audit Summary</h3></div>
          <p className="text-sm text-brand-text/80 leading-relaxed">{deepAnalysis.summary}</p>
        </div>
      )}

      {deepAnalysis.engineSpecific.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4"><TrendingUp size={16} className="text-brand-accent" /><h3 className="text-sm font-semibold">Per-Engine Verdict</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {deepAnalysis.engineSpecific.map((e) => (
              <div key={e.engine} className={`rounded-lg border p-4 ${e.verdict === 'passing' ? 'bg-green-500/5 border-green-500/20' : e.verdict === 'needs-work' ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm font-medium ${engineColors[e.engine]?.split(' ')[1] || 'text-brand-text'}`}>{e.engine}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${e.verdict === 'passing' ? 'bg-green-500/20 text-green-400' : e.verdict === 'needs-work' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{e.verdict}</span>
                </div>
                <ul className="space-y-1">
                  {e.details.map((d, i) => (
                    <li key={i} className="text-xs text-brand-text/70 flex items-start gap-1"><span className="text-brand-muted">•</span> {d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {deepAnalysis.topIssues.length > 0 && (
        <div className="card border-red-500/20">
          <div className="flex items-center gap-2 mb-3"><XCircle size={16} className="text-red-400" /><h3 className="text-sm font-semibold text-red-400">Critical Issues Found</h3></div>
          <ul className="space-y-2">
            {deepAnalysis.topIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-brand-text/80">
                <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {deepAnalysis.quickWins.length > 0 && (
        <div className="card border-green-500/20">
          <div className="flex items-center gap-2 mb-3"><Zap size={16} className="text-green-400" /><h3 className="text-sm font-semibold text-green-400">Quick Wins</h3></div>
          <ul className="space-y-2">
            {deepAnalysis.quickWins.map((win, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-brand-text/80">
                <Zap size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                <span>{win}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {deepAnalysis.strategicRecommendations.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3"><BookOpen size={16} className="text-brand-accent" /><h3 className="text-sm font-semibold">Strategic Recommendations</h3></div>
          <ul className="space-y-2">
            {deepAnalysis.strategicRecommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-brand-text/80">
                <span className="text-brand-accent font-bold shrink-0">{i + 1}.</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

type Mode = 'content' | 'url';
type Stage = 'input' | 'loading' | 'result';

export default function GeoPage() {
  const [mode, setMode] = useState<Mode>('content');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [error, setError] = useState('');
  const [contentResult, setContentResult] = useState<GeoResponse | null>(null);
  const [urlResult, setUrlResult] = useState<UrlResponse | null>(null);

  const analyze = async () => {
    setError('');
    setStage('loading');
    setContentResult(null);
    setUrlResult(null);
    try {
      if (mode === 'content') {
        const res = await apiFetch<GeoResponse>('/api/geo/analyze', {
          method: 'POST',
          body: JSON.stringify({ content }),
        });
        setContentResult(res);
      } else {
        const res = await apiFetch<UrlResponse>('/api/geo/analyze-url', {
          method: 'POST',
          body: JSON.stringify({ url }),
        });
        setUrlResult(res);
      }
      setStage('result');
    } catch (err) {
      setError((err as Error).message || 'Analysis failed. Try again.');
      setStage('input');
    }
  };

  const llmDeep = urlResult?.data?.deepAnalysis;
  const analysis = urlResult?.data?.analysis || contentResult?.data;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title="GEO Analysis" description="Full website audit for Generative Engine Optimization readiness" />

      <div className="card">
        <div className="flex gap-1 mb-4 bg-brand-bg rounded-lg p-1 w-fit">
          <button onClick={() => { setMode('content'); setStage('input'); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'content' ? 'bg-brand-accent text-brand-bg' : 'text-brand-muted hover:text-brand-text'}`}>
            <FileText size={14} className="inline mr-1.5" />Paste Content
          </button>
          <button onClick={() => { setMode('url'); setStage('input'); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'url' ? 'bg-brand-accent text-brand-bg' : 'text-brand-muted hover:text-brand-text'}`}>
            <Globe size={14} className="inline mr-1.5" />Enter URL
          </button>
        </div>

        {mode === 'content' ? (
          <>
            <textarea
              className="input h-48 resize-y font-mono text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste article content to analyze GEO readiness across ChatGPT, Perplexity, Gemini, Claude..."
            />
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-brand-muted">{content.length} characters</span>
              <button onClick={analyze} disabled={stage === 'loading' || !content.trim()} className="btn-primary flex items-center gap-2">
                {stage === 'loading' ? <div className="animate-spin w-4 h-4 border-2 border-brand-bg border-t-transparent rounded-full" /> : <Sparkles size={16} />}
                {stage === 'loading' ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="text-sm font-medium mb-2 block">Website URL</label>
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-lg">
                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  className="input pl-9"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  onKeyDown={(e) => e.key === 'Enter' && analyze()}
                />
              </div>
              <button onClick={analyze} disabled={stage === 'loading' || !url.trim()} className="btn-primary flex items-center gap-2">
                {stage === 'loading' ? <div className="animate-spin w-4 h-4 border-2 border-brand-bg border-t-transparent rounded-full" /> : <Search size={16} />}
                {stage === 'loading' ? 'Auditing...' : 'Audit Site'}
              </button>
            </div>
            <p className="text-xs text-brand-muted mt-2">Fetches the page, extracts content, runs rule-based + AI-powered deep analysis</p>
          </>
        )}
      </div>

      {stage === 'loading' && (
        <div className="card py-16 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-brand-muted mt-4">{mode === 'url' ? 'Fetching page content and running deep AI analysis...' : 'Analyzing content for GEO readiness...'}</p>
          <p className="text-xs text-brand-muted/50 mt-1">Scanning across 7 AI engines</p>
        </div>
      )}

      {error && (
        <div className="card py-8 text-center">
          <XCircle size={32} className="text-red-400 mx-auto" />
          <p className="text-sm text-red-400 mt-2">{error}</p>
        </div>
      )}

      {stage === 'result' && urlResult?.data && (
        <>
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><Globe size={16} className="text-brand-accent" /><h3 className="text-sm font-semibold">Page Audit</h3></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><span className="text-brand-muted text-xs">URL</span><p className="truncate">{urlResult.data.url}</p></div>
              <div><span className="text-brand-muted text-xs">Title</span><p className="truncate">{urlResult.data.pageTitle}</p></div>
              <div><span className="text-brand-muted text-xs">Word Count</span><p>{urlResult.data.wordCount.toLocaleString()}</p></div>
              <div><span className="text-brand-muted text-xs">Headings</span><p>{urlResult.data.headings.length}</p></div>
            </div>
            {urlResult.data.metaDescription && (
              <div className="mt-3 pt-3 border-t border-brand-border">
                <span className="text-brand-muted text-xs">Meta Description</span>
                <p className="text-sm text-brand-text/70 mt-0.5">{urlResult.data.metaDescription}</p>
              </div>
            )}
            {urlResult.data.headings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-brand-border">
                <span className="text-brand-muted text-xs">Page Structure</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {urlResult.data.headings.slice(0, 15).map((h, i) => (
                    <span key={i} className={`text-xs px-2 py-0.5 rounded ${h.level === 1 ? 'bg-brand-accent/20 text-brand-accent' : h.level === 2 ? 'bg-blue-500/20 text-blue-400' : 'bg-brand-border text-brand-muted'}`}>
                      {'  '.repeat(h.level - 1)}H{h.level}: {h.text.slice(0, 40)}{h.text.length > 40 ? '...' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <AnalysisSummary analysis={urlResult.data.analysis} />
          <DeepAnalysisSection deepAnalysis={urlResult.data.deepAnalysis} />
        </>
      )}

      {stage === 'result' && contentResult?.data && (
        <>
          <AnalysisSummary analysis={contentResult.data} />
          {contentResult.data.suggestions.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4"><Lightbulb size={16} className="text-brand-accent" /><h3 className="text-sm font-semibold">Suggestions</h3></div>
              <ul className="space-y-2">
                {contentResult.data.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-brand-text/80">
                    <span className="text-brand-accent font-bold shrink-0">{i + 1}.</span>
                    <span>{s}</span>
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
