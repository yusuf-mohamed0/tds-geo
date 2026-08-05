import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Card, Text, Banner, SkeletonPage, SkeletonBodyText } from '@shopify/polaris';
import { Store, ArrowRight } from 'lucide-react';
import { apiFetch } from '../api/client';

interface Client {
  id: string;
  name: string;
  domain?: string;
  status: string;
  created_at: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<{ clients: Client[] }>('/api/clients')
      .then((res) => setClients(res.clients || []))
      .catch(() => setError('Failed to load clients'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SkeletonPage title="Clients">
        <SkeletonBodyText lines={6} />
      </SkeletonPage>
    );
  }

  if (error) {
    return (
      <Page title="Clients" subtitle="Manage your connected clients and stores">
        <Banner tone="critical">{error}</Banner>
      </Page>
    );
  }

  return (
    <Page title="Clients" subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''} connected`}>
      {clients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map((client) => (
            <button
              type="button"
              key={client.id}
              onClick={() => navigate(`/admin/clients/${client.id}`)}
              className="card text-left hover:border-brand-accent/40 transition-all duration-200 group relative overflow-hidden"
              style={{ cursor: 'pointer', border: '1px solid var(--p-color-border)', borderRadius: 'var(--p-space-300)', background: 'var(--p-color-bg-surface)', padding: 'var(--p-space-500)', width: '100%' }}
            >
              <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', width: 'fit-content' }}>
                <Store size={20} />
              </div>
              <div style={{ marginTop: 'var(--p-space-400)' }}><Text as="h3" variant="headingMd" fontWeight="semibold">{client.name}</Text></div>
              {client.domain && <div style={{ marginTop: 'var(--p-space-100)' }}><Text as="p" variant="bodySm" tone="subdued">{client.domain}</Text></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--p-space-400)', paddingTop: 'var(--p-space-300)', borderTop: '1px solid var(--p-color-border-secondary)' }}>
                <Text as="span" variant="bodyXs" tone="subdued">{new Date(client.created_at).toLocaleDateString()}</Text>
                <ArrowRight size={14} style={{ color: 'var(--p-color-text-secondary)', opacity: 0 }} className="group-hover:opacity-100" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
            <div style={{ opacity: 0.4, marginBottom: 'var(--p-space-400)' }}>
              <Store size={40} style={{ margin: '0 auto' }} />
            </div>
            <Text as="p" variant="bodyMd" tone="subdued">No clients found</Text>
          </div>
        </Card>
      )}
    </Page>
  );
}
