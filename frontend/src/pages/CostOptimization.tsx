import { useState, useEffect } from 'react'
import { costApi, clientsApi } from '../services/api'
import { CostReport, BudgetStatus, ModelRoutingConfig } from '../types'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import { SelectField, InputField } from '../components/FormField'
import { useToast } from '../components/Toast'

type Tab = 'overview' | 'budget' | 'routing'

export default function CostOptimization() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [report, setReport] = useState<CostReport | null>(null)
  const [budget, setBudget] = useState<BudgetStatus | null>(null)
  const [routingConfigs, setRoutingConfigs] = useState<ModelRoutingConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDays, setSelectedDays] = useState(30)
  const { addToast } = useToast()

  useEffect(() => {
    clientsApi.list().then(data => {
      const list = data.clients || data.data || []
      setClients(list)
      if (list.length > 0) setSelectedClientId(list[0].id)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedClientId) return
    setLoading(true)
    setError('')
    const fetchData = async () => {
      try {
        if (activeTab === 'overview') {
          const reportData = await costApi.getReport(selectedClientId, selectedDays)
          setReport(reportData.data || null)
        } else if (activeTab === 'budget') {
          const budgetData = await costApi.getBudget(selectedClientId)
          setBudget(budgetData.data || null)
        }
      } catch (err: any) { setError(err.message) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [selectedClientId, activeTab, selectedDays])

  const tabs = [
    { id: 'overview' as const, label: 'Cost Overview' },
    { id: 'budget' as const, label: 'Budget & Limits' },
    { id: 'routing' as const, label: 'Model Routing' },
  ]

  const providerColumns: Column<any>[] = [
    { key: 'provider', header: 'Provider', render: (r: any) => <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{r.provider}</span> },
    { key: 'calls', header: 'Calls', render: (r: any) => r.calls?.toLocaleString() },
    { key: 'cost', header: 'Cost', render: (r: any) => <span style={{ fontWeight: 600 }}>${r.cost?.toFixed(4)}</span> },
  ]

  const modelColumns: Column<any>[] = [
    { key: 'model', header: 'Model', render: (r: any) => <span style={{ fontFamily: 'monospace' }}>{r.model}</span> },
    { key: 'calls', header: 'Calls', render: (r: any) => r.calls?.toLocaleString() },
    { key: 'cost', header: 'Cost', render: (r: any) => <span style={{ fontWeight: 600 }}>${r.cost?.toFixed(4)}</span> },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Cost Optimization</h2>
          <p>Track spending, manage budgets, and configure model routing</p>
        </div>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 400, marginBottom: 20 }}>
          <SelectField label="Client" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
            options={clients.map(c => ({ value: c.id, label: c.name }))} placeholder="Select a client..." />
        </div>

        <div className="tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {!selectedClientId ? (
          <Card><CardBody><div className="empty-state"><p>Select a client to view costs.</p></div></CardBody></Card>
        ) : loading ? (
          <Card><CardBody><div className="empty-state"><div className="spinner" /></div></CardBody></Card>
        ) : activeTab === 'overview' && (
          <div>
            <div className="card-actions" style={{ marginBottom: 16 }}>
              {[7, 14, 30, 90].map(d => (
                <button key={d} className={`btn ${selectedDays === d ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setSelectedDays(d)}>
                  {d} days
                </button>
              ))}
            </div>

            {report ? (
              <div>
                <div className="stats-grid">
                  <div className="stat-card"><div className="stat-icon red">💰</div><div><div className="stat-value">${report.total_cost?.toFixed(2)}</div><div className="stat-label">Total Cost</div></div></div>
                  <div className="stat-card"><div className="stat-icon purple">🔤</div><div><div className="stat-value">{report.total_tokens?.toLocaleString()}</div><div className="stat-label">Total Tokens</div></div></div>
                </div>

                <div className="grid-2" style={{ marginTop: 16 }}>
                  <Card>
                    <CardHeader>By Provider</CardHeader>
                    <CardBody padding={false}>
                      <DataTable columns={providerColumns} data={report.by_provider || []} keyExtractor={(r: any) => r.provider} loading={false} emptyMessage="No data" />
                    </CardBody>
                  </Card>
                  <Card>
                    <CardHeader>By Model</CardHeader>
                    <CardBody padding={false}>
                      <DataTable columns={modelColumns} data={report.by_model || []} keyExtractor={(r: any) => r.model} loading={false} emptyMessage="No data" />
                    </CardBody>
                  </Card>
                </div>

                {report.daily_costs?.length > 0 && (
                  <Card style={{ marginTop: 16 }}>
                    <CardHeader>Daily Cost Trend</CardHeader>
                    <CardBody>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120, padding: '8px 0' }}>
                        {report.daily_costs.slice(-30).map((d, i) => {
                          const maxCost = Math.max(...report.daily_costs.map(c => c.cost), 0.01)
                          return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <div style={{
                                width: '100%', minHeight: 2,
                                height: `${Math.max((d.cost / maxCost) * 100, 2)}%`,
                                background: d.cost > maxCost * 0.8 ? 'var(--danger)' : d.cost > maxCost * 0.5 ? 'var(--warning)' : 'var(--primary)',
                                borderRadius: '2px 2px 0 0',
                                transition: 'height 0.3s ease',
                              }} title={`${d.date}: $${d.cost.toFixed(4)}`} />
                              <span className="text-xs text-muted" style={{ fontSize: 8, writingMode: 'vertical-lr', textOrientation: 'mixed' }}>
                                {new Date(d.date).getDate()}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            ) : (
              <Card><CardBody><div className="empty-state"><p>No cost data available.</p></div></CardBody></Card>
            )}
          </div>
        )}

        {activeTab === 'budget' && selectedClientId && (
          <div>
            {budget ? (
              <div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className={`stat-icon ${budget.within_budget ? 'green' : 'red'}`}>{budget.within_budget ? '✅' : '⚠️'}</div>
                    <div><div className="stat-value">{budget.within_budget ? 'Within Budget' : 'Over Budget'}</div><div className="stat-label">Budget Status</div></div>
                  </div>
                  {budget.budget && (
                    <>
                      <div className="stat-card"><div className="stat-icon purple">🔤</div><div><div className="stat-value">{budget.budget.tokens_used?.toLocaleString()} / {budget.budget.token_limit?.toLocaleString()}</div><div className="stat-label">Tokens Used</div></div></div>
                      <div className="stat-card"><div className="stat-icon red">💰</div><div><div className="stat-value">${budget.budget.cost_used?.toFixed(2)} / ${budget.budget.cost_limit?.toFixed(2)}</div><div className="stat-label">Cost Used</div></div></div>
                    </>
                  )}
                </div>

                {/* Usage bar */}
                <Card>
                  <CardHeader>Usage ({budget.usage_pct?.toFixed(1)}%)</CardHeader>
                  <CardBody>
                    <div style={{ height: 20, background: 'var(--gray-200)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(budget.usage_pct, 100)}%`, height: '100%',
                        background: budget.usage_pct > 90 ? 'var(--danger)' : budget.usage_pct > 70 ? 'var(--warning)' : 'var(--success)',
                        borderRadius: 10, transition: 'width 0.5s ease',
                      }} />
                    </div>
                    {budget.recommendations?.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <h4 style={{ marginBottom: 8 }}>Recommendations</h4>
                        <ul style={{ color: 'var(--gray-600)', fontSize: 13 }}>
                          {budget.recommendations.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            ) : (
              <Card><CardBody><div className="empty-state"><p>No budget configured.</p></div></CardBody></Card>
            )}
          </div>
        )}

        {activeTab === 'routing' && selectedClientId && (
          <Card>
            <CardHeader>Model Routing Configuration</CardHeader>
            <CardBody>
              <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
                Configure which AI models are used for different task types to optimize cost and quality.
              </p>
              {routingConfigs.length === 0 ? (
                <div className="empty-state"><p>No routing configurations yet. Route a task to generate recommendations.</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {routingConfigs.map(c => (
                    <div key={c.id} style={{ padding: '12px 16px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="badge badge-purple">{c.task_type}</span>
                          <span style={{ marginLeft: 8, fontFamily: 'monospace' }}>{c.preferred_model}</span>
                          {c.fallback_model && <span className="text-sm text-muted" style={{ marginLeft: 8 }}>→ {c.fallback_model}</span>}
                        </div>
                        <span className={`badge badge-${c.is_active ? 'green' : 'gray'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div className="flex gap-4" style={{ marginTop: 8 }}>
                        {c.max_cost_per_call != null && <span className="text-xs text-muted">Max cost: ${c.max_cost_per_call.toFixed(4)}</span>}
                        <span className="text-xs text-muted">Priority: {c.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  )
}
