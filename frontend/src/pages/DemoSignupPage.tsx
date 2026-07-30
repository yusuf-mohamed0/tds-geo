import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { signupDemo } from '../api/demo';

export default function DemoSignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signupDemo({ email, name, password, company: company || undefined });
      setSuccess(true);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('already exists')) {
        setError('An account with this name or email already exists. Please try a different name or sign in.');
      } else if (msg.includes('Password must be at least')) {
        setError('Password must be at least 8 characters.');
      } else if (msg.toLowerCase().includes('validation')) {
        setError(msg);
      } else {
        setError(msg || 'Failed to create demo account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-bg">
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm text-center">
            <div className="mb-8 flex flex-col items-center">
              <img src="/assets/White%20Swype.png" alt="Swype" className="h-10 w-auto object-contain" />
              <h1 className="text-2xl font-bold text-brand-text mt-3">TDS Geo</h1>
            </div>
            <div className="card p-8 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#FCB900]/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-[#FCB900]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-brand-text">Demo account created!</h2>
              <p className="text-brand-muted text-sm leading-relaxed">
                Your free trial is ready. Sign in to start exploring TDS Geo with your demo dashboard.
              </p>
              <Link
                to="/login"
                className="btn-primary w-full inline-flex items-center justify-center py-2.5 mt-2"
              >
                Sign in to dashboard
              </Link>
            </div>
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

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8 flex flex-col items-center">
            <img src="/assets/White%20Swype.png" alt="Swype" className="h-10 w-auto object-contain" />
            <h1 className="text-2xl font-bold text-brand-text mt-3">TDS Geo</h1>
            <p className="text-brand-muted mt-1">Start your free 14-day trial</p>
          </div>

          <form onSubmit={handleSubmit} className="card space-y-4">
            {error && (
              <div className="border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Name</label>
              <input
                type="text"
                className="input w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Email</label>
              <input
                type="email"
                className="input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Password</label>
              <input
                type="password"
                className="input w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">
                Company <span className="text-brand-muted font-normal">(optional)</span>
              </label>
              <input
                type="text"
                className="input w-full"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Your company name"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account...' : 'Start Free Trial'}
            </button>

            <p className="text-xs text-brand-muted text-center pt-1">
              Already have an account?{' '}
              <Link to="/login" className="text-[#FCB900] hover:underline">
                Sign in
              </Link>
            </p>
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
