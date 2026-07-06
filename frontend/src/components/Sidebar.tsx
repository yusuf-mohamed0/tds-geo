import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText,
  DollarSign, CheckSquare, Search, ScrollText, Lightbulb, Link as LinkIcon,
} from 'lucide-react';
import Logo from './Logo';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/clients', icon: Users, label: 'Clients' },
  { to: '/admin/articles', icon: FileText, label: 'Articles' },
  { to: '/admin/geo', icon: Search, label: 'GEO Analysis' },
  { to: '/admin/citations', icon: ScrollText, label: 'Citations' },
  { to: '/admin/costs', icon: DollarSign, label: 'Costs' },
  { to: '/admin/quality', icon: CheckSquare, label: 'Quality' },
  { to: '/admin/keywords', icon: Lightbulb, label: 'Keywords' },
  { to: '/admin/backlinks', icon: LinkIcon, label: 'Backlinks' },
];

export default function Sidebar() {
  return (
    <aside className="w-60 h-screen bg-brand-surface border-r border-brand-border flex flex-col overflow-y-auto">
      <div className="p-5 border-b border-brand-border">
        <Logo />
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand-accent/10 text-brand-accent font-medium'
                  : 'text-brand-muted hover:text-brand-text hover:bg-brand-border'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
