/** POST /api/auth/logout — destroy the session. */
import type { APIRoute } from 'astro';
import { clearSessionCookieHeader, destroySession } from '../../../lib/session';
import { getDB } from '../../../lib/db';
import { seeOther } from '../../../lib/api';
import { SESSION_COOKIE } from '../../../lib/session';

export const POST: APIRoute = async (context) => {
  const cookieHeader = context.request.headers.get('cookie') || '';
  const token = cookieHeader
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(SESSION_COOKIE + '='))
    ?.slice(SESSION_COOKIE.length + 1);
  const db = getDB(context.locals);
  if (db) await destroySession(db, token || null);
  return seeOther('/', { 'set-cookie': clearSessionCookieHeader() });
};
