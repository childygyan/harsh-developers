/** POST /api/admin/users/delete — admin deletes a user (never self, never the last admin). */
import type { APIRoute } from 'astro';
import { adminOrError, backWithError, dbOrError, readForm, seeOther } from '../../../../lib/api';
import { destroyUserSessions } from '../../../../lib/session';
import { cleanStr } from '../../../../lib/validation';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const admin = adminOrError(context);
  if (admin instanceof Response) return admin;

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return seeOther('/admin/users');
  }
  const userId = cleanStr(form.get('user_id'), 64);
  if (!userId) return seeOther('/admin/users');
  if (userId === admin.id) {
    return backWithError(context.request, '/admin/users', 'You cannot delete your own account.');
  }

  const target = await db
    .prepare('SELECT id, role FROM users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<{ id: string; role: string }>();
  if (!target) return seeOther('/admin/users');

  if (target.role === 'admin') {
    const count = await db
      .prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'")
      .first<{ c: number }>();
    if ((count?.c ?? 1) <= 1) {
      return backWithError(context.request, '/admin/users', 'You cannot delete the last admin account.');
    }
  }

  await destroyUserSessions(db, userId);
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

  return seeOther('/admin/users?deleted=1');
};
