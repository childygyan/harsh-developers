/** Shared property form parsing + R2 image upload for admin property endpoints. */
import { getBucket } from './db';
import { uid } from './db';
import { cleanStr, int, num, PROPERTY_STATUSES, PROPERTY_TYPES } from './validation';

export interface PropertyForm {
  title: string;
  type: string;
  address: string;
  areaSqft: number | null;
  pricePerSqft: number | null;
  totalOverride: number | null;
  description: string;
  status: string;
  images: File[];
  errors: string[];
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function parsePropertyForm(form: FormData): PropertyForm {
  const errors: string[] = [];
  const title = cleanStr(form.get('title'), 200);
  const type = cleanStr(form.get('type'), 20);
  const address = cleanStr(form.get('address'), 300);
  const areaSqft = num(form.get('area_sqft'));
  const pricePerSqft = num(form.get('price_per_sqft'));
  const totalRaw = cleanStr(form.get('total_price'), 30);
  const totalOverride = totalRaw === '' ? null : num(totalRaw);
  const description = cleanStr(form.get('description'), 5000);
  const status = cleanStr(form.get('status'), 20) || 'available';

  if (!title) errors.push('Title is required.');
  if (!(PROPERTY_TYPES as readonly string[]).includes(type)) errors.push('Type must be gala, plot, or flat.');
  if (!address) errors.push('Address / location is required.');
  if (areaSqft === null || areaSqft <= 0) errors.push('Area (sq ft) must be a positive number.');
  if (pricePerSqft === null || pricePerSqft < 0) errors.push('Price per sq ft must be 0 or more.');
  if (totalOverride !== null && totalOverride <= 0) errors.push('Total price override must be positive.');
  if (!(PROPERTY_STATUSES as readonly string[]).includes(status)) errors.push('Invalid status.');

  const images: File[] = [];
  for (const f of form.getAll('images')) {
    if (f instanceof File && f.size > 0) {
      if (!ALLOWED_TYPES.has(f.type)) {
        errors.push(`"${f.name}" is not a supported image (JPEG/PNG/WebP/GIF).`);
        continue;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        errors.push(`"${f.name}" exceeds the 5 MB limit.`);
        continue;
      }
      images.push(f);
    }
  }

  return { title, type, address, areaSqft, pricePerSqft, totalOverride, description, status, images, errors };
}

export function computedTotal(area: number, rate: number, override: number | null): { total: number; overridden: number } {
  if (override !== null) return { total: override, overridden: 1 };
  return { total: Math.round(area * rate * 100) / 100, overridden: 0 };
}

function extFor(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  return 'jpg';
}

/** Upload files to R2 and record them. Returns the stored r2 keys. */
export async function storeImages(
  db: D1Database,
  locals: unknown,
  propertyId: string,
  images: File[],
  startOrder: number,
): Promise<string[]> {
  const bucket = getBucket(locals);
  if (!bucket) throw new Error('Image storage (R2) is not configured.');
  const keys: string[] = [];
  let order = startOrder;
  for (const file of images) {
    const key = `properties/${propertyId}/${uid('img_')}.${extFor(file)}`;
    const buf = await file.arrayBuffer();
    await bucket.put(key, buf, { httpMetadata: { contentType: file.type } });
    await db
      .prepare('INSERT INTO property_images (id, property_id, r2_key, sort_order) VALUES (?, ?, ?, ?)')
      .bind(uid('pi_'), propertyId, key, order);
    keys.push(key);
    order++;
  }
  return keys;
}

/** Delete an image row + its R2 object. */
export async function deleteImage(db: D1Database, locals: unknown, imageId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT id, r2_key FROM property_images WHERE id = ? LIMIT 1')
    .bind(imageId)
    .first<{ id: string; r2_key: string }>();
  if (!row) return false;
  await db.prepare('DELETE FROM property_images WHERE id = ?').bind(imageId).run();
  const bucket = getBucket(locals);
  if (bucket) {
    try {
      await bucket.delete(row.r2_key);
    } catch {
      /* row already deleted; object cleanup is best-effort */
    }
  }
  return true;
}
