import { accountSettings } from '@/lib/server/accounts';
import { mongoUserStore } from '@/lib/server/db';
import { noStore, requireUser } from '@/lib/server/session';

/** GET: what the account page shows: the name and email, whether the account has a password, and two-step login. */
export async function GET() {
  const user = await requireUser();
  if ('response' in user) return user.response;
  const settings = await accountSettings({ store: mongoUserStore }, user.userId);
  if (!settings) return Response.json({ error: 'Account not found.' }, { status: 404, headers: noStore });
  return Response.json(settings, { headers: noStore });
}
