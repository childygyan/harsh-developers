/** POST /api/admin/properties — create a property (multipart, with images). */
import type { APIRoute } from 'astro';
import { adminOrError, backWithError, dbOrError, readForm, seeOther } from '../../../lib/api';
import { nowISO, uid } from '../../../lib/db';
import { computedTotal, parsePropertyForm, storeImages } from '../../../lib/properties';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const admin = adminOrError(context);
  if (admin instanceof Response) return admin;

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return backWithError(context.request, '/admin/properties/new', 'Invalid form submission.');
  }
  const parsed = parsePropertyForm(form);
  if (parsed.errors.length > 0) {
    return backWithError(context.request, '/admin/properties/new', parsed.errors[0]);
  }

  const id = uid('p_');
  const now = nowISO();
  const { total, overridden } = computedTotal(parsed.areaSqft!, parsed.pricePerSqft!, parsed.totalOverride);
  await db
    .prepare(
      `INSERT INTO properties (id, title, type, address, area_sqft, price_per_sqft, total_price,
                               price_overridden, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, parsed.title, parsed.type, parsed.address, parsed.areaSqft, parsed.pricePerSqft,
      total, overridden, parsed.description || null, parsed.status, now, now,
    )
    .run();

  if (parsed.images.length > 0) {
    try {
      await storeImages(db, context.locals, id, parsed.images, 0);
    } catch (e) {
      return backWithError(context.request, `/admin/properties/${id}/edit`, `Property saved, but image upload failed: ${(e as Error).message}`);
    }
  }

  return seeOther('/admin/properties?created=1');
};
