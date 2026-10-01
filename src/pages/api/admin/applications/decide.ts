/** POST /api/admin/applications/decide — approve or reject a property application. */
import type { APIRoute } from 'astro';
import { adminOrError, backWithError, dbOrError, readForm, seeOther } from '../../../../lib/api';
import { nowISO } from '../../../../lib/db';
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
    return seeOther('/admin/applications');
  }
  const applicationId = cleanStr(form.get('application_id'), 64);
  const decision = cleanStr(form.get('decision'), 20);
  const note = cleanStr(form.get('note'), 1000);

  if (decision !== 'approve' && decision !== 'reject') {
    return backWithError(context.request, '/admin/applications', 'Invalid decision.');
  }
  const row = await db
    .prepare("SELECT id, status FROM applications WHERE id = ? LIMIT 1")
    .bind(applicationId)
    .first<{ id: string; status: string }>();
  if (!row) return seeOther('/admin/applications');
  if (row.status !== 'pending') {
    return backWithError(context.request, '/admin/applications', 'This application was already decided.');
  }

  await db
    .prepare('UPDATE applications SET status = ?, note = ?, decided_at = ? WHERE id = ?')
    .bind(decision === 'approve' ? 'approved' : 'rejected', note || null, nowISO(), applicationId)
    .run();

  return seeOther(`/admin/applications?decided=${decision}`);
};
