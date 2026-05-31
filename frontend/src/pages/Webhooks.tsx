import { useState, useEffect } from 'react'
import { webhooksApi, clientsApi } from '../services/api'
import { Card, CardHeader, CardBody } from '../components/Card'
import { Modal } from '../components/Modal'
import { DataTable } from '../components/DataTable'
import { InputField, SelectField, CheckboxField, FormRow } from '../components/FormField'
import { useToast } from '../components/Toast'
import type { Webhook, Client } from '../types'

export default function WebhooksPage() {
  const { addToast } = useToast()
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const clientData = await clientsApi.list()
        const clientsList = clientData.clients || clientData.data || []
        setClients(clientsList)
        if (clientsList.length > 0) setSelectedClientId(clientsList[0].id)
      } catch {
        // No clients yet
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const fetchWebhooks = async () => {
    if (!selectedClientId) return
    setLoading(true)
    setError('')
    try {
      const data = await webhooksApi.list(selectedClientId)
      setWebhooks(data.webhooks || data.data || [])
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to load webhooks'
      setError(msg)
      addToast('error', msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (selectedClientId) fetchWebhooks() }, [selectedClientId])

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Delete this webhook?')) return
    try {
      await webhooksApi.delete(selectedClientId, webhookId)
      setWebhooks(w => w.filter(h => h.id !== webhookId))
      addToast('success', 'Webhook deleted')
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to delete webhook'
      setError(msg)
      addToast('error', msg)
    }
  }

  const handleTest = async (webhookId: string) => {
    try {
      await webhooksApi.test(selectedClientId, webhookId)
      addToast('success', 'Test webhook sent successfully!')
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Test failed'
      setError(msg)
      addToast('error', msg)
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (row: Webhook) => <strong>{row.name || 'Unnamed'}</strong> },
    {
      key: 'url', header: 'URL',
      render: (row: Webhook) => <span style={{ maxWidth: 300, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }} className="text-sm">{row.url}</span>,
    },
    {
      key: 'events', header: 'Events',
      render: (row: Webhook) => row.events?.map(e => <span key={e} className="badge badge-info" style={{ marginRight: 4 }}>{e}</span>),
    },
    {
      key: 'is_active', header: 'Status',
      render: (row: Webhook) => <span className={`badge ${row.is_active ? 'badge-success' : 'badge-error'}`}>{row.is_active ? 'Active' : 'Inactive'}</span>,
    },
    {
      key: 'last_triggered_at', header: 'Last Triggered',
      render: (row: Webhook) => <span className="text-secondary text-sm">{row.last_triggered_at ? new Date(row.last_triggered_at).toLocaleString() : 'Never'}</span>,
    },
    {
      key: 'id', header: '',
      render: (row: Webhook) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm" onClick={() => handleTest(row.id)}>Test</button>
          <button className="btn btn-sm" onClick={() => { setEditingWebhook(row); setShowModal(true) }}>Edit</button>
          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(row.id)}>Delete</button>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Webhooks</h2>
          <p>Manage webhook endpoints for client events</p>
        </div>
        {selectedClientId && (
          <button className="btn btn-primary" onClick={() => { setEditingWebhook(null); setShowModal(true) }}>
            + Add Webhook
          </button>
        )}
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <SelectField label="Client" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
          options={[{ value: '', label: 'Select a client...' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
          style={{ maxWidth: 400 }} />

        {!selectedClientId ? (
          <CardBody style={{ marginTop: 20 }}><p className="text-secondary">Select a client to manage webhooks.</p></CardBody>
        ) : loading ? (
          <CardBody style={{ marginTop: 20 }}><div className="spinner" /><p>Loading webhooks...</p></CardBody>
        ) : webhooks.length === 0 ? (
          <CardBody style={{ marginTop: 20 }}><p className="text-secondary">No webhooks configured for this client.</p></CardBody>
        ) : (
          <div style={{ marginTop: 16 }}>
            <DataTable columns={columns} data={webhooks} keyExtractor={(w) => w.id} emptyMessage="No webhooks found." />
          </div>
        )}

        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title={editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
        >
          {showModal && (
            <WebhookForm
              clientId={selectedClientId}
              webhook={editingWebhook}
              onSaved={() => { setShowModal(false); fetchWebhooks() }}
              onCancel={() => setShowModal(false)}
            />
          )}
        </Modal>
      </div>
    </>
  )
}

function WebhookForm({ clientId, webhook, onSaved, onCancel }: { clientId: string; webhook: Webhook | null; onSaved: () => void; onCancel: () => void }) {
  const { addToast } = useToast()
  const [form, setForm] = useState({
    name: webhook?.name || '',
    url: webhook?.url || '',
    events: webhook?.events || ['article.published', 'article.generated'],
    retry_count: webhook?.retry_count || 3,
    timeout_ms: webhook?.timeout_ms || 5000,
    is_active: webhook?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const allEvents = [
    'article.generated', 'article.approved', 'article.rejected',
    'article.published', 'article.failed', 'keyword.discovered',
    'pipeline.started', 'pipeline.completed', 'pipeline.failed',
  ]

  const toggleEvent = (event: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter(e => e !== event) : [...f.events, event],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (webhook) {
        await webhooksApi.update(clientId, webhook.id, form)
        addToast('success', 'Webhook updated')
      } else {
        await webhooksApi.create(clientId, form)
        addToast('success', 'Webhook created')
      }
      onSaved()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save webhook')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      <InputField label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
        placeholder="e.g., Slack notifications" />
      <InputField label="Webhook URL *" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
        placeholder="https://hooks.example.com/events" required />
      <div className="form-group">
        <label>Events</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {allEvents.map(event => (
            <label key={event} style={{
              display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13,
              padding: '4px 8px', background: form.events.includes(event) ? 'var(--primary-light)' : 'var(--gray-100)',
              borderRadius: 4, border: `1px solid ${form.events.includes(event) ? 'var(--primary)' : 'var(--gray-200)'}`,
            }}>
              <input type="checkbox" checked={form.events.includes(event)} onChange={() => toggleEvent(event)} style={{ display: 'none' }} />
              {event}
            </label>
          ))}
        </div>
      </div>
      <FormRow>
        <InputField label="Retry Count" type="number" value={form.retry_count} min={0} max={10}
          onChange={e => setForm({ ...form, retry_count: parseInt(e.target.value) || 0 })} />
        <InputField label="Timeout (ms)" type="number" value={form.timeout_ms} min={1000} max={30000}
          onChange={e => setForm({ ...form, timeout_ms: parseInt(e.target.value) || 1000 })} />
      </FormRow>
      <CheckboxField label="Active" checked={form.is_active} onChange={v => setForm({ ...form, is_active: v })} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : webhook ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}
