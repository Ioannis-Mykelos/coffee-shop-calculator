import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codeAt, stepAt } from './totp';
import {
  accountSettings,
  changePassword,
  checkSecondFactor,
  disableTwoFactor,
  enableTwoFactor,
  needsSecondFactor,
  startTwoFactor,
  checkPassword,
  claimForVerifiedEmail,
  deleteAccount,
  EMAIL_COOLDOWN_MS,
  join,
  passwordError,
  RECENT_LOGIN_MS,
  requestPasswordReset,
  resendVerification,
  RESET_TTL_MS,
  resetPassword,
  TOKEN_TTL_MS,
  validateJoin,
  verifyEmail,
  type Deps,
  type Mail,
  type UserRecord,
  type UserStore,
} from './accounts';

/** In-memory stand-in for the MongoDB users collection. */
function memoryStore(): UserStore & { users: UserRecord[] } {
  const users: UserRecord[] = [];
  let ids = 0;
  return {
    users,
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async findByTokenHash(hash) {
      return users.find((u) => u.verifyTokenHash === hash) ?? null;
    },
    async findByResetTokenHash(hash) {
      return users.find((u) => u.resetTokenHash === hash) ?? null;
    },
    async remove(id) {
      users.splice(users.findIndex((u) => u.id === id), 1);
    },
    async insert(user) {
      users.push({ ...user, id: String(++ids) });
    },
    async update(id, set, unset = []) {
      const user = users.find((u) => u.id === id)!;
      Object.assign(user, set);
      for (const key of unset) delete user[key];
    },
  };
}

function setup() {
  const store = memoryStore();
  const mail: Mail[] = [];
  let clock = new Date('2026-01-01T10:00:00Z');
  const deps: Deps = {
    store,
    sendMail: async (m) => void mail.push(m),
    appUrl: 'http://localhost:3000',
    now: () => clock,
    hashCost: 4,
  };
  const later = (ms: number) => (clock = new Date(clock.getTime() + ms));
  const lastToken = () => /token=([0-9a-f]{64})/.exec(mail.at(-1)!.text)![1];
  return { store, mail, deps, later, lastToken };
}

const ALEX = { firstName: 'Alex', lastName: 'Morgan', email: 'Alex.Morgan@Example.com ', password: 'correct horse', consent: true };

describe('validateJoin', () => {
  it('accepts a complete join', () => {
    expect(validateJoin(ALEX)).toEqual({});
  });

  it('names every problem', () => {
    expect(Object.keys(validateJoin({ firstName: ' ', email: 'nope', password: 'short', consent: false }))).toEqual([
      'firstName',
      'lastName',
      'email',
      'password',
      'consent',
    ]);
  });

  it('rejects passwords bcrypt would cut short', () => {
    expect(validateJoin({ ...ALEX, password: 'é'.repeat(37) }).password).toBeDefined(); // 74 bytes
  });
});

describe('join and verify', () => {
  it('creates an unconfirmed account and emails a link that confirms it once', async () => {
    const { store, mail, deps, lastToken } = setup();
    await join(deps, ALEX);

    expect(store.users).toHaveLength(1);
    expect(store.users[0]).toMatchObject({ email: 'alex.morgan@example.com', firstName: 'Alex', emailVerified: null });
    expect(store.users[0].passwordHash).toBeUndefined();
    expect(mail).toHaveLength(1);
    expect(mail[0].to).toBe('alex.morgan@example.com');

    // Only the token's hash is stored.
    const token = lastToken();
    expect(JSON.stringify(store.users[0])).not.toContain(token);

    expect(await checkPassword(deps, ALEX.email, ALEX.password)).toEqual({ ok: false, reason: 'unverified' });
    expect(await verifyEmail(deps, token)).toBe('verified');
    expect(await verifyEmail(deps, token)).toBe('invalid');
    expect(await checkPassword(deps, ALEX.email, ALEX.password)).toMatchObject({ ok: true });
  });

  it('expires links after a day', async () => {
    const { deps, later, lastToken } = setup();
    await join(deps, ALEX);
    later(TOKEN_TTL_MS + 1);
    expect(await verifyEmail(deps, lastToken())).toBe('expired');
  });

  it('rejects malformed tokens without a lookup', async () => {
    const { deps } = setup();
    expect(await verifyEmail(deps, 'x')).toBe('invalid');
  });

  it('answers a join for a registered address by email only, without changing the account', async () => {
    const { store, mail, deps, later, lastToken } = setup();
    await join(deps, ALEX);
    await verifyEmail(deps, lastToken());
    const before = { ...store.users[0] };

    later(EMAIL_COOLDOWN_MS);
    await join(deps, { ...ALEX, password: 'someone else' });
    expect(store.users).toHaveLength(1);
    expect(store.users[0].passwordHash).toBe(before.passwordHash);
    expect(mail.at(-1)!.subject).toBe('You already have a Crema account');
    expect(await checkPassword(deps, ALEX.email, 'someone else')).toEqual({ ok: false, reason: 'invalid' });
  });

  it("never lets someone else's earlier join put their password on your account", async () => {
    const { deps, later, lastToken } = setup();
    // Someone joins with Alex's address first; only Alex receives the link.
    await join(deps, { ...ALEX, password: 'attacker pass' });
    const attackersLink = lastToken();

    // Alex joins with their own password and uses their own link.
    later(EMAIL_COOLDOWN_MS);
    await join(deps, ALEX);
    expect(await verifyEmail(deps, attackersLink)).toBe('invalid');
    expect(await verifyEmail(deps, lastToken())).toBe('verified');

    expect(await checkPassword(deps, ALEX.email, ALEX.password)).toMatchObject({ ok: true });
    expect(await checkPassword(deps, ALEX.email, 'attacker pass')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('sends at most one account email a minute to an address', async () => {
    const { mail, deps, later } = setup();
    await join(deps, ALEX);
    await join(deps, ALEX);
    await resendVerification(deps, ALEX.email);
    expect(mail).toHaveLength(1);
    later(EMAIL_COOLDOWN_MS);
    await resendVerification(deps, ALEX.email);
    expect(mail).toHaveLength(2);
  });

  it('resends nothing for unknown or confirmed addresses', async () => {
    const { mail, deps, later, lastToken } = setup();
    await resendVerification(deps, 'nobody@example.com');
    expect(mail).toHaveLength(0);
    await join(deps, ALEX);
    await verifyEmail(deps, lastToken());
    later(EMAIL_COOLDOWN_MS);
    await resendVerification(deps, ALEX.email);
    expect(mail).toHaveLength(1);
  });
});

describe('checkPassword', () => {
  it('gives the same answer for an unknown address and a wrong password', async () => {
    const { deps, lastToken } = setup();
    await join(deps, ALEX);
    await verifyEmail(deps, lastToken());
    expect(await checkPassword(deps, 'nobody@example.com', 'whatever')).toEqual({ ok: false, reason: 'invalid' });
    expect(await checkPassword(deps, ALEX.email, 'wrong password')).toEqual({ ok: false, reason: 'invalid' });
  });

  it("doesn't say an account is unconfirmed unless the password matched", async () => {
    const { deps } = setup();
    await join(deps, ALEX);
    expect(await checkPassword(deps, ALEX.email, 'wrong password')).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('claimForVerifiedEmail', () => {
  it('lets Google confirm an unconfirmed join and drops its pending password', async () => {
    const { store, deps, lastToken } = setup();
    await join(deps, { ...ALEX, password: 'attacker pass' });
    const link = lastToken();
    await claimForVerifiedEmail(deps, ALEX.email);

    expect(store.users[0].emailVerified).toBeInstanceOf(Date);
    expect(store.users[0].pendingPasswordHash).toBeUndefined();
    expect(await verifyEmail(deps, link)).toBe('invalid');
    expect(await checkPassword(deps, ALEX.email, 'attacker pass')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('leaves confirmed accounts alone', async () => {
    const { store, deps, lastToken } = setup();
    await join(deps, ALEX);
    await verifyEmail(deps, lastToken());
    const hash = store.users[0].passwordHash;
    await claimForVerifiedEmail(deps, ALEX.email);
    expect(store.users[0].passwordHash).toBe(hash);
  });
});

describe('password reset', () => {
  /** A confirmed account for ALEX, with the email cooldown already passed. */
  async function confirmed() {
    const ctx = setup();
    await join(ctx.deps, ALEX);
    await verifyEmail(ctx.deps, ctx.lastToken());
    ctx.later(EMAIL_COOLDOWN_MS);
    return ctx;
  }

  it('emails a one-hour link and sets the new password with it, once', async () => {
    const { mail, deps, lastToken } = await confirmed();
    await requestPasswordReset(deps, ' ALEX.morgan@example.com');
    expect(mail.at(-1)).toMatchObject({ to: 'alex.morgan@example.com', subject: 'Reset your Crema password' });
    expect(mail.at(-1)!.text).toContain('http://localhost:3000/reset-password?token=');
    const token = lastToken();

    expect(await resetPassword(deps, token, 'brand new pass')).toBe('reset');
    expect(await checkPassword(deps, ALEX.email, 'brand new pass')).toMatchObject({ ok: true });
    expect(await checkPassword(deps, ALEX.email, ALEX.password)).toEqual({ ok: false, reason: 'invalid' });
    expect(await resetPassword(deps, token, 'another pass')).toBe('invalid');
  });

  it('stores only a hash of the link, and ends older sessions', async () => {
    const { store, deps, lastToken } = await confirmed();
    await requestPasswordReset(deps, ALEX.email);
    const token = lastToken();
    expect(JSON.stringify(store.users[0])).not.toContain(token);
    await resetPassword(deps, token, 'brand new pass');
    expect(store.users[0].sessionsValidFrom).toEqual(deps.now!());
    expect(store.users[0].resetTokenHash).toBeUndefined();
  });

  it('expires the link after an hour', async () => {
    const { deps, later, lastToken } = await confirmed();
    await requestPasswordReset(deps, ALEX.email);
    later(RESET_TTL_MS + 1);
    expect(await resetPassword(deps, lastToken(), 'brand new pass')).toBe('expired');
  });

  it('only the newest link works', async () => {
    const { deps, later, lastToken } = await confirmed();
    await requestPasswordReset(deps, ALEX.email);
    const first = lastToken();
    later(EMAIL_COOLDOWN_MS);
    await requestPasswordReset(deps, ALEX.email);
    expect(await resetPassword(deps, first, 'brand new pass')).toBe('invalid');
    expect(await resetPassword(deps, lastToken(), 'brand new pass')).toBe('reset');
  });

  it('sends nothing for an unknown address, and at most one email a minute', async () => {
    const { mail, deps } = await confirmed();
    const before = mail.length;
    await requestPasswordReset(deps, 'nobody@example.com');
    await requestPasswordReset(deps, ALEX.email);
    await requestPasswordReset(deps, ALEX.email);
    expect(mail.length).toBe(before + 1);
  });

  it('confirms an unconfirmed join, replacing its pending password and link', async () => {
    const { store, deps, later, lastToken } = setup();
    await join(deps, ALEX);
    const joinLink = lastToken();
    later(EMAIL_COOLDOWN_MS);
    await requestPasswordReset(deps, ALEX.email);
    expect(await resetPassword(deps, lastToken(), 'brand new pass')).toBe('reset');

    expect(store.users[0].emailVerified).toBeInstanceOf(Date);
    expect(await checkPassword(deps, ALEX.email, 'brand new pass')).toMatchObject({ ok: true });
    expect(await verifyEmail(deps, joinLink)).toBe('invalid');
  });

  it('rejects malformed tokens and unusable passwords', async () => {
    const { deps } = setup();
    expect(await resetPassword(deps, 'not-a-token', 'brand new pass')).toBe('invalid');
    expect(passwordError('short')).toBe('Use 8 to 72 characters.');
    expect(passwordError('é'.repeat(37))).toBe('Use 8 to 72 characters.');
    expect(passwordError('long enough')).toBeNull();
  });
});

describe('account settings', () => {
  /** A confirmed account for ALEX (id "1"), with the email cooldown already passed. */
  async function signedIn() {
    const ctx = setup();
    await join(ctx.deps, ALEX);
    await verifyEmail(ctx.deps, ctx.lastToken());
    ctx.later(EMAIL_COOLDOWN_MS);
    return { ...ctx, user: () => ctx.store.users[0] };
  }

  it('says who the account is, whether it has a password, and whether two-step login is on', async () => {
    const { deps, user } = await signedIn();
    expect(await accountSettings(deps, '1')).toEqual({
      email: 'alex.morgan@example.com',
      firstName: 'Alex',
      lastName: 'Morgan',
      hasPassword: true,
      twoFactorSince: null,
      recoveryCodesLeft: 0,
    });
    delete user().passwordHash;
    expect(await accountSettings(deps, '1')).toMatchObject({ hasPassword: false });
    expect(await accountSettings(deps, 'nobody')).toBeNull();
  });

  describe('changePassword', () => {
    it('needs the current password, then ends every session and emails a notice', async () => {
      const { deps, mail, user } = await signedIn();
      expect(await changePassword(deps, '1', 'wrong one', 'brand new pass')).toBe('wrong-password');
      expect(await changePassword(deps, '1', ALEX.password, 'brand new pass')).toBe('changed');
      expect(await checkPassword(deps, ALEX.email, 'brand new pass')).toMatchObject({ ok: true });
      expect(user().sessionsValidFrom).toEqual(deps.now!());
      expect(mail.at(-1)).toMatchObject({ to: 'alex.morgan@example.com', subject: 'Your Crema password was changed' });
    });

    it('stops an old reset link from working', async () => {
      const { deps, lastToken } = await signedIn();
      await requestPasswordReset(deps, ALEX.email);
      const token = lastToken();
      await changePassword(deps, '1', ALEX.password, 'brand new pass');
      expect(await resetPassword(deps, token, 'attacker pass')).toBe('invalid');
    });

    it('tells a Google account it has no password yet', async () => {
      const { deps, user } = await signedIn();
      delete user().passwordHash;
      expect(await changePassword(deps, '1', '', 'brand new pass')).toBe('no-password');
    });
  });

  describe('deleteAccount', () => {
    it('needs the password, removes the account and says goodbye', async () => {
      const { deps, store, mail } = await signedIn();
      expect(await deleteAccount(deps, '1', { password: 'wrong one' })).toBe('wrong-password');
      // A recent log in doesn't stand in for the password of an account that has one.
      expect(await deleteAccount(deps, '1', { loginAt: deps.now!().getTime() })).toBe('wrong-password');
      expect(store.users).toHaveLength(1);
      expect(await deleteAccount(deps, '1', { password: ALEX.password })).toBe('deleted');
      expect(store.users).toHaveLength(0);
      expect(mail.at(-1)).toMatchObject({ to: 'alex.morgan@example.com', subject: 'Your Crema account was deleted' });
    });

    it('deletes a Google account only after a log in from the last 10 minutes', async () => {
      const { deps, store, user, later } = await signedIn();
      delete user().passwordHash;
      const loginAt = deps.now!().getTime();
      expect(await deleteAccount(deps, '1', {})).toBe('login-again');
      later(RECENT_LOGIN_MS);
      expect(await deleteAccount(deps, '1', { loginAt })).toBe('login-again');
      expect(store.users).toHaveLength(1);
      expect(await deleteAccount(deps, '1', { loginAt: deps.now!().getTime() - 60_000 })).toBe('deleted');
      expect(store.users).toHaveLength(0);
    });

    it('still deletes when the goodbye email fails', async () => {
      const { deps, store } = await signedIn();
      const failing = { ...deps, sendMail: async () => Promise.reject(new Error('SMTP down')) };
      const quiet = console.error;
      console.error = () => {};
      try {
        expect(await deleteAccount(failing, '1', { password: ALEX.password })).toBe('deleted');
      } finally {
        console.error = quiet;
      }
      expect(store.users).toHaveLength(0);
    });
  });
});

describe('two-step login', () => {
  const saved = process.env.AUTH_SECRET;
  beforeAll(() => {
    process.env.AUTH_SECRET = 'test-secret';
  });
  afterAll(() => {
    process.env.AUTH_SECRET = saved;
  });

  /** A confirmed account for ALEX, part way: two-step login started. */
  async function started() {
    const ctx = setup();
    await join(ctx.deps, ALEX);
    await verifyEmail(ctx.deps, ctx.lastToken());
    const user = () => ctx.store.users[0];
    const start = await startTwoFactor(ctx.deps, '1', ALEX.password);
    if (!start.ok) throw new Error('not started');
    const code = (offsetSteps = 0) => codeAt(start.secret, stepAt(ctx.deps.now!()) + offsetSteps);
    return { ...ctx, user, start, code };
  }

  it('starts with the password, and keeps the new secret encrypted and pending', async () => {
    const ctx = setup();
    await join(ctx.deps, ALEX);
    await verifyEmail(ctx.deps, ctx.lastToken());
    expect(await startTwoFactor(ctx.deps, '1', 'wrong one')).toEqual({ ok: false, reason: 'wrong-password' });

    const { user, start } = await started();
    expect(start.uri).toContain('otpauth://totp/Crema%3Aalex.morgan%40example.com?secret=');
    expect(user().totpPendingSecret).toBeDefined();
    expect(user().totpPendingSecret).not.toContain(start.secret);
    expect(user().totpEnabledAt).toBeUndefined();
  });

  it("turns on with the app's first code, hands out ten recovery codes, and says so by email", async () => {
    const { deps, user, code, mail } = await started();
    expect(await enableTwoFactor(deps, '1', '000000')).toEqual({ ok: false, reason: 'invalid-code' });
    const res = await enableTwoFactor(deps, '1', code());
    expect(res.ok && res.recoveryCodes).toHaveLength(10);
    expect(needsSecondFactor(user())).toBe(true);
    expect(user().totpPendingSecret).toBeUndefined();
    expect(user().recoveryCodeHashes).toHaveLength(10);
    expect(JSON.stringify(user())).not.toContain(res.ok ? res.recoveryCodes[0] : 'x');
    expect(mail.at(-1)).toMatchObject({ subject: 'Two-step login is on for your Crema account' });
    expect(await accountSettings(deps, '1')).toMatchObject({ twoFactorSince: deps.now!().toISOString(), recoveryCodesLeft: 10 });
    expect(await startTwoFactor(deps, '1', ALEX.password)).toEqual({ ok: false, reason: 'already-on' });
  });

  it('takes each code once at log in, and each recovery code once (with a notice)', async () => {
    const { deps, user, code, mail, later } = await started();
    const setupCode = code();
    const res = await enableTwoFactor(deps, '1', setupCode);
    const recovery = res.ok ? res.recoveryCodes : [];
    // The code used to turn it on can't log in again.
    expect(await checkSecondFactor(deps, user(), setupCode)).toBe(false);
    later(30_000);
    const next = code();
    expect(await checkSecondFactor(deps, user(), next)).toBe(true);
    expect(await checkSecondFactor(deps, user(), next)).toBe(false);
    expect(await checkSecondFactor(deps, user(), '123456')).toBe(false);

    expect(await checkSecondFactor(deps, user(), recovery[0].toUpperCase())).toBe(true);
    expect(user().recoveryCodeHashes).toHaveLength(9);
    expect(mail.at(-1)).toMatchObject({ subject: 'A recovery code was used to log in to Crema' });
    expect(mail.at(-1)!.text).toContain('You have 9 left.');
    expect(await checkSecondFactor(deps, user(), recovery[0])).toBe(false);
  });

  it('still takes recovery codes if AUTH_SECRET changed and the secret no longer decrypts', async () => {
    const { deps, user, code } = await started();
    const res = await enableTwoFactor(deps, '1', code());
    const recovery = res.ok ? res.recoveryCodes : [];
    process.env.AUTH_SECRET = 'a-different-secret';
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(await checkSecondFactor(deps, user(), code(1))).toBe(false);
      expect(await checkSecondFactor(deps, user(), recovery[0])).toBe(true);
    } finally {
      console.error = quiet;
      process.env.AUTH_SECRET = 'test-secret';
    }
  });

  it('turns off with the password and a code, and tells the owner', async () => {
    const { deps, user, code, mail, later } = await started();
    await enableTwoFactor(deps, '1', code());
    later(30_000);
    expect(await disableTwoFactor(deps, '1', 'wrong one', code())).toBe('wrong-password');
    expect(await disableTwoFactor(deps, '1', ALEX.password, '000000')).toBe('invalid-code');
    expect(await disableTwoFactor(deps, '1', ALEX.password, code())).toBe('disabled');
    expect(needsSecondFactor(user())).toBe(false);
    expect(user().totpSecret).toBeUndefined();
    expect(user().recoveryCodeHashes).toBeUndefined();
    expect(mail.at(-1)).toMatchObject({ subject: 'Two-step login was turned off' });
    expect(await disableTwoFactor(deps, '1', ALEX.password, code())).toBe('not-on');
  });
});
