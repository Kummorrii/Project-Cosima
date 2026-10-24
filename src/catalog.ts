import { SUN_GALACTOCENTRIC_KPC } from './constants'
import { GALACTIC_CENTER, SOLAR_NEIGHBORHOOD, formatLightYears } from './destinations'
import type { Destination } from './destinations'
import { visualFor } from './objectVisual'
import { defaultFov } from './skyImage'

// Must match the layout written by scripts/build-stars.mjs
const STRIDE = 7

type StarMeta = {
  index: number
  name: string
  raDeg: number
  decDeg: number
  distPc: number
  mag: number
  spect: string | null
  con: string | null
}

export type CatalogEntry = Destination & {
  /** Normalized names this entry can be found by. */
  keys: string[]
  /** Used to break ties: brighter stars (lower magnitude) rank first. */
  mag: number
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// The Sun has no sky position or distance in the star catalog, so its facts are written by hand.
const SUN_FACTS: [string, string][] = [
  ['Distance from Earth', '149.6 million km (8.3 light-minutes)'],
  ['Distance from galactic center', formatLightYears(SUN_GALACTOCENTRIC_KPC * 1000)],
  ['Diameter', '1.39 million km'],
  ['Age', 'About 4.6 billion years'],
  ['Surface temperature', 'About 5,500 °C'],
]

const EXTRA_KEYS: Record<string, string[]> = {
  Sol: ['sun', 'the sun'],
  Sirius: ['dog star'],
  Polaris: ['north star', 'pole star'],
  'Rigil Kentaurus': ['alpha centauri', 'alpha centauri a'],
  Toliman: ['alpha centauri b'],
}

let cache: Promise<CatalogEntry[]> | null = null

export function loadCatalog(): Promise<CatalogEntry[]> {
  if (!cache) {
    cache = (async () => {
      const [binRes, metaRes] = await Promise.all([
        fetch('/data/stars.bin'),
        fetch('/data/stars-meta.json'),
      ])
      if (!binRes.ok || !metaRes.ok) throw new Error('Could not load the star catalog files')

      const stars = new Float32Array(await binRes.arrayBuffer())
      const meta = (await metaRes.json()) as StarMeta[]

      const entries: CatalogEntry[] = meta.map((m) => {
        const i = m.index * STRIDE
        return {
          id: `star:${m.index}`,
          name: m.name,
          kind: 'star',
          subtitle: m.name === 'Sol' ? 'Our Sun' : `Star, ${formatLightYears(m.distPc)} away`,
          position: [stars[i], stars[i + 1], stars[i + 2]],
          viewDistance: 0.004,
          visual: visualFor({ kind: 'star', spectralType: m.spect, isSun: m.name === 'Sol' }),
          details: {
            // The catalog stores the Sun at 0, 0, which is not a real sky position.
            ...(m.name === 'Sol'
              ? { extraFacts: SUN_FACTS }
              : { raDeg: m.raDeg, decDeg: m.decDeg, distancePc: m.distPc }),
            magnitude: m.mag,
            spectralClass: m.spect ?? undefined,
            constellation: m.con ?? undefined,
            mainId: m.name,
            fovDeg: defaultFov('star'),
          },
          keys: [normalize(m.name), ...(EXTRA_KEYS[m.name] ?? [])],
          mag: m.mag,
        }
      })

      entries.push(
        {
          ...GALACTIC_CENTER,
          keys: ['galactic center', 'galactic centre', 'milky way center', 'sagittarius a', 'sgr a'],
          mag: 99,
        },
        {
          ...SOLAR_NEIGHBORHOOD,
          keys: ['solar neighborhood', 'solar neighbourhood', 'local neighborhood'],
          mag: 99,
        },
      )

      return entries
    })().catch((err) => {
      cache = null
      throw err
    })
  }
  return cache
}

// 0 = name starts with the query, 1 = a word starts with it, 2 = contained somewhere.
function score(key: string, query: string): number {
  const compactKey = key.replace(/ /g, '')
  const compactQuery = query.replace(/ /g, '')
  if (key.startsWith(query) || compactKey.startsWith(compactQuery)) return 0
  if (` ${key}`.includes(` ${query}`)) return 1
  if (key.includes(query) || compactKey.includes(compactQuery)) return 2
  return Infinity
}

export function searchCatalog(entries: CatalogEntry[], rawQuery: string, limit = 6): CatalogEntry[] {
  const query = normalize(rawQuery)
  if (!query) return []

  const scored: { entry: CatalogEntry; score: number }[] = []
  for (const entry of entries) {
    let best = Infinity
    for (const key of entry.keys) best = Math.min(best, score(key, query))
    if (best < Infinity) scored.push({ entry, score: best })
  }

  scored.sort((a, b) => a.score - b.score || a.entry.mag - b.entry.mag)
  return scored.slice(0, limit).map((s) => s.entry)
}
