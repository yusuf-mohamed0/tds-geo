import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText,
  DollarSign, CheckSquare, Search, ScrollText,
} from 'lucide-react';
import Logo from './Logo';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/articles', icon: FileText, label: 'Articles' },
  { to: '/geo', icon: Search, label: 'GEO Analysis' },
  { to: '/citations', icon: ScrollText, label: 'Citations' },
  { to: '/costs', icon: DollarSign, label: 'Costs' },
  { to: '/quality', icon: CheckSquare, label: 'Quality' },
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
