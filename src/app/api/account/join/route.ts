import { join, validateJoin, type JoinInput } from '@/lib/server/accounts';
import { appUrl, authMode, emailLoginEnabled } from '@/lib/server/config';
import { mongoUserStore } from '@/lib/server/db';
import { sendMail } from '@/lib/server/mailer';
import { allow, clientIp, mailFailed } from '@/lib/server/rate-limit';

/**
 * Join with email + password. Always answers "check your inbox" for valid input, whether or not the address
 * is registered (see accounts.ts), so it can't be used to find out who has an account.
 */
export async function POST(req: Request) {
  if (authMode() !== 'accounts' || !emailLoginEnabled()) return new Response(null, { status: 404 });
  if (!(await allow(`join:${clientIp(req.headers)}`, 10, 60 * 60 * 1000))) {
    return Response.json({ error: 'Too many attempts. Try again in an hour.' }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as Partial<Record<keyof JoinInput, unknown>> | null;
  const errors = validateJoin(body ?? {});
  if (Object.keys(errors).length) return Response.json({ errors }, { status: 400 });

  try {
    await join({ store: mongoUserStore, sendMail, appUrl: appUrl() }, body as JoinInput);
  } catch (error) {
    return mailFailed(error);
  }
  return Response.json({ ok: true }, { status: 202 });
}
