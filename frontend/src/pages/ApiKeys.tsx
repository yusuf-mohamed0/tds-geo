import { useState, useEffect } from 'react'
import { apiKeysApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { InputField, SelectField, FormRow } from '../components/FormField'
import { useToast } from '../components/Toast'
import type { ApiKey } from '../types'

const SERVICES = ['openai', 'serpapi', 'shopify', 'google_trends', 'google_search_console', 'anthropic', 'stability_ai', 'custom']

export default function ApiKeys() {
  const { user } = useAuth()
  const clientId = user?.client_id || ''
  const { addToast } = useToast()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ service: 'openai', label: '', keyValue: '', permissions: '' })
  const [error, setError] = useState('')
  const [clientIdInput, setClientIdInput] = useState(clientId)

  useEffect(() => { loadKeys() }, [clientIdInput])

  async function loadKeys() {
    if (!clientIdInput) { setLoading(false); return }
    try {
      setLoading(true)
      const data = await apiKeysApi.list(clientIdInput)
      setKeys(data.keys || [])
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to load keys'
      setError(msg)
      addToast('error', msg)
    } finally { setLoading(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label || !form.keyValue) { setError('Label and key value are required'); return }
    try {
      await apiKeysApi.create(clientIdInput, {
        service: form.service,
        label: form.label,
        keyValue: form.keyValue,
        permissions: form.permissions.split(',').filter(Boolean).map(p => p.trim()),
      })
      setShowForm(false)
      setForm({ service: 'openai', label: '', keyValue: '', permissions: '' })
      setError('')
      addToast('success', 'API key created')
      loadKeys()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to create key'
      setError(msg)
      addToast('error', msg)
    }
  }

  async function handleDelete(keyId: string) {
    if (!confirm('Delete this API key? This cannot be undone.')) return
    try {
      await apiKeysApi.delete(clientIdInput, keyId)
      addToast('success', 'API key deleted')
      loadKeys()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to delete key'
      setError(msg)
      addToast('error', msg)
    }
  }

  async function handleToggle(keyId: string) {
    try {
      await apiKeysApi.toggle(clientIdInput, keyId)
      loadKeys()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to toggle key'
      setError(msg)
      addToast('error', msg)
    }
  }

  const columns = [
    { key: 'service', header: 'Service', render: (row: ApiKey) => <span className="badge badge-info">{row.service}</span> },
    { key: 'label', header: 'Label', render: (row: ApiKey) => row.label ?? '—' },
    { key: 'masked_value', header: 'Key', render: (row: ApiKey) => <code className="key-masked">{row.masked_value}</code> },
    { key: 'permissions', header: 'Permissions', render: (row: ApiKey) => row.permissions?.join(', ') || '—' },
    {
      key: 'is_active', header: 'Status',
      render: (row: ApiKey) => <span className={`badge ${row.is_active ? 'badge-success' : 'badge-error'}`}>{row.is_active ? 'Active' : 'Disabled'}</span>,
    },
    {
      key: 'last_used_at', header: 'Last Used',
      render: (row: ApiKey) => <span className="text-secondary">{row.last_used_at ? new Date(row.last_used_at).toLocaleDateString() : 'Never'}</span>,
    },
    {
      key: 'id', header: 'Actions',
      render: (row: ApiKey) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm" onClick={() => handleToggle(row.id)}>{row.is_active ? 'Disable' : 'Enable'}</button>
          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(row.id)}>Delete</button>
        </div>
      ),
    },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>🔑 API Keys</h1>
          <p className="text-secondary">Manage API keys for external services</p>
        </div>
        <div className="page-actions">
          {!user?.client_id && (
            <input
              className="form-input"
              value={clientIdInput}
              onChange={e => setClientIdInput(e.target.value)}
              placeholder="Client ID"
              style={{ width: 280 }}
            />
          )}
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Key'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <Card className="mb-4">
          <CardHeader>Add New API Key</CardHeader>
          <CardBody>
            <form onSubmit={handleCreate}>
              <FormRow>
                <SelectField label="Service" value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}
                  options={SERVICES.map(s => ({ value: s, label: s }))} />
                <InputField label="Label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g., OpenAI Production" required />
              </FormRow>
              <FormRow>
                <InputField label="API Key Value" value={form.keyValue} onChange={e => setForm({ ...form, keyValue: e.target.value })}
                  placeholder="sk-..." required type="password" />
                <InputField label="Permissions (comma-separated)" value={form.permissions}
                  onChange={e => setForm({ ...form, permissions: e.target.value })} placeholder="read, write" />
              </FormRow>
              <button type="submit" className="btn btn-primary mt-2">Save Key</button>
            </form>
          </CardBody>
        </Card>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : !clientIdInput ? (
        <CardBody><p className="text-secondary">Enter a Client ID above to view API keys.</p></CardBody>
      ) : keys.length === 0 ? (
        <CardBody><p className="text-secondary">No API keys configured. Add one above.</p></CardBody>
      ) : (
        <DataTable columns={columns} data={keys} keyExtractor={(k) => k.id} emptyMessage="No API keys found." />
      )}
    </div>
  )
}
