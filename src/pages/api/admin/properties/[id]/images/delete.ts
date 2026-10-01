/** POST /api/admin/properties/[id]/images/delete — remove one image. */
import type { APIRoute } from 'astro';
import { adminOrError, backWithError, dbOrError, readForm, seeOther } from '../../../../../../lib/api';
import { deleteImage } from '../../../../../../lib/properties';
import { cleanStr } from '../../../../../../lib/validation';

export const POST: APIRoute = async (context) => {
  const db = dbOrError(context);
  if (db instanceof Response) return db;
  const admin = adminOrError(context);
  if (admin instanceof Response) return admin;
  const id = context.params.id || '';

  let form: FormData;
  try {
    form = await readForm(context.request);
  } catch {
    return seeOther(`/admin/properties/${id}/edit`);
  }
  const imageId = cleanStr(form.get('image_id'), 64);
  if (imageId) await deleteImage(db, context.locals, imageId);
  return seeOther(`/admin/properties/${id}/edit?saved=1`);
};
