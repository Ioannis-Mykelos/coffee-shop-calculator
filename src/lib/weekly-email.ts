// The Monday email, written from a week's summary. Plain text and HTML say the same thing. Names and drinks are typed
// by the owner, so everything going into the HTML is escaped.

import type { WeeklySummary } from "./weekly-summary";

type Fmt = (n: number) => string;

export interface WeeklyMailText {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** "€200 ahead of target", "€200 behind target", or "Right on target". */
export function gapLine(gap: number, fmt: Fmt) {
  if (gap === 0) return "Right on target";
  return `${fmt(Math.abs(gap))} ${gap > 0 ? "ahead of" : "behind"} target`;
}

/** The email for the week in `s`. */
export function weeklyMail(s: WeeklySummary, firstName: string, appUrl: string, fmt: Fmt): WeeklyMailText {
  const logged = `${s.days.length} ${s.days.length === 1 ? "day" : "days"} logged`;
  const rows: [string, string][] = [
    ["Sales, VAT included", `${fmt(s.sales)} (${logged})`],
    ["Target", fmt(s.target)],
    ["Result", gapLine(s.gap, fmt)],
    ["Best day", `${s.best.label}, ${fmt(s.best.amount)}`],
    ...(s.worst ? ([["Slowest day", `${s.worst.label}, ${fmt(s.worst.amount)}`]] as [string, string][]) : []),
  ];
  const settings = `${appUrl}/app/account`;
  // The Result row already says it, and the alert's "this week" would mean last week here.
  const alerts = s.alerts.filter((a) => a.rule !== "behind");

  const text = [
    `Hi ${firstName},`,
    `Here's your week, ${s.range}.`,
    rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
    ...(alerts.length ? [`Worth a look:\n${alerts.map((a) => `- ${a.title}. ${a.detail}`).join("\n")}`] : []),
    `Your figures: ${appUrl}/app`,
    `To stop these emails, turn them off in your account: ${settings}`,
  ].join("\n\n");

  const cell = "padding:6px 0;border-bottom:1px solid #e8e2d9;";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#2b211b;max-width:520px">
<p>Hi ${escapeHtml(firstName)},</p>
<p>Here's your week, <strong>${escapeHtml(s.range)}</strong>.</p>
<table role="presentation" style="border-collapse:collapse;width:100%">${rows
    .map(([label, value]) => `<tr><td style="${cell}color:#6b5f55">${escapeHtml(label)}</td><td style="${cell}font-weight:600">${escapeHtml(value)}</td></tr>`)
    .join("")}</table>
${
  alerts.length
    ? `<p><strong>Worth a look</strong></p><ul style="padding-left:20px">${alerts
        .map((a) => `<li><strong>${escapeHtml(a.title)}.</strong> ${escapeHtml(a.detail)}</li>`)
        .join("")}</ul>`
    : ""
}
<p><a href="${escapeHtml(`${appUrl}/app`)}">Open your figures</a></p>
<p style="font-size:13px;color:#6b5f55">To stop these emails, <a href="${escapeHtml(settings)}">turn them off in your account</a>.</p>
</div>`;

  return { subject: `Your week at the café: ${s.range}`, text, html };
}

/** What the "send me a test" button sends when last week has no takings: a real Monday would send nothing. */
export function emptyWeekMail(firstName: string, appUrl: string): WeeklyMailText {
  const lines = [
    `Your weekly email is working. Last week has no daily takings yet, so a real Monday would send nothing.`,
    `Log your takings in Daily takings and next Monday's email will tell you how the week went.`,
  ];
  return {
    subject: "Test: your weekly Crema email",
    text: [`Hi ${firstName},`, ...lines, `Your figures: ${appUrl}/app`].join("\n\n"),
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#2b211b;max-width:520px"><p>Hi ${escapeHtml(firstName)},</p>${lines
      .map((l) => `<p>${escapeHtml(l)}</p>`)
      .join("")}<p><a href="${escapeHtml(`${appUrl}/app`)}">Open your figures</a></p></div>`,
  };
}
