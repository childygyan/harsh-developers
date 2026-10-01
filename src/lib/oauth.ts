/**
 * Google OAuth 2.0 authorization-code flow (env-gated).
 *
 * Only active when GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
 * GOOGLE_REDIRECT_URI are all set — otherwise the "Continue with Google"
 * button is never rendered (see middleware locals.googleEnabled).
 */
import { getEnv } from './env';
import { randomToken } from './crypto';

export const OAUTH_STATE_COOKIE = 'hd_oauth_state';
const STATE_TTL_SECONDS = 600;

export function oauthStateCookieHeader(state: string, secure: boolean): string {
  const parts = [
    `${OAUTH_STATE_COOKIE}=${state}`,
    'Path=/api/auth/google',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${STATE_TTL_SECONDS}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearOauthStateCookieHeader(): string {
  return `${OAUTH_STATE_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function buildAuthUrl(env: Record<string, string | undefined>): { url: string; state: string } {
  const state = randomToken(24);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID || '',
    redirect_uri: env.GOOGLE_REDIRECT_URI || '',
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, state };
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  email_verified?: boolean;
}

/** Exchange the authorization code for tokens, then fetch the profile. */
export async function exchangeCode(
  env: Record<string, string | undefined>,
  code: string,
): Promise<GoogleProfile> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: env.GOOGLE_REDIRECT_URI || '',
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!tokenRes.ok) throw new Error('Token exchange failed');
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error('No access token returned');

  const meRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!meRes.ok) throw new Error('Failed to fetch Google profile');
  const profile = (await meRes.json()) as GoogleProfile;
  if (!profile.sub || !profile.email) throw new Error('Incomplete Google profile');
  return profile;
}
