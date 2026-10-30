import { describe, expect, it } from "vitest"
import { BETA_EVERYONE_PRO, isPro, planOf } from "./plan"

describe("planOf", () => {
  it("keeps a real plan", () => {
    expect(planOf("pro")).toBe("pro")
    expect(planOf("free")).toBe("free")
  })

  it("counts a missing or unknown plan as free", () => {
    expect(planOf(undefined)).toBe("free")
    expect(planOf(null)).toBe("free")
    expect(planOf("PRO")).toBe("free")
    expect(planOf(true)).toBe("free")
  })
})

describe("isPro", () => {
  it("is true for everyone during the beta", () => {
    expect(BETA_EVERYONE_PRO).toBe(true)
    expect(isPro("free")).toBe(true)
    expect(isPro(undefined)).toBe(true)
    expect(isPro("pro")).toBe(true)
  })

  it("after the beta, is true only for a Pro account", () => {
    expect(isPro("pro", false)).toBe(true)
    expect(isPro("free", false)).toBe(false)
    expect(isPro(undefined, false)).toBe(false)
  })
})
