import { Badge } from '@shopify/polaris';

interface StatusBadgeProps {
  status: string;
}

const toneMap: Record<string, 'success' | 'info' | 'warning' | 'critical' | 'attention' | 'new'> = {
  published: 'success',
  approved: 'info',
  generated: 'warning',
  draft: 'attention',
  rejected: 'critical',
  active: 'success',
  pending: 'warning',
  error: 'critical',
  healthy: 'success',
  degraded: 'warning',
  down: 'critical',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const tone = toneMap[status.toLowerCase()] || 'attention';
  return <Badge tone={tone}>{status}</Badge>;
}
