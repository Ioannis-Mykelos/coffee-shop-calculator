import { describe, expect, it } from 'vitest';
import { sampleMonth } from '../expenses';
import type { Workspace } from '../workspace';
import { EMAIL_COOLDOWN_MS, type Mail, type UserRecord } from './accounts';
import { cronAuthorized, sendTestWeeklyEmail, sendWeeklyEmails, type WeeklyDeps } from './weekly-email';

/** Monday 19 October 2026, so last week is 12–18 October */
const MONDAY_MORNING = new Date(2026, 9, 19, 6);
const LAST_WEEK = '2026-10-12';

const user = (id: string, over: Partial<UserRecord> = {}): UserRecord => ({
  id,
  email: `${id}@example.com`,
  firstName: 'Alex',
  lastName: 'Morgan',
  emailVerified: new Date(0),
  weeklyEmail: true,
  createdAt: new Date(0),
  ...over,
});

const workspace = (takings: Record<string, string> = { 13: '500', 14: '700' }): Workspace => ({
  month: '2026-10',
  currency: 'EUR',
  data: { '2026-10': { ...sampleMonth(), takings } },
});

function setup(users: UserRecord[], ws: Workspace | null = workspace()) {
  const mail: Mail[] = [];
  const deps: WeeklyDeps = {
    store: {
      findById: async (id) => users.find((u) => u.id === id) ?? null,
      update: async (id, set) => void Object.assign(users.find((u) => u.id === id)!, set),
    },
    optedIn: async () => users.filter((u) => u.weeklyEmail),
    workspace: async () => ws,
    sendMail: async (m) => void mail.push(m),
    appUrl: 'https://crema.test',
    now: () => MONDAY_MORNING,
  };
  return { deps, mail };
}

describe('sendWeeklyEmails', () => {
  it("emails last week's story, in the owner's currency", async () => {
    const users = [user('a')];
    const { deps, mail } = setup(users, { ...workspace(), currency: 'DKK' });
    expect(await sendWeeklyEmails(deps)).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(mail[0].to).toBe('a@example.com');
    expect(mail[0].subject).toContain('12–18 October');
    expect(mail[0].html).toContain('Hi Alex');
    expect(mail[0].text).toContain('kr');
    expect(users[0].weeklyEmailWeek).toBe(LAST_WEEK);
  });

  it("doesn't send the same week twice, but does send the next one", async () => {
    const { deps, mail } = setup([user('a')]);
    await sendWeeklyEmails(deps);
    expect(await sendWeeklyEmails(deps)).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(mail).toHaveLength(1);

    deps.now = () => new Date(2026, 9, 26, 6);
    deps.workspace = async () => workspace({ 20: '500' });
    expect((await sendWeeklyEmails(deps)).sent).toBe(1);
  });

  it('skips a week with no takings, and an owner with no figures', async () => {
    expect((await sendWeeklyEmails(setup([user('a')], workspace({ 1: '500' })).deps)).skipped).toBe(1);
    const empty = setup([user('a')], null);
    expect(await sendWeeklyEmails(empty.deps)).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(empty.mail).toHaveLength(0);
  });

  it('leaves out alerts the owner dismissed', async () => {
    const all = setup([user('a')]);
    await sendWeeklyEmails(all.deps);
    expect(all.mail[0].text).toContain('Staff cost is high');

    const dismissed = setup([user('a')], { ...workspace(), dismissedAlerts: ['2026-10:staff'] });
    await sendWeeklyEmails(dismissed.deps);
    expect(dismissed.mail[0].text).not.toContain('Staff cost is high');
  });

  it("carries on after a failure, and leaves that owner's week unmarked for the next run", async () => {
    const users = [user('a'), user('b')];
    const { deps, mail } = setup(users);
    deps.sendMail = async (m) => {
      if (m.to.startsWith('a')) throw new Error('SMTP down');
      mail.push(m);
    };
    expect(await sendWeeklyEmails(deps)).toEqual({ sent: 1, skipped: 0, failed: 1 });
    expect(mail.map((m) => m.to)).toEqual(['b@example.com']);
    expect(users[0].weeklyEmailWeek).toBeUndefined();
  });
});

describe('sendTestWeeklyEmail', () => {
  it("sends last week's email now, even with the switch off, and doesn't use up Monday's", async () => {
    const users = [user('a', { weeklyEmail: false })];
    const { deps, mail } = setup(users);
    expect(await sendTestWeeklyEmail(deps, 'a')).toBe('sent');
    expect(mail[0].subject).toContain('12–18 October');
    expect(users[0].weeklyEmailWeek).toBeUndefined();
  });

  it('says so when last week has no takings', async () => {
    const { deps, mail } = setup([user('a')], workspace({}));
    expect(await sendTestWeeklyEmail(deps, 'a')).toBe('sent');
    expect(mail[0].text).toContain('no daily takings');
  });

  it('is limited to one a minute', async () => {
    const { deps, mail } = setup([user('a')]);
    await sendTestWeeklyEmail(deps, 'a');
    expect(await sendTestWeeklyEmail(deps, 'a')).toBe('too-soon');
    expect(mail).toHaveLength(1);
    deps.now = () => new Date(MONDAY_MORNING.getTime() + EMAIL_COOLDOWN_MS);
    expect(await sendTestWeeklyEmail(deps, 'a')).toBe('sent');
  });

  it("doesn't start the cooldown when the send fails, and passes the failure on", async () => {
    const users = [user('a')];
    const { deps } = setup(users);
    deps.sendMail = async () => Promise.reject(new Error('SMTP down'));
    await expect(sendTestWeeklyEmail(deps, 'a')).rejects.toThrow('SMTP down');
    expect(users[0].lastEmailAt).toBeUndefined();
  });

  it('answers no-account for an unknown owner', async () => {
    expect(await sendTestWeeklyEmail(setup([]).deps, 'nobody')).toBe('no-account');
  });
});

describe('cronAuthorized', () => {
  it('lets in only the right secret', () => {
    expect(cronAuthorized('Bearer s3cret', 's3cret')).toBe(true);
    expect(cronAuthorized('Bearer wrong', 's3cret')).toBe(false);
    expect(cronAuthorized('s3cret', 's3cret')).toBe(false);
    expect(cronAuthorized(null, 's3cret')).toBe(false);
  });

  it('lets nobody in when no secret is set', () => {
    expect(cronAuthorized('Bearer ', '')).toBe(false);
    expect(cronAuthorized('Bearer undefined', undefined)).toBe(false);
  });
});
