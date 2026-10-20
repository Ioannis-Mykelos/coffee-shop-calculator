// Location of the visitor's IP address, from Netlify's built-in geolocation.
// Netlify adds the `x-nf-geo` header (base64 JSON) to every request it serves;
// it is absent in local dev, where the client falls back to the browser locale.
export const dynamic = "force-dynamic"

const CODE = /^[A-Z]{2}$/i

function geoFromHeaders(h: Headers): { country: string | null; city: string | null } {
  const geo = h.get("x-nf-geo")
  if (geo) {
    try {
      const parsed = JSON.parse(Buffer.from(geo, "base64").toString("utf8"))
      const code = parsed?.country?.code
      const city = parsed?.city
      if (typeof code === "string" && CODE.test(code)) {
        return { country: code.toUpperCase(), city: typeof city === "string" && city ? city : null }
      }
    } catch {}
  }
  const plain = h.get("x-country")
  return { country: plain && CODE.test(plain) ? plain.toUpperCase() : null, city: null }
}

export function GET(req: Request) {
  return Response.json(geoFromHeaders(req.headers), { headers: { "Cache-Control": "private, no-store" } })
}
