import { API_BASE } from './base';

const TOKEN_KEY = 'zyes_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// Called by api.ts when a 401 survives a refresh attempt (token truly dead).
// App.svelte registers its in-place logout (clears state, shows LoginScreen)
// here so a session death doesn't force a jarring full-page reload. Falls back
// to a reload if nothing registered it yet (e.g. a 401 during initial boot).
let forceLogoutHandler: (() => void) | null = null;
export function setForceLogoutHandler(fn: (() => void) | null): void {
  forceLogoutHandler = fn;
}
export function forceLogout(): void {
  removeToken();
  if (forceLogoutHandler) forceLogoutHandler();
  else window.location.reload();
}

// ---------------------------------------------------------------------------
// Proactive JWT refresh
//
// The backend issues a long-lived JWT (JWT_EXPIRY = '30d', see server/config.ts
// and worker/src/types.ts). Without renewal the token hard-expires, and the
// next edit/save returns 401 -> the user is kicked to the login screen
// mid-edit. The /api/auth/refresh endpoint issues a fresh token, BUT it
// requires a still-valid token to call — an expired token cannot be renewed,
// only re-login. So we MUST renew *before* expiry, not after. The logic below
// does exactly that, backed by three triggers: every API request
// (maybeRefresh() in api.ts), on tab re-focus, and on a periodic timer — both
// in App.svelte — so a tab left open and idle (no requests, never hidden)
// still renews in time.
// ---------------------------------------------------------------------------

// Renew when the token has less than this long left. Generous on purpose:
// even a tab that sits open and completely idle for weeks gets picked up by
// the periodic timer well before expiry.
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// Decode the `exp` claim (seconds since epoch) from a JWT. Signature
// verification happens server-side; here we only read expiry to decide when to
// renew. Returns null for malformed tokens or ones without an exp claim.
function getTokenExpiryMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url -> base64, then pad to a multiple of 4.
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    const json = JSON.parse(atob(payload));
    if (typeof json.exp !== 'number') return null;
    return json.exp * 1000;
  } catch {
    return null;
  }
}

// Milliseconds until the current token expires, or null if there is no token /
// it can't be parsed. Negative (or zero) means already expired.
export function msUntilExpiry(): number | null {
  const token = getToken();
  if (!token) return null;
  const exp = getTokenExpiryMs(token);
  if (exp === null) return null;
  return exp - Date.now();
}

// Should we proactively renew right now? True only when a token exists, is
// still valid, AND is inside the refresh window. Already-expired tokens return
// false here — those are handled by the 401 fallback in api.ts (which will
// attempt one refresh; if the token is truly dead, refresh fails too and the
// user is sent to login).
export function shouldRefresh(): boolean {
  const ms = msUntilExpiry();
  if (ms === null) return false;
  return ms > 0 && ms < REFRESH_THRESHOLD_MS;
}

// Deduplicate concurrent refresh calls: many API requests firing at once share
// a single in-flight refresh promise so we never POST /api/auth/refresh more
// than once for the same token.
let refreshPromise: Promise<string | null> | null = null;

// Call /api/auth/refresh with the current token. On success, stores the new
// token and returns it. Returns null on any failure (network error, 401, etc.)
// — the caller decides whether to force re-login.
export async function refreshToken(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json.ok && json.data && typeof json.data.token === 'string') {
        setToken(json.data.token);
        return json.data.token as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// Proactively renew the token if it is inside the refresh window. Safe to call
// from anywhere (per-request in api.ts, on visibilitychange in App.svelte): it
// is a no-op when there is no token, the token is still healthy, or it is
// already expired.
export async function maybeRefresh(): Promise<void> {
  if (!shouldRefresh()) return;
  await refreshToken();
}