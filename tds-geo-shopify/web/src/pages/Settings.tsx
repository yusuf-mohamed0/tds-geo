import React, { useState } from 'react';

interface Props {
  shop: string;
  token: string;
  onTokenChange: (token: string) => void;
}

export default function Settings({ shop, token, onTokenChange }: Props) {
  const [tdsApiKey, setTdsApiKey] = useState('');
  const [tdsApiUrl, setTdsApiUrl] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('tds_geo_shopify_api_key', tdsApiKey);
    localStorage.setItem('tds_geo_shopify_api_url', tdsApiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="tds-page">
      <div className="tds-card" style={{ maxWidth: 600 }}>
        <div className="tds-card-header"><h2>Connection Settings</h2></div>

        <div className="tds-section">
          <div className="tds-section-header">Shopify Connection</div>
          <div className="tds-field">
            <label>Store Domain</label>
            <input type="text" value={shop || 'Not connected'} readOnly disabled />
          </div>
          <div className="tds-field">
            <label>Access Token</label>
            <input type="password" value={token ? '••••••••••••••••' : ''} readOnly disabled />
            <div className="tds-desc">Token is provided automatically after OAuth installation.</div>
          </div>
        </div>

        <div className="tds-section">
          <div className="tds-section-header">TDS Geo Backend</div>
          <div className="tds-field">
            <label>API URL</label>
            <input
              type="url"
              value={tdsApiUrl}
              onChange={e => setTdsApiUrl(e.target.value)}
              placeholder="https://your-tds-geo-instance.com"
            />
          </div>
          <div className="tds-field">
            <label>API Key</label>
            <input
              type="password"
              value={tdsApiKey}
              onChange={e => setTdsApiKey(e.target.value)}
              placeholder="Enter your TDS Geo API key"
            />
            <div className="tds-desc">
              Generate an API key from your TDS Geo dashboard → API Keys.
            </div>
          </div>
        </div>

        <button className="tds-btn tds-btn-primary" onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>

      <div className="tds-card" style={{ maxWidth: 600, marginTop: 16 }}>
        <div className="tds-card-header"><h2>How to Connect</h2></div>
        <ol className="tds-steps">
          <li><strong>Install</strong> — Install this app on your Shopify store via OAuth.</li>
          <li><strong>Get API Key</strong> — In your TDS Geo dashboard, go to CMS Connections → Add Shopify.</li>
          <li><strong>Configure</strong> — Enter the TDS Geo API URL and key above.</li>
          <li><strong>Publish</strong> — TDS Geo will generate and publish SEO-optimized articles to your store.</li>
        </ol>
      </div>
    </div>
  );
}
