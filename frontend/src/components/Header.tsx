import { LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 border-b border-brand-border flex items-center justify-between px-6 bg-brand-surface">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-brand-muted">
          {user?.name || user?.email}
        </span>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-border flex items-center justify-center">
            <User size={14} className="text-brand-muted" />
          </div>
          <button onClick={logout} className="btn-ghost p-1.5">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
