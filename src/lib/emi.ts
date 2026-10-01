/**
 * EMI amortization engine — two interest methods, chosen per loan:
 *
 * REDUCING BALANCE:
 *   monthly rate r = annualPct / 12 / 100
 *   EMI = P * r * (1+r)^n / ((1+r)^n − 1)
 *   interest each month is computed on the outstanding principal.
 *
 * FLAT RATE:
 *   total_interest = P * (annualPct/100) * (n/12)
 *   total_payable  = P + total_interest
 *   EMI = total_payable / n
 *   interest component is equal every month (total_interest / n),
 *   principal component = EMI − interest component,
 *   remaining balance starts at total_payable and declines by EMI.
 *
 * Per-row values are rounded to 2 decimals (paise); the final installment
 * absorbs rounding residue so totals close exactly.
 * Pure functions — safe to unit test anywhere (no Workers APIs).
 */

export type InterestType = 'reducing' | 'flat';

export interface EmiRow {
  n: number;
  dueDate: string; // yyyy-mm-dd
  emi: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface ScheduleInput {
  principal: number;
  annualPct: number;
  months: number;
  interestType: InterestType;
  /** First due date is one month after this date (loan approval date). */
  startDate: Date;
}

export interface ScheduleResult {
  interestType: InterestType;
  emi: number;
  rows: EmiRow[];
  totalInterest: number;
  totalPayable: number;
}

export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export function monthlyRate(annualPct: number): number {
  return annualPct / 12 / 100;
}

/** Standard reducing-balance EMI. Throws on invalid input. */
export function emiAmount(principal: number, annualPct: number, months: number): number {
  if (!Number.isFinite(principal) || principal <= 0) throw new Error('principal must be > 0');
  if (!Number.isFinite(annualPct) || annualPct < 0) throw new Error('annualPct must be >= 0');
  if (!Number.isInteger(months) || months <= 0) throw new Error('months must be a positive integer');
  const r = monthlyRate(annualPct);
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

/** Flat-rate totals: total interest charged over the whole tenure. */
export function flatTotals(
  principal: number,
  annualPct: number,
  months: number,
): { totalInterest: number; totalPayable: number; emi: number } {
  if (!Number.isFinite(principal) || principal <= 0) throw new Error('principal must be > 0');
  if (!Number.isFinite(annualPct) || annualPct < 0) throw new Error('annualPct must be >= 0');
  if (!Number.isInteger(months) || months <= 0) throw new Error('months must be a positive integer');
  const totalInterest = round2(principal * (annualPct / 100) * (months / 12));
  const totalPayable = round2(principal + totalInterest);
  return { totalInterest, totalPayable, emi: round2(totalPayable / months) };
}

function addMonths(d: Date, m: number): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  out.setUTCMonth(out.getUTCMonth() + m);
  return out;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function validateInput(input: ScheduleInput): void {
  const { principal, annualPct, months, interestType } = input;
  if (!Number.isFinite(principal) || principal <= 0) throw new Error('principal must be > 0');
  if (!Number.isFinite(annualPct) || annualPct < 0) throw new Error('annualPct must be >= 0');
  if (!Number.isInteger(months) || months <= 0) throw new Error('months must be a positive integer');
  if (interestType !== 'reducing' && interestType !== 'flat') throw new Error('interestType must be reducing or flat');
}

/** Build the full amortization schedule for either interest method. */
export function buildSchedule(input: ScheduleInput): ScheduleResult {
  validateInput(input);
  const { principal, annualPct, months, interestType, startDate } = input;
  const rows: EmiRow[] = [];

  if (interestType === 'flat') {
    const { totalInterest, totalPayable, emi } = flatTotals(principal, annualPct, months);
    let balance = totalPayable;
    let interestAccum = 0;
    let principalAccum = 0;
    for (let i = 1; i <= months; i++) {
      let interest: number;
      let principalPart: number;
      let rowEmi: number;
      if (i === months) {
        // Final row absorbs rounding residue so sums close exactly.
        interest = round2(totalInterest - interestAccum);
        principalPart = round2(principal - principalAccum);
        rowEmi = round2(interest + principalPart);
      } else {
        interest = round2(totalInterest / months);
        principalPart = round2(emi - interest);
        rowEmi = emi;
      }
      interestAccum = round2(interestAccum + interest);
      principalAccum = round2(principalAccum + principalPart);
      balance = round2(balance - rowEmi);
      rows.push({
        n: i,
        dueDate: isoDate(addMonths(startDate, i)),
        emi: rowEmi,
        principal: principalPart,
        interest,
        balance: i === months ? 0 : balance,
      });
    }
    const totalPayableCheck = round2(rows.reduce((s, x) => s + x.emi, 0));
    const totalInterestCheck = round2(rows.reduce((s, x) => s + x.interest, 0));
    return { interestType, emi, rows, totalInterest: totalInterestCheck, totalPayable: totalPayableCheck };
  }

  // Reducing balance.
  const emi = round2(emiAmount(principal, annualPct, months));
  const r = monthlyRate(annualPct);
  let balance = round2(principal);

  for (let i = 1; i <= months; i++) {
    const interest = round2(balance * r);
    let principalPart: number;
    let rowEmi: number;
    if (i === months) {
      // Final row absorbs rounding residue: balance closes to exactly 0.
      principalPart = round2(balance);
      rowEmi = round2(principalPart + interest);
    } else {
      principalPart = round2(emi - interest);
      rowEmi = emi;
    }
    balance = round2(balance - principalPart);
    rows.push({
      n: i,
      dueDate: isoDate(addMonths(startDate, i)),
      emi: rowEmi,
      principal: principalPart,
      interest,
      balance: i === months ? 0 : balance,
    });
  }

  const totalInterest = round2(rows.reduce((s, x) => s + x.interest, 0));
  const totalPayable = round2(rows.reduce((s, x) => s + x.emi, 0));
  return { interestType, emi, rows, totalInterest, totalPayable };
}

/** Human label for dashboards: e.g. "12% p.a. reducing" / "10% p.a. flat". */
export function interestLabel(annualPct: number | null | undefined, interestType: string | null | undefined): string {
  if (annualPct === null || annualPct === undefined) return '—';
  const t = interestType === 'flat' ? 'flat' : 'reducing';
  return `${Number(annualPct)}% p.a. ${t}`;
}
