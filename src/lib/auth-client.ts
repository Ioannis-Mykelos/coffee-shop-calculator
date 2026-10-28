'use client';

import { getSession, signIn, signOut } from 'next-auth/react';

// Browser side of accounts (see lib/server/auth.ts and app/api/account). Local mode never calls these.

export interface User {
  firstName: string;
  lastName: string;
  email: string;
}

export type LogInResult =
  | { ok: true; user: User }
  | { ok: false; error: 'invalid' | 'unverified' | 'rate_limited' | 'totp_required' | 'totp_invalid' | 'failed' };

const SIGN_IN_CODES = ['unverified', 'rate_limited', 'totp_required', 'totp_invalid'] as const;

/** `code`: two-step login's code from the authenticator app (or a recovery code), once the server asked for it. */
export async function logInWithPassword(email: string, password: string, remember: boolean, code?: string): Promise<LogInResult> {
  try {
    const res = await signIn('credentials', { email, password, remember: String(remember), ...(code && { code }), redirect: false });
    if (!res?.ok || res.error) {
      const known = SIGN_IN_CODES.find((c) => c === res?.code);
      if (known) return { ok: false, error: known };
      return { ok: false, error: res?.status === 401 || res?.error === 'CredentialsSignin' ? 'invalid' : 'failed' };
    }
    const session = await getSession();
    const user = session?.user?.email ? { firstName: session.user.firstName, lastName: session.user.lastName, email: session.user.email } : null;
    return user ? { ok: true, user } : { ok: false, error: 'failed' };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export interface JoinFields {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  consent: boolean;
}

export type JoinResult = { ok: true } | { ok: false; errors?: Partial<Record<keyof JoinFields, string>>; message?: string };

export async function joinWithPassword(fields: JoinFields): Promise<JoinResult> {
  try {
    const res = await fetch('/api/account/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, errors: body.errors, message: body.error ?? (body.errors ? undefined : "We couldn't create your account. Please try again.") };
  } catch {
    return { ok: false, message: "We couldn't reach Crema. Check your connection and try again." };
  }
}

/** Asks for a new confirmation link. The server answers the same for every address. */
export async function resendLink(email: string): Promise<boolean> {
  try {
    return (await fetch('/api/account/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })).ok;
  } catch {
    return false;
  }
}

/** Asks for a password reset link. The server answers the same for every address; `message` when it failed. */
export async function forgotPassword(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/account/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, message: body.error ?? "We couldn't send the link. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach Crema. Check your connection and try again." };
  }
}

export type NewPasswordResult = { ok: true } | { ok: false; result?: 'invalid' | 'expired'; message?: string };

/** Sets a new password with the token from a reset email. */
export async function setNewPassword(token: string, password: string): Promise<NewPasswordResult> {
  try {
    const res = await fetch('/api/account/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.result === 'reset') return { ok: true };
    if (body.result === 'invalid' || body.result === 'expired') return { ok: false, result: body.result };
    return { ok: false, message: body.errors?.password ?? body.error ?? "We couldn't change your password. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach Crema. Check your connection and try again." };
  }
}

// ---------------------------------------------------------------------------
// Settings (signed in): see the settings functions in lib/server/accounts.ts.

export interface AccountSettings {
  email: string;
  firstName: string;
  lastName: string;
  /** False for an account made with Google that has never set a password */
  hasPassword: boolean;
  /** When two-step login was turned on (ISO), or null when it's off */
  twoFactorSince: string | null;
  recoveryCodesLeft: number;
}

export async function fetchAccountSettings(): Promise<AccountSettings | null> {
  try {
    const res = await fetch('/api/account/settings', { cache: 'no-store' });
    return res.ok ? ((await res.json()) as AccountSettings) : null;
  } catch {
    return null;
  }
}

/** A settings change: the server's `result`, or `message` when it couldn't be made (busy, offline, a bad password). */
export type SettingsAnswer<R extends string> = { result: R; message?: undefined } | { result?: undefined; message: string };

async function postSettings<R extends string>(url: string, body: unknown): Promise<SettingsAnswer<R>> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const answer = await res.json().catch(() => ({}));
    if (typeof answer.result === 'string') return { result: answer.result as R };
    if (res.status === 401) return { message: 'Your session has ended. Log in again.' };
    return { message: answer.errors?.next ?? answer.error ?? "That didn't go through. Please try again." };
  } catch {
    return { message: "We couldn't reach Crema. Check your connection and try again." };
  }
}

export const changeMyPassword = (current: string, next: string) =>
  postSettings<'changed' | 'wrong-password' | 'no-password'>('/api/account/password', { current, next });

/** Two-step login, step by step (see app/api/account/two-step). */
export const startTwoStep = (password: string) => postTwoStep<{ secret: string; uri: string; qr: boolean[][] }>({ action: 'start', password });
export const enableTwoStep = (code: string) => postTwoStep<{ recoveryCodes: string[] }>({ action: 'enable', code });
export const disableTwoStep = (password: string, code: string) => postTwoStep<{ result: 'disabled' }>({ action: 'disable', password, code });

type TwoStepAnswer<T> = ({ ok: true } & T) | { ok: false; reason?: string; message?: string };

async function postTwoStep<T>(body: unknown): Promise<TwoStepAnswer<T>> {
  try {
    const res = await fetch('/api/account/two-step', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const answer = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, ...answer };
    return { ok: false, reason: answer.reason, message: answer.error ?? (res.status === 401 ? 'Your session has ended. Log in again.' : undefined) };
  } catch {
    return { ok: false, message: "We couldn't reach Crema. Check your connection and try again." };
  }
}

export const deleteMyAccount = (password: string) => postSettings<'deleted' | 'wrong-password' | 'no-password'>('/api/account/delete', { password });

/** Whether this session was started with "Keep me logged in" (true if unknown). */
export async function sessionRemembered() {
  try {
    return (await getSession())?.remember ?? true;
  } catch {
    return true;
  }
}

/** Leaves for Google's sign-in page and comes back to `next` (the calculator by default). */
export const continueWithGoogle = (next = '/app') => signIn('google', { redirectTo: next });

export async function logOut() {
  try {
    await signOut({ redirect: false });
  } catch {
    // Signed out locally either way; the cookie expires on its own.
  }
}
