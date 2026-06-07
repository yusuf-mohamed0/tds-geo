import { useState, useEffect } from 'react'
import { pluginsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Card, CardHeader, CardBody } from '../components/Card'
import { Modal } from '../components/Modal'
import { InputField, SelectField, TextareaField, ToggleField, FormRow } from '../components/FormField'
import { useToast } from '../components/Toast'
import Icon from '../components/Icon'
import type { Plugin } from '../types'

export default function Plugins() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const clientId = user?.client_id || ''
  const { addToast } = useToast()
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [clientIdInput, setClientIdInput] = useState(clientId)
  const [editingConfig, setEditingConfig] = useState<string | null>(null)
  const [configForm, setConfigForm] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadPlugins() }, [clientIdInput])

  async function loadPlugins() {
    if (!clientIdInput) { setLoading(false); return }
    try {
      setLoading(true)
      const data = await pluginsApi.getClientPlugins(clientIdInput)
      setPlugins(data.plugins || [])
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to load plugins'
      setError(msg)
      addToast('error', msg)
    } finally { setLoading(false) }
  }

  async function handleRegister(slug: string) {
    try {
      await pluginsApi.register(clientIdInput, slug)
      addToast('success', `Plugin "${slug}" installed`)
      loadPlugins()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to register plugin'
      setError(msg)
      addToast('error', msg)
    }
  }

  async function handleToggle(instanceId: string) {
    try {
      await pluginsApi.toggle(clientIdInput, instanceId)
      loadPlugins()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to toggle plugin'
      setError(msg)
      addToast('error', msg)
    }
  }

  async function handleSaveConfig(instanceId: string) {
    try {
      await pluginsApi.updateConfig(clientIdInput, instanceId, JSON.parse(configForm))
      setEditingConfig(null)
      setConfigForm('')
      addToast('success', 'Plugin config updated')
      loadPlugins()
    } catch (err: any) {
      addToast('error', 'Invalid JSON config')
    }
  }

  function startEditConfig(plugin: Plugin) {
    setEditingConfig(plugin.instance_id || plugin.id)
    setConfigForm(JSON.stringify(plugin.instance_config || plugin.default_config, null, 2))
  }

  const availablePlugins = plugins.filter(p => !p.instance_id)
  const installedPlugins = plugins.filter(p => p.instance_id)

  if (!clientIdInput) {
    return (
      <div className="page">
        <div className="page-header"><h1><Icon name="plugins" /> Plugins</h1></div>
        <CardBody><p className="text-secondary">Select a client to manage plugins.</p></CardBody>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1><Icon name="plugins" /> Plugin System</h1>
          <p className="text-secondary">Extend platform capabilities with plugins</p>
        </div>
        {!user?.client_id && (
          <input type="text" className="form-input" value={clientIdInput}
            onChange={e => setClientIdInput(e.target.value)}
            placeholder="Client ID" style={{ width: 280 }} />
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          {/* Installed Plugins */}
          <h2 className="mb-2">Installed Plugins ({installedPlugins.length})</h2>
          {installedPlugins.length === 0 ? (
            <CardBody className="mb-4"><p className="text-secondary">No plugins installed for this client.</p></CardBody>
          ) : (
            <div className="plugins-grid">
              {installedPlugins.map(p => (
                <Card key={p.instance_id} className={`plugin-card ${p.is_enabled ? '' : 'disabled'}`}>
                  <CardHeader action={
                      <ToggleField
                        label="Enabled"
                        checked={p.is_enabled || false}
                        onChange={() => p.instance_id && handleToggle(p.instance_id)}
                      />
                    }>
                    {p.name}
                  </CardHeader>
                  <CardBody>
                    <p className="plugin-desc text-sm">{p.description}</p>
                    <div className="plugin-hooks">
                      {p.hooks?.map(h => <span key={h} className="badge badge-sm">{h}</span>)}
                    </div>
                    <div className="plugin-actions" style={{ marginTop: 8 }}>
                      <button className="btn btn-sm" onClick={() => startEditConfig(p)}>Config</button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          {/* Available Plugins */}
          {availablePlugins.length > 0 && (
            <>
              <h2 className="mb-2">Available Plugins ({availablePlugins.length})</h2>
              <div className="plugins-grid">
                {availablePlugins.map(p => (
                  <Card key={p.id} className="plugin-card">
                    <CardHeader>
                    <span>{p.name} <span className="badge badge-info">v{p.version}</span></span>
                  </CardHeader>
                    <CardBody>
                      <p className="plugin-desc text-sm">{p.description}</p>
                      <div className="plugin-hooks">
                        {p.hooks?.map(h => <span key={h} className="badge badge-sm">{h}</span>)}
                      </div>
                      <button className="btn btn-primary btn-sm mt-2" onClick={() => handleRegister(p.slug)}>
                        Install
                      </button>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Config Editor Modal */}
      <Modal
        open={!!editingConfig}
        onClose={() => setEditingConfig(null)}
        title="Plugin Configuration"
      >
        <TextareaField
          label="Configuration (JSON)"
          value={configForm}
          onChange={e => setConfigForm(e.target.value)}
          rows={10}
          style={{ width: '100%', fontFamily: 'monospace' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={() => setEditingConfig(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => handleSaveConfig(editingConfig!)}>Save</button>
        </div>
      </Modal>
    </div>
  )
}
