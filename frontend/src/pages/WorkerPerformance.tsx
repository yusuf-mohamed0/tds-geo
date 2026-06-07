import { useState, useEffect } from 'react'
import { workerScoringApi } from '../services/api'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import { Modal } from '../components/Modal'

type Tab = 'hierarchy' | 'promotions' | 'thresholds' | 'worker-detail'

const TIER_ORDER = ['elite', 'senior', 'standard', 'junior', 'probation'] as const
const TIER_COLORS: Record<string, string> = {
  elite: 'gold',
  senior: 'purple',
  standard: 'blue',
  junior: 'green',
  probation: 'red',
}
const TIER_ICONS: Record<string, string> = {
  elite: '👑',
  senior: '⭐',
  standard: '🔵',
  junior: '🟢',
  probation: '⚠️',
}
const TREND_ICONS: Record<string, string> = {
  rising: '📈',
  stable: '➡️',
  declining: '📉',
}

export default function WorkerPerformance() {
  const [activeTab, setActiveTab] = useState<Tab>('hierarchy')
  const [hierarchy, setHierarchy] = useState<any[]>([])
  const [byTier, setByTier] = useState<Record<string, any[]>>({})
  const [summary, setSummary] = useState<any>({})
  const [promotions, setPromotions] = useState<any[]>([])
  const [thresholds, setThresholds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedWorker, setSelectedWorker] = useState<any>(null)
  const [workerScores, setWorkerScores] = useState<any[]>([])
  const [showManualTier, setShowManualTier] = useState(false)
  const [manualTierWorker, setManualTierWorker] = useState<any>(null)
  const [evaluating, setEvaluating] = useState(false)

  useEffect(() => { loadData() }, [activeTab])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      if (activeTab === 'hierarchy' || activeTab === 'worker-detail') {
        const h = await workerScoringApi.getHierarchy()
        setHierarchy(h.data?.hierarchy || [])
        setByTier(h.data?.byTier || {})
        setSummary(h.data?.summary || {})
      }
      if (activeTab === 'promotions') {
        const p = await workerScoringApi.getPromotions()
        setPromotions(p.data || [])
      }
      if (activeTab === 'thresholds') {
        const t = await workerScoringApi.getThresholds()
        setThresholds(t.data || [])
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function viewWorker(worker: any) {
    setSelectedWorker(worker)
    try {
      const scores = await workerScoringApi.getWorkerScores(worker.worker_name)
      setWorkerScores(scores.data || [])
    } catch {
      setWorkerScores([])
    }
  }

  async function handleEvaluate() {
    setEvaluating(true)
    try {
      const result = await workerScoringApi.runEvaluation()
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Evaluation failed')
    } finally {
      setEvaluating(false)
    }
  }

  async function handleManualTier(workerName: string, jobType: string, newTier: string, reason: string) {
    try {
      await workerScoringApi.setWorkerTier(workerName, { jobType, newTier, reason })
      setShowManualTier(false)
      setManualTierWorker(null)
      await loadData()
    } catch (err: any) {
      throw err
    }
  }

  async function handleThresholdUpdate(tierName: string, updates: Record<string, any>) {
    try {
      await workerScoringApi.updateThresholds(tierName, updates)
      await loadData()
    } catch (err: any) {
      throw err
    }
  }

  const hierarchyColumns: Column<any>[] = [
    {
      key: 'worker_name',
      header: 'Worker',
      render: (w) => (
        <button className="btn-link" onClick={() => viewWorker(w)} style={{ fontWeight: 600 }}>
          {TIER_ICONS[w.current_tier] || ''} {w.worker_name}
        </button>
      ),
    },
    {
      key: 'job_type',
      header: 'Role',
      render: (w) => (
        <span className="text-sm text-muted" style={{ textTransform: 'capitalize' }}>
          {w.job_type.replace(/-/g, ' ')}
        </span>
      ),
    },
    {
      key: 'current_tier',
      header: 'Tier',
      render: (w) => (
        <span className={`badge badge-${TIER_COLORS[w.current_tier] || 'gray'}`} style={{ textTransform: 'capitalize' }}>
          {w.current_tier}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (w) => <span className="text-sm">{w.title}</span>,
    },
    {
      key: 'current_score',
      header: 'Score',
      render: (w) => (
        <span style={{ fontWeight: 600, color: w.current_score >= 75 ? 'var(--success)' : w.current_score >= 55 ? 'var(--primary)' : w.current_score >= 35 ? 'var(--warning)' : 'var(--danger)' }}>
          {w.current_score?.toFixed(1) || '—'}
        </span>
      ),
    },
    {
      key: 'score_trend',
      header: 'Trend',
      render: (w) => <span title={w.score_trend}>{TREND_ICONS[w.score_trend] || '➡️'}</span>,
    },
    {
      key: 'periods_at_tier',
      header: 'Periods',
      render: (w) => <span className="text-sm text-muted">{w.periods_at_tier}</span>,
    },
    {
      key: 'total_promotions',
      header: 'Promotions',
      render: (w) => <span className="badge badge-green badge-sm">{w.total_promotions}</span>,
    },
    {
      key: 'total_demotions',
      header: 'Demotions',
      render: (w) => <span className="badge badge-red badge-sm">{w.total_demotions || 0}</span>,
    },
    {
      key: 'id',
      header: '',
      render: (w) => (
        <button className="btn btn-outline btn-sm" onClick={() => { setManualTierWorker(w); setShowManualTier(true) }}>
          ⚙️ Override
        </button>
      ),
    },
  ]

  const promotionColumns: Column<any>[] = [
    {
      key: 'created_at',
      header: 'Date',
      render: (p) => <span className="text-sm">{new Date(p.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'worker_name',
      header: 'Worker',
      render: (p) => <span style={{ fontWeight: 500 }}>{p.worker_name}</span>,
    },
    {
      key: 'event_type',
      header: 'Event',
      render: (p) => (
        <span className={`badge ${p.event_type === 'promotion' ? 'badge-green' : p.event_type === 'demotion' ? 'badge-red' : 'badge-yellow'}`}>
          {p.event_type === 'promotion' ? '⬆️ Promoted' : p.event_type === 'demotion' ? '⬇️ Demoted' : '🚩 Flagged'}
        </span>
      ),
    },
    {
      key: 'from_tier',
      header: 'From',
      render: (p) => <span className={`badge badge-${TIER_COLORS[p.from_tier]} badge-sm`}>{p.from_tier}</span>,
    },
    {
      key: 'to_tier',
      header: 'To',
      render: (p) => <span className={`badge badge-${TIER_COLORS[p.to_tier]} badge-sm`}>{p.to_tier}</span>,
    },
    {
      key: 'from_score',
      header: 'Score Δ',
      render: (p) => (
        <span className="text-sm">
          {p.from_score?.toFixed(0)} → {p.to_score?.toFixed(0)}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (p) => <span className="text-sm text-muted" style={{ maxWidth: 300, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.reason}</span>,
    },
    {
      key: 'auto_applied',
      header: 'Auto',
      render: (p) => <span className={`badge badge-sm ${p.auto_applied ? 'badge-blue' : 'badge-yellow'}`}>{p.auto_applied ? 'Auto' : 'Manual'}</span>,
    },
  ]

  const tabs = [
    { id: 'hierarchy' as const, label: `🏢 Hierarchy (${summary.total || '...'})` },
    { id: 'promotions' as const, label: `📋 Promotions (${promotions.length})` },
    { id: 'thresholds' as const, label: '⚙️ Thresholds' },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Worker Performance</h2>
          <p>Hierarchical scoring, promotion/demotion engine, and performance analytics</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleEvaluate} disabled={evaluating}>
            {evaluating ? '⏳ Evaluating...' : '🔄 Run Evaluation'}
          </button>
          <button className="btn btn-outline" onClick={loadData} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Card><CardBody><div className="empty-state"><div className="spinner" /><p>Loading worker data...</p></div></CardBody></Card>
        ) : activeTab === 'hierarchy' && (
          <div>
            {/* Tier Summary Stats */}
            <div className="stats-grid" style={{ marginBottom: 16 }}>
              {TIER_ORDER.map(tier => {
                const workers = byTier[tier] || []
                return (
                  <div key={tier} className="stat-card">
                    <div className={`stat-icon ${TIER_COLORS[tier]}`}>
                      <span style={{ fontSize: 24 }}>{TIER_ICONS[tier]}</span>
                    </div>
                    <div>
                      <div className="stat-value" style={{ textTransform: 'capitalize' }}>{tier}</div>
                      <div className="stat-label">{workers.length} worker{workers.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Org Chart Tree */}
            <Card style={{ marginBottom: 16 }}>
              <CardHeader>🏢 Worker Organization Chart</CardHeader>
              <CardBody>
                {TIER_ORDER.map(tier => {
                  const workers = byTier[tier] || []
                  if (workers.length === 0) return null
                  return (
                    <div key={tier} style={{ marginBottom: workers === byTier[TIER_ORDER[TIER_ORDER.length - 1]] ? 0 : 20 }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>{TIER_ICONS[tier]}</span>
                        <h4 style={{ textTransform: 'capitalize', margin: 0, color: `var(--${TIER_COLORS[tier] === 'gold' ? 'warning' : TIER_COLORS[tier] === 'purple' ? 'primary' : TIER_COLORS[tier] === 'blue' ? 'info' : TIER_COLORS[tier] === 'green' ? 'success' : 'danger'})` }}>
                          {tier} Tier
                        </h4>
                        <span className="badge badge-sm" style={{ background: 'var(--bg-secondary)' }}>{workers.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 28 }}>
                        {workers.map(w => (
                          <button key={w.id}
                            onClick={() => viewWorker(w)}
                            className="btn btn-outline btn-sm"
                            style={{ borderRadius: 20, padding: '4px 14px', borderColor: 'var(--border)', fontSize: 13 }}
                            title={`${w.title} — Score: ${w.current_score?.toFixed(1)}`}>
                            {TIER_ICONS[w.current_tier]} {w.worker_name}
                            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>{w.current_score?.toFixed(0)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {hierarchy.length === 0 && <p className="text-muted text-sm">No workers registered yet. Run the pipeline to generate worker data.</p>}
              </CardBody>
            </Card>

            {/* Full Hierarchy Table */}
            <Card>
              <CardHeader action={<span className="text-muted text-sm">{hierarchy.length} total workers</span>}>
                📊 Worker Ranking
              </CardHeader>
              <CardBody padding={false}>
                <DataTable
                  columns={hierarchyColumns}
                  data={hierarchy}
                  keyExtractor={w => w.id}
                  loading={false}
                  emptyMessage="No workers found."
                />
              </CardBody>
            </Card>
          </div>
        )}

        {activeTab === 'promotions' && (
          <Card>
            <CardHeader action={<span className="text-muted text-sm">{promotions.length} total events</span>}>
              📋 Promotion & Demotion History
            </CardHeader>
            <CardBody padding={false}>
              <DataTable
                columns={promotionColumns}
                data={promotions}
                keyExtractor={p => p.id}
                loading={false}
                emptyMessage="No promotion or demotion events yet."
              />
            </CardBody>
          </Card>
        )}

        {activeTab === 'thresholds' && (
          <div>
            <Card>
              <CardHeader>⚙️ Performance Threshold Configuration</CardHeader>
              <CardBody>
                <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                  Configure the scoring weights, tier boundaries, and promotion/demotion rules for each worker tier.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                  {thresholds.map(t => (
                    <ThresholdCard key={t.id} threshold={t} onSave={(updates) => handleThresholdUpdate(t.tier_name, updates)} />
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      {/* Worker Detail Modal */}
      <Modal
        open={!!selectedWorker}
        onClose={() => { setSelectedWorker(null); setWorkerScores([]) }}
        title={`${TIER_ICONS[selectedWorker?.current_tier] || ''} ${selectedWorker?.worker_name || ''}`}
        maxWidth={700}
      >
        {selectedWorker && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <p className="text-sm text-muted">Title</p>
                <p style={{ fontWeight: 600 }}>{selectedWorker.title}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Tier</p>
                <span className={`badge badge-${TIER_COLORS[selectedWorker.current_tier]}`} style={{ textTransform: 'capitalize' }}>
                  {selectedWorker.current_tier}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted">Current Score</p>
                <p style={{ fontWeight: 600, fontSize: 24, color: selectedWorker.current_score >= 75 ? 'var(--success)' : selectedWorker.current_score >= 55 ? 'var(--primary)' : 'var(--danger)' }}>
                  {selectedWorker.current_score?.toFixed(1) || '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Trend</p>
                <p style={{ fontWeight: 600 }}>{TREND_ICONS[selectedWorker.score_trend]} {selectedWorker.score_trend}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Promotions / Demotions</p>
                <p><span className="badge badge-green badge-sm">{selectedWorker.total_promotions} promotions</span> <span className="badge badge-red badge-sm">{selectedWorker.total_demotions || 0} demotions</span></p>
              </div>
              <div>
                <p className="text-sm text-muted">Job Type</p>
                <p className="text-sm" style={{ textTransform: 'capitalize' }}>{selectedWorker.job_type?.replace(/-/g, ' ')}</p>
              </div>
            </div>

            <h4 style={{ marginTop: 20, marginBottom: 12 }}>Score History</h4>
            {workerScores.length > 0 ? (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {workerScores.map(s => (
                  <div key={s.id} style={{
                    padding: '10px 14px', marginBottom: 6, borderRadius: 8,
                    background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8,
                  }}>
                    <div>
                      <span className="text-xs text-muted">Composite</span>
                      <div style={{ fontWeight: 600, fontSize: 18 }}>{s.composite_score}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">Reliability</span>
                      <div className="text-sm">{s.reliability_score}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">Throughput</span>
                      <div className="text-sm">{s.throughput_score}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">Latency</span>
                      <div className="text-sm">{s.latency_score}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">Recorded</span>
                      <div className="text-xs text-muted">{new Date(s.recorded_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm">No score history available yet.</p>
            )}
          </div>
        )}
      </Modal>

      {/* Manual Tier Override Modal */}
      <Modal
        open={showManualTier}
        onClose={() => { setShowManualTier(false); setManualTierWorker(null) }}
        title="⚙️ Manual Tier Override"
        maxWidth={450}
      >
        {manualTierWorker && (
          <ManualTierForm
            worker={manualTierWorker}
            onSave={(newTier, reason) => handleManualTier(manualTierWorker.worker_name, manualTierWorker.job_type, newTier, reason)}
            onCancel={() => { setShowManualTier(false); setManualTierWorker(null) }}
          />
        )}
      </Modal>
    </>
  )
}

// ─── Threshold Card Sub-component ─────────────────────────

function ThresholdCard({ threshold, onSave }: {
  threshold: any
  onSave: (updates: Record<string, any>) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    min_score: threshold.min_score,
    max_score: threshold.max_score,
    promotion_threshold: threshold.promotion_threshold,
    demotion_threshold: threshold.demotion_threshold,
    periods_for_promotion: threshold.periods_for_promotion,
    periods_for_demotion: threshold.periods_for_demotion,
    requires_approval: threshold.requires_approval,
    weight_reliability: threshold.weight_reliability,
    weight_throughput: threshold.weight_throughput,
    weight_latency: threshold.weight_latency,
    weight_cost: threshold.weight_cost,
    weight_quality: threshold.weight_quality,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(form)
      setEditing(false)
    } catch {
      // error handled by parent
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card style={{ borderLeft: `4px solid var(--${threshold.tier_name === 'elite' ? 'warning' : threshold.tier_name === 'senior' ? 'primary' : threshold.tier_name === 'standard' ? 'info' : threshold.tier_name === 'junior' ? 'success' : 'danger'})` }}>
      <CardHeader action={
        <button className={`btn btn-sm ${editing ? 'btn-primary' : 'btn-outline'}`} onClick={editing ? handleSave : () => setEditing(true)} disabled={saving}>
          {saving ? 'Saving...' : editing ? '💾 Save' : '✏️ Edit'}
        </button>
      }>
        <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{threshold.tier_name} Tier</span>
      </CardHeader>
      <CardBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
          <div>
            <span className="text-muted">Score Range</span>
            <div style={{ fontWeight: 500 }}>
              {editing ? (
                <div className="flex gap-1">
                  <input type="number" className="form-input" style={{ width: 60, padding: '2px 6px', fontSize: 12 }}
                    value={form.min_score} onChange={e => setForm({ ...form, min_score: parseFloat(e.target.value) || 0 })} />
                  <span>–</span>
                  <input type="number" className="form-input" style={{ width: 60, padding: '2px 6px', fontSize: 12 }}
                    value={form.max_score} onChange={e => setForm({ ...form, max_score: parseFloat(e.target.value) || 100 })} />
                </div>
              ) : `${threshold.min_score} – ${threshold.max_score}`}
            </div>
          </div>
          <div>
            <span className="text-muted">Promotion {'>'}</span>
            <div style={{ fontWeight: 500 }}>
              {editing ? (
                <input type="number" className="form-input" style={{ width: 70, padding: '2px 6px', fontSize: 12 }}
                  value={form.promotion_threshold} onChange={e => setForm({ ...form, promotion_threshold: parseFloat(e.target.value) || 0 })} />
              ) : threshold.promotion_threshold}
            </div>
          </div>
          <div>
            <span className="text-muted">Demotion {'<'}</span>
            <div style={{ fontWeight: 500 }}>
              {editing ? (
                <input type="number" className="form-input" style={{ width: 70, padding: '2px 6px', fontSize: 12 }}
                  value={form.demotion_threshold} onChange={e => setForm({ ...form, demotion_threshold: parseFloat(e.target.value) || 0 })} />
              ) : threshold.demotion_threshold}
            </div>
          </div>
          <div>
            <span className="text-muted">Default Title</span>
            <div style={{ fontWeight: 500 }}>{threshold.default_title}</div>
          </div>
          <div>
            <span className="text-muted">Promo Periods</span>
            <div style={{ fontWeight: 500 }}>
              {editing ? (
                <input type="number" className="form-input" style={{ width: 50, padding: '2px 6px', fontSize: 12 }}
                  value={form.periods_for_promotion} onChange={e => setForm({ ...form, periods_for_promotion: parseInt(e.target.value) || 1 })} />
              ) : threshold.periods_for_promotion}
            </div>
          </div>
          <div>
            <span className="text-muted">Demo Periods</span>
            <div style={{ fontWeight: 500 }}>
              {editing ? (
                <input type="number" className="form-input" style={{ width: 50, padding: '2px 6px', fontSize: 12 }}
                  value={form.periods_for_demotion} onChange={e => setForm({ ...form, periods_for_demotion: parseInt(e.target.value) || 1 })} />
              ) : threshold.periods_for_demotion}
            </div>
          </div>
        </div>

        {editing && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--gray-200)' }}>
            <span className="text-sm" style={{ fontWeight: 600 }}>Scoring Weights</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 8 }}>
              {(['reliability', 'throughput', 'latency', 'cost', 'quality'] as const).map(k => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div className="text-xs text-muted" style={{ textTransform: 'capitalize' }}>{k}</div>
                  <input type="number" className="form-input" style={{ width: '100%', padding: '2px 4px', fontSize: 12, textAlign: 'center' }}
                    step="0.05" min="0" max="1"
                    value={(form as any)[`weight_${k}`]}
                    onChange={e => setForm({ ...form, [`weight_${k}`]: parseFloat(e.target.value) || 0 })} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={form.requires_approval}
                onChange={e => setForm({ ...form, requires_approval: e.target.checked })} />
              <span className="text-sm">Requires human approval for promotion</span>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ─── Manual Tier Form ─────────────────────────────────────

function ManualTierForm({ worker, onSave, onCancel }: {
  worker: any
  onSave: (newTier: string, reason: string) => Promise<void>
  onCancel: () => void
}) {
  const [newTier, setNewTier] = useState(worker.current_tier || 'standard')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Reason is required for manual override')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(newTier, reason.trim())
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to set tier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
        Override tier for <strong>{worker.worker_name}</strong> ({worker.job_type?.replace(/-/g, ' ')})
      </p>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="form-group">
        <label>New Tier</label>
        <select className="form-select" value={newTier} onChange={e => setNewTier(e.target.value)}>
          {TIER_ORDER.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Reason for Override</label>
        <textarea className="form-input" style={{ minHeight: 80 }}
          value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Explain why this tier change is needed..." />
      </div>

      <div className="modal-footer" style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Applying...' : 'Apply Override'}
        </button>
      </div>
    </form>
  )
}
