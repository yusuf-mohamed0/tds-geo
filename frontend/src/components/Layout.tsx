import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'

const allNavItems = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/articles', label: 'Articles', icon: '📝' },
  { to: '/pipeline', label: 'Pipeline', icon: '🔧' },
  { to: '/editorial', label: 'Editorial', icon: '👥' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
  { to: '/api-usage', label: 'API Usage', icon: '💰' },
  { to: '/observability', label: 'Observability', icon: '📊' },
  { to: '/queue', label: 'Queues', icon: '📋' },
  { to: '/evaluation', label: 'AI Eval', icon: '⭐' },
  { to: '/content-intel', label: 'Content Intel', icon: '🧠' },
  { to: '/brand-voice', label: 'Brand Voice', icon: '🎙️' },
  { to: '/fact-check', label: 'Fact Check', icon: '✅' },
  { to: '/security', label: 'Security', icon: '🔒' },
  { to: '/chat', label: 'AI Chat', icon: '💬' },
  { to: '/clients', label: 'Clients', icon: '🏢' },
  { to: '/cms', label: 'CMS', icon: '🌐' },
  { to: '/cost', label: 'Costs', icon: '💰' },
  { to: '/pexels', label: 'Pexels', icon: '🖼️' },
  { to: '/api-keys', label: 'API Keys', icon: '🔑' },
  { to: '/plugins', label: 'Plugins', icon: '🧩' },
  { to: '/prompts', label: 'Prompts', icon: '📋' },
  { to: '/config', label: 'Config', icon: '⚙️' },
  { to: '/improvements', label: 'AI Insights', icon: '🤖' },
  { to: '/webhooks', label: 'Webhooks', icon: '🔗' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
  { to: '/admin', label: 'Admin', icon: '🛡️' },
]

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Client-role users (shopify store owners) see only their relevant pages
  const clientNavItems = [
    { to: '/', label: 'Dashboard', icon: '📊', end: true },
    { to: '/articles', label: 'Articles', icon: '📝' },
    { to: '/pipeline', label: 'Pipeline', icon: '🔧' },
    { to: '/analytics', label: 'Analytics', icon: '📈' },
    { to: '/chat', label: 'AI Chat', icon: '💬' },
    { to: '/api-usage', label: 'API Usage', icon: '💰' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  const isClient = user?.role === 'client'
  // Filter nav items: client-role users see limited set, others see full admin set (minus admin link if not admin)
  const navItems = isClient
    ? clientNavItems
    : isAdmin
      ? allNavItems
      : allNavItems.filter(item => item.to !== '/admin')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1>AI SEO Agent</h1>
          <p>Automation Dashboard</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => isActive ? 'active' : ''}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="sidebar-user-info">
              <div className="name truncate">{user?.name || 'User'}</div>
              <div className="role">{user?.role || 'user'}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Log out
          </button>
        </div>
      </aside>

      {/* Mobile hamburger toggle */}
      <button
        className="mobile-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
