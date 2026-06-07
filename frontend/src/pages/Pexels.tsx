import { useState, useEffect } from 'react'
import { pexelsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Card, CardHeader, CardBody } from '../components/Card'
import { useToast } from '../components/Toast'
import Icon from '../components/Icon'

interface CachedImage {
  id: number
  url: string
  photographer: string
  alt_text?: string
  orientation: string
}

export default function Pexels() {
  const { user } = useAuth()
  const [articleTitle, setArticleTitle] = useState('')
  const [keyword, setKeyword] = useState('')
  const [sectionsInput, setSectionsInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [images, setImages] = useState<{ featuredImage?: any; sectionImages?: any[] } | null>(null)
  const [cachedImages, setCachedImages] = useState<CachedImage[]>([])
  const [loadingCache, setLoadingCache] = useState(true)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [expandedImage, setExpandedImage] = useState<any>(null)
  const { addToast } = useToast()

  useEffect(() => {
    pexelsApi.isAvailable().then(r => setAvailable(r.available !== false)).catch(() => setAvailable(false))
    loadCache()
  }, [])

  const loadCache = async () => {
    try {
      const data = await pexelsApi.getCache(user?.client_id || '')
      setCachedImages(data.data || [])
    } catch { /* ignore */ }
    finally { setLoadingCache(false) }
  }

  const searchImages = async () => {
    if (!articleTitle.trim() || !keyword.trim()) return
    setSearching(true)
    setImages(null)
    try {
      const sections = sectionsInput.split(',').map(s => s.trim()).filter(Boolean)
      const data = await pexelsApi.findArticleImages(user?.client_id || '', articleTitle, keyword, sections.length > 0 ? sections : undefined)
      setImages(data.data || data)
      addToast('success', 'Images found!')
    } catch {
      addToast('error', 'Failed to find images. Check Pexels API key.')
    } finally {
      setSearching(false)
    }
  }

  if (available === false) {
    return (
      <>
        <div className="page-header"><div><h2>Pexels Image Library</h2><p>Stock photo integration</p></div></div>
        <div className="page-body">
          <Card><CardBody>
            <div className="alert alert-warning">Pexels API is not configured. Add a Pexels API key in Settings to enable image search.</div>
          </CardBody></Card>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Pexels Image Library</h2>
          <p>Stock photo search and attribution management</p>
        </div>
        {available && <span className="badge badge-green">API Connected</span>}
      </div>

      <div className="page-body">
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Search Panel */}
          <Card>
            <CardHeader>Search Article Images</CardHeader>
            <CardBody>
              <div className="form-group">
                <label>Article Title</label>
                <input className="form-input" value={articleTitle} onChange={e => setArticleTitle(e.target.value)} placeholder="e.g., Top 10 SEO Strategies" />
              </div>
              <div className="form-group">
                <label>Keyword</label>
                <input className="form-input" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g., SEO marketing" />
              </div>
              <div className="form-group">
                <label>Sections (optional, comma-separated)</label>
                <input className="form-input" value={sectionsInput} onChange={e => setSectionsInput(e.target.value)} placeholder="e.g., introduction, benefits, examples" />
              </div>
              <button className="btn btn-primary" onClick={searchImages} disabled={!articleTitle.trim() || !keyword.trim() || searching}>
                {searching ? <><Icon name="loading" spin /> Searching...</> : <><Icon name="pexels" /> Find Images</>}
              </button>
            </CardBody>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader>
              Search Results
              {images?.featuredImage && <span className="badge badge-green">Found</span>}
            </CardHeader>
            <CardBody>
              {searching ? (
                <div className="empty-state"><div className="spinner" /></div>
              ) : images?.featuredImage ? (
                <div>
                  <h4 style={{ fontSize: 14, marginBottom: 12 }}>Featured Image</h4>
                  <div
                    style={{
                      width: '100%', height: 200, borderRadius: 'var(--radius)', overflow: 'hidden',
                      background: `url(${images.featuredImage.url}) center/cover`, cursor: 'pointer', marginBottom: 8, position: 'relative',
                    }}
                    onClick={() => setExpandedImage(images.featuredImage)}
                  >
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 12px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', color: 'white', fontSize: 12 }}>
                      Photo by {images.featuredImage.photographer}
                    </div>
                  </div>
                  <div className="text-xs text-muted" style={{ marginBottom: 16 }}>
                    ID: {images.featuredImage.pexelsId} · {images.featuredImage.width}×{images.featuredImage.height}
                    {images.featuredImage.altText && <> · Alt: {images.featuredImage.altText}</>}
                  </div>

                  {images.sectionImages && images.sectionImages.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 14, marginBottom: 8 }}>Section Images ({images.sectionImages.length})</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {images.sectionImages.map((img, i) => (
                          <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                            <div style={{ width: 80, height: 60, borderRadius: 6, overflow: 'hidden', background: `url(${img.url}) center/cover`, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500 }}>Section: {img.section}</div>
                              <div className="text-xs text-muted">Photo by {img.photographer}</div>
                              <div className="text-xs text-muted">{img.width}×{img.height}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <p style={{ fontSize: 13 }}>Search for article images to see results here.</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Cached Images */}
        <Card style={{ marginTop: 16 }}>
          <CardHeader>
            Cached Images
            <button className="btn btn-outline btn-sm" onClick={loadCache}><Icon name="refresh" /> Refresh</button>
          </CardHeader>
          <CardBody>
            {loadingCache ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : cachedImages.length === 0 ? (
              <p className="text-muted text-sm">No cached images. Image search results will appear here automatically.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                {cachedImages.map(img => (
                  <div key={img.id} style={{ borderRadius: 'var(--radius)', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setExpandedImage(img)}>
                    <div style={{ width: '100%', height: 120, background: `url(${img.url}) center/cover` }} />
                    <div style={{ padding: '6px 8px', background: 'var(--gray-50)', fontSize: 11 }}>
                      <div className="truncate">{img.photographer}</div>
                      <div className="text-muted">{img.orientation}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Image Preview Modal */}
      {expandedImage && (
        <div className="modal-overlay" onClick={() => setExpandedImage(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3>Image Preview</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setExpandedImage(null)}>✕</button>
            </div>
            <div className="modal-body">
              <img src={expandedImage.url} alt={expandedImage.alt_text || ''} style={{ width: '100%', borderRadius: 'var(--radius)', maxHeight: 500, objectFit: 'contain' }} />
              <div style={{ marginTop: 12, fontSize: 13 }}>
                <div><strong>Photographer:</strong> {expandedImage.photographer}</div>
                {expandedImage.photographer_url && <div><strong>URL:</strong> <a href={expandedImage.photographer_url} target="_blank" rel="noopener noreferrer">{expandedImage.photographer_url}</a></div>}
                <div><strong>Dimensions:</strong> {expandedImage.width}×{expandedImage.height}</div>
                {expandedImage.alt_text && <div><strong>Alt Text:</strong> {expandedImage.alt_text}</div>}
              </div>
            </div>
            <div className="modal-footer">
              <a href={expandedImage.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open Original ↗</a>
              <button className="btn btn-outline" onClick={() => setExpandedImage(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
