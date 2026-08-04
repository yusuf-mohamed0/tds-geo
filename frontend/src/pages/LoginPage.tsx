import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const params = new URLSearchParams(window.location.search);
      navigate(params.get('redirect') || '/admin');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <img src="/assets/White%20Swype.png" alt="Swype" className="h-10 w-auto object-contain" />
          <h1 className="text-2xl font-bold text-brand-text mt-3">TDS Geo</h1>
          <p className="text-brand-muted mt-1">Sign in to your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-brand-text mb-1.5">Email</label>
            <input
              aria-label="Email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-text mb-1.5">Password</label>
            <input
              aria-label="Password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>


        </form>
      </div>
      </main>
      <footer className="border-t border-brand-border bg-white px-4 py-3 text-xs text-brand-muted flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>TDS Geo</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a href="/documentation" className="inline-block transition-all hover:-translate-y-0.5 hover:text-brand-accent" target="_blank" rel="noopener noreferrer">Docs</a>
          <a href="/tutorial" className="inline-block transition-all hover:-translate-y-0.5 hover:text-brand-accent" target="_blank" rel="noopener noreferrer">Tutorial</a>
          <a href="/faq" className="inline-block transition-all hover:-translate-y-0.5 hover:text-brand-accent" target="_blank" rel="noopener noreferrer">FAQ</a>
          <a href="/changelog" className="inline-block transition-all hover:-translate-y-0.5 hover:text-brand-accent" target="_blank" rel="noopener noreferrer">Changelog</a>
          <a href="/privacy" className="inline-block transition-all hover:-translate-y-0.5 hover:text-brand-accent" target="_blank" rel="noopener noreferrer">Privacy</a>
        </div>
      </footer>
    </div>
  );
}
