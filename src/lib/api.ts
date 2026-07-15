import { getToken, removeToken, maybeRefresh, refreshToken } from './auth';
import type { ApiResponse, ApiError } from './types';
// API base: same-origin by default (Node backend proxied at /api, or Worker
// serving both SPA + /api under one domain). Set VITE_API_BASE to point the
// frontend at a separately-hosted backend (e.g. Worker on another domain).
const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // Proactively renew the token if it is inside the refresh window (see
  // auth.ts). This is the primary keep-alive: as long as requests keep
  // flowing, the session never reaches expiry. Expired tokens (outside the
  // window) are left for the 401 fallback below.
  await maybeRefresh();

  const token = getToken();
  // Only attach a body (and the JSON content-type) when there IS a body.
  // Fastify rejects a request that declares Content-Type: application/json but
  // sends an empty body (FST_ERR_CTP_EMPTY_JSON_BODY -> 400), which would break
  // every bodyless DELETE / GET. So GET/DELETE with no body send no body and no
  // content-type at all.
  const hasBody = body !== undefined;
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const doFetch = (authHeader?: string) =>
    fetch(`${BASE}${path}`, {
      method,
      headers: authHeader ? { ...headers, Authorization: `Bearer ${authHeader}` } : headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch();

  if (res.status === 401) {
    // Last-resort recovery: try a single refresh, then replay the original
    // request with the new token. This covers the narrow race where the token
    // expired between the maybeRefresh() check above and this request. If
    // refresh also fails (token truly dead, e.g. JWT_SECRET rotated), fall
    // through to clearing the token and reloading to the login screen — same
    // UX as before, so no behavior regression.
    const newToken = await refreshToken();
    if (newToken) {
      res = await doFetch(newToken);
      if (res.status !== 401) {
        const retryJson: ApiResponse<T> | ApiError = await res.json();
        if (!retryJson.ok) throw new Error((retryJson as ApiError).error || 'Request failed');
        return (retryJson as ApiResponse<T>).data;
      }
    }
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