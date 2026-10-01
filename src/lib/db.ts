/** D1 helpers. All queries are parameterized — never interpolate values. */

export function getDB(locals: unknown): D1Database | undefined {
  try {
    const db = (locals as { runtime?: { env?: Env } } | null | undefined)?.runtime?.env?.DB;
    return db ?? undefined;
  } catch {
    return undefined;
  }
}

export function getBucket(locals: unknown): R2Bucket | undefined {
  try {
    const b = (locals as { runtime?: { env?: Env } } | null | undefined)?.runtime?.env?.IMAGES;
    return b ?? undefined;
  } catch {
    return undefined;
  }
}

/** Collision-safe id: prefix + 24 hex chars from crypto randomness. */
export function uid(prefix = ''): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return `${prefix}${hex}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}
