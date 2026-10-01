/** POST /api/applications — logged-in user applies for a property. */
import type { APIRoute } from 'astro';
import { backWithError, dbOrError, readForm, seeOther, userOrError } from '../../lib/api';
import { nowISO, uid } from '../../lib/db';
import { cleanStr } from '../../lib/validation';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const user = userOrError(context);
  if (user instanceof Response) return user;

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return backWithError(context.request, '/', 'Invalid form submission.');
  }
  const propertyId = cleanStr(form.get('property_id'), 64);
  if (!propertyId) return backWithError(context.request, '/', 'Missing property.');

  const prop = await db
    .prepare("SELECT id, status FROM properties WHERE id = ? LIMIT 1")
    .bind(propertyId)
    .first<{ id: string; status: string }>();
  if (!prop) return backWithError(context.request, '/', 'Property not found.');
  if (prop.status !== 'available')
    return backWithError(context.request, `/properties/${prop.id}`, 'This property is no longer available.');

  const existing = await db
    .prepare('SELECT id, status FROM applications WHERE user_id = ? AND property_id = ? LIMIT 1')
    .bind(user.id, propertyId)
    .first<{ id: string; status: string }>();
  if (existing) {
    return seeOther(`/dashboard?notice=${encodeURIComponent('You have already applied for this property.')}`);
  }

  await db
    .prepare(
      `INSERT INTO applications (id, user_id, property_id, status, note, created_at, decided_at)
       VALUES (?, ?, ?, 'pending', NULL, ?, NULL)`,
    )
    .bind(uid('ap_'), user.id, propertyId, nowISO())
    .run();

  return seeOther('/dashboard?applied=1');
};
