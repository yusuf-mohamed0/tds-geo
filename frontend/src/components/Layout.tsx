import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'
import Icon from './Icon'

const allNavItems = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' as const, end: true },
  { to: '/articles', label: 'Articles', icon: 'articles' as const },
  { to: '/pipeline', label: 'Pipeline', icon: 'pipeline' as const },
  { to: '/copywriter', label: 'Copywriter', icon: 'copywriter' as const },
  { to: '/editorial', label: 'Editorial', icon: 'editorial' as const },
  { to: '/analytics', label: 'Analytics', icon: 'analytics' as const },
  { to: '/api-usage', label: 'API Usage', icon: 'api-usage' as const },
  { to: '/observability', label: 'Observability', icon: 'observability' as const },
  { to: '/queue', label: 'Queues', icon: 'queues' as const },
  { to: '/evaluation', label: 'AI Eval', icon: 'evaluation' as const },
  { to: '/content-intel', label: 'Content Intel', icon: 'content-intel' as const },
  { to: '/brand-voice', label: 'Brand Voice', icon: 'brand-voice' as const },
  { to: '/fact-check', label: 'Fact Check', icon: 'fact-check' as const },
  { to: '/security', label: 'Security', icon: 'security' as const },
  { to: '/chat', label: 'AI Chat', icon: 'chat' as const },
  { to: '/clients', label: 'Clients', icon: 'clients' as const },
  { to: '/cms', label: 'CMS', icon: 'cms' as const },
  { to: '/cost', label: 'Costs', icon: 'api-usage' as const },
  { to: '/pexels', label: 'Pexels', icon: 'pexels' as const },
  { to: '/api-keys', label: 'API Keys', icon: 'api-keys' as const },
  { to: '/plugins', label: 'Plugins', icon: 'plugins' as const },
  { to: '/prompts', label: 'Prompts', icon: 'prompts' as const },
  { to: '/config', label: 'Config', icon: 'config' as const },
  { to: '/improvements', label: 'AI Insights', icon: 'improvements' as const },
  { to: '/webhooks', label: 'Webhooks', icon: 'webhooks' as const },
  { to: '/settings', label: 'Settings', icon: 'settings' as const },
  { to: '/admin', label: 'Admin', icon: 'admin' as const },
]

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Client-role users (shopify store owners) see only their relevant pages
  const clientNavItems = [
    { to: '/', label: 'Dashboard', icon: 'dashboard' as const, end: true },
    { to: '/articles', label: 'Articles', icon: 'articles' as const },
    { to: '/pipeline', label: 'Pipeline', icon: 'pipeline' as const },
    { to: '/analytics', label: 'Analytics', icon: 'analytics' as const },
    { to: '/chat', label: 'AI Chat', icon: 'chat' as const },
    { to: '/api-usage', label: 'API Usage', icon: 'api-usage' as const },
    { to: '/settings', label: 'Settings', icon: 'settings' as const },
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
              <span className="icon"><Icon name={item.icon} size="lg" /></span>
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
            <Icon name="logout" /> Log out
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
