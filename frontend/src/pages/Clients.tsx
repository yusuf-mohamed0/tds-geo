import { useState, useEffect } from 'react'
import { clientsApi } from '../services/api'
import { Client } from '../types'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { InputField, SelectField, TextareaField, CheckboxField, FormRow } from '../components/FormField'
import { useToast } from '../components/Toast'

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const { addToast } = useToast()

  const fetchClients = async () => {
    setLoading(true)
    try {
      const data = await clientsApi.list()
      setClients(data.clients || data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClients() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return
    try {
      await clientsApi.delete(id)
      setClients(c => c.filter(cl => cl.id !== id))
      addToast('success', 'Client deleted successfully')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete client')
    }
  }

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (client) => <span style={{ fontWeight: 600 }}>{client.name}</span>,
    },
    { key: 'shopify_shop', header: 'Shopify Shop' },
    {
      key: 'service_area',
      header: 'Service Area',
      render: (client) => client.service_area || '—',
    },
    {
      key: 'timezone',
      header: 'Timezone',
      render: (client) => client.timezone || '—',
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (client) => (
        <span className={`badge badge-${client.is_active ? 'green' : 'red'}`}>
          {client.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (client) => (
        <span className="text-muted text-sm">{new Date(client.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'id',
      header: '',
      render: (client) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-outline btn-sm" onClick={() => { setEditingClient(client); setShowModal(true) }}>Edit</button>
          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(client.id)}>Delete</button>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Clients</h2>
          <p>{clients.length} client{clients.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingClient(null); setShowModal(true) }}>
          + Add Client
        </button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <Card>
          <CardBody padding={false}>
            <DataTable
              columns={columns}
              data={clients}
              keyExtractor={(c) => c.id}
              loading={loading}
              emptyMessage="No clients configured yet. Add your first client to get started."
            />
          </CardBody>
        </Card>

        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title={editingClient ? 'Edit Client' : 'Add New Client'}
        >
          <ClientForm
            client={editingClient}
            onSaved={() => { setShowModal(false); fetchClients() }}
            onCancel={() => setShowModal(false)}
          />
        </Modal>
      </div>
    </>
  )
}

function ClientForm({ client, onSaved, onCancel }: { client: Client | null; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: client?.name || '',
    slug: client?.slug || '',
    shopify_shop: client?.shopify_shop || '',
    shopify_token: '',
    brand_voice: client?.brand_voice || '',
    service_area: client?.service_area || '',
    timezone: client?.timezone || 'UTC',
    publish_frequency: client?.publish_frequency || 'weekly',
    approval_mode: client?.approval_mode || 'manual',
    is_active: client?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { addToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (client) {
        await clientsApi.update(client.id, form)
        addToast('success', 'Client updated successfully')
      } else {
        await clientsApi.create(form)
        addToast('success', 'Client created successfully')
      }
      onSaved()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <FormRow>
        <InputField label="Client Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <InputField label="Slug" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} required placeholder="my-company" />
      </FormRow>

      <FormRow>
        <InputField label="Shopify Shop" value={form.shopify_shop} onChange={e => setForm({ ...form, shopify_shop: e.target.value })} required placeholder="my-store.myshopify.com" />
        <InputField
          label={client ? 'New Shopify Token' : 'Shopify Token'}
          type="password"
          value={form.shopify_token}
          onChange={e => setForm({ ...form, shopify_token: e.target.value })}
          required={!client}
          hint={client ? 'Leave blank to keep existing' : undefined}
        />
      </FormRow>

      <TextareaField
        label="Brand Voice Guidelines"
        value={form.brand_voice}
        onChange={e => setForm({ ...form, brand_voice: e.target.value })}
        placeholder="Describe the brand voice, tone, and style..."
        rows={3}
      />

      <FormRow>
        <InputField label="Service Area" value={form.service_area} onChange={e => setForm({ ...form, service_area: e.target.value })} placeholder="e.g., California, USA" />
        <SelectField
          label="Timezone"
          value={form.timezone}
          onChange={e => setForm({ ...form, timezone: e.target.value })}
          options={[
            { value: 'UTC', label: 'UTC' },
            { value: 'US/Eastern', label: 'US/Eastern' },
            { value: 'US/Central', label: 'US/Central' },
            { value: 'US/Mountain', label: 'US/Mountain' },
            { value: 'US/Pacific', label: 'US/Pacific' },
            { value: 'Europe/London', label: 'Europe/London' },
            { value: 'Europe/Berlin', label: 'Europe/Berlin' },
          ]}
        />
      </FormRow>

      <FormRow>
        <SelectField
          label="Publish Frequency"
          value={form.publish_frequency}
          onChange={e => setForm({ ...form, publish_frequency: e.target.value })}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'biweekly', label: 'Bi-Weekly' },
            { value: 'monthly', label: 'Monthly' },
          ]}
        />
        <SelectField
          label="Approval Mode"
          value={form.approval_mode}
          onChange={e => setForm({ ...form, approval_mode: e.target.value })}
          options={[
            { value: 'auto', label: 'Auto-publish' },
            { value: 'manual', label: 'Manual approval required' },
          ]}
        />
      </FormRow>

      <CheckboxField label="Active" checked={form.is_active} onChange={v => setForm({ ...form, is_active: v })} />

      <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : client ? 'Update Client' : 'Create Client'}
        </button>
      </div>
    </form>
  )
}
