/**
 * First-deploy admin seeding.
 *
 * On first deploy there are no users at all. If (and only if) the users
 * table has zero admins AND the ADMIN_EMAIL / ADMIN_PASSWORD env vars are
 * set, create the admin account with must_change_password=1 so the owner
 * is forced to pick their own password on first login.
 *
 * Called lazily from middleware on each request until an admin exists —
 * cheap (one indexed SELECT) and race-safe via the UNIQUE(email) guard.
 */
import { getEnv } from './env';
import { hashPassword } from './crypto';
import { nowISO, uid } from './db';
import { cleanStr, validEmail, validPassword } from './validation';

export async function ensureSeeded(db: D1Database, locals: unknown): Promise<void> {
  try {
    const existing = await db
      .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
      .first<{ id: string }>();
    if (existing) return;

    const env = getEnv(locals);
    const email = (env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = env.ADMIN_PASSWORD || '';
    if (!validEmail(email) || !validPassword(password)) return;

    const passwordHash = await hashPassword(password);
    const now = nowISO();
    await db
      .prepare(
        `INSERT INTO users (id, name, email, phone, password_hash, google_id, role, must_change_password, created_at)
         VALUES (?, ?, ?, NULL, ?, NULL, 'admin', 1, ?)`,
      )
      .bind(uid('u_'), cleanStr(email, 254), email, passwordHash, now)
      .run();

    // Seed the default interest % and type (admin can change them any time).
    await db
      .prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_interest_pct', '10')")
      .run();
    await db
      .prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_interest_type', 'reducing')")
      .run();
  } catch {
    // Seeding must never break a request; the admin can also be created
    // later via wrangler once env vars are set.
  }
}

/** Read a setting value (null when missing). */
export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  try {
    const row = await db.prepare('SELECT value FROM settings WHERE key = ? LIMIT 1').bind(key).first<{ value: string }>();
    return row?.value ?? null;
  } catch {
    return null;
  }
}
