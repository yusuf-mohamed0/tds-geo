import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText,
  DollarSign, CheckSquare, Search, ScrollText, Lightbulb, Link as LinkIcon, X, BarChart3,
} from 'lucide-react';
import Logo from './Logo';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/clients', icon: Users, label: 'Clients' },
  { to: '/admin/articles', icon: FileText, label: 'Articles' },
  { to: '/admin/geo', icon: Search, label: 'GEO Analysis' },
  { to: '/admin/gsc', icon: BarChart3, label: 'Search Console' },
  { to: '/admin/citations', icon: ScrollText, label: 'Citations' },
  { to: '/admin/costs', icon: DollarSign, label: 'Costs' },
  { to: '/admin/quality', icon: CheckSquare, label: 'Quality' },
  { to: '/admin/keywords', icon: Lightbulb, label: 'Keywords' },
  { to: '/admin/backlinks', icon: LinkIcon, label: 'Backlinks' },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex h-screen w-60 flex-col overflow-y-auto border-r border-brand-border bg-brand-surface transition-transform duration-200 md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between border-b border-brand-border p-5">
        <Logo showText={false} />
        <button type="button" className="btn-ghost p-1.5 md:hidden" onClick={onClose} aria-label="Close navigation">
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm transition-all hover:translate-x-1 ${
                isActive
                  ? 'bg-brand-accent/10 text-brand-accent font-medium'
                  : 'text-brand-muted hover:text-brand-text hover:bg-brand-border'
              }`
            }
            onClick={onClose}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
