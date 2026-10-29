import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { type MonthData, computeTotals, currencyFormatter, priceFormatter, sampleMonth } from "@/lib/expenses";
import { takingsSummary } from "@/lib/takings";
import { MenuView } from "./MenuView";
import { TakingsView } from "./TakingsView";
import { WhatIfView } from "./WhatIfView";

const fmt = currencyFormatter("EUR");
const price = priceFormatter("EUR");

/** A view over the sample café, with edits applied the way the store applies them. */
function Harness({ view, start = sampleMonth() }: { view: "menu" | "takings" | "whatif"; start?: MonthData }) {
  const [m, setM] = useState(start);
  const mutate = (fn: (m: MonthData) => void) =>
    setM((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  return view === "menu" ? (
    <MenuView month={m} total={computeTotals(m).total} currency="EUR" mutate={mutate} fmt={fmt} price={price} />
  ) : view === "takings" ? (
    <TakingsView month={m} monthKey="2026-10" total={computeTotals(m).total} mutate={mutate} fmt={fmt} onView={() => {}} />
  ) : (
    <WhatIfView month={m} fmt={fmt} price={price} />
  );
}

const rows = (part: "Drinks" | "Food" = "Drinks") =>
  within(screen.getByRole("region", { name: `${part}, best earners first` })).queryAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));
const kept = (editor: HTMLElement) => within(editor).getByText(/You keep/).parentElement?.textContent;

describe("MenuView", () => {
  it("ranks the drinks by what they earn a month, and names the thinnest margin", () => {
    render(<Harness view="menu" />);
    // Sample café: cappuccino 1,100 cups × 2.13 kept, latte 800 × 2.24, espresso 700 × 1.68, croissant 500 × 2.00, flat white 400 × 2.33
    const names = ["Cappuccino", "Caffè latte", "Espresso", "Flat white", "Orange juice"];
    expect(rows().map((r) => names.find((n) => r.textContent?.startsWith(n)))).toEqual(names);
    // Croissant 500 × 2.00 a month against the pudding's 150 × 2.70
    const food = ["Croissant", "Overnight pudding"];
    expect(rows("Food").map((r) => food.find((n) => r.textContent?.startsWith(n)))).toEqual(food);
    expect(screen.getByText("Thinnest margin per sale").parentElement?.textContent).toContain("Espresso");
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

  it("sets the target margin for every item from the one being edited", async () => {
    const user = userEvent.setup();
    render(<Harness view="menu" />);
    await user.click(rows()[2]);
    const field = within(screen.getByRole("complementary", { name: /Espresso/ })).getByLabelText("Target margin, all items (%)");
    await user.clear(field);
    await user.type(field, "50");
    // 0.556 to make ÷ (1 − 50%) × 1.25
    screen.getByText(`For a 50% margin, charge ${price(1.39).replace(/\s/g, " ")}`);
    await user.click(rows()[0]);
    screen.getByText(/For a 50% margin/);
  });

  it("adds a drink and opens it to fill in", async () => {
    const user = userEvent.setup();
    render(<Harness view="menu" />);
    await user.click(screen.getByRole("button", { name: "Add a drink" }));
    expect(rows()).toHaveLength(6);
    const editor = screen.getByRole("complementary", { name: /Untitled drink/ });
    await user.type(within(editor).getByLabelText("Drink"), "Mocha");
    screen.getByRole("complementary", { name: /Mocha/ });
  });

  it("shows sales and break-even at the menu's average drink price", async () => {
    const user = userEvent.setup();
    render(<Harness view="menu" />);
    screen.getByRole("heading", { name: "Sales & break-even" });
    // Sample café: (700 × 2.80 + 1,100 × 3.60 + 800 × 3.90 + 400 × 3.80 + 200 × 4.00) ÷ 3,200 drinks = 3.55
    const avg = screen.getByText(/your average drink/);
    expect(avg.textContent).toContain(price(3.55));
    // 650 food items for 3,200 drinks, at (500 × 3.50 + 150 × 4.50) ÷ 650
    expect(screen.getByText(/your average food item/).textContent).toContain(price(2425 / 650));
    expect((screen.getByLabelText("Food per customer") as HTMLInputElement).placeholder).toBe("0.2");
    await user.click(rows()[0]);
    const field = within(screen.getByRole("complementary", { name: /Cappuccino/ })).getByLabelText("Menu price, incl. VAT");
    await user.clear(field);
    await user.type(field, "4.60");
    // + 1,100 × 1.00 ÷ 3,000 cups
    expect(screen.getByText(/your average drink/).textContent).toContain(price(3.55 + 1100 / 3200));
  });

  it("adds food, made from a consumable, with its own VAT", async () => {
    const user = userEvent.setup();
    render(<Harness view="menu" />);
    await user.click(screen.getByRole("button", { name: "Add food" }));
    let editor = screen.getByRole("complementary", { name: /Untitled food/ });
    await user.type(within(editor).getByLabelText("Food"), "Muffin");
    editor = screen.getByRole("complementary", { name: /Muffin/ });
    // A new item starts at the menu's rate, written in to change
    const vat = within(editor).getByLabelText("VAT (%)") as HTMLInputElement;
    expect(vat.value).toBe("25");
    await user.clear(vat);
    await user.type(vat, "12");
    editor = screen.getByRole("complementary", { name: /Muffin/ });
    await user.type(within(editor).getByLabelText("Menu price, incl. VAT"), "2.24");
    await user.click(within(editor).getByRole("button", { name: "+ Add ingredient" }));
    editor = screen.getByRole("complementary", { name: /Muffin/ });
    const pick = within(editor).getByLabelText("Ingredient") as HTMLSelectElement;
    // Food is made from Consumables only: no beans, milk or cups to pick from
    expect([...pick.querySelectorAll("optgroup")].map((g) => g.label)).toEqual(["Consumables"]);
    await user.selectOptions(pick, within(pick).getByRole("option", { name: "Pastries" }));
    await user.type(within(screen.getByRole("complementary", { name: /Muffin/ })).getByLabelText(/^Amount/), "1");
    // 2.24 ÷ 1.12 − 0.80
    expect(kept(screen.getByRole("complementary", { name: /Muffin/ }))).toContain(price(1.2));
    expect(rows("Food").some((r) => r.textContent?.startsWith("Muffin"))).toBe(true);
  });

  it("moves an item added on the wrong list, and removes one", async () => {
    const user = userEvent.setup();
    render(<Harness view="menu" />);
    await user.click(screen.getByRole("button", { name: "Add food" }));
    let editor = screen.getByRole("complementary", { name: /Untitled food/ });
    await user.type(within(editor).getByLabelText("Food"), "Orange juice");
    editor = screen.getByRole("complementary", { name: /Orange juice/ });
    await user.click(within(editor).getByRole("button", { name: "Drink" }));
    expect(rows().some((r) => r.textContent?.startsWith("Orange juice"))).toBe(true);
    expect(rows("Food").some((r) => r.textContent?.startsWith("Orange juice"))).toBe(false);
    // As a drink, its ingredients can come from Supplies too
    await user.click(within(screen.getByRole("complementary", { name: /Orange juice/ })).getByRole("button", { name: "+ Add ingredient" }));
    const pick = within(screen.getByRole("complementary", { name: /Orange juice/ })).getByLabelText("Ingredient");
    expect([...pick.querySelectorAll("optgroup")].map((g) => g.label)).toEqual(["Supplies", "Consumables"]);
    await user.click(within(screen.getByRole("complementary", { name: /Orange juice/ })).getByRole("button", { name: "Remove" }));
    expect(screen.queryByRole("complementary", { name: /Orange juice/ })).toBeNull();
    expect(rows()).toHaveLength(5);
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

describe("TakingsView", () => {
  it("colours each day against the daily target and says what's still needed", async () => {
    const user = userEvent.setup();
    const start = sampleMonth();
    const total = computeTotals(start).total;
    const { target, needed } = takingsSummary(start, total, "2026-10");
    render(<Harness view="takings" start={start} />);
    const day = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
    await user.type(day(/^1 1 October/), String(Math.ceil(target)));
    await user.type(day(/^2 2 October/), "100");
    expect(day(/^1 1 October/).closest("label")?.className).toContain("text-good");
    expect(day(/^2 2 October/).closest("label")?.className).toContain("text-destructive");
    const taken = Math.ceil(target) + 100;
    expect(screen.getByText("Taken so far").parentElement?.textContent).toContain(fmt(taken));
    // The sample opens 30 days: 28 left
    expect(screen.getByText("Needed per day from here").parentElement?.textContent).toContain(fmt((needed - taken) / 28));
    const use = screen.getByRole("button", { name: /as this month's sales/ });
    await user.click(use);
    expect((screen.getByRole("button", { name: /as this month's sales/ }) as HTMLButtonElement).disabled).toBe(true);
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
