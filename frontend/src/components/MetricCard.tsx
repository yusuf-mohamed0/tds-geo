import type { ReactNode } from 'react';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; positive: boolean };
}

export default function MetricCard({ icon, label, value, subtitle, trend }: MetricCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg bg-brand-accent/10 text-brand-accent">
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-brand-muted mt-0.5">{label}</p>
        {subtitle && <p className="text-xs text-brand-muted mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
