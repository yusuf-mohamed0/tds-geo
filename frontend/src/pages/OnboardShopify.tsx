import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function OnboardShopify() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [shop, setShop] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'testing' | 'done'>('form');
  const [clientId, setClientId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`;

    try {
      const { data } = await api.post('/clients', {
        name: name || shopDomain.replace('.myshopify.com', ''),
        shopifyShop: shopDomain,
        shopifyToken: token,
        approvalMode: 'auto',
        publishFrequency: 'weekly',
        isActive: true,
      });

      setClientId(data.id);
      setStep('testing');

      await api.post(`/clients/${data.id}/test-shopify`);

      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', padding: '0 20px' }}>
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h1 style={{ color: '#FCB900', margin: '0 0 8px' }}>Connected!</h1>
          <p style={{ color: '#FCF6F2', marginBottom: 24 }}>Store connected and ready to publish articles.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => navigate(`/articles?clientId=${clientId}`)}
              style={btnStyle}>Generate First Article</button>
            <button onClick={() => { setStep('form'); setShop(''); setToken(''); setName(''); }}
              style={{ ...btnStyle, background: '#333', color: '#FCF6F2' }}>Add Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: '0 20px' }}>
      <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 32 }}>
        <h1 style={{ color: '#FCB900', fontSize: 22, margin: '0 0 4px' }}>Add Shopify Store</h1>
        <p style={{ color: '#838081', fontSize: 14, marginBottom: 24 }}>
          Enter the store domain and the Admin API token from a Custom App.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Client Name</label>
            <input
              placeholder="e.g. Acme Co"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Shopify Store URL</label>
            <input
              placeholder="your-store.myshopify.com"
              value={shop}
              onChange={e => setShop(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Admin API Access Token</label>
            <input
              type="password"
              placeholder="shpat_..."
              value={token}
              onChange={e => setToken(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'monospace' }}
              required
            />
          </div>

          {error && (
            <div style={{ background: '#2d1a1a', color: '#ff6b6b', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ ...btnStyle, width: '100%', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Connecting...' : 'Connect Store'}
          </button>
        </form>

        <details style={{ marginTop: 24, color: '#838081', fontSize: 13 }}>
          <summary style={{ cursor: 'pointer', color: '#769ACC' }}>How to get the token?</summary>
          <ol style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Go to your client's Shopify Admin → <strong>Settings → Apps → Dev Dashboard</strong></li>
            <li>Create an app (or use existing), go to <strong>Configuration</strong></li>
            <li>Scopes: <code>read_content, write_content, read_products, write_products</code></li>
            <li>Go to <strong>API credentials</strong> → <strong>Install app</strong></li>
            <li>Copy the <strong>Admin API access token</strong> (starts with <code>shpat_</code>)</li>
            <li>Paste it above and click Connect</li>
          </ol>
        </details>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#FCB900',
  color: '#171414',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#FCF6F2',
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#2a2a2a',
  border: '1px solid #3D3B3B',
  borderRadius: 8,
  color: '#FCF6F2',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};
