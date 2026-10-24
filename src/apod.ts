export type Apod = {
  date: string // YYYY-MM-DD
  title: string
  explanation: string
  mediaType: 'image' | 'video'
  /** The image itself, or the video page. */
  url: string
  /** A smaller version to try if the main image fails to load. */
  fallbackUrl: string | null
  hdUrl: string | null
  /** A still frame for videos. */
  thumbnailUrl: string | null
  copyright: string | null
  /** Where this came from, which decides the labels in the dialog. */
  source: 'apod' | 'library'
  /** The page on NASA's site for this picture. */
  pageUrl: string
  /** Set when this is not the regular APOD, explaining why. */
  note: string | null
}

type ApodResponse = {
  date?: string
  title?: string
  explanation?: string
  media_type?: string
  url?: string
  hdurl?: string
  thumbnail_url?: string
  copyright?: string
}

// Shown to the user, so they are written as plain sentences.
export class ApodError extends Error {}

// One request per session is plenty: the picture changes once a day.
let cache: Promise<Apod> | null = null

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// --- NASA Astronomy Picture of the Day ---------------------------------------

async function getApodEntry(): Promise<ApodResponse & { date: string }> {
  // The dev server adds the API key (see vite.config.ts).
  let res = await fetch('/api/apod?thumbs=true')

  if (res.status >= 500) {
    // NASA's APOD service fails now and then. Wait a moment and retry once,
    // this time without the optional video thumbnail.
    console.warn('APOD request failed, retrying once:', res.status, (await res.text()).slice(0, 300))
    await wait(800)
    res = await fetch('/api/apod')
  }

  if (res.status === 403) {
    throw new ApodError('NASA rejected the API key. Check NASA_API_KEY in .env.local, then restart the dev server.')
  }
  if (res.status === 429) {
    throw new ApodError('NASA’s rate limit was reached. Try again in a little while.')
  }
  if (!res.ok) {
    console.warn('APOD response:', res.status, (await res.text()).slice(0, 300))
    throw new ApodError(`NASA’s service is unavailable right now (error ${res.status}).`)
  }

  const json = (await res.json()) as ApodResponse
  if (!json.title || !json.explanation || !json.url || !json.date) {
    throw new ApodError('NASA sent back an unexpected response.')
  }
  return { ...json, date: json.date }
}

// NASA builds this API by reading its own web page. When the page layout changes, the
// text can come through fine while the "picture" turns out to be the site logo.
function looksBroken(entry: ApodResponse): boolean {
  return /logo/i.test(entry.url ?? '') || entry.title?.trim().toLowerCase() === 'nasa science'
}

function fromApod(entry: ApodResponse & { date: string }): Apod {
  return {
    date: entry.date,
    title: entry.title ?? '',
    explanation: entry.explanation ?? '',
    mediaType: entry.media_type === 'video' ? 'video' : 'image',
    url: entry.url ?? '',
    fallbackUrl: null,
    hdUrl: entry.hdurl ?? null,
    thumbnailUrl: entry.thumbnail_url ?? null,
    // NASA's credit strings sometimes contain line breaks.
    copyright: entry.copyright ? entry.copyright.replace(/\s+/g, ' ').trim() : null,
    source: 'apod',
    pageUrl: 'https://apod.nasa.gov/apod/astropix.html',
    note: null,
  }
}

// --- NASA Image and Video Library (backup) ------------------------------------

type LibraryItem = {
  data?: {
    nasa_id?: string
    title?: string
    description?: string
    photographer?: string
    secondary_creator?: string
  }[]
  links?: { href?: string; rel?: string }[]
}

type LibraryResponse = { collection?: { items?: LibraryItem[] } }

// Search terms that return space pictures. One is chosen per day.
const SEARCH_TERMS = [
  'galaxy',
  'nebula',
  'supernova remnant',
  'star cluster',
  'planetary nebula',
  'milky way',
  'hubble telescope image',
  'webb telescope image',
  'solar eclipse',
  'comet',
]

const MS_PER_DAY = 86_400_000

function cleanText(text: string): string {
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** NASA often ends descriptions with social media hashtags. */
function stripTrailingHashtags(text: string): string {
  return text.replace(/(\s+#[\w-]+)+\s*$/, '').trim()
}

/** The same picture all day, a different one tomorrow. */
async function getLibraryPick(date: string): Promise<Apod | null> {
  const [year, month, day] = date.split('-').map(Number)
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY)

  // Try a few terms in case one returns nothing usable.
  for (let attempt = 0; attempt < 3; attempt++) {
    const term = SEARCH_TERMS[(dayNumber + attempt) % SEARCH_TERMS.length]
    const params = new URLSearchParams({ q: term, media_type: 'image', page_size: '50' })
    const res = await fetch(`/api/nasaimages?${params}`)
    if (!res.ok) {
      console.warn('NASA image library response:', res.status)
      continue
    }

    const json = (await res.json()) as LibraryResponse
    const usable = (json.collection?.items ?? []).filter((item) => {
      const info = item.data?.[0]
      return info?.nasa_id && info.title && info.description && item.links?.[0]?.href
    })
    if (usable.length === 0) continue

    const item = usable[(dayNumber * 7) % usable.length]
    const info = item.data![0]
    const preview = (item.links!.find((link) => link.rel === 'preview') ?? item.links![0]).href!

    // Search results link to a small thumbnail. A medium size usually exists too.
    const medium = preview.includes('~thumb.') ? preview.replace('~thumb.', '~medium.') : null

    const credit = info.photographer ?? info.secondary_creator
    return {
      date,
      title: info.title!,
      explanation: stripTrailingHashtags(cleanText(info.description!)),
      mediaType: 'image',
      url: medium ?? preview,
      fallbackUrl: medium ? preview : null,
      hdUrl: null,
      thumbnailUrl: null,
      copyright: credit ? cleanText(credit) : null,
      source: 'library',
      pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(info.nasa_id!)}`,
      note: 'NASA’s Astronomy Picture of the Day feed is returning a broken entry today, so this is a space picture from NASA’s image library instead.',
    }
  }
  return null
}

// --- public API -----------------------------------------------------------------

async function request(): Promise<Apod> {
  const today = await getApodEntry()
  if (!looksBroken(today)) return fromApod(today)

  console.warn('Today’s APOD entry looks broken in NASA’s data:', today.title, today.url)
  try {
    const pick = await getLibraryPick(today.date)
    if (pick) return pick
  } catch (err) {
    console.warn('Could not load the NASA image library:', err)
  }
  throw new ApodError(
    'NASA’s Astronomy Picture of the Day feed is returning a broken entry today, and the backup image library could not be reached.',
  )
}

export function fetchApod(): Promise<Apod> {
  if (!cache) {
    cache = request().catch((err) => {
      cache = null // allow a retry
      throw err
    })
  }
  return cache
}

/** "2026-10-14" -> "October 14, 2026", without any time zone shifting. */
export function formatApodDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
