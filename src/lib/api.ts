/** Shared helpers for API routes. Middleware already enforces role guards;
 * these helpers double-check so a route is never one refactor away from
 * an open endpoint. Each returns the value or a Response error — callers
 * check `instanceof Response` and return it.
 */
import type { APIContext } from 'astro';
import { getDB, getBucket } from './db';
import type { SessionUser } from './session';

export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function dbOrError(context: APIContext): D1Database | Response {
  const db = getDB(context.locals);
  return db ?? jsonError('Database unavailable', 500);
}

export function userOrError(context: APIContext): SessionUser | Response {
  const user = context.locals.user as SessionUser | null | undefined;
  return user ?? jsonError('Unauthorized', 401);
}

export function adminOrError(context: APIContext): SessionUser | Response {
  const user = userOrError(context);
  if (user instanceof Response) return user;
  return user.role === 'admin' ? user : jsonError('Forbidden', 403);
}

export function seeOther(location: string, headers?: HeadersInit): Response {
  // Never spread a Headers instance ({ ...headers } === {}): Headers entries
  // are not own enumerable properties, so spreading silently drops every
  // header — including Set-Cookie. That exact bug broke Google login: the
  // session cookie never reached the browser, so /dashboard bounced back
  // to /login. new Headers() copies the full header list, preserving
  // multiple Set-Cookie values.
  const out = new Headers(headers);
  out.set('location', location);
  return new Response(null, { status: 303, headers: out });
}

/** Redirect back to a form page with an error message. */
export function backWithError(request: Request, fallback: string, message: string): Response {
  const ref = request.headers.get('referer');
  let base = fallback;
  try {
    if (ref) {
      const u = new URL(ref);
      base = u.pathname + u.search;
    }
  } catch {
    /* use fallback */
  }
  const sep = base.includes('?') ? '&' : '?';
  return seeOther(`${base}${sep}error=${encodeURIComponent(message)}`);
}

export function isSecureRequest(request: Request): boolean {
  try {
    const u = new URL(request.url);
    if (u.protocol === 'https:') return true;
  } catch {
    /* ignore */
  }
  return request.headers.get('x-forwarded-proto') === 'https';
}

/** Read form data from a POST (works for urlencoded and multipart). */
export async function readForm(request: Request): Promise<FormData> {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    return request.formData();
  }
  throw new Error('Expected a form submission');
}

export { getBucket };
