/** POST /api/auth/login — email + password sign in. */
import type { APIRoute } from 'astro';
import { backWithError, dbOrError, isSecureRequest, readForm, seeOther } from '../../../lib/api';
import { verifyPassword } from '../../../lib/crypto';
import { cleanStr } from '../../../lib/validation';
import { createSession, sessionCookieHeader } from '../../../lib/session';

interface LoginRow {
  id: string;
  password_hash: string | null;
  must_change_password: number;
}

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return backWithError(context.request, '/login', 'Invalid form submission.');
  }

  const email = cleanStr(form.get('email'), 254).toLowerCase();
  const password = String(form.get('password') ?? '');
  const next = cleanStr(form.get('next'), 200);

  const row = await db
    .prepare('SELECT id, password_hash, must_change_password FROM users WHERE email = ? LIMIT 1')
    .bind(email)
    .first<LoginRow>();

  const ok = row?.password_hash ? await verifyPassword(password, row.password_hash) : false;
  if (!row || !ok) {
    return backWithError(context.request, '/login', 'Invalid email or password.');
  }

  const token = await createSession(db, row.id);
  const headers = { 'set-cookie': sessionCookieHeader(token, isSecureRequest(context.request)) };
  if (row.must_change_password === 1) return seeOther('/change-password?forced=1', headers);
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  return seeOther(safeNext, headers);
};
