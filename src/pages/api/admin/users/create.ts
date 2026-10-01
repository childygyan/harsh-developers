/** POST /api/admin/users/create — admin adds a user. */
import type { APIRoute } from 'astro';
import { adminOrError, backWithError, dbOrError, readForm, seeOther } from '../../../../lib/api';
import { nowISO, uid } from '../../../../lib/db';
import { hashPassword } from '../../../../lib/crypto';
import { cleanStr, validEmail, validPassword } from '../../../../lib/validation';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const admin = adminOrError(context);
  if (admin instanceof Response) return admin;

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return backWithError(context.request, '/admin/users', 'Invalid form submission.');
  }

  const name = cleanStr(form.get('name'), 120);
  const email = cleanStr(form.get('email'), 254).toLowerCase();
  const phone = cleanStr(form.get('phone'), 30);
  const password = String(form.get('password') ?? '');
  const role = cleanStr(form.get('role'), 20) === 'admin' ? 'admin' : 'user';

  if (!name) return backWithError(context.request, '/admin/users', 'Name is required.');
  if (!validEmail(email)) return backWithError(context.request, '/admin/users', 'Enter a valid email address.');
  if (!validPassword(password)) return backWithError(context.request, '/admin/users', 'Password must be at least 8 characters.');

  const existing = await db.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first();
  if (existing) return backWithError(context.request, '/admin/users', 'A user with this email already exists.');

  await db
    .prepare(
      `INSERT INTO users (id, name, email, phone, password_hash, google_id, role, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 0, ?)`,
    )
    .bind(uid('u_'), name, email, phone || null, await hashPassword(password), role, nowISO())
    .run();

  return seeOther('/admin/users?created=1');
};
