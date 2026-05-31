import { useState, useEffect } from 'react'
import { securityApi, clientsApi } from '../services/api'
import { AuditLogEntry, PermissionEntry } from '../types'
import { Card, CardHeader, CardBody } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import { SelectField } from '../components/FormField'

type Tab = 'audit_log' | 'permissions' | 'rate_limits'

const SEVERITY_BADGE: Record<string, string> = { critical: 'red', error: 'red', warning: 'yellow', info: 'blue' }
const OUTCOME_BADGE: Record<string, string> = { success: 'green', failure: 'red', denied: 'yellow' }

export default function Security() {
  const [activeTab, setActiveTab] = useState<Tab>('audit_log')
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [permissions, setPermissions] = useState<PermissionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)
  const [newPermission, setNewPermission] = useState({ role: 'editor', resource: '', action: 'read', is_granted: true })
  const [showPermissionForm, setShowPermissionForm] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      if (activeTab === 'audit_log') {
        const data = await securityApi.getAuditLog({ action: filterAction || undefined, severity: filterSeverity || undefined })
        setAuditLog(data.data || [])
      } else if (activeTab === 'permissions') {
        const data = await securityApi.getPermissions()
        setPermissions(data.data || [])
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load security data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [activeTab, filterAction, filterSeverity])

  const setPermission = async () => {
    try {
      await securityApi.setPermission(newPermission)
      const data = await securityApi.getPermissions()
      setPermissions(data.data || [])
      setShowPermissionForm(false)
      setNewPermission({ role: 'editor', resource: '', action: 'read', is_granted: true })
    } catch { setError('Failed to set permission') }
  }

  const tabs = [
    { id: 'audit_log' as const, label: 'Audit Log' },
    { id: 'permissions' as const, label: 'Permissions' },
    { id: 'rate_limits' as const, label: 'Rate Limits' },
  ]

  const auditColumns: Column<AuditLogEntry>[] = [
    { key: 'action', header: 'Action', render: (e) => <span style={{ fontWeight: 500, fontSize: 13 }}>{e.action}</span> },
    { key: 'severity', header: 'Severity', render: (e) => <span className={`badge badge-${SEVERITY_BADGE[e.severity]}`}>{e.severity}</span> },
    { key: 'outcome', header: 'Outcome', render: (e) => <span className={`badge badge-${OUTCOME_BADGE[e.outcome]}`}>{e.outcome}</span> },
    { key: 'user_name', header: 'User', render: (e) => <span className="text-sm">{e.user_name || e.user_id || 'System'}</span> },
    { key: 'resource_type', header: 'Resource', render: (e) => <span className="text-sm text-muted">{e.resource_type || '—'}{e.resource_id ? ` #${e.resource_id.slice(0, 8)}` : ''}</span> },
    { key: 'created_at', header: 'Time', render: (e) => <span className="text-sm text-muted">{new Date(e.created_at).toLocaleString()}</span> },
    { key: 'id', header: '', render: (e) => (
      <button className="btn btn-outline btn-sm" onClick={() => setSelectedEntry(e)}>Details</button>
    )},
  ]

  const permissionColumns: Column<PermissionEntry>[] = [
    { key: 'role', header: 'Role', render: (p) => <span className="badge badge-blue">{p.role}</span> },
    { key: 'resource', header: 'Resource', render: (p) => <span style={{ fontWeight: 500 }}>{p.resource}</span> },
    { key: 'action', header: 'Action', render: (p) => <span className="text-sm">{p.action}</span> },
    { key: 'is_granted', header: 'Granted', render: (p) => <span className={`badge badge-${p.is_granted ? 'green' : 'red'}`}>{p.is_granted ? 'Yes' : 'No'}</span> },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Security</h2>
          <p>Audit logs, permissions, rate limits, and access control</p>
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

        {/* Audit Log Tab */}
        {activeTab === 'audit_log' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <span>Audit Trail</span>
                <select className="form-select" style={{ width: 150 }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
                  <option value="">All Actions</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="publish">Publish</option>
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                </select>
                <select className="form-select" style={{ width: 150 }} value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
                  <option value="">All Severities</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </CardHeader>
            <CardBody padding={false}>
              <DataTable columns={auditColumns} data={auditLog} keyExtractor={e => e.id} loading={loading} emptyMessage="No audit log entries found." />
            </CardBody>
          </Card>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <CardHeader>
                Role Permissions
                <button className="btn btn-primary btn-sm" onClick={() => setShowPermissionForm(true)}>+ Add Permission</button>
              </CardHeader>
              <CardBody padding={false}>
                <DataTable columns={permissionColumns} data={permissions} keyExtractor={p => p.id} loading={loading} emptyMessage="No permissions configured." />
              </CardBody>
            </Card>
          </div>
        )}

        {/* Rate Limits Tab */}
        {activeTab === 'rate_limits' && (
          <Card>
            <CardHeader>Rate Limits</CardHeader>
            <CardBody>
              <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
                Configure rate limits per client to control API usage and prevent abuse.
              </p>
              <p className="text-muted text-sm">Rate limits can be configured from the Client settings page.</p>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Audit Entry Detail Modal */}
      {selectedEntry && (
        <div className="modal-overlay" onClick={() => setSelectedEntry(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3>Audit Entry Details</h3>
              <span className={`badge badge-${SEVERITY_BADGE[selectedEntry.severity]}`}>{selectedEntry.severity}</span>
            </div>
            <div className="modal-body" style={{ fontSize: 13 }}>
              <div className="grid-2" style={{ marginBottom: 16 }}>
                <div><strong>Action:</strong> {selectedEntry.action}</div>
                <div><strong>Outcome:</strong> <span className={`badge badge-${OUTCOME_BADGE[selectedEntry.outcome]} badge-sm`}>{selectedEntry.outcome}</span></div>
                <div><strong>User:</strong> {selectedEntry.user_name || selectedEntry.user_id || 'System'}</div>
                <div><strong>IP Address:</strong> {selectedEntry.ip_address || '—'}</div>
                <div><strong>Resource:</strong> {selectedEntry.resource_type || '—'} {selectedEntry.resource_id || ''}</div>
                <div><strong>Time:</strong> {new Date(selectedEntry.created_at).toLocaleString()}</div>
              </div>
              {selectedEntry.details && Object.keys(selectedEntry.details).length > 0 && (
                <div className="form-group">
                  <label>Details</label>
                  <div className="code-block">{JSON.stringify(selectedEntry.details, null, 2)}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedEntry(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Form Modal */}
      {showPermissionForm && (
        <div className="modal-overlay" onClick={() => setShowPermissionForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Add Permission</h3></div>
            <div className="modal-body">
              <div className="form-group">
                <label>Role</label>
                <select className="form-select" value={newPermission.role} onChange={e => setNewPermission({ ...newPermission, role: e.target.value })}>
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="client">Client</option>
                </select>
              </div>
              <div className="form-group">
                <label>Resource</label>
                <input className="form-input" value={newPermission.resource} onChange={e => setNewPermission({ ...newPermission, resource: e.target.value })} placeholder="e.g., articles, clients, analytics" />
              </div>
              <div className="form-group">
                <label>Action</label>
                <select className="form-select" value={newPermission.action} onChange={e => setNewPermission({ ...newPermission, action: e.target.value })}>
                  <option value="read">Read</option>
                  <option value="write">Write</option>
                  <option value="delete">Delete</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <div className="toggle-field-label">
                  <span className="toggle-field-text">Granted</span>
                  <label className="toggle">
                    <input type="checkbox" checked={newPermission.is_granted} onChange={e => setNewPermission({ ...newPermission, is_granted: e.target.checked })} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowPermissionForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={setPermission}>Add Permission</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
