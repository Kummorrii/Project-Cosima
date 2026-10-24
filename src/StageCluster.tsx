import { useMemo } from 'react'
import CoreGlow from './CoreGlow'
import { buildCluster } from './galaxyData'
import type { ClusterVisual } from './objectVisual'
import StarPoints from './StarPoints'

/** A swarm of stars: a dense old ball (globular) or a loose young group (open). */
export default function StageCluster({ visual, seed }: { visual: ClusterVisual; seed: number }) {
  const stars = useMemo(() => buildCluster(visual.style, 1.8, seed), [visual.style, seed])
  const globular = visual.style === 'globular'

  return (
    <>
      <StarPoints
        {...stars}
        size={globular ? 1.5 : 3.4}
        alpha={globular ? 0.9 : 1}
        twinkle={globular ? 0.35 : 0.5}
      />
      {globular && <CoreGlow size={3.2} color="#ffd9a0" />}
    </>
  )
}
