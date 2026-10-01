/**
 * Request pipeline:
 *  1. Lazy admin seeding on first deploy (env ADMIN_EMAIL/ADMIN_PASSWORD).
 *  2. Session cookie → Astro.locals.user (+ sliding refresh).
 *  3. Route guards: /admin/* needs admin; user areas need login;
 *     forced password change until must_change_password is cleared.
 *  4. Baseline security headers.
 */
import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';
import { getEnv, googleConfigured } from './lib/env';
import { SESSION_COOKIE, getSessionUser } from './lib/session';
import { ensureSeeded } from './lib/seed';

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/google',
];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

const PASSWORD_CHANGE_ALLOWLIST = new Set([
  '/change-password',
  '/api/auth/change-password',
  '/api/auth/logout',
  '/logout',
]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, locals } = context;
  const pathname = url.pathname;

  const db = getDB(locals);
  const env = getEnv(locals);
  locals.googleEnabled = googleConfigured(env);

  if (db) {
    await ensureSeeded(db, locals);
    const token = getCookie(context.request.headers.get('cookie'), SESSION_COOKIE);
    locals.user = (await getSessionUser(db, token)) ?? null;
  } else {
    locals.user = null;
  }

  const user = locals.user ?? null;
  const isApi = pathname.startsWith('/api/');

  const deny = () => {
    if (isApi) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    const nextParam = encodeURIComponent(pathname + url.search);
    return context.redirect(`/login?next=${nextParam}`, 303);
  };
  const forbid = () => {
    if (isApi) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }
    return context.redirect('/', 303);
  };

  // Forced password change (first login after env-seed, or admin reset).
  if (user && user.must_change_password === 1 && !PASSWORD_CHANGE_ALLOWLIST.has(pathname)) {
    if (isApi) {
      return new Response(JSON.stringify({ error: 'Password change required' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }
    return context.redirect('/change-password', 303);
  }

  const needsAdmin =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/api/admin/');
  if (needsAdmin) {
    if (!user) return deny();
    if (user.role !== 'admin') return forbid();
  }

  const needsLogin =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/apply') ||
    pathname.startsWith('/api/applications') ||
    pathname.startsWith('/api/loans') ||
    pathname === '/api/auth/change-password' ||
    pathname === '/api/auth/logout';
  if (needsLogin && !user && !isPublicApi(pathname)) {
    return deny();
  }

  const response = await next();

  // Baseline security headers.
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
});
