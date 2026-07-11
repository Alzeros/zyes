import { SignJWT, jwtVerify } from 'jose';
import { Db } from './db';

// Web Crypto PBKDF2 password hashing (bcrypt isn't native to Workers, and
// bcryptjs is slow under the CPU budget). Format: "pbkdf2$iter$saltB64$hashB64".
const ITERATIONS = 100_000;
const KEY_LEN = 32; // 256-bit derived key
const SALT_LEN = 16;

const enc = new TextEncoder();

function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_LEN * 8
  );
  return new Uint8Array(bits);
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const hash = await pbkdf2(plain, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // Legacy bcrypt hashes (from the Node backend) start with "$2". We don't
  // verify them here; re-set the password instead. Treat as mismatch.
  if (!stored.startsWith('pbkdf2$')) return false;
  const [, iterStr, saltB64, hashB64] = stored.split('$');
  const iterations = parseInt(iterStr, 10);
  const salt = fromB64(saltB64);
  const expected = fromB64(hashB64);
  const actual = await pbkdf2(plain, salt, iterations);
  // Constant-time compare.
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

// ── JWT via jose (Web Crypto native, Workers-compatible) ─────────────────────
export async function signToken(secret: string, expiresIn: string): Promise<string> {
  // expiresIn like "24h" is supported by jose's string-duration syntax.
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

// Read the stored password hash from the meta table.
export async function getPasswordHash(db: Db): Promise<string | null> {
  return db.getMeta('password_hash');
}

export async function setPasswordHash(db: Db, hash: string): Promise<void> {
  await db.setMeta('password_hash', hash);
}
