/**
 * Workers-safe cryptography: PBKDF2-HMAC-SHA256 via WebCrypto.
 * (No node bcrypt — not available on Cloudflare Workers.)
 */

/**
 * PBKDF2 iteration count. Cloudflare Workers' WebCrypto REJECTS iteration
 * counts above 100000 (NotSupportedError) — production signup 500'd at
 * 120000 on 2026-10-08 while local workerd silently allowed it. Keep this
 * at or below the platform cap. verifyPassword() reads the count from the
 * stored hash, so lowering it never breaks existing passwords.
 */
export const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Random URL-safe token (session ids, OAuth state). */
export function randomToken(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let s = '';
  for (const b of raw) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Hash a password. Stored format: pbkdf2$<iterations>$<saltB64>$<hashB64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_BYTES * 8,
  );
  return `pbkdf2$${ITERATIONS}$${b64encode(salt)}$${b64encode(new Uint8Array(bits))}`;
}

/** Constant-time-ish comparison of two base64 strings. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify a candidate password against a stored hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  let salt: Uint8Array;
  try {
    salt = b64decode(parts[2]);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_BYTES * 8,
  );
  return timingSafeEqual(b64encode(new Uint8Array(bits)), parts[3]);
}
