/** POST /api/admin/settings — update default interest % and type. */
import type { APIRoute } from 'astro';
import { adminOrError, backWithError, dbOrError, readForm, seeOther } from '../../../lib/api';
import { cleanStr, num } from '../../../lib/validation';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const admin = adminOrError(context);
  if (admin instanceof Response) return admin;

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return seeOther('/admin/settings');
  }

  const pct = num(form.get('default_interest_pct'));
  const type = cleanStr(form.get('default_interest_type'), 20);
  if (pct === null || pct < 0 || pct > 100) {
    return backWithError(context.request, '/admin/settings', 'Default interest % must be between 0 and 100.');
  }
  if (type !== 'reducing' && type !== 'flat') {
    return backWithError(context.request, '/admin/settings', 'Default interest type must be reducing or flat.');
  }

  await db.prepare("INSERT INTO settings (key, value) VALUES ('default_interest_pct', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(pct)).run();
  await db.prepare("INSERT INTO settings (key, value) VALUES ('default_interest_type', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(type).run();

  return seeOther('/admin/settings?saved=1');
};
