import type { Destination } from './destinations'

export type WikiSummary = {
  title: string
  extract: string
  url: string
}

const cache = new Map<string, WikiSummary | null>()

async function fetchOne(title: string, signal: AbortSignal): Promise<WikiSummary | null> {
  const slug = encodeURIComponent(title.replace(/ /g, '_'))
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, { signal })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Wikipedia error (${res.status})`)

  const json = (await res.json()) as {
    type?: string
    title?: string
    extract?: string
    content_urls?: { desktop?: { page?: string } }
  }
  if (json.type === 'disambiguation' || !json.extract) return null

  return {
    title: json.title ?? title,
    extract: json.extract,
    url: json.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${slug}`,
  }
}

/** Tries each title in turn and returns the first real article. */
export async function fetchSummary(
  candidates: string[],
  signal: AbortSignal,
): Promise<WikiSummary | null> {
  const key = candidates.join('|')
  if (cache.has(key)) return cache.get(key) ?? null

  for (const title of candidates) {
    const summary = await fetchOne(title, signal)
    if (summary) {
      cache.set(key, summary)
      return summary
    }
  }
  cache.set(key, null)
  return null
}

/** Article titles worth trying for a destination, best guess first. */
export function wikipediaCandidates(destination: Destination): string[] {
  if (destination.id === 'place:galactic-center') return ['Galactic Center']
  if (destination.id === 'place:solar-neighborhood') return ['Solar neighborhood']
  if (destination.name === 'Sol') return ['Sun']

  const messier = destination.name.match(/^M\s*(\d+)$/i)
  if (messier) return [`Messier ${messier[1]}`]

  if (destination.kind === 'star') return [destination.name, `${destination.name} (star)`]
  return [destination.name]
}
