import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildBackdrop } from './galaxyData'
import StarPoints from './StarPoints'

/** Distant stars that stay centered on the camera, so they always look infinitely far away. */
export default function Backdrop() {
  const group = useRef<THREE.Group>(null)
  const stars = useMemo(() => buildBackdrop(), [])

  useFrame(({ camera }) => {
    group.current?.position.copy(camera.position)
  })

  return (
    <group ref={group}>
      <StarPoints {...stars} size={1.3} alpha={0.8} twinkle={0.55} rotate={false} />
    </group>
  )
}
