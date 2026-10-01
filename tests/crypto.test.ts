/** PBKDF2 password hashing round-trips (WebCrypto, Workers-safe). */
import { describe, expect, it } from 'vitest';
import { hashPassword, randomToken, verifyPassword } from '../src/lib/crypto';

describe('password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('Correct-Horse-123');
    expect(hash.startsWith('pbkdf2$')).toBe(true);
    expect(await verifyPassword('Correct-Horse-123', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('Correct-Horse-123');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('uses a random salt each time (hashes differ)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2$abc$salt$hash')).toBe(false);
  });
});

describe('randomToken', () => {
  it('produces URL-safe unique tokens', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(/^[A-Za-z0-9_-]+$/.test(a)).toBe(true);
  });
});
