import { appUrl, authMode } from '@/lib/server/config';
import { mongoUserStore, mongoWorkspaceStore, optedInToWeeklyEmail } from '@/lib/server/db';
import { sendMail } from '@/lib/server/mailer';
import { noStore } from '@/lib/server/session';
import { cronAuthorized, sendWeeklyEmails } from '@/lib/server/weekly-email';

/**
 * POST: sends last week's email to everyone who wants it. Called on Monday mornings by netlify/functions/weekly-email.mts
 * with `Authorization: Bearer <CRON_SECRET>`. Answers how many were sent, skipped and failed.
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req.headers.get('authorization'), process.env.CRON_SECRET)) return new Response(null, { status: 401, headers: noStore });
  if (authMode() !== 'accounts') return new Response(null, { status: 404, headers: noStore });
  const tally = await sendWeeklyEmails({
    store: mongoUserStore,
    optedIn: optedInToWeeklyEmail,
    workspace: async (id) => (await mongoWorkspaceStore.read(id)).workspace,
    sendMail,
    appUrl: appUrl(),
  });
  return Response.json(tally, { headers: noStore });
}
