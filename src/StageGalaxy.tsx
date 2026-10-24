import { useMemo } from 'react'
import CoreGlow from './CoreGlow'
import {
  buildBulge,
  buildClouds,
  buildElliptical,
  buildIrregular,
  buildSpiralStars,
} from './galaxyData'
import type { StarData } from './galaxyData'
import type { GalaxyVisual } from './objectVisual'
import StarPoints from './StarPoints'

const RADIUS = 1.9

type Layers = {
  stars: StarData
  bulge: StarData | null
  clouds: StarData | null
  glowSize: number
  glowColor: string
}

function buildLayers(visual: GalaxyVisual, seed: number): Layers {
  switch (visual.shape) {
    case 'elliptical':
      return {
        stars: buildElliptical(36000, RADIUS, visual.flatten, seed),
        bulge: null,
        clouds: null,
        glowSize: 4.2,
        glowColor: '#ffc78a',
      }
    case 'irregular':
      return {
        stars: buildIrregular(30000, RADIUS, seed),
        bulge: null,
        clouds: null,
        glowSize: 2.4,
        glowColor: '#9fc0ff',
      }
    default:
      return {
        stars: buildSpiralStars(
          { count: 42000, radius: RADIUS, arms: visual.arms, spin: visual.spin, randomness: 0.3 },
          seed,
        ),
        bulge: buildBulge(6000, 0.55, seed + 1),
        clouds: buildClouds({ radius: RADIUS, arms: visual.arms, spin: visual.spin }, 70, seed + 2),
        glowSize: 3.4,
        glowColor: '#ffb86b',
      }
  }
}

/** A galaxy of the right kind, tilted and turned the way it really lies in the sky. */
export default function StageGalaxy({ visual, seed }: { visual: GalaxyVisual; seed: number }) {
  const layers = useMemo(() => buildLayers(visual, seed), [visual, seed])

  // Spirals are disks, so tilt them. Ellipticals and irregulars are already
  // squashed into their final shape, so only the in-picture rotation applies.
  const tilt = visual.shape === 'spiral' ? Math.PI / 2 - visual.inclination : 0

  return (
    <group rotation={[0, 0, visual.roll]}>
      <group rotation={[tilt, 0, 0]}>
        {layers.clouds && (
          <StarPoints
            {...layers.clouds}
            size={600}
            alpha={0.08}
            attenuate
            maxSize={120}
            twinkle={0}
            flares={false}
          />
        )}
        <StarPoints {...layers.stars} size={1.6} alpha={0.9} twinkle={0.4} />
        {layers.bulge && <StarPoints {...layers.bulge} size={1.4} alpha={0.9} twinkle={0.3} />}
      </group>
      <CoreGlow size={layers.glowSize} color={layers.glowColor} />
    </group>
  )
}
