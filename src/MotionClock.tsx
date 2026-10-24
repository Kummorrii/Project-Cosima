import { useFrame } from '@react-three/fiber'
import { motionTime } from './motion'
import { useCosima } from './store'

export default function MotionClock() {
  useFrame((_, delta) => {
    if (useCosima.getState().motion) motionTime.value += Math.min(delta, 0.1)
  })
  return null
}
