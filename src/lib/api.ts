import { getToken, removeToken } from './auth';
import type { ApiResponse, ApiError } from './types';
// API base: same-origin by default (Node backend proxied at /api, or Worker
// serving both SPA + /api under one domain). Set VITE_API_BASE to point the
// frontend at a separately-hosted backend (e.g. Worker on another domain).
const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    removeToken();
    window.location.reload();
    throw new Error('Unauthorized');
  }

  const json: ApiResponse<T> | ApiError = await res.json();

  if (!json.ok) {
    throw new Error((json as ApiError).error || 'Request failed');
  }

  return (json as ApiResponse<T>).data;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
