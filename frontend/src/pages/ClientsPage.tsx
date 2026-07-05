import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';

interface Client {
  id: string;
  name: string;
  domain?: string;
  status: string;
  createdAt: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<{ data: Client[] }>('/api/clients')
      .then((res) => setClients(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Clients</h2>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full" />
        </div>
      ) : clients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => navigate(`/clients/${client.id}`)}
              className="card text-left hover:border-brand-accent/50 transition-colors"
            >
              <h3 className="font-semibold">{client.name}</h3>
              {client.domain && <p className="text-sm text-brand-muted mt-1">{client.domain}</p>}
              <p className="text-xs text-brand-muted mt-2">
                Created {new Date(client.createdAt).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12 text-brand-muted">No clients found.</div>
      )}
    </div>
  );
}
