import { SOL_POSITION } from './constants'
import type { Vec3 } from './constants'
import type { ObjectVisual } from './objectVisual'

export type DestinationKind = 'place' | 'star' | 'galaxy' | 'nebula' | 'cluster' | 'object'

/** Extra facts shown in the detail panel. Every field is optional. */
export type DestinationDetails = {
  raDeg?: number
  decDeg?: number
  distancePc?: number
  typeLabel?: string
  spectralClass?: string
  magnitude?: number
  /** Constellation abbreviation, as used in the star catalog (for example "Ori"). */
  constellation?: string
  /** Identifier used to link out to SIMBAD. */
  mainId?: string
  /** Field of view for the sky image, in degrees. */
  fovDeg?: number
  /** Hand-written facts for special objects, as [label, value] pairs. */
  extraFacts?: [string, string][]
}

export type Destination = {
  id: string
  name: string
  kind: DestinationKind
  subtitle: string
  /** Scene position of the object. */
  position: Vec3
  /** How far the camera sits from the object when it arrives, in scene units. */
  viewDistance: number
  details?: DestinationDetails
  /** What to draw on the focus stage once the camera arrives. Places have none. */
  visual?: ObjectVisual
}

export const GALACTIC_CENTER: Destination = {
  id: 'place:galactic-center',
  name: 'Galactic center',
  kind: 'place',
  subtitle: 'The middle of the Milky Way',
  position: [0, 0, 0],
  viewDistance: 18,
}

export const SOLAR_NEIGHBORHOOD: Destination = {
  id: 'place:solar-neighborhood',
  name: 'Solar neighborhood',
  kind: 'place',
  subtitle: 'The stars around our Sun',
  position: SOL_POSITION,
  viewDistance: 0.4,
}

const LIGHT_YEARS_PER_PARSEC = 3.26156

export function formatLightYears(parsecs: number): string {
  const ly = parsecs * LIGHT_YEARS_PER_PARSEC
  if (ly < 10) return `${ly.toFixed(1)} light-years`
  if (ly < 1_000_000) return `${Math.round(ly).toLocaleString('en-US')} light-years`
  if (ly < 1_000_000_000) return `${(ly / 1_000_000).toFixed(1)} million light-years`
  return `${(ly / 1_000_000_000).toFixed(1)} billion light-years`
}

export function formatParsecs(parsecs: number): string {
  if (parsecs < 1000) {
    const value = parsecs < 10 ? parsecs.toFixed(2) : Math.round(parsecs).toLocaleString('en-US')
    return `${value} pc`
  }
  if (parsecs < 1e6) return `${(parsecs / 1e3).toFixed(parsecs < 1e4 ? 2 : 1)} kpc`
  if (parsecs < 1e9) return `${(parsecs / 1e6).toFixed(1)} Mpc`
  return `${(parsecs / 1e9).toFixed(2)} Gpc`
}

export function formatDistance(parsecs: number): string {
  return `${formatLightYears(parsecs)} (${formatParsecs(parsecs)})`
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Right ascension in degrees -> 00h 42m 44.3s */
export function formatRa(deg: number): string {
  const tenths = Math.round((((deg % 360) + 360) % 360) / 15 * 3600 * 10) % (24 * 3600 * 10)
  const h = Math.floor(tenths / 36000)
  const m = Math.floor((tenths % 36000) / 600)
  const s = (tenths % 600) / 10
  return `${pad2(h)}h ${pad2(m)}m ${s.toFixed(1).padStart(4, '0')}s`
}

/** Declination in degrees -> +41° 16′ 09″ */
export function formatDec(deg: number): string {
  const sign = deg < 0 ? '-' : '+'
  const total = Math.round(Math.abs(deg) * 3600)
  const d = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${sign}${pad2(d)}° ${pad2(m)}′ ${pad2(s)}″`
}
