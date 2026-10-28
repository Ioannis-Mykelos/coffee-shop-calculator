import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  codeAt,
  hashRecoveryCode,
  matchCode,
  newRecoveryCodes,
  newSecret,
  openSecret,
  otpauthUri,
  sealSecret,
  stepAt,
} from './totp';

// RFC 6238 appendix B: the SHA-1 secret is the ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('matches the RFC 6238 test values (SHA-1, 30-second steps)', () => {
    const at = (seconds: number) => stepAt(new Date(seconds * 1000));
    expect(codeAt(RFC_SECRET, at(59), 8)).toBe('94287082');
    expect(codeAt(RFC_SECRET, at(1111111109), 8)).toBe('07081804');
    expect(codeAt(RFC_SECRET, at(1234567890), 8)).toBe('89005924');
    expect(codeAt(RFC_SECRET, at(2000000000), 8)).toBe('69279037');
    // The 6-digit codes the apps show are the last six digits.
    expect(codeAt(RFC_SECRET, at(59))).toBe('287082');
  });

  it('round-trips base32 and makes 160-bit secrets', () => {
    expect(base32Decode(base32Encode(Buffer.from('hello world'))).toString()).toBe('hello world');
    expect(base32Decode('jbsw y3dp-')).toEqual(base32Decode('JBSWY3DP'));
    expect(base32Decode(newSecret())).toHaveLength(20);
  });

  it('accepts the code of now or one step either side, once', () => {
    const now = new Date(1_800_000_000_000);
    const step = stepAt(now);
    expect(matchCode(RFC_SECRET, codeAt(RFC_SECRET, step), now)).toBe(step);
    expect(matchCode(RFC_SECRET, codeAt(RFC_SECRET, step - 1), now)).toBe(step - 1);
    expect(matchCode(RFC_SECRET, codeAt(RFC_SECRET, step + 1), now)).toBe(step + 1);
    expect(matchCode(RFC_SECRET, codeAt(RFC_SECRET, step - 2), now)).toBeNull();
    // Already used: no replay.
    expect(matchCode(RFC_SECRET, codeAt(RFC_SECRET, step), now, step)).toBeNull();
    expect(matchCode(RFC_SECRET, ` ${codeAt(RFC_SECRET, step).slice(0, 3)} ${codeAt(RFC_SECRET, step).slice(3)} `, now)).toBe(step);
    expect(matchCode(RFC_SECRET, '12345', now)).toBeNull();
    expect(matchCode(RFC_SECRET, 'abcdef', now)).toBeNull();
  });

  it('builds the otpauth link authenticator apps (Google, Microsoft, 1Password) scan', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP', 'sam@example.com');
    expect(uri).toBe('otpauth://totp/Crema%3Asam%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Crema&algorithm=SHA1&digits=6&period=30');
  });
});

describe('secrets at rest and recovery codes', () => {
  const saved = process.env.AUTH_SECRET;
  beforeAll(() => {
    process.env.AUTH_SECRET = 'test-secret';
  });
  afterAll(() => {
    process.env.AUTH_SECRET = saved;
  });

  it('encrypts the secret, and detects tampering', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP');
    expect(sealed).not.toContain('JBSWY3DP');
    expect(openSecret(sealed)).toBe('JBSWY3DPEHPK3PXP');
    // Flip one bit of the ciphertext. Swapping base64 characters isn't enough: the last one carries only 2 bits of data,
    // so an edit there can decode to the same bytes (it did, now and then).
    const [iv, tag, data] = sealed.split('.');
    const bytes = Buffer.from(data, 'base64url');
    bytes[0] ^= 1;
    expect(() => openSecret([iv, tag, bytes.toString('base64url')].join('.'))).toThrow();
  });

  it('makes ten readable recovery codes, compared without case, spaces or the dash', () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/);
    expect(hashRecoveryCode('K7M2-Q9XA')).toBe(hashRecoveryCode(' k7m2q9xa'));
  });
});
