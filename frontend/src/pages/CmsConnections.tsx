import { useState, useEffect } from 'react'
import { cmsApi, clientsApi } from '../services/api'
import { CmsConnection, CmsProviderInfo } from '../types'
import { Card, CardHeader, CardBody } from '../components/Card'
import { SelectField, InputField } from '../components/FormField'
import { useToast } from '../components/Toast'
import Icon from '../components/Icon'

const PROVIDER_ICON_MAP: Record<string, string> = {
  shopify: 'shopify', wordpress: 'articles', webflow: 'globe', ghost: 'ghost',
  medium: 'medium', headless_cms: 'bolt', notion: 'notion', custom_rest: 'plugin',
}

const FALLBACK_PROVIDER_ICON = 'puzzle-piece'

export default function CmsConnections() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [connections, setConnections] = useState<CmsConnection[]>([])
  const [providers, setProviders] = useState<CmsProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ provider: 'shopify', label: '', endpoint_url: '', is_primary: false })
  const [testing, setTesting] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    clientsApi.list().then(data => {
      const list = data.clients || data.data || []
      setClients(list)
      if (list.length > 0) setSelectedClientId(list[0].id)
    }).catch(() => {})
    cmsApi.getProviders().then(r => setProviders(r.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedClientId) return
    setLoading(true)
    cmsApi.getConnections(selectedClientId).then(r => setConnections(r.data || [])).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [selectedClientId])

  const createConnection = async () => {
    try {
      await cmsApi.createConnection({ ...formData, client_id: selectedClientId })
      setShowForm(false)
      setFormData({ provider: 'shopify', label: '', endpoint_url: '', is_primary: false })
      addToast('success', 'CMS connection created')
      const r = await cmsApi.getConnections(selectedClientId)
      setConnections(r.data || [])
    } catch { addToast('error', 'Failed to create connection') }
  }

  const testConnection = async (conn: CmsConnection) => {
    setTesting(conn.id)
    try {
      const r = await cmsApi.testConnection(conn.id, selectedClientId)
      addToast(r.data?.connected ? 'success' : 'warning', r.data?.connected ? 'Connection successful!' : 'Connection failed')
    } catch { addToast('error', 'Test failed') }
    finally { setTesting(null) }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Multi-CMS Publishing</h2>
          <p>Manage connections to multiple content management systems</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Connection</button>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 400, marginBottom: 20 }}>
          <SelectField label="Client" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
            options={clients.map(c => ({ value: c.id, label: c.name }))} placeholder="Select a client..." />
        </div>

        {!selectedClientId ? (
          <Card><CardBody><div className="empty-state"><p>Select a client to view CMS connections.</p></div></CardBody></Card>
        ) : loading ? (
          <Card><CardBody><div className="empty-state"><div className="spinner" /></div></CardBody></Card>
        ) : (
          <div>
            {error && <div className="alert alert-error">{error}</div>}

            {connections.length === 0 && !loading && (
              <Card><CardBody><div className="empty-state"><p>No CMS connections configured. Add one to get started.</p></div></CardBody></Card>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {connections.map(conn => (
                <Card key={conn.id}>
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 24 }}><Icon name={PROVIDER_ICON_MAP[conn.provider] || 'plugin'} size="2x" /></span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{conn.label || conn.provider}</div>
                          <div className="flex gap-2" style={{ marginTop: 4 }}>
                            <span className="badge badge-purple badge-sm">{conn.provider}</span>
                            {conn.is_primary && <span className="badge badge-green badge-sm">Primary</span>}
                            <span className={`badge badge-${conn.is_active ? 'green' : 'gray'} badge-sm`}>{conn.is_active ? 'Active' : 'Inactive'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn btn-outline btn-sm" onClick={() => testConnection(conn)} disabled={testing === conn.id}>
                          {testing === conn.id ? <><Icon name="loading" spin /> Testing...</> : <><Icon name="search" /> Test</>}
                        </button>
                      </div>
                    </div>
                    {conn.endpoint_url && <p className="text-sm text-muted" style={{ marginTop: 8 }}>URL: {conn.endpoint_url}</p>}
                    {conn.last_sync_at && <p className="text-xs text-muted" style={{ marginTop: 4 }}>Last synced: {new Date(conn.last_sync_at).toLocaleString()}</p>}
                    {conn.capabilities?.length > 0 && (
                      <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                        {conn.capabilities.map((cap, i) => <span key={i} className="badge badge-gray badge-sm">{cap}</span>)}
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Connection Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>New CMS Connection</h3></div>
            <div className="modal-body">
              <div className="form-group">
                <label>Provider</label>
                <select className="form-select" value={formData.provider} onChange={e => setFormData({ ...formData, provider: e.target.value })}>
                  {providers.length > 0 ? providers.map(p => (
                    <option key={p.provider} value={p.provider}><Icon name={PROVIDER_ICON_MAP[p.provider] || 'plugin'} /> {p.name}</option>
                  )) : (
                    <>
                      <option value="shopify"><Icon name="store" /> Shopify</option>
                      <option value="wordpress"><Icon name="articles" /> WordPress</option>
                      <option value="webflow"><Icon name="globe" /> Webflow</option>
                      <option value="ghost"><Icon name="globe" /> Ghost</option>
                      <option value="medium"><Icon name="copywriter" /> Medium</option>
                      <option value="headless_cms"><Icon name="bolt" /> Headless CMS</option>
                      <option value="notion"><Icon name="book" /> Notion</option>
                      <option value="custom_rest"><Icon name="plugin" /> Custom REST API</option>
                    </>
                  )}
                </select>
              </div>
              <InputField label="Display Label" value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="My Shopify Store" />
              <InputField label="API Endpoint URL" value={formData.endpoint_url} onChange={e => setFormData({ ...formData, endpoint_url: e.target.value })} placeholder="https://my-shop.myshopify.com" />
              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={formData.is_primary} onChange={e => setFormData({ ...formData, is_primary: e.target.checked })} />
                  Set as primary connection
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createConnection}>Create</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
