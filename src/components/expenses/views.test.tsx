import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { type MonthData, currencyFormatter, priceFormatter, sampleMonth } from "@/lib/expenses";
import { MenuView } from "./MenuView";
import { WhatIfView } from "./WhatIfView";

const fmt = currencyFormatter("EUR");
const price = priceFormatter("EUR");

/** A view over the sample café, with edits applied the way the store applies them. */
function Harness({ view, start = sampleMonth() }: { view: "menu" | "whatif"; start?: MonthData }) {
  const [m, setM] = useState(start);
  const mutate = (fn: (m: MonthData) => void) =>
    setM((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  return view === "menu" ? <MenuView month={m} mutate={mutate} fmt={fmt} price={price} /> : <WhatIfView month={m} fmt={fmt} price={price} />;
}

const rows = () => within(screen.getByRole("region", { name: "Drinks, best earners first" })).getAllByRole("button");
const kept = (editor: HTMLElement) => within(editor).getByText(/You keep/).parentElement?.textContent;

describe("MenuView", () => {
  it("ranks the drinks by what they earn a month, and names the thinnest margin", () => {
    render(<Harness view="menu" />);
    // Sample café: cappuccino 1,100 cups × 2.13 kept, latte 800 × 2.24, espresso 700 × 1.68, flat white 400 × 2.33
    const names = ["Cappuccino", "Caffè latte", "Espresso", "Flat white"];
    expect(rows().map((r) => names.find((n) => r.textContent?.startsWith(n)))).toEqual(names);
    expect(screen.getByText("Thinnest margin per cup").parentElement?.textContent).toContain("Espresso");
  });

  it("opens a drink's recipe, and re-prices it as the price changes", async () => {
    const user = userEvent.setup();
    render(<Harness view="menu" />);
    await user.click(rows()[2]);
    const editor = screen.getByRole("complementary", { name: /Espresso: recipe and price/ });
    expect((within(editor).getByLabelText("Drink") as HTMLInputElement).value).toBe("Espresso");
    // 2.80 ÷ 1.25 − (0.018 kg × 22 + 0.11 + 0.05) = 1.684
    expect(kept(editor)).toContain(price(1.684));
    const field = within(editor).getByLabelText("Menu price, incl. VAT");
    await user.clear(field);
    await user.type(field, "3.30");
    // 3.30 ÷ 1.25 − 0.556 = 2.084
    expect(kept(screen.getByRole("complementary", { name: /Espresso/ }))).toContain(price(2.084));
  });

  it("adds a drink and opens it to fill in", async () => {
    const user = userEvent.setup();
    render(<Harness view="menu" />);
    await user.click(screen.getByRole("button", { name: "Add a drink" }));
    expect(rows()).toHaveLength(5);
    const editor = screen.getByRole("complementary", { name: /Untitled drink/ });
    await user.type(within(editor).getByLabelText("Drink"), "Mocha");
    screen.getByRole("complementary", { name: /Mocha/ });
  });

  it("offers plant milk prices once a plant milk is picked", async () => {
    const user = userEvent.setup();
    const start = sampleMonth();
    start.supplies.push({ id: "oat", label: "Oat milk", qty: "", unit: "L", price: "2.6" });
    render(<Harness view="menu" start={start} />);
    expect(screen.queryByRole("button", { name: /plant milk prices/ })).toBeNull();
    await user.selectOptions(screen.getByLabelText("Plant milk"), "oat");
    await user.type(screen.getByLabelText("Extra charge, incl. VAT"), "0.40");
    await user.click(screen.getByRole("button", { name: "Show plant milk prices" }));
    expect(screen.getByRole("button", { name: "Showing plant milk prices" }).getAttribute("aria-pressed")).toBe("true");
    expect(rows().find((r) => r.textContent?.startsWith("Cappuccino"))?.textContent).toContain(`plant milk +${price(0.4)}`);
  });
});

describe("WhatIfView", () => {
  it("says what a rent rise costs and what keeps today's profit", async () => {
    const user = userEvent.setup();
    render(<Harness view="whatif" />);
    screen.getByText("Move a slider, or pick a scenario above");
    await user.click(screen.getByRole("button", { name: "Rent up 10%" }));
    // Sample rent & premises: 3,340 a month, so +334
    // (The query's text isn't normalized like the page's, so the formatter's no-break space must become a space.)
    screen.getByText(`This costs you ${fmt(334).replace(/\s/g, " ")} a month`);
    await user.click(screen.getByRole("button", { name: /^Try prices \+\d+%$/ }));
    screen.getByText(/You'd earn .* more a month/);
  });

  it("asks for sales when there are neither takings nor cups sold", () => {
    const start = sampleMonth();
    start.revenue = "";
    start.menu.drinks.forEach((d) => (d.cups = ""));
    render(<Harness view="whatif" start={start} />);
    screen.getByText("See the effect on profit");
    expect(screen.queryByText("Profit a month")).toBeNull();
    screen.getByText("Customers a day to break even");
  });
});
