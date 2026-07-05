import { apiFetch } from './client';
import type { User } from '../types';

interface LoginResponse {
  token: string;
  user: User;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe(): Promise<User> {
  return apiFetch<User>('/api/auth/me');
}
