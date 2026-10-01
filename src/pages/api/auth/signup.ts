/** POST /api/auth/signup — email + password registration. */
import type { APIRoute } from 'astro';
import { backWithError, dbOrError, isSecureRequest, readForm, seeOther } from '../../../lib/api';
import { nowISO, uid } from '../../../lib/db';
import { hashPassword } from '../../../lib/crypto';
import { cleanStr, validEmail, validPassword } from '../../../lib/validation';
import { createSession, sessionCookieHeader } from '../../../lib/session';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return backWithError(context.request, '/signup', 'Invalid form submission.');
  }

  const name = cleanStr(form.get('name'), 120);
  const email = cleanStr(form.get('email'), 254).toLowerCase();
  const phone = cleanStr(form.get('phone'), 30);
  const password = String(form.get('password') ?? '');
  const next = cleanStr(form.get('next'), 200);

  if (!name) return backWithError(context.request, '/signup', 'Please enter your name.');
  if (!validEmail(email)) return backWithError(context.request, '/signup', 'Please enter a valid email address.');
  if (!validPassword(password))
    return backWithError(context.request, '/signup', 'Password must be at least 8 characters.');

  const existing = await db.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first();
  if (existing) return backWithError(context.request, '/signup', 'An account with this email already exists. Please log in.');

  const id = uid('u_');
  const now = nowISO();
  await db
    .prepare(
      `INSERT INTO users (id, name, email, phone, password_hash, google_id, role, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, 'user', 0, ?)`,
    )
    .bind(id, name, email, phone || null, await hashPassword(password), now)
    .run();

  const token = await createSession(db, id);
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  return seeOther(safeNext, {
    'set-cookie': sessionCookieHeader(token, isSecureRequest(context.request)),
  });
};
