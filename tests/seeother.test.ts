/**
 * Regression test for the Google-login redirect bug (2026-10-08):
 *
 * seeOther() used to build the redirect as
 *   new Response(null, { status: 303, headers: { location, ...(headers || {}) } })
 * Spreading a Headers instance yields {} (header entries are not own
 * enumerable properties), so when the Google OAuth callback passed a
 * Headers instance carrying TWO Set-Cookie headers (clear oauth state +
 * set session), both were silently dropped. The session row was created in
 * D1 but the browser never received the hd_session cookie, so /dashboard
 * bounced straight back to /login.
 *
 * These tests pin the fixed behavior: every Set-Cookie survives, for all
 * three HeadersInit shapes callers use.
 */
import { describe, expect, it } from 'vitest';
import { seeOther } from '../src/lib/api';

const STATE_COOKIE = 'hd_oauth_state=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0';
const SESSION_COOKIE = 'hd_session=tok123; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800';

function setCookies(res: Response): string[] {
  // Node >= 18: getSetCookie() returns each Set-Cookie separately.
  const gsc = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof gsc === 'function') return gsc.call(res.headers);
  return res.headers.get('set-cookie')?.split(/,(?=[^;,]+=[^;,]*)/) ?? [];
}

describe('seeOther preserves Set-Cookie headers', () => {
  it('keeps both cookies when given a Headers instance (Google callback shape)', () => {
    const h = new Headers({ 'set-cookie': STATE_COOKIE });
    h.append('set-cookie', SESSION_COOKIE);
    const res = seeOther('/dashboard', h);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/dashboard');
    const cookies = setCookies(res);
    expect(cookies.some((c) => c.startsWith('hd_oauth_state='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('hd_session=tok123'))).toBe(true);
  });

  it('keeps the cookie when given a plain object (email login shape)', () => {
    const res = seeOther('/dashboard', { 'set-cookie': SESSION_COOKIE });
    expect(res.status).toBe(303);
    expect(setCookies(res).some((c) => c.startsWith('hd_session=tok123'))).toBe(true);
  });

  it('works with no extra headers (backWithError shape)', () => {
    const res = seeOther('/login?error=x');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/login?error=x');
  });
});
