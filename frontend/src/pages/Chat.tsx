import { useState, useEffect, useRef } from 'react'
import { chatApi, analyticsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import type { ChatSession, ChatMessage } from '../types'

const QUICK_ACTIONS = [
  { label: '📋 List Articles', cmd: 'list articles' },
  { label: '🔍 Research Keywords', cmd: 'research keywords for SEO tools' },
  { label: '📊 Dashboard Stats', cmd: 'show analytics overview' },
  { label: '⚙️ System Config', cmd: 'list config' },
  { label: '🧩 List Plugins', cmd: 'list plugins' },
  { label: '🤖 Run Analysis', cmd: 'analyze improvements' },
]

function renderMessage(content: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }
    const lang = match[1] || 'text'
    const code = match[2].trim()
    parts.push(
      <div key={`code-${match.index}`} className="chat-code-block">
        {lang && <div className="chat-code-lang">{lang}</div>}
        <pre><code>{code}</code></pre>
      </div>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [content]
}

export default function Chat() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [showQuickActions, setShowQuickActions] = useState(true)
  const [crossAnalytics, setCrossAnalytics] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { addToast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadSessions() }, [])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        if (user?.client_id) {
          const data = await analyticsApi.overview(user.client_id)
          setCrossAnalytics(data)
        }
      } catch { /* non-critical */ }
    }
    loadAnalytics()
  }, [user?.client_id])

  async function loadSessions() {
    try {
      setSessionsLoading(true)
      const data = await chatApi.listSessions()
      setSessions(data.sessions || [])
    } catch { addToast('error', 'Failed to load sessions') } finally { setSessionsLoading(false) }
  }

  async function createSession() {
    try {
      const session = await chatApi.createSession(`Chat ${new Date().toLocaleString()}`)
      setActiveSession(session)
      setMessages([])
      setShowQuickActions(true)
      setSidebarOpen(false)
      loadSessions()
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch { }
  }

  async function loadSession(session: ChatSession) {
    try {
      setLoading(true)
      const data = await chatApi.getSession(session.id)
      setActiveSession(data)
      setMessages(data.messages || [])
      setShowQuickActions(false)
      setSidebarOpen(false)
    } catch { addToast('error', 'Failed to load session') } finally { setLoading(false) }
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await chatApi.deleteSession(id)
      if (activeSession?.id === id) {
        setActiveSession(null)
        setMessages([])
        setShowQuickActions(true)
      }
      loadSessions()
    } catch { addToast('error', 'Failed to delete session') }
  }

  async function handleSubmit(cmd?: string) {
    const text = (cmd || input).trim()
    if (!text) return

    let sessionId: string | undefined = activeSession?.id
    if (!sessionId) {
      try {
        const session = await chatApi.createSession(`Chat ${new Date().toLocaleString()}`)
        if (!session?.id) return
        sessionId = session.id
        setActiveSession(session)
        loadSessions()
    } catch { addToast('error', 'Failed to create session'); return }
  }

    const userMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      session_id: sessionId!,
      role: 'user',
      content: text,
      tool_calls: [],
      tool_results: [],
      metadata: {},
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setShowQuickActions(false)
    setLoading(true)

    try {
      const data = await chatApi.sendMessage(sessionId!, text)
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== userMsg.id)
        return [...filtered, data.userMessage, data.assistantMessage]
      })
      setActiveSession(prev =>
        prev ? { ...prev, message_count: (prev.message_count || 0) + 2 } : prev
      )    } catch(err: any) {
      const msg = err.response?.data?.error || 'Failed to process command'
      const errorMsg: ChatMessage = {
        id: 'error-' + Date.now(),
        session_id: sessionId!,
        role: 'system',
        content: `❌ ${msg}`,
        tool_calls: [],
        tool_results: [],
        metadata: {},
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMsg])
      addToast('error', msg)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function quickAction(cmd: string) {
    setInput(cmd)
    handleSubmit(cmd)
  }

  const analyticsContext = crossAnalytics ? {
    totalArticles: crossAnalytics?.articles?.total || 0,
    published: crossAnalytics?.articles?.published || 0,
    pending: crossAnalytics?.articles?.pending || 0,
    avgSeoScore: crossAnalytics?.articles?.avg_seo_score || '—',
    keywords: crossAnalytics?.keywords?.total || 0,
    keywordsUsed30d: crossAnalytics?.keywords?.used_30d || 0,
  } : null

  return (
    <div className="chat-page-container">
      {/* ─── Session Drawer Overlay ─── */}
      {sidebarOpen && (
        <div className="chat-drawer-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── Sessions Drawer ─── */}
      <aside className={`chat-drawer ${sidebarOpen ? 'open' : ''}`}>
        <div className="chat-drawer-header">
          <div className="chat-drawer-brand">
            <span className="chat-brand-icon">💬</span>
            <div>
              <h2>AI Chat</h2>
              <span className="chat-status-badge">
                <span className="chat-status-dot" />
                {user?.role || 'connected'}
              </span>
            </div>
          </div>
          <button className="btn-new-chat" onClick={createSession} title="New Chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div className="chat-drawer-list">
          {sessionsLoading ? (
            <div className="chat-sessions-loading">
              <div className="spinner-sm" />
              <span>Loading sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="chat-sessions-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p>No chats yet</p>
              <button className="btn-start-chat" onClick={createSession}>Start a new chat</button>
            </div>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                className={`chat-session-item ${activeSession?.id === s.id ? 'active' : ''}`}
                onClick={() => loadSession(s)}
              >
                <div className="chat-session-icon">💬</div>
                <div className="chat-session-info">
                  <div className="chat-session-title">{s.title}</div>
                  <div className="chat-session-meta">
                    {s.message_count || 0} msgs · {new Date(s.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="chat-session-delete"
                  onClick={(e) => deleteSession(s.id, e)}
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {analyticsContext && (
          <div className="chat-drawer-analytics">
            <div className="chat-analytics-header">📊 Platform Overview</div>
            <div className="chat-analytics-grid">
              <div className="chat-analytics-item">
                <span className="chat-analytics-value">{analyticsContext.totalArticles}</span>
                <span className="chat-analytics-label">Articles</span>
              </div>
              <div className="chat-analytics-item">
                <span className="chat-analytics-value">{analyticsContext.published}</span>
                <span className="chat-analytics-label">Published</span>
              </div>
              <div className="chat-analytics-item">
                <span className="chat-analytics-value">{analyticsContext.pending}</span>
                <span className="chat-analytics-label">Pending</span>
              </div>
              <div className="chat-analytics-item">
                <span className="chat-analytics-value">{analyticsContext.keywordsUsed30d}</span>
                <span className="chat-analytics-label">Keywords</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ─── Main Chat Area ─── */}
      <div className="chat-main">
        {/* ─── Session Toolbar ─── */}
        <div className="chat-toolbar">
          <button className="chat-toolbar-menu-btn" onClick={() => setSidebarOpen(true)} title="Sessions">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="chat-toolbar-info">
            <span className="chat-toolbar-title">
              {activeSession ? activeSession.title : 'New Chat'}
            </span>
            {activeSession && (
              <span className="chat-toolbar-meta">
                {activeSession.message_count || 0} messages
              </span>
            )}
          </div>
          <button className="btn-new-chat" onClick={createSession} title="New Chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* ─── Messages Area ─── */}
        <div className="chat-messages-container">
          {messages.length === 0 && showQuickActions ? (
            <div className="chat-welcome">
              <div className="chat-welcome-graphic">
                <div className="chat-welcome-orb" />
                <div className="chat-welcome-icon">💬</div>
              </div>
              <h1>How can I help you today?</h1>
              <p className="chat-welcome-subtitle">
                I'm Buffy, your AI platform assistant powered by{' '}
                <strong>DeepSeek Intelligence</strong>.
                I can manage content, analytics, and system operations.
              </p>

              <div className="chat-quick-actions">
                <span className="chat-quick-label">Try these:</span>
                <div className="chat-quick-chips">
                  {QUICK_ACTIONS.map((action, i) => (
                    <button
                      key={i}
                      className="chat-action-chip"
                      onClick={() => quickAction(action.cmd)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {analyticsContext && (
                <div className="chat-welcome-analytics">
                  <div className="chat-welcome-analytics-header">📊 Platform at a Glance</div>
                  <div className="chat-welcome-analytics-grid">
                    <div className="cwa-card">
                      <div className="cwa-value">{analyticsContext.totalArticles}</div>
                      <div className="cwa-label">Total Articles</div>
                    </div>
                    <div className="cwa-card">
                      <div className="cwa-value">{analyticsContext.published}</div>
                      <div className="cwa-label">Published</div>
                    </div>
                    <div className="cwa-card">
                      <div className="cwa-value">{analyticsContext.avgSeoScore}</div>
                      <div className="cwa-label">Avg SEO Score</div>
                    </div>
                    <div className="cwa-card">
                      <div className="cwa-value">{analyticsContext.keywords}</div>
                      <div className="cwa-label">Keywords</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-welcome chat-welcome-small">
              <p>Send a message to start the conversation.</p>
              <div className="chat-quick-chips" style={{ justifyContent: 'center' }}>
                {QUICK_ACTIONS.slice(0, 4).map((action, i) => (
                  <button key={i} className="chat-action-chip" onClick={() => quickAction(action.cmd)}>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`chat-msg ${msg.role}`}>
                  <div className="chat-msg-avatar">
                    {msg.role === 'user' ? (
                      <div className="chat-avatar-user">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                    ) : msg.role === 'assistant' ? (
                      <div className="chat-avatar-ai">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                          <path d="M4 14h16" />
                          <path d="M8 18h8" />
                          <path d="M12 14v4" />
                        </svg>
                      </div>
                    ) : (
                      <div className="chat-avatar-system">⚙️</div>
                    )}
                  </div>
                  <div className="chat-msg-content">
                    <div className="chat-msg-header">
                      <span className="chat-msg-role">
                        {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Buffy AI' : 'System'}
                      </span>
                      <span className="chat-msg-time">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="chat-msg-text">
                      {renderMessage(msg.content)}
                    </div>
                    {msg.metadata?.executionResult && (
                      <div className="chat-msg-meta">
                        {msg.metadata.executionResult.jobId && (
                          <span className="chat-badge-job">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Job: {msg.metadata.executionResult.jobId}
                          </span>
                        )}
                        {msg.metadata.duration && (
                          <span className="chat-badge-duration">{msg.metadata.duration}</span>
                        )}
                        {msg.metadata.executionResult.success === false && (
                          <span className="chat-badge-error">Failed</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="chat-msg assistant">
                  <div className="chat-msg-avatar">
                    <div className="chat-avatar-ai">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M4 14h16"/><path d="M8 18h8"/><path d="M12 14v4"/></svg>
                    </div>
                  </div>
                  <div className="chat-msg-content">
                    <div className="chat-msg-header">
                      <span className="chat-msg-role">Buffy AI</span>
                    </div>
                    <div className="typing-indicator-modern">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ─── Input Area ─── */}
        <div className="chat-input-area">
          <form className="chat-input-form" onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
            <div className="chat-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={loading}
                className="chat-input-field"
                autoFocus
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <div className="spinner-sm spinner-white" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
            <div className="chat-input-hint">
              Press <kbd>Enter</kbd> to send
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
