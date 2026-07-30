import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; positive: boolean };
  color?: string;
  to?: string;
  onClick?: () => void;
}

const waveSvg = (
  <svg className="absolute top-0 right-0 w-32 h-24 opacity-[0.04]" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 80C40 40 60 100 100 60C140 20 160 80 200 40V120H0V80Z" fill="currentColor" />
  </svg>
);

export default function MetricCard({ icon, label, value, subtitle, trend, color = '#FCB900', to, onClick }: MetricCardProps) {
  const interactive = Boolean(to || onClick);
  const card = (
    <div className={`relative card overflow-hidden${interactive ? ' group cursor-pointer transition-all duration-300 hover:border-opacity-50 hover:shadow-lg hover:shadow-black/20' : ''}`}>
      {waveSvg}
      <div className="flex items-start justify-between relative z-10">
        <div
          className="p-2.5 rounded-xl"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trend.positive ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            <svg className={`w-3 h-3 ${trend.positive ? '' : 'rotate-180'}`} viewBox="0 0 10 6" fill="none">
              <path d="M5 0L10 6H0L5 0Z" fill="currentColor" />
            </svg>
            {trend.positive ? '+' : ''}{trend.value}%
          </div>
        )}
      </div>
      <div className="mt-4 relative z-10">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        <p className="text-sm text-brand-muted mt-0.5 font-medium">{label}</p>
        {subtitle && <p className="text-xs text-brand-muted/70 mt-1.5 border-t border-brand-border/50 pt-1.5">{subtitle}</p>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-30" style={{ backgroundColor: color }} />
    </div>
  );

  if (!interactive) return card;

  if (to) return (
    <Link to={to} aria-label={`View ${label}`} className="block text-inherit no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
      {card}
    </Link>
  );

  return (
    <button type="button" onClick={onClick} aria-label={`View ${label}`} className="block w-full border-0 bg-transparent p-0 text-left text-inherit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
      {card}
    </button>
  );
}
