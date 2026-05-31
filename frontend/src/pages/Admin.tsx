import { useState, useEffect, useMemo } from 'react'
import { authApi, adminApi, chatApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Card, CardHeader, CardBody, CardFooter } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { InputField, SelectField, CheckboxField, FormRow } from '../components/FormField'
import { useToast } from '../components/Toast'

interface UserRow {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'admin' | 'editor' | 'client'
  client_id?: string
  is_active: boolean
  last_login_at?: string
  created_at: string
}

interface AdminStats {
  users: { total: number; admins: number; editors: number; clients: number }
  clients: { total: number; active: number }
  articles: { total: number; published: number }
  costs: { total_cost_mtd: number }
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'gold',
  admin: 'purple',
  editor: 'blue',
  client: 'green',
}

export default function Admin() {
  const { user: currentUser } = useAuth()
  const { addToast } = useToast()
  const [users, setUsers] = useState<UserRow[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [resetPwUser, setResetPwUser] = useState<UserRow | null>(null)
  const [showChatCleanup, setShowChatCleanup] = useState(false)

  const [cleanupDays, setCleanupDays] = useState(30)
  const [cleanupUserId, setCleanupUserId] = useState('')
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [usersData, dashboardData] = await Promise.all([
        authApi.getUsers(),
        adminApi.dashboard().catch(() => null),
      ])
      setUsers(usersData || [])
      setStats(dashboardData)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (search) {
        const s = search.toLowerCase()
        if (!u.name.toLowerCase().includes(s) && !u.email.toLowerCase().includes(s)) return false
      }
      if (roleFilter && u.role !== roleFilter) return false
      if (statusFilter === 'active' && !u.is_active) return false
      if (statusFilter === 'inactive' && u.is_active) return false
      return true
    })
  }, [users, search, roleFilter, statusFilter])

  async function handleCreate(data: { email: string; password: string; name: string; role: string }) {
    try {
      await authApi.register(data)
      setShowCreate(false)
      addToast('success', `User "${data.name}" created successfully`)
      loadData()
    } catch (err: any) {
      throw err
    }
  }

  async function handleUpdate(id: string, data: any) {
    try {
      await authApi.updateUser(id, data)
      setEditUser(null)
      addToast('success', 'User updated successfully')
      loadData()
    } catch (err: any) {
      throw err
    }
  }

  async function handleDelete(id: string) {
    try {
      await authApi.deleteUser(id)
      setDeleteConfirm(null)
      addToast('success', 'User deleted successfully')
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user')
      setDeleteConfirm(null)
    }
  }

  async function handleToggle(id: string) {
    try {
      const updated = await authApi.toggleUser(id)
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: updated.is_active } : u))
      addToast('success', `User ${updated.is_active ? 'activated' : 'deactivated'} successfully`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to toggle user status')
    }
  }

  async function handleResetPassword(id: string, newPassword: string) {
    try {
      await authApi.resetPassword(id, newPassword)
      setResetPwUser(null)
      addToast('success', 'Password reset successfully')
    } catch (err: any) {
      throw err
    }
  }

  async function handleBulkCleanup() {
    setCleanupLoading(true)
    setCleanupResult(null)
    try {
      const result = await chatApi.bulkDeleteOldSessions(cleanupDays)
      setCleanupResult(`🗑️ ${result.message}`)
    } catch (err: any) {
      setCleanupResult(`❌ ${err.response?.data?.error || 'Failed to clean up sessions'}`)
    } finally {
      setCleanupLoading(false)
    }
  }

  async function handleUserCleanup() {
    if (!cleanupUserId) return
    setCleanupLoading(true)
    setCleanupResult(null)
    try {
      const result = await chatApi.deleteUserSessions(cleanupUserId)
      setCleanupResult(`🗑️ ${result.message}`)
    } catch (err: any) {
      setCleanupResult(`❌ ${err.response?.data?.error || 'Failed to clean up sessions'}`)
    } finally {
      setCleanupLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page-body">
        <Card>
          <CardBody>
            <div className="empty-state"><div className="spinner" /><p>Loading admin panel...</p></div>
          </CardBody>
        </Card>
      </div>
    )
  }

  const userColumns: Column<UserRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (u) => (
        <span style={{ fontWeight: 600 }}>
          {u.name}
          {u.id === currentUser?.id && (
            <span className="badge badge-purple" style={{ marginLeft: 8, fontSize: 10 }}>You</span>
          )}
        </span>
      ),
    },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <span className={`badge badge-${ROLE_COLORS[u.role] || 'gray'}`} style={{ textTransform: 'capitalize' }}>
          {u.role}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (u) => (
        <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
          {u.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'client_id',
      header: 'Client',
      render: (u) => <span className="text-sm text-muted">{u.client_id ? u.client_id.slice(0, 8) + '…' : '—'}</span>,
    },
    {
      key: 'last_login_at',
      header: 'Last Login',
      render: (u) => (
        <span className="text-sm text-muted">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (u) => <span className="text-sm text-muted">{new Date(u.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'id',
      header: 'Actions',
      render: (u) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setEditUser(u)} title="Edit user">✏️</button>
          <button
            className={`btn btn-sm ${u.is_active ? 'btn-warning' : 'btn-success'}`}
            onClick={() => handleToggle(u.id)}
            disabled={u.id === currentUser?.id || (u.role === 'super_admin' && currentUser?.role !== 'super_admin')}
            title={u.is_active ? 'Deactivate' : 'Activate'}
          >
            {u.is_active ? '🔴' : '🟢'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setResetPwUser(u)} title="Reset password">🔑</button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => setDeleteConfirm(u.id)}
            disabled={u.id === currentUser?.id || (u.role === 'super_admin' && currentUser?.role !== 'super_admin')}
            title="Delete user"
          >
            🗑️
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Administration</h2>
          <p>Manage users, permissions, and system data</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => setShowChatCleanup(!showChatCleanup)}>
            🗑️ Clean Up Chats
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Add User
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {/* Stats Overview */}
        {stats && (
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-icon purple">👥</div>
              <div>
                <div className="stat-value">{stats.users?.total || 0}</div>
                <div className="stat-label">Total Users</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red">🛡️</div>
              <div>
                <div className="stat-value">{stats.users?.admins || 0}</div>
                <div className="stat-label">Admins</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue">✏️</div>
              <div>
                <div className="stat-value">{stats.users?.editors || 0}</div>
                <div className="stat-label">Editors</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">🏢</div>
              <div>
                <div className="stat-value">{stats.users?.clients || 0}</div>
                <div className="stat-label">Client Users</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue">📝</div>
              <div>
                <div className="stat-value">{stats.articles?.total || 0}</div>
                <div className="stat-label">Articles</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red">💰</div>
              <div>
                <div className="stat-value">${Number(stats.costs?.total_cost_mtd || 0).toFixed(2)}</div>
                <div className="stat-label">Costs MTD</div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Store Signups */}
        <RecentSignups />

        {/* Chat Cleanup Section */}
        {showChatCleanup && (
          <Card style={{ marginBottom: 24, border: '1px solid var(--warning)', borderLeft: '4px solid var(--warning)' }}>
            <CardHeader action={<button className="btn btn-outline btn-sm" onClick={() => setShowChatCleanup(false)}>Close</button>}>
              🗑️ Chat Session Cleanup
            </CardHeader>
            <CardBody>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8 }}>
                    Delete sessions older than
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" className="form-input" style={{ width: 100 }} value={cleanupDays}
                      onChange={e => setCleanupDays(Math.max(1, parseInt(e.target.value) || 1))} min={1} />
                    <span>days</span>
                    <button className="btn btn-danger btn-sm" onClick={handleBulkCleanup} disabled={cleanupLoading}>
                      {cleanupLoading ? '...' : 'Delete'}
                    </button>
                  </div>
                  <p className="text-muted text-sm" style={{ marginTop: 6 }}>
                    Permanently deletes sessions and all their messages.
                  </p>
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8 }}>
                    Delete all sessions for user
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select className="form-select" value={cleanupUserId} onChange={e => setCleanupUserId(e.target.value)} style={{ flex: 1 }}>
                      <option value="">Select a user...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email}) — {u.role}</option>
                      ))}
                    </select>
                    <button className="btn btn-danger btn-sm" onClick={handleUserCleanup} disabled={cleanupLoading || !cleanupUserId}>
                      {cleanupLoading ? '...' : 'Delete'}
                    </button>
                  </div>
                  <p className="text-muted text-sm" style={{ marginTop: 6 }}>
                    Removes all chat history for the selected user.
                  </p>
                </div>
              </div>
              {cleanupResult && (
                <div className={`alert ${cleanupResult.startsWith('❌') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: 16 }}>
                  {cleanupResult}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <CardBody style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
              <label>Search users</label>
              <input className="form-input" placeholder="Name or email..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="form-group" style={{ minWidth: 140, marginBottom: 0 }}>
              <label>Role</label>
              <select className="form-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="client">Client</option>
              </select>
            </div>
            <div className="form-group" style={{ minWidth: 140, marginBottom: 0 }}>
              <label>Status</label>
              <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div style={{ paddingBottom: 1 }}>
              <div style={{ height: 24 }} />
              <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter('') }}>
                Clear Filters
              </button>
            </div>
          </CardBody>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader action={<span className="text-muted text-sm">{users.length} total</span>}>
            Users ({filteredUsers.length})
          </CardHeader>
          <CardBody padding={false}>
            <DataTable
              columns={userColumns}
              data={filteredUsers}
              keyExtractor={(u) => u.id}
              loading={false}
              emptyMessage="No users match your filters."
            />
          </CardBody>
          <CardFooter className="text-sm text-muted">
            Showing {filteredUsers.length} of {users.length} users · Click the icons to manage each user
          </CardFooter>
        </Card>
      </div>

      {/* Create User Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="➕ Add New User" maxWidth={480}>
        <CreateUserForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />
      </Modal>

      {/* Edit User Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="✏️ Edit User" maxWidth={480}>
        {editUser && <EditUserForm user={editUser} onSave={(data) => handleUpdate(editUser.id, data)} onCancel={() => setEditUser(null)} />}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="🗑️ Delete User" maxWidth={420}>
        <div>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            Are you sure you want to permanently delete this user? Their chat sessions and API keys will also be removed.
          </p>
          <p style={{ marginTop: 12, fontWeight: 600, color: 'var(--danger)' }}>This action cannot be undone.</p>
          <div className="modal-footer" style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete User</button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetPwUser} onClose={() => setResetPwUser(null)} title="🔑 Reset Password" maxWidth={420}>
        {resetPwUser && <ResetPasswordForm user={resetPwUser} onSave={(pw) => handleResetPassword(resetPwUser.id, pw)} onCancel={() => setResetPwUser(null)} />}
      </Modal>
    </>
  )
}

// ─── Recent Store Signups ──────────────────────────────

function RecentSignups() {
  const [signups, setSignups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    adminApi.recentSignups(20)
      .then(setSignups)
      .catch(err => setError(err.response?.data?.error || 'Failed to load signups'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card style={{ marginBottom: 24 }}>
        <CardHeader>🆕 Recent Store Signups</CardHeader>
        <CardBody>
          <div className="empty-state"><div className="spinner" style={{ width: 20, height: 20 }} /><p>Loading signups...</p></div>
        </CardBody>
      </Card>
    )
  }

  if (error) {
    return (
      <Card style={{ marginBottom: 24 }}>
        <CardHeader>🆕 Recent Store Signups</CardHeader>
        <CardBody>
          <div className="alert alert-error">{error}</div>
        </CardBody>
      </Card>
    )
  }

  if (signups.length === 0) {
    return null // Hide section entirely when there are no signups
  }

  return (
    <Card style={{ marginBottom: 24, borderLeft: '4px solid var(--success)' }}>
      <CardHeader action={<span className="badge badge-green">{signups.length} signups</span>}>
        🆕 New Store Registrations
      </CardHeader>
      <CardBody padding={false}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Store</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Signed Up</th>
              </tr>
            </thead>
            <tbody>
              {signups.map((s: any) => (
                <tr key={s.id}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>
                      {s.client_name || 'Unknown Store'}
                    </span>
                    {s.shopify_shop && (
                      <span className="text-muted text-sm" style={{ display: 'block', fontSize: 12 }}>
                        {s.shopify_shop}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {s.metadata?.storeOwnerName || '—'}
                  </td>
                  <td style={tdStyle}>
                    <span className="text-sm">{s.metadata?.storeOwnerEmail || '—'}</span>
                  </td>
                  <td style={tdStyle}>
                    <span className="text-sm text-muted" title={new Date(s.created_at).toLocaleString()}>
                      {formatRelativeTime(s.created_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text-muted)',
  borderBottom: '2px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  fontSize: 14,
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// ─── Sub-forms ────────────────────────────────────────────

function CreateUserForm({ onSave, onCancel }: {
  onSave: (data: { email: string; password: string; name: string; role: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('editor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email.trim() || !password) {
      setError('All fields are required')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await onSave({ name: name.trim(), email: email.trim(), password, role })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      <InputField label="Full Name" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
      <InputField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" required />
      <InputField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8} />
      <SelectField label="Role" value={role} onChange={e => setRole(e.target.value)} options={[
        { value: 'admin', label: 'Admin' },
        { value: 'editor', label: 'Editor' },
        { value: 'client', label: 'Client' },
      ]} />
      <div className="modal-footer" style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </div>
    </form>
  )
}

function EditUserForm({ user, onSave, onCancel }: {
  user: UserRow
  onSave: (data: any) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [isActive, setIsActive] = useState(user.is_active)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required')
      return
    }
    setLoading(true)
    try {
      await onSave({ name: name.trim(), email: email.trim(), role, is_active: isActive })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      <InputField label="Full Name" value={name} onChange={e => setName(e.target.value)} required />
      <InputField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      <FormRow>
        <div className="form-group">
          <label>Role</label>
          {user.role === 'super_admin' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <span className="badge badge-gold" style={{ fontSize: 13, padding: '4px 12px' }}>super_admin</span>
              <span className="text-muted text-sm">Role cannot be changed for super admin accounts</span>
            </div>
          ) : (
            <select className="form-select" value={role} onChange={e => setRole(e.target.value as UserRow['role'])}>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="client">Client</option>
            </select>
          )}
        </div>
        <SelectField label="Status" value={isActive ? 'active' : 'inactive'} onChange={e => setIsActive(e.target.value === 'active')} options={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ]} />
      </FormRow>
      <p className="text-muted text-sm" style={{ marginTop: 8 }}>
        Created: {new Date(user.created_at).toLocaleDateString()} · Last login: {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
      </p>
      <div className="modal-footer" style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

function ResetPasswordForm({ user, onSave, onCancel }: {
  user: UserRow
  onSave: (password: string) => Promise<void>
  onCancel: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await onSave(password)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
        Resetting password for <strong>{user.name}</strong> ({user.email})
      </p>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      <InputField label="New Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8} />
      <InputField label="Confirm Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required />
      <div className="modal-footer" style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </div>
    </form>
  )
}
