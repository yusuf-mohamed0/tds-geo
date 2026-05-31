import { useState, useEffect } from 'react'
import { configApi } from '../services/api'
import type { SystemConfig } from '../types'
import { Card, CardBody } from '../components/Card'
import { useToast } from '../components/Toast'

export default function Config() {
  const [configs, setConfigs] = useState<SystemConfig[]>([])
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([])
  const [activeCategory, setActiveCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const { addToast } = useToast()

  useEffect(() => {
    Promise.all([
      configApi.list().then(d => setConfigs(d.config || [])),
      configApi.categories().then(d => setCategories(d.categories || [])),
    ]).catch(() => addToast('error', 'Failed to load config')).finally(() => setLoading(false))
  }, [])

  const filtered = activeCategory ? configs.filter(c => c.category === activeCategory) : configs

  async function handleSave(key: string) {
    try {
      let parsed: any = editValue
      try { parsed = JSON.parse(editValue) } catch { /* keep as string */ }
      await configApi.update(key, parsed)
      addToast('success', `Updated ${key}`)
      setEditingKey(null)
      const data = await configApi.list()
      setConfigs(data.config || [])
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update')
    }
  }

  function startEdit(conf: SystemConfig) {
    setEditingKey(conf.key)
    setEditValue(typeof conf.value === 'object' ? JSON.stringify(conf.value, null, 2) : String(conf.value))
  }

  function formatValue(val: any): string {
    if (val === null || val === undefined) return '<empty>'
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>⚙️ System Configuration</h1>
        <p className="text-secondary">Live-editable platform settings</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <div className="config-layout">
          {/* Category sidebar */}
          <div className="config-categories">
            <div
              className={`config-category ${!activeCategory ? 'active' : ''}`}
              onClick={() => setActiveCategory('')}
            >All ({configs.length})</div>
            {categories.map(c => (
              <div
                key={c.category}
                className={`config-category ${activeCategory === c.category ? 'active' : ''}`}
                onClick={() => setActiveCategory(c.category)}
              >{c.category} ({c.count})</div>
            ))}
          </div>

          {/* Config list */}
          <div className="config-list">
            {filtered.length === 0 ? (
              <Card><CardBody><p className="text-secondary">No config entries found.</p></CardBody></Card>
            ) : (
              filtered.map(conf => (
                <Card key={conf.id} className="config-item">
                  <div className="config-item-header">
                    <div>
                      <code className="config-key">{conf.key}</code>
                      {conf.is_public && <span className="badge badge-sm ml-1">Public</span>}
                      {conf.is_encrypted && <span className="badge badge-sm ml-1">Encrypted</span>}
                    </div>
                    <button className="btn btn-sm" onClick={() => startEdit(conf)}>Edit</button>
                  </div>
                  <p className="text-secondary text-sm">{conf.description || 'No description'}</p>
                  {editingKey === conf.key ? (
                    <div className="config-edit">
                      <textarea className="input textarea-code" rows={3} value={editValue}
                        onChange={e => setEditValue(e.target.value)} />
                      <div className="flex gap-2 mt-1">
                        <button className="btn btn-sm btn-primary" onClick={() => handleSave(conf.key)}>Save</button>
                        <button className="btn btn-sm" onClick={() => setEditingKey(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <pre className="config-value">{formatValue(conf.value)}</pre>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
