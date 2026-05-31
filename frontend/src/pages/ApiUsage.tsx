import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'
import { analyticsApi, clientsApi } from '../services/api'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { SelectField } from '../components/FormField'
import { useToast } from '../components/Toast'
import type { ApiUsageData } from '../types'

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#6366f1',
  serpapi: '#10b981',
  shopify: '#f59e0b',
  anthropic: '#8b5cf6',
  other: '#6b7280',
}

function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider.toLowerCase()] || '#6b7280'
}

const PERIOD_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '60 Days', value: 60 },
  { label: '90 Days', value: 90 },
]

export default function ApiUsage() {
  const { addToast } = useToast()
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [data, setData] = useState<ApiUsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState(30)
  const [activeChart, setActiveChart] = useState<'cost' | 'tokens' | 'calls'>('cost')

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
        const result = await analyticsApi.apiUsage(selectedClientId, period)
        setData(result)
      } catch (err: any) {
        const msg = err.response?.data?.error || 'Failed to load API usage data'
        setError(msg)
        addToast('error', msg)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedClientId, period])

  const totalCost = data?.mtd?.total_cost ?? 0
  const totalCalls = data?.mtd?.total_calls ?? 0
  const totalTokens = data?.mtd?.total_tokens ?? 0
  const avgDuration = data?.mtd?.avg_duration_ms ?? 0

  const providerPieData = useMemo(() => {
    if (!data?.perProvider) return []
    return data.perProvider.map(p => ({
      name: p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
      value: p.total_cost,
      calls: p.calls,
      tokens: p.tokens_in + p.tokens_out,
      color: getProviderColor(p.provider),
    }))
  }, [data?.perProvider])

  const modelBarData = useMemo(() => {
    if (!data?.perModel) return []
    return data.perModel.map(m => ({
      name: `${m.provider}${m.model !== 'unknown' ? ` (${m.model})` : ''}`,
      cost: m.total_cost,
      tokens: m.tokens_in + m.tokens_out,
      calls: m.calls,
      provider: m.provider,
    }))
  }, [data?.perModel])

  const stackedDailyData = useMemo(() => {
    if (!data?.dailyPerProvider || !data?.dailySeries) return []
    return data.dailySeries.map(day => {
      const providers = data.dailyPerProvider.filter(d => d.date === day.date)
      const obj: Record<string, any> = {
        date: new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        total: day.total_cost,
        calls: day.total_calls,
        tokens: day.total_tokens,
      }
      providers.forEach(p => {
        obj[p.provider] = p.cost
      })
      return obj
    })
  }, [data?.dailyPerProvider, data?.dailySeries])

  const allProviders = useMemo(() => {
    if (!data?.perProvider) return []
    return data.perProvider.map(p => p.provider)
  }, [data?.perProvider])

  const formatCurrency = (val: number) => `$${val.toFixed(4)}`
  const formatCurrencyShort = (val: number) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`
    return `$${val.toFixed(2)}`
  }
  const formatNumber = (val: number) => val.toLocaleString()

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">{label}</div>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="chart-tooltip-row" style={{ color: entry.color }}>
            <span className="chart-tooltip-dot" style={{ background: entry.color }} />
            {entry.name}: <strong>{entry.name === 'calls' ? formatNumber(entry.value) : activeChart === 'cost' ? formatCurrency(entry.value) : formatNumber(entry.value)}</strong>
          </div>
        ))}
      </div>
    )
  }

  const summaryColumns = [
    { key: 'provider', header: 'Provider', render: (row: any) => <strong>{row.provider.charAt(0).toUpperCase() + row.provider.slice(1)}</strong> },
    { key: 'calls', header: 'Calls', render: (row: any) => formatNumber(row.calls) },
    { key: 'total_cost', header: 'Total Cost', render: (row: any) => <span className="mono">${Number(row.total_cost).toFixed(4)}</span> },
    { key: 'tokens_in', header: 'Tokens In', render: (row: any) => <span className="mono">{formatNumber(row.tokens_in)}</span> },
    { key: 'tokens_out', header: 'Tokens Out', render: (row: any) => <span className="mono">{formatNumber(row.tokens_out)}</span> },
    { key: 'avg_duration_ms', header: 'Avg Duration', render: (row: any) => <span className="mono">{row.avg_duration_ms > 0 ? `${row.avg_duration_ms}ms` : '—'}</span> },
    { key: 'costPerCall', header: 'Cost / Call', render: (row: any) => <span className="mono">{row.calls > 0 ? `$${(row.total_cost / row.calls).toFixed(4)}` : '—'}</span> },
  ]

  const modelColumns = [
    { key: 'provider', header: 'Provider', render: (row: any) => <strong>{row.provider.charAt(0).toUpperCase() + row.provider.slice(1)}</strong> },
    { key: 'model', header: 'Model', render: (row: any) => <span className="mono">{row.model}</span> },
    { key: 'calls', header: 'Calls', render: (row: any) => formatNumber(row.calls) },
    { key: 'total_cost', header: 'Cost', render: (row: any) => <span className="mono">${Number(row.total_cost).toFixed(4)}</span> },
    { key: 'tokens_in', header: 'Tokens In', render: (row: any) => <span className="mono">{formatNumber(row.tokens_in)}</span> },
    { key: 'tokens_out', header: 'Tokens Out', render: (row: any) => <span className="mono">{formatNumber(row.tokens_out)}</span> },
    { key: 'costPerCall', header: 'Cost / Call', render: (row: any) => <span className="mono">{row.calls > 0 ? `$${(row.total_cost / row.calls).toFixed(4)}` : '—'}</span> },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>API Usage Dashboard</h2>
          <p>Cost tracking, token usage, and provider analytics over time</p>
        </div>
      </div>

      <div className="page-body">
        {/* Filters */}
        <Card className="mb-4" style={{ padding: 0 }}>
          <CardBody>
            <div className="usage-filters">
              <SelectField label="Client" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
                options={[{ value: '', label: 'Select a client...' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
                style={{ minWidth: 250, marginBottom: 0 }} />
              <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
                <label>Period</label>
                <div className="period-toggle">
                  {PERIOD_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`period-btn ${period === opt.value ? 'active' : ''}`}
                      onClick={() => setPeriod(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {!selectedClientId ? (
          <CardBody style={{ marginTop: 40 }}>
            <p className="text-secondary">Select a client to view API usage data.</p>
          </CardBody>
        ) : loading ? (
          <CardBody style={{ marginTop: 40 }}>
            <div className="spinner" />
            <p>Loading API usage data...</p>
          </CardBody>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="stats-grid" style={{ marginTop: 20 }}>
              <Card className="stat-card">
                <CardBody>
                  <div className="stat-value">${Number(totalCost).toFixed(4)}</div>
                  <div className="stat-label">Total Cost (MTD)</div>
                </CardBody>
              </Card>
              <Card className="stat-card">
                <CardBody>
                  <div className="stat-value">{formatNumber(totalCalls)}</div>
                  <div className="stat-label">API Calls</div>
                </CardBody>
              </Card>
              <Card className="stat-card">
                <CardBody>
                  <div className="stat-value">{formatNumber(totalTokens)}</div>
                  <div className="stat-label">Total Tokens</div>
                </CardBody>
              </Card>
              <Card className="stat-card">
                <CardBody>
                  <div className="stat-value">{avgDuration > 0 ? `${avgDuration}ms` : '—'}</div>
                  <div className="stat-label">Avg Duration</div>
                </CardBody>
              </Card>
              <Card className="stat-card">
                <CardBody>
                  <div className="stat-value">{formatNumber(data?.mtd?.total_tokens_in ?? 0)}</div>
                  <div className="stat-label">Tokens In</div>
                </CardBody>
              </Card>
              <Card className="stat-card">
                <CardBody>
                  <div className="stat-value">{formatNumber(data?.mtd?.total_tokens_out ?? 0)}</div>
                  <div className="stat-label">Tokens Out</div>
                </CardBody>
              </Card>
            </div>

            {/* Provider Breakdown Chart (Pie) */}
            <div className="chart-grid">
              <Card className="chart-card">
                <CardHeader>Cost by Provider (MTD) <span className="text-muted">· ${Number(totalCost).toFixed(4)} total</span></CardHeader>
                <CardBody className="chart-body">
                  {providerPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={providerPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          animationBegin={0}
                          animationDuration={800}
                        >
                          {providerPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          formatter={(value: string) => <span className="chart-legend-text">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <p>No cost data available for this period.</p>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Per-Provider Cost Bars */}
              <Card className="chart-card">
                <CardHeader>Provider Cost Breakdown <span className="text-muted">· By provider + model</span></CardHeader>
                <CardBody className="chart-body">
                  {modelBarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={modelBarData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} tickFormatter={formatCurrencyShort} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="cost" name="Cost" radius={[4, 4, 0, 0]}>
                          {modelBarData.map((entry, i) => (
                            <Cell key={i} fill={getProviderColor(entry.provider)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <p>No model data available.</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Time Series Chart Tabs */}
            <Card style={{ marginTop: 20 }}>
              <CardHeader action={
                  <div className="chart-metric-toggle">
                    <button className={`metric-btn ${activeChart === 'cost' ? 'active' : ''}`} onClick={() => setActiveChart('cost')}>Cost</button>
                    <button className={`metric-btn ${activeChart === 'tokens' ? 'active' : ''}`} onClick={() => setActiveChart('tokens')}>Tokens</button>
                    <button className={`metric-btn ${activeChart === 'calls' ? 'active' : ''}`} onClick={() => setActiveChart('calls')}>Calls</button>
                  </div>
                }>
                Daily Usage Over Time
              </CardHeader>
              <CardBody className="chart-body">
                {stackedDailyData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={stackedDailyData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} tickFormatter={activeChart === 'cost' ? formatCurrencyShort : formatNumber} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={(value: string) => <span className="chart-legend-text">{value}</span>} />
                        {activeChart === 'cost' ? (
                          <>
                            {allProviders.map(provider => (
                              <Area key={provider} type="monotone" dataKey={provider} name={provider.charAt(0).toUpperCase() + provider.slice(1)}
                                stackId="1" stroke={getProviderColor(provider)} fill={getProviderColor(provider)} fillOpacity={0.6} animationDuration={600} />
                            ))}
                          </>
                        ) : activeChart === 'tokens' ? (
                          <Area type="monotone" dataKey="tokens" name="Tokens" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} animationDuration={600} />
                        ) : (
                          <Area type="monotone" dataKey="calls" name="Calls" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} animationDuration={600} />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                    <div style={{ height: 12 }} />
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={stackedDailyData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} interval="preserveStartEnd" />
                        <YAxis hide />
                        <Tooltip content={<CustomTooltip />} />
                        {activeChart === 'cost' ? (
                          allProviders.map(provider => (
                            <Line key={provider} type="monotone" dataKey={provider} name={provider.charAt(0).toUpperCase() + provider.slice(1)}
                              stroke={getProviderColor(provider)} strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={600} />
                          ))
                        ) : activeChart === 'tokens' ? (
                          <Line type="monotone" dataKey="tokens" name="Tokens" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={600} />
                        ) : (
                          <Line type="monotone" dataKey="calls" name="Calls" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={600} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div className="empty-state" style={{ padding: '60px 0' }}>
                    <p>No daily data available for the selected period.</p>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Per-Provider Summary Table */}
            <Card style={{ marginTop: 20 }}>
              <CardHeader>Provider Summary</CardHeader>
              <CardBody padding={false}>                  <DataTable
                    columns={summaryColumns.map(col => col.key === 'provider' ? { ...col, render: (row: any) => <><span className="provider-dot" style={{ background: getProviderColor(row.provider), display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6 }} />{row.provider.charAt(0).toUpperCase() + row.provider.slice(1)}</> } : col)}
                    data={(data.perProvider || []).map((p: any) => ({ ...p, costPerCall: p.total_cost / (p.calls || 1) }))}
                    keyExtractor={(row: any) => row.provider}
                    emptyMessage="No provider data available."
                  />
              </CardBody>
            </Card>

            {/* Model-Level Details */}
            {data.perModel?.length > 1 && (
              <Card style={{ marginTop: 20 }}>
                <CardHeader>Model-Level Breakdown</CardHeader>
                <CardBody padding={false}>
                  <DataTable
                    columns={modelColumns.map(col => col.key === 'provider' ? { ...col, render: (row: any) => <><span className="provider-dot" style={{ background: getProviderColor(row.provider), display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6 }} />{row.provider.charAt(0).toUpperCase() + row.provider.slice(1)}</> } : col)}
                    data={(data.perModel || []).map((m: any) => ({ ...m, costPerCall: m.total_cost / (m.calls || 1) }))}
                    keyExtractor={(row: any) => `${row.provider}-${row.model}`}
                    emptyMessage="No model data available."
                  />
                </CardBody>
              </Card>
            )}
          </>
        ) : (
          <CardBody style={{ marginTop: 40 }}>
            <p className="text-secondary">No API usage data available.</p>
          </CardBody>
        )}
      </div>
    </>
  )
}
