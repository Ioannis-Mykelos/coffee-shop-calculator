/** What an account pays for. Accounts saved before plans existed have none: they count as free. */
export type Plan = "free" | "pro"

/** The beta: everyone gets Pro, so nothing is hidden yet. Set to false when Pro starts being sold. */
export const BETA_EVERYONE_PRO = true

/** Reads the stored value, so anything unexpected is free rather than Pro. */
export const planOf = (plan: unknown): Plan => (plan === "pro" ? "pro" : "free")

/** The one check for Pro features, on the server and in the browser. */
export const isPro = (plan: unknown, beta = BETA_EVERYONE_PRO): boolean => beta || planOf(plan) === "pro"
