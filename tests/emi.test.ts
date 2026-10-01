/**
 * EMI engine tests — both interest methods, verified against
 * independently hand-computed expected values.
 *
 * Worked examples (also documented in REPORT.md):
 *
 *  REDUCING, P=100000, 12% p.a., n=12:
 *    r = 0.01, (1.01)^12 = 1.1268250301319698
 *    EMI = 100000 × 0.01 × 1.1268250301319698 / 0.1268250301319698
 *        = 8884.8788678… → ₹8,884.88
 *
 *  FLAT, P=100000, 12% p.a., n=12:
 *    total_interest = 100000 × 0.12 × (12/12) = ₹12,000
 *    total_payable  = ₹112,000
 *    EMI = 112000 / 12 = 9333.333… → ₹9,333.33
 *    (final installment absorbs the 4-paise residue: 11 × 9333.33 + 9333.37)
 */
import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  emiAmount,
  flatTotals,
  interestLabel,
  monthlyRate,
  round2,
} from '../src/lib/emi';

describe('reducing balance', () => {
  it('monthly rate is annual/12/100', () => {
    expect(monthlyRate(12)).toBeCloseTo(0.01, 12);
    expect(monthlyRate(9)).toBeCloseTo(0.0075, 12);
  });

  it('EMI for P=100000, 12% p.a., 12 months is 8884.88 (hand-computed)', () => {
    const r = 0.01;
    const f = Math.pow(1 + r, 12);
    const expected = (100000 * r * f) / (f - 1);
    expect(round2(expected)).toBe(8884.88);
    expect(round2(emiAmount(100000, 12, 12))).toBe(8884.88);
  });

  it('builds a 12-row schedule that closes to zero', () => {
    const s = buildSchedule({
      principal: 100000,
      annualPct: 12,
      months: 12,
      interestType: 'reducing',
      startDate: new Date(Date.UTC(2026, 9, 1)),
    });
    expect(s.rows).toHaveLength(12);
    expect(s.emi).toBe(8884.88);
    expect(s.rows[11].balance).toBe(0);
    // First row: interest on full principal.
    expect(s.rows[0].interest).toBe(1000);
    expect(s.rows[0].principal).toBe(7884.88);
    // Totals are internally consistent.
    const sumEmi = round2(s.rows.reduce((a, x) => a + x.emi, 0));
    const sumPrin = round2(s.rows.reduce((a, x) => a + x.principal, 0));
    const sumInt = round2(s.rows.reduce((a, x) => a + x.interest, 0));
    expect(sumEmi).toBe(s.totalPayable);
    expect(sumPrin).toBe(100000);
    expect(sumInt).toBe(s.totalInterest);
    expect(round2(sumPrin + sumInt)).toBe(sumEmi);
    // Due dates are monthly, first one month after start.
    expect(s.rows[0].dueDate).toBe('2026-11-01');
    expect(s.rows[11].dueDate).toBe('2027-10-01');
  });

  it('zero interest degrades to principal/months', () => {
    const s = buildSchedule({
      principal: 120000,
      annualPct: 0,
      months: 12,
      interestType: 'reducing',
      startDate: new Date(Date.UTC(2026, 0, 15)),
    });
    expect(s.emi).toBe(10000);
    expect(s.totalInterest).toBe(0);
    expect(s.rows.every((r) => r.interest === 0)).toBe(true);
    expect(s.rows[11].balance).toBe(0);
  });

  it('rejects invalid input', () => {
    const base = {
      principal: 100000,
      annualPct: 12,
      months: 12,
      interestType: 'reducing' as const,
      startDate: new Date(),
    };
    expect(() => buildSchedule({ ...base, principal: 0 })).toThrow();
    expect(() => buildSchedule({ ...base, annualPct: -1 })).toThrow();
    expect(() => buildSchedule({ ...base, months: 0 })).toThrow();
    expect(() => buildSchedule({ ...base, months: 12.5 })).toThrow();
    expect(() => buildSchedule({ ...base, interestType: 'x' as never })).toThrow();
  });
});

describe('flat rate', () => {
  it('flat totals for P=100000, 12% p.a., 12 months: interest 12000, EMI 9333.33', () => {
    // Hand-computed: 100000 × 0.12 × (12/12) = 12000; (100000+12000)/12 = 9333.333…
    const t = flatTotals(100000, 12, 12);
    expect(t.totalInterest).toBe(12000);
    expect(t.totalPayable).toBe(112000);
    expect(t.emi).toBe(9333.33);
  });

  it('builds a 12-row flat schedule with equal interest slices', () => {
    const s = buildSchedule({
      principal: 100000,
      annualPct: 12,
      months: 12,
      interestType: 'flat',
      startDate: new Date(Date.UTC(2026, 9, 1)),
    });
    expect(s.interestType).toBe('flat');
    expect(s.rows).toHaveLength(12);
    expect(s.emi).toBe(9333.33);
    // Equal monthly interest slices: 12000/12 = 1000 each.
    expect(s.rows.slice(0, 11).every((r) => r.interest === 1000)).toBe(true);
    expect(s.rows[11].interest).toBe(1000);
    // Principal slices: 9333.33 − 1000 = 8333.33; final absorbs residue.
    expect(s.rows[0].principal).toBe(8333.33);
    // Balance starts at total payable and declines by EMI.
    expect(s.rows[0].balance).toBe(round2(112000 - 9333.33));
    expect(s.rows[11].balance).toBe(0);
    // Internal consistency.
    const sumEmi = round2(s.rows.reduce((a, x) => a + x.emi, 0));
    const sumPrin = round2(s.rows.reduce((a, x) => a + x.principal, 0));
    const sumInt = round2(s.rows.reduce((a, x) => a + x.interest, 0));
    expect(sumEmi).toBe(s.totalPayable);
    expect(sumPrin).toBe(100000);
    expect(sumInt).toBe(s.totalInterest);
    expect(s.totalPayable).toBe(112000);
    expect(s.totalInterest).toBe(12000);
    expect(s.rows[0].dueDate).toBe('2026-11-01');
  });

  it('flat schedule with uneven division still closes exactly', () => {
    // 100000 @ 10% for 7 months: interest = 100000×0.10×7/12 = 5833.33
    const s = buildSchedule({
      principal: 100000,
      annualPct: 10,
      months: 7,
      interestType: 'flat',
      startDate: new Date(Date.UTC(2026, 0, 1)),
    });
    expect(s.totalInterest).toBe(5833.33);
    const sumInt = round2(s.rows.reduce((a, x) => a + x.interest, 0));
    const sumPrin = round2(s.rows.reduce((a, x) => a + x.principal, 0));
    expect(sumInt).toBe(s.totalInterest);
    expect(sumPrin).toBe(100000);
    expect(s.rows[6].balance).toBe(0);
  });

  it('flat and reducing differ for the same inputs', () => {
    const base = {
      principal: 500000,
      annualPct: 12,
      months: 24,
      startDate: new Date(Date.UTC(2026, 0, 1)),
    };
    const red = buildSchedule({ ...base, interestType: 'reducing' });
    const flat = buildSchedule({ ...base, interestType: 'flat' });
    // Flat charges more total interest than reducing for identical P/r/n.
    expect(flat.totalInterest).toBeGreaterThan(red.totalInterest);
    expect(flat.emi).toBeGreaterThan(red.emi);
  });
});

describe('interestLabel', () => {
  it('labels both methods', () => {
    expect(interestLabel(12, 'reducing')).toBe('12% p.a. reducing');
    expect(interestLabel(10, 'flat')).toBe('10% p.a. flat');
    expect(interestLabel(12.5, 'reducing')).toBe('12.5% p.a. reducing');
    expect(interestLabel(null, 'flat')).toBe('—');
  });
});
