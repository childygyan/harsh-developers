/** GET /api/auth/google — start the Google OAuth flow (env-gated). */
import type { APIRoute } from 'astro';
import { getEnv, googleConfigured } from '../../../lib/env';
import { buildAuthUrl, oauthStateCookieHeader } from '../../../lib/oauth';
import { isSecureRequest } from '../../../lib/api';

export const GET: APIRoute = async (context) => {
  const env = getEnv(context.locals);
  if (!googleConfigured(env)) {
    return new Response('Google sign-in is not configured.', { status: 404 });
  }
  const { url, state } = buildAuthUrl(env);
  return new Response(null, {
    status: 302,
    headers: {
      location: url,
      'set-cookie': oauthStateCookieHeader(state, isSecureRequest(context.request)),
    },
  });
};
