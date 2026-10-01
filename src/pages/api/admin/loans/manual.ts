/** POST /api/admin/loans/manual — admin creates an approved loan directly
 *  for an existing user OR a free-text name/phone (offline customer),
 *  with optional property link. Schedule generates immediately.
 */
import type { APIRoute } from 'astro';
import { adminOrError, backWithError, dbOrError, readForm, seeOther } from '../../../../lib/api';
import { nowISO, uid } from '../../../../lib/db';
import { approveLoan } from '../../../../lib/loans';
import { cleanStr, int, num, validEmail } from '../../../../lib/validation';
import type { InterestType } from '../../../../lib/emi';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const admin = adminOrError(context);
  if (admin instanceof Response) return admin;

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return backWithError(context.request, '/admin/loans/new', 'Invalid form submission.');
  }

  const userId = cleanStr(form.get('user_id'), 64);
  const manualName = cleanStr(form.get('manual_name'), 120);
  const manualPhone = cleanStr(form.get('manual_phone'), 30);
  const propertyId = cleanStr(form.get('property_id'), 64);
  const amount = num(form.get('amount'));
  const tenure = int(form.get('tenure_months'));
  const interestPct = num(form.get('interest_pct'));
  const interestType = cleanStr(form.get('interest_type'), 20) as InterestType;

  let borrowerUserId: string | null = null;
  if (userId) {
    const u = await db.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').bind(userId).first();
    if (!u) return backWithError(context.request, '/admin/loans/new', 'Selected user not found.');
    borrowerUserId = userId;
  } else {
    if (!manualName) return backWithError(context.request, '/admin/loans/new', 'Enter the borrower name (or pick an existing user).');
  }

  if (propertyId) {
    const p = await db.prepare('SELECT id FROM properties WHERE id = ? LIMIT 1').bind(propertyId).first();
    if (!p) return backWithError(context.request, '/admin/loans/new', 'Selected property not found.');
  }
  if (amount === null || amount <= 0 || amount > 100_00_00_000) {
    return backWithError(context.request, '/admin/loans/new', 'Please enter a valid loan amount.');
  }
  if (tenure === null || tenure < 1 || tenure > 360) {
    return backWithError(context.request, '/admin/loans/new', 'Tenure must be between 1 and 360 months.');
  }
  if (interestPct === null || interestPct < 0 || interestPct > 100) {
    return backWithError(context.request, '/admin/loans/new', 'Please enter an interest % between 0 and 100.');
  }
  if (interestType !== 'reducing' && interestType !== 'flat') {
    return backWithError(context.request, '/admin/loans/new', 'Interest type must be reducing or flat.');
  }

  const loanId = uid('ln_');
  const now = nowISO();
  await db
    .prepare(
      `INSERT INTO loans (id, user_id, manual_name, manual_phone, property_id, application_id,
                          amount, tenure_months, interest_pct, interest_type, status, emi,
                          rejection_reason, created_at, decided_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, 'reducing', 'pending', NULL, NULL, ?, NULL)`,
    )
    .bind(
      loanId,
      borrowerUserId,
      borrowerUserId ? null : manualName,
      borrowerUserId ? null : manualPhone || null,
      propertyId || null,
      amount,
      tenure,
      now,
    )
    .run();

  await approveLoan(db, { loanId, amount, tenureMonths: tenure, interestPct, interestType });
  return seeOther(`/admin/loans/${loanId}?created=1`);
};
