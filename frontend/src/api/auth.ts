import { apiFetch } from './client';
import type { User } from '../types';

type ApiUser = Omit<User, 'clientId'> & { clientId?: string; client_id?: string | null };

interface LoginResponse {
  token: string;
  user: ApiUser;
}

export interface NormalizedLoginResponse {
  token: string;
  user: User;
}

function normalizeUser(user: ApiUser): User {
  const clientId = user.clientId ?? user.client_id ?? undefined;
  return { ...user, clientId };
}

export async function login(email: string, password: string): Promise<NormalizedLoginResponse> {
  const response = await apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return { ...response, user: normalizeUser(response.user) };
}

export async function fetchMe(): Promise<User> {
  return normalizeUser(await apiFetch<ApiUser>('/api/auth/me'));
}
