import { useState, useEffect } from 'react'
import { evaluationApi } from '../services/api'
import { QualityReport, BenchmarkResult } from '../types'
import { Card, CardHeader, CardBody } from '../components/Card'
import { useToast } from '../components/Toast'
import Icon from '../components/Icon'

type Tab = 'evaluate' | 'benchmarks' | 'ab_tests'

export default function AiEvaluation() {
  const [activeTab, setActiveTab] = useState<Tab>('evaluate')
  const [content, setContent] = useState('')
  const [keyword, setKeyword] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null)
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null)
  const [datasetId, setDatasetId] = useState('')
  const [runningBenchmark, setRunningBenchmark] = useState(false)
  const [abTestForm, setAbTestForm] = useState({ article_base_id: '', article_variant_id: '', test_name: '' })
  const [creatingAbTest, setCreatingAbTest] = useState(false)
  const { addToast } = useToast()

  const evaluateContent = async () => {
    if (!content.trim() || !keyword.trim()) return
    setEvaluating(true)
    setQualityReport(null)
    try {
      const data = await evaluationApi.generateQualityReport(content, keyword)
      setQualityReport(data.data || data)
      addToast('success', 'Quality report generated')
    } catch (err: any) {
      addToast('error', 'Failed to evaluate content')
    } finally {
      setEvaluating(false)
    }
  }

  const runBenchmark = async () => {
    if (!datasetId.trim()) return
    setRunningBenchmark(true)
    setBenchmarkResult(null)
    try {
      const data = await evaluationApi.runBenchmark(datasetId)
      setBenchmarkResult(data.data || data)
      addToast('success', 'Benchmark completed')
    } catch {
      addToast('error', 'Failed to run benchmark')
    } finally {
      setRunningBenchmark(false)
    }
  }

  const createAbTest = async () => {
    if (!abTestForm.article_base_id || !abTestForm.article_variant_id) return
    setCreatingAbTest(true)
    try {
      await evaluationApi.createAbTest(abTestForm)
      setAbTestForm({ article_base_id: '', article_variant_id: '', test_name: '' })
      addToast('success', 'A/B test created')
    } catch {
      addToast('error', 'Failed to create A/B test')
    } finally {
      setCreatingAbTest(false)
    }
  }

  const tabs = [
    { id: 'evaluate' as const, label: 'Evaluate Content' },
    { id: 'benchmarks' as const, label: 'Benchmarks' },
    { id: 'ab_tests' as const, label: 'A/B Tests' },
  ]

  const renderScoreBar = (label: string, score: number, maxScore = 100) => (
    <div style={{ marginBottom: 8 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
          {score.toFixed(0)}/{maxScore}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--gray-200)', borderRadius: 4 }}>
        <div style={{
          width: `${(score / maxScore) * 100}%`, height: '100%', borderRadius: 4,
          background: score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)',
          transition: 'width 0.5s ease',
        }} />
      </div>
      {score < 50 && (
        <div style={{ marginTop: 4 }}>
          {label === 'Readability' && qualityReport?.readability.issues?.map((issue, i) => (
            <p key={i} className="text-xs text-muted">• {issue}</p>
          ))}
          {label === 'SEO Quality' && qualityReport?.seo_quality.suggestions?.map((s, i) => (
            <p key={i} className="text-xs text-muted">• {s}</p>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h2>AI Evaluation</h2>
          <p>Quality reports, benchmarks, and A/B testing</p>
        </div>
      </div>

      <div className="page-body">
        <div className="tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Evaluate Tab */}
        {activeTab === 'evaluate' && (
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <Card>
              <CardHeader>Content to Evaluate</CardHeader>
              <CardBody>
                <div className="form-group">
                  <label>Content</label>
                  <textarea className="form-textarea" rows={10} value={content} onChange={e => setContent(e.target.value)} placeholder="Paste article content to evaluate..." />
                </div>
                <div className="form-group">
                  <label>Target Keyword</label>
                  <input className="form-input" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g., best SEO tools" />
                </div>
                <button className="btn btn-primary" onClick={evaluateContent} disabled={!content.trim() || !keyword.trim() || evaluating}>
                  {evaluating ? <><Icon name="loading" spin /> Evaluating...</> : <><Icon name="ai-evaluation" /> Generate Quality Report</>}
                </button>
              </CardBody>
            </Card>

            {qualityReport && (
              <Card>
                <CardHeader>
                  Quality Report
                  <span className={`badge badge-${qualityReport.overall_score >= 70 ? 'green' : qualityReport.overall_score >= 50 ? 'yellow' : 'red'}`}>
                    {qualityReport.overall_score.toFixed(0)}/100
                  </span>
                </CardHeader>
                <CardBody>
                  {renderScoreBar('Readability', qualityReport.readability?.score || 0)}
                  {renderScoreBar('SEO Quality', qualityReport.seo_quality?.score || 0)}
                  {renderScoreBar('Factual Accuracy', qualityReport.factual_accuracy?.score || 0)}
                  {renderScoreBar('Brand Consistency', qualityReport.brand_consistency?.score || 0)}
                  {renderScoreBar('Structure', qualityReport.structure?.score || 0)}

                  {qualityReport.recommendations?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <strong style={{ fontSize: 13, color: 'var(--warning)' }}>Recommendations</strong>
                      <ul style={{ margin: '8px 0 0 16px', fontSize: 12 }}>
                        {qualityReport.recommendations.map((r, i) => (
                          <li key={i} style={{ marginBottom: 4, color: 'var(--gray-600)' }}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        )}

        {/* Benchmarks Tab */}
        {activeTab === 'benchmarks' && (
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <Card>
              <CardHeader>Run Benchmark</CardHeader>
              <CardBody>
                <div className="form-group">
                  <label>Dataset ID</label>
                  <input className="form-input" value={datasetId} onChange={e => setDatasetId(e.target.value)} placeholder="Enter benchmark dataset ID" />
                </div>
                <button className="btn btn-primary" onClick={runBenchmark} disabled={!datasetId.trim() || runningBenchmark}>
                  {runningBenchmark ? <><Icon name="loading" spin /> Running...</> : <><Icon name="play" /> Run Benchmark</>}
                </button>
              </CardBody>
            </Card>

            {benchmarkResult && (
              <Card>
                <CardHeader>
                  Benchmark Results
                  <span className={`badge badge-${benchmarkResult.aggregate_score >= 70 ? 'green' : benchmarkResult.aggregate_score >= 50 ? 'yellow' : 'red'}`}>
                    {benchmarkResult.aggregate_score.toFixed(0)}%
                  </span>
                </CardHeader>
                <CardBody>
                  <div className="stats-grid" style={{ marginBottom: 16 }}>
                    <div className="stat-card" style={{ padding: 12 }}>
                      <div className="stat-icon green"><Icon name="completed" /></div>
                      <div><div className="stat-value" style={{ fontSize: 20 }}>{benchmarkResult.passed}</div><div className="stat-label">Passed</div></div>
                    </div>
                    <div className="stat-card" style={{ padding: 12 }}>
                      <div className="stat-icon red"><Icon name="failed" /></div>
                      <div><div className="stat-value" style={{ fontSize: 20 }}>{benchmarkResult.failed}</div><div className="stat-label">Failed</div></div>
                    </div>
                    <div className="stat-card" style={{ padding: 12 }}>
                      <div className="stat-icon yellow"><Icon name="warning" /></div>
                      <div><div className="stat-value" style={{ fontSize: 20 }}>{benchmarkResult.errors}</div><div className="stat-label">Errors</div></div>
                    </div>
                    <div className="stat-card" style={{ padding: 12 }}>
                      <div className="stat-icon purple"><Icon name="metric" /></div>
                      <div><div className="stat-value" style={{ fontSize: 20 }}>{benchmarkResult.total_tests}</div><div className="stat-label">Total</div></div>
                    </div>
                  </div>

                  {benchmarkResult.test_cases?.slice(0, 20).map((tc, i) => (
                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 12 }}>
                      <div className="flex items-center gap-2">
                        <Icon name={tc.score >= 0.7 ? 'completed' : tc.score >= 0.4 ? 'warning' : 'failed'} />
                        <span style={{ fontWeight: 500 }}>Test {i + 1}</span>
                        <span className="text-muted">Score: {(tc.score * 100).toFixed(0)}%</span>
                      </div>
                      {tc.error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{tc.error}</p>}
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}
          </div>
        )}

        {/* A/B Tests Tab */}
        {activeTab === 'ab_tests' && (
          <Card>
            <CardHeader>Create A/B Test</CardHeader>
            <CardBody>
              <div className="form-row">
                <div className="form-group">
                  <label>Base Article ID</label>
                  <input className="form-input" value={abTestForm.article_base_id} onChange={e => setAbTestForm({ ...abTestForm, article_base_id: e.target.value })} placeholder="Original article ID" />
                </div>
                <div className="form-group">
                  <label>Variant Article ID</label>
                  <input className="form-input" value={abTestForm.article_variant_id} onChange={e => setAbTestForm({ ...abTestForm, article_variant_id: e.target.value })} placeholder="Variant article ID" />
                </div>
              </div>
              <div className="form-group">
                <label>Test Name (optional)</label>
                <input className="form-input" value={abTestForm.test_name} onChange={e => setAbTestForm({ ...abTestForm, test_name: e.target.value })} placeholder="e.g., Headline A/B test" />
              </div>
              <button className="btn btn-primary" onClick={createAbTest} disabled={!abTestForm.article_base_id || !abTestForm.article_variant_id || creatingAbTest}>
                {creatingAbTest ? <><Icon name="loading" spin /> Creating...</> : <><Icon name="flask" /> Create A/B Test</>}
              </button>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  )
}
