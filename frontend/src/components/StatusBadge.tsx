interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  published: 'badge-green',
  approved: 'badge-blue',
  generated: 'badge-yellow',
  draft: 'badge-gray',
  rejected: 'badge-red',
  active: 'badge-green',
  pending: 'badge-yellow',
  error: 'badge-red',
  healthy: 'badge-green',
  degraded: 'badge-yellow',
  down: 'badge-red',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status.toLowerCase()] || 'badge-gray';
  return <span className={style}>{status}</span>;
}
