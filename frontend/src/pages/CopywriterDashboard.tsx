import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react'
import { Link } from 'react-router-dom'
import { articlesApi, editorialApi, promptsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { Card, CardHeader, CardBody } from '../components/Card'
import Icon from '../components/Icon'
import type { Article, EditorialComment } from '../types'

// ─── Types ─────────────────────────────────

interface BriefForm {
  keyword: string
  topic: string
  targetAudience: string
  tone: string
  keyPoints: string
  references: string
  notes: string
}

interface ContentBrief {
  id: string
  keyword: string
  topic: string
  target_audience: string
  tone: string
  key_points: string[]
  ref_urls: string[]
  notes: string
  status: string
  submitted_by_name?: string
  created_at: string
}

// ─── Kanban Column Config ──────────────────

interface ColumnConfig {
  status: string
  label: string
  icon: string
  bgColor: string
  accentColor: string
}

const COLUMNS: ColumnConfig[] = [
  { status: 'generated', label: 'Queue', icon: 'queues', bgColor: '#fefce8', accentColor: '#eab308' },
  { status: 'in_review', label: 'In Review', icon: 'search', bgColor: '#eff6ff', accentColor: '#3b82f6' },
  { status: 'approved', label: 'Approved', icon: 'success', bgColor: '#f0fdf4', accentColor: '#22c55e' },
  { status: 'published', label: 'Published', icon: 'publish', bgColor: '#faf5ff', accentColor: '#a855f7' },
]

const KANBAN_STATUSES = COLUMNS.map(c => c.status)

// ─── Helpers ───────────────────────────────

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    generated: 'yellow', draft: 'gray', approved: 'green', published: 'blue',
    rejected: 'red', in_review: 'blue', failed: 'red',
  }
  return map[status] || 'gray'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

export default function CopywriterDashboard() {
  useAuth()
  const { addToast } = useToast()

  // Kanban state
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Drag state
  const [draggedArticle, setDraggedArticle] = useState<Article | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [droppedArticleId, setDroppedArticleId] = useState<string | null>(null)

  // Confirm publish modal state
  const [confirmPublish, setConfirmPublish] = useState<{
    article: Article
    targetStatus: string
  } | null>(null)

  // Ghost state (shared between mouse and touch drag)
  const [ghostVisible, setGhostVisible] = useState(false)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const pendingPosRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const dragArticleRef = useRef<Article | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; cardRect: DOMRect | null } | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)

  // Comment state
  const [commentModal, setCommentModal] = useState<{ articleId: string; open: boolean }>({ articleId: '', open: false })
  const [comments, setComments] = useState<EditorialComment[]>([])
  const [newComment, setNewComment] = useState('')

  // Brief form state
  const [showBriefForm, setShowBriefForm] = useState(false)
  const [briefForm, setBriefForm] = useState<BriefForm>({
    keyword: '', topic: '', targetAudience: '', tone: 'professional',
    keyPoints: '', references: '', notes: '',
  })
  const [briefsLoading, setBriefsLoading] = useState(false)
  const [recentBriefs, setRecentBriefs] = useState<ContentBrief[]>([])
  const [showBriefsList, setShowBriefsList] = useState(false)
  const [briefsListLoading, setBriefsListLoading] = useState(false)

  // ─── Fetch Kanban Articles ─────────────
  async function fetchArticles() {
    setLoading(true)
    try {
      const data = await articlesApi.list({ limit: 50 })
      const all = (data.data || []).filter((a: Article) =>
        KANBAN_STATUSES.includes(a.status)
      )
      setArticles(all)
    } catch {
      addToast('error', 'Failed to load articles')
    } finally {
      setLoading(false)
    }
  }

  // ─── Fetch Briefs ─────────────────────
  async function fetchBriefs() {
    setBriefsListLoading(true)
    try {
      const data = await promptsApi.getBriefs()
      setRecentBriefs(data.briefs || [])
    } catch { /* non-critical */ }
    finally { setBriefsListLoading(false) }
  }

  useEffect(() => { fetchArticles() }, [])

  // ─── Ghost mount: apply initial position from showGhost() ─
  useLayoutEffect(() => {
    if (!ghostVisible || !pendingPosRef.current || !ghostRef.current) return
    const p = pendingPosRef.current
    ghostRef.current.style.left = `${p.x - p.ox}px`
    ghostRef.current.style.top = `${p.y - p.oy}px`
    pendingPosRef.current = null
  }, [ghostVisible])

  // ─── Drag & Drop Handlers ────────────
  async function advanceArticleStatus(articleId: string, newStatus: string) {
    setActionLoading(articleId)
    try {
      await editorialApi.advanceStatus(articleId, newStatus)
      fetchArticles()
    } catch (err: any) {
      addToast('error', err.response?.data?.error || 'Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  function moveArticleWithUndo(article: Article, targetStatus: string) {
    // Capture the undo context immediately (in closure) before the API call
    const undoId = article.id
    const undoStatus = article.status
    const label = COLUMNS.find(c => c.status === targetStatus)?.label || targetStatus

    advanceArticleStatus(undoId, targetStatus).then(() => {
      // After the status update succeeds, show a toast with Undo
      addToast('success', `Moved to ${label}`, 6000, {
        label: '↩ Undo',
        onClick: () => {
          advanceArticleStatus(undoId, undoStatus)
          addToast('success', `Moved back to ${COLUMNS.find(c => c.status === undoStatus)?.label || undoStatus}`)
        }
      })
    })
  }

  function handlePublishAttempt(dragged: Article, targetStatus: string) {
    if (targetStatus === 'published') {
      // Show confirmation modal before publishing
      setConfirmPublish({ article: dragged, targetStatus })
      return false // indicates the move was intercepted
    }
    return true // proceed normally
  }

  function confirmPublishAction() {
    if (!confirmPublish) return
    const { article, targetStatus } = confirmPublish
    // Clean up drag state so the ghost doesn't flash above the board after modal closes
    setConfirmPublish(null)
    setDraggedArticle(null)
    setDragOverColumn(null)
    hideGhost()
    moveArticleWithUndo(article, targetStatus)
  }

  function cancelPublishAction() {
    setConfirmPublish(null)
    // If there's a stale draggedArticle from a drag that was cancelled, clean it up
    setDraggedArticle(null)
    setDragOverColumn(null)
    hideGhost()
  }

  function handleDragStart(e: React.DragEvent, article: Article) {
    // Firefox requires setData() to initiate a drag operation
    e.dataTransfer.setData('text/plain', article.id)
    e.dataTransfer.effectAllowed = 'move'

    // Hide the browser's default ghost by setting a transparent 1x1 image
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1)
      e.dataTransfer.setDragImage(canvas, 0, 0)
    }

    // Show our custom rich ghost at cursor position
    dragArticleRef.current = article
    showGhost(e.clientX, e.clientY, 120, 20)
    setDraggedArticle(article)
  }

  function handleDragOver(e: React.DragEvent, columnStatus: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    // Only update state when the column actually changes — avoids pointless re-renders
    if (dragOverColumn !== columnStatus) {
      setDragOverColumn(columnStatus)
    }
  }

  function handleDragLeave(e: React.DragEvent, columnStatus: string) {
    // Only clear if we actually left the column (not entering a child element)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    if (dragOverColumn === columnStatus) {
      setDragOverColumn(null)
    }
  }

  function handleDrop(e: React.DragEvent, targetStatus: string) {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedArticle) return
    if (draggedArticle.status === targetStatus) {
      setDraggedArticle(null)
      return // same column, no-op
    }

    // Guard: show confirmation modal before publishing
    if (!handlePublishAttempt(draggedArticle, targetStatus)) {
      // Intercepted — hide ghost so it doesn't float over the modal (ghost has zIndex 500)
      setDragOverColumn(null)
      hideGhost()
      return
    }

    // Mark as just-dropped for animation
    setDroppedArticleId(draggedArticle.id)
    setTimeout(() => setDroppedArticleId(null), 500)

    moveArticleWithUndo(draggedArticle, targetStatus)
    setDraggedArticle(null)
    hideGhost()
  }

  function handleDragEnd() {
    hideGhost()
  }

  function hideGhost() {
    setGhostVisible(false)
    setDragOverColumn(null)
    setDraggedArticle(null)
    dragArticleRef.current = null
  }

  function updateGhostPosition(x: number, y: number, offsetX = 120, offsetY = 20) {
    const el = ghostRef.current
    if (el) {
      el.style.left = `${x - offsetX}px`
      el.style.top = `${y - offsetY}px`
    }
  }

  function showGhost(x: number, y: number, offsetX = 120, offsetY = 20) {
    // Store position in ref — useLayoutEffect will apply it after ghost mounts
    pendingPosRef.current = { x, y, ox: offsetX, oy: offsetY }
    setGhostVisible(true)
  }

  // ─── Touch Drag Handlers ──────────────
  function getColumnStatusFromPoint(x: number, y: number): string | null {
    // Use elementFromPoint to find what's under the touch point
    const el = document.elementFromPoint(x, y)
    if (!el) return null

    // Walk up the DOM to find a kanban-column with a data-status attribute
    let current: Element | null = el as Element
    while (current) {
      if (current.classList.contains('kanban-column')) {
        const status = (current as HTMLElement).dataset.status
        return status || null
      }
      current = current.parentElement
    }
    return null
  }

  function handleTouchStart(e: React.TouchEvent, article: Article) {
    // Get the card element's rect for ghost sizing
    const touch = e.touches[0]
    const cardEl = e.currentTarget as HTMLElement
    const cardRect = cardEl.getBoundingClientRect()

    dragArticleRef.current = article
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      cardRect,
    }

    // Set drag state so the dragging class appears on the original card
    setDraggedArticle(article)

    // Show ghost at touch position
    showGhost(touch.clientX, touch.clientY, cardRect.width / 2, 20)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragArticleRef.current) return

    const touch = e.touches[0]
    const start = touchStartRef.current

    // Require ~10px movement before engaging drag — prevents accidental
    // scroll blocking when user just taps a card
    if (start && Math.abs(touch.clientX - start.x) < 10 && Math.abs(touch.clientY - start.y) < 10) {
      return
    }

    // Prevent scroll while dragging
    e.preventDefault()

    // Show ghost after crossing the threshold (first time)
    if (!ghostVisible && start) {
      showGhost(touch.clientX, touch.clientY, 100, 20)
    }

    // Update ghost position via direct DOM (no re-render)
    updateGhostPosition(touch.clientX, touch.clientY, 100, 20)

    // Detect which column the finger is over
    const columnStatus = getColumnStatusFromPoint(touch.clientX, touch.clientY)
    setDragOverColumn(columnStatus)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const article = dragArticleRef.current
    if (!article) {
      cleanupTouch()
      return
    }

    // Detect column under the release point
    const changedTouch = e.changedTouches[0]
    const targetStatus = getColumnStatusFromPoint(changedTouch.clientX, changedTouch.clientY)

    if (targetStatus && targetStatus !== article.status) {
      // Guard: show confirmation modal before publishing
      if (!handlePublishAttempt(article, targetStatus)) {
        // Intercepted — keep ghost state for the modal context
        cleanupTouch()
        return
      }

      // Mark as just-dropped for animation
      setDroppedArticleId(article.id)
      setTimeout(() => setDroppedArticleId(null), 500)

      moveArticleWithUndo(article, targetStatus)
    }

    cleanupTouch()
  }

  function cleanupTouch() {
    dragArticleRef.current = null
    touchStartRef.current = null
    setGhostVisible(false)
    setDragOverColumn(null)
    setDraggedArticle(null)
  }

  // ─── Quick Action: Approve ────────────
  async function handleApprove(articleId: string) {
    setActionLoading(articleId)
    try {
      await articlesApi.approve(articleId)
      addToast('success', 'Article approved ✓')
      fetchArticles()
    } catch (err: any) {
      addToast('error', err.response?.data?.error || 'Failed to approve')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Quick Action: Reject ─────────────
  async function handleReject(articleId: string) {
    const reason = prompt('Reason for rejection (optional):')
    if (reason === null) return // cancelled
    setActionLoading(articleId)
    try {
      await articlesApi.reject(articleId, reason || undefined)
      addToast('info', 'Article rejected')
      fetchArticles()
    } catch (err: any) {
      addToast('error', err.response?.data?.error || 'Failed to reject')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Comments ─────────────────────────
  async function openComments(articleId: string) {
    setCommentModal({ articleId, open: true })
    setNewComment('')
    try {
      const data = await editorialApi.getComments(articleId)
      setComments(data.data || [])
    } catch {
      setComments([])
    }
  }

  async function addCommentToArticle() {
    if (!newComment.trim() || !commentModal.articleId) return
    try {
      await editorialApi.addComment(commentModal.articleId, { content: newComment })
      setNewComment('')
      const data = await editorialApi.getComments(commentModal.articleId)
      setComments(data.data || [])
      addToast('success', 'Comment added')
    } catch {
      addToast('error', 'Failed to add comment')
    }
  }

  // ─── Submit Brief ─────────────────────
  async function handleSubmitBrief(e: React.FormEvent) {
    e.preventDefault()
    if (!briefForm.keyword.trim() && !briefForm.topic.trim()) {
      addToast('error', 'Keyword or topic is required')
      return
    }
    setBriefsLoading(true)
    try {
      await promptsApi.submitBrief({
        keyword: briefForm.keyword,
        topic: briefForm.topic,
        targetAudience: briefForm.targetAudience,
        tone: briefForm.tone,
        keyPoints: briefForm.keyPoints.split('\n').filter(Boolean),
        references: briefForm.references.split('\n').filter(Boolean),
        notes: briefForm.notes,
      })
      addToast('success', 'Brief submitted! The AI will use it for generation.')
      setBriefForm({ keyword: '', topic: '', targetAudience: '', tone: 'professional', keyPoints: '', references: '', notes: '' })
      setShowBriefForm(false)
      fetchBriefs()
    } catch (err: any) {
      addToast('error', err.response?.data?.error || 'Failed to submit brief')
    } finally {
      setBriefsLoading(false)
    }
  }

  // ─── Group articles by status ─────────
  const grouped = useMemo(() =>
    COLUMNS.map(col => ({
      ...col,
      items: articles.filter(a => a.status === col.status),
    })),
    [articles]
  )

  // ─── Virtual counts per column (memoized) ─
  const virtualCounts = useMemo(() => {
    const counts: Record<string, { actual: number; virtual: number; delta: number }> = {}
    for (const col of COLUMNS) {
      const actual = articles.filter(a => a.status === col.status).length
      if (!dragArticleRef.current || confirmPublish) {
        counts[col.status] = { actual, virtual: actual, delta: 0 }
        continue
      }

      const isSource = col.status === dragArticleRef.current.status
      const isTarget = col.status === dragOverColumn

      let virtual = actual
      let delta = 0

      if (isSource) {
        virtual -= 1
        delta -= 1
      }
      if (isTarget && !isSource) {
        virtual += 1
        delta += 1
      }

      counts[col.status] = { actual, virtual, delta }
    }
    return counts
  }, [articles, dragOverColumn, confirmPublish])

  const pendingCount = articles.filter(a => a.status === 'generated').length

  // ─── Mouse move listener for ghost tracking ─
  useEffect(() => {
    if (!ghostVisible) return

    // Throttled via RAF — directly updates DOM via ref (no React state = no re-renders)
    let rafId: number | null = null
    function onMouseMove(e: MouseEvent) {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        updateGhostPosition(e.clientX, e.clientY, 120, 20)
        rafId = null
      })
    }

    document.addEventListener('mousemove', onMouseMove)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [ghostVisible]) // Only active while ghost is showing

  // ─── Keyboard handler for drag cancel ─
  useEffect(() => {
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'Escape' && draggedArticle) {
        setDraggedArticle(null)
        setDragOverColumn(null)
        hideGhost()
      }
    }
    window.addEventListener('keyup', handleKeyUp)
    return () => window.removeEventListener('keyup', handleKeyUp)
  }, [draggedArticle])

  return (
    <>
      <div className="page-header">
        <div>
          <h2><Icon name="copywriter" /> Copywriter Dashboard</h2>
          <p>
            Review articles, provide feedback, and submit content briefs for AI generation
            {pendingCount > 0 && (
              <span className="badge badge-yellow" style={{ marginLeft: 10, fontSize: 12, padding: '3px 10px' }}>
                {pendingCount} pending review
              </span>
            )}
          </p>
        </div>
        <div className="card-actions">
          <button
            className={`btn ${showBriefForm ? 'btn-outline' : 'btn-primary'}`}
            onClick={() => { setShowBriefForm(!showBriefForm); if (!showBriefForm) fetchBriefs() }}
          >
            {showBriefForm ? <><Icon name="cancel" /> Close Brief Form</> : <><Icon name="copywriter" /> New Content Brief</>}
          </button>
          <button className="btn btn-outline" onClick={() => { setShowBriefsList(!showBriefsList); if (!showBriefsList) fetchBriefs() }}>
            <Icon name="queues" /> My Briefs
          </button>
          <Link to="/editorial" className="btn btn-outline">Full Editorial</Link>
        </div>
      </div>

      <div className="page-body">
        {/* ─── Brief Submission Form ─── */}
        {showBriefForm && (
          <Card style={{ marginBottom: 20, borderLeft: '4px solid var(--primary)' }}>
            <CardHeader>
              <Icon name="copywriter" /> Submit a Content Brief
              <span className="text-sm text-muted">Tell the AI what to write about</span>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleSubmitBrief}>
                <div className="brief-form-grid">
                  <div className="form-group">
                    <label>Keyword <span className="required-mark">*</span></label>
                    <input className="form-input" placeholder="e.g., gutter maintenance tips"
                      value={briefForm.keyword} onChange={e => setBriefForm({ ...briefForm, keyword: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Topic <span className="required-mark">*</span></label>
                    <input className="form-input" placeholder="e.g., Seasonal Home Maintenance Guide"
                      value={briefForm.topic} onChange={e => setBriefForm({ ...briefForm, topic: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Target Audience</label>
                    <input className="form-input" placeholder="e.g., Homeowners aged 30-55"
                      value={briefForm.targetAudience} onChange={e => setBriefForm({ ...briefForm, targetAudience: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Tone</label>
                    <select className="form-select" value={briefForm.tone}
                      onChange={e => setBriefForm({ ...briefForm, tone: e.target.value })}>
                      <option value="professional">Professional</option>
                      <option value="educational">Educational</option>
                      <option value="conversational">Conversational</option>
                      <option value="authoritative">Authoritative</option>
                      <option value="friendly">Friendly</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Key Points (one per line)</label>
                  <textarea className="form-textarea" rows={3} placeholder="• Point 1&#10;• Point 2&#10;• Point 3"
                    value={briefForm.keyPoints} onChange={e => setBriefForm({ ...briefForm, keyPoints: e.target.value })} />
                </div>
                <div className="brief-form-row">
                  <div className="form-group">
                    <label>References / URLs (one per line)</label>
                    <textarea className="form-textarea" rows={3} placeholder="https://example.com/resource"
                      value={briefForm.references} onChange={e => setBriefForm({ ...briefForm, references: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Additional Notes</label>
                    <textarea className="form-textarea" rows={3} placeholder="Any special instructions for the AI..."
                      value={briefForm.notes} onChange={e => setBriefForm({ ...briefForm, notes: e.target.value })} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={briefsLoading}>
                  {briefsLoading ? <><Icon name="loading" spin /> Submitting...</> : <><Icon name="publish" /> Submit Brief</>}
                </button>
              </form>
            </CardBody>
          </Card>
        )}

        {/* ─── Recent Briefs List ─── */}
        {showBriefsList && (
          <Card style={{ marginBottom: 20 }}>
            <CardHeader><Icon name="queues" /> My Recent Briefs</CardHeader>
            <CardBody>
              {briefsListLoading ? (
                <div className="empty-state"><div className="spinner" /></div>
              ) : recentBriefs.length === 0 ? (
                <p className="text-muted text-sm">No briefs submitted yet. Create your first one!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recentBriefs.map(b => (
                    <div key={b.id} className="brief-item">
                      <div className="brief-item-header">
                        <strong>{b.keyword}</strong>
                        <span className={`badge badge-${statusBadge(b.status)}`}>{b.status}</span>
                      </div>
                      <div className="brief-item-meta">
                        {b.target_audience && <span>👤 {b.target_audience}</span>}
                        <Icon name="search-intent" /> {b.tone}
                        <span className="text-xs text-muted">{timeAgo(b.created_at)}</span>
                      </div>
                      {b.notes && <p className="brief-item-notes">{b.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* ─── Kanban Board ─── */}
        <div
          className="kanban-board"
          ref={boardRef}
          onDragEnd={handleDragEnd}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={cleanupTouch}
        >
          {grouped.map(col => (
            <div
              key={col.status}
              className={`kanban-column ${dragOverColumn === col.status ? 'drag-over' : ''}`}
              style={{ background: col.bgColor }}
              data-status={col.status}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={(e) => handleDragLeave(e, col.status)}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              <div className="kanban-column-header" style={{ borderBottomColor: col.accentColor }}>
                <span className="kanban-column-icon"><Icon name={col.icon} size="lg" /></span>
                <span className="kanban-column-label">{col.label}</span>
                <span className="kanban-column-count" style={{ background: col.accentColor }}>
                  {(() => {
                    const vc = virtualCounts[col.status]
                    const virtual = vc?.virtual ?? col.items.length
                    const delta = vc?.delta ?? 0
                    return (
                      <>
                        {virtual}
                        {delta !== 0 && (
                          <span className={`count-delta count-delta-${delta > 0 ? 'positive' : 'negative'}`}>
                            {delta > 0 ? '+1' : '-1'}
                          </span>
                        )}
                      </>
                    )
                  })()}
                </span>
              </div>
              <div className="kanban-column-body">
                {loading ? (
                  <div className="empty-state" style={{ padding: 20 }}><div className="spinner" /></div>
                ) : col.items.length === 0 ? (
                  <div className="kanban-empty">
                    <span className="text-muted text-sm">No articles</span>
                  </div>
                ) : (
                  col.items.map(article => (
                    <div
                      key={article.id}
                      className={`kanban-card ${draggedArticle?.id === article.id ? 'dragging' : ''} ${droppedArticleId === article.id ? 'just-dropped' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, article)}
                      onTouchStart={(e) => handleTouchStart(e, article)}
                    >
                      <div className="kanban-card-top">
                        <Link to={`/articles/${article.id}`} className="kanban-card-title">
                          {article.title || article.keyword || 'Untitled'}
                        </Link>
                        <button
                          className="kanban-card-comment-btn"
                          onClick={() => openComments(article.id)}
                          title="Comments"
                        >
                          <Icon name="comment" />
                        </button>
                      </div>

                      <div className="kanban-card-meta">
                        {article.keyword && (
                          <span className="badge badge-blue badge-sm">{article.keyword}</span>
                        )}
                        {article.seo_score != null && (
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            color: article.seo_score >= 70 ? 'var(--success)' : article.seo_score >= 50 ? 'var(--warning)' : 'var(--danger)',
                          }}>
                            SEO {article.seo_score}
                          </span>
                        )}
                        <span className="text-xs text-muted">
                          {article.word_count?.toLocaleString() || '—'} words
                        </span>
                      </div>

                      <div className="kanban-card-footer">
                        <span className="text-xs text-muted">{timeAgo(article.created_at)}</span>
                        <div className="kanban-card-actions">
                          {(article.status === 'generated' || article.status === 'in_review') && (
                            <>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleApprove(article.id)}
                                disabled={actionLoading === article.id}
                              >
                                ✓ Approve
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleReject(article.id)}
                                disabled={actionLoading === article.id}
                              >
                                <Icon name="reject" />
                              </button>
                            </>
                          )}
                          {article.status === 'approved' && (
                            <Link to={`/articles/${article.id}`} className="btn btn-outline btn-sm">
                              <Icon name="publish" /> Publish
                            </Link>
                          )}
                          {article.status === 'published' && (
                            <span className="badge badge-green badge-sm"><Icon name="completed" /> Published</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Drag Ghost (mouse + touch) ─── */}
        {ghostVisible && dragArticleRef.current && (
          <div
            ref={ghostRef}
            className="drag-ghost"
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: 240,
              zIndex: 500,
              pointerEvents: 'none',
              background: 'white',
              border: '2px solid var(--primary)',
              borderRadius: 10,
              padding: '12px 14px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
              transform: 'rotate(3deg) scale(1.02)',
              opacity: 0.92,
              transition: 'none',
            }}>
            {/* Ghost header: target column name */}
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: 'var(--primary)', marginBottom: 6, paddingBottom: 6,
              borderBottom: '1px solid var(--gray-100)',
            }}>
              {dragArticleRef.current.status === 'generated' ? 'Queue' :
               dragArticleRef.current.status === 'in_review' ? 'In Review' :
               dragArticleRef.current.status === 'approved' ? 'Approved' :
               dragArticleRef.current.status === 'published' ? 'Published' : dragArticleRef.current.status}
              {' '}→ {dragOverColumn ? (
                <span style={{ color: 'var(--success)' }}>
                  {dragOverColumn === 'generated' ? 'Queue' :
                   dragOverColumn === 'in_review' ? 'In Review' :
                   dragOverColumn === 'approved' ? 'Approved' :
                   dragOverColumn === 'published' ? 'Published' : dragOverColumn}
                </span>
              ) : '...'}
            </div>

            {/* Ghost title */}
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 6, lineHeight: 1.3 }}>
              {dragArticleRef.current.title || dragArticleRef.current.keyword || 'Untitled'}
            </div>

            {/* Ghost badges */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {dragArticleRef.current.keyword && (
                <span className="badge badge-blue badge-sm">{dragArticleRef.current.keyword}</span>
              )}
              {dragArticleRef.current.seo_score != null && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: dragArticleRef.current.seo_score >= 70 ? 'var(--success)' :
                         dragArticleRef.current.seo_score >= 50 ? 'var(--warning)' : 'var(--danger)',
                }}>
                  SEO {dragArticleRef.current.seo_score}
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--gray-400)' }}>
                {dragArticleRef.current.word_count?.toLocaleString() || '—'} words
              </span>
            </div>
          </div>
        )}

        {/* ─── Stats Row ─── */}
        <div className="copywriter-stats">
          <div className="copywriter-stat">
            <span className="copywriter-stat-value" style={{ color: '#eab308' }}>
              {articles.filter(a => a.status === 'generated').length}
            </span>
            <span className="copywriter-stat-label">Awaiting Review</span>
          </div>
          <div className="copywriter-stat">
            <span className="copywriter-stat-value" style={{ color: '#3b82f6' }}>
              {articles.filter(a => a.status === 'in_review').length}
            </span>
            <span className="copywriter-stat-label">In Review</span>
          </div>
          <div className="copywriter-stat">
            <span className="copywriter-stat-value" style={{ color: '#22c55e' }}>
              {articles.filter(a => a.status === 'approved').length}
            </span>
            <span className="copywriter-stat-label">Ready to Publish</span>
          </div>
          <div className="copywriter-stat">
            <span className="copywriter-stat-value" style={{ color: '#a855f7' }}>
              {articles.filter(a => a.status === 'published').length}
            </span>
            <span className="copywriter-stat-label">Published</span>
          </div>
          <div className="copywriter-stat">
            <span className="copywriter-stat-value">{recentBriefs.length}</span>
            <span className="copywriter-stat-label">Briefs Submitted</span>
          </div>
        </div>
      </div>

      {/* ─── Confirm Publish Modal ─── */}
      {confirmPublish && (
        <div className="modal-overlay" onClick={cancelPublishAction}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 8,
                  background: '#fef2f2', color: 'var(--danger)', fontSize: 16,
                }}>⚠</span>
                Confirm Publish
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 16, lineHeight: 1.5 }}>
                Are you sure you want to publish this article? It will be sent live to connected platforms.
              </p>

              <div style={{
                background: 'var(--gray-50)',
                border: '1px solid var(--gray-200)',
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 8 }}>
                  {confirmPublish.article.title || confirmPublish.article.keyword || 'Untitled'}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {confirmPublish.article.keyword && (
                    <span className="badge badge-blue badge-sm">{confirmPublish.article.keyword}</span>
                  )}
                  {confirmPublish.article.seo_score != null && (
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: confirmPublish.article.seo_score >= 70 ? 'var(--success)' :
                             confirmPublish.article.seo_score >= 50 ? 'var(--warning)' : 'var(--danger)',
                    }}>
                      SEO {confirmPublish.article.seo_score}
                    </span>
                  )}
                  <span className="text-muted text-sm">
                    {confirmPublish.article.word_count?.toLocaleString() || '—'} words
                  </span>
                </div>
              </div>

              <div style={{
                padding: 10, borderRadius: 8,
                background: '#fefce8', border: '1px solid #fde68a',
                fontSize: 13, color: '#92400e', lineHeight: 1.4,
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <span style={{ flexShrink: 0 }}>⚠</span>
                <span>This action will publish the article immediately. You can undo this from the toast notification that appears after publishing.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={cancelPublishAction}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={confirmPublishAction}>
                <Icon name="publish" /> Confirm Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Comments Modal ─── */}
      {commentModal.open && (
        <div className="modal-overlay" onClick={() => setCommentModal({ articleId: '', open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3><Icon name="comment" /> Comments</h3>
              <Link to={`/articles/${commentModal.articleId}`} className="btn btn-outline btn-sm">
                View Article →
              </Link>
            </div>
            <div className="modal-body">
              <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
                {comments.length === 0 ? (
                  <p className="text-muted text-sm" style={{ padding: '12px 0', textAlign: 'center' }}>
                    No comments yet. Add the first one!
                  </p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span className="text-sm font-medium">{c.author_name || 'Copywriter'}</span>
                        <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>
                        {c.resolved && <span className="badge badge-green badge-sm">Resolved</span>}
                      </div>
                      <p className="text-sm" style={{ color: 'var(--gray-700)' }}>{c.content}</p>
                    </div>
                  ))
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCommentToArticle() } }}
                />
                <button className="btn btn-primary btn-sm" onClick={addCommentToArticle} disabled={!newComment.trim()}>
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
