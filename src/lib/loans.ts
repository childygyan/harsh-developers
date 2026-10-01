/**
 * Loan approval engine (admin): stamps interest % + type on the loan,
 * generates the full amortization schedule, and stores every row in D1.
 * Used by both the loan-approval endpoint and the manual-loan endpoint.
 */
import { buildSchedule, type InterestType } from './emi';
import { nowISO } from './db';

export interface ApproveInput {
  loanId: string;
  amount: number;
  tenureMonths: number;
  interestPct: number;
  interestType: InterestType;
}

/** Approve a loan row that already exists; writes schedule rows atomically. */
export async function approveLoan(db: D1Database, input: ApproveInput): Promise<{ emi: number; rows: number }> {
  const schedule = buildSchedule({
    principal: input.amount,
    annualPct: input.interestPct,
    months: input.tenureMonths,
    interestType: input.interestType,
    startDate: new Date(),
  });
  const now = nowISO();

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE loans SET status = 'approved', interest_pct = ?, interest_type = ?,
                          emi = ?, rejection_reason = NULL, decided_at = ? WHERE id = ?`,
      )
      .bind(input.interestPct, input.interestType, schedule.emi, now, input.loanId),
    db.prepare('DELETE FROM emi_schedule WHERE loan_id = ?').bind(input.loanId),
  ];
  for (const row of schedule.rows) {
    statements.push(
      db
        .prepare(
          `INSERT INTO emi_schedule (id, loan_id, n, due_date, emi, principal, interest, balance)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `${input.loanId}_r${row.n}`,
          input.loanId,
          row.n,
          row.dueDate,
          row.emi,
          row.principal,
          row.interest,
          row.balance,
        ),
    );
  }
  await db.batch(statements);
  return { emi: schedule.emi, rows: schedule.rows.length };
}
