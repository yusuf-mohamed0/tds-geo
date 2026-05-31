import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { editorialApi } from '../services/api'
import { EditorialReviewAssignment, EditorialReview, EditorialComment, EditorialCalendarEntry, ContentVersion } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Card, CardHeader, CardBody, CardFooter } from '../components/Card'
import { DataTable, Column } from '../components/DataTable'
import { useToast } from '../components/Toast'

type Tab = 'assignments' | 'reviews' | 'calendar' | 'versions'

const REVIEW_BADGE: Record<string, string> = {
  pending: 'yellow', in_progress: 'blue', completed: 'green',
  skipped: 'gray', revision_requested: 'red',
}

const DECISION_BADGE: Record<string, string> = {
  approved: 'green', rejected: 'red', revision_requested: 'yellow', needs_fact_check: 'purple',
}

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'red', high: 'yellow', medium: 'blue', low: 'gray',
}

export default function EditorialWorkflow() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('assignments')
  const [assignments, setAssignments] = useState<EditorialReviewAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedAssignment, setSelectedAssignment] = useState<EditorialReviewAssignment | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewData, setReviewData] = useState({ decision: 'approved', score: 80, comments: '', suggestions: '' })
  const [comments, setComments] = useState<EditorialComment[]>([])
  const [showComments, setShowComments] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [calendarEntries, setCalendarEntries] = useState<EditorialCalendarEntry[]>([])
  const [versions, setVersions] = useState<ContentVersion[]>([])
  const [showCalendarForm, setShowCalendarForm] = useState(false)
  const [calendarForm, setCalendarForm] = useState({ title: '', keyword: '', status: 'planned' as any, priority: 'medium' as any, due_date: '', notes: '' })
  const [showAssignmentForm, setShowAssignmentForm] = useState(false)
  const [assignmentForm, setAssignmentForm] = useState({ article_id: '', reviewer_id: '', review_type: 'editor_review' as any, priority: 0 })
  const { addToast } = useToast()

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      if (activeTab === 'assignments') {
        const data = await editorialApi.getAssignments()
        setAssignments(data.data || [])
      } else if (activeTab === 'calendar') {
        const data = await editorialApi.getCalendar(user?.client_id)
        setCalendarEntries(data.data || [])
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [activeTab])

  const fetchComments = async (articleId: string) => {
    try {
      const data = await editorialApi.getComments(articleId)
      setComments(data.data || [])
      setShowComments(articleId)
    } catch { /* ignore */ }
  }

  const submitReview = async () => {
    if (!selectedAssignment) return
    try {
      await editorialApi.submitReview({
        article_id: selectedAssignment.article_id,
        review_type: selectedAssignment.review_type,
        decision: reviewData.decision,
        score: reviewData.score,
        comments: reviewData.comments,
        suggestions: reviewData.suggestions.split('\n').filter(Boolean),
      })
      addToast('success', 'Review submitted successfully!')
      setShowReviewModal(false)
      setSelectedAssignment(null)
      setReviewData({ decision: 'approved', score: 80, comments: '', suggestions: '' })
      fetchData()
    } catch (err: any) {
      addToast('error', err.response?.data?.error || 'Failed to submit review')
    }
  }

  const addComment = async () => {
    if (!showComments || !newComment.trim()) return
    try {
      await editorialApi.addComment(showComments, { content: newComment })
      setNewComment('')
      fetchComments(showComments)
      addToast('success', 'Comment added')
    } catch { addToast('error', 'Failed to add comment') }
  }

  const createAssignment = async () => {
    try {
      await editorialApi.createAssignment(assignmentForm)
      setShowAssignmentForm(false)
      setAssignmentForm({ article_id: '', reviewer_id: '', review_type: 'editor_review', priority: 0 })
      addToast('success', 'Assignment created')
      fetchData()
    } catch { addToast('error', 'Failed to create assignment') }
  }

  const createCalendarEntry = async () => {
    try {
      await editorialApi.createCalendarEntry(calendarForm)
      setShowCalendarForm(false)
      setCalendarForm({ title: '', keyword: '', status: 'planned', priority: 'medium', due_date: '', notes: '' })
      addToast('success', 'Calendar entry created')
      fetchData()
    } catch { addToast('error', 'Failed to create entry') }
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'assignments', label: 'My Assignments', badge: assignments.filter(a => a.status === 'pending').length },
    { id: 'reviews', label: 'Reviews' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'versions', label: 'Version History' },
  ]

  const assignmentColumns: Column<EditorialReviewAssignment>[] = [
    { key: 'review_type', header: 'Type', render: (a) => <span className="badge badge-purple">{a.review_type.replace('_', ' ')}</span> },
    { key: 'article_id', header: 'Article', render: (a) => <Link to={`/articles/${a.article_id}`} className="text-sm">View Article →</Link> },
    { key: 'status', header: 'Status', render: (a) => <span className={`badge badge-${REVIEW_BADGE[a.status] || 'gray'}`}>{a.status}</span> },
    { key: 'priority', header: 'Priority', render: (a) => <span className={`badge badge-${a.priority > 5 ? 'red' : a.priority > 2 ? 'yellow' : 'gray'}`}>{a.priority}</span> },
    { key: 'due_at', header: 'Due', render: (a) => a.due_at ? <span className="text-sm text-muted">{new Date(a.due_at).toLocaleDateString()}</span> : <span className="text-muted">—</span> },
    { key: 'id', header: '', render: (a) => (
      <button className="btn btn-primary btn-sm" onClick={() => { setSelectedAssignment(a); setShowReviewModal(true) }}>
        Review
      </button>
    )},
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Editorial Workflow</h2>
          <p>Review assignments, approvals, and content calendar</p>
        </div>
        <div className="card-actions">
          <button className="btn btn-primary" onClick={() => setShowAssignmentForm(true)}>+ New Assignment</button>
          <button className="btn btn-outline" onClick={() => setShowCalendarForm(true)}>+ Calendar Entry</button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
              {tab.badge ? <span className="badge badge-red" style={{ marginLeft: 6 }}>{tab.badge}</span> : null}
            </button>
          ))}
        </div>

        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <Card>
            <CardHeader>Pending Review Assignments</CardHeader>
            <CardBody padding={false}>
              <DataTable
                columns={assignmentColumns}
                data={assignments}
                keyExtractor={(a) => a.id}
                loading={loading}
                emptyMessage="No pending assignments. All caught up!"
              />
            </CardBody>
          </Card>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="grid-2">
            <Card>
              <CardHeader>Recent Reviews</CardHeader>
              <CardBody>
                {loading ? <div className="empty-state"><div className="spinner" /></div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {assignments.filter(a => a.status === 'completed').slice(0, 10).map(a => (
                      <div key={a.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                        <div>
                          <span className="badge badge-green">completed</span>
                          <span className="text-sm" style={{ marginLeft: 8 }}>{a.review_type.replace('_', ' ')}</span>
                        </div>
                        <span className="text-sm text-muted">{new Date(a.completed_at || a.updated_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                    {assignments.filter(a => a.status === 'completed').length === 0 && (
                      <p className="text-muted text-sm">No completed reviews yet.</p>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                Comments
                {showComments && <button className="btn btn-outline btn-sm" onClick={() => setShowComments(null)}>Close</button>}
              </CardHeader>
              <CardBody>
                {showComments ? (
                  <div>
                    <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
                      {comments.map(c => (
                        <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                          <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                            <span className="text-sm font-medium">{c.author_name || 'User'}</span>
                            <span className="text-xs text-muted">{new Date(c.created_at).toLocaleString()}</span>
                            {c.resolved && <span className="badge badge-green badge-sm">Resolved</span>}
                          </div>
                          <p className="text-sm" style={{ color: 'var(--gray-700)' }}>{c.content}</p>
                        </div>
                      ))}
                      {comments.length === 0 && <p className="text-muted text-sm">No comments yet.</p>}
                    </div>
                    <div className="flex gap-2">
                      <input className="form-input" placeholder="Add a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} />
                      <button className="btn btn-primary btn-sm" onClick={addComment}>Send</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted text-sm">Select an article to view comments.</p>
                )}
              </CardBody>
            </Card>
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <Card>
            <CardHeader>Content Calendar</CardHeader>
            <CardBody padding={false}>
              {loading ? <div className="empty-state"><div className="spinner" /></div> : (
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Due Date</th>
                      <th>Publish Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarEntries.map(e => (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 500 }}>{e.title}</td>
                        <td><span className={`badge badge-${PRIORITY_BADGE[e.status === 'published' ? 'low' : e.status === 'approved' ? 'blue' : e.status === 'review' ? 'yellow' : 'gray']}`}>{e.status}</span></td>
                        <td><span className={`badge badge-${PRIORITY_BADGE[e.priority] || 'gray'}`}>{e.priority}</span></td>
                        <td className="text-sm text-muted">{e.due_date ? new Date(e.due_date).toLocaleDateString() : '—'}</td>
                        <td className="text-sm text-muted">{e.publish_date ? new Date(e.publish_date).toLocaleDateString() : '—'}</td>
                        <td>
                          {e.article_id && <Link to={`/articles/${e.article_id}`} className="btn btn-outline btn-sm">View</Link>}
                        </td>
                      </tr>
                    ))}
                    {calendarEntries.length === 0 && (
                      <tr><td colSpan={6}><div className="empty-state"><p>No calendar entries yet.</p></div></td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        )}

        {/* Versions Tab */}
        {activeTab === 'versions' && (
          <Card>
            <CardHeader>Content Version History</CardHeader>
            <CardBody>
              {versions.length === 0 ? (
                <div className="empty-state"><p>Select an article to view version history.</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {versions.map(v => (
                    <div key={v.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                      <div>
                        <span className="badge badge-blue">v{v.version_number}</span>
                        <span className="text-sm" style={{ marginLeft: 8 }}>{v.title}</span>
                        {v.change_summary && <p className="text-xs text-muted">{v.change_summary}</p>}
                      </div>
                      <span className="text-sm text-muted">{new Date(v.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedAssignment && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submit Review</h3>
              <span className="badge badge-purple">{selectedAssignment.review_type.replace('_', ' ')}</span>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Decision</label>
                <select className="form-select" value={reviewData.decision} onChange={e => setReviewData({ ...reviewData, decision: e.target.value })}>
                  <option value="approved">Approved</option>
                  <option value="revision_requested">Revision Requested</option>
                  <option value="rejected">Rejected</option>
                  <option value="needs_fact_check">Needs Fact Check</option>
                </select>
              </div>
              <div className="form-group">
                <label>Score (0-100)</label>
                <input className="form-input" type="number" min={0} max={100} value={reviewData.score} onChange={e => setReviewData({ ...reviewData, score: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Comments</label>
                <textarea className="form-textarea" rows={3} value={reviewData.comments} onChange={e => setReviewData({ ...reviewData, comments: e.target.value })} placeholder="Add your review comments..." />
              </div>
              <div className="form-group">
                <label>Suggestions (one per line)</label>
                <textarea className="form-textarea" rows={3} value={reviewData.suggestions} onChange={e => setReviewData({ ...reviewData, suggestions: e.target.value })} placeholder="Enter improvement suggestions..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowReviewModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitReview}>Submit Review</button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Form Modal */}
      {showAssignmentForm && (
        <div className="modal-overlay" onClick={() => setShowAssignmentForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>New Review Assignment</h3></div>
            <div className="modal-body">
              <div className="form-group"><label>Article ID</label><input className="form-input" value={assignmentForm.article_id} onChange={e => setAssignmentForm({ ...assignmentForm, article_id: e.target.value })} placeholder="Article ID" /></div>
              <div className="form-group"><label>Reviewer ID</label><input className="form-input" value={assignmentForm.reviewer_id} onChange={e => setAssignmentForm({ ...assignmentForm, reviewer_id: e.target.value })} placeholder="User ID" /></div>
              <div className="form-group">
                <label>Review Type</label>
                <select className="form-select" value={assignmentForm.review_type} onChange={e => setAssignmentForm({ ...assignmentForm, review_type: e.target.value as any })}>
                  <option value="seo_review">SEO Review</option>
                  <option value="editor_review">Editor Review</option>
                  <option value="fact_check">Fact Check</option>
                  <option value="final_approval">Final Approval</option>
                </select>
              </div>
              <div className="form-group"><label>Priority</label><input className="form-input" type="number" value={assignmentForm.priority} onChange={e => setAssignmentForm({ ...assignmentForm, priority: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAssignmentForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createAssignment}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Form Modal */}
      {showCalendarForm && (
        <div className="modal-overlay" onClick={() => setShowCalendarForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>New Calendar Entry</h3></div>
            <div className="modal-body">
              <div className="form-group"><label>Title</label><input className="form-input" value={calendarForm.title} onChange={e => setCalendarForm({ ...calendarForm, title: e.target.value })} placeholder="Article title" /></div>
              <div className="form-group"><label>Keyword</label><input className="form-input" value={calendarForm.keyword} onChange={e => setCalendarForm({ ...calendarForm, keyword: e.target.value })} placeholder="Target keyword" /></div>
              <div className="form-row">
                <div className="form-group"><label>Status</label><select className="form-select" value={calendarForm.status} onChange={e => setCalendarForm({ ...calendarForm, status: e.target.value as any })}><option value="planned">Planned</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="approved">Approved</option><option value="published">Published</option></select></div>
                <div className="form-group"><label>Priority</label><select className="form-select" value={calendarForm.priority} onChange={e => setCalendarForm({ ...calendarForm, priority: e.target.value as any })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Due Date</label><input className="form-input" type="date" value={calendarForm.due_date} onChange={e => setCalendarForm({ ...calendarForm, due_date: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>Notes</label><textarea className="form-textarea" rows={3} value={calendarForm.notes} onChange={e => setCalendarForm({ ...calendarForm, notes: e.target.value })} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowCalendarForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createCalendarEntry}>Create</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
