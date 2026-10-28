// Request guards: a per-key request limit (account endpoints, log in, saving figures), and the answer when an email
// fails.
//
// The per-key request limit (e.g. joins per IP address) counts in fixed windows. With Upstash Redis set up
// (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or the KV_REST_API_* names Vercel's Upstash
// integration sets), the counts are shared by every server instance (every Netlify function). Without it, or while Redis can't be
// reached, each process counts in its own memory: fine for one dev server, best effort on serverless hosting.
// The per-address email throttle in accounts.ts is stored in the database and holds everywhere.

import { log } from './log';

/** Adds one hit to `key`'s current window and answers how many hits the window holds now. */
export type HitCounter = (key: string, windowMs: number, now: number) => Promise<number>;

const windows = new Map<string, { count: number; resetAt: number }>();

export const memoryCounter: HitCounter = async (key, windowMs, now) => {
  // Keep memory bounded: drop windows that have ended.
  if (windows.size > 10_000) for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  const current = windows.get(key);
  if (current && current.resetAt > now) return ++current.count;
  windows.set(key, { count: 1, resetAt: now + windowMs });
  return 1;
};

/** Counts in Upstash Redis over its REST API: one INCR per hit, the window's key expiring when it ends. */
export const redisCounter =
  (url: string, token: string, fetchFn: typeof fetch = fetch): HitCounter =>
  async (key, windowMs, now) => {
    const bucket = `crema:rl:${key}:${Math.floor(now / windowMs)}`;
    const res = await fetchFn(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', bucket],
        ['PEXPIRE', bucket, String(windowMs)],
      ]),
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) throw new Error(`Upstash answered ${res.status}`);
    const [incr] = (await res.json()) as { result?: unknown; error?: string }[];
    if (typeof incr?.result !== 'number') throw new Error(`Upstash INCR failed: ${incr?.error ?? 'no result'}`);
    return incr.result;
  };

const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

let warned = false;
const warnOnce = (message: string, error?: unknown) => {
  if (warned) return;
  warned = true;
  log('warn', 'rate limit counted per instance', { message, ...(error !== undefined && { error }) });
};

/** Shared counts when Redis is set up; this process's memory otherwise, and whenever Redis fails. */
export const sharedCounter: HitCounter = async (key, windowMs, now) => {
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) {
    if (process.env.NETLIFY || process.env.VERCEL) warnOnce('No Upstash Redis set up: request limits are counted per instance.');
    return memoryCounter(key, windowMs, now);
  }
  try {
    return await redisCounter(url, token)(key, windowMs, now);
  } catch (error) {
    warnOnce('Upstash Redis failed, counting in memory instead.', error);
    return memoryCounter(key, windowMs, now);
  }
};

/** True if `key` may make another request: at most `limit` in the current `windowMs` window. */
export async function allow(key: string, limit: number, windowMs: number, now = Date.now(), count: HitCounter = sharedCounter) {
  return (await count(key, windowMs, now)) <= limit;
}

/** The client's IP as the host reports it: Netlify's own header first, then x-forwarded-for as most hosts set it. */
export const clientIp = (headers: Headers) =>
  headers.get('x-nf-client-connection-ip') || headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || 'unknown';

/** The email couldn't be sent (SMTP down or not set up). Logged for us; the owner can simply try again. */
export const mailFailed = (error: unknown) => {
  log('error', 'account email failed', { error });
  return Response.json({ error: "We couldn't send the email. Please try again in a minute." }, { status: 503 });
};
