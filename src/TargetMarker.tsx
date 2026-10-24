import { Html } from '@react-three/drei'
import { selectFocus, useCosima } from './store'

export default function TargetMarker() {
  const destination = useCosima((state) => state.destination)
  const focus = useCosima(selectFocus)
  if (!destination || focus) return null

  return (
    <Html key={destination.id} position={destination.position} zIndexRange={[10, 0]}>
      <div className="marker">
        <div className="marker-ring" />
        <div className="marker-label">
          <strong>{destination.name}</strong>
          <span>{destination.subtitle}</span>
        </div>
      </div>
    </Html>
  )
}
