import { passwordError, resetPassword } from '@/lib/server/accounts';
import { authMode, emailLoginEnabled } from '@/lib/server/config';
import { mongoUserStore } from '@/lib/server/db';
import { allow, clientIp } from '@/lib/server/rate-limit';

/** Sets a new password with the token from a reset email. Answers `{ result }`, or `{ errors }` for a bad password. */
export async function POST(req: Request) {
  if (authMode() !== 'accounts' || !emailLoginEnabled()) return new Response(null, { status: 404 });
  if (!(await allow(`reset:${clientIp(req.headers)}`, 20, 60 * 60 * 1000))) {
    return Response.json({ error: 'Too many attempts. Try again in an hour.' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  const error = passwordError(body?.password);
  if (error) return Response.json({ errors: { password: error } }, { status: 400 });
  const result = await resetPassword({ store: mongoUserStore }, String(body?.token ?? ''), body!.password as string);
  return Response.json({ result }, { status: result === 'reset' ? 200 : 400 });
}
