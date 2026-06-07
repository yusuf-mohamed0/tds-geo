import { useState, useEffect } from 'react'
import { contentIntelApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import { useToast } from '../components/Toast'
import Icon from '../components/Icon'
import { ContentCannibalization, TopicSaturation, KnowledgeGraphEntity, LinkingOpportunity } from '../types'

type Tab = 'cannibalization' | 'saturation' | 'knowledge_graph' | 'linking'

export default function ContentIntelligence() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('cannibalization')
  const [cannibalizationData, setCannibalizationData] = useState<ContentCannibalization[]>([])
  const [saturatedTopics, setSaturatedTopics] = useState<TopicSaturation[]>([])
  const [entities, setEntities] = useState<KnowledgeGraphEntity[]>([])
  const [linkingOpps, setLinkingOpps] = useState<LinkingOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTopic, setSearchTopic] = useState('')
  const [topicResult, setTopicResult] = useState<TopicSaturation | null>(null)
  const [entityContent, setEntityContent] = useState('')
  const [extractingEntities, setExtractingEntities] = useState(false)
  const [extractedEntities, setExtractedEntities] = useState<KnowledgeGraphEntity[]>([])
  const [linkContent, setLinkContent] = useState('')
  const { addToast } = useToast()

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const clientId = user?.client_id || ''
      if (activeTab === 'cannibalization') {
        // Cannibalization data comes from article context
        setCannibalizationData([])
      } else if (activeTab === 'saturation') {
        const data = await contentIntelApi.getSaturatedTopics(clientId)
        setSaturatedTopics(data.data || [])
      } else if (activeTab === 'knowledge_graph') {
        const data = await contentIntelApi.getKnowledgeGraph(clientId)
        setEntities(data.data || [])
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [activeTab])

  const searchTopicSaturation = async () => {
    if (!searchTopic.trim()) return
    try {
      const data = await contentIntelApi.getTopicSaturation(user?.client_id || '', searchTopic)
      setTopicResult(data.data || null)
    } catch { setTopicResult(null) }
  }

  const extractEntities = async () => {
    if (!entityContent.trim()) return
    setExtractingEntities(true)
    try {
      const data = await contentIntelApi.extractEntities(entityContent, user?.client_id || '')
      setExtractedEntities(data.data || [])
    } catch { setError('Failed to extract entities') }
    finally { setExtractingEntities(false) }
  }

  const findLinkingOpps = async () => {
    if (!linkContent.trim()) return
    try {
      const data = await contentIntelApi.getLinkingOpportunities(user?.client_id || '', linkContent)
      setLinkingOpps(data.data || [])
    } catch { setError('Failed to find linking opportunities') }
  }

  const saturationColumns: Column<TopicSaturation>[] = [
    { key: 'topic', header: 'Topic', render: (s) => <span style={{ fontWeight: 500 }}>{s.topic}</span> },
    { key: 'article_count', header: 'Articles', render: (s) => <span>{s.article_count}</span> },
    {
      key: 'saturation_score',
      header: 'Saturation',
      render: (s) => (
        <div className="flex items-center gap-2">
          <div style={{ width: 60, height: 6, background: 'var(--gray-200)', borderRadius: 3 }}>
            <div style={{
              width: `${s.saturation_score}%`, height: '100%', borderRadius: 3,
              background: s.saturation_score > 70 ? 'var(--danger)' : s.saturation_score > 40 ? 'var(--warning)' : 'var(--success)',
            }} />
          </div>
          <span style={{ fontSize: 12 }}>{s.saturation_score.toFixed(0)}%</span>
        </div>
      ),
    },
    { key: 'recommendation', header: 'Recommendation', render: (s) => (
      <span className={`badge badge-${s.recommendation === 'stop' ? 'red' : s.recommendation === 'reduce' ? 'yellow' : s.recommendation === 'diversify' ? 'purple' : 'green'}`}>
        {s.recommendation}
      </span>
    )},
  ]

  const tabs: { id: Tab; label: string }[] = [
    { id: 'cannibalization', label: 'Cannibalization' },
    { id: 'saturation', label: 'Topic Saturation' },
    { id: 'knowledge_graph', label: 'Knowledge Graph' },
    { id: 'linking', label: 'Linking Opportunities' },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Content Intelligence</h2>
          <p>Cannibalization detection, topic saturation, knowledge graph</p>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Cannibalization Tab */}
        {activeTab === 'cannibalization' && (
          <div>
            <Card>
              <CardHeader>Content Cannibalization Detection</CardHeader>
              <CardBody>
                <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
                  Analyze articles for keyword cannibalization. Select an article from the Articles page and run cannibalization detection.
                </p>
                {cannibalizationData.length === 0 ? (
                  <div className="empty-state">
                    <p>No cannibalization alerts. Run detection on articles to see results here.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {cannibalizationData.map(c => (
                      <div key={c.id} style={{ padding: '12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                        <div className="flex items-center justify-between">
                          <span className="badge badge-red" style={{ marginBottom: 8 }}>{c.overlap_type} — {c.similarity_score.toFixed(0)}% similar</span>
                        </div>
                        <p className="text-sm">{c.recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}

        {/* Saturation Tab */}
        {activeTab === 'saturation' && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <CardHeader>
                Check Topic Saturation
                <div className="flex gap-2">
                  <input className="form-input" placeholder="Enter topic..." value={searchTopic} onChange={e => setSearchTopic(e.target.value)} style={{ width: 240 }} />
                  <button className="btn btn-primary btn-sm" onClick={searchTopicSaturation}>Check</button>
                </div>
              </CardHeader>
              <CardBody>
                {topicResult ? (
                  <div className="flex items-center gap-4">
                    <div><strong>Topic:</strong> {topicResult.topic}</div>
                    <div><strong>Articles:</strong> {topicResult.article_count}</div>
                    <div>
                      <strong>Saturation:</strong>
                      <div style={{ display: 'inline-block', width: 100, height: 8, background: 'var(--gray-200)', borderRadius: 4, marginLeft: 8, verticalAlign: 'middle' }}>
                        <div style={{ width: `${topicResult.saturation_score}%`, height: '100%', borderRadius: 4, background: topicResult.saturation_score > 70 ? 'var(--danger)' : topicResult.saturation_score > 40 ? 'var(--warning)' : 'var(--success)' }} />
                      </div>
                      <span className="text-sm" style={{ marginLeft: 4 }}>{topicResult.saturation_score.toFixed(0)}%</span>
                    </div>
                    <span className={`badge badge-${topicResult.recommendation === 'stop' ? 'red' : topicResult.recommendation === 'reduce' ? 'yellow' : topicResult.recommendation === 'diversify' ? 'purple' : 'green'}`}>
                      {topicResult.recommendation}
                    </span>
                  </div>
                ) : (
                  <p className="text-muted text-sm">Enter a topic to check its saturation level.</p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>Saturated Topics</CardHeader>
              <CardBody padding={false}>
                <DataTable columns={saturationColumns} data={saturatedTopics} keyExtractor={s => s.id} loading={loading} emptyMessage="No saturated topics detected." />
              </CardBody>
            </Card>
          </div>
        )}

        {/* Knowledge Graph Tab */}
        {activeTab === 'knowledge_graph' && (
          <div className="grid-2">
            <Card>
              <CardHeader>Extract Entities</CardHeader>
              <CardBody>
                <div className="form-group">
                  <label>Content</label>
                  <textarea className="form-textarea" rows={6} value={entityContent} onChange={e => setEntityContent(e.target.value)} placeholder="Paste content to extract entities..." />
                </div>
                <button className="btn btn-primary" onClick={extractEntities} disabled={!entityContent.trim() || extractingEntities}>
                  {extractingEntities ? <><Icon name="loading" spin /> Extracting...</> : <><Icon name="search" /> Extract Entities</>}
                </button>
                {extractedEntities.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <strong style={{ fontSize: 13 }}>Extracted Entities:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {extractedEntities.map((e, i) => (
                        <span key={i} className="badge badge-blue" style={{ fontSize: 11 }}>
                          {e.entity_name} ({e.entity_type}, {e.confidence.toFixed(0)}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader>Entity Knowledge Graph</CardHeader>
              <CardBody>
                {loading ? <div className="empty-state"><div className="spinner" /></div> : entities.length === 0 ? (
                  <p className="text-muted text-sm">No entities in the knowledge graph yet. Extract entities from articles to build the graph.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {entities.map(e => (
                      <div key={e.id} style={{ padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', background: 'var(--gray-50)' }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{e.entity_name}</div>
                        <div className="text-xs text-muted">{e.entity_type} · {(e.confidence * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}

        {/* Linking Opportunities Tab */}
        {activeTab === 'linking' && (
          <Card>
            <CardHeader>
              Find Internal Linking Opportunities
              <div className="flex gap-2">
                <input className="form-input" placeholder="Paste content to find links..." value={linkContent} onChange={e => setLinkContent(e.target.value)} style={{ width: 300 }} />
                <button className="btn btn-primary btn-sm" onClick={findLinkingOpps}>Find Links</button>
              </div>
            </CardHeader>
            <CardBody>
              {linkingOpps.length === 0 ? (
                <p className="text-muted text-sm">Enter content to find relevant internal linking opportunities.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {linkingOpps.map((opp, i) => (
                    <div key={i} style={{ padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                      <div className="flex items-center justify-between">
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{opp.article_title}</span>
                        <span className={`badge badge-${opp.relevance_score > 70 ? 'green' : opp.relevance_score > 40 ? 'yellow' : 'red'} badge-sm`}>
                          {opp.relevance_score.toFixed(0)}% match
                        </span>
                      </div>
                      <span className="text-xs text-muted">{opp.match_type}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  )
}
