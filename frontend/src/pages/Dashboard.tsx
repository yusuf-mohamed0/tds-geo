import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { articlesApi, adminApi, analyticsApi, editorialApi, observabilityApi, contentIntelApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { DashboardOverview, AdminDashboard, Article, EnterpriseDashboardData, EditorialReviewAssignment, SystemAlert } from '../types'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import Icon from '../components/Icon'

export default function Dashboard() {
  const { isAdmin, user } = useAuth()
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [enterpriseData, setEnterpriseData] = useState({
    pendingReviews: 0,
    overdueReviews: 0,
    claimsToReview: 0,
    falseClaims: 0,
    activeAlerts: 0,
    criticalAlerts: 0,
    brandVoiceScore: null as number | null,
    saturatedTopics: 0,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        let mainData: any
        if (isAdmin) {
          mainData = await adminApi.dashboard()
        } else if (user?.client_id) {
          const [overviewData, articles] = await Promise.all([
            analyticsApi.overview(user.client_id),
            articlesApi.list({ clientId: user.client_id, limit: 5 }),
          ])
          mainData = { ...overviewData, recentArticles: articles.data || [] }
        } else {
          // No client_id or admin role — server-side aggregation not available.
          // Return an empty state rather than constructing data client-side.
          mainData = {
            articles: null,
            keywords: null,
            publishing: null,
            costs: null,
            recentArticles: [],
          }
        }
        setOverview(mainData)

        // Fetch enterprise data in parallel (best-effort)
        try {
          const assignments = await editorialApi.getAssignments()
          const pending = (assignments.data || []).filter((a: EditorialReviewAssignment) => a.status === 'pending')
          const overdue = pending.filter((a: EditorialReviewAssignment) => a.due_at && new Date(a.due_at) < new Date())

          const obs = await observabilityApi.getDashboard(user?.client_id || undefined)
          const obsData = obs.data || {}

          let alerts: SystemAlert[] = []
          try { const a = await observabilityApi.getAlerts(); alerts = a.data || [] } catch {}

          setEnterpriseData({
            pendingReviews: pending.length,
            overdueReviews: overdue.length,
            claimsToReview: 0,
            falseClaims: 0,
            activeAlerts: alerts.filter(a => a.status === 'active').length,
            criticalAlerts: alerts.filter(a => a.severity === 'critical' && a.status === 'active').length,
            brandVoiceScore: null,
            saturatedTopics: 0,
          })
        } catch { /* enterprise features may not be configured yet */ }

      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [isAdmin, user?.client_id])

  if (loading) {
    return (
      <div className="page-body">
        <Card>
          <CardBody>
            <div className="empty-state"><div className="spinner" /><p>Loading dashboard...</p></div>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-body">
        <Card>
          <CardBody>
            <div className="alert alert-error">{error}</div>
          </CardBody>
        </Card>
      </div>
    )
  }

  const stats = overview as any

  const articleColumns: Column<Article>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (article) => (
        <Link to={`/articles/${article.id}`} style={{ fontWeight: 500 }}>
          {article.title || article.keyword || 'Untitled'}
        </Link>
      ),
    },
    { key: 'status', header: 'Status', render: (article) => (
      <span className={`badge badge-${
        article.status === 'published' ? 'green' :
        article.status === 'approved' ? 'blue' :
        article.status === 'rejected' || article.status === 'failed' ? 'red' : 'yellow'
      }`}>{article.status}</span>
    )},
    { key: 'seo_score', header: 'SEO', render: (article) =>
      article.seo_score != null ? (
        <span style={{ color: article.seo_score >= 70 ? 'var(--success)' : article.seo_score >= 50 ? 'var(--warning)' : 'var(--danger)', fontWeight: 600 }}>
          {article.seo_score}/100
        </span>
      ) : <span className="text-muted">—</span>
    },
    { key: 'created_at', header: 'Created', render: (article) => (
      <span className="text-muted text-sm">{new Date(article.created_at).toLocaleDateString()}</span>
    )},
    { key: 'id', header: '', render: (article) => (
      <Link to={`/articles/${article.id}`} className="btn btn-outline btn-sm">View</Link>
    )},
  ]

  const hasEnterpriseData = enterpriseData.pendingReviews > 0 || enterpriseData.activeAlerts > 0 || enterpriseData.criticalAlerts > 0

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Enterprise Dashboard</h2>
          <p>AI automation overview with editorial, observability, and content intelligence</p>
        </div>
        <div className="card-actions">
          <Link to="/pipeline" className="btn btn-primary"><Icon name="publish" size="sm" /> Run Pipeline</Link>
          <Link to="/articles?action=generate" className="btn btn-outline"><Icon name="add" size="sm" /> Generate Article</Link>
        </div>
      </div>

      <div className="page-body">
        {/* Main Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon purple"><Icon name="articles" size="lg" /></div>
            <div>
              <div className="stat-value">{stats.articles?.total ?? 0}</div>
              <div className="stat-label">Total Articles</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Icon name="check" size="lg" /></div>
            <div>
              <div className="stat-value">{stats.articles?.published || 0}</div>
              <div className="stat-label">Published</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow"><Icon name="pending" size="lg" /></div>
            <div>
              <div className="stat-value">{stats.articles?.pending || stats.articles?.pending_review || 0}</div>
              <div className="stat-label">Pending Review</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><Icon name="keyword" size="lg" /></div>
            <div>
              <div className="stat-value">{stats.keywords?.total || 0}</div>
              <div className="stat-label">Keywords Tracked</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><Icon name="publish" size="lg" /></div>
            <div>
              <div className="stat-value">{stats.publishing?.total ?? 0}</div>
              <div className="stat-label">Total Published</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><Icon name="api-usage" size="lg" /></div>
            <div>
              <div className="stat-value">${Number(stats.costs?.total_cost ?? stats.costs?.total_cost_mtd ?? 0).toFixed(2)}</div>
              <div className="stat-label">Cost (Month)</div>
            </div>
          </div>
        </div>

        {/* Enterprise Stats Grid */}
        <div className="dashboard-enterprise-grid">
          {/* Editorial Queue */}
          <Link to="/editorial" className="dashboard-widget">
            <div className="dashboard-widget-header">
              <span className="dashboard-widget-icon"><Icon name="editorial" size="lg" /></span>
              <span className="dashboard-widget-title">Editorial Queue</span>
            </div>
            <div className="dashboard-widget-body">
              <div className="dashboard-widget-stat">
                <div className="dashboard-widget-value">{enterpriseData.pendingReviews}</div>
                <div className="dashboard-widget-label">Pending Reviews</div>
              </div>
              {enterpriseData.overdueReviews > 0 && (
                <div className="dashboard-widget-alert">
                  <Icon name="warning" /> {enterpriseData.overdueReviews} overdue
                </div>
              )}
              {enterpriseData.pendingReviews === 0 && (
                <div className="dashboard-widget-empty">All caught up! ✓</div>
              )}
            </div>
          </Link>

          {/* Observability */}
          <Link to="/observability" className="dashboard-widget">
            <div className="dashboard-widget-header">
              <span className="dashboard-widget-icon"><Icon name="observability" size="lg" /></span>
              <span className="dashboard-widget-title">System Health</span>
            </div>
            <div className="dashboard-widget-body">
              <div className="dashboard-widget-stat">
                <div className="dashboard-widget-value" style={{ color: enterpriseData.criticalAlerts > 0 ? 'var(--danger)' : enterpriseData.activeAlerts > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  {enterpriseData.activeAlerts}
                </div>
                <div className="dashboard-widget-label">Active Alerts</div>
              </div>
              {enterpriseData.criticalAlerts > 0 && (
                <div className="dashboard-widget-alert" style={{ background: '#fee2e2', color: '#991b1b' }}>
                  <Icon name="bell" /> {enterpriseData.criticalAlerts} critical
                </div>
              )}
              {enterpriseData.activeAlerts === 0 && (
                <div className="dashboard-widget-empty">All systems operational ✓</div>
              )}
            </div>
          </Link>

          {/* Pipeline */}
          <Link to="/pipeline" className="dashboard-widget">
            <div className="dashboard-widget-header">
              <span className="dashboard-widget-icon"><Icon name="pipeline" size="lg" /></span>
              <span className="dashboard-widget-title">Pipeline</span>
            </div>
            <div className="dashboard-widget-body">
              <div className="dashboard-widget-stat">
                <div className="dashboard-widget-value">{stats.articles?.total || 0}</div>
                <div className="dashboard-widget-label">Articles Generated</div>
              </div>
              <div className="dashboard-widget-footer">
                <span className="text-sm">Run a new pipeline →</span>
              </div>
            </div>
          </Link>

          {/* Content Intel */}
          <Link to="/content-intel" className="dashboard-widget">
            <div className="dashboard-widget-header">
              <span className="dashboard-widget-icon"><Icon name="content-intel" size="lg" /></span>
              <span className="dashboard-widget-title">Content Intelligence</span>
            </div>
            <div className="dashboard-widget-body">
              <div className="dashboard-widget-stat">
                <div className="dashboard-widget-value">{enterpriseData.saturatedTopics}</div>
                <div className="dashboard-widget-label">Saturated Topics</div>
              </div>
              <div className="dashboard-widget-stat">
                <div className="dashboard-widget-value">{enterpriseData.claimsToReview}</div>
                <div className="dashboard-widget-label">Fact Checks</div>
              </div>
            </div>
          </Link>

          {/* Brand Voice */}
          <Link to="/brand-voice" className="dashboard-widget">
            <div className="dashboard-widget-header">
              <span className="dashboard-widget-icon"><Icon name="brand-voice" size="lg" /></span>
              <span className="dashboard-widget-title">Brand Voice</span>
            </div>
            <div className="dashboard-widget-body">
              {enterpriseData.brandVoiceScore != null ? (
                <div className="dashboard-widget-stat">
                  <div className="dashboard-widget-value" style={{ color: enterpriseData.brandVoiceScore >= 70 ? 'var(--success)' : enterpriseData.brandVoiceScore >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                    {enterpriseData.brandVoiceScore}%
                  </div>
                  <div className="dashboard-widget-label">Consistency Score</div>
                </div>
              ) : (
                <div className="dashboard-widget-empty">Configure brand voice →</div>
              )}
            </div>
          </Link>

          {/* Queues */}
          <Link to="/queue" className="dashboard-widget">
            <div className="dashboard-widget-header">
              <span className="dashboard-widget-icon"><Icon name="queues" size="lg" /></span>
              <span className="dashboard-widget-title">Job Queues</span>
            </div>
            <div className="dashboard-widget-body">
              <div className="dashboard-widget-stat">
                <div className="dashboard-widget-value">{stats.articles?.total || 0}</div>
                <div className="dashboard-widget-label">Jobs Processed</div>
              </div>
              <div className="dashboard-widget-footer">
                <span className="text-sm">Monitor queue health →</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Articles */}
        <Card>
          <CardHeader action={<Link to="/articles" className="btn btn-outline btn-sm">View All</Link>}>
            Recent Articles
          </CardHeader>
          <CardBody padding={false}>
            <DataTable
              columns={articleColumns}
              data={stats.recentArticles || []}
              keyExtractor={(a) => a.id}
              loading={false}
              emptyMessage="No articles yet. Generate your first article to get started."
            />
          </CardBody>
        </Card>

        {/* Activity */}
        {isAdmin && (stats as any).activity?.length > 0 && (
          <Card style={{ marginTop: 24 }}>
            <CardHeader>Activity (Last 7 Days)</CardHeader>
            <CardBody>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {(stats as any).activity.map((a: any, i: number) => (
                  <div key={i} style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{a.count}</div>
                    <div className="text-muted text-sm">{new Date(a.date).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  )
}
