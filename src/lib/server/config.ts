// Which mode the app runs in, read from the environment on the server.
//
// Accounts: real accounts in MongoDB through Auth.js, and each owner's figures saved in their account. Needs
// MONGODB_URI and AUTH_SECRET (in .env.local, or the site's environment variables on Netlify).
// Local: no database. The calculator works without logging in and keeps figures in this browser only, as before
// accounts existed. The default, so CI and a fresh clone work without any setup.

export type AuthMode = 'accounts' | 'local';

export const authMode = (): AuthMode => (process.env.MONGODB_URI && process.env.AUTH_SECRET ? 'accounts' : 'local');

/** Google sign-in is offered only when its credentials are set. */
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/**
 * Origin for links in emails, e.g. http://localhost:3000: APP_URL or AUTH_URL when set, else Netlify's URL for the
 * site (URL in production, DEPLOY_PRIME_URL on previews), else localhost. Blank values count as unset.
 */
export const appUrl = () =>
  (process.env.APP_URL || process.env.AUTH_URL || (process.env.CONTEXT === 'production' ? process.env.URL : process.env.DEPLOY_PRIME_URL) || process.env.URL || 'http://localhost:3000').replace(/\/$/, '');
