import type { DestinationKind } from './destinations'

// What to draw on the focus stage for an object. This is decided from the little we
// know about it: its type, spectral class, galaxy shape and apparent proportions.

export type StarVisual = {
  type: 'star'
  /** Surface color, as a hex string. */
  color: string
  /** Giants and supergiants are drawn larger, with a wider corona. */
  giant: boolean
}

export type GalaxyVisual = {
  type: 'galaxy'
  shape: 'spiral' | 'elliptical' | 'irregular'
  arms: number
  /** How tightly the arms wind. */
  spin: number
  /** Tilt away from face-on, in radians. 0 is face-on, about 1.57 is edge-on. */
  inclination: number
  /** Rotation in the picture, in radians, so the galaxy lies at its real angle. */
  roll: number
  /** For ellipticals: how flattened it is. 1 is round. */
  flatten: number
}

export type NebulaVisual = {
  type: 'nebula'
  palette: 'emission' | 'planetary' | 'remnant' | 'reflection'
}

export type ClusterVisual = {
  type: 'cluster'
  style: 'open' | 'globular'
}

export type GenericVisual = {
  type: 'generic'
  color: string
}

export type ObjectVisual = StarVisual | GalaxyVisual | NebulaVisual | ClusterVisual | GenericVisual

export type VisualInput = {
  kind: DestinationKind
  /** SIMBAD object type, for example "HII" or "AGN". */
  otype?: string | null
  /** Spectral type, for example "B0.5Iavar". */
  spectralType?: string | null
  /** Galaxy shape classification, for example "SA(s)b" or "E1". */
  morphType?: string | null
  majAxisArcmin?: number | null
  minAxisArcmin?: number | null
  /** Position angle of the long axis, in degrees from north through east. */
  angleDeg?: number | null
  isSun?: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Colors of the main spectral classes, from hot blue to cool orange.
const STAR_COLORS: Record<string, string> = {
  O: '#9bb0ff',
  B: '#aabfff',
  A: '#cad7ff',
  F: '#f8f7ff',
  G: '#fff4ea',
  K: '#ffd2a1',
  M: '#ffcc6f',
}

export function starColor(spectralType?: string | null): string {
  if (!spectralType) return '#f8f7ff'
  const letter = spectralType.match(/[OBAFGKM]/)?.[0]
  return letter ? STAR_COLORS[letter] : '#f8f7ff'
}

/** Luminosity classes I, II and III are giants. IV (subgiant) and V (dwarf) are not. */
export function isGiant(spectralType?: string | null): boolean {
  if (!spectralType) return false
  return /^[OBAFGKM][0-9.]*(?:\/[0-9.]+)?(?:Iab|Ia|Ib|III|II|I)(?![IV])/.test(spectralType)
}

type Shape = GalaxyVisual['shape']

function galaxyShape(morphType: string | null | undefined, otype: string | null | undefined): Shape {
  if (morphType) {
    if (/^(?:c?D|dE|dSph|E|S0|SA0|SB0|SAB0)/.test(morphType)) return 'elliptical'
    if (/^I/.test(morphType)) return 'irregular'
    if (/^S/.test(morphType)) return 'spiral'
  }
  // No classification on record: brightest cluster and radio galaxies are usually ellipticals.
  if (otype === 'BiC' || otype === 'rG') return 'elliptical'
  return 'spiral'
}

/** Arm count and winding from a morphology like "SA(s)b": barred galaxies get two arms. */
function spiralArms(morphType: string | null | undefined): { arms: number; spin: number } {
  const cleaned = (morphType ?? '').replace(/\([^)]*\)/g, '')
  const barred = /^SB/.test(cleaned)
  // Drop the "S", "SA", "SB" or "SAB" prefix so only the stage letter (a to m) is left.
  const stage = cleaned.replace(/^S[AB]{0,2}/, '').match(/^[abcdm]/)?.[0]

  switch (stage) {
    case 'a':
      return { arms: 2, spin: 2.0 }
    case 'b':
      return { arms: 2, spin: 1.6 }
    case 'c':
      return { arms: barred ? 2 : 4, spin: 1.2 }
    case 'd':
    case 'm':
      return { arms: barred ? 2 : 3, spin: 0.9 }
    default:
      return { arms: barred ? 2 : 4, spin: 1.4 }
  }
}

function nebulaPalette(otype: string | null | undefined): NebulaVisual['palette'] {
  if (otype === 'PN') return 'planetary'
  if (otype === 'SNR') return 'remnant'
  if (otype === 'RNe') return 'reflection'
  return 'emission'
}

export function visualFor(input: VisualInput): ObjectVisual | undefined {
  const { kind, otype, spectralType, morphType, majAxisArcmin, minAxisArcmin, angleDeg } = input

  switch (kind) {
    case 'star':
      return {
        type: 'star',
        color: input.isSun ? '#ffcf6a' : starColor(spectralType),
        giant: isGiant(spectralType),
      }

    case 'galaxy': {
      // Quasars and blazars are bright points, not shapes worth drawing.
      if (otype && /^(QSO|Bla|BLL)/.test(otype)) return { type: 'generic', color: '#bcd4ff' }

      const shape = galaxyShape(morphType, otype)
      const hasAxes = !!majAxisArcmin && !!minAxisArcmin && majAxisArcmin > 0 && minAxisArcmin > 0
      const ratio = hasAxes ? clamp(minAxisArcmin! / majAxisArcmin!, 0.08, 1) : null
      const { arms, spin } = spiralArms(morphType)

      return {
        type: 'galaxy',
        shape,
        arms,
        spin,
        inclination: ratio !== null ? Math.acos(ratio) : 0.9,
        roll: typeof angleDeg === 'number' ? ((angleDeg + 90) * Math.PI) / 180 : 0.3,
        flatten: ratio !== null ? clamp(ratio, 0.45, 1) : 0.85,
      }
    }

    case 'nebula':
      return { type: 'nebula', palette: nebulaPalette(otype) }

    case 'cluster':
      return { type: 'cluster', style: otype === 'GlC' ? 'globular' : 'open' }

    case 'object':
      return { type: 'generic', color: '#bcd4ff' }

    default:
      return undefined // places have no single object to show
  }
}
