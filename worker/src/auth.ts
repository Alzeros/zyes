import { SignJWT, jwtVerify } from 'jose';

// ── Password ──────────────────────────────────────────────────────────────────
// The forker-friendly deployment model stores the login password as a plain
// Worker variable (env.ZYES_PASSWORD) — set in the Cloudflare dashboard. We
// compare directly at login time (constant-time) and never persist it to D1.
// This drops the bcrypt/PBKDF2 + meta-table machinery used by the Node
// backend, which keeps "fork + deploy" to a single variable to fill in.
export async function verifyPassword(plain: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  const a = new TextEncoder().encode(plain);
  const b = new TextEncoder().encode(stored);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── JWT via jose (Web Crypto native, Workers-compatible) ───────────────────────
const enc = new TextEncoder();

export async function signToken(secret: string, expiresIn: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(enc.encode(secret));
}

export async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    await jwtVerify(token, enc.encode(secret));
    return true;
  } catch {
    return false;
  }
}
