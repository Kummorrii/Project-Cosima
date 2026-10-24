import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useCosima } from './store'

// The bits of OrbitControls we use. Requires <OrbitControls makeDefault />.
type OrbitLike = {
  target: THREE.Vector3
  enabled: boolean
  autoRotate: boolean
  maxDistance: number
  update: () => void
}

type Flight = {
  from: THREE.Vector3
  to: THREE.Vector3
  dir: THREE.Vector3 // direction from target to camera, kept constant
  startDistance: number
  endDistance: number
  length: number // how far the target moves, in scene units
  duration: number // seconds
  elapsed: number
}

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export default function CameraRig() {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as unknown as OrbitLike | null
  const flightId = useCosima((state) => state.flightId)
  const flight = useRef<Flight | null>(null)

  // Start a new flight whenever flyTo is called.
  useEffect(() => {
    const destination = useCosima.getState().destination
    if (!destination || !controls) return

    const from = controls.target.clone()
    const to = new THREE.Vector3(...destination.position)
    const offset = camera.position.clone().sub(from)
    const startDistance = Math.max(offset.length(), 1e-6)
    const length = from.distanceTo(to)

    flight.current = {
      from,
      to,
      dir: offset.divideScalar(startDistance),
      startDistance,
      endDistance: destination.viewDistance,
      length,
      // Longer trips take longer, but never more than 5 seconds.
      duration: THREE.MathUtils.clamp(1.6 + 0.7 * Math.log10(1 + length / 0.001), 1.8, 5),
      elapsed: 0,
    }

    controls.enabled = false
    controls.autoRotate = false // no idle orbit while the camera is flying
    controls.maxDistance = Infinity // so the pull-back mid-flight is not clamped
  }, [flightId, controls, camera])

  useFrame((_, delta) => {
    const f = flight.current
    if (!f || !controls) return

    f.elapsed += Math.min(delta, 0.05)
    const t = Math.min(f.elapsed / f.duration, 1)
    const e = easeInOutCubic(t)

    controls.target.lerpVectors(f.from, f.to, e)

    // Zoom in log-space so the speed feels even from light-years to parsecs,
    // plus an arc that pulls the camera back mid-flight to show the journey.
    const base = Math.exp(
      THREE.MathUtils.lerp(Math.log(f.startDistance), Math.log(f.endDistance), e),
    )
    const distance = base + f.length * 0.25 * Math.sin(Math.PI * t)

    camera.position.copy(f.dir).multiplyScalar(distance).add(controls.target)
    controls.update()

    if (t >= 1) {
      flight.current = null
      controls.enabled = true
      controls.autoRotate = useCosima.getState().motion
      controls.maxDistance = Math.max(60, f.endDistance * 4)
      useCosima.getState().arrive()
    }
  })

  return null
}
