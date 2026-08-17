import type { User } from '../types';

export function clientWorkspacePath(user: User): string | null {
  if (user.role !== 'client' || !user.clientId) return null;
  return `/admin/clients/${user.clientId}`;
}

export function redirectPathForWorkspace(user: User | null, pathname: string): string | null {
  if (!user) return null;

  const clientPath = clientWorkspacePath(user);
  if (!clientPath) return null;

  if (pathname === clientPath) return null;
  return clientPath;
}
