// Monday morning: asks the app to send the weekly emails. The work is in /api/cron/weekly-email because the app's server
// code can't run in a plain Netlify function. The hours after the first are for a run that was cut short: an owner's
// week is marked once sent, so nobody gets it twice. Netlify only runs this on the published production deploy.

export default async function weeklyEmail() {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("Weekly email skipped: CRON_SECRET is not set.");
    return;
  }
  const res = await fetch(`${process.env.URL}/api/cron/weekly-email`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  console.log(`Weekly email: ${res.status} ${await res.text()}`);
}

export const config = { schedule: "0 6-9 * * 1" };
