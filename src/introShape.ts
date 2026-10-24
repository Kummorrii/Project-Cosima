// The shape of the curtain during the intro.
//
// The star lifts the middle of a black curtain. The curtain's lower edge ("hem") is a
// peak at the star that sweeps down and outward to the sides, like a drape pulled up
// from its center. As the star rises the drape flattens, until the whole screen is
// uncovered.

/** How deep the drape hangs below the star at the start, as a fraction of screen height. */
export const SAG = 0.44

/** How quickly the hem falls away from the star, as a fraction of the larger screen side.
 *  Smaller is a sharper peak. */
export const REACH = 0.13

/** Where the folds meet the hem, as fractions of half the screen width from the center. */
const FOLD_POSITIONS = [0.1, 0.22, 0.36, 0.52, 0.7, 0.88]

/** How many segments make up the hem. More is smoother. Must be even so one lands on the star. */
const STEPS = 96

export type Shape = {
  /** Vertical position of the star, in pixels from the top. */
  yStar: number
  /** The black curtain: everything above the hem. */
  cover: string
  /** The glowing hem line. */
  hem: string
  /** Fabric folds hanging in the wings beside the star. */
  folds: string
}

/** Slow start, quick middle, slow finish. Symmetric, so the star passes the middle at 50%. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Height of the hem at horizontal position x. `e` is the eased progress from 0 to 1. */
export function profileY(x: number, width: number, height: number, e: number): number {
  const yStar = height * (1 - e)
  const sag = SAG * height * (1 - e)
  const reach = REACH * Math.max(width, height)
  return Math.min(height, yStar + sag * (1 - Math.exp(-Math.abs(x - width / 2) / reach)))
}

const fixed = (n: number) => n.toFixed(1)

export function computeShape(width: number, height: number, e: number): Shape {
  const yStar = height * (1 - e)
  const centerX = width / 2

  const points: string[] = []
  for (let i = 0; i <= STEPS; i++) {
    const x = (width * i) / STEPS
    points.push(`${fixed(x)} ${fixed(profileY(x, width, height, e))}`)
  }
  const hem = `M ${points.join(' L ')}`
  // The extra pixel above the screen avoids a hairline gap at the top edge.
  const cover = `${hem} L ${fixed(width)} -1 L 0 -1 Z`

  // Each fold starts at the star's height, further out than where it meets the hem,
  // drops steeply, then flattens as it curves in to meet the hem.
  const folds: string[] = []
  for (const side of [-1, 1]) {
    FOLD_POSITIONS.forEach((position, i) => {
      const xHem = centerX + side * position * centerX
      const yHem = profileY(xHem, width, height, e)
      if (yHem - yStar < 10) return // no wing left to hang a fold in
      const xTop = xHem + side * width * (0.05 + 0.012 * i)
      folds.push(`M ${fixed(xTop)} ${fixed(yStar)} Q ${fixed(xTop)} ${fixed(yHem)} ${fixed(xHem)} ${fixed(yHem)}`)
    })
  }

  return { yStar, cover, hem, folds: folds.join(' ') }
}
