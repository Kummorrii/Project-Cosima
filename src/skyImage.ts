import type { DestinationKind } from './destinations'

export type Survey = {
  /** HiPS identifier used by the CDS image service. */
  id: string
  label: string
  credit: string
}

export const SURVEYS: Survey[] = [
  { id: 'CDS/P/DSS2/color', label: 'Optical', credit: 'Digitized Sky Survey 2' },
  { id: 'CDS/P/2MASS/color', label: 'Near-infrared', credit: '2MASS' },
  { id: 'CDS/P/allWISE/color', label: 'Infrared', credit: 'AllWISE' },
]

export const IMAGE_WIDTH = 640
export const IMAGE_HEIGHT = 400

/** A cutout of the sky as a plain JPEG, rendered on demand by CDS. */
export function skyImageUrl(hips: string, raDeg: number, decDeg: number, fovDeg: number): string {
  const params = new URLSearchParams({
    hips,
    width: String(IMAGE_WIDTH),
    height: String(IMAGE_HEIGHT),
    fov: String(fovDeg),
    projection: 'TAN',
    coordsys: 'icrs',
    rotation_angle: '0.0',
    ra: String(raDeg),
    dec: String(decDeg),
    format: 'jpg',
  })
  return `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?${params}`
}

/** The same view in the interactive Aladin Lite viewer. */
export function aladinUrl(hips: string, raDeg: number, decDeg: number, fovDeg: number): string {
  const target = encodeURIComponent(`${raDeg} ${decDeg}`)
  return `https://aladin.cds.unistra.fr/AladinLite/?target=${target}&fov=${fovDeg}&survey=${encodeURIComponent(hips)}`
}

/** A sensible field of view, in degrees, for each kind of object. */
export function defaultFov(kind: DestinationKind, majAxisArcmin?: number | null): number {
  if (kind === 'galaxy' && majAxisArcmin) {
    return Math.min(10, Math.max(0.1, (majAxisArcmin * 1.8) / 60))
  }
  switch (kind) {
    case 'star':
      return 0.25
    case 'galaxy':
      return 0.4
    case 'nebula':
      return 1.5
    case 'cluster':
      return 0.8
    default:
      return 0.5
  }
}
