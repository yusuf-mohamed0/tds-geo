import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { authApi, adminApi } from '../services/api'
import { Card, CardHeader, CardBody } from '../components/Card'
import { InputField } from '../components/FormField'
import { useToast } from '../components/Toast'
import Icon from '../components/Icon'

export default function Settings() {
  const { user, isAdmin } = useAuth()
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState('profile')
  const [error, setError] = useState('')

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'password', label: 'Password' },
  ]
  if (isAdmin) tabs.push({ id: 'admin', label: 'Admin Panel' }, { id: 'system', label: 'System Health' })

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Manage your account and system configuration</p>
        </div>
      </div>

      <div className="page-body">
        <div className="tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {activeTab === 'profile' && <ProfileSection user={user} />}
        {activeTab === 'password' && <PasswordSection />}
        {activeTab === 'admin' && <AdminPanel />}
        {activeTab === 'system' && <SystemHealth />}
      </div>
    </>
  )
}

function ProfileSection({ user }: { user: any }) {
  return (
    <Card>
      <CardHeader>Profile Information</CardHeader>
      <CardBody>
        <div className="form-row">
          <div className="form-group">
            <label>Name</label>
            <input className="form-input" value={user?.name || ''} readOnly />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="form-input" type="email" value={user?.email || ''} readOnly />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Role</label>
            <input className="form-input" value={user?.role || ''} readOnly style={{ textTransform: 'capitalize' }} />
          </div>
          <div className="form-group">
            <label>Last Login</label>
            <input className="form-input" value={user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : '—'} readOnly />
          </div>
        </div>
        <p className="text-muted text-sm" style={{ marginTop: 8 }}>
          Profile editing is managed through the admin panel. Contact your administrator to update your name or email.
        </p>
      </CardBody>
    </Card>
  )
}

function PasswordSection() {
  const { addToast } = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      addToast('success', 'Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ maxWidth: 500 }}>
      <CardHeader>Change Password</CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
          <InputField label="Current Password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
          <InputField label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
          <InputField label="Confirm New Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </CardBody>
    </Card>
  )
}

function AdminPanel() {
  const { addToast } = useToast()
  const [config, setConfig] = useState<any>(null)
  const [errors, setErrors] = useState<any[]>([])

  useEffect(() => {
    const fetch = async () => {
      try {
        const [configData, errorsData] = await Promise.all([
          adminApi.config(),
          adminApi.errors(),
        ])
        setConfig(configData)
        setErrors(errorsData.errors || errorsData.data || [])
      } catch (err: any) {
        addToast('error', err.response?.data?.error || 'Failed to load admin data')
      }
    }
    fetch()
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      <Card>
        <CardHeader>System Configuration</CardHeader>
        <CardBody style={{ fontSize: 13 }}>
          {config ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {Object.entries(config).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <span style={{ color: 'var(--gray-500)', fontFamily: 'monospace' }}>{key}</span>
                  <span style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
                    {typeof value === 'boolean' ? (value ? <Icon name="completed" /> : <Icon name="failed" />) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">Loading configuration...</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Recent Errors</CardHeader>
        <CardBody padding={false} style={{ maxHeight: 400, overflowY: 'auto' }}>
          {errors.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}><p>No recent errors <Icon name="completed" /></p></div>
          ) : (
            <div style={{ padding: 12 }}>
              {errors.map((err: any, i: number) => (
                <div key={i} style={{ padding: '8px', background: '#fee2e2', borderRadius: 4, marginBottom: 8, fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: '#991b1b' }}>{err.action || err.message}</div>
                  <div className="text-muted">{err.created_at ? new Date(err.created_at).toLocaleString() : ''}</div>
                  {err.details && <pre style={{ marginTop: 4, fontSize: 11, whiteSpace: 'pre-wrap' }}>{typeof err.details === 'string' ? err.details : JSON.stringify(err.details, null, 2)}</pre>}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function SystemHealth() {
  const { addToast } = useToast()
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await adminApi.health()
        setHealth(data)
      } catch (err: any) {
        addToast('error', err.response?.data?.error || 'Failed to load health data')
      }
    }
    fetch()
  }, [])

  if (!health) {
    return <Card><CardBody><div className="empty-state"><div className="spinner" /><p>Checking system health...</p></div></CardBody></Card>
  }

  const checks = [
    { label: 'Database', ok: health.database?.connected || health.database === 'connected' },
    { label: 'Redis', ok: health.redis?.connected || health.redis === 'connected' },
    { label: 'OpenAI API', ok: health.openai?.configured || health.openai === 'configured' },
    { label: 'Shopify API', ok: health.shopify?.configured || health.shopify === 'configured' },
    { label: 'SerpAPI', ok: health.serpapi?.configured || health.serpapi === 'configured' },
    { label: 'BullMQ Workers', ok: health.bullmq?.active || health.workers?.active },
  ]

  return (
    <Card>
      <CardHeader>System Health</CardHeader>
      <CardBody>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {checks.map(check => (
            <div key={check.label} className="stat-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{check.label}</span>
                <span style={{ fontSize: 20 }}>{check.ok ? <Icon name="completed" /> : <Icon name="failed" />}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--gray-500)' }}>
          <strong>Server:</strong> {health.server || health.status || 'Running'} ·
          <strong> Uptime:</strong> {health.uptime ? `${Math.floor(health.uptime / 60)}m ${Math.round(health.uptime % 60)}s` : '—'}
        </div>
      </CardBody>
    </Card>
  )
}
