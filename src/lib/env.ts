/**
 * Environment access: Cloudflare runtime env on Pages/Workers, falling
 * back to process.env for local dev / tests. Never logs values.
 */

// Minimal ambient typing so `astro check` passes without @types/node;
// at runtime on Workers `process` is simply undefined (guarded below).
declare const process: { env?: Record<string, string | undefined> } | undefined;

export function getEnv(locals: unknown): Record<string, string | undefined> {
  try {
    const runtime = (locals as { runtime?: { env?: Record<string, unknown> } } | null | undefined)
      ?.runtime?.env;
    if (runtime) {
      const out: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(runtime)) {
        out[k] = typeof v === 'string' ? v : undefined;
      }
      return out;
    }
  } catch {
    /* fall through to process.env */
  }
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env as Record<string, string | undefined>;
    }
    return {};
  } catch {
    return {};
  }
}

/** True only when all three Google OAuth env vars are configured. */
export function googleConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}
