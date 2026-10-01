/** POST /api/loans/apply — user applies for a loan on an approved application. */
import type { APIRoute } from 'astro';
import { backWithError, dbOrError, readForm, seeOther, userOrError } from '../../../lib/api';
import { nowISO, uid } from '../../../lib/db';
import { cleanStr, int, num } from '../../../lib/validation';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const user = userOrError(context);
  if (user instanceof Response) return user;

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return backWithError(context.request, '/dashboard', 'Invalid form submission.');
  }

  const applicationId = cleanStr(form.get('application_id'), 64);
  const amount = num(form.get('amount'));
  const tenure = int(form.get('tenure_months'));

  const app = await db
    .prepare('SELECT id, user_id, property_id, status FROM applications WHERE id = ? LIMIT 1')
    .bind(applicationId)
    .first<{ id: string; user_id: string; property_id: string; status: string }>();
  if (!app || app.user_id !== user.id) {
    return backWithError(context.request, '/dashboard', 'Application not found.');
  }
  if (app.status !== 'approved') {
    return backWithError(context.request, '/dashboard', 'You can apply for a loan only after your application is approved.');
  }
  if (amount === null || amount <= 0 || amount > 100_00_00_000) {
    return backWithError(context.request, `/dashboard/loans/new?application_id=${app.id}`, 'Please enter a valid loan amount.');
  }
  if (tenure === null || tenure < 1 || tenure > 360) {
    return backWithError(context.request, `/dashboard/loans/new?application_id=${app.id}`, 'Tenure must be between 1 and 360 months.');
  }

  const existingLoan = await db
    .prepare("SELECT id FROM loans WHERE application_id = ? AND status IN ('pending','approved') LIMIT 1")
    .bind(app.id)
    .first();
  if (existingLoan) {
    return backWithError(context.request, '/dashboard', 'A loan request already exists for this application.');
  }

  const loanId = uid('ln_');
  await db
    .prepare(
      `INSERT INTO loans (id, user_id, manual_name, manual_phone, property_id, application_id,
                          amount, tenure_months, interest_pct, interest_type, status, emi,
                          rejection_reason, created_at, decided_at)
       VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, NULL, 'reducing', 'pending', NULL, NULL, ?, NULL)`,
    )
    .bind(loanId, user.id, app.property_id, app.id, amount, tenure, nowISO())
    .run();

  return seeOther(`/dashboard/loans/${loanId}?applied=1`);
};
