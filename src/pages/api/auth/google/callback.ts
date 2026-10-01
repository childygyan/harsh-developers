/** GET /api/auth/google/callback — finish the Google OAuth flow. */
import type { APIRoute } from 'astro';
import { backWithError, dbOrError, isSecureRequest, seeOther } from '../../../../lib/api';
import { nowISO, uid } from '../../../../lib/db';
import { getEnv, googleConfigured } from '../../../../lib/env';
import { clearOauthStateCookieHeader, exchangeCode, OAUTH_STATE_COOKIE } from '../../../../lib/oauth';
import { cleanStr } from '../../../../lib/validation';
import { createSession, sessionCookieHeader } from '../../../../lib/session';

interface UserRow {
  id: string;
  role: string;
  must_change_password: number;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

export const GET: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const env = getEnv(context.locals);
  if (!googleConfigured(env)) return new Response('Google sign-in is not configured.', { status: 404 });

  const params = context.url.searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const savedState = readCookie(context.request.headers.get('cookie'), OAUTH_STATE_COOKIE);
  const clearState = { 'set-cookie': clearOauthStateCookieHeader() };

  if (params.get('error') || !code || !state || !savedState || state !== savedState) {
    const r = backWithError(context.request, '/login', 'Google sign-in failed. Please try again.');
    r.headers.append('set-cookie', clearOauthStateCookieHeader());
    return r;
  }

  let profile;
  try {
    profile = await exchangeCode(env, code);
  } catch {
    const r = backWithError(context.request, '/login', 'Could not verify your Google account. Please try again.');
    r.headers.append('set-cookie', clearOauthStateCookieHeader());
    return r;
  }

  const email = profile.email.trim().toLowerCase();
  const name = cleanStr(profile.name, 120) || email.split('@')[0];

  // Link by google_id first, then fall back to matching email.
  let row = await db
    .prepare('SELECT id, role, must_change_password FROM users WHERE google_id = ? LIMIT 1')
    .bind(profile.sub)
    .first<UserRow>();
  if (!row) {
    row = await db
      .prepare('SELECT id, role, must_change_password FROM users WHERE email = ? LIMIT 1')
      .bind(email)
      .first<UserRow>();
    if (row) {
      await db.prepare('UPDATE users SET google_id = ? WHERE id = ?').bind(profile.sub, row.id).run();
    }
  }
  let userId: string;
  if (row) {
    userId = row.id;
  } else {
    userId = uid('u_');
    await db
      .prepare(
        `INSERT INTO users (id, name, email, phone, password_hash, google_id, role, must_change_password, created_at)
         VALUES (?, ?, ?, NULL, NULL, ?, 'user', 0, ?)`,
      )
      .bind(userId, name, email, profile.sub, nowISO())
      .run();
  }

  const token = await createSession(db, userId);
  const headers = new Headers(clearState);
  headers.append('set-cookie', sessionCookieHeader(token, isSecureRequest(context.request)));
  const dest =
    row?.must_change_password === 1 ? '/change-password?forced=1' : row?.role === 'admin' ? '/admin' : '/dashboard';
  return seeOther(dest, headers);
};
