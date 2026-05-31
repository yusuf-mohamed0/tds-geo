import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { articlesApi, clientsApi } from '../services/api'
import { Article, Client } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import { InputField, SelectField, CheckboxField, FormRow } from '../components/FormField'
import { useToast } from '../components/Toast'

const STATUS_BADGE: Record<string, string> = {
  published: 'green', draft: 'gray', generated: 'yellow',
  approved: 'blue', rejected: 'red', failed: 'red', pending: 'yellow',
}

export default function Articles() {
  const [searchParams] = useSearchParams()
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [page, setPage] = useState(1)
  const [showGenerate, setShowGenerate] = useState(searchParams.get('action') === 'generate')
  const limit = 20
  const { addToast } = useToast()

  const fetchArticles = async () => {
    setLoading(true)
    setError('')
    try {
      const params: any = { limit, offset: (page - 1) * limit }
      if (statusFilter) params.status = statusFilter
      const data = await articlesApi.list(params)
      setArticles(data.data || [])
      setTotal(data.total || 0)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load articles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArticles()
  }, [page, statusFilter])

  const totalPages = Math.ceil(total / limit)

  const columns: Column<Article>[] = [
    {
      key: 'title',
      header: 'Title / Keyword',
      render: (article) => (
        <Link to={`/articles/${article.id}`} style={{ fontWeight: 500 }}>
          {article.title || article.keyword || 'Untitled'}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (article) => (
        <span className={`badge badge-${STATUS_BADGE[article.status] || 'gray'}`}>{article.status}</span>
      ),
    },
    {
      key: 'seo_score',
      header: 'SEO Score',
      render: (article) =>
        article.seo_score != null ? (
          <span style={{
            color: article.seo_score >= 70 ? 'var(--success)' : article.seo_score >= 50 ? 'var(--warning)' : 'var(--danger)',
            fontWeight: 600,
          }}>
            {article.seo_score}
          </span>
        ) : '—',
    },
    {
      key: 'word_count',
      header: 'Word Count',
      render: (article) => <span className="text-muted">{article.word_count?.toLocaleString() || '—'}</span>,
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (article) => (
        <span className="text-muted text-sm">{new Date(article.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'id',
      header: '',
      render: (article) => (
        <Link to={`/articles/${article.id}`} className="btn btn-outline btn-sm">View</Link>
      ),
    },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Articles</h2>
          <p>{total} total articles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowGenerate(!showGenerate)}>
          + Generate New
        </button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {/* Filter tabs */}
        <div className="tabs">
          {['', 'generated', 'approved', 'published', 'rejected', 'failed'].map((s) => (
            <button
              key={s}
              className={`tab ${statusFilter === s ? 'active' : ''}`}
              onClick={() => { setStatusFilter(s); setPage(1) }}
            >
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Generate Form */}
        {showGenerate && (
          <Card style={{ marginBottom: 20 }}>
            <CardHeader>Generate New Article</CardHeader>
            <CardBody>
              <GenerateForm onGenerated={() => { setShowGenerate(false); fetchArticles() }} />
            </CardBody>
          </Card>
        )}

        {/* Articles table */}
        <Card>
          <CardBody padding={false}>
            <DataTable
              columns={columns}
              data={articles}
              keyExtractor={(a) => a.id}
              loading={loading}
              emptyMessage="No articles found matching the current filter."
              emptyAction={
                <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>
                  Generate Your First Article
                </button>
              }
              page={page}
              totalPages={totalPages}
              total={total}
              onPageChange={setPage}
            />
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function GenerateForm({ onGenerated }: { onGenerated: () => void }) {
  const { user } = useAuth()
  const [keyword, setKeyword] = useState('')
  const [clientId, setClientId] = useState(user?.client_id || '')
  const [clients, setClients] = useState<Client[]>([])
  const [tone, setTone] = useState('professional')
  const [publish, setPublish] = useState(false)
  const [blogId, setBlogId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { addToast } = useToast()

  useEffect(() => {
    clientsApi.list().then(data => {
      const list = data.clients || data.data || []
      setClients(list)
      if (list.length === 1 && !user?.client_id) {
        setClientId(list[0].id)
      }
    }).catch(() => {})
  }, [])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyword.trim()) return
    if (!clientId) {
      setError('Please select a client')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data: any = { keyword: keyword.trim(), tone, clientId }
      if (publish && blogId) { data.publish = true; data.blogId = parseInt(blogId) }
      await articlesApi.generate(data)
      addToast('success', 'Article generated successfully!')
      onGenerated()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate article')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleGenerate}>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <FormRow>
        <InputField label="Keyword / Topic" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g., gutter maintenance tips" required autoFocus />
        <SelectField
          label="Client"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          required
          placeholder="Select a client..."
          options={clients.map(c => ({ value: c.id, label: c.name }))}
        />
      </FormRow>

      <FormRow>
        <SelectField
          label="Tone"
          value={tone}
          onChange={e => setTone(e.target.value)}
          options={[
            { value: 'professional', label: 'Professional' },
            { value: 'educational', label: 'Educational' },
            { value: 'conversational', label: 'Conversational' },
            { value: 'authoritative', label: 'Authoritative' },
          ]}
        />
        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <CheckboxField label="Auto-publish" checked={publish} onChange={setPublish} />
          {publish && (
            <InputField label="Blog ID" value={blogId} onChange={e => setBlogId(e.target.value)} placeholder="Shopify Blog ID" style={{ width: 140 }} />
          )}
        </div>
      </FormRow>

      <button type="submit" className="btn btn-primary" disabled={loading || !clientId}>
        {loading ? '⏳ Generating...' : '🚀 Generate Article'}
      </button>
    </form>
  )
}
