import { useState, useEffect, useRef, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useShopify } from '../components/ShopifyAppProvider'
import { shopifyApi, TOKEN_KEY } from '../services/api'
import { Card, CardBody } from '../components/Card'

interface StoreInfo {
  name: string
  email: string
  domain: string
  primaryDomain: string
  plan: string
  currency: string
  timezone: string
  country: string
  description: string
  createdAt: string
}

// ─── Getting Started Steps ────────────────────

const STEPS = [
  {
    icon: '🔗',
    title: 'Connect Your Store',
    desc: 'Your Shopify store is now connected. TDS Geo can access your products, content, and orders.',
    done: true,
  },
  {
    icon: '📝',
    title: 'Configure Content Settings',
    desc: 'Set up your brand voice, preferred topics, and content guidelines in the Settings page.',
    done: false,
    link: '/settings',
  },
  {
    icon: '🚀',
    title: 'Run Your First Pipeline',
    desc: 'Generate SEO-optimized articles automatically. Start a pipeline and publish directly to your store.',
    done: false,
    link: '/pipeline',
  },
  {
    icon: '📊',
    title: 'Track Performance',
    desc: 'Monitor article performance, SEO scores, and analytics from your dashboard.',
    done: false,
    link: '/analytics',
  },
]

// ─── Component ────────────────────────────────

export default function ShopifyWelcome() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, shop: authShop, isShopifyAuth, loading: authLoading } = useAuth()
  const { isEmbedded, shop: appShop } = useShopify()
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(true)
  const [infoError, setInfoError] = useState('')
  const [appBridgeReady, setAppBridgeReady] = useState(false)
  const [animated, setAnimated] = useState(false)
  const initialized = useRef(false)

  // Determine the shop from URL param, auth context, or app context
  const shop = searchParams.get('shop') || authShop || appShop || ''

  // ── Fetch store info ──
  useEffect(() => {
    if (!shop || initialized.current) return
    initialized.current = true

    const load = async () => {
      try {
        const data = await shopifyApi.getStoreInfo(shop)
        setStoreInfo(data.store)
      } catch (err: any) {
        setInfoError(err.response?.data?.error || err.message || 'Failed to load store info')
      } finally {
        setInfoLoading(false)
      }
    }
    load()
  }, [shop])

  // ── Check App Bridge ready ──
  useEffect(() => {
    const check = () => {
      if ((window as any).shopify) {
        setAppBridgeReady(true)
      }
    }
    const timer = setInterval(check, 200)
    setTimeout(() => { clearInterval(timer); setAppBridgeReady(prev => prev) }, 5000)
    return () => clearInterval(timer)
  }, [])

  // ── Entrance animation ──
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [])

  // ── Redirect if not authenticated or missing shop ──
  useEffect(() => {
    if (!authLoading && !isShopifyAuth && !localStorage.getItem('ai_seo_auth_token')) {
      navigate('/', { replace: true })
    }
  }, [authLoading, isShopifyAuth, navigate])

  // ── Guard: missing shop -> redirect to dashboard ──
  useEffect(() => {
    if (!authLoading && !infoLoading && !shop) {
      navigate('/', { replace: true })
    }
  }, [authLoading, infoLoading, shop, navigate])

  // ── Registration state ──
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState(false)

  const hasAccount = !!((user as any)?.client_id)

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setRegError('')
    setRegLoading(true)
    try {
      const result = await shopifyApi.shopRegister({
        email: regEmail,
        password: regPassword,
        name: regName,
        shop,
      })
      localStorage.setItem(TOKEN_KEY, result.token)
      setRegSuccess(true)
      setTimeout(() => {
        window.location.href = '/'
      }, 1200)
    } catch (err: any) {
      setRegError(err.response?.data?.error || err.message || 'Registration failed')
    } finally {
      setRegLoading(false)
    }
  }

  const goToDashboard = () => navigate('/', { replace: true })
  const goTo = (path: string) => navigate(path)

  // ── Loading state ──
  if (infoLoading || authLoading) {
    return (
      <div className="welcome-page">
        <div className="welcome-container">
          <div className="welcome-loading">
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
            <p style={{ marginTop: 20, color: 'var(--text-muted)' }}>Connecting to your store...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (infoError) {
    return (
      <div className="welcome-page">
        <div className="welcome-container">
          <Card>
            <CardBody>
              <div className="welcome-error">
                <span style={{ fontSize: 48 }}>⚠️</span>
                <h3>Connection Issue</h3>
                <p>{infoError}</p>
                <button className="btn btn-primary" onClick={goToDashboard} style={{ marginTop: 16 }}>
                  Go to Dashboard
                </button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    )
  }

  // ── Registration success ──
  if (regSuccess) {
    return (
      <div className="welcome-page">
        <div className="welcome-container welcome-visible">
          <div className="welcome-header">
            <div className="welcome-icon-wrap">
              <span className="welcome-icon" style={{ fontSize: 64 }}>✅</span>
            </div>
            <h1>Account Created!</h1>
            <p className="welcome-subtitle">
              Welcome aboard, {regName}! Redirecting to your dashboard...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="welcome-page">
      <div className={`welcome-container ${animated ? 'welcome-visible' : ''}`}>
        {/* ── Header ── */}
        <div className="welcome-header">
          <div className="welcome-icon-wrap">
            <span className="welcome-icon">🎉</span>
          </div>
          <h1>Welcome to TDS Geo!</h1>
          <p className="welcome-subtitle">
            Your store is now connected and ready for AI-powered content automation.
          </p>
        </div>

        {/* ── Store Info Card ── */}
        <div className="welcome-store-card">
          <div className="welcome-store-header">
            <div className="welcome-store-avatar">
              {(storeInfo?.name || shop).charAt(0).toUpperCase()}
            </div>
            <div className="welcome-store-details">
              <h2>{storeInfo?.name || shop.replace('.myshopify.com', '')}</h2>
              <span className="welcome-store-domain">{shop}</span>
            </div>
            <div className="welcome-plan-badge">
              {storeInfo?.plan || 'Shopify'}
            </div>
          </div>

          <div className="welcome-store-meta">
            {storeInfo?.email && (
              <div className="welcome-store-meta-item">
                <span className="meta-label">Email</span>
                <span className="meta-value">{storeInfo.email}</span>
              </div>
            )}
            {storeInfo?.primaryDomain && (
              <div className="welcome-store-meta-item">
                <span className="meta-label">Domain</span>
                <span className="meta-value">{storeInfo.primaryDomain}</span>
              </div>
            )}
            {storeInfo?.currency && (
              <div className="welcome-store-meta-item">
                <span className="meta-label">Currency</span>
                <span className="meta-value">{storeInfo.currency}</span>
              </div>
            )}
            {storeInfo?.timezone && (
              <div className="welcome-store-meta-item">
                <span className="meta-label">Timezone</span>
                <span className="meta-value">{storeInfo.timezone}</span>
              </div>
            )}
            {storeInfo?.country && (
              <div className="welcome-store-meta-item">
                <span className="meta-label">Country</span>
                <span className="meta-value">{storeInfo.country}</span>
              </div>
            )}
            {storeInfo?.createdAt && (
              <div className="welcome-store-meta-item">
                <span className="meta-label">Store since</span>
                <span className="meta-value">{new Date(storeInfo.createdAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {storeInfo?.description && (
            <div className="welcome-store-description">
              {storeInfo.description}
            </div>
          )}

          <div className="welcome-bridge-status">
            <span className={`bridge-dot ${appBridgeReady ? 'bridge-on' : 'bridge-off'}`} />
            <span>
              {appBridgeReady
                ? 'Shopify App Bridge connected — running in embedded mode'
                : isEmbedded
                  ? 'App Bridge loading...'
                  : 'Standalone mode'}
            </span>
          </div>
        </div>

        {/* ── Registration Form (shown when no user account exists yet) ── */}
        {!hasAccount && (
          <div className="welcome-register-card">
            <h3>Create Your Account</h3>
            <p className="text-muted" style={{ marginBottom: 20 }}>
              Set up your account to access the dashboard and manage your store's content.
              Your account will be linked to <strong>{shop}</strong>.
            </p>

            {regError && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>{regError}</div>
            )}

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Your Name</label>
                <input
                  id="reg-name"
                  type="text"
                  className="form-input"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="John Doe"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">Email Address</label>
                <input
                  id="reg-email"
                  type="email"
                  className="form-input"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">Password</label>
                <input
                  id="reg-password"
                  type="password"
                  className="form-input"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                disabled={regLoading}
              >
                {regLoading ? 'Creating Account...' : 'Create Account & Get Started'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
              🔒 Your account is scoped to <strong>{shop}</strong>. You'll only see data related to your store.
            </p>
          </div>
        )}

        {/* ── Already has account — show getting started steps ── */}
        {hasAccount && (
          <div className="welcome-steps">
            <h3>Getting Started</h3>
            <div className="welcome-steps-list">
              {STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`welcome-step ${step.done ? 'step-done' : ''} ${step.link ? 'step-clickable' : ''}`}
                  onClick={() => step.link && goTo(step.link)}
                >
                  <div className="step-indicator">
                    {step.done ? (
                      <span className="step-check">✓</span>
                    ) : (
                      <span className="step-num">{i + 1}</span>
                    )}
                  </div>
                  <div className="step-content">
                    <div className="step-header">
                      <span className="step-icon">{step.icon}</span>
                      <strong>{step.title}</strong>
                      {step.done && <span className="step-done-label">Done</span>}
                    </div>
                    <p className="step-desc">{step.desc}</p>
                  </div>
                  {step.link && !step.done && (
                    <span className="step-arrow">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="welcome-actions">
          <button className="btn btn-primary btn-lg" onClick={goToDashboard}>
            {hasAccount ? 'Go to Dashboard' : 'Go to Dashboard (Skip)'}
          </button>
          {isEmbedded && (
            <p className="welcome-embedded-note">
              💡 Tip: You can always find TDS Geo in your Shopify admin under <strong>Apps → TDS Geo</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
