import { resendVerification } from '@/lib/server/accounts';
import { appUrl, authMode, emailLoginEnabled } from '@/lib/server/config';
import { mongoUserStore } from '@/lib/server/db';
import { sendMail } from '@/lib/server/mailer';
import { allow, clientIp, mailFailed } from '@/lib/server/rate-limit';

/** Sends a new confirmation link. The same answer for every address, so it reveals nothing. */
export async function POST(req: Request) {
  if (authMode() !== 'accounts' || !emailLoginEnabled()) return new Response(null, { status: 404 });
  if (!(await allow(`resend:${clientIp(req.headers)}`, 10, 60 * 60 * 1000))) {
    return Response.json({ error: 'Too many attempts. Try again in an hour.' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  if (typeof body?.email === 'string' && body.email.length <= 254) {
    try {
      await resendVerification({ store: mongoUserStore, sendMail, appUrl: appUrl() }, body.email);
    } catch (error) {
      return mailFailed(error);
    }
  }
  return Response.json({ ok: true }, { status: 202 });
}
