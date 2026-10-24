import { useMemo } from 'react'
import CoreGlow from './CoreGlow'
import { buildBulge, buildClouds, buildSpiralStars } from './galaxyData'
import StarPoints from './StarPoints'

type GalaxyProps = {
  count?: number // number of stars in the spiral
  radius?: number // galaxy radius in scene units
  arms?: number // number of spiral arms
  spin?: number // how many turns each arm makes from core to edge
  randomness?: number // how far stars scatter from the arm centerline
}

export default function Galaxy({
  count = 60000,
  radius = 12,
  arms = 4,
  spin = 1.4,
  randomness = 0.35,
}: GalaxyProps) {
  const spiral = useMemo(
    () => buildSpiralStars({ count, radius, arms, spin, randomness }),
    [count, radius, arms, spin, randomness],
  )
  const bulge = useMemo(() => buildBulge(), [])
  const clouds = useMemo(() => buildClouds({ radius, arms, spin }), [radius, arms, spin])

  return (
    <>
      <StarPoints {...clouds} size={1000} alpha={0.07} attenuate maxSize={140} twinkle={0} flares={false} />
      <StarPoints {...spiral} size={1.4} alpha={0.9} twinkle={0.4} />
      <StarPoints {...bulge} size={1.3} alpha={0.9} twinkle={0.3} />
      <CoreGlow />
    </>
  )
}
