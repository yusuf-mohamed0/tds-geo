import { useState, useEffect } from 'react'
import { analyticsApi, clientsApi } from '../services/api'
import { ActivityLog } from '../types'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import { SelectField } from '../components/FormField'

export default function Analytics() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [overview, setOverview] = useState<any>(null)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [costs, setCosts] = useState<any>(null)
  const [seoStat, setSeoStat] = useState<any>(null)
  const [keywordAnalytics, setKeywordAnalytics] = useState<any[]>([])
  const [logFilter, setLogFilter] = useState('')

  useEffect(() => {
    const init = async () => {
      try {
        const clientData = await clientsApi.list()
        const list = clientData.clients || clientData.data || []
        setClients(list)
        if (list.length > 0) setSelectedClientId(list[0].id)
      } catch {
        // No clients
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!selectedClientId) return
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const [overviewData, logsData, costsData, seoData, kwData] = await Promise.all([
          analyticsApi.overview(selectedClientId),
          analyticsApi.logs(selectedClientId, { limit: 50 }),
          analyticsApi.costs(selectedClientId, 'month'),
          analyticsApi.seo(selectedClientId, 30),
          analyticsApi.keywordAnalytics(selectedClientId),
        ])
        setOverview(overviewData)
        setLogs(logsData.logs || logsData.data || [])
        setCosts(costsData)
        setSeoStat(seoData)
        setKeywordAnalytics(kwData.keywords || kwData.data || [])
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedClientId])

  const filteredLogs = logFilter
    ? logs.filter(l => l.action?.toLowerCase().includes(logFilter.toLowerCase()) || l.message?.toLowerCase().includes(logFilter.toLowerCase()))
    : logs

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'logs', label: 'Activity Logs' },
    { id: 'costs', label: 'Costs' },
    { id: 'keywords', label: 'Keywords' },
  ]

  const keywordColumns: Column<any>[] = [
    { key: 'keyword', header: 'Keyword', render: (kw) => <span style={{ fontWeight: 500 }}>{kw.keyword}</span> },
    { key: 'search_volume', header: 'Volume', render: (kw) => (kw.search_volume || 0).toLocaleString() },
    {
      key: 'competition',
      header: 'Difficulty',
      render: (kw) => {
        const comp = kw.competition || 0
        return (
          <span style={{ color: comp > 0.7 ? 'var(--danger)' : comp > 0.4 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
            {(comp * 100).toFixed(0)}%
          </span>
        )
      },
    },
    { key: 'relevance_score', header: 'Relevance', render: (kw) => `${(kw.relevance_score || 0).toFixed(0)}%` },
    {
      key: 'trend_score',
      header: 'Trend',
      render: (kw) => (
        <span className={`badge badge-${kw.trend_score > 0 ? 'green' : 'red'}`}>
          {kw.trend_score > 0 ? '↑ Rising' : '↓ Declining'}
        </span>
      ),
    },
    {
      key: 'last_used_at',
      header: 'Used',
      render: (kw) => (
        <span className="text-sm text-muted">{kw.last_used_at ? new Date(kw.last_used_at).toLocaleDateString() : 'Never'}</span>
      ),
    },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Analytics</h2>
          <p>SEO performance, costs, and activity tracking</p>
        </div>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 400, marginBottom: 20 }}>
          <SelectField
            label="Client"
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            options={clients.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Select a client..."
          />
        </div>

        {!selectedClientId ? (
          <Card>
            <CardBody>
              <div className="empty-state"><p>Select a client to view analytics.</p></div>
            </CardBody>
          </Card>
        ) : loading ? (
          <Card>
            <CardBody>
              <div className="empty-state"><div className="spinner" /><p>Loading analytics...</p></div>
            </CardBody>
          </Card>
        ) : (
          <>
            <div className="tabs">
              {tabs.map(tab => (
                <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon green">📄</div>
                    <div>
                      <div className="stat-value">{overview?.articles?.published || overview?.published || 0}</div>
                      <div className="stat-label">Published Articles</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon purple">📊</div>
                    <div>
                      <div className="stat-value">{overview?.articles?.avg_seo_score != null ? `${overview.articles.avg_seo_score}` : '—'}</div>
                      <div className="stat-label">Avg SEO Score</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon blue">🔑</div>
                    <div>
                      <div className="stat-value">{overview?.keywords?.used_30d || 0}</div>
                      <div className="stat-label">Keywords (30d)</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon yellow">📈</div>
                    <div>
                      <div className="stat-value">{overview?.publishing?.last_30d || 0}</div>
                      <div className="stat-label">Published (30d)</div>
                    </div>
                  </div>
                </div>

                {seoStat && (
                  <Card style={{ marginTop: 20 }}>
                    <CardHeader>SEO Performance (30 Days)</CardHeader>
                    <CardBody>
                      {seoStat.scores?.length > 0 ? (
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          {seoStat.scores.map((s: any, i: number) => (
                            <div key={i} style={{ textAlign: 'center' }}>
                              <div style={{
                                width: 30,
                                height: Math.max(s.score || 0, 4),
                                background: (s.score || 0) >= 70 ? 'var(--success)' : (s.score || 0) >= 50 ? 'var(--warning)' : 'var(--danger)',
                                borderRadius: '4px 4px 0 0',
                                margin: '0 auto 4px',
                                transition: 'height 0.3s ease',
                              }} />
                              <div className="text-sm text-muted">{new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted">No SEO data yet.</p>
                      )}
                    </CardBody>
                  </Card>
                )}
              </>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <Card>
                <CardHeader action={
                  <input
                    className="form-input"
                    style={{ width: 200, fontSize: 13 }}
                    placeholder="Filter logs..."
                    value={logFilter}
                    onChange={e => setLogFilter(e.target.value)}
                  />
                }>
                  Activity Logs
                </CardHeader>
                <CardBody padding={false}>
                  {filteredLogs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}><p>No activity logs found.</p></div>
                  ) : (
                    <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Level</th>
                            <th>Action</th>
                            <th>Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLogs.map((log) => (
                            <tr key={log.id}>
                              <td className="text-muted text-sm">{new Date(log.created_at).toLocaleString()}</td>
                              <td>
                                <span className={`badge badge-${log.level === 'error' ? 'red' : log.level === 'warn' ? 'yellow' : 'blue'}`}>
                                  {log.level}
                                </span>
                              </td>
                              <td className="text-sm" style={{ fontFamily: 'monospace' }}>{log.action}</td>
                              <td className="text-sm">{log.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

            {/* Costs Tab */}
            {activeTab === 'costs' && (
              <Card>
                <CardHeader>Cost Tracking</CardHeader>
                <CardBody>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon red">💰</div>
                      <div>
                        <div className="stat-value">${(costs?.total_cost || costs?.total_cost_mtd || 0).toFixed(2)}</div>
                        <div className="stat-label">Total Cost (Month)</div>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon purple">🔤</div>
                      <div>
                        <div className="stat-value">{(costs?.total_tokens || costs?.total_tokens_mtd || 0).toLocaleString()}</div>
                        <div className="stat-label">Tokens Used</div>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon blue">📡</div>
                      <div>
                        <div className="stat-value">{costs?.api_calls || 0}</div>
                        <div className="stat-label">API Calls</div>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon yellow">📊</div>
                      <div>
                        <div className="stat-value">
                          {(costs?.total_cost && costs?.total_articles)
                            ? `$${(costs.total_cost / costs.total_articles).toFixed(2)}`
                            : '—'}
                        </div>
                        <div className="stat-label">Avg Cost / Article</div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Keywords Tab */}
            {activeTab === 'keywords' && (
              <Card>
                <CardHeader>Keyword Analytics</CardHeader>
                <CardBody padding={false}>
                  <DataTable
                    columns={keywordColumns}
                    data={keywordAnalytics}
                    keyExtractor={(kw) => kw.id || 'kw-unknown'}
                    loading={false}
                    emptyMessage="No keyword data available."
                  />
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  )
}
