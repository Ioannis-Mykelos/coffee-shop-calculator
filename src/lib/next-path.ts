/**
 * Where to go after logging in: a path on this site, or the calculator. Never another site (an open redirect would let
 * a link to our log-in page send people somewhere else afterwards).
 */
export function safeNext(next: unknown, fallback = "/app"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) {
    return fallback
  }
  return next
}
