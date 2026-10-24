import { useMemo } from 'react'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { motionTime } from './motion'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// A warm light that swells and fades very slowly, like the galaxy is breathing.
const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float glow = exp(-d * d * 5.0) * 0.5 + exp(-d * 10.0) * 0.5;
  float breathe = 0.88 + 0.12 * sin(uTime * 0.7);
  float a = glow * breathe;
  gl_FragColor = vec4(uColor * a, a);
}
`

type Props = {
  /** Width of the glow, in scene units. */
  size?: number
  color?: string
}

/** The glowing heart of a galaxy. Always faces the camera. */
export default function CoreGlow({ size = 7, color = '#ffb86b' }: Props) {
  const uniforms = useMemo(
    () => ({ uTime: motionTime, uColor: { value: new THREE.Color(color) } }),
    [color],
  )

  return (
    <Billboard>
      <mesh frustumCulled={false}>
        <planeGeometry args={[size, size]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Billboard>
  )
}
