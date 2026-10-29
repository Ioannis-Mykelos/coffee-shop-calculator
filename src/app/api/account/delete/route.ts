import { deleteAccount } from '@/lib/server/accounts';
import { appUrl } from '@/lib/server/config';
import { mongoUserStore } from '@/lib/server/db';
import { sendMail } from '@/lib/server/mailer';
import { noStore, requireUser } from '@/lib/server/session';
import { tooManyPasswordChecks } from '@/lib/server/reauth';

/**
 * POST { password }: deletes the account and its figures. The session ends with it (lib/server/auth.ts). An account
 * made with Google sends no password: its session must have logged in within the last 10 minutes.
 * Answers { result }: 'deleted', or why not ('wrong-password' | 'login-again').
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if ('response' in user) return user.response;
  const busy = await tooManyPasswordChecks(user.userId);
  if (busy) return busy;
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;

  const result = await deleteAccount({ store: mongoUserStore, sendMail, appUrl: appUrl() }, user.userId, { password: body?.password, loginAt: user.loginAt });
  return Response.json({ result }, { status: result === 'deleted' ? 200 : 400, headers: noStore });
}
