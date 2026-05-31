import { useState, useEffect } from 'react'
import { improvementsApi } from '../services/api'
import { Card, CardHeader, CardBody } from '../components/Card'
import { useToast } from '../components/Toast'
import type { ImprovementSuggestion } from '../types'

export default function Improvements() {
  const { addToast } = useToast()
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([])
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      setLoading(true)
      const data = await improvementsApi.list()
      setSuggestions(data.suggestions || [])
      setStats(data.stats || {})
    } catch {
      const msg = 'Failed to load improvement data'
      setError(msg)
      addToast('error', msg)
    } finally { setLoading(false) }
  }

  async function runAnalysis() {
    try {
      setAnalyzing(true)
      setError('')
      await improvementsApi.analyze()
      addToast('success', 'Analysis completed')
      loadData()
    } catch {
      const msg = 'Analysis failed'
      setError(msg)
      addToast('error', msg)
    } finally { setAnalyzing(false) }
  }

  const filtered = filter
    ? suggestions.filter(s => s.category === filter || s.metric.includes(filter))
    : suggestions

  const categories = [...new Set(suggestions.map(s => s.category))]

  function getPriorityIcon(s: ImprovementSuggestion): string {
    if (s.implemented) return '✅'
    if (s.value > 80) return '🔴'
    if (s.value > 50) return '🟡'
    return '🟢'
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>🤖 AI Self-Improvement</h1>
          <p className="text-secondary">System automatically analyzes performance and suggests optimizations</p>
        </div>
        <button className="btn btn-primary" onClick={runAnalysis} disabled={analyzing}>
          {analyzing ? 'Analyzing...' : '🔍 Run Analysis'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Stats cards */}
      <div className="stats-grid mb-4">
        <Card className="stat-card">
          <CardBody>
            <div className="stat-value">{stats.implementedFixes || 0}</div>
            <div className="stat-label">Auto-Fixes Applied</div>
          </CardBody>
        </Card>
        <Card className="stat-card">
          <CardBody>
            <div className="stat-value">{stats.pendingSuggestions || 0}</div>
            <div className="stat-label">Pending Suggestions</div>
          </CardBody>
        </Card>
        <Card className="stat-card">
          <CardBody>
            <div className="stat-value">{suggestions.length}</div>
            <div className="stat-label">Total Insights</div>
          </CardBody>
        </Card>
        <Card className="stat-card">
          <CardBody>
            <div className="stat-value">{categories.length}</div>
            <div className="stat-label">Categories</div>
          </CardBody>
        </Card>
      </div>

      {/* Category breakdown */}
      {stats.byCategory && (
        <Card className="mb-4">
          <CardHeader>Insights by Category</CardHeader>
          <CardBody>
            <div className="category-bars">
              {stats.byCategory.map((c: any) => (
                <div key={c.category} className="category-bar-item">
                  <div className="flex justify-between">
                    <span>{c.category}</span>
                    <span>{c.count} issues · avg {c.avg_value}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.min(c.count * 10, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="tabs mb-3">
        <button className={`tab ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>All</button>
        {categories.map(c => (
          <button key={c} className={`tab ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>

      {/* Suggestions list */}
      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <CardBody><p className="text-secondary">No suggestions yet. Run an analysis to start.</p></CardBody>
      ) : (
        <div className="suggestions-list">
          {filtered.map(s => (
            <Card key={s.id} className={`suggestion-card ${s.implemented ? 'implemented' : ''}`}>
              <CardBody>
                <div className="suggestion-header">
                  <span className="suggestion-icon">{getPriorityIcon(s)}</span>
                  <div className="suggestion-content">
                    <div className="suggestion-meta">
                      <span className="badge">{s.category}</span>
                      <span className="badge badge-sm">{s.metric}</span>
                      <span className="text-secondary text-sm">Value: {s.value}</span>
                      {s.implemented && <span className="badge badge-success">Fixed</span>}
                    </div>
                    <p>{s.suggestion}</p>
                  </div>
                </div>
                <div className="text-secondary text-xs">
                  {new Date(s.created_at).toLocaleString()}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
