import { useState, useEffect } from 'react'
import { articlesApi } from '../../services/api'

export default function ClientDashboard() {
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0 })

  useEffect(() => {
    articlesApi.list({ limit: 10 }).then(res => {
      const items = res.articles || res.data || []
      setArticles(items)
      setStats({
        total: res.total || res.pagination?.total || items.length,
        published: items.filter((a: any) => a.status === 'published').length,
        draft: items.filter((a: any) => a.status === 'draft' || a.status === 'generated').length,
      })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const pipelineColor = (score: number) => {
    if (score >= 80) return 'var(--tds-green)'
    if (score >= 60) return 'var(--tds-accent)'
    return 'var(--tds-yellow)'
  }

  return (
    <div className="tds-fade">
      <div className="tds-banner healthy">
        <span className="tds-banner-icon">&#10003;</span>
        API Active &mdash; ready to receive content from TDS Geo.
      </div>

      <div className="tds-grid">
        <div className="tds-stat tds-fade tds-fade-d1">
          <div className="tds-stat-label">Total Articles</div>
          <div className="tds-stat-value">{loading ? '...' : stats.total}</div>
        </div>
        <div className="tds-stat tds-fade tds-fade-d2">
          <div className="tds-stat-label">Published</div>
          <div className="tds-stat-value">{loading ? '...' : stats.published}</div>
        </div>
        <div className="tds-stat tds-fade tds-fade-d3">
          <div className="tds-stat-label">Draft / Review</div>
          <div className="tds-stat-value">{loading ? '...' : stats.draft}</div>
        </div>
        <div className="tds-stat tds-fade tds-fade-d4">
          <div className="tds-stat-label">Quality Score</div>
          <div className="tds-stat-value">
            {loading ? '...' : articles.length > 0
              ? Math.round(articles.reduce((s: number, a: any) => s + (a.qualityScore || a.quality_score || 0), 0) / articles.length)
              : '--'
            }
            <span style={{ fontSize: '14px', color: 'var(--tds-text-tertiary)', fontWeight: 400 }}>/100</span>
          </div>
        </div>
      </div>

      <div className="tds-card">
        <div className="tds-card-header">
          <h2>Recent Articles</h2>
        </div>
        <div className="tds-table-wrap">
          <table className="tds-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Quality</th>
                <th>Pipeline</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}>
                  <div className="tds-skeleton tds-skeleton-line" />
                  <div className="tds-skeleton tds-skeleton-line" />
                  <div className="tds-skeleton tds-skeleton-line" />
                </td></tr>
              ) : articles.length === 0 ? (
                <tr><td colSpan={6}><div className="tds-empty">No articles yet.</div></td></tr>
              ) : articles.map((article: any) => (
                <tr key={article.id}>
                  <td>
                    <a href={`/articles/${article.id}`} className="tds-cell-link">
                      {article.title || article.content?.substring(0, 60)}
                    </a>
                  </td>
                  <td>
                    <span className={`tds-tag ${article.status === 'published' ? 'tds-tag-green' : article.status === 'draft' ? 'tds-tag-yellow' : 'tds-tag-blue'}`}>
                      {article.status}
                    </span>
                  </td>
                  <td>
                    <span className="tds-tag tds-tag-blue">
                      {article.qualityScore || article.quality_score || '--'}/100
                    </span>
                  </td>
                  <td>
                    <div className="tds-pipeline-bar">
                      <div className="tds-pipeline-fill" style={{ width: `${article.qualityScore || article.quality_score || 0}%`, background: pipelineColor(article.qualityScore || article.quality_score || 0) }} />
                      <div className="tds-pipeline-label">
                        {article.status === 'published' ? 'Completed' : article.status === 'draft' ? 'Generated' : 'Processing'}
                      </div>
                    </div>
                  </td>
                  <td className="tds-text-mono">
                    {article.createdAt ? new Date(article.createdAt).toLocaleDateString() : article.created_at ? new Date(article.created_at).toLocaleDateString() : '--'}
                  </td>
                  <td>
                    <div className="tds-action-group">
                      <button className="tds-btn tds-btn-secondary tds-btn-sm">View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
