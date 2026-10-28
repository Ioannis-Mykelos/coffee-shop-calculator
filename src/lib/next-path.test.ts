import { describe, expect, it } from "vitest";
import { safeNext } from "./next-path";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/app/account")).toBe("/app/account");
    expect(safeNext("/app?x=1")).toBe("/app?x=1");
  });

  it("never leads to another site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", undefined, ["/app"]]) {
      expect(safeNext(bad)).toBe("/app");
    }
  });
});
