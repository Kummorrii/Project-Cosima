import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import ApodDialog from './ApodDialog'
import Backdrop from './Backdrop'
import CameraRig from './CameraRig'
import DetailPanel from './DetailPanel'
import Galaxy from './Galaxy'
import Intro from './Intro'
import MotionClock from './MotionClock'
import ObjectStage from './ObjectStage'
import SearchBar from './SearchBar'
import Watermark from './Watermark'
import ShootingStars from './ShootingStars'
import Stars from './Stars'
import TargetMarker from './TargetMarker'
import { GALACTIC_CENTER, SOLAR_NEIGHBORHOOD } from './destinations'
import { useCosima } from './store'

export default function App() {
  const flyTo = useCosima((state) => state.flyTo)
  const motion = useCosima((state) => state.motion)
  const toggleMotion = useCosima((state) => state.toggleMotion)
  const [apodOpen, setApodOpen] = useState(false)

  return (
    <>
      <Canvas
        camera={{ position: [0, 9, 16], fov: 55, near: 0.0001, far: 1e6 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#05070d']} />
        <MotionClock />
        <Backdrop />
        <Galaxy />
        <Stars />
        <ShootingStars />
        <OrbitControls
          makeDefault
          autoRotate={motion}
          autoRotateSpeed={0.4}
          enableDamping
          dampingFactor={0.06}
          minDistance={0.0005}
          maxDistance={60}
        />
        <CameraRig />
        <TargetMarker />
      </Canvas>

      <div className="hud">
        <h1>Cosima</h1>
        <SearchBar />
        <div className="hud-actions">
          <button type="button" onClick={() => flyTo(GALACTIC_CENTER)}>
            Galactic center
          </button>
          <button type="button" onClick={() => flyTo(SOLAR_NEIGHBORHOOD)}>
            Solar neighborhood
          </button>
          <button type="button" onClick={() => setApodOpen(true)}>
            Today in space
          </button>
          <button type="button" onClick={toggleMotion}>
            Motion: {motion ? 'on' : 'off'}
          </button>
        </div>
        <p className="hud-hint">Drag to orbit. Scroll to zoom.</p>
      </div>

      <ObjectStage />
      <Watermark />
      <DetailPanel />
      <ApodDialog open={apodOpen} onClose={() => setApodOpen(false)} />
      <Intro />
    </>
  )
}
