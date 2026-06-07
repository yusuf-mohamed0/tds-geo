import { useState, useEffect } from 'react'
import { observabilityApi, clientsApi } from '../services/api'
import { DashboardMetrics, SystemAlert, TraceSpan } from '../types'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import { SelectField } from '../components/FormField'
import Icon from '../components/Icon'

type Tab = 'dashboard' | 'alerts' | 'traces' | 'health'

const SEVERITY_BADGE: Record<string, string> = { critical: 'red', warning: 'yellow', info: 'blue', debug: 'gray' }
const STATUS_BADGE: Record<string, string> = { active: 'red', acknowledged: 'yellow', resolved: 'green', suppressed: 'gray' }

export default function Observability() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [traces, setTraces] = useState<TraceSpan[]>([])
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null)
  const [traceDetail, setTraceDetail] = useState<TraceSpan[]>([])
  const [latencyData, setLatencyData] = useState<any[]>([])
  const [selectedHours, setSelectedHours] = useState(24)

  useEffect(() => {
    clientsApi.list().then(data => {
      const list = data.clients || data.data || []
      setClients(list)
      if (list.length > 0) setSelectedClientId(list[0].id)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    const fetch = async () => {
      try {
        if (activeTab === 'dashboard') {
          const [m, l] = await Promise.all([
            observabilityApi.getDashboard(selectedClientId || undefined),
            observabilityApi.getLatency(selectedHours),
          ])
          setMetrics(m.data || null)
          setLatencyData(l.data || [])
        } else if (activeTab === 'alerts') {
          const a = await observabilityApi.getAlerts()
          setAlerts(a.data || [])
        } else if (activeTab === 'health') {
          const h = await observabilityApi.getHealth()
          setHealth(h.data || null)
        }
      } catch (err: any) { setError(err.message) }
      finally { setLoading(false) }
    }
    if (selectedClientId || activeTab !== 'dashboard') fetch()
    else fetch()
  }, [selectedClientId, activeTab, selectedHours])

  const viewTrace = async (traceId: string) => {
    setSelectedTrace(traceId)
    try {
      const t = await observabilityApi.getTrace(traceId)
      setTraceDetail(t.data || [])
    } catch { setTraceDetail([]) }
  }

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard' },
    { id: 'alerts' as const, label: `Alerts (${alerts.filter(a => a.status === 'active').length})` },
    { id: 'traces' as const, label: 'Traces' },
    { id: 'health' as const, label: 'Health' },
  ]

  const alertColumns: Column<SystemAlert>[] = [
    { key: 'alert_name', header: 'Alert', render: (a) => <span style={{ fontWeight: 500 }}>{a.alert_name}</span> },
    { key: 'severity', header: 'Severity', render: (a) => <span className={`badge badge-${SEVERITY_BADGE[a.severity]}`}>{a.severity}</span> },
    { key: 'status', header: 'Status', render: (a) => <span className={`badge badge-${STATUS_BADGE[a.status]}`}>{a.status}</span> },
    { key: 'message', header: 'Message', render: (a) => <span className="text-sm">{a.message}</span> },
    { key: 'created_at', header: 'Time', render: (a) => <span className="text-sm text-muted">{new Date(a.created_at).toLocaleString()}</span> },
    { key: 'id', header: '', render: (a) => a.status === 'active' ? (
      <button className="btn btn-outline btn-sm" onClick={() => observabilityApi.acknowledgeAlert(a.id).then(() => observabilityApi.getAlerts().then(r => setAlerts(r.data || [])))}>Acknowledge</button>
    ) : null },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Observability</h2>
          <p>System monitoring, traces, alerts, and health checks</p>
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
          <Card><CardBody><div className="empty-state"><div className="spinner" /></div></CardBody></Card>
        ) : activeTab === 'dashboard' && (
          <div>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-icon red"><Icon name="bell" /></div><div><div className="stat-value">{metrics?.active_alerts || 0}</div><div className="stat-label">Active Alerts</div></div></div>
              <div className="stat-card"><div className="stat-icon red"><Icon name="warning" /></div><div><div className="stat-value">{metrics?.critical_alerts || 0}</div><div className="stat-label">Critical</div></div></div>
              <div className="stat-card"><div className="stat-icon blue"><Icon name="metric" /></div><div><div className="stat-value">{metrics?.total_traces_today || 0}</div><div className="stat-label">Traces Today</div></div></div>
              <div className="stat-card"><div className={`stat-icon ${(metrics?.error_rate || 0) > 5 ? 'red' : 'green'}`}><Icon name="seo-enhance" /></div><div><div className="stat-value">{(metrics?.error_rate || 0).toFixed(1)}%</div><div className="stat-label">Error Rate</div></div></div>
              <div className="stat-card"><div className={`stat-icon ${(metrics?.p95_latency || 0) > 5000 ? 'red' : (metrics?.p95_latency || 0) > 2000 ? 'yellow' : 'green'}`}><Icon name="clock" /></div><div><div className="stat-value">{metrics?.p95_latency ? `${(metrics.p95_latency / 1000).toFixed(1)}s` : '—'}</div><div className="stat-label">P95 Latency</div></div></div>
            </div>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <Card>
                <CardHeader>
                  Worker Performance
                  <div className="card-actions">
                    {[1, 6, 24].map(h => (
                      <button key={h} className={`btn ${selectedHours === h ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setSelectedHours(h)}>{h}h</button>
                    ))}
                  </div>
                </CardHeader>
                <CardBody>
                  {metrics?.worker_stats && metrics.worker_stats.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {metrics.worker_stats.map(w => (
                        <div key={w.worker_name} style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                          <div className="flex items-center justify-between">
                            <span style={{ fontWeight: 500 }}>{w.worker_name}</span>
                            <span className={`badge badge-${w.jobs_failed > 0 ? 'red' : 'green'} badge-sm`}>{w.jobs_processed} jobs</span>
                          </div>
                          <div className="flex gap-4" style={{ marginTop: 4 }}>
                            <span className="text-xs text-muted">Avg: {w.avg_processing_ms?.toFixed(0)}ms</span>
                            <span className="text-xs text-muted">P95: {w.p95_processing_ms?.toFixed(0)}ms</span>
                            <span className="text-xs text-muted">{w.throughput_per_min?.toFixed(1)}/min</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-muted text-sm">No worker data available.</p>}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>Recent Alerts</CardHeader>
                <CardBody>
                  {metrics?.recent_alerts && metrics.recent_alerts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {metrics.recent_alerts.map(a => (
                        <div key={a.id} style={{ padding: '8px 12px', borderLeft: `4px solid ${a.severity === 'critical' ? 'var(--danger)' : a.severity === 'warning' ? 'var(--warning)' : 'var(--primary)'}`, background: 'var(--gray-50)', borderRadius: 4 }}>
                          <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                            <span className={`badge badge-${SEVERITY_BADGE[a.severity]} badge-sm`}>{a.severity}</span>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{a.alert_name}</span>
                          </div>
                          <p className="text-xs">{a.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-muted text-sm">No recent alerts.</p>}
                </CardBody>
              </Card>
            </div>

            {/* Latency Chart */}
            {latencyData.length > 0 && (
              <Card style={{ marginTop: 16 }}>
                <CardHeader>AI Latency Over Time</CardHeader>
                <CardBody>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 100, padding: '8px 0' }}>
                    {latencyData.map((d: any, i: number) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{
                          width: '100%', minHeight: 2,
                          height: `${Math.min((d.avg_latency_ms / Math.max(...latencyData.map((x: any) => x.avg_latency_ms), 1)) * 100, 100)}%`,
                          background: d.avg_latency_ms > 5000 ? 'var(--danger)' : d.avg_latency_ms > 2000 ? 'var(--warning)' : 'var(--success)',
                          borderRadius: '2px 2px 0 0', transition: 'height 0.3s ease',
                        }} />
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <Card>
            <CardHeader>
              System Alerts
              <button className="btn btn-outline btn-sm" onClick={() => observabilityApi.getAlerts().then(r => setAlerts(r.data || []))}>Refresh</button>
            </CardHeader>
            <CardBody padding={false}>
              <DataTable columns={alertColumns} data={alerts} keyExtractor={a => a.id} loading={false} emptyMessage="No alerts." />
            </CardBody>
          </Card>
        )}

        {activeTab === 'traces' && (
          <Card>
            <CardHeader>
              Trace Explorer
              {selectedTrace && <button className="btn btn-outline btn-sm" onClick={() => { setSelectedTrace(null); setTraceDetail([]) }}>← Back</button>}
            </CardHeader>
            <CardBody>
              {selectedTrace ? (
                <div>
                  <h4 style={{ marginBottom: 12 }}>Trace: {selectedTrace}</h4>
                  {traceDetail.map(span => (
                    <div key={span.id} style={{
                      padding: '8px 12px', marginBottom: 8, borderLeft: `4px solid ${span.status === 'error' ? 'var(--danger)' : span.status === 'ok' ? 'var(--success)' : 'var(--gray-300)'}`,
                      background: 'var(--gray-50)', borderRadius: 4, marginLeft: span.parent_span_id ? 24 : 0,
                    }}>
                      <div className="flex items-center justify-between">
                        <span style={{ fontWeight: 500 }}>{span.span_name}</span>
                        <span className={`badge badge-${span.status === 'ok' ? 'green' : span.status === 'error' ? 'red' : 'gray'} badge-sm`}>{span.status}</span>
                      </div>
                      <div className="flex gap-4" style={{ marginTop: 4 }}>
                        <span className="text-xs text-muted">{span.service_name}</span>
                        {span.duration_ms != null && <span className="text-xs text-muted">{(span.duration_ms).toFixed(1)}ms</span>}
                      </div>
                      {span.status_message && <p className="text-xs text-muted" style={{ marginTop: 4 }}>{span.status_message}</p>}
                    </div>
                  ))}
                  {traceDetail.length === 0 && <p className="text-muted">No spans found for this trace.</p>}
                </div>
              ) : (
                <p className="text-muted">Enter a trace ID to explore spans, or view traces from the monitoring dashboard.</p>
              )}
            </CardBody>
          </Card>
        )}

        {activeTab === 'health' && (
          <Card>
            <CardHeader>System Health</CardHeader>
            <CardBody>
              {health ? (
                <div>
                  <div className="stats-grid">
                    {Object.entries(health).map(([key, val]: [string, any]) => (
                      <div key={key} className="stat-card">
                        <div className={`stat-icon ${val?.status === 'healthy' || val === true ? 'green' : val === false || val?.status === 'unhealthy' ? 'red' : 'yellow'}`}>
                          {val?.status === 'healthy' || val === true ? <Icon name="completed" /> : val === false || val?.status === 'unhealthy' ? <Icon name="failed" /> : <Icon name="warning" />}
                        </div>
                        <div>
                          <div className="stat-value" style={{ textTransform: 'capitalize', fontSize: 18 }}>{key.replace(/_/g, ' ')}</div>
                          <div className="stat-label">{typeof val === 'object' ? val.message || val.status || JSON.stringify(val) : String(val)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted">Health check data not available.</p>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  )
}
