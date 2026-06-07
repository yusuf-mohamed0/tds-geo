import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { articlesApi, clientsApi, factCheckApi, evaluationApi } from '../services/api'
import { ArticleWithEditorial, SeoAnalysis, FactCheck, QualityReport } from '../types'
import { Card, CardHeader, CardBody, CardFooter } from '../components/Card'
import { InputField } from '../components/FormField'
import { useToast } from '../components/Toast'
import Icon from '../components/Icon'

const STATUS_COLORS: Record<string, string> = {
  published: 'green', draft: 'gray', generated: 'yellow', generated_approved: 'green',
  approved: 'blue', rejected: 'red', failed: 'red',
  in_seo_review: 'yellow', seo_reviewed: 'blue', in_editor_review: 'yellow',
  editor_reviewed: 'blue', scheduled: 'purple', archived: 'gray',
}

const STATUS_ORDER = ['draft', 'generated', 'in_seo_review', 'seo_reviewed', 'in_editor_review', 'editor_reviewed', 'approved', 'scheduled', 'published']

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<ArticleWithEditorial | null>(null)
  const [seoAnalysis, setSeoAnalysis] = useState<SeoAnalysis | null>(null)
  const [factChecks, setFactChecks] = useState<FactCheck[]>([])
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null)
  const [showEvaluation, setShowEvaluation] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [blogId, setBlogId] = useState('')
  const [showPublishInput, setShowPublishInput] = useState(false)
  const [availableBlogs, setAvailableBlogs] = useState<Array<{id: number; title: string; handle: string}>>([])
  const [loadingBlogs, setLoadingBlogs] = useState(false)
  const [publishResult, setPublishResult] = useState<{url?: string; shopifyArticleId?: number} | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const { addToast } = useToast()

  useEffect(() => {
    if (!id) return
    const fetchArticle = async () => {
      try {
        const data = await articlesApi.get(id!)
        setArticle(data)
        setEditContent(data.content_md || '')
        setEditTitle(data.title || '')
        try {
          const seo = await articlesApi.getSeo(id!)
          setSeoAnalysis(seo)
        } catch {}
        // Fetch enterprise data in parallel (best-effort)
        try {
          const fc = await factCheckApi.getFactChecks(id!)
          setFactChecks(fc.data || [])
        } catch {}
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load article')
      } finally {
        setLoading(false)
      }
    }
    fetchArticle()
  }, [id])

  const fetchBlogs = async (clientId: string) => {
    setLoadingBlogs(true)
    try {
      const result = await clientsApi.testShopify(clientId)
      if (result.success && result.blogs?.length > 0) {
        setAvailableBlogs(result.blogs)
        if (!blogId) setBlogId(String(result.blogs[0].id))
      }
    } catch {
      // Blogs fetch failed — user can still type a blog ID manually
    } finally {
      setLoadingBlogs(false)
    }
  }

  const performAction = async (action: string, data?: any) => {
    if (!id) return
    setActionLoading(action)
    const prevError = error
    setError('')
    try {
      let result
      switch (action) {
        case 'approve':
          result = await articlesApi.approve(id)
          addToast('success', 'Article approved! Ready to publish.')
          break
        case 'reject':
          result = await articlesApi.reject(id, rejectReason)
          setShowRejectInput(false)
          setRejectReason('')
          addToast('info', 'Article rejected.')
          break
        case 'regenerate':
          result = await articlesApi.regenerate(id)
          addToast('success', 'Article regenerated successfully!')
          break
        case 'publish':
          if (!data?.blogId) return
          setPublishResult(null)
          result = await articlesApi.publish(id, data.blogId)
          setShowPublishInput(false)
          if (result?.success) {
            setPublishResult({
              url: result.publishResult?.url || result.url,
              shopifyArticleId: result.publishResult?.id || result.shopifyArticleId,
            })
            addToast('success', 'Article published to Shopify!')
          }
          break
        case 'save':
          result = await articlesApi.update(id, { title: editTitle, content_md: editContent })
          setEditing(false)
          addToast('success', 'Changes saved successfully.')
          break
      }
      if (result?.article) setArticle(result.article)
      else {
        const updated = await articlesApi.get(id)
        setArticle(updated)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} article`)
    } finally {
      setActionLoading('')
    }
  }

  if (loading) {
    return (
      <div className="page-body">
        <Card>
          <CardBody>
            <div className="empty-state"><div className="spinner" /><p>Loading article...</p></div>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (error && !article) {
    return (
      <div className="page-body">
        <Card>
          <CardBody>
            <div className="alert alert-error">{error}</div>
            <button className="btn btn-outline" onClick={() => navigate('/articles')}>← Back to Articles</button>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="page-body">
        <Card>
          <CardBody>
            <div className="empty-state"><p>Article not found.</p></div>
            <button className="btn btn-outline" onClick={() => navigate('/articles')}>← Back to Articles</button>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/articles')}>← Back</button>
          <div>
            <h2 style={{ fontSize: 20 }}>{article.title || article.keyword || 'Untitled'}</h2>
            <p className="text-sm text-muted">
              Created {new Date(article.created_at).toLocaleString()} · {article.word_count?.toLocaleString()} words
              {article.keyword && <> · Keyword: <strong>{article.keyword}</strong></>}
            </p>
          </div>
        </div>
        <span className={`badge badge-${STATUS_COLORS[article.status] || 'gray'}`} style={{ fontSize: 14, padding: '4px 12px' }}>
          {article.status}
        </span>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {/* Published Result Banner */}
        {publishResult?.url && (
          <div className="alert alert-success" style={{ marginBottom: 20 }}>
            <strong><Icon name="success" /> Published!</strong>
            <a href={publishResult.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>
              View on Shopify <Icon name="external-link" />
            </a>
          </div>
        )}

        {/* Action Buttons */}
        <Card style={{ marginBottom: 20 }}>
          <CardBody style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(article.status === 'generated' || article.status === 'draft') && (
              <>
                <button className="btn btn-success" onClick={() => performAction('approve')} disabled={!!actionLoading}>
                  {actionLoading === 'approve' ? <><Icon name="loading" spin /> Approving...</> : <><Icon name="approve" /> Approve</>}
                </button>
                <button className="btn btn-warning" onClick={() => performAction('regenerate')} disabled={!!actionLoading}>
                  {actionLoading === 'regenerate' ? <><Icon name="loading" spin /> Regenerating...</> : <><Icon name="regenerate" /> Regenerate</>}
                </button>
                {!showRejectInput ? (
                  <button className="btn btn-danger" onClick={() => setShowRejectInput(true)} disabled={!!actionLoading}>
                    <Icon name="reject" /> Reject
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                    <input
                      className="form-input"
                      placeholder="Reason for rejection..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      style={{ flex: 1, minWidth: 200 }}
                    />
                    <button className="btn btn-danger btn-sm" onClick={() => performAction('reject')} disabled={!rejectReason.trim()}>Submit</button>
                    <button className="btn btn-outline btn-sm" onClick={() => { setShowRejectInput(false); setRejectReason('') }}>Cancel</button>
                  </div>
                )}
              </>
            )}
            {article.status === 'approved' && (
              <>
                {!showPublishInput ? (
                  <button className="btn btn-success" onClick={() => {
                    setShowPublishInput(true)
                    if (article.client_id) fetchBlogs(article.client_id)
                  }} disabled={!!actionLoading}>
                    <Icon name="publish" /> Publish to Shopify
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {loadingBlogs ? (
                      <span className="text-muted text-sm"><Icon name="loading" spin /> Fetching blogs...</span>
                    ) : availableBlogs.length > 0 ? (
                      <select className="form-select" value={blogId} onChange={e => setBlogId(e.target.value)} style={{ width: 200 }}>
                        {availableBlogs.map(b => (
                          <option key={b.id} value={b.id}>{b.title} (ID: {b.id})</option>
                        ))}
                      </select>
                    ) : (
                      <input className="form-input" placeholder="Shopify Blog ID" value={blogId} onChange={e => setBlogId(e.target.value)} style={{ width: 160 }} />
                    )}
                    <button className="btn btn-success btn-sm"
                      onClick={() => performAction('publish', { blogId: parseInt(blogId) })}
                      disabled={!blogId || !!actionLoading}>
                      {actionLoading === 'publish' ? <><Icon name="loading" spin /> Publishing...</> : 'Publish'}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => { setShowPublishInput(false); setAvailableBlogs([]) }}>Cancel</button>
                  </div>
                )}
                <button className="btn btn-warning" onClick={() => performAction('regenerate')} disabled={!!actionLoading}>
                  {actionLoading === 'regenerate' ? <><Icon name="loading" spin /> Regenerating...</> : <><Icon name="regenerate" /> Regenerate</>}
                </button>
              </>
            )}
            {article.status === 'published' && (
              <span className="badge badge-green" style={{ fontSize: 14, padding: '6px 14px' }}>
                <Icon name="completed" /> Published — no further actions available
              </span>
            )}
            {article.status === 'rejected' && (
              <span className="badge badge-red" style={{ fontSize: 14, padding: '6px 14px' }}>
                Rejected — regenerate to create a new version
              </span>
            )}
            {article.status === 'failed' && (
              <span className="badge badge-red" style={{ fontSize: 14, padding: '6px 14px' }}>
                <Icon name="failed" /> Generation failed — try regenerating
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setEditing(!editing)}>
                {editing ? <><Icon name="cancel" /> Cancel Edit</> : <><Icon name="edit" /> Edit</>}
              </button>
            </div>
          </CardBody>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
          {/* Main Content */}
          <div>
            {editing ? (
              <Card>
                <CardHeader>Edit Article</CardHeader>
                <CardBody>
                  <InputField label="Title" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                  <div className="form-group" style={{ marginTop: 16 }}>
                    <label>Content (Markdown)</label>
                    <textarea
                      className="form-textarea"
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      style={{ minHeight: 500, fontFamily: 'monospace', fontSize: 13 }}
                    />
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => performAction('save')} disabled={actionLoading === 'save'}>
                    {actionLoading === 'save' ? <><Icon name="loading" spin /> Saving...</> : <><Icon name="save" /> Save Changes</>}
                  </button>
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  Content Preview
                  {article.meta_title && <span className="text-sm text-muted" style={{ fontWeight: 400, marginLeft: 8 }}>Meta: {article.meta_title}</span>}
                </CardHeader>
                <CardBody>
                  <div style={{ lineHeight: 1.8, fontSize: 15 }}>
                    {article.content_html ? (
                      <div dangerouslySetInnerHTML={{ __html: article.content_html }} />
                    ) : article.content_md ? (
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, color: 'inherit', background: 'none', border: 'none', padding: 0 }}>{article.content_md}</pre>
                    ) : (
                      <p className="text-muted">No content available.</p>
                    )}
                  </div>
                </CardBody>
                {article.meta_description && (
                  <CardFooter className="text-sm text-muted">
                    <strong>Meta Description:</strong> {article.meta_description}
                  </CardFooter>
                )}
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div>
            {/* Details */}
            <Card style={{ marginBottom: 16 }}>
              <CardHeader>Details</CardHeader>
              <CardBody style={{ padding: '12px 16px', fontSize: 13 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div>
                    <strong>Status:</strong>{' '}
                    <span className={`badge badge-${STATUS_COLORS[article.status] || 'gray'}`} style={{ textTransform: 'uppercase', fontSize: 11 }}>
                      {article.status}
                    </span>
                  </div>
          <div><strong>Word Count:</strong> {article.word_count?.toLocaleString()}</div>
          {article.tags?.length > 0 && (
            <div><strong>Tags:</strong> {article.tags.join(', ')}</div>
          )}
          <div><strong>Created:</strong> {new Date(article.created_at).toLocaleDateString()}</div>
          <div><strong>Updated:</strong> {new Date(article.updated_at).toLocaleDateString()}</div>
          <div>
            <strong>SEO Score:</strong>{' '}
            {article.seo_score != null ? (
              <span style={{
                fontWeight: 600,
                color: article.seo_score >= 70 ? 'var(--success)' : article.seo_score >= 50 ? 'var(--warning)' : 'var(--danger)',
              }}>{article.seo_score}/100</span>
            ) : '—'}
          </div>
          {(article as ArticleWithEditorial).ai_evaluation_score != null && (
            <div>
              <strong>AI Quality:</strong>{' '}
              <span style={{ fontWeight: 600, color: (article as ArticleWithEditorial).ai_evaluation_score! >= 70 ? 'var(--success)' : (article as ArticleWithEditorial).ai_evaluation_score! >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                {(article as ArticleWithEditorial).ai_evaluation_score}/100
              </span>
            </div>
          )}
          {(article as ArticleWithEditorial).editorial_status && (
            <div>
              <strong>Editorial Status:</strong>{' '}
              <span className={`badge badge-${STATUS_COLORS[(article as ArticleWithEditorial).editorial_status!] || 'gray'}`}>
                {(article as ArticleWithEditorial).editorial_status!.replace(/_/g, ' ')}
              </span>
            </div>
          )}
          {article.keyword && (
            <div>
              <strong>Keyword:</strong>{' '}
              <span className="badge badge-blue">{article.keyword}</span>
            </div>
          )}
          {publishResult?.url && (
            <div>
              <strong>Published:</strong>{' '}
              <a href={publishResult.url} target="_blank" rel="noopener noreferrer" className="text-sm">View on Shopify ↗</a>
            </div>
          )}
                </div>

                {/* Enterprise Workflow Timeline */}
                <div style={{ marginTop: 16, borderTop: '1px solid var(--gray-200)', paddingTop: 12 }}>
                  <strong style={{ fontSize: 12, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Enterprise Workflow
                  </strong>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      { stage: 'draft', label: 'Draft' },
                      { stage: 'generated', label: 'Generated' },
                      { stage: 'in_seo_review', label: 'SEO Review' },
                      { stage: 'in_editor_review', label: 'Editor Review' },
                      { stage: 'approved', label: 'Approved' },
                      { stage: 'scheduled', label: 'Scheduled' },
                      { stage: 'published', label: 'Published' },
                    ].map((s) => {
                      const effectiveStatus = (article as ArticleWithEditorial).editorial_status || article.status
                      const currentIdx = STATUS_ORDER.indexOf(
                        effectiveStatus === 'rejected' || effectiveStatus === 'failed' ? 'draft' : effectiveStatus
                      )
                      const stageIdx = STATUS_ORDER.indexOf(s.stage)
                      const isComplete = stageIdx <= currentIdx
                      const isCurrent = s.stage === effectiveStatus

                      return (
                        <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: isComplete ? 1 : 0.4 }}>
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: isCurrent ? 'var(--primary)' : isComplete ? 'var(--success)' : 'var(--gray-300)',
                            boxShadow: isCurrent ? '0 0 0 3px var(--primary-light)' : 'none',
                            flexShrink: 0,
                          }} />
                          <span style={{ fontSize: 12, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? 'var(--gray-900)' : 'var(--gray-500)' }}>
                            {s.label}
                            {isCurrent && effectiveStatus === 'generated' && ' (pending review)'}
                            {isCurrent && effectiveStatus === 'approved' && ' (ready to publish)'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Fact Checks */}
            {factChecks.length > 0 && (
              <Card style={{ marginBottom: 16 }}>
                <CardHeader>Fact Checks ({factChecks.length})</CardHeader>
                <CardBody style={{ padding: '12px 16px', fontSize: 13 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {factChecks.slice(0, 5).map(fc => (
                      <div key={fc.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                          <span className={`badge badge-${fc.verification === 'verified' || fc.verification === 'likely_true' ? 'green' : fc.verification === 'uncertain' ? 'yellow' : 'red'} badge-sm`}>
                            {fc.verification}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{(fc.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--gray-700)' }}>"{fc.claim}"</p>
                        {fc.source_url && (
                          <a href={fc.source_url} target="_blank" rel="noopener noreferrer" className="text-xs">Source →</a>
                        )}
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* SEO Analysis */}
            <Card>
              <CardHeader>SEO Analysis</CardHeader>
              <CardBody style={{ padding: '12px 16px', fontSize: 13 }}>
                {seoAnalysis ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Overall Score</span>
                        <span style={{ fontWeight: 700, color: seoAnalysis.score >= 70 ? 'var(--success)' : seoAnalysis.score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                          {seoAnalysis.score}/100
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'var(--gray-200)', borderRadius: 3 }}>
                        <div style={{
                          width: `${seoAnalysis.score}%`, height: '100%',
                          background: seoAnalysis.score >= 70 ? 'var(--success)' : seoAnalysis.score >= 50 ? 'var(--warning)' : 'var(--danger)',
                          borderRadius: 3, transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                    <div><strong>Keyword Density:</strong> {seoAnalysis.keywordDensity?.toFixed(2)}%</div>
                    <div><strong>Readability:</strong> {seoAnalysis.readabilityScore?.toFixed(0)}/100</div>
                    <div>
                      <strong>Headings:</strong> {seoAnalysis.headingStructure?.h1 ? <><Icon name="completed" /> H1</> : <><Icon name="failed" /> H1</>} · {seoAnalysis.headingStructure?.h2 || 0} H2 · {seoAnalysis.headingStructure?.h3 || 0} H3
                    </div>
                    {seoAnalysis.suggestions?.length > 0 && (
                      <div>
                        <strong>Suggestions:</strong>
                        <ul style={{ margin: '4px 0 0 16px', color: 'var(--warning)' }}>
                          {seoAnalysis.suggestions.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted">Run SEO analysis to see insights.</p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
