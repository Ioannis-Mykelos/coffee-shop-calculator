import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { type MonthData, computeTotals, currencyFormatter, priceFormatter, sampleMonth } from "@/lib/expenses";
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
  return view === "menu" ? (
    <MenuView month={m} total={computeTotals(m).total} currency="EUR" mutate={mutate} fmt={fmt} price={price} />
  ) : (
    <WhatIfView month={m} fmt={fmt} price={price} />
  );
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

  it("takes a drink's own VAT, such as take-away's, else the menu's", async () => {
    const user = userEvent.setup();
    render(<Harness view="menu" />);
    await user.click(rows()[2]);
    const vat = within(screen.getByRole("complementary", { name: /Espresso/ })).getByLabelText("VAT (%)") as HTMLInputElement;
    expect(vat.value).toBe("");
    expect(vat.placeholder).toBe("25");
    await user.type(vat, "11");
    const editor = screen.getByRole("complementary", { name: /Espresso/ });
    expect(within(editor).getByText("VAT (11%)")).toBeTruthy();
    // 2.80 ÷ 1.11 − 0.556
    expect(kept(editor)).toContain(price(2.8 / 1.11 - 0.556));
    expect(rows().find((r) => r.textContent?.startsWith("Espresso"))?.textContent).toContain("VAT 11%");
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

  it("shows sales and break-even at the menu's average drink price", async () => {
    const user = userEvent.setup();
    render(<Harness view="menu" />);
    screen.getByRole("heading", { name: "Sales & break-even" });
    // Sample café: (700 × 2.80 + 1,100 × 3.60 + 800 × 3.90 + 400 × 3.80) ÷ 3,000 cups = 3.52
    const avg = screen.getByText(/your menu's average drink/);
    expect(avg.textContent).toContain(price(3.52));
    await user.click(rows()[0]);
    const field = within(screen.getByRole("complementary", { name: /Cappuccino/ })).getByLabelText("Menu price, incl. VAT");
    await user.clear(field);
    await user.type(field, "4.60");
    // + 1,100 × 1.00 ÷ 3,000 cups
    expect(screen.getByText(/your menu's average drink/).textContent).toContain(price(3.52 + 1100 / 3000));
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
