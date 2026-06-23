import { useEffect, useState, useCallback } from 'react'

type Article = {
  id: string
  title: string
  status: string
  seo_score: number | null
  word_count: number | null
  created_at: string
}

type Stats = {
  total: number
  published: number
  pending: number
}

function formatDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString() } catch { return dateStr }
}

function statusTagClass(status: string): string {
  const map: Record<string, string> = { published: 'tds-tag-green', draft: 'tds-tag-yellow', generated: 'tds-tag-blue', approved: 'tds-tag-blue' }
  return map[status] || 'tds-tag-blue'
}

async function getToken(): Promise<string | null> {
  const shopify = (window as any).shopify
  if (shopify?.idToken) {
    try { return await shopify.idToken() } catch { /* */ }
  }
  const fromUrl = new URLSearchParams(window.location.search).get('id_token')
  if (fromUrl) return fromUrl
  return new Promise(resolve => {
    const check = setInterval(async () => {
      const s = (window as any).shopify
      if (s?.idToken) {
        clearInterval(check)
        try { const t = await s.idToken(); if (t) resolve(t); return } catch { /* */ }
      }
    }, 200)
    setTimeout(() => { clearInterval(check); resolve(null) }, 15000)
  })
}

function DashboardContent() {
  const params = new URLSearchParams(window.location.search)
  const shop = params.get('shop') || ''
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, pending: 0 })
  const [avgSeo, setAvgSeo] = useState<number | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [genKeyword, setGenKeyword] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pubMsg, setPubMsg] = useState('')

  useEffect(() => {
    getToken().then(t => { if (t) setToken(t) })
  }, [])

  async function apiFetch(path: string, opts?: RequestInit) {
    let t = token
    if (!t) t = await getToken()
    if (!t) return null
    const res = await fetch(path, { ...opts, headers: { ...opts?.headers, Authorization: `Bearer ${t}` } })
    return res.ok ? res.json() : null
  }

  useEffect(() => {
    if (!token) return
    apiFetch('/api/embedded/stats').then(data => {
      if (data) {
        const s = data.articles || {}
        setStats({ total: s.total || 0, published: s.published || 0, pending: s.pending || 0 })
        setAvgSeo(s.avg_seo_score != null ? Math.round(Number(s.avg_seo_score)) : null)
      }
    })
  }, [token])

  const fetchArticles = useCallback(async () => {
    setArticlesLoading(true)
    try {
      const data = await apiFetch('/api/embedded/articles')
      if (data) setArticles(data.articles || [])
    } finally {
      setArticlesLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (activeTab === 'articles') fetchArticles()
  }, [activeTab, fetchArticles])

  async function handlePublishAll() {
    setPublishing(true)
    setPubMsg('')
    try {
      const data = await apiFetch('/api/embedded/articles/publish-all', { method: 'POST' })
      if (data) {
        setPubMsg(`${data.published} published, ${data.failed || 0} failed`)
        fetchArticles()
      }
    } catch {
      setPubMsg('Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setPubMsg('')
    try {
      const data = await apiFetch('/api/embedded/articles/sync', { method: 'POST' })
      if (data) {
        setPubMsg(`Synced ${data.synced} articles from Shopify`)
        fetchArticles()
      } else {
        setPubMsg('Sync failed — check console or try again')
      }
    } catch {
      setPubMsg('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function handleGenerate() {
    if (!genKeyword.trim()) return
    setGenLoading(true)
    setGenError('')
    try {
      const data = await apiFetch('/api/embedded/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: genKeyword.trim() }),
      })
      if (!data) {
        setGenError('Request failed — server returned an error. Check console for details.')
      } else if (data.error) {
        setGenError(data.error)
      } else if (data.article) {
        setArticles(prev => [data.article, ...prev])
        setStats(prev => ({ ...prev, total: prev.total + 1 }))
        setGenKeyword('')
        setActiveTab('articles')
      } else if (data.id) {
        setArticles(prev => [data, ...prev])
        setStats(prev => ({ ...prev, total: prev.total + 1 }))
        setGenKeyword('')
        setActiveTab('articles')
      } else {
        setGenError('Article generated but response was unexpected. Check Articles tab.')
        setActiveTab('articles')
      }
    } catch {
      setGenError('Generation failed')
    } finally {
      setGenLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="tds-shell-full">
        <div className="tds-shell" style={{ maxWidth: '100%', padding: '40px 20px', textAlign: 'center' }}>
          <div className="tds-skeleton tds-skeleton-line" style={{ width: '60%', margin: '0 auto 12px' }} />
          <div className="tds-skeleton tds-skeleton-line" style={{ width: '40%', margin: '0 auto' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="tds-shell-full">
      <div className="tds-shell" style={{ maxWidth: '100%', padding: '16px 20px' }}>
        <nav className="tds-nav" style={{ marginBottom: '16px' }}>
          <div className="tds-nav-logo">
            <img src="/assets/logos/tds-geo-white.png" alt="TDS Geo" width="28" height="28" style={{ borderRadius: '4px' }} />
          </div>
          <span className="tds-nav-title" style={{ fontSize: '15px' }}>Traffic Digital Solutions GEO</span>
          <div className="tds-nav-items">
            <button className={`tds-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')} style={{ fontSize: '12px' }}>Dashboard</button>
            <button className={`tds-nav-item ${activeTab === 'articles' ? 'active' : ''}`} onClick={() => setActiveTab('articles')} style={{ fontSize: '12px' }}>Articles</button>
            <button className={`tds-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} style={{ fontSize: '12px' }}>Settings</button>
          </div>
          <div className="tds-nav-status">
            <span className="tds-nav-dot healthy" />
            <span style={{ fontSize: '11px', color: 'var(--tds-text-tertiary)' }}>{shop}</span>
          </div>
        </nav>

        <div className="tds-banner healthy" style={{ padding: '10px 16px', marginBottom: '16px', fontSize: '13px' }}>
          <span className="tds-banner-icon">&#10003;</span>
          Connected &mdash; TDS Geo is active and ready.
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="tds-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <div className="tds-stat" style={{ padding: '14px 16px' }}>
                <div className="tds-stat-label" style={{ fontSize: '11px' }}>Articles Generated</div>
                <div className="tds-stat-value" style={{ fontSize: '22px' }}>{stats.total}</div>
              </div>
              <div className="tds-stat" style={{ padding: '14px 16px' }}>
                <div className="tds-stat-label" style={{ fontSize: '11px' }}>GEO Score</div>
                <div className="tds-stat-value" style={{ fontSize: '22px' }}>{avgSeo != null ? avgSeo : '--'}</div>
                <div className="tds-stat-sub" style={{ fontSize: '11px' }}>/100 average</div>
              </div>
              <div className="tds-stat" style={{ padding: '14px 16px' }}>
                <div className="tds-stat-label" style={{ fontSize: '11px' }}>Published</div>
                <div className="tds-stat-value" style={{ fontSize: '22px' }}>{stats.published}</div>
              </div>
              <div className="tds-stat" style={{ padding: '14px 16px' }}>
                <div className="tds-stat-label" style={{ fontSize: '11px' }}>Pending</div>
                <div className="tds-stat-value" style={{ fontSize: '22px' }}>{stats.pending}</div>
              </div>
            </div>

            <div className="tds-card" style={{ padding: '16px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Generate Article</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  className="tds-input"
                  placeholder="Enter a keyword to generate an article..."
                  value={genKeyword}
                  onChange={e => setGenKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  disabled={genLoading}
                  style={{ flex: 1, fontSize: '13px', padding: '7px 10px' }}
                />
                <button className="tds-btn tds-btn-primary" onClick={handleGenerate} disabled={genLoading || !genKeyword.trim()} style={{ fontSize: '12px', padding: '6px 14px' }}>
                  {genLoading ? 'Generating...' : 'Generate'}
                </button>
              </div>
              {genError && <p style={{ color: 'var(--tds-red)', fontSize: '12px', marginTop: '6px' }}>{genError}</p>}
            </div>
          </>
        )}

        {activeTab === 'articles' && (
          <div className="tds-card" style={{ padding: '16px' }}>
            <div className="tds-card-header" style={{ marginBottom: '10px' }}>
              <h2 style={{ fontSize: '13px' }}>Articles ({articles.length})</h2>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button className="tds-btn tds-btn-secondary tds-btn-sm" onClick={handleSync} disabled={syncing} style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {syncing ? 'Syncing...' : 'Sync'}
                </button>
                <button className="tds-btn tds-btn-primary tds-btn-sm" onClick={handlePublishAll} disabled={publishing} style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {publishing ? 'Publishing...' : 'Publish All'}
                </button>
                <button className="tds-btn tds-btn-primary tds-btn-sm" onClick={() => setActiveTab('dashboard')} style={{ fontSize: '11px', padding: '3px 8px' }}>Generate</button>
              </div>
            </div>
            {pubMsg && <p style={{ color: 'var(--tds-text-secondary)', fontSize: '12px', margin: '4px 0' }}>{pubMsg}</p>}
            <div className="tds-table-wrap">
              <table className="tds-table">
                <thead>
                  <tr>
                    <th style={{ fontSize: '10px', padding: '6px 8px' }}>Title</th>
                    <th style={{ fontSize: '10px', padding: '6px 8px' }}>Status</th>
                    <th style={{ fontSize: '10px', padding: '6px 8px' }}>SEO</th>
                    <th style={{ fontSize: '10px', padding: '6px 8px' }}>Words</th>
                    <th style={{ fontSize: '10px', padding: '6px 8px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {articlesLoading ? (
                    <tr><td colSpan={5}>
                      <div className="tds-skeleton tds-skeleton-line" style={{ height: '24px' }} />
                      <div className="tds-skeleton tds-skeleton-line" style={{ height: '24px' }} />
                      <div className="tds-skeleton tds-skeleton-line" style={{ height: '24px' }} />
                    </td></tr>
                  ) : articles.length === 0 ? (
                    <tr><td colSpan={5}><div className="tds-empty" style={{ padding: '24px', fontSize: '13px' }}>No articles found. Generate your first article from the Dashboard.</div></td></tr>
                  ) : articles.map((a: Article) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500, fontSize: '12px', padding: '7px 8px' }}>{a.title}</td>
                      <td style={{ padding: '7px 8px' }}><span className={`tds-tag ${statusTagClass(a.status)}`} style={{ fontSize: '10px' }}>{a.status}</span></td>
                      <td style={{ padding: '7px 8px' }}><span className="tds-tag tds-tag-blue" style={{ fontSize: '10px' }}>{a.seo_score ?? '--'}</span></td>
                      <td className="tds-text-mono" style={{ fontSize: '11px', padding: '7px 8px' }}>{a.word_count ?? '--'}</td>
                      <td className="tds-text-mono" style={{ fontSize: '11px', padding: '7px 8px' }}>{formatDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="tds-card" style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Store Connection</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--tds-border)' }}>
                <span style={{ fontSize: '12px', color: 'var(--tds-text-secondary)' }}>Store</span>
                <span style={{ fontSize: '12px', fontWeight: 500 }}>{shop}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--tds-border)' }}>
                <span style={{ fontSize: '12px', color: 'var(--tds-text-secondary)' }}>Status</span>
                <span className="tds-tag tds-tag-green" style={{ fontSize: '10px' }}>Connected</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--tds-border)' }}>
                <span style={{ fontSize: '12px', color: 'var(--tds-text-secondary)' }}>Plan</span>
                <span style={{ fontSize: '12px', fontWeight: 500 }}>Starter — $29/mo</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--tds-border)' }}>
                <span style={{ fontSize: '12px', color: 'var(--tds-text-secondary)' }}>Auto-Publish</span>
                <span style={{ fontSize: '12px', fontWeight: 500 }}>Enabled</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                <span style={{ fontSize: '12px', color: 'var(--tds-text-secondary)' }}>Brand Voice</span>
                <span style={{ fontSize: '12px', fontWeight: 500 }}>Professional & Educational</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EmbeddedApp() {
  return <DashboardContent />
}
