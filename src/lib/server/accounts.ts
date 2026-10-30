// Email + password accounts: joining, email verification, password checks, password reset, two-step login, and the
// settings a signed-in owner can change (password, two-step login, deleting the account).
// The storage and the mailer are passed in, so this runs against MongoDB in the app and an in-memory store in tests.
//
// A join only becomes an account when its emailed link is used, and the password chosen in that join comes with it.
// Joining again with an unconfirmed address replaces the pending password and names, and only the newest link
// works: someone who joins with your address can't get their password onto your account, because only you
// receive the links.
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { planOf, type Plan } from '../plan';
import { hashRecoveryCode, matchCode, newRecoveryCodes, newSecret, openSecret, otpauthUri, sealSecret } from './totp';
import { log } from './log';

export interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Auth.js's field: when the email address was confirmed, or null */
  emailVerified: Date | null;
  /** Set when the email is confirmed; the password from the join whose link was used */
  passwordHash?: string;
  /** Password chosen in the latest join, waiting for its confirmation link */
  pendingPasswordHash?: string;
  /** SHA-256 of the latest confirmation token; the token itself is only in the email */
  verifyTokenHash?: string;
  verifyTokenExpires?: Date;
  /** SHA-256 of the latest password reset token; the token itself is only in the email */
  resetTokenHash?: string;
  resetTokenExpires?: Date;
  /** Two-step login (lib/server/totp.ts): the authenticator secret (encrypted), since when it's on, the last code's time step */
  totpSecret?: string;
  totpEnabledAt?: Date;
  totpLastStep?: number;
  /** A secret being set up, until a first code from the app confirms it */
  totpPendingSecret?: string;
  /** SHA-256 of the recovery codes not used yet */
  recoveryCodeHashes?: string[];
  /** Sessions started before this are ended (set when the password is changed or reset) */
  sessionsValidFrom?: Date;
  /** Last account email we sent, to throttle resends */
  lastEmailAt?: Date;
  /** When they accepted the Terms and the Privacy Policy */
  consentAt?: Date;
  /** Free or Pro; none means free (lib/plan.ts). Google accounts are made by Auth.js's adapter, so don't rely on it being set */
  plan?: Plan;
  createdAt: Date;
}

export interface UserStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findByTokenHash(hash: string): Promise<UserRecord | null>;
  findByResetTokenHash(hash: string): Promise<UserRecord | null>;
  insert(user: Omit<UserRecord, 'id'>): Promise<void>;
  update(id: string, set: Partial<UserRecord>, unset?: (keyof UserRecord)[]): Promise<void>;
  /** Deletes the account and everything kept for it: sign-in links and its figures. */
  remove(id: string): Promise<void>;
}

export type Mail = { to: string; subject: string; text: string };
export type SendMail = (mail: Mail) => Promise<void>;

export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;
/** Minimum gap between account emails to one address */
export const EMAIL_COOLDOWN_MS = 60 * 1000;
const BCRYPT_COST = 12;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

// ---------------------------------------------------------------------------
// Validation

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The message for a password that can't be used, or null. */
export function passwordError(password: unknown): string | null {
  const value = typeof password === 'string' ? password : '';
  // bcrypt only reads the first 72 bytes, so longer passwords would be silently cut.
  return value.length < 8 || new TextEncoder().encode(value).length > 72 ? 'Use 8 to 72 characters.' : null;
}

export interface JoinInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  consent: boolean;
}

/** Field → message for every invalid field; empty when the input is fine. */
export function validateJoin(input: Partial<Record<keyof JoinInput, unknown>>): Partial<Record<keyof JoinInput, string>> {
  const errors: Partial<Record<keyof JoinInput, string>> = {};
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  if (!text(input.firstName) || text(input.firstName).length > 50) errors.firstName = 'Enter your first name (up to 50 characters).';
  if (!text(input.lastName) || text(input.lastName).length > 50) errors.lastName = 'Enter your last name (up to 50 characters).';
  const email = text(input.email);
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  const password = passwordError(input.password);
  if (password) errors.password = password;
  if (input.consent !== true) errors.consent = 'Accept the Terms and the Privacy Policy to create an account.';
  return errors;
}

// ---------------------------------------------------------------------------
// Emails

const verifyMail = (to: string, firstName: string, link: string): Mail => ({
  to,
  subject: 'Confirm your Crema account',
  text: `Hi ${firstName},\n\nConfirm your email address to finish creating your Crema account:\n${link}\n\nThe link works for 24 hours. If you didn't create an account, ignore this email.\n\nThe Crema team`,
});

const alreadyRegisteredMail = (to: string, appUrl: string): Mail => ({
  to,
  subject: 'You already have a Crema account',
  text: `Someone (hopefully you) tried to create a Crema account with this email address, but you already have one.\n\nLog in at ${appUrl}/login. If you've forgotten your password, use "Forgot password?" on the log-in screen.\n\nIf this wasn't you, you can ignore this email.`,
});

const resetMail = (to: string, firstName: string, link: string): Mail => ({
  to,
  subject: 'Reset your Crema password',
  text: `Hi ${firstName},

Choose a new password for your Crema account:
${link}

The link works once, for 1 hour. Choosing a new password logs you out everywhere.

If you didn't ask for this, ignore this email: your password stays the same.

The Crema team`,
});

const passwordChangedMail = (to: string, firstName: string): Mail => ({
  to,
  subject: 'Your Crema password was changed',
  text: `Hi ${firstName},

The password for your Crema account was just changed, and every other device was logged out.

If this wasn't you, reset your password now with "Forgot password?" on the log-in screen.`,
});

const twoFactorMail = (to: string, firstName: string, on: boolean): Mail => ({
  to,
  subject: on ? 'Two-step login is on for your Crema account' : 'Two-step login was turned off',
  text: on
    ? `Hi ${firstName},

Two-step login is now on: logging in with your email and password also asks for a code from your authenticator app. Keep your recovery codes somewhere safe, in case you lose your phone.

If this wasn't you, reset your password now with "Forgot password?" on the log-in screen.`
    : `Hi ${firstName},

Two-step login was turned off for your Crema account: logging in now only needs your email and password.

If this wasn't you, reset your password now with "Forgot password?" on the log-in screen, then turn two-step login back on.`,
});

const recoveryUsedMail = (to: string, firstName: string, left: number): Mail => ({
  to,
  subject: 'A recovery code was used to log in to Crema',
  text: `Hi ${firstName},

Someone logged in to your Crema account with one of your two-step login recovery codes. You have ${left} left.

If this wasn't you, reset your password now with "Forgot password?" on the log-in screen.`,
});

const deletedMail = (to: string, firstName: string): Mail => ({
  to,
  subject: 'Your Crema account was deleted',
  text: `Hi ${firstName},

Your Crema account and all its figures have been deleted, as you asked. You can join again any time with this address.

The Crema team`,
});

// ---------------------------------------------------------------------------

export interface Deps {
  store: UserStore;
  sendMail: SendMail;
  appUrl: string;
  now?: () => Date;
  /** bcrypt cost; tests lower it to stay fast */
  hashCost?: number;
}

const canEmail = (user: UserRecord, now: Date) => !user.lastEmailAt || now.getTime() - user.lastEmailAt.getTime() >= EMAIL_COOLDOWN_MS;

async function issueVerification(deps: Deps, user: Pick<UserRecord, 'id' | 'email' | 'firstName'>, now: Date) {
  const token = randomBytes(32).toString('hex');
  await deps.store.update(user.id, {
    verifyTokenHash: hashToken(token),
    verifyTokenExpires: new Date(now.getTime() + TOKEN_TTL_MS),
    lastEmailAt: now,
  });
  await deps.sendMail(verifyMail(user.email, user.firstName, `${deps.appUrl}/verify-email?token=${token}`));
}

/**
 * Creates an unverified account and emails a confirmation link. The caller always gets the same answer, so the
 * response never reveals whether an address is registered; an existing owner gets a "you already have an
 * account" email instead (throttled like every account email).
 */
export async function join(deps: Deps, input: JoinInput): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const email = normalizeEmail(input.email);
  const existing = await deps.store.findByEmail(email);

  if (existing) {
    if (!canEmail(existing, now)) return;
    if (existing.emailVerified) {
      await deps.store.update(existing.id, { lastEmailAt: now });
      await deps.sendMail(alreadyRegisteredMail(email, deps.appUrl));
      return;
    }
    // Not confirmed yet: this join replaces the pending one, and gets the only working link.
    const firstName = input.firstName.trim();
    await deps.store.update(existing.id, {
      firstName,
      lastName: input.lastName.trim(),
      pendingPasswordHash: await bcrypt.hash(input.password, deps.hashCost ?? BCRYPT_COST),
      consentAt: now,
    });
    await issueVerification(deps, { ...existing, firstName }, now);
    return;
  }

  await deps.store.insert({
    email,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    emailVerified: null,
    pendingPasswordHash: await bcrypt.hash(input.password, deps.hashCost ?? BCRYPT_COST),
    consentAt: now,
    createdAt: now,
  });
  const created = await deps.store.findByEmail(email);
  if (created) await issueVerification(deps, created, now);
}

/** Sends a new confirmation link to an unverified account. Silent for unknown or verified addresses. */
export async function resendVerification(deps: Deps, rawEmail: string): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const user = await deps.store.findByEmail(normalizeEmail(rawEmail));
  if (!user || user.emailVerified || !user.pendingPasswordHash || !canEmail(user, now)) return;
  await issueVerification(deps, user, now);
}

export type VerifyResult = 'verified' | 'invalid' | 'expired';

/** Confirms the email address for the account the link was sent to. Each link works once. */
export async function verifyEmail(deps: Pick<Deps, 'store' | 'now'>, token: string): Promise<VerifyResult> {
  if (!/^[0-9a-f]{64}$/.test(token)) return 'invalid';
  const now = deps.now?.() ?? new Date();
  const user = await deps.store.findByTokenHash(hashToken(token));
  if (!user) return 'invalid';
  if (!user.verifyTokenExpires || user.verifyTokenExpires < now || !user.pendingPasswordHash) return 'expired';
  await deps.store.update(user.id, { emailVerified: now, passwordHash: user.pendingPasswordHash }, [
    'pendingPasswordHash',
    'verifyTokenHash',
    'verifyTokenExpires',
  ]);
  return 'verified';
}

export type PasswordCheck = { ok: true; user: UserRecord } | { ok: false; reason: 'invalid' | 'unverified' };

/**
 * Checks an email + password. "unverified" is only returned after the password matched, so it never tells a
 * stranger that an address is registered.
 */
export async function checkPassword(deps: Pick<Deps, 'store'>, rawEmail: string, password: string): Promise<PasswordCheck> {
  const user = await deps.store.findByEmail(normalizeEmail(rawEmail));
  // An unconfirmed join is checked against its pending password, only to say "confirm your email first".
  const hash = user?.emailVerified ? user.passwordHash : user?.pendingPasswordHash;
  if (!user || !hash) {
    // Same work as a real check, so the response time doesn't reveal whether the account exists.
    await bcrypt.compare(password, await dummyHash());
    return { ok: false, reason: 'invalid' };
  }
  if (!(await bcrypt.compare(password, hash))) return { ok: false, reason: 'invalid' };
  if (!user.emailVerified) return { ok: false, reason: 'unverified' };
  return { ok: true, user };
}
let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= bcrypt.hash('not-a-real-password', BCRYPT_COST));

/**
 * Before Google signs someone into an existing account with their address: an account that was never verified
 * may have been created by someone else with this address, so its password is removed and Google's verified
 * address confirms it.
 */
export async function claimForVerifiedEmail(deps: Pick<Deps, 'store' | 'now'>, rawEmail: string): Promise<void> {
  const user = await deps.store.findByEmail(normalizeEmail(rawEmail));
  if (!user || user.emailVerified) return;
  await deps.store.update(user.id, { emailVerified: deps.now?.() ?? new Date() }, ['pendingPasswordHash', 'verifyTokenHash', 'verifyTokenExpires']);
}

// ---------------------------------------------------------------------------
// Password reset

/**
 * Emails a link to choose a new password. Silent for unknown addresses, so it never reveals who has an account,
 * and throttled like every account email. Works for a Google account too (it then gets a password), and for an
 * unconfirmed join: using the link proves the address, so it confirms the account as well.
 */
export async function requestPasswordReset(deps: Deps, rawEmail: string): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const user = await deps.store.findByEmail(normalizeEmail(rawEmail));
  if (!user || !canEmail(user, now)) return;
  const token = randomBytes(32).toString('hex');
  await deps.store.update(user.id, {
    resetTokenHash: hashToken(token),
    resetTokenExpires: new Date(now.getTime() + RESET_TTL_MS),
    lastEmailAt: now,
  });
  await deps.sendMail(resetMail(user.email, user.firstName || 'there', `${deps.appUrl}/reset-password?token=${token}`));
}

export type ResetResult = 'reset' | 'invalid' | 'expired';

/** Sets the new password for the account the link was sent to, and ends its other sessions. Each link works once. */
export async function resetPassword(deps: Pick<Deps, 'store' | 'now' | 'hashCost'>, token: string, password: string): Promise<ResetResult> {
  if (!/^[0-9a-f]{64}$/.test(token)) return 'invalid';
  const now = deps.now?.() ?? new Date();
  const user = await deps.store.findByResetTokenHash(hashToken(token));
  if (!user) return 'invalid';
  if (!user.resetTokenExpires || user.resetTokenExpires < now) return 'expired';
  await deps.store.update(
    user.id,
    {
      passwordHash: await bcrypt.hash(password, deps.hashCost ?? BCRYPT_COST),
      emailVerified: user.emailVerified ?? now,
      sessionsValidFrom: now,
    },
    // A pending join's password and link are replaced by this one.
    ['resetTokenHash', 'resetTokenExpires', 'pendingPasswordHash', 'verifyTokenHash', 'verifyTokenExpires'],
  );
  return 'reset';
}

// ---------------------------------------------------------------------------
// Settings a signed-in owner can change. Each one asks for the current password again, so a session left open
// on a shared computer can't be used to take over or delete the account. An account made with Google has no
// password: the owner sets one first with a reset link (requestPasswordReset works for any account).

type Reauth = { ok: true; user: UserRecord } | { ok: false; reason: 'wrong-password' | 'no-password' };

/** The account, if `password` is its password. */
async function reauth(deps: Pick<Deps, 'store'>, userId: string, password: unknown): Promise<Reauth> {
  const user = await deps.store.findById(userId);
  if (!user?.passwordHash) return { ok: false, reason: user ? 'no-password' : 'wrong-password' };
  const ok = typeof password === 'string' && (await bcrypt.compare(password, user.passwordHash));
  return ok ? { ok: true, user } : { ok: false, reason: 'wrong-password' };
}

/** What the settings page needs to know. Null if there is no such account. */
export async function accountSettings(deps: Pick<Deps, 'store'>, userId: string) {
  const user = await deps.store.findById(userId);
  if (!user) return null;
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    hasPassword: !!user.passwordHash,
    twoFactorSince: user.totpEnabledAt?.toISOString() ?? null,
    recoveryCodesLeft: user.recoveryCodeHashes?.length ?? 0,
    plan: planOf(user.plan),
  };
}

export type ChangePasswordResult = 'changed' | 'wrong-password' | 'no-password';

/**
 * Sets a new password (the caller has checked it with passwordError) and ends every session started before now,
 * this one too: the browser logs straight back in with the new password. Old reset links stop working.
 */
export async function changePassword(deps: Deps, userId: string, current: unknown, next: string): Promise<ChangePasswordResult> {
  const check = await reauth(deps, userId, current);
  if (!check.ok) return check.reason;
  const now = deps.now?.() ?? new Date();
  await deps.store.update(userId, { passwordHash: await bcrypt.hash(next, deps.hashCost ?? BCRYPT_COST), sessionsValidFrom: now }, [
    'resetTokenHash',
    'resetTokenExpires',
  ]);
  await deps.sendMail(passwordChangedMail(check.user.email, check.user.firstName || 'there')).catch((error) => log('error', 'account email failed', { error }));
  return 'changed';
}

export type DeleteResult = 'deleted' | 'wrong-password' | 'login-again';

/** How recently an account without a password must have logged in (with Google) to be deleted. */
export const RECENT_LOGIN_MS = 10 * 60 * 1000;

/**
 * Deletes the account and its figures for good. An account with a password needs it again; an account made with
 * Google, which may never get one (no emailed link when the site is Google-only), needs a log in from the last 10
 * minutes instead (`loginAt`, from the session).
 */
export async function deleteAccount(deps: Deps, userId: string, proof: { password?: unknown; loginAt?: number }): Promise<DeleteResult> {
  const user = await deps.store.findById(userId);
  if (!user) return 'wrong-password';
  if (user.passwordHash) {
    const check = await reauth(deps, userId, proof.password);
    if (!check.ok) return 'wrong-password';
  } else if (!(typeof proof.loginAt === 'number' && (deps.now?.() ?? new Date()).getTime() - proof.loginAt < RECENT_LOGIN_MS)) {
    return 'login-again';
  }
  await deps.store.remove(userId);
  // The account is gone either way; a failed goodbye email isn't worth an error.
  await deps.sendMail(deletedMail(user.email, user.firstName || 'there')).catch((error) => log('error', 'account email failed', { error }));
  return 'deleted';
}

// ---------------------------------------------------------------------------
// Two-step login: a code from an authenticator app (Google or Microsoft Authenticator, 1Password, Authy…) after the
// password, for email + password log in. Google sign-in relies on Google's own security.

export type StartTwoFactor = { ok: true; secret: string; uri: string } | { ok: false; reason: 'wrong-password' | 'no-password' | 'already-on' };

/** Starts setting up: a new secret for the app to scan. It only counts once a code from the app confirms it. */
export async function startTwoFactor(deps: Pick<Deps, 'store'>, userId: string, password: unknown): Promise<StartTwoFactor> {
  const check = await reauth(deps, userId, password);
  if (!check.ok) return check;
  if (check.user.totpEnabledAt) return { ok: false, reason: 'already-on' };
  const secret = newSecret();
  await deps.store.update(userId, { totpPendingSecret: sealSecret(secret) });
  return { ok: true, secret, uri: otpauthUri(secret, check.user.email) };
}

export type EnableTwoFactor = { ok: true; recoveryCodes: string[] } | { ok: false; reason: 'invalid-code' | 'not-started' | 'already-on' };

/** Turns two-step login on with the first code from the app, and hands out recovery codes (shown once). */
export async function enableTwoFactor(deps: Deps, userId: string, code: unknown): Promise<EnableTwoFactor> {
  const user = await deps.store.findById(userId);
  if (!user?.totpPendingSecret) return { ok: false, reason: user?.totpEnabledAt ? 'already-on' : 'not-started' };
  if (user.totpEnabledAt) return { ok: false, reason: 'already-on' };
  const now = deps.now?.() ?? new Date();
  const secret = readSecret(user.totpPendingSecret);
  if (!secret) return { ok: false, reason: 'not-started' };
  const step = typeof code === 'string' ? matchCode(secret, code, now) : null;
  if (step === null) return { ok: false, reason: 'invalid-code' };
  const recoveryCodes = newRecoveryCodes();
  await deps.store.update(
    userId,
    { totpSecret: user.totpPendingSecret, totpEnabledAt: now, totpLastStep: step, recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode) },
    ['totpPendingSecret'],
  );
  await deps.sendMail(twoFactorMail(user.email, user.firstName || 'there', true)).catch((error) => log('error', 'account email failed', { error }));
  return { ok: true, recoveryCodes };
}

/**
 * The secret, or null if it can't be decrypted: AUTH_SECRET changed since it was stored. Codes from the app then
 * stop matching, but recovery codes (hashes, not encrypted) still let the owner in to set two-step login up again.
 */
function readSecret(sealed: string) {
  try {
    return openSecret(sealed);
  } catch (error) {
    log('error', 'two-step secret unreadable', { error, hint: 'has AUTH_SECRET changed?' });
    return null;
  }
}

/**
 * Checks the second step at log in: a code from the app (each works once) or a recovery code (used up, and the
 * owner is told). True when it passes.
 */
export async function checkSecondFactor(deps: Pick<Deps, 'store' | 'sendMail' | 'now'>, user: UserRecord, code: unknown): Promise<boolean> {
  if (!user.totpSecret || typeof code !== 'string') return false;
  const now = deps.now?.() ?? new Date();
  const secret = readSecret(user.totpSecret);
  const step = secret ? matchCode(secret, code, now, user.totpLastStep ?? -1) : null;
  if (step !== null) {
    await deps.store.update(user.id, { totpLastStep: step });
    return true;
  }
  const hash = hashRecoveryCode(code);
  const left = user.recoveryCodeHashes ?? [];
  if (!/^[a-z0-9]{8}$/i.test(code.replace(/[\s-]/g, '')) || !left.includes(hash)) return false;
  const rest = left.filter((h) => h !== hash);
  await deps.store.update(user.id, { recoveryCodeHashes: rest });
  await deps.sendMail(recoveryUsedMail(user.email, user.firstName || 'there', rest.length)).catch((error) => log('error', 'account email failed', { error }));
  return true;
}

export type DisableTwoFactor = 'disabled' | 'wrong-password' | 'no-password' | 'invalid-code' | 'not-on';

/** Turns two-step login off: needs the password and a code from the app (or a recovery code). */
export async function disableTwoFactor(deps: Deps, userId: string, password: unknown, code: unknown): Promise<DisableTwoFactor> {
  const check = await reauth(deps, userId, password);
  if (!check.ok) return check.reason;
  if (!check.user.totpEnabledAt) return 'not-on';
  if (!(await checkSecondFactor(deps, check.user, code))) return 'invalid-code';
  await deps.store.update(userId, {}, ['totpSecret', 'totpEnabledAt', 'totpLastStep', 'totpPendingSecret', 'recoveryCodeHashes']);
  await deps.sendMail(twoFactorMail(check.user.email, check.user.firstName || 'there', false)).catch((error) => log('error', 'account email failed', { error }));
  return 'disabled';
}

/** Whether log in needs a second step for this account */
export const needsSecondFactor = (user: UserRecord) => !!user.totpEnabledAt && !!user.totpSecret;
