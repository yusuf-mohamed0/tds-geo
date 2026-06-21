import { useSearchParams, Link } from 'react-router-dom';

const ERRORS: Record<string, string> = {
  invalid_shop: 'Invalid Shopify store URL. Use store.myshopify.com format.',
  missing_params: 'Missing OAuth parameters. Please try installing again.',
  invalid_state: 'Session expired. Please try installing again.',
  state_error: 'Verification failed. Please try again.',
  token_exchange_failed: 'Could not get access token. The app may not be properly configured.',
};

export default function ShopifyError() {
  const [params] = useSearchParams();
  const msg = params.get('msg') || 'unknown';
  const errorText = ERRORS[msg] || 'Something went wrong. Please try again.';

  return (
    <div style={{ maxWidth: 500, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
      <h1 style={{ color: '#ff6b6b', fontSize: 24, margin: '0 0 8px' }}>Connection Failed</h1>
      <p style={{ color: '#FCF6F2', fontSize: 14, marginBottom: 24 }}>{errorText}</p>
      <Link to="/clients/onboard"
        style={{ padding: '10px 24px', background: '#FCB900', color: '#171414', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
        Try Again
      </Link>
    </div>
  );
}
