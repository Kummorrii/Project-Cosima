// Searches NASA's Image and Video Library. This is the backup for when the
// Astronomy Picture of the Day feed is broken. It needs no key.

const UPSTREAM = 'https://images-api.nasa.gov/search'

const reply = (body: string, status: number, cache: string) =>
  new Response(body, { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } })

export async function GET(request: Request): Promise<Response> {
  const incoming = new URL(request.url).searchParams
  const q = incoming.get('q')?.trim()
  if (!q || q.length > 100) return reply(JSON.stringify({ error: 'Give a search of up to 100 characters.' }), 400, 'no-store')

  const pageSize = Math.min(100, Math.max(1, Number(incoming.get('page_size')) || 50))
  const params = new URLSearchParams({ q, media_type: 'image', page_size: String(pageSize) })

  try {
    const upstream = await fetch(`${UPSTREAM}?${params}`)
    return reply(
      await upstream.text(),
      upstream.status,
      upstream.ok ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'no-store',
    )
  } catch {
    return reply(JSON.stringify({ error: 'The NASA image library could not be reached.' }), 502, 'no-store')
  }
}
