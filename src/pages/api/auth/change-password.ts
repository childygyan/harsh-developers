/** POST /api/auth/change-password — set a new password (forced on first admin login). */
import type { APIRoute } from 'astro';
import { backWithError, dbOrError, readForm, seeOther, userOrError } from '../../../lib/api';
import { hashPassword, verifyPassword } from '../../../lib/crypto';
import { validPassword } from '../../../lib/validation';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const user = userOrError(context);
  if (user instanceof Response) return user;

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return backWithError(context.request, '/change-password', 'Invalid form submission.');
  }

  const current = String(form.get('current') ?? '');
  const next1 = String(form.get('new_password') ?? '');
  const next2 = String(form.get('confirm_password') ?? '');

  if (!validPassword(next1)) {
    return backWithError(context.request, '/change-password', 'New password must be at least 8 characters.');
  }
  if (next1 !== next2) {
    return backWithError(context.request, '/change-password', 'New passwords do not match.');
  }

  const row = await db
    .prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1')
    .bind(user.id)
    .first<{ password_hash: string | null }>();
  // Google-only accounts have no password yet — they may set one freely.
  if (row?.password_hash) {
    const ok = await verifyPassword(current, row.password_hash);
    if (!ok) return backWithError(context.request, '/change-password', 'Current password is incorrect.');
  }

  await db
    .prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .bind(await hashPassword(next1), user.id)
    .run();

  return seeOther(user.role === 'admin' ? '/admin' : '/dashboard');
};
