import 'server-only';
import { auth } from './auth';
import { authMode } from './config';

/**
 * The signed-in owner's account id, for an account endpoint, or the response to send instead: 404 in local mode
 * (the endpoints don't exist there), 401 without a session.
 */
export async function requireUser(): Promise<{ userId: string; loginAt?: number } | { response: Response }> {
  if (authMode() !== 'accounts') return { response: new Response(null, { status: 404 }) };
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { response: Response.json({ error: 'Log in first.' }, { status: 401, headers: noStore }) };
  return { userId, loginAt: session.loginAt };
}

/** Account answers are about one person: never cache them. */
export const noStore = { 'Cache-Control': 'no-store' };
