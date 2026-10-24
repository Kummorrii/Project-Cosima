import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Destination } from './destinations'
import { seedFromString } from './galaxyData'
import StageCluster from './StageCluster'
import StageCorona from './StageCorona'
import StageGalaxy from './StageGalaxy'
import StageNebula from './StageNebula'
import StageStar from './StageStar'
import { selectFocus, useCosima } from './store'

// Width taken by the detail panel on the right: its 380px plus the gaps around it.
const PANEL_PX = 412

/** Slides the picture clear of the detail panel and eases the object in. */
function Rig({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const age = useRef(0)

  // On a wide screen the panel is on the right, so shift the view left. On a phone it
  // is a sheet along the bottom, so shift the view up. Shifting the view, rather than the
  // object, keeps dragging to rotate working around the object's own center.
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const narrow = size.width <= 700
    camera.setViewOffset(
      size.width,
      size.height,
      narrow ? 0 : PANEL_PX / 2,
      narrow ? size.height * 0.31 : 0,
      size.width,
      size.height,
    )
    return () => camera.clearViewOffset()
  }, [camera, size])

  useFrame((_, delta) => {
    age.current += delta
    const t = Math.min(age.current / 0.9, 1)
    const eased = 1 - Math.pow(1 - t, 3)
    group.current?.scale.setScalar(0.82 + 0.18 * eased)
  })

  return <group ref={group}>{children}</group>
}

function Visual({ destination }: { destination: Destination }) {
  const seed = useMemo(() => seedFromString(destination.id), [destination.id])
  const visual = destination.visual
  if (!visual) return null

  switch (visual.type) {
    case 'star':
      return <StageStar visual={visual} />
    case 'galaxy':
      return <StageGalaxy visual={visual} seed={seed} />
    case 'nebula':
      return <StageNebula visual={visual} />
    case 'cluster':
      return <StageCluster visual={visual} seed={seed} />
    case 'generic':
      return <StageCorona color={visual.color} size={6} inner={0.03} />
  }
}

/**
 * Focus mode. Once the camera arrives at an object, the background blurs and a
 * stylized version of the object takes center stage. Closing the panel returns to the galaxy.
 */
export default function ObjectStage() {
  const shown = useCosima((state) => state.shown)
  const active = useCosima(selectFocus)

  return (
    <>
      <div className="veil" data-active={active} aria-hidden="true" />

      {shown && (
        <div className="stage" data-active={active} aria-hidden="true">
          <Canvas
            frameloop={active ? 'always' : 'never'}
            camera={{ position: [0, 0, 7.5], fov: 40, near: 0.1, far: 100 }}
            dpr={[1, 2]}
            gl={{ alpha: true, antialias: true }}
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          >
            <Rig key={shown.id}>
              <Visual destination={shown} />
            </Rig>
            <OrbitControls enablePan={false} enableZoom={false} enableDamping dampingFactor={0.08} rotateSpeed={0.6} />
          </Canvas>
        </div>
      )}
    </>
  )
}
