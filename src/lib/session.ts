/**
 * Session management: opaque random tokens stored in D1, carried in an
 * HttpOnly + Secure + SameSite=Lax cookie. Sessions expire after 7 days
 * of creation (sliding refresh on each request).
 */
import { nowISO, uid } from './db';
import { randomToken } from './crypto';

export const SESSION_COOKIE = 'hd_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'user' | 'admin';
  must_change_password: number;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  must_change_password: number;
}

/** Create a session row and return the token. */
export async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(token, userId, expiresAt, nowISO())
    .run();
  return token;
}

/** Look up the user for a session token; refreshes expiry on hit. */
export async function getSessionUser(
  db: D1Database,
  token: string | null | undefined,
): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.must_change_password, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? LIMIT 1`,
    )
    .bind(token)
    .first<UserRow & { expires_at: string }>();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run().catch(() => {});
    return null;
  }
  // Sliding refresh.
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(expiresAt, token).run().catch(() => {});
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role === 'admin' ? 'admin' : 'user',
    must_change_password: row.must_change_password,
  };
}

/** Delete a session (logout). */
export async function destroySession(db: D1Database, token: string | null | undefined): Promise<void> {
  if (!token) return;
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run().catch(() => {});
}

/** Delete ALL sessions for a user (used after admin password reset / user delete). */
export async function destroyUserSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run().catch(() => {});
}

export function sessionCookieHeader(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
