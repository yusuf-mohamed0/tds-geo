import { useState, useEffect } from 'react'

export default function ClientLogs() {
  const [filter, setFilter] = useState('all')
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    const dummyLogs = [
      { level: 'info', service: 'shopify', message: 'Article published successfully to traffic-test.myshopify.com', time: '2026-06-21 13:30:00' },
      { level: 'info', service: 'core', message: 'New article generated: "Home Maintenance Tips"', time: '2026-06-21 13:25:00' },
      { level: 'success', service: 'shopify', message: 'CMS connection verified for traffic-test.myshopify.com', time: '2026-06-21 13:20:00' },
      { level: 'info', service: 'core', message: 'Pipeline completed: article batch #42', time: '2026-06-21 13:15:00' },
      { level: 'warning', service: 'shopify', message: 'Rate limit approaching for API calls', time: '2026-06-21 13:10:00' },
      { level: 'info', service: 'core', message: 'SEO analysis completed for 5 articles', time: '2026-06-21 13:05:00' },
      { level: 'info', service: 'core', message: 'Article queued for generation', time: '2026-06-21 13:00:00' },
    ]
    setLogs(dummyLogs)
  }, [])

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter)

  const levelTag = (level: string) => {
    const map: Record<string, string> = {
      info: 'tds-tag-blue',
      success: 'tds-tag-green',
      warning: 'tds-tag-yellow',
      error: 'tds-tag-red',
    }
    return map[level] || 'tds-tag-blue'
  }

  return (
    <div className="tds-fade">
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
        {['all', 'info', 'success', 'warning', 'error'].map(f => (
          <button key={f} className={`tds-btn tds-btn-sm ${filter === f ? 'tds-btn-primary' : 'tds-btn-secondary'}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <button className="tds-btn tds-btn-danger tds-btn-sm">Clear All</button>
        </div>
      </div>

      <div className="tds-card">
        <div className="tds-table-wrap">
          <table className="tds-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Service</th>
                <th>Message</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4}><div className="tds-empty">No log entries found.</div></td></tr>
              ) : filtered.map((log, i) => (
                <tr key={i}>
                  <td><span className={`tds-tag ${levelTag(log.level)}`}>{log.level}</span></td>
                  <td style={{ color: 'var(--tds-text-secondary)', fontSize: '12px' }}>{log.service}</td>
                  <td>{log.message}</td>
                  <td className="tds-text-mono">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
