import { useState, useEffect } from 'react'
import { brandVoiceApi, clientsApi } from '../services/api'
import { BrandVoiceProfile, BrandConsistencyResult, WritingFingerprint } from '../types'
import { Card, CardHeader, CardBody } from '../components/Card'
import { useToast } from '../components/Toast'
import { SelectField } from '../components/FormField'

export default function BrandVoice() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [profile, setProfile] = useState<BrandVoiceProfile | null>(null)
  const [consistencyResult, setConsistencyResult] = useState<BrandConsistencyResult | null>(null)
  const [fingerprint, setFingerprint] = useState<WritingFingerprint | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'profile' | 'consistency' | 'fingerprint'>('profile')
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [testContent, setTestContent] = useState('')
  const [checkingConsistency, setCheckingConsistency] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    clientsApi.list().then(data => {
      const list = data.clients || data.data || []
      setClients(list)
      if (list.length > 0) setSelectedClientId(list[0].id)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedClientId) return
    setLoading(true)
    Promise.all([
      brandVoiceApi.getProfile(selectedClientId).then(r => { if (r.data) setProfile(r.data) }).catch(() => {}),
      brandVoiceApi.getFingerprint(selectedClientId).then(r => { if (r.data) setFingerprint(r.data) }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [selectedClientId])

  const handleSave = async () => {
    try {
      const result = await brandVoiceApi.updateProfile(selectedClientId, editForm)
      setProfile(result.data)
      setEditMode(false)
      addToast('success', 'Brand voice profile updated')
    } catch { addToast('error', 'Failed to update profile') }
  }

  const checkConsistency = async () => {
    if (!testContent.trim()) return
    setCheckingConsistency(true)
    try {
      const result = await brandVoiceApi.checkConsistency(selectedClientId, testContent)
      setConsistencyResult(result.data)
      addToast('success', 'Consistency check complete')
    } catch { addToast('error', 'Failed to check consistency') }
    finally { setCheckingConsistency(false) }
  }

  const startEdit = () => {
    if (profile) {
      setEditForm({
        tone_profile: { ...profile.tone_profile },
        vocabulary_profile: { ...profile.vocabulary_profile, preferred_terms: { ...profile.vocabulary_profile.preferred_terms } },
        audience_profile: { ...profile.audience_profile },
        formatting_preferences: { ...profile.formatting_preferences },
        cta_style: profile.cta_style,
        forbidden_phrases: profile.forbidden_phrases,
      })
    } else {
      setEditForm({
        tone_profile: { primary: 'professional', secondary: 'educational', formality: 70, enthusiasm: 60, empathy: 50 },
        vocabulary_profile: { preferred_terms: {}, avoided_terms: [], industry_jargon: [], power_words: [] },
        audience_profile: { demographics: {}, pain_points: [], desires: [], reading_level: 'intermediate' },
        formatting_preferences: { heading_style: 'hierarchical', paragraph_length: 'medium', use_bullets: true, use_emphasis: true, image_style: 'professional' },
        cta_style: 'direct',
        forbidden_phrases: [],
      })
    }
    setEditMode(true)
  }

  const tabs = [
    { id: 'profile' as const, label: 'Brand Profile' },
    { id: 'consistency' as const, label: 'Consistency Check' },
    { id: 'fingerprint' as const, label: 'Writing Fingerprint' },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Brand Voice</h2>
          <p>Manage brand voice profiles and consistency</p>
        </div>
        {!editMode && <button className="btn btn-primary" onClick={startEdit}>{profile ? 'Edit Profile' : 'Create Profile'}</button>}
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 400, marginBottom: 20 }}>
          <SelectField label="Client" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
            options={clients.map(c => ({ value: c.id, label: c.name }))} placeholder="Select a client..." />
        </div>

        <div className="tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {!selectedClientId ? (
          <Card><CardBody><div className="empty-state"><p>Select a client to view brand voice.</p></div></CardBody></Card>
        ) : loading ? (
          <Card><CardBody><div className="empty-state"><div className="spinner" /></div></CardBody></Card>
        ) : activeTab === 'profile' && (
          editMode ? (
            <Card>
              <CardHeader>Edit Brand Voice Profile</CardHeader>
              <CardBody>
                <h4 style={{ marginBottom: 12 }}>Tone Profile</h4>
                <div className="form-row">
                  <div className="form-group"><label>Primary Tone</label><input className="form-input" value={editForm.tone_profile?.primary || ''} onChange={e => setEditForm({ ...editForm, tone_profile: { ...editForm.tone_profile, primary: e.target.value } })} /></div>
                  <div className="form-group"><label>Secondary Tone</label><input className="form-input" value={editForm.tone_profile?.secondary || ''} onChange={e => setEditForm({ ...editForm, tone_profile: { ...editForm.tone_profile, secondary: e.target.value } })} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Formality (0-100)</label><input className="form-input" type="number" min={0} max={100} value={editForm.tone_profile?.formality || 50} onChange={e => setEditForm({ ...editForm, tone_profile: { ...editForm.tone_profile, formality: parseInt(e.target.value) || 0 } })} /></div>
                  <div className="form-group"><label>Enthusiasm (0-100)</label><input className="form-input" type="number" min={0} max={100} value={editForm.tone_profile?.enthusiasm || 50} onChange={e => setEditForm({ ...editForm, tone_profile: { ...editForm.tone_profile, enthusiasm: parseInt(e.target.value) || 0 } })} /></div>
                </div>
                <div className="form-group"><label>CTA Style</label><input className="form-input" value={editForm.cta_style || ''} onChange={e => setEditForm({ ...editForm, cta_style: e.target.value })} /></div>
                <h4 style={{ margin: '16px 0 12px' }}>Formatting Preferences</h4>
                <div className="form-row">
                  <div className="form-group"><label>Heading Style</label><select className="form-select" value={editForm.formatting_preferences?.heading_style || 'hierarchical'} onChange={e => setEditForm({ ...editForm, formatting_preferences: { ...editForm.formatting_preferences, heading_style: e.target.value } })}><option value="hierarchical">Hierarchical</option><option value="flat">Flat</option><option value="question-based">Question-based</option></select></div>
                  <div className="form-group"><label>Paragraph Length</label><select className="form-select" value={editForm.formatting_preferences?.paragraph_length || 'medium'} onChange={e => setEditForm({ ...editForm, formatting_preferences: { ...editForm.formatting_preferences, paragraph_length: e.target.value } })}><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select></div>
                </div>
                <div className="flex gap-4" style={{ marginTop: 20 }}>
                  <button className="btn btn-primary" onClick={handleSave}>Save Profile</button>
                  <button className="btn btn-outline" onClick={() => setEditMode(false)}>Cancel</button>
                </div>
              </CardBody>
            </Card>
          ) : profile ? (
            <div className="grid-2">
              <Card>
                <CardHeader>Tone Profile</CardHeader>
                <CardBody>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div><strong>Primary:</strong> {profile.tone_profile.primary}</div>
                    <div><strong>Secondary:</strong> {profile.tone_profile.secondary}</div>
                    <div><strong>Formality:</strong> <ScoreBar value={profile.tone_profile.formality} /></div>
                    <div><strong>Enthusiasm:</strong> <ScoreBar value={profile.tone_profile.enthusiasm} /></div>
                    <div><strong>Empathy:</strong> <ScoreBar value={profile.tone_profile.empathy} /></div>
                    <div><strong>CTA Style:</strong> {profile.cta_style}</div>
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader>Formatting Preferences</CardHeader>
                <CardBody>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div><strong>Heading Style:</strong> {profile.formatting_preferences.heading_style}</div>
                    <div><strong>Paragraph Length:</strong> {profile.formatting_preferences.paragraph_length}</div>
                    <div><strong>Use Bullets:</strong> {profile.formatting_preferences.use_bullets ? '✅' : '❌'}</div>
                    <div><strong>Use Emphasis:</strong> {profile.formatting_preferences.use_emphasis ? '✅' : '❌'}</div>
                    <div><strong>Image Style:</strong> {profile.formatting_preferences.image_style}</div>
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader>Audience Profile</CardHeader>
                <CardBody>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div><strong>Reading Level:</strong> {profile.audience_profile.reading_level}</div>
                    <div><strong>Pain Points:</strong> {profile.audience_profile.pain_points?.join(', ') || '—'}</div>
                    <div><strong>Desires:</strong> {profile.audience_profile.desires?.join(', ') || '—'}</div>
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader>Vocabulary</CardHeader>
                <CardBody>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {profile.forbidden_phrases?.length > 0 && <div><strong>Forbidden Phrases:</strong> {profile.forbidden_phrases.join(', ')}</div>}
                    {profile.vocabulary_profile?.avoided_terms?.length > 0 && <div><strong>Avoided Terms:</strong> {profile.vocabulary_profile.avoided_terms.join(', ')}</div>}
                    {profile.vocabulary_profile?.industry_jargon?.length > 0 && <div><strong>Industry Jargon:</strong> {profile.vocabulary_profile.industry_jargon.join(', ')}</div>}
                    {Object.keys(profile.preferred_terminology || {}).length > 0 && (
                      <div><strong>Preferred Terminology:</strong><pre className="code-block" style={{ marginTop: 4 }}>{JSON.stringify(profile.preferred_terminology, null, 2)}</pre></div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : (
            <Card><CardBody><div className="empty-state"><p>No brand voice profile configured yet.</p></div></CardBody></Card>
          )
        )}

        {/* Consistency Check Tab */}
        {activeTab === 'consistency' && selectedClientId && (
          <div>
            <Card>
              <CardHeader>Check Brand Consistency</CardHeader>
              <CardBody>
                <div className="form-group">
                  <label>Content to Check</label>
                  <textarea className="form-textarea" rows={6} value={testContent} onChange={e => setTestContent(e.target.value)} placeholder="Paste content to check against brand voice..." />
                </div>
                <button className="btn btn-primary" onClick={checkConsistency} disabled={!testContent.trim() || checkingConsistency}>
                  {checkingConsistency ? '⏳ Checking...' : 'Check Consistency'}
                </button>
              </CardBody>
            </Card>

            {consistencyResult && (
              <Card style={{ marginTop: 16 }}>
                <CardHeader>
                  Consistency Results
                  <span className={`badge badge-${consistencyResult.score >= 70 ? 'green' : consistencyResult.score >= 50 ? 'yellow' : 'red'}`}>
                    Score: {consistencyResult.score}/100
                  </span>
                </CardHeader>
                <CardBody>
                  <div className="stats-grid" style={{ marginBottom: 16 }}>
                    <div className="stat-card"><div className="stat-icon purple">🎯</div><div><div className="stat-value">{consistencyResult.tone_match}%</div><div className="stat-label">Tone Match</div></div></div>
                    <div className="stat-card"><div className="stat-icon blue">📖</div><div><div className="stat-value">{consistencyResult.vocabulary_match}%</div><div className="stat-label">Vocabulary Match</div></div></div>
                    <div className="stat-card"><div className="stat-icon green">✨</div><div><div className="stat-value">{consistencyResult.format_match}%</div><div className="stat-label">Format Match</div></div></div>
                  </div>
                  {consistencyResult.issues?.length > 0 && (
                    <div>
                      <h4 style={{ marginBottom: 8, color: 'var(--danger)' }}>Issues Found</h4>
                      {consistencyResult.issues.map((issue, i) => (
                        <div key={i} style={{ padding: '8px 12px', marginBottom: 8, borderLeft: `4px solid ${issue.severity === 'high' ? 'var(--danger)' : issue.severity === 'medium' ? 'var(--warning)' : 'var(--primary)'}`, background: 'var(--gray-50)', borderRadius: 4 }}>
                          <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                            <span className={`badge badge-${issue.severity === 'high' ? 'red' : issue.severity === 'medium' ? 'yellow' : 'blue'} badge-sm`}>{issue.severity}</span>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{issue.type}</span>
                          </div>
                          <p className="text-sm">{issue.message}</p>
                          {issue.suggestion && <p className="text-sm text-muted" style={{ marginTop: 4 }}>💡 {issue.suggestion}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        )}

        {/* Fingerprint Tab */}
        {activeTab === 'fingerprint' && selectedClientId && (
          <Card>
            <CardHeader>Writing Fingerprint Analysis</CardHeader>
            <CardBody>
              {fingerprint ? (
                <div className="grid-3">
                  <div className="stat-card"><div className="stat-icon blue">📏</div><div><div className="stat-value">{fingerprint.avg_sentence_length?.toFixed(1)}</div><div className="stat-label">Avg Sentence Length</div></div></div>
                  <div className="stat-card"><div className="stat-icon purple">📚</div><div><div className="stat-value">{fingerprint.vocabulary_richness?.toFixed(2)}</div><div className="stat-label">Vocabulary Richness</div></div></div>
                  <div className="stat-card"><div className="stat-icon yellow">🔇</div><div><div className="stat-value">{(fingerprint.passive_voice_ratio * 100).toFixed(1)}%</div><div className="stat-label">Passive Voice</div></div></div>
                  <div className="stat-card"><div className="stat-icon green">🔗</div><div><div className="stat-value">{(fingerprint.transition_word_ratio * 100).toFixed(1)}%</div><div className="stat-label">Transition Words</div></div></div>
                  <div className="stat-card"><div className="stat-icon red">📊</div><div><div className="stat-value">{fingerprint.readability_score?.toFixed(0)}</div><div className="stat-label">Readability</div></div></div>
                  <div className="stat-card"><div className="stat-icon purple">🔤</div><div><div className="stat-value">{fingerprint.common_phrases?.length || 0}</div><div className="stat-label">Common Phrases</div></div></div>
                </div>
              ) : (
                <p className="text-muted">No writing fingerprint data available yet. Generate more articles to build a fingerprint.</p>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  )
}

function ScoreBar({ value }: { value: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 80, height: 6, background: 'var(--gray-200)', borderRadius: 3, display: 'inline-block', verticalAlign: 'middle' }}>
        <span style={{ width: `${value}%`, height: '100%', background: value >= 70 ? 'var(--success)' : value >= 40 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3, display: 'block' }} />
      </span>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{value}/100</span>
    </span>
  )
}
