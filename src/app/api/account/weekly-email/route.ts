import { appUrl } from '@/lib/server/config';
import { mongoUserStore, mongoWorkspaceStore } from '@/lib/server/db';
import { sendMail } from '@/lib/server/mailer';
import { mailFailed } from '@/lib/server/rate-limit';
import { noStore, requireUser } from '@/lib/server/session';
import { sendTestWeeklyEmail } from '@/lib/server/weekly-email';

/**
 * POST { action }: 'on' or 'off' sets the Monday email; 'test' sends last week's email now. Answers { result }
 * ('on' | 'off' | 'sent' | 'too-soon' | 'no-account').
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if ('response' in user) return user.response;
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;

  if (action === 'on' || action === 'off') {
    await mongoUserStore.update(user.userId, { weeklyEmail: action === 'on' });
    return Response.json({ result: action }, { headers: noStore });
  }
  if (action !== 'test') return Response.json({ error: 'Unknown action.' }, { status: 400, headers: noStore });

  try {
    const result = await sendTestWeeklyEmail(
      { store: mongoUserStore, workspace: async (id) => (await mongoWorkspaceStore.read(id)).workspace, sendMail, appUrl: appUrl() },
      user.userId,
    );
    return Response.json({ result }, { headers: noStore });
  } catch (error) {
    return mailFailed(error);
  }
}
