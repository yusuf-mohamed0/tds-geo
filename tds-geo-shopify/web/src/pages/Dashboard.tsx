import React, { useEffect, useState } from 'react';

interface Props {
  shop: string;
  token: string;
}

interface Blog {
  id: number;
  title: string;
  handle: string;
  articles_count?: number;
}

export default function Dashboard({ shop, token }: Props) {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shop || !token) {
      setLoading(false);
      return;
    }

    fetch(`/api/webhooks/blogs?shop=${shop}&token=${token}`, {
      headers: { 'x-tds-geo-api-key': 'embedded' },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setBlogs(data.data);
        else setError(data.error || 'Failed to load blogs');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [shop, token]);

  return (
    <div className="tds-page">
      <div className="tds-banner healthy">
        <span className="tds-banner-icon">✓</span>
        <span className="tds-banner-text">
          {shop ? `Connected to ${shop}` : 'Not connected — install the app on a Shopify store'}
        </span>
      </div>

      <div className="tds-grid">
        <div className="tds-stat">
          <div className="tds-stat-label">Blogs</div>
          <div className="tds-stat-value">{loading ? '…' : blogs.length}</div>
        </div>
        <div className="tds-stat">
          <div className="tds-stat-label">Articles</div>
          <div className="tds-stat-value">
            {loading ? '…' : blogs.reduce((sum, b) => sum + (b.articles_count || 0), 0)}
          </div>
        </div>
        <div className="tds-stat">
          <div className="tds-stat-label">Status</div>
          <div className="tds-stat-value" style={{ fontSize: 18 }}>
            {token ? '● Connected' : '○ Disconnected'}
          </div>
        </div>
      </div>

      {loading && <div className="tds-loading">Loading store data…</div>}
      {error && <div className="tds-notice tds-notice-error">{error}</div>}

      {blogs.length > 0 && (
        <div className="tds-card">
          <div className="tds-card-header"><h2>Blogs</h2></div>
          <div className="tds-table-wrap">
            <table className="tds-table">
              <thead>
                <tr>
                  <th>Blog Name</th>
                  <th>Handle</th>
                  <th>Articles</th>
                </tr>
              </thead>
              <tbody>
                {blogs.map(blog => (
                  <tr key={blog.id}>
                    <td>{blog.title}</td>
                    <td className="tds-text-mono">{blog.handle}</td>
                    <td>{blog.articles_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
