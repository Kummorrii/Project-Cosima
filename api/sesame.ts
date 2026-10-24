// Turns an object name ("M 31", "Betelgeuse") into coordinates using the CDS name resolver.
// The live site calls this instead of the resolver directly, so the browser never talks to CDS.

const UPSTREAM = 'https://cds.unistra.fr/cgi-bin/nph-sesame/-oI/SN'

const reply = (body: string, status: number, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers } })

export async function GET(request: Request): Promise<Response> {
  const name = new URL(request.url).searchParams.get('name')?.trim()
  if (!name || name.length > 100) return reply('Give a name of up to 100 characters.', 400)

  try {
    // The resolver wants the name as the whole query string, not as name=...
    const upstream = await fetch(`${UPSTREAM}?${encodeURIComponent(name)}`)
    return reply(await upstream.text(), upstream.status, {
      // The same name always resolves to the same place, so let the CDN remember it.
      'Cache-Control': upstream.ok ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'no-store',
    })
  } catch {
    return reply('The name resolver could not be reached.', 502)
  }
}
