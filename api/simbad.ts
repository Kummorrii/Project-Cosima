// Runs a read-only ADQL query against SIMBAD's TAP service and returns the JSON result.
// The browser sends the query text. Everything else about the request is fixed here.

const UPSTREAM = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync'
const MAX_QUERY_LENGTH = 2000

const reply = (body: string, status: number, contentType = 'text/plain; charset=utf-8') =>
  new Response(body, { status, headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' } })

export async function POST(request: Request): Promise<Response> {
  let query: unknown
  try {
    query = (await request.formData()).get('query')
  } catch {
    return reply('Send the query as form data.', 400)
  }
  if (typeof query !== 'string' || !query.trim() || query.length > MAX_QUERY_LENGTH) {
    return reply(`Give a query of up to ${MAX_QUERY_LENGTH} characters.`, 400)
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'json', query }),
    })
    return reply(await upstream.text(), upstream.status, upstream.headers.get('content-type') ?? 'application/json')
  } catch {
    return reply('SIMBAD could not be reached.', 502)
  }
}
