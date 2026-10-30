import { describe, expect, it } from "vitest";
import { currencyFormatter } from "./expenses";
import { emptyWeekMail, gapLine, weeklyMail } from "./weekly-email";
import type { WeeklySummary } from "./weekly-summary";

const fmt = currencyFormatter("EUR");
const URL = "https://crema.test";

const summary = (over: Partial<WeeklySummary> = {}): WeeklySummary => ({
  range: "12–18 October",
  days: [
    { label: "Friday 16 October", amount: 800 },
    { label: "Sunday 18 October", amount: 400 },
  ],
  sales: 1200,
  target: 1000,
  gap: 200,
  best: { label: "Friday 16 October", amount: 800 },
  worst: { label: "Sunday 18 October", amount: 400 },
  alerts: [],
  ...over,
});

describe("gapLine", () => {
  it("says ahead, behind or on target", () => {
    expect(gapLine(200, fmt)).toContain("ahead of target");
    expect(gapLine(-200, fmt)).toContain("behind target");
    expect(gapLine(-200, fmt)).not.toContain("-");
    expect(gapLine(0, fmt)).toBe("Right on target");
  });
});

describe("weeklyMail", () => {
  it("tells the week in both versions, with the way to turn it off", () => {
    const mail = weeklyMail(summary(), "Alex", URL, fmt);
    expect(mail.subject).toContain("12–18 October");
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("Hi Alex,");
      expect(body).toContain(fmt(1200));
      expect(body).toContain("Friday 16 October");
      expect(body).toContain("Slowest day");
      expect(body).toContain(`${URL}/app/account`);
    }
  });

  it("leaves out the slowest day with one day logged, and says 1 day", () => {
    const { text } = weeklyMail(summary({ worst: null, days: [{ label: "Friday 16 October", amount: 800 }] }), "Alex", URL, fmt);
    expect(text).not.toContain("Slowest day");
    expect(text).toContain("1 day logged");
  });

  it("lists alerts, and has no such section without them", () => {
    const alert = { id: "staff", rule: "staff" as const, title: "Staff cost is high", detail: "It takes 40% of sales." };
    expect(weeklyMail(summary({ alerts: [alert] }), "Alex", URL, fmt).text).toContain("- Staff cost is high. It takes 40% of sales.");
    expect(weeklyMail(summary(), "Alex", URL, fmt).text).not.toContain("Worth a look");
  });

  it("leaves out the behind alert: the result row says it already", () => {
    const alert = { id: "behind:2026-10-12", rule: "behind" as const, title: "This week is behind the daily target", detail: "Short." };
    const mail = weeklyMail(summary({ alerts: [alert] }), "Alex", URL, fmt);
    expect(mail.text).not.toContain("This week is behind");
    expect(mail.text).not.toContain("Worth a look");
    expect(mail.html).not.toContain("Worth a look");
  });

  it("escapes what the owner typed in the HTML, not in the plain text", () => {
    const alert = { id: "m", rule: "margin" as const, title: `<img src=x onerror=alert(1)> & "co"`, detail: "Thin." };
    const mail = weeklyMail(summary({ alerts: [alert] }), "<b>Alex</b>", URL, fmt);
    expect(mail.html).not.toContain("<img");
    expect(mail.html).not.toContain("<b>Alex");
    expect(mail.html).toContain("&lt;img src=x");
    expect(mail.text).toContain("<img src=x");
  });
});

describe("emptyWeekMail", () => {
  it("says the email works and why there are no figures", () => {
    const mail = emptyWeekMail("<Alex>", URL);
    expect(mail.subject).toContain("Test");
    expect(mail.text).toContain("no daily takings");
    expect(mail.html).toContain("&lt;Alex&gt;");
  });
});
