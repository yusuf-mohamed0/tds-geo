import { useState, useEffect } from 'react'
import { analyticsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'

interface QueueJob {
  id: string
  job_id: string
  type: string
  status: 'queued' | 'active' | 'completed' | 'failed' | 'delayed' | 'dead_lettered'
  data: Record<string, unknown>
  error_message?: string
  attempts: number
  max_attempts: number
  queued_at: string
  started_at?: string
  completed_at?: string
}

const STATUS_BADGE: Record<string, string> = {
  queued: 'gray', active: 'blue', completed: 'green',
  failed: 'red', delayed: 'yellow', dead_lettered: 'purple',
}

const JOB_ICONS: Record<string, string> = {
  article_generation: '✍️', fact_check: '✅', brand_voice: '🎙️',
  seo_intelligence: '📈', multi_cms_publish: '🚀', pexels_image: '🖼️',
  cost_optimization: '💰', editorial_workflow: '👥', content_intelligence: '🧠',
  ai_evaluation: '⭐', observability: '📊',
}

export default function QueueDashboard() {
  const { user, isAdmin } = useAuth()
  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [selectedJob, setSelectedJob] = useState<QueueJob | null>(null)

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const data = await analyticsApi.jobs(user?.client_id || '')
      setJobs(data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJobs() }, [])

  const getJobTypes = () => {
    const types = new Set(jobs.map(j => j.type))
    return Array.from(types)
  }

  const filteredJobs = jobs.filter(j => {
    if (statusFilter && j.status !== statusFilter) return false
    if (typeFilter && j.type !== typeFilter) return false
    return true
  })

  const counts = {
    active: jobs.filter(j => j.status === 'active').length,
    queued: jobs.filter(j => j.status === 'queued').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    dead_lettered: jobs.filter(j => j.status === 'dead_lettered').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    total: jobs.length,
  }

  const columns: Column<QueueJob>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (j) => (
        <span className="flex items-center gap-2">
          <span>{JOB_ICONS[j.type] || '📋'}</span>
          <span style={{ fontWeight: 500 }}>{j.type.replace(/_/g, ' ')}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (j) => <span className={`badge badge-${STATUS_BADGE[j.status] || 'gray'}`}>{j.status.replace('_', ' ')}</span>,
    },
    {
      key: 'attempts',
      header: 'Attempts',
      render: (j) => (
        <span style={{ color: j.attempts > 2 ? 'var(--danger)' : j.attempts > 1 ? 'var(--warning)' : 'var(--gray-500)' }}>
          {j.attempts}/{j.max_attempts}
        </span>
      ),
    },
    {
      key: 'queued_at',
      header: 'Queued',
      render: (j) => <span className="text-sm text-muted">{new Date(j.queued_at).toLocaleString()}</span>,
    },
    {
      key: 'started_at',
      header: 'Started',
      render: (j) => j.started_at ? <span className="text-sm text-muted">{new Date(j.started_at).toLocaleString()}</span> : <span className="text-muted">—</span>,
    },
    {
      key: 'id',
      header: '',
      render: (j) => (
        <button className="btn btn-outline btn-sm" onClick={() => setSelectedJob(j)}>Details</button>
      ),
    },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Queue Dashboard</h2>
          <p>Monitor jobs, retries, and queue health</p>
        </div>
        <button className="btn btn-outline" onClick={fetchJobs}>🔄 Refresh</button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">🔄</div>
            <div><div className="stat-value">{counts.active}</div><div className="stat-label">Active</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow">⏳</div>
            <div><div className="stat-value">{counts.queued}</div><div className="stat-label">Queued</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red">❌</div>
            <div><div className="stat-value">{counts.failed}</div><div className="stat-label">Failed</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">💀</div>
            <div><div className="stat-value">{counts.dead_lettered}</div><div className="stat-label">Dead Lettered</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">✅</div>
            <div><div className="stat-value">{counts.completed}</div><div className="stat-label">Completed</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">📊</div>
            <div><div className="stat-value">{counts.total}</div><div className="stat-label">Total</div></div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <span>Jobs</span>
              <select className="form-select" style={{ width: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="delayed">Delayed</option>
                <option value="dead_lettered">Dead Lettered</option>
              </select>
              <select className="form-select" style={{ width: 200 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                {getJobTypes().map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardBody padding={false}>
            <DataTable
              columns={columns}
              data={filteredJobs}
              keyExtractor={(j) => j.id}
              loading={loading}
              emptyMessage="No jobs found matching the filters."
            />
          </CardBody>
        </Card>

        {/* Job Detail Modal */}
        {selectedJob && (
          <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
              <div className="modal-header">
                <h3>Job Details</h3>
                <span className={`badge badge-${STATUS_BADGE[selectedJob.status]}`}>{selectedJob.status}</span>
              </div>
              <div className="modal-body" style={{ fontSize: 13 }}>
                <div className="grid-2" style={{ marginBottom: 16 }}>
                  <div><strong>Type:</strong> {selectedJob.type.replace(/_/g, ' ')}</div>
                  <div><strong>Job ID:</strong> <code>{selectedJob.job_id}</code></div>
                  <div><strong>Attempts:</strong> {selectedJob.attempts}/{selectedJob.max_attempts}</div>
                  <div><strong>Queued:</strong> {new Date(selectedJob.queued_at).toLocaleString()}</div>
                  {selectedJob.started_at && <div><strong>Started:</strong> {new Date(selectedJob.started_at).toLocaleString()}</div>}
                  {selectedJob.completed_at && <div><strong>Completed:</strong> {new Date(selectedJob.completed_at).toLocaleString()}</div>}
                </div>
                {selectedJob.error_message && (
                  <div className="form-group">
                    <label>Error</label>
                    <div className="code-block" style={{ color: 'var(--danger)' }}>{selectedJob.error_message}</div>
                  </div>
                )}
                <div className="form-group">
                  <label>Data</label>
                  <div className="code-block">{JSON.stringify(selectedJob.data, null, 2)}</div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setSelectedJob(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
