import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  { to: '/portal', label: 'Dashboard', end: true },
  { to: '/portal/articles', label: 'Articles', end: false },
  { to: '/portal/settings', label: 'Settings', end: false },
  { to: '/portal/logs', label: 'Logs', end: false },
]

export default function ClientLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const status = 'healthy'

  return (
    <div className="tds-shell" style={{ maxWidth: '100%', padding: '0', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <nav className="tds-nav">
          <div className="tds-nav-logo">
            <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" fill="#FCB900" />
              <text x="50" y="62" textAnchor="middle" fill="#171414" fontSize="40" fontWeight="800" fontFamily="system-ui">G</text>
            </svg>
          </div>
          <span className="tds-nav-title">Traffic Digital Solutions GEO</span>
          <div className="tds-nav-items">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `tds-nav-item ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="tds-nav-status">
            <span className={`tds-nav-dot ${status}`} />
            v3.0.0
          </div>
        </nav>

        <Outlet />

        <div style={{ textAlign: 'center', padding: '32px 0 0', fontSize: '12px', color: 'var(--tds-text-tertiary)' }}>
          &copy; {new Date().getFullYear()} Traffic Digital Solutions
        </div>
      </div>
    </div>
  )
}
