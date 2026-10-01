/** POST /api/admin/properties/[id]/update — update a property + add images. */
import type { APIRoute } from 'astro';
import { adminOrError, backWithError, dbOrError, readForm, seeOther } from '../../../../../lib/api';
import { nowISO } from '../../../../../lib/db';
import { computedTotal, parsePropertyForm, storeImages } from '../../../../../lib/properties';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const admin = adminOrError(context);
  if (admin instanceof Response) return admin;
  const id = context.params.id || '';

  const existing = await db
    .prepare('SELECT id FROM properties WHERE id = ? LIMIT 1')
    .bind(id)
    .first();
  if (!existing) return seeOther('/admin/properties');

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return backWithError(context.request, `/admin/properties/${id}/edit`, 'Invalid form submission.');
  }
  const parsed = parsePropertyForm(form);
  if (parsed.errors.length > 0) {
    return backWithError(context.request, `/admin/properties/${id}/edit`, parsed.errors[0]);
  }

  const { total, overridden } = computedTotal(parsed.areaSqft!, parsed.pricePerSqft!, parsed.totalOverride);
  await db
    .prepare(
      `UPDATE properties SET title = ?, type = ?, address = ?, area_sqft = ?, price_per_sqft = ?,
                             total_price = ?, price_overridden = ?, description = ?, status = ?,
                             updated_at = ? WHERE id = ?`,
    )
    .bind(
      parsed.title, parsed.type, parsed.address, parsed.areaSqft, parsed.pricePerSqft,
      total, overridden, parsed.description || null, parsed.status, nowISO(), id,
    )
    .run();

  if (parsed.images.length > 0) {
    const maxRow = await db
      .prepare('SELECT MAX(sort_order) AS m FROM property_images WHERE property_id = ?')
      .bind(id)
      .first<{ m: number | null }>();
    try {
      await storeImages(db, context.locals, id, parsed.images, (maxRow?.m ?? -1) + 1);
    } catch (e) {
      return backWithError(context.request, `/admin/properties/${id}/edit`, `Details saved, but image upload failed: ${(e as Error).message}`);
    }
  }

  return seeOther(`/admin/properties/${id}/edit?saved=1`);
};
