import { disableTwoFactor, enableTwoFactor, startTwoFactor } from '@/lib/server/accounts';
import { appUrl } from '@/lib/server/config';
import { mongoUserStore } from '@/lib/server/db';
import { sendMail } from '@/lib/server/mailer';
import { noStore, requireUser } from '@/lib/server/session';
import { qrModules } from '@/lib/server/qr';
import { tooManyPasswordChecks } from '@/lib/server/reauth';

/**
 * Two-step login settings, one POST per step:
 * - { action: 'start', password } → { secret, uri, qr }: a new secret for the authenticator app, as a QR code grid to
 *   scan, a link to tap on a phone, and the key to type in
 * - { action: 'enable', code } → { recoveryCodes }: the app's first code turns it on; the codes are shown once
 * - { action: 'disable', password, code } → { result: 'disabled' }: the password and a code (or recovery code)
 * Refusals answer 400 with { reason }. Password and code checks share the settings' 10 tries per 15 minutes.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if ('response' in user) return user.response;
  const busy = await tooManyPasswordChecks(user.userId);
  if (busy) return busy;
  const body = (await req.json().catch(() => null)) as { action?: unknown; password?: unknown; code?: unknown } | null;
  const deps = { store: mongoUserStore, sendMail, appUrl: appUrl() };
  const answer = (ok: boolean, data: object) => Response.json(data, { status: ok ? 200 : 400, headers: noStore });

  if (body?.action === 'start') {
    const res = await startTwoFactor(deps, user.userId, body.password);
    return res.ok ? answer(true, { secret: res.secret, uri: res.uri, qr: qrModules(res.uri) }) : answer(false, { reason: res.reason });
  }
  if (body?.action === 'enable') {
    const res = await enableTwoFactor(deps, user.userId, body.code);
    return res.ok ? answer(true, { recoveryCodes: res.recoveryCodes }) : answer(false, { reason: res.reason });
  }
  if (body?.action === 'disable') {
    const result = await disableTwoFactor(deps, user.userId, body.password, body.code);
    return result === 'disabled' ? answer(true, { result }) : answer(false, { reason: result });
  }
  return answer(false, { reason: 'invalid' });
}
