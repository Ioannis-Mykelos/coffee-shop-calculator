import 'server-only';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import NextAuth, { CredentialsSignin, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { checkPassword, checkSecondFactor, claimForVerifiedEmail, needsSecondFactor, normalizeEmail } from './accounts';
import { emailLoginEnabled, googleEnabled } from './config';
import { mongoClient, mongoUserStore } from './db';
import { log } from './log';
import { sendMail } from './mailer';
import { allow, clientIp } from './rate-limit';

// Auth.js (accounts mode only, see config.ts): email + password with optional two-step login, and Google. Sessions
// are an httpOnly JWT cookie. The config is built on the first request, so local mode never touches the database.

/** Shown to the user as "confirm your email first"; only raised after the password matched. */
class UnverifiedEmail extends CredentialsSignin {
  code = 'unverified';
}

/** Two-step login is on: the password was right, now the app's code (or a recovery code) is needed. */
class TwoFactorRequired extends CredentialsSignin {
  code = 'totp_required';
}

/** The code didn't match (or was used already). Only raised after the password matched. */
class TwoFactorInvalid extends CredentialsSignin {
  code = 'totp_invalid';
}

/** Too many log-in attempts from this IP, or for this address. Checked before the password. */
class TooManyAttempts extends CredentialsSignin {
  code = 'rate_limited';
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Per IP, for a shared network's worth of people; per address, against guessing one account's password. */
const LOGIN_LIMIT = { ip: 30, email: 10 };

const SESSION_DAYS = 30;
/** Without "Keep me logged in" a session ends after this long, even if the browser stays open. */
const SHORT_SESSION_MS = 12 * 60 * 60 * 1000;

/** Email + password, with the authenticator app's code as a second step when two-step login is on. */
const credentials = Credentials({
  credentials: { email: {}, password: {}, remember: {}, code: {} },
  async authorize(input, request) {
    const email = normalizeEmail(String(input.email ?? ''));
    const [byIp, byEmail] = await Promise.all([
      allow(`login-ip:${clientIp(request.headers)}`, LOGIN_LIMIT.ip, LOGIN_WINDOW_MS),
      allow(`login-email:${email}`, LOGIN_LIMIT.email, LOGIN_WINDOW_MS),
    ]);
    if (!byIp || !byEmail) throw new TooManyAttempts();
    const result = await checkPassword({ store: mongoUserStore }, email, String(input.password ?? ''));
    if (!result.ok) {
      if (result.reason === 'unverified') throw new UnverifiedEmail();
      return null;
    }
    // Two-step login: the code comes in a second try, with the same email and password.
    if (needsSecondFactor(result.user)) {
      const code = String(input.code ?? '').trim();
      if (!code) throw new TwoFactorRequired();
      if (!(await checkSecondFactor({ store: mongoUserStore, sendMail }, result.user, code))) throw new TwoFactorInvalid();
    }
    const { id, firstName, lastName } = result.user;
    return { id, email: result.user.email, firstName, lastName, name: `${firstName} ${lastName}`, remember: input.remember !== 'false' };
  },
});

const config = (): NextAuthConfig => ({
  adapter: MongoDBAdapter(mongoClient),
  session: { strategy: 'jwt', maxAge: SESSION_DAYS * 24 * 60 * 60 },
  trustHost: true,
  pages: { signIn: '/login', error: '/auth/error' },
  // A wrong password or unconfirmed email is the owner's mistake, not a server error: keep it out of the error log.
  logger: {
    error(error) {
      // `type`, not `name`: the production build minifies class names.
      if ((error as { type?: string }).type !== 'CredentialsSignin') log('error', 'sign-in failed', { error });
    },
  },
  providers: [
    ...(emailLoginEnabled() ? [credentials] : []),
    ...(googleEnabled()
      ? [
          Google({
            // Passed in explicitly: on its own Auth.js only reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET, and would
            // send Google the client id "undefined" (Error 401: invalid_client).
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Signing in with Google joins an existing account with the same address. Safe here: Google has
            // verified the address, and an unconfirmed email join is cleaned up first (signIn callback below).
            allowDangerousEmailAccountLinking: true,
            profile: (p) => ({
              id: p.sub,
              name: p.name,
              email: p.email?.toLowerCase(),
              image: p.picture,
              firstName: p.given_name ?? p.name?.split(' ')[0] ?? '',
              lastName: p.family_name ?? '',
            }),
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      if (!profile?.email || !profile.email_verified) return false;
      await claimForVerifiedEmail({ store: mongoUserStore }, profile.email);
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.firstName = user.firstName ?? '';
        token.lastName = user.lastName ?? '';
        token.loginAt = Date.now();
        if (user.remember === false) token.shortUntil = Date.now() + SHORT_SESSION_MS;
        return token;
      }
      // Returning null ends the session.
      if (typeof token.shortUntil === 'number' && Date.now() > token.shortUntil) return null;
      // A deleted account, or a password change or reset, ends every session started before it.
      const record = token.id ? await mongoUserStore.findById(String(token.id)) : null;
      if (!record) return null;
      const validFrom = record.sessionsValidFrom;
      const loginAt = typeof token.loginAt === 'number' ? token.loginAt : 0;
      if (validFrom && loginAt < validFrom.getTime()) return null;
      // A changed email address shows on the next request, without logging in again.
      token.email = record.email;
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.id);
      session.user.firstName = String(token.firstName ?? '');
      session.user.lastName = String(token.lastName ?? '');
      if (typeof token.loginAt === 'number') session.loginAt = token.loginAt;
      session.remember = typeof token.shortUntil !== 'number';
      return session;
    },
  },
});

export const { handlers, auth, signOut } = NextAuth(config);
