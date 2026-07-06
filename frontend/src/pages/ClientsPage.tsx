import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
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
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<{ clients: Client[] }>('/api/clients')
      .then((res) => setClients(res.clients || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Clients" description="Manage your connected clients and stores" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-brand-border" />
              <div className="mt-4 space-y-2">
                <div className="h-5 w-32 bg-brand-border rounded" />
                <div className="h-4 w-24 bg-brand-border rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description={`${clients.length} client${clients.length !== 1 ? 's' : ''} connected`} />

      {clients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => navigate(`/admin/clients/${client.id}`)}
              className="card text-left hover:border-brand-accent/40 transition-all duration-200 group relative overflow-hidden"
            >
              <svg className="absolute top-0 right-0 w-24 h-20 opacity-[0.03]" viewBox="0 0 200 120" fill="none">
                <path d="M0 80C40 40 60 100 100 60C140 20 160 80 200 40V120H0V80Z" fill="currentColor" />
              </svg>
              <div className="relative z-10">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 w-fit">
                  <Store size={20} />
                </div>
                <h3 className="font-semibold mt-4 group-hover:text-brand-accent transition-colors">{client.name}</h3>
                {client.domain && <p className="text-sm text-brand-muted mt-1">{client.domain}</p>}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-brand-border/50">
                  <span className="text-xs text-brand-muted/60">{new Date(client.created_at).toLocaleDateString()}</span>
                  <ChevronRight size={14} className="text-brand-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="card text-center py-16">
          <Store size={40} className="mx-auto text-brand-muted/40" />
          <p className="text-brand-muted mt-4">No clients found</p>
        </div>
      )}
    </div>
  );
}
