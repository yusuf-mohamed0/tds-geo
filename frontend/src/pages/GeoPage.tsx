import { useState } from 'react';
import { Page, Card, Text, Button, Spinner, Banner, BlockStack, InlineStack, Badge } from '@shopify/polaris';
import { Sparkles, Globe, FileText, CheckCircle, XCircle, Lightbulb, AlertTriangle, Target, Zap, Search, TrendingUp, BookOpen } from 'lucide-react';
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

interface GeoResponse { success: boolean; data: GeoAnalysis; }
interface UrlResponse { success: boolean; data: UrlResult; }

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--p-color-text-success)';
  if (score >= 60) return 'var(--p-color-text-warning)';
  return 'var(--p-color-text-critical)';
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: 'var(--p-space-400)' }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={96} height={96} viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--p-color-border)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54" fill="none" stroke={scoreColor(score)} strokeWidth="8"
              strokeDasharray={`${(score / 100) * 339.292} 339.292`}
              strokeLinecap="round"
            />
          </svg>
          <span style={{ position: 'absolute', fontSize: 'var(--p-font-size-500)', fontWeight: 'var(--p-font-weight-bold)', color: scoreColor(score) }}>{score}</span>
        </div>
        <div style={{ marginTop: 'var(--p-space-200)' }}><Text as="p" variant="bodySm" tone="subdued">{label}</Text></div>
      </div>
    </Card>
  );
}

function EngineCard({ engine }: { engine: GeoEngineScore }) {
  const bg = engine.score >= 80 ? 'rgba(34,197,94,0.05)' : engine.score >= 60 ? 'rgba(234,179,8,0.05)' : 'rgba(239,68,68,0.05)';
  const border = engine.score >= 80 ? 'rgba(34,197,94,0.2)' : engine.score >= 60 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)';
  const bar = engine.score >= 80 ? 'var(--p-color-bg-fill-success)' : engine.score >= 60 ? 'var(--p-color-bg-fill-warning)' : 'var(--p-color-bg-fill-critical)';

  return (
    <div style={{ borderRadius: 'var(--p-space-200)', border: `1px solid ${border}`, background: bg, padding: 'var(--p-space-400)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--p-space-200)' }}>
        <Text as="span" variant="bodyMd" fontWeight="medium">{engine.engine}</Text>
        <InlineStack gap="100" blockAlign="center">
          <span style={{ fontWeight: 'var(--p-font-weight-bold)', color: scoreColor(engine.score) }}>{engine.score}</span>
          {engine.passing ? <CheckCircle size={14} style={{ color: 'var(--p-color-icon-success)' }} /> : <XCircle size={14} style={{ color: 'var(--p-color-icon-critical)' }} />}
        </InlineStack>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--p-color-bg)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, background: bar, width: `${engine.score}%` }} />
      </div>
      {engine.issues.length > 0 && (
        <div style={{ marginTop: 'var(--p-space-200)' }}>
          {engine.issues.map((issue, i) => (
            <div key={i} style={{ marginBottom: 'var(--p-space-050)' }}>
              <InlineStack gap="100" blockAlign="start">
                <AlertTriangle size={10} style={{ color: 'var(--p-color-icon-critical)', flexShrink: 0, marginTop: 2 }} />
                <Text as="span" variant="bodyXs" tone="critical">{issue}</Text>
              </InlineStack>
            </div>
          ))}
        </div>
      )}
      {engine.strengths.length > 0 && (
        <div style={{ marginTop: 'var(--p-space-100)' }}>
          {engine.strengths.map((s, i) => (
            <div key={i} style={{ marginBottom: 'var(--p-space-050)' }}>
              <InlineStack gap="100" blockAlign="start">
                <CheckCircle size={10} style={{ color: 'var(--p-color-icon-success)', flexShrink: 0, marginTop: 2 }} />
                <Text as="span" variant="bodyXs" tone="success">{s}</Text>
              </InlineStack>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisSummary({ analysis }: { analysis: GeoAnalysis }) {
  return (
    <BlockStack gap="400">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ScoreRing score={analysis.overallScore} label="Overall GEO Score" />
        <ScoreRing score={analysis.definitionFirstScore} label="Definition-First" />
        <ScoreRing score={Math.round(analysis.entityDensity)} label="Entity Density" />
        <ScoreRing score={analysis.citationReadiness} label="Citation Readiness" />
      </div>
      <Card>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Target size={16} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
            <Text as="h3" variant="headingSm">Engine Scores</Text>
          </InlineStack>
          {analysis.engines.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {analysis.engines.map((engine) => <EngineCard key={engine.engine} engine={engine} />)}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
              <Text as="p" variant="bodyMd" tone="subdued">No engine scores were returned for this analysis.</Text>
            </div>
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

function DeepAnalysisSection({ deepAnalysis }: { deepAnalysis: UrlResult['deepAnalysis'] }) {
  if (!deepAnalysis.summary && deepAnalysis.topIssues.length === 0) return null;

  return (
    <BlockStack gap="400">
      {deepAnalysis.summary && (
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <Search size={16} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
              <Text as="h3" variant="headingSm">LLM Audit Summary</Text>
            </InlineStack>
            <Text as="p" variant="bodyMd">{deepAnalysis.summary}</Text>
          </BlockStack>
        </Card>
      )}

      {deepAnalysis.engineSpecific.length > 0 && (
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" blockAlign="center">
              <TrendingUp size={16} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
              <Text as="h3" variant="headingSm">Per-Engine Verdict</Text>
            </InlineStack>
            <div className="grid gap-3 sm:grid-cols-2">
              {deepAnalysis.engineSpecific.map((e) => (
                <div key={e.engine} style={{
                  borderRadius: 'var(--p-space-200)', border: '1px solid',
                  borderColor: e.verdict === 'passing' ? 'rgba(34,197,94,0.2)' : e.verdict === 'needs-work' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)',
                  background: e.verdict === 'passing' ? 'rgba(34,197,94,0.05)' : e.verdict === 'needs-work' ? 'rgba(234,179,8,0.05)' : 'rgba(239,68,68,0.05)',
                  padding: 'var(--p-space-400)',
                }}>
                  <div style={{ marginBottom: 'var(--p-space-200)' }}>
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="span" variant="bodyMd" fontWeight="medium">{e.engine}</Text>
                      <Badge tone={e.verdict === 'passing' ? 'success' : e.verdict === 'needs-work' ? 'warning' : 'critical'}>{e.verdict}</Badge>
                    </InlineStack>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 'var(--p-space-300)' }}>
                    {e.details.map((d, i) => (
                      <li key={i} style={{ marginBottom: 'var(--p-space-050)' }}>
                        <Text as="span" variant="bodySm" tone="subdued">{d}</Text>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </BlockStack>
        </Card>
      )}

      {deepAnalysis.topIssues.length > 0 && (
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <XCircle size={16} style={{ color: 'var(--p-color-icon-critical)' }} />
              <Text as="h3" variant="headingSm" tone="critical">Critical Issues Found</Text>
            </InlineStack>
            <ul style={{ margin: 0, paddingLeft: 'var(--p-space-400)' }}>
              {deepAnalysis.topIssues.map((issue, i) => (
                <li key={i} style={{ marginBottom: 'var(--p-space-100)' }}>
                  <InlineStack gap="200" blockAlign="start">
                    <AlertTriangle size={14} style={{ color: 'var(--p-color-icon-critical)', flexShrink: 0, marginTop: 2 }} />
                    <Text as="span" variant="bodyMd">{issue}</Text>
                  </InlineStack>
                </li>
              ))}
            </ul>
          </BlockStack>
        </Card>
      )}

      {deepAnalysis.quickWins.length > 0 && (
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <Zap size={16} style={{ color: 'var(--p-color-icon-success)' }} />
              <Text as="h3" variant="headingSm" tone="success">Quick Wins</Text>
            </InlineStack>
            <ul style={{ margin: 0, paddingLeft: 'var(--p-space-400)' }}>
              {deepAnalysis.quickWins.map((win, i) => (
                <li key={i} style={{ marginBottom: 'var(--p-space-100)' }}>
                  <InlineStack gap="200" blockAlign="start">
                    <Zap size={14} style={{ color: 'var(--p-color-bg-fill-warning)', flexShrink: 0, marginTop: 2 }} />
                    <Text as="span" variant="bodyMd">{win}</Text>
                  </InlineStack>
                </li>
              ))}
            </ul>
          </BlockStack>
        </Card>
      )}

      {deepAnalysis.strategicRecommendations.length > 0 && (
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <BookOpen size={16} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
              <Text as="h3" variant="headingSm">Strategic Recommendations</Text>
            </InlineStack>
            <ul style={{ margin: 0, paddingLeft: 'var(--p-space-400)' }}>
              {deepAnalysis.strategicRecommendations.map((rec, i) => (
                <li key={i} style={{ marginBottom: 'var(--p-space-100)' }}>
                  <Text as="span" variant="bodyMd">{rec}</Text>
                </li>
              ))}
            </ul>
          </BlockStack>
        </Card>
      )}
    </BlockStack>
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
    <Page title="GEO Analysis" subtitle="Full website audit for Generative Engine Optimization readiness">
      <div style={{ maxWidth: 1000 }}><BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <div style={{ display: 'flex', gap: 'var(--p-space-100)', background: 'var(--p-color-bg)', borderRadius: 'var(--p-space-200)', padding: 'var(--p-space-100)', width: 'fit-content' }}>
              <Button variant={mode === 'content' ? 'primary' : 'tertiary'} onClick={() => { setMode('content'); setStage('input'); }}>
                Paste Content
              </Button>
              <Button variant={mode === 'url' ? 'primary' : 'tertiary'} onClick={() => { setMode('url'); setStage('input'); }}>
                Enter URL
              </Button>
            </div>

            {mode === 'content' ? (
              <>
                <textarea
                  aria-label="Content to analyze"
                  className="input"
                  style={{ height: 192, resize: 'vertical', fontFamily: 'monospace', fontSize: 'var(--p-font-size-300)' }}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste article content to analyze GEO readiness across ChatGPT, Perplexity, Gemini, Claude..."
                />
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodySm" tone="subdued">{content.length} characters</Text>
                  <Button variant="primary" onClick={analyze} disabled={stage === 'loading' || !content.trim()} loading={stage === 'loading'}>
                    Analyze
                  </Button>
                </InlineStack>
              </>
            ) : (
              <BlockStack gap="300">
                <Text as="span" variant="bodyMd" fontWeight="medium">Website URL</Text>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative w-full min-w-0 sm:max-w-[500px] sm:flex-1">
                    <Globe size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--p-color-text-secondary)' }} />
                    <input
                      aria-label="Website URL"
                      className="input"
                      style={{ paddingLeft: 36 }}
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com"
                      onKeyDown={(e) => e.key === 'Enter' && analyze()}
                    />
                  </div>
                  <Button variant="primary" onClick={analyze} disabled={stage === 'loading' || !url.trim()} loading={stage === 'loading'}>
                    Audit Site
                  </Button>
                </div>
                <Text as="p" variant="bodyXs" tone="subdued">Fetches the page, extracts content, runs rule-based + AI-powered deep analysis</Text>
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {stage === 'loading' && (
          <Card>
            <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
              <Spinner accessibilityLabel="Analyzing" size="large" />
              <div style={{ marginTop: 'var(--p-space-400)' }}><Text as="p" variant="bodyMd">{mode === 'url' ? 'Fetching page content and running deep AI analysis...' : 'Analyzing content for GEO readiness...'}</Text></div>
              <div style={{ marginTop: 'var(--p-space-100)' }}><Text as="p" variant="bodySm" tone="subdued">Scanning across 7 AI engines</Text></div>
            </div>
          </Card>
        )}

        {error && <Banner tone="critical">{error}</Banner>}

        {stage === 'result' && urlResult?.data && (
          <>
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Globe size={16} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                  <Text as="h3" variant="headingSm">Page Audit</Text>
                </InlineStack>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div><Text as="p" variant="bodyXs" tone="subdued">URL</Text><Text as="p" variant="bodySm" truncate>{urlResult.data.url}</Text></div>
                  <div><Text as="p" variant="bodyXs" tone="subdued">Title</Text><Text as="p" variant="bodySm" truncate>{urlResult.data.pageTitle}</Text></div>
                  <div><Text as="p" variant="bodyXs" tone="subdued">Word Count</Text><Text as="p" variant="bodySm">{urlResult.data.wordCount.toLocaleString()}</Text></div>
                  <div><Text as="p" variant="bodyXs" tone="subdued">Headings</Text><Text as="p" variant="bodySm">{urlResult.data.headings.length}</Text></div>
                </div>
                {urlResult.data.metaDescription && (
                  <div style={{ paddingTop: 'var(--p-space-300)', borderTop: '1px solid var(--p-color-border)' }}>
                    <Text as="p" variant="bodyXs" tone="subdued">Meta Description</Text>
                    <div style={{ marginTop: 'var(--p-space-100)' }}><Text as="p" variant="bodySm">{urlResult.data.metaDescription}</Text></div>
                  </div>
                )}
                {urlResult.data.headings.length > 0 && (
                  <div style={{ paddingTop: 'var(--p-space-300)', borderTop: '1px solid var(--p-color-border)' }}>
                    <Text as="p" variant="bodyXs" tone="subdued">Page Structure</Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--p-space-100)', marginTop: 'var(--p-space-100)' }}>
                      {urlResult.data.headings.slice(0, 15).map((h, i) => (
                        <span key={i} className={`text-xs px-2 py-0.5 rounded ${h.level === 1 ? 'bg-brand-accent/20 text-brand-accent' : h.level === 2 ? 'bg-blue-500/20 text-blue-400' : 'bg-brand-border text-brand-muted'}`}>
                          {'  '.repeat(h.level - 1)}H{h.level}: {h.text.slice(0, 40)}{h.text.length > 40 ? '...' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </BlockStack>
            </Card>
            <AnalysisSummary analysis={urlResult.data.analysis} />
            <DeepAnalysisSection deepAnalysis={urlResult.data.deepAnalysis} />
          </>
        )}

        {stage === 'result' && contentResult?.data && (
          <BlockStack gap="400">
            <AnalysisSummary analysis={contentResult.data} />
            {contentResult.data.suggestions.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Lightbulb size={16} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                    <Text as="h3" variant="headingSm">Suggestions</Text>
                  </InlineStack>
                  <ul style={{ margin: 0, paddingLeft: 'var(--p-space-400)' }}>
                    {contentResult.data.suggestions.map((s, i) => (
                      <li key={i} style={{ marginBottom: 'var(--p-space-100)' }}>
                        <Text as="span" variant="bodyMd">{s}</Text>
                      </li>
                    ))}
                  </ul>
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        )}
      </BlockStack></div>
    </Page>
  );
}
