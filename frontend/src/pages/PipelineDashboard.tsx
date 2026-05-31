import { useState, useEffect } from 'react'
import { pipelineApi, clientsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Card, CardHeader, CardBody } from '../components/Card'

interface PipelineStage {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  duration_ms?: number
  started_at?: string
  completed_at?: string
}

interface PipelineHistoryItem {
  id: string
  keyword: string
  title?: string
  success: boolean
  duration?: string
  stages: PipelineStage[]
  created_at: string
}

const STAGE_ICONS: Record<string, string> = {
  keyword_discovery: '🔑', search_intent: '🎯', serp_entity_analysis: '🔍',
  semantic_dedup: '🧹', brand_voice: '🎙️', title_generation: '📝',
  outline_generation: '📋', article_generation: '✍️', seo_enhancement: '📈',
  quality_gate: '🛡️', fact_checking: '✅', brand_consistency: '🎯',
  cannibalization_check: '⚠️', content_safety: '🛡️', html_conversion: '🔧',
  internal_linking: '🔗', pexels_images: '🖼️', faq_schema: '❓',
  cta_insertion: '📢', article_storage: '💾', vector_embedding: '🧠',
  quality_evaluation: '⭐', topic_saturation: '📊', editorial_workflow: '👥',
  publishing: '🚀', webhook_notification: '🔔',
}

const STATUS_ICONS: Record<string, string> = {
  pending: '⏳', running: '🔄', completed: '✅', failed: '❌', skipped: '⏭️',
}

export default function PipelineDashboard() {
  const { user } = useAuth()
  const [history, setHistory] = useState<PipelineHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedPipeline, setExpandedPipeline] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [running, setRunning] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')

  // Users with a client_id (editors, client role) use their own; admins get a selector
  const effectiveClientId = user?.client_id || selectedClientId

  const fetchClients = async () => {
    if (user?.client_id) {
      // User has an assigned client — use it directly
      setSelectedClientId('')
      return
    }
    try {
      const data = await clientsApi.list()
      const list = data.clients || data.data || []
      setClients(list)
      if (list.length > 0) {
        setSelectedClientId(list[0].id)
      }
    } catch {
      // Client fetch best-effort
    }
  }

  const fetchHistory = async () => {
    if (!effectiveClientId) {
      setLoading(false)
      return
    }
    try {
      const data = await pipelineApi.getHistory(effectiveClientId)
      setHistory(data.data || [])
    } catch {
      // Pipeline history might not be available yet
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  useEffect(() => {
    if (effectiveClientId) {
      setLoading(true)
      fetchHistory()
    }
  }, [effectiveClientId])

  const runPipeline = async () => {
    if (!keyword.trim() || !effectiveClientId) return
    setRunning(true)
    setError('')
    try {
      await pipelineApi.run({ keyword: keyword.trim(), client_id: effectiveClientId })
      setKeyword('')
      fetchHistory()
    } catch {
      setError('Failed to run pipeline')
    } finally {
      setRunning(false)
    }
  }

  const getStatusCounts = () => {
    const counts = { running: 0, completed: 0, failed: 0, total: history.length }
    history.forEach(h => {
      if (h.stages?.some(s => s.status === 'running')) counts.running++
      else if (h.success) counts.completed++
      else counts.failed++
    })
    return counts
  }

  const counts = getStatusCounts()

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Pipeline Dashboard</h2>
          <p>Enterprise content generation pipeline visualization</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!user?.client_id && clients.length > 0 && (
            <select
              className="form-input"
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              style={{ width: 220 }}
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <input className="form-input" placeholder="Keyword to generate..." value={keyword} onChange={e => setKeyword(e.target.value)} style={{ width: 280 }} />
          <button className="btn btn-primary" onClick={runPipeline} disabled={!keyword.trim() || !effectiveClientId || running}>
            {running ? '⏳ Running...' : '🚀 Run Pipeline'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">🔄</div>
            <div><div className="stat-value">{counts.running}</div><div className="stat-label">Running</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">✅</div>
            <div><div className="stat-value">{counts.completed}</div><div className="stat-label">Completed</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red">❌</div>
            <div><div className="stat-value">{counts.failed}</div><div className="stat-label">Failed</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">📊</div>
            <div><div className="stat-value">{counts.total}</div><div className="stat-label">Total Runs</div></div>
          </div>
        </div>

        <Card>
          <CardHeader>Pipeline History</CardHeader>
          <CardBody>
            {loading ? <div className="empty-state"><div className="spinner" /></div> : history.length === 0 ? (
              <div className="empty-state">
                <p>No pipeline runs yet. Enter a keyword above to run the enterprise pipeline.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {history.map(h => (
                  <div key={h.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div
                      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--gray-50)' }}
                      onClick={() => setExpandedPipeline(expandedPipeline === h.id ? null : h.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 18 }}>{h.success ? '✅' : '❌'}</span>
                        <div>
                          <span style={{ fontWeight: 600 }}>{h.title || h.keyword}</span>
                          <span className="text-sm text-muted" style={{ marginLeft: 8 }}>{h.keyword}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted">{h.duration || '—'}</span>
                        <span className="text-xs text-muted">{new Date(h.created_at).toLocaleString()}</span>
                        <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{expandedPipeline === h.id ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {expandedPipeline === h.id && h.stages && (
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {h.stages.map((stage, i) => (
                            <div key={i} className="flex items-center justify-between" style={{ padding: '6px 8px', borderRadius: 6, background: stage.status === 'running' ? 'var(--primary-light)' : 'transparent' }}>
                              <div className="flex items-center gap-2">
                                <span>{STATUS_ICONS[stage.status] || '⏳'}</span>
                                <span style={{ fontSize: 13 }}>{STAGE_ICONS[stage.name] || ''} {stage.name.replace(/_/g, ' ')}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {stage.status === 'running' && <div className="spinner-sm" />}
                                {stage.duration_ms != null && <span className="text-xs text-muted">{(stage.duration_ms / 1000).toFixed(1)}s</span>}
                                <span className={`badge badge-${stage.status === 'completed' ? 'green' : stage.status === 'failed' ? 'red' : stage.status === 'running' ? 'blue' : stage.status === 'skipped' ? 'gray' : 'yellow'} badge-sm`}>
                                  {stage.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
