import { useState, useEffect } from 'react'
import { articlesApi } from '../../services/api'

export default function ClientArticles() {
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    articlesApi.list({ limit: 50 }).then(res => {
      const items = res.articles || res.data || []
      setArticles(items)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? articles : articles.filter(a => a.status === filter)

  const statusTag = (status: string) => {
    const map: Record<string, string> = {
      published: 'tds-tag-green',
      draft: 'tds-tag-yellow',
      generated: 'tds-tag-blue',
      pending: 'tds-tag-yellow',
    }
    return map[status] || 'tds-tag-blue'
  }

  return (
    <div className="tds-fade">
      <div className="tds-gen">
        <div className="tds-gen-info">
          <div className="tds-gen-item">
            <span className="tds-gen-label">Total Articles</span>
            <span className="tds-gen-value">{articles.length}</span>
          </div>
          <div className="tds-gen-item">
            <span className="tds-gen-label">Published</span>
            <span className="tds-gen-value">{articles.filter(a => a.status === 'published').length}</span>
          </div>
          <div className="tds-gen-item">
            <span className="tds-gen-label">Draft</span>
            <span className="tds-gen-value">{articles.filter(a => a.status !== 'published').length}</span>
          </div>
        </div>
        <div className="tds-gen-actions">
          <div style={{ display: 'flex', gap: '4px' }}>
            {['all', 'published', 'draft', 'generated'].map(f => (
              <button key={f} className={`tds-btn tds-btn-sm ${filter === f ? 'tds-btn-primary' : 'tds-btn-secondary'}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="tds-card">
        <div className="tds-card-header"><h2>Articles</h2></div>
        <div className="tds-table-wrap">
          <table className="tds-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Quality</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}>
                  <div className="tds-skeleton tds-skeleton-line" />
                  <div className="tds-skeleton tds-skeleton-line" />
                  <div className="tds-skeleton tds-skeleton-line" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5}><div className="tds-empty">No articles match this filter.</div></td></tr>
              ) : filtered.map((a: any) => (
                <tr key={a.id}>
                  <td><a href={`/articles/${a.id}`} className="tds-cell-link">{a.title || a.content?.substring(0, 60)}</a></td>
                  <td><span className={`tds-tag ${statusTag(a.status)}`}>{a.status}</span></td>
                  <td><span className="tds-tag tds-tag-blue">{a.qualityScore || a.quality_score || '--'}/100</span></td>
                  <td className="tds-text-mono">{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : a.created_at ? new Date(a.created_at).toLocaleDateString() : '--'}</td>
                  <td><div className="tds-action-group"><button className="tds-btn tds-btn-secondary tds-btn-sm">View</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
