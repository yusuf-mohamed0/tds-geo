import { useSearchParams, Link } from 'react-router-dom';

export default function ShopifySuccess() {
  const [params] = useSearchParams();
  const shop = params.get('shop') || '';
  const name = params.get('name') || shop.replace('.myshopify.com', '');

  return (
    <div style={{ maxWidth: 500, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
      <h1 style={{ color: '#FCB900', fontSize: 24, margin: '0 0 8px' }}>Connected!</h1>
      <p style={{ color: '#FCF6F2', fontSize: 16, marginBottom: 4 }}>
        <strong>{name}</strong>
      </p>
      <p style={{ color: '#838081', fontSize: 14, marginBottom: 24 }}>
        {shop} — ready to generate and publish articles.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <Link to="/articles"
          style={{ padding: '10px 24px', background: '#FCB900', color: '#171414', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
          Go to Articles
        </Link>
        <Link to="/clients"
          style={{ padding: '10px 24px', background: '#333', color: '#FCF6F2', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
          View Clients
        </Link>
      </div>
    </div>
  );
}
