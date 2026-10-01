/** GET /img/[...key] — serve property images from the R2 bucket. */
import type { APIRoute } from 'astro';
import { getBucket } from '../../lib/db';

const ALLOWED_PREFIX = 'properties/';

export const GET: APIRoute = async (context) => {
  const key = context.params.key || '';
  // Only property images are servable; blocks path traversal outright.
  if (!key.startsWith(ALLOWED_PREFIX) || key.includes('..')) {
    return new Response('Not found', { status: 404 });
  }
  const bucket = getBucket(context.locals);
  if (!bucket) return new Response('Image storage unavailable', { status: 503 });
  const obj = await bucket.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('content-type', (obj.httpMetadata.contentType as string) || 'image/jpeg');
  headers.set('cache-control', 'public, max-age=86400');
  return new Response(obj.body, { headers });
};
