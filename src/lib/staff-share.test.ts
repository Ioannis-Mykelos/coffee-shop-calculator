import { describe, expect, it } from "vitest";
import { computeTotals, sampleMonth } from "./expenses";
import { STAFF_RANGE, staffShare } from "./staff-share";

/** The sample café with its sales set so staff comes to `share` of them. */
function atShare(share: number) {
  const m = sampleMonth();
  m.revenue = String(computeTotals(m).staff / share);
  return m;
}

describe("staffShare", () => {
  it("divides the staff cost by the sales typed in", () => {
    const m = sampleMonth();
    const staff = computeTotals(m).staff;
    m.revenue = String(staff * 4);
    expect(staffShare(m)).toEqual({ staff, sales: staff * 4, share: 0.25, status: "healthy" });
  });

  it("uses the menu's sales when none are typed", () => {
    const m = sampleMonth();
    m.revenue = "";
    const r = staffShare(m)!;
    expect(r.sales).toBeGreaterThan(0);
    expect(r.share).toBeCloseTo(computeTotals(m).staff / r.sales);
  });

  it("says where the share sits against the healthy range, edges included", () => {
    expect(staffShare(atShare(0.2))?.status).toBe("low");
    expect(staffShare(atShare(STAFF_RANGE.low))?.status).toBe("healthy");
    expect(staffShare(atShare(0.3))?.status).toBe("healthy");
    expect(staffShare(atShare(STAFF_RANGE.high))?.status).toBe("healthy");
    expect(staffShare(atShare(0.4))?.status).toBe("high");
  });

  it("is null without sales or without staff", () => {
    const noSales = sampleMonth();
    noSales.revenue = "";
    noSales.menu.drinks = [];
    expect(staffShare(noSales)).toBeNull();
    const noStaff = sampleMonth();
    noStaff.staff = [];
    expect(staffShare(noStaff)).toBeNull();
  });
});
