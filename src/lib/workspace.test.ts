import { describe, expect, it } from "vitest";
import { sampleMonth } from "./expenses";
import { cleanWorkspace, LIMITS } from "./workspace";

const workspace = () => ({ month: "2026-10", currency: "DKK", country: "DK", data: { "2026-10": sampleMonth() } });

describe("cleanWorkspace", () => {
  it("keeps a workspace the app saved, as it is", () => {
    const w = workspace();
    expect(cleanWorkspace(JSON.parse(JSON.stringify(w)))).toEqual(w);
  });

  it("refuses what isn't a workspace", () => {
    expect(cleanWorkspace(null)).toBeNull();
    expect(cleanWorkspace({ month: "2026-13", data: {} })).toBeNull();
    expect(cleanWorkspace({ ...workspace(), month: "2026-11" })).toBeNull(); // no figures for the month it's on
  });

  it("drops unknown fields, bad month keys and wrong types", () => {
    const w = workspace() as Record<string, unknown> & ReturnType<typeof workspace>;
    const month = w.data["2026-10"] as unknown as Record<string, unknown>;
    month.extra = "nope";
    month.premises = [{ id: "a", label: 42, amount: "100", evil: true }, "junk", { label: "no id" }];
    const clean = cleanWorkspace({ ...w, admin: true, data: { ...w.data, "not-a-month": month } })!;
    expect(Object.keys(clean.data)).toEqual(["2026-10"]);
    expect(clean.data["2026-10"].premises).toEqual([{ id: "a", label: "", amount: "100" }]);
    expect(clean).not.toHaveProperty("admin");
    expect(clean.data["2026-10"]).not.toHaveProperty("extra");
  });

  it("bounds what one save can hold", () => {
    const w = workspace();
    const m = w.data["2026-10"];
    m.other = Array.from({ length: LIMITS.items + 50 }, (_, i) => ({ id: `x${i}`, label: "y".repeat(500), amount: "1" }));
    const clean = cleanWorkspace(w)!;
    expect(clean.data["2026-10"].other).toHaveLength(LIMITS.items);
    expect(clean.data["2026-10"].other[0].label).toHaveLength(LIMITS.text);
    const many = Object.fromEntries(Array.from({ length: LIMITS.months + 1 }, (_, i) => [`${2000 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`, sampleMonth()]));
    expect(cleanWorkspace({ month: "2000-01", currency: "EUR", data: many })).toBeNull();
  });

  it("falls back to euros for an unknown currency and ignores a bad country", () => {
    const clean = cleanWorkspace({ ...workspace(), currency: "ZZZ", country: "denmark" })!;
    expect(clean.currency).toBe("EUR");
    expect(clean).not.toHaveProperty("country");
  });
});
