// Country of the visitor's IP address, from Netlify's built-in geolocation.
// Netlify adds the `x-nf-geo` header (base64 JSON) to every request it serves;
// it is absent in local dev, where the client falls back to the browser locale.
export const dynamic = "force-dynamic"

function countryFromHeaders(h: Headers): string | null {
  const geo = h.get("x-nf-geo")
  if (geo) {
    try {
      const code = JSON.parse(Buffer.from(geo, "base64").toString("utf8"))?.country?.code
      if (typeof code === "string" && /^[A-Z]{2}$/i.test(code)) return code.toUpperCase()
    } catch {}
  }
  const plain = h.get("x-country")
  return plain && /^[A-Z]{2}$/i.test(plain) ? plain.toUpperCase() : null
}

export function GET(req: Request) {
  return Response.json(
    { country: countryFromHeaders(req.headers) },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
