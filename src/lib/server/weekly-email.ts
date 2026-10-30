// Sending the Monday email. Storage and the mailer are passed in, as in accounts.ts, so this runs in tests without a
// database. The schedule runs a few times each Monday: each owner's week is marked once sent, so a run that was cut
// short is picked up by the next one and nobody gets it twice.
import { createHash, timingSafeEqual } from 'node:crypto';
import { currencyFormatter } from '../expenses';
import { dayKey } from '../price-history';
import { emptyWeekMail, weeklyMail } from '../weekly-email';
import { lastMonday, weeklySummary } from '../weekly-summary';
import type { Workspace } from '../workspace';
import { canEmail, type SendMail, type UserRecord, type UserStore } from './accounts';
import { log } from './log';

export interface WeeklyDeps {
  store: Pick<UserStore, 'findById' | 'update'>;
  /** The accounts with the weekly email switched on */
  optedIn: () => Promise<UserRecord[]>;
  workspace: (userId: string) => Promise<Workspace | null>;
  sendMail: SendMail;
  appUrl: string;
  now?: () => Date;
}

/** Whether a request's Authorization header carries the cron secret. No secret set means nobody gets in. */
export function cronAuthorized(header: string | null, secret: string | undefined) {
  if (!secret || !header) return false;
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

const summaryFor = (workspace: Workspace, monday: Date) => {
  const fmt = currencyFormatter(workspace.currency);
  return { fmt, summary: weeklySummary(workspace.data, monday, fmt, workspace.dismissedAlerts) };
};

/** Sends last week's email to everyone who wants it and hasn't had it. One owner's failure doesn't stop the rest. */
export async function sendWeeklyEmails(deps: WeeklyDeps) {
  const monday = lastMonday((deps.now ?? (() => new Date()))());
  const week = dayKey(monday);
  const tally = { sent: 0, skipped: 0, failed: 0 };
  for (const user of await deps.optedIn()) {
    try {
      const workspace = user.weeklyEmailWeek === week ? null : await deps.workspace(user.id);
      const { summary, fmt } = workspace ? summaryFor(workspace, monday) : { summary: null, fmt: null };
      if (!summary) {
        tally.skipped++;
        continue;
      }
      await deps.sendMail({ to: user.email, ...weeklyMail(summary, user.firstName || 'there', deps.appUrl, fmt) });
      await deps.store.update(user.id, { weeklyEmailWeek: week });
      tally.sent++;
    } catch (error) {
      tally.failed++;
      log('error', 'weekly email failed', { error });
    }
  }
  return tally;
}

export type TestEmailResult = 'sent' | 'too-soon' | 'no-account';

/** The "send me a test" button: last week's email now, whether or not the switch is on. A failed send throws. */
export async function sendTestWeeklyEmail(deps: Omit<WeeklyDeps, 'optedIn'>, userId: string): Promise<TestEmailResult> {
  const now = (deps.now ?? (() => new Date()))();
  const user = await deps.store.findById(userId);
  if (!user) return 'no-account';
  if (!canEmail(user, now)) return 'too-soon';
  const workspace = await deps.workspace(userId);
  const name = user.firstName || 'there';
  const found = workspace && summaryFor(workspace, lastMonday(now));
  const mail = found?.summary ? weeklyMail(found.summary, name, deps.appUrl, found.fmt) : emptyWeekMail(name, deps.appUrl);
  await deps.sendMail({ to: user.email, ...mail });
  await deps.store.update(userId, { lastEmailAt: now });
  return 'sent';
}
