import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './auth.js';
describe('JWT utilities', () => {
  it('round-trips a signed access token', () => {
    const payload = { id: 'user_123', email: 'demo@neighborlink.local', role: 'USER' as const };
    expect(verifyAccessToken(signAccessToken(payload))).toMatchObject(payload);
  });
});
