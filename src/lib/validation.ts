/** Small input validators shared by API routes. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validEmail(s: unknown): s is string {
  return typeof s === 'string' && EMAIL_RE.test(s.trim()) && s.trim().length <= 254;
}

export function cleanStr(s: unknown, maxLen = 500): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, maxLen);
}

export function num(s: unknown): number | null {
  if (typeof s !== 'string' && typeof s !== 'number') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function int(s: unknown): number | null {
  const n = num(s);
  return n === null || !Number.isInteger(n) ? null : n;
}

export function validPassword(s: unknown): s is string {
  return typeof s === 'string' && s.length >= 8 && s.length <= 128;
}

export const PROPERTY_TYPES = ['gala', 'plot', 'flat'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_STATUSES = ['available', 'on-hold', 'sold'] as const;

export function typeLabel(t: string): string {
  if (t === 'gala') return 'Gala (Shop / Commercial Unit)';
  if (t === 'plot') return 'Plot';
  return 'Flat';
}
