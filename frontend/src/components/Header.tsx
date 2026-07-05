import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const avatarColors = ['#818CF8', '#34D399', '#F472B6', '#FBBF24', '#60A5FA', '#A78BFA'];

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function Header() {
  const { user, logout } = useAuth();
  const initials = (user?.name || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <header className="h-14 border-b border-brand-border flex items-center justify-between px-6 bg-brand-surface">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-brand-muted">{user?.name || user?.email}</span>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${stringToColor(user?.email || '')}20`, color: stringToColor(user?.email || '') }}
          >
            {initials}
          </div>
          <button onClick={logout} className="btn-ghost p-1.5 rounded-lg" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
