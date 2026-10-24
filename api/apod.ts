// NASA's Astronomy Picture of the Day. The API key lives here, on the server, as the
// NASA_API_KEY environment variable. It is never sent to the browser.

const UPSTREAM = 'https://api.nasa.gov/planetary/apod'

const reply = (body: string, status: number, cache: string) =>
  new Response(body, { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } })

export async function GET(request: Request): Promise<Response> {
  const incoming = new URL(request.url).searchParams
  const params = new URLSearchParams({ api_key: process.env.NASA_API_KEY || 'DEMO_KEY' })

  // Only these two options are passed on, and the date must look like a date.
  if (incoming.get('thumbs') === 'true') params.set('thumbs', 'true')
  const date = incoming.get('date')
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) params.set('date', date)

  try {
    const upstream = await fetch(`${UPSTREAM}?${params}`)
    return reply(
      await upstream.text(),
      upstream.status,
      // The picture only changes once a day, and this keeps visitors from using up the rate limit.
      upstream.ok ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-store',
    )
  } catch {
    return reply(JSON.stringify({ error: 'NASA could not be reached.' }), 502, 'no-store')
  }
}
