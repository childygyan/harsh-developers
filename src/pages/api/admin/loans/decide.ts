/** POST /api/admin/loans/decide — approve (with free-choice interest % + type) or reject a loan. */
import type { APIRoute } from 'astro';
import { adminOrError, backWithError, dbOrError, readForm, seeOther } from '../../../../lib/api';
import { nowISO } from '../../../../lib/db';
import { approveLoan } from '../../../../lib/loans';
import { cleanStr, num } from '../../../../lib/validation';
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
    return seeOther('/admin/loans');
  }
  const loanId = cleanStr(form.get('loan_id'), 64);
  const decision = cleanStr(form.get('decision'), 20);

  const loan = await db
    .prepare('SELECT id, amount, tenure_months, status FROM loans WHERE id = ? LIMIT 1')
    .bind(loanId)
    .first<{ id: string; amount: number; tenure_months: number; status: string }>();
  if (!loan) return seeOther('/admin/loans');
  if (loan.status !== 'pending') {
    return backWithError(context.request, `/admin/loans/${loanId}`, 'This loan was already decided.');
  }

  if (decision === 'reject') {
    const reason = cleanStr(form.get('rejection_reason'), 1000);
    if (!reason) return backWithError(context.request, `/admin/loans/${loanId}`, 'Please give a rejection reason.');
    await db
      .prepare("UPDATE loans SET status = 'rejected', rejection_reason = ?, decided_at = ? WHERE id = ?")
      .bind(reason, nowISO(), loanId)
      .run();
    return seeOther(`/admin/loans/${loanId}?decided=rejected`);
  }

  if (decision !== 'approve') {
    return backWithError(context.request, `/admin/loans/${loanId}`, 'Invalid decision.');
  }
  const interestPct = num(form.get('interest_pct'));
  const interestType = cleanStr(form.get('interest_type'), 20) as InterestType;
  if (interestPct === null || interestPct < 0 || interestPct > 100) {
    return backWithError(context.request, `/admin/loans/${loanId}`, 'Please enter an interest % between 0 and 100.');
  }
  if (interestType !== 'reducing' && interestType !== 'flat') {
    return backWithError(context.request, `/admin/loans/${loanId}`, 'Interest type must be reducing or flat.');
  }

  await approveLoan(db, {
    loanId,
    amount: loan.amount,
    tenureMonths: loan.tenure_months,
    interestPct,
    interestType,
  });
  return seeOther(`/admin/loans/${loanId}?decided=approved`);
};
