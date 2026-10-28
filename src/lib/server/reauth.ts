import 'server-only';
import { allow } from './rate-limit';

/** Password checks in account settings: 10 per account per 15 minutes, against guessing from an open session. */
export async function tooManyPasswordChecks(userId: string): Promise<Response | null> {
  if (await allow(`reauth:${userId}`, 10, 15 * 60 * 1000)) return null;
  return Response.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
}
