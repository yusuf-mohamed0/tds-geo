import { useState, useEffect } from 'react'
import { promptsApi, metaApi } from '../services/api'
import { Card, CardHeader, CardBody } from '../components/Card'
import { InputField, SelectField, TextareaField, FormRow } from '../components/FormField'
import { useToast } from '../components/Toast'
import Icon from '../components/Icon'
import type { PromptTemplate } from '../types'

export default function Prompts() {
  const { addToast } = useToast()
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PromptTemplate | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [availableModels, setAvailableModels] = useState<{ id: string; label: string; provider: string }[]>([
    { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  ])
  const [editForm, setEditForm] = useState({ systemPrompt: '', userTemplate: '', model: '', temperature: 0.7, maxTokens: 2048 })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showVersions, setShowVersions] = useState(false)

  useEffect(() => { loadTemplates() }, [])

  // Fetch available models from server (prompt hardening)
  useEffect(() => {
    metaApi.getModels().then(data => {
      if (data?.models?.length) {
        setAvailableModels(data.models);
      }
    }).catch(() => {
      // Fallback models already set
    });
  }, [])

  async function loadTemplates() {
    try {
      setLoading(true)
      const data = await promptsApi.list()
      setTemplates(data.templates || [])
    } catch (err: any) {
      addToast('error', 'Failed to load templates')
    } finally { setLoading(false) }
  }

  async function loadTemplate(id: string) {
    try {
      const data = await promptsApi.get(id)
      setSelected(data)
      setEditForm({
        systemPrompt: data.system_prompt,
        userTemplate: data.user_template,
        model: data.model,
        temperature: data.temperature,
        maxTokens: data.max_tokens,
      })
      setEditMode(false)
      setShowVersions(false)
    } catch (err: any) {
      addToast('error', 'Failed to load template')
    }
  }

  async function handleSave() {
    if (!selected) return
    try {
      await promptsApi.update(selected.id, editForm)
      addToast('success', 'Template updated! New version created.')
      setEditMode(false)
      loadTemplate(selected.id)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update')
    }
  }

  async function handleRollback(version: number) {
    if (!selected) return
    if (!confirm(`Rollback to version ${version}?`)) return
    try {
      await promptsApi.rollback(selected.id, version)
      addToast('success', `Rolled back to v${version}`)
      loadTemplate(selected.id)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to rollback')
    }
  }

  const categories = [...new Set(templates.map(t => t.category))]

  return (
    <div className="page">
      <div className="page-header">
        <h1><Icon name="prompts" /> Prompt Editor</h1>
        <p className="text-secondary">Edit AI behavior templates live — changes apply immediately</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="prompts-layout">
        {/* Template list */}
        <div className="prompts-list">
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : categories.map(cat => (
            <div key={cat} className="mb-3">
              <h3 className="text-sm text-secondary mb-1">{cat.toUpperCase()}</h3>
              {templates.filter(t => t.category === cat).map(t => (
                <div
                  key={t.id}
                  className={`prompt-item ${selected?.id === t.id ? 'active' : ''}`}
                  onClick={() => loadTemplate(t.id)}
                >
                  <div className="prompt-item-name">{t.name}</div>
                  <div className="prompt-item-meta">v{t.version} · {t.model}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Template editor */}
        <div className="prompts-editor">
          {!selected ? (
            <CardBody><p className="text-secondary">Select a template to edit</p></CardBody>
          ) : (
            <Card>
              <CardHeader action={
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!editMode && <button className="btn btn-primary" onClick={() => setEditMode(true)}>Edit</button>}
                    <button className="btn btn-sm" onClick={() => setShowVersions(!showVersions)}>
                      History ({selected.versions?.length || 0})
                    </button>
                  </div>
                }>
                  <div>
                    <h2>{selected.name}</h2>
                    <span className="badge badge-info">{selected.category}</span>
                    <span className="badge ml-1">v{selected.version}</span>
                    {selected.is_system && <span className="badge ml-1">System</span>}
                  </div>
              </CardHeader>
              <CardBody>
                {showVersions && selected.versions && (
                  <div className="versions-list mb-3">
                    <h3 className="text-sm">Version History</h3>
                    {selected.versions.map(v => (
                      <div key={v.id} className="version-item">
                        <span>v{v.version} — {new Date(v.created_at).toLocaleString()}</span>
                        <button className="btn btn-sm" onClick={() => handleRollback(v.version)}>Rollback</button>
                      </div>
                    ))}
                  </div>
                )}

                {editMode ? (
                  <div className="prompt-form">
                    <TextareaField label="System Prompt" value={editForm.systemPrompt}
                      onChange={e => setEditForm({ ...editForm, systemPrompt: e.target.value })} rows={6}
                      className="textarea-code" />
                    <TextareaField label="User Template" value={editForm.userTemplate}
                      onChange={e => setEditForm({ ...editForm, userTemplate: e.target.value })} rows={6}
                      className="textarea-code" />
                    <FormRow>
                      <SelectField label="Model" value={editForm.model}
                        onChange={e => setEditForm({ ...editForm, model: e.target.value })}
                        options={availableModels.map(m => ({ value: m.id, label: m.label }))} />
                      <div className="form-group">
                        <label>Temperature ({editForm.temperature})</label>
                        <input type="range" className="form-input"
                          value={editForm.temperature} min={0} max={2} step={0.1}
                          onChange={e => setEditForm({ ...editForm, temperature: parseFloat(e.target.value) })} />
                      </div>
                      <InputField label="Max Tokens" type="number" value={editForm.maxTokens}
                        onChange={e => setEditForm({ ...editForm, maxTokens: parseInt(e.target.value) })} />
                    </FormRow>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button className="btn btn-primary" onClick={handleSave}>Save (v{selected.version + 1})</button>
                      <button className="btn" onClick={() => { setEditMode(false); loadTemplate(selected.id) }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="prompt-view">
                    <div className="form-group">
                      <label>System Prompt</label>
                      <pre className="code-block">{selected.system_prompt}</pre>
                    </div>
                    <div className="form-group">
                      <label>User Template</label>
                      <pre className="code-block">{selected.user_template}</pre>
                    </div>
                    <FormRow>
                      <div><span className="text-secondary">Model:</span> {selected.model}</div>
                      <div><span className="text-secondary">Temperature:</span> {selected.temperature}</div>
                      <div><span className="text-secondary">Max Tokens:</span> {selected.max_tokens}</div>
                      <div><span className="text-secondary">Variables:</span> {selected.variables?.join(', ') || 'None'}</div>
                    </FormRow>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
