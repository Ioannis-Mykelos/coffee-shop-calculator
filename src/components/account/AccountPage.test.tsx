import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountPage } from "./AccountPage";

const settings = {
  email: "alex@example.com",
  firstName: "Alex",
  lastName: "Morgan",
  hasPassword: true,
  twoFactorSince: null,
  recoveryCodesLeft: 0,
  plan: "free",
  weeklyEmail: false,
  emailLogin: true,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Answers the settings request, and each POST to the weekly email route with the next of `answers`. */
function stubApi(over: Partial<typeof settings> = {}, answers: Response[] = []) {
  const posts: unknown[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url === "/api/account/settings") return json({ ...settings, ...over });
    posts.push(JSON.parse(String(init?.body)));
    return answers.shift()!;
  });
  return posts;
}

afterEach(() => void vi.unstubAllGlobals());

describe("the weekly email card", () => {
  it("turns on and off", async () => {
    const posts = stubApi({}, [json({ result: "on" }), json({ result: "off" })]);
    render(<AccountPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Turn on" }));
    await userEvent.click(await screen.findByRole("button", { name: "Turn off" }));
    await screen.findByRole("button", { name: "Turn on" });
    expect(posts).toEqual([{ action: "on" }, { action: "off" }]);
  });

  it("sends a test and says where", async () => {
    const posts = stubApi({}, [json({ result: "sent" })]);
    render(<AccountPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Send me a test" }));
    expect(await screen.findByText("Test sent to alex@example.com.")).toBeTruthy();
    expect(posts).toEqual([{ action: "test" }]);
  });

  it("says so when it's too soon, or the email can't be sent", async () => {
    stubApi({}, [json({ result: "too-soon" }), json({ error: "We couldn't send the email." }, 503)]);
    render(<AccountPage />);
    const button = await screen.findByRole("button", { name: "Send me a test" });
    await userEvent.click(button);
    await screen.findByText(/Try again in a minute/);
    await userEvent.click(button);
    await screen.findByText("We couldn't send the email.");
  });

  it("isn't offered when the site can't send email", async () => {
    stubApi({ emailLogin: false });
    render(<AccountPage />);
    await screen.findByText("Profile");
    expect(screen.queryByText("Weekly email")).toBeNull();
  });
});
