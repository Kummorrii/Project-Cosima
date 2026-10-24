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

// A bloom of light with faint rays, and optionally four diffraction spikes.
const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor;
uniform float uInner;
uniform float uSpikes;

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float d = length(p);
  float angle = atan(p.y, p.x);

  float outside = max(d - uInner, 0.0);
  float glow = exp(-outside * 4.2) * 0.9;
  float halo = exp(-outside * 1.4) * 0.25;
  float rays = 0.65 + 0.35 * sin(angle * 12.0 + uTime * 0.3 + 2.0 * sin(angle * 5.0 - uTime * 0.2));
  float spikes = uSpikes * (exp(-abs(p.x) * 26.0) * exp(-abs(p.y) * 2.2)
                          + exp(-abs(p.y) * 26.0) * exp(-abs(p.x) * 2.2));

  float a = (glow * rays + halo + spikes * 0.8) * (1.0 - smoothstep(0.9, 1.0, d));
  vec3 color = mix(uColor, vec3(1.0), 0.35);

  // Premultiplied: carrying more light than opacity makes it add to what is behind.
  gl_FragColor = vec4(color * a, a * 0.55);
}
`

type Props = {
  color: string
  /** Width of the glow, in scene units. */
  size: number
  /** Where the glow starts, as a fraction of its half-width (the star's edge). */
  inner: number
  spikes?: boolean
}

/** Light around a star. Always faces the camera. */
export default function StageCorona({ color, size, inner, spikes = true }: Props) {
  const uniforms = useMemo(
    () => ({
      uTime: motionTime,
      uColor: { value: new THREE.Color(color) },
      uInner: { value: inner },
      uSpikes: { value: spikes ? 1 : 0 },
    }),
    [color, inner, spikes],
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
          premultipliedAlpha
          depthWrite={false}
        />
      </mesh>
    </Billboard>
  )
}
