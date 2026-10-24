import { KPC_PER_UNIT, SUN_GALACTOCENTRIC_KPC } from './constants'
import type { Vec3 } from './constants'

const DEG = Math.PI / 180

// Same conversion as scripts/build-stars.mjs, so searched objects
// land in the same frame as the star catalog.
export function skyToScene(raDeg: number, decDeg: number, distPc: number): Vec3 {
  const ra = raDeg * DEG
  const dec = decDeg * DEG

  // Equatorial (J2000) cartesian, in parsecs
  const x = distPc * Math.cos(dec) * Math.cos(ra)
  const y = distPc * Math.cos(dec) * Math.sin(ra)
  const z = distPc * Math.sin(dec)

  // Equatorial -> galactic
  const gx = -0.0548755604 * x - 0.8734370902 * y - 0.4838350155 * z
  const gy = 0.4941094279 * x - 0.44482963 * y + 0.7469822445 * z
  const gz = -0.867666149 * x - 0.1980763734 * y + 0.4559837762 * z

  // Galactic parsecs -> scene units, galactic center at the origin, y up
  return [
    (gx / 1000 - SUN_GALACTOCENTRIC_KPC) / KPC_PER_UNIT,
    gz / 1000 / KPC_PER_UNIT,
    -gy / 1000 / KPC_PER_UNIT,
  ]
}
