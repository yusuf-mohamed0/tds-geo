import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { KIVO_BRAND } from '../brand/kivo';

const avatarColors = [
  KIVO_BRAND.colors.gold,
  KIVO_BRAND.colors.sky,
  KIVO_BRAND.colors.amber,
  KIVO_BRAND.colors.peach,
  KIVO_BRAND.colors.navy,
  KIVO_BRAND.colors.graphite,
];

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

type HeaderProps = {
  onOpenSidebar: () => void;
};

export default function Header({ onOpenSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
  const initials = (user?.name || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <header className="h-14 border-b border-brand-border flex items-center justify-between px-4 bg-brand-surface sm:px-6">
      <button type="button" className="btn-ghost p-1.5 md:hidden" onClick={onOpenSidebar} aria-label="Open navigation">
        <Menu size={18} />
      </button>
      <div className="hidden md:block" />
      <div className="min-w-0 flex items-center gap-3">
        <span className="hidden max-w-[12rem] min-w-0 truncate text-sm text-brand-muted sm:block">{user?.name || user?.email}</span>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${stringToColor(user?.email || '')}20`, color: stringToColor(user?.email || '') }}
          >
            {initials}
          </div>
          <button type="button" onClick={logout} className="btn-ghost p-1.5" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
