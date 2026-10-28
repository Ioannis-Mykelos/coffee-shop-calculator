// Time-based one-time codes (TOTP, RFC 6238) for two-step login, as Google Authenticator, Microsoft Authenticator,
// 1Password and Authy read them: HMAC-SHA1, 6 digits, a new code every 30 seconds. The secret is kept encrypted
// (AES-256-GCM, key derived from AUTH_SECRET), and recovery codes only as hashes.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const STEP_SECONDS = 30;
export const DIGITS = 6;
/** Codes from one step before or after are accepted too, for clocks a little out */
const DRIFT_STEPS = 1;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string) {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = BASE32.indexOf(ch);
    if (i < 0) throw new Error('Not base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new secret: 20 random bytes (160 bits, as RFC 4226 recommends), base32 for the authenticator app. */
export const newSecret = () => base32Encode(randomBytes(20));

/** The code for one time step (HOTP, RFC 4226). */
export function codeAt(secret: string, step: number, digits = DIGITS) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export const stepAt = (now: Date) => Math.floor(now.getTime() / 1000 / STEP_SECONDS);

/**
 * The time step a code matches, within the allowed drift, or null. Steps up to `lastStep` were already used, so a
 * code can't be replayed (someone watching over a shoulder, or a phished code used twice).
 */
export function matchCode(secret: string, code: string, now: Date, lastStep = -1): number | null {
  const clean = code.replace(/\s/g, '');
  if (!new RegExp(`^\\d{${DIGITS}}$`).test(clean)) return null;
  const current = stepAt(now);
  for (let step = current - DRIFT_STEPS; step <= current + DRIFT_STEPS; step++) {
    if (step <= lastStep) continue;
    const expected = Buffer.from(codeAt(secret, step));
    if (timingSafeEqual(expected, Buffer.from(clean))) return step;
  }
  return null;
}

/** What the QR code holds: the otpauth:// link every authenticator app understands. */
export const otpauthUri = (secret: string, account: string, issuer = 'Crema') =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?${new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) })}`;

// ---------------------------------------------------------------------------
// The secret at rest

const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set: two-step login needs it to encrypt secrets.');
  return createHash('sha256').update(`crema-totp:${secret}`).digest();
};

/** "iv.tag.ciphertext", base64url */
export function sealSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function openSecret(sealed: string) {
  const [iv, tag, data] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// Recovery codes: for a lost phone. Ten, each works once; only their hashes are kept.

export const RECOVERY_CODES = 10;
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** "k7m2-q9xa": 8 characters without look-alikes (no 0/o, 1/l/i), in two groups */
export function newRecoveryCodes(count = RECOVERY_CODES) {
  const one = () => Array.from({ length: 8 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join('');
  return Array.from({ length: count }, () => {
    const c = one();
    return `${c.slice(0, 4)}-${c.slice(4)}`;
  });
}

/** How a recovery code is kept and compared: lower case, without spaces or the dash */
export const hashRecoveryCode = (code: string) => createHash('sha256').update(code.toLowerCase().replace(/[\s-]/g, '')).digest('hex');
