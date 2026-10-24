import { KPC_PER_UNIT } from './constants'
import { skyToScene } from './coords'
import { formatLightYears } from './destinations'
import { visualFor } from './objectVisual'
import { defaultFov } from './skyImage'
import type { Destination, DestinationKind } from './destinations'

// These addresses are served by the dev proxy in vite.config.ts while developing, and by the
// functions in the api/ folder on the live site. Either way the browser only talks to our own site.
const SESAME_URL = '/api/sesame' // name -> coordinates (SIMBAD, then NED)
const TAP_URL = '/api/simbad' // coordinates -> type and distance

const SPEED_OF_LIGHT_KM_S = 299792.458
const HUBBLE_KM_S_MPC = 70

// If SIMBAD has no usable distance, show the object at this distance along its sightline.
const FALLBACK_DISTANCE_PC = 1000

type SkyPosition = {
  raDeg: number
  decDeg: number
  name: string // tidy name for display
  rawId: string | null // identifier exactly as SIMBAD spells it, used for lookups
}

type ObjectInfo = {
  mainId: string | null
  otype: string | null
  distancePc: number | null
  majAxisArcmin: number | null // apparent size of galaxies
  minAxisArcmin: number | null // apparent width, used to tilt galaxies
  angleDeg: number | null // position angle of a galaxy's long axis
  morphType: string | null // galaxy shape classification
  spectralType: string | null // for stars
}

const NO_INFO: ObjectInfo = {
  mainId: null,
  otype: null,
  distancePc: null,
  majAxisArcmin: null,
  minAxisArcmin: null,
  angleDeg: null,
  morphType: null,
  spectralType: null,
}

// Readable names for common SIMBAD object types.
const OTYPE_LABELS: Record<string, string> = {
  G: 'Galaxy',
  AGN: 'Active galaxy',
  Sy1: 'Seyfert galaxy',
  Sy2: 'Seyfert galaxy',
  LIN: 'LINER galaxy',
  QSO: 'Quasar',
  GiG: 'Galaxy in a group',
  GiC: 'Galaxy in a cluster',
  BiC: 'Brightest galaxy in a cluster',
  GiP: 'Galaxy in a pair',
  rG: 'Radio galaxy',
  H2G: 'Starforming galaxy',
  ClG: 'Cluster of galaxies',
  HII: 'H II region (glowing gas cloud)',
  PN: 'Planetary nebula',
  SNR: 'Supernova remnant',
  RNe: 'Reflection nebula',
  GlC: 'Globular cluster',
  OpC: 'Open cluster',
  'Cl*': 'Star cluster',
  '*': 'Star',
}

// --- name resolver ---------------------------------------------------------

async function resolveName(query: string): Promise<SkyPosition | null> {
  const res = await fetch(`${SESAME_URL}?name=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`Name resolver error (${res.status})`)
  const text = await res.text()

  // Sesame prints a line like:  %J 010.684708 +41.268750 = 00:42:44.33 +41:16:07.5
  const position = text.match(/^%J\s+([+-]?\d+(?:\.\d+)?)\s+([+-]\d+(?:\.\d+)?)/m)
  if (!position) return null

  const id = text.match(/^%I\.0\s+(.+)$/m)
  const rawId = id ? id[1].trim() : null
  const name = rawId ? rawId.replace(/^NAME\s+/, '').replace(/\s+/g, ' ') : query

  return { raDeg: parseFloat(position[1]), decDeg: parseFloat(position[2]), name, rawId }
}

// --- type and distance -----------------------------------------------------

type TapResult = { metadata?: { name: string }[]; data: unknown[][] }

async function runTap(adql: string): Promise<TapResult> {
  const body = new URLSearchParams({
    request: 'doQuery',
    lang: 'adql',
    format: 'json',
    query: adql,
  })
  const res = await fetch(TAP_URL, { method: 'POST', body })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300)
    throw new Error(`SIMBAD error (${res.status}): ${detail}`)
  }
  return (await res.json()) as TapResult
}

const UNIT_TO_PC: Record<string, number> = { pc: 1, kpc: 1e3, mpc: 1e6, gpc: 1e9 }

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

async function lookupInfo(sky: SkyPosition): Promise<ObjectInfo> {
  const select = 'SELECT TOP 1 b.oid, b.main_id, b.otype, b.plx_value, b.rvz_redshift FROM basic AS b'
  let row: unknown[] | undefined

  // Best: match the exact identifier. A search around a position can pick a
  // neighbor instead, for example a star inside a nebula.
  if (sky.rawId) {
    try {
      const id = sky.rawId.replace(/'/g, "''")
      const byId = await runTap(`${select} JOIN ident AS i ON i.oidref = b.oid WHERE i.id = '${id}'`)
      row = byId.data[0]
    } catch (err) {
      console.warn('Could not look the object up by identifier:', err)
    }
  }

  // Fallback: whatever is within a few arcseconds of the position.
  if (!row) {
    const near = `CONTAINS(POINT('ICRS', b.ra, b.dec), CIRCLE('ICRS', ${sky.raDeg}, ${sky.decDeg}, 0.002)) = 1`
    row = (await runTap(`${select} WHERE ${near}`)).data[0]
  }

  if (!row) return { ...NO_INFO }

  const [oid, mainId, otype, parallax, redshift] = row

  // Apparent size, used to frame the sky image. Optional: the object may not have one.
  let majAxisArcmin: number | null = null
  if (isNumber(oid)) {
    try {
      const size = await runTap(`SELECT galdim_majaxis FROM basic WHERE oid = ${oid}`)
      const value = size.data[0]?.[0]
      if (isNumber(value) && value > 0) majAxisArcmin = value
    } catch (err) {
      console.warn('Could not read the angular size:', err)
    }
  }

  // Shape, proportions and spectral type, used to draw the object on the focus stage.
  // Optional too: if any of it is missing the visual just uses sensible defaults.
  let minAxisArcmin: number | null = null
  let angleDeg: number | null = null
  let morphType: string | null = null
  let spectralType: string | null = null
  if (isNumber(oid)) {
    try {
      const shape = await runTap(
        `SELECT galdim_minaxis, galdim_angle, morph_type, sp_type FROM basic WHERE oid = ${oid}`,
      )
      const values = shape.data[0] ?? []
      if (isNumber(values[0]) && values[0] > 0) minAxisArcmin = values[0]
      if (isNumber(values[1])) angleDeg = values[1]
      if (typeof values[2] === 'string' && values[2].trim()) morphType = values[2].trim()
      if (typeof values[3] === 'string' && values[3].trim()) spectralType = values[3].trim()
    } catch (err) {
      console.warn('Could not read the object’s shape:', err)
    }
  }

  const base = {
    mainId: typeof mainId === 'string' ? mainId : null,
    otype: typeof otype === 'string' ? otype : null,
    majAxisArcmin,
    minAxisArcmin,
    angleDeg,
    morphType,
    spectralType,
  }

  // 1. Measured distances. SIMBAD keeps these in their own table, so read the
  //    column names from the response instead of assuming them.
  if (isNumber(oid)) {
    try {
      const result = await runTap(`SELECT * FROM mesdistance WHERE oidref = ${oid}`)
      const names = (result.metadata ?? []).map((column) => column.name.toLowerCase())
      const distColumn = names.indexOf('dist')
      const unitColumn = names.indexOf('unit')
      const qualColumn = names.indexOf('qual')

      if (distColumn < 0 || unitColumn < 0) {
        console.warn('Unexpected mesdistance columns:', names)
      } else {
        const measured: { pc: number; qual: string }[] = []
        for (const entry of result.data) {
          const dist = entry[distColumn]
          const unit = entry[unitColumn]
          const qual = qualColumn >= 0 ? entry[qualColumn] : null
          if (isNumber(dist) && dist > 0 && typeof unit === 'string') {
            const factor = UNIT_TO_PC[unit.trim().toLowerCase()]
            if (factor) {
              measured.push({
                pc: dist * factor,
                qual: typeof qual === 'string' ? qual.trim() : '',
              })
            }
          }
        }

        // SIMBAD grades measurements A (best) to E. Keep only the best grade present.
        const grades = measured.map((m) => m.qual).filter(Boolean).sort()
        const best = measured.filter((m) => grades.length === 0 || m.qual === grades[0])

        if (best.length > 0) {
          const distancePc = median(best.map((m) => m.pc))
          console.info('[Cosima] SIMBAD distances', {
            mainId: base.mainId,
            otype: base.otype,
            used: best.length,
            total: measured.length,
            grade: grades[0] ?? 'none',
            distancePc,
          })
          return { ...base, distancePc }
        }
      }
    } catch (err) {
      console.warn('Could not read measured distances:', err)
    }
  }

  // 2. Parallax (only trustworthy when it is large enough)
  if (isNumber(parallax) && parallax >= 1) return { ...base, distancePc: 1000 / parallax }

  // 3. Redshift, via Hubble's law (only sensible for clearly receding objects)
  if (isNumber(redshift) && redshift > 0.005) {
    const mpc = (SPEED_OF_LIGHT_KM_S * redshift) / HUBBLE_KM_S_MPC
    return { ...base, distancePc: mpc * 1e6 }
  }

  return { ...base, distancePc: null }
}

// --- building a destination ------------------------------------------------

function classify(otype: string | null): DestinationKind {
  if (!otype) return 'object'
  if (/^(ClG|GrG|CGG|SCG|Cl\*|OpC|GlC|As\*)/.test(otype)) return 'cluster'
  if (/^(G|.*G|GiC|BiC|GiP|AGN|AG\?|Sy.*|LIN|QSO|Bla|BLL|rG|LSB|bCG|IG)$/.test(otype)) return 'galaxy'
  if (/^(HII|PN|SNR|Cld|RNe|ISM|GNe|DNe|EmO|reg)/.test(otype)) return 'nebula'
  if (otype.includes('*')) return 'star'
  return 'object'
}

const KIND_LABEL: Record<DestinationKind, string> = {
  place: 'Place',
  star: 'Star',
  galaxy: 'Galaxy',
  nebula: 'Nebula',
  cluster: 'Cluster',
  object: 'Object',
}

function viewDistanceFor(kind: DestinationKind, distanceUnits: number): number {
  switch (kind) {
    case 'star':
      return 0.004
    case 'galaxy':
      return Math.max(0.5, distanceUnits * 0.2)
    case 'nebula':
    case 'cluster':
      return Math.min(5, Math.max(0.004, distanceUnits * 0.03))
    default:
      return Math.max(0.004, distanceUnits * 0.1)
  }
}

export async function resolveObject(query: string): Promise<Destination | null> {
  const sky = await resolveName(query)
  if (!sky) return null

  let info: ObjectInfo = { ...NO_INFO }
  try {
    info = await lookupInfo(sky)
  } catch (err) {
    // The position alone is still enough to fly somewhere sensible.
    console.warn('Could not look up the object type and distance:', err)
  }

  const kind = classify(info.otype)
  const distancePc = info.distancePc ?? FALLBACK_DISTANCE_PC
  const distanceUnits = distancePc / 1000 / KPC_PER_UNIT

  const distanceText =
    info.distancePc !== null
      ? `${formatLightYears(info.distancePc)} away`
      : 'distance not on record, shown 3,300 light-years out'

  return {
    id: `simbad:${info.mainId ?? sky.name}`,
    name: sky.name,
    kind,
    subtitle: `${KIND_LABEL[kind]}, ${distanceText}`,
    position: skyToScene(sky.raDeg, sky.decDeg, distancePc),
    viewDistance: viewDistanceFor(kind, distanceUnits),
    visual: visualFor({
      kind,
      otype: info.otype,
      spectralType: info.spectralType,
      morphType: info.morphType,
      majAxisArcmin: info.majAxisArcmin,
      minAxisArcmin: info.minAxisArcmin,
      angleDeg: info.angleDeg,
    }),
    details: {
      raDeg: sky.raDeg,
      decDeg: sky.decDeg,
      distancePc: info.distancePc ?? undefined,
      typeLabel: info.otype ? (OTYPE_LABELS[info.otype] ?? info.otype) : undefined,
      mainId: info.mainId ?? sky.rawId ?? undefined,
      fovDeg: defaultFov(kind, info.majAxisArcmin),
    },
  }
}
