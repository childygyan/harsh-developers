/** INR formatting: ₹ with Indian digit grouping. */
export function inr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function inr0(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return '₹' + Math.round(Number(n)).toLocaleString('en-IN');
}

export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${Number(n)}%`;
}
