import { changePassword, passwordError } from '@/lib/server/accounts';
import { appUrl } from '@/lib/server/config';
import { mongoUserStore } from '@/lib/server/db';
import { sendMail } from '@/lib/server/mailer';
import { noStore, requireUser } from '@/lib/server/session';
import { tooManyPasswordChecks } from '@/lib/server/reauth';

/**
 * POST { current, next }: changes the password. Every session ends, this one too, so the browser logs back in with
 * the new password. Answers { result } ('changed' | 'wrong-password' | 'no-password') or { errors } for a bad password.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if ('response' in user) return user.response;
  const busy = await tooManyPasswordChecks(user.userId);
  if (busy) return busy;
  const body = (await req.json().catch(() => null)) as { current?: unknown; next?: unknown } | null;
  const error = passwordError(body?.next);
  if (error) return Response.json({ errors: { next: error } }, { status: 400, headers: noStore });

  const result = await changePassword({ store: mongoUserStore, sendMail, appUrl: appUrl() }, user.userId, body?.current, body!.next as string);
  return Response.json({ result }, { status: result === 'changed' ? 200 : 400, headers: noStore });
}
