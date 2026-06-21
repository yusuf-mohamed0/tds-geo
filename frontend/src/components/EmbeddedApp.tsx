import { useState, useEffect } from 'react'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '8px',
  border: '1px solid #e0e0e0',
  padding: '24px',
  marginBottom: '16px',
}

export default function EmbeddedApp() {
  const params = new URLSearchParams(window.location.search)
  const shop = params.get('shop') || ''
  const host = params.get('host') || ''

  const steps = [
    { label: 'Connect your store', status: 'done' as const, desc: 'traffic-test.myshopify.com is connected' },
    { label: 'Configure content settings', status: 'done' as const, desc: 'Default settings are active' },
    { label: 'Generate articles', status: 'todo' as const, desc: 'Visit the dashboard to create content' },
    { label: 'Review and publish', status: 'todo' as const, desc: 'Articles will appear here once generated' },
  ]

  const statusIcon = (s: 'done' | 'todo') => {
    if (s === 'done') return <span style={{ color: '#2e7d32', fontWeight: 700 }}>&#10003;</span>
    return <span style={{ color: '#bbb', fontWeight: 700 }}>&#9679;</span>
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{
        background: 'linear-gradient(135deg, #FCB900 0%, #F89D4B 100%)',
        padding: '32px 24px', marginBottom: '16px'
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#000', opacity: 0.6, marginBottom: '4px' }}>
          TDS Geo
        </div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#000' }}>
          Traffic Digital Solutions
        </div>
        {shop && (
          <div style={{ fontSize: '13px', color: '#000', opacity: 0.7, marginTop: '4px' }}>
            {shop}
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 32px' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>Getting Started</div>
              <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                Complete these steps to start publishing AI-optimized content.
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', color: '#2e7d32', fontWeight: 500
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2e7d32', display: 'inline-block' }} />
              Connected
            </div>
          </div>

          <div>
            {steps.map((step, i) => (
              <div key={i} style={{
                display: 'flex', gap: '12px', padding: '12px 0',
                borderBottom: i < steps.length - 1 ? '1px solid #f0f0f0' : 'none',
                opacity: step.status === 'done' ? 1 : 0.6
              }}>
                <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>
                  {statusIcon(step.status)}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>{step.label}</div>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>
            Quick Links
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a href={`https://admin.shopify.com/store/${shop?.split('.')[0]}`}
               target="_blank" rel="noopener noreferrer"
               style={{
                 flex: 1, padding: '10px 16px', border: '1px solid #e0e0e0', borderRadius: '8px',
                 textAlign: 'center', textDecoration: 'none', color: '#1a1a1a', fontSize: '13px',
                 fontWeight: 500, background: '#f8f8f8', minWidth: '120px'
               }}>
              Store Admin
            </a>
            <a href="https://13.48.59.201.nip.io/login"
               target="_blank" rel="noopener noreferrer"
               style={{
                 flex: 1, padding: '10px 16px', border: '1px solid #e0e0e0', borderRadius: '8px',
                 textAlign: 'center', textDecoration: 'none', color: '#1a1a1a', fontSize: '13px',
                 fontWeight: 500, background: '#f8f8f8', minWidth: '120px'
               }}>
              Full Dashboard
            </a>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '16px', fontSize: '12px', color: '#999' }}>
          TDS Geo v3.0.0 &mdash; Traffic Digital Solutions
        </div>
      </div>
    </div>
  )
}
