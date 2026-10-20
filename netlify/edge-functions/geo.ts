// Netlify Edge Function serving /api/geo on the deployed site. Netlify passes the
// visitor's IP location in `context.geo`, which is more dependable than the request
// headers that reach the Next.js server. Locally, src/app/api/geo/route.ts answers.
interface Context {
  geo?: { city?: string; country?: { code?: string } }
}

export default (_req: Request, context: Context) => {
  const code = context.geo?.country?.code
  const country = code && /^[A-Z]{2}$/i.test(code) ? code.toUpperCase() : null
  return Response.json(
    { country, city: (country && context.geo?.city) || null },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}

export const config = { path: "/api/geo" }
