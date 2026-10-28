// The fields Crema adds to Auth.js's user, session and token (see lib/server/auth.ts).
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    firstName?: string;
    lastName?: string;
    /** "Keep me logged in", from the email log-in form */
    remember?: boolean;
  }
  interface Session {
    user: { id: string; firstName: string; lastName: string } & DefaultSession['user'];
    /** When this session signed in (ms since epoch) */
    loginAt?: number;
    /** "Keep me logged in" was on: logging back in after a password change keeps it */
    remember?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    firstName?: string;
    lastName?: string;
    /** End of a session started without "Keep me logged in" (ms since epoch) */
    shortUntil?: number;
    /** When this session signed in (ms since epoch); a later password reset ends it */
    loginAt?: number;
  }
}
