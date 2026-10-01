/** POST /api/admin/properties/[id]/delete — delete a property and its images. */
import type { APIRoute } from 'astro';
import { adminOrError, dbOrError, seeOther } from '../../../../../lib/api';
import { deleteImage } from '../../../../../lib/properties';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const admin = adminOrError(context);
  if (admin instanceof Response) return admin;
  const id = context.params.id || '';

  // Remove R2 objects first (best-effort), then the rows cascade.
  const images = await db
    .prepare('SELECT id FROM property_images WHERE property_id = ?')
    .bind(id)
    .all<{ id: string }>();
  for (const img of images.results) {
    await deleteImage(db, context.locals, img.id);
  }
  await db.prepare('DELETE FROM properties WHERE id = ?').bind(id).run();

  return seeOther('/admin/properties?deleted=1');
};
