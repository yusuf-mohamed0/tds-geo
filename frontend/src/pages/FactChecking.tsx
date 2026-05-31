import { useState, useEffect } from 'react'
import { factCheckApi, clientsApi } from '../services/api'
import { FactCheck, Citation, TrustedSource, HighRiskTopic } from '../types'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import { SelectField, InputField } from '../components/FormField'
import { useToast } from '../components/Toast'

type Tab = 'factChecks' | 'sources' | 'topics'

const VERIFICATION_BADGE: Record<string, string> = {
  verified: 'green', likely_true: 'blue', uncertain: 'yellow',
  likely_false: 'red', false: 'red', unverifiable: 'gray',
}

export default function FactChecking() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('factChecks')
  const [factChecks, setFactChecks] = useState<FactCheck[]>([])
  const [citations, setCitations] = useState<Citation[]>([])
  const [trustedSources, setTrustedSources] = useState<TrustedSource[]>([])
  const [highRiskTopics, setHighRiskTopics] = useState<HighRiskTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [articleId, setArticleId] = useState('')
  const [showSourceForm, setShowSourceForm] = useState(false)
  const [sourceForm, setSourceForm] = useState({ domain: '', source_name: '', category: 'general', authority_score: 50 })
  const [showTopicForm, setShowTopicForm] = useState(false)
  const [topicForm, setTopicForm] = useState({ category: '', keywords: '', requires_citation: true, requires_human_review: true })
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [verifying, setVerifying] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    clientsApi.list().then(data => {
      const list = data.clients || data.data || []
      setClients(list)
      if (list.length > 0) setSelectedClientId(list[0].id)
    }).catch(() => setLoading(false))
  }, [])

  const fetchData = async () => {
    if (!selectedClientId) return
    setLoading(true)
    try {
      if (activeTab === 'sources') {
        const data = await factCheckApi.getTrustedSources(selectedClientId)
        setTrustedSources(data.data || [])
      } else if (activeTab === 'topics') {
        const data = await factCheckApi.getHighRiskTopics(selectedClientId)
        setHighRiskTopics(data.data || [])
      }
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedClientId, activeTab])

  const verifyArticle = async () => {
    if (!articleId.trim()) return
    setVerifying(true)
    try {
      const result = await factCheckApi.verifyArticle(articleId)
      setVerifyResult(result.data)
      if (result.data?.factChecks) setFactChecks(result.data.factChecks)
      if (result.data?.citations) setCitations(result.data.citations)
      addToast('success', 'Article verified')
    } catch { addToast('error', 'Failed to verify article') }
    finally { setVerifying(false) }
  }

  const addSource = async () => {
    try {
      await factCheckApi.addTrustedSource({ ...sourceForm, client_id: selectedClientId })
      setShowSourceForm(false)
      setSourceForm({ domain: '', source_name: '', category: 'general', authority_score: 50 })
      addToast('success', 'Trusted source added')
      fetchData()
    } catch { addToast('error', 'Failed to add source') }
  }

  const addTopic = async () => {
    try {
      await factCheckApi.addHighRiskTopic({ ...topicForm, client_id: selectedClientId, keywords: topicForm.keywords.split(',').map(k => k.trim()) })
      setShowTopicForm(false)
      setTopicForm({ category: '', keywords: '', requires_citation: true, requires_human_review: true })
      addToast('success', 'High-risk topic added')
      fetchData()
    } catch { addToast('error', 'Failed to add topic') }
  }

  const tabs = [
    { id: 'factChecks' as const, label: 'Fact Check' },
    { id: 'sources' as const, label: 'Trusted Sources' },
    { id: 'topics' as const, label: 'High-Risk Topics' },
  ]

  const factCheckColumns: Column<FactCheck>[] = [
    { key: 'claim', header: 'Claim', render: (f) => <span style={{ maxWidth: 300, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.claim}</span> },
    { key: 'verification', header: 'Status', render: (f) => <span className={`badge badge-${VERIFICATION_BADGE[f.verification] || 'gray'}`}>{f.verification.replace('_', ' ')}</span> },
    { key: 'confidence', header: 'Confidence', render: (f) => <span style={{ fontWeight: 600, color: f.confidence >= 0.8 ? 'var(--success)' : f.confidence >= 0.5 ? 'var(--warning)' : 'var(--danger)' }}>{(f.confidence * 100).toFixed(0)}%</span> },
    { key: 'source_domain', header: 'Source', render: (f) => f.source_url ? <a href={f.source_url} target="_blank" className="text-sm">{f.source_domain || f.source_url}</a> : <span className="text-muted">—</span> },
    { key: 'reviewed_by_human', header: 'Human Review', render: (f) => f.reviewed_by_human ? <span className="badge badge-green">✅ Reviewed</span> : <span className="badge badge-yellow">Pending</span> },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Fact Checking</h2>
          <p>Verify claims, manage sources, and track citations</p>
        </div>
        <div className="card-actions">
          {activeTab === 'sources' && <button className="btn btn-primary" onClick={() => setShowSourceForm(true)}>+ Add Source</button>}
          {activeTab === 'topics' && <button className="btn btn-primary" onClick={() => setShowTopicForm(true)}>+ Add Topic</button>}
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
          <Card><CardBody><div className="empty-state"><p>Select a client to view fact checking.</p></div></CardBody></Card>
        ) : activeTab === 'factChecks' && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <CardHeader>Verify Article</CardHeader>
              <CardBody>
                <div className="flex gap-2" style={{ alignItems: 'flex-end' }}>
                  <InputField label="Article ID" value={articleId} onChange={e => setArticleId(e.target.value)} placeholder="Enter article ID to verify..." />
                  <button className="btn btn-primary" onClick={verifyArticle} disabled={!articleId.trim() || verifying}>
                    {verifying ? '⏳ Verifying...' : '🔍 Verify'}
                  </button>
                </div>
              </CardBody>
            </Card>

            {verifyResult && (
              <div style={{ display: 'grid', gap: 16 }}>
                <Card>
                  <CardHeader>
                    Fact Check Results
                    <span className="badge badge-purple">{factChecks.length} claims</span>
                  </CardHeader>
                  <CardBody padding={false}>
                    <DataTable columns={factCheckColumns} data={factChecks} keyExtractor={f => f.id} loading={false} emptyMessage="No claims found in this article." />
                  </CardBody>
                </Card>

                {citations.length > 0 && (
                  <Card>
                    <CardHeader>Citations ({citations.length})</CardHeader>
                    <CardBody>
                      {citations.map(c => (
                        <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                          <p className="text-sm" style={{ fontWeight: 500 }}>"{c.claim_text}"</p>
                          {c.source_url && <a href={c.source_url} target="_blank" className="text-sm">{c.source_title || c.source_url}</a>}
                          <div className="flex gap-2" style={{ marginTop: 4 }}>
                            <span className={`badge badge-${c.is_validated ? 'green' : 'yellow'} badge-sm`}>{c.is_validated ? 'Validated' : 'Pending'}</span>
                            <span className="text-xs text-muted">Confidence: {(c.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sources' && selectedClientId && (
          <Card>
            <CardHeader>Trusted Sources</CardHeader>
            <CardBody padding={false}>
              {loading ? <div className="empty-state"><div className="spinner" /></div> : (
                <table>
                  <thead><tr><th>Domain</th><th>Name</th><th>Category</th><th>Authority Score</th><th>Status</th></tr></thead>
                  <tbody>
                    {trustedSources.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'monospace' }}>{s.domain}</td>
                        <td>{s.source_name || '—'}</td>
                        <td><span className="badge badge-blue">{s.category}</span></td>
                        <td><span style={{ fontWeight: 600, color: s.authority_score >= 80 ? 'var(--success)' : s.authority_score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{s.authority_score}</span></td>
                        <td><span className={`badge badge-${s.is_active ? 'green' : 'gray'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    ))}
                    {trustedSources.length === 0 && <tr><td colSpan={5}><div className="empty-state"><p>No trusted sources configured.</p></div></td></tr>}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        )}

        {activeTab === 'topics' && selectedClientId && (
          <Card>
            <CardHeader>High-Risk Topics</CardHeader>
            <CardBody>
              {loading ? <div className="empty-state"><div className="spinner" /></div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {highRiskTopics.map(t => (
                    <div key={t.id} style={{ padding: '12px 16px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <span className="badge badge-red">{t.category}</span>
                        <span className={`badge badge-${t.is_active ? 'green' : 'gray'} badge-sm`}>{t.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                        {t.keywords?.map((kw, i) => <span key={i} className="badge badge-gray badge-sm">{kw}</span>)}
                      </div>
                      <div className="flex gap-4" style={{ marginTop: 8 }}>
                        {t.requires_citation && <span className="badge badge-purple badge-sm">Requires Citation</span>}
                        {t.requires_human_review && <span className="badge badge-yellow badge-sm">Requires Human Review</span>}
                      </div>
                    </div>
                  ))}
                  {highRiskTopics.length === 0 && <p className="text-muted text-sm">No high-risk topics configured.</p>}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      {/* Add Source Modal */}
      {showSourceForm && (
        <div className="modal-overlay" onClick={() => setShowSourceForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Add Trusted Source</h3></div>
            <div className="modal-body">
              <InputField label="Domain" value={sourceForm.domain} onChange={e => setSourceForm({ ...sourceForm, domain: e.target.value })} placeholder="e.g., nih.gov" />
              <InputField label="Source Name" value={sourceForm.source_name} onChange={e => setSourceForm({ ...sourceForm, source_name: e.target.value })} placeholder="e.g., National Institutes of Health" />
              <div className="form-group"><label>Category</label><select className="form-select" value={sourceForm.category} onChange={e => setSourceForm({ ...sourceForm, category: e.target.value })}><option value="medical">Medical</option><option value="scientific">Scientific</option><option value="government">Government</option><option value="news">News</option><option value="industry">Industry</option><option value="general">General</option></select></div>
              <InputField label="Authority Score (0-100)" type="number" value={String(sourceForm.authority_score)} onChange={e => setSourceForm({ ...sourceForm, authority_score: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowSourceForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addSource}>Add Source</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Topic Modal */}
      {showTopicForm && (
        <div className="modal-overlay" onClick={() => setShowTopicForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Add High-Risk Topic</h3></div>
            <div className="modal-body">
              <InputField label="Category" value={topicForm.category} onChange={e => setTopicForm({ ...topicForm, category: e.target.value })} placeholder="e.g., health-claims" />
              <InputField label="Keywords (comma-separated)" value={topicForm.keywords} onChange={e => setTopicForm({ ...topicForm, keywords: e.target.value })} placeholder="e.g., cure, treatment, guaranteed" />
              <div className="form-group" style={{ display: 'flex', gap: 16 }}>
                <label className="checkbox-label"><input type="checkbox" checked={topicForm.requires_citation} onChange={e => setTopicForm({ ...topicForm, requires_citation: e.target.checked })} /> Requires Citation</label>
                <label className="checkbox-label"><input type="checkbox" checked={topicForm.requires_human_review} onChange={e => setTopicForm({ ...topicForm, requires_human_review: e.target.checked })} /> Requires Human Review</label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowTopicForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addTopic}>Add Topic</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
