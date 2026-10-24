import { useMemo } from 'react'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { motionTime } from './motion'
import type { NebulaVisual } from './objectVisual'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Wispy gas: layered noise that is bent by more noise, which gives it a swirling,
// cloud-like structure. `uRing` turns the cloud into a hollow shell for planetary nebulae.
const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uRing;
uniform float uCenterStar;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float t = uTime * 0.03;

  vec2 q = vec2(fbm(p * 2.2 + t), fbm(p * 2.2 + vec2(5.2, 1.3) - t));
  float n = fbm(p * 2.6 + 3.0 * q + vec2(t * 2.0));

  float cloud = 1.0 - smoothstep(0.12, 0.95, r + 0.4 * (n - 0.5));
  float shell = exp(-pow((r - 0.52 + 0.14 * (n - 0.5)) / 0.17, 2.0));
  float envelope = mix(cloud, shell, uRing);

  float density = envelope * (0.3 + 1.2 * n);
  vec3 color = mix(uColorA, uColorB, smoothstep(0.3, 0.8, n));
  color = mix(color, uColorC, smoothstep(0.5, 1.0, q.x * q.y * 2.4));

  // Stars shining through the gas, and one at the middle of a planetary nebula.
  float s = hash21(floor(vUv * 160.0));
  float star = step(0.992, s) * (0.5 + 0.5 * sin(uTime * 2.0 + s * 60.0));
  float center = uCenterStar * exp(-r * r * 700.0);

  vec3 light = color * density * 1.5 + vec3(star + center);
  float a = clamp(max(density, max(star, center)), 0.0, 1.0) * (1.0 - smoothstep(0.85, 1.0, r));

  gl_FragColor = vec4(light * (1.0 - smoothstep(0.85, 1.0, r)), a * 0.7);
}
`

type Palette = {
  a: string
  b: string
  c: string
  ring: number
  centerStar: number
}

const PALETTES: Record<NebulaVisual['palette'], Palette> = {
  // Glowing hydrogen: pinks and reds with blue and gold highlights, like the Orion Nebula.
  emission: { a: '#f2406f', b: '#5a80ff', c: '#ffc266', ring: 0, centerStar: 0 },
  // A dying star's shell of gas.
  planetary: { a: '#33d9e6', b: '#4d80ff', c: '#ff8c40', ring: 1, centerStar: 1 },
  // The remains of a supernova: thin red, green and violet filaments.
  remnant: { a: '#e64d4d', b: '#4de6b3', c: '#8066ff', ring: 0.6, centerStar: 0 },
  // Dust scattering blue starlight.
  reflection: { a: '#4d8cff', b: '#99ccff', c: '#ccebff', ring: 0, centerStar: 0 },
}

/** A drifting cloud of gas, colored by what kind of nebula it is. */
export default function StageNebula({ visual }: { visual: NebulaVisual }) {
  const uniforms = useMemo(() => {
    const palette = PALETTES[visual.palette]
    return {
      uTime: motionTime,
      uColorA: { value: new THREE.Color(palette.a) },
      uColorB: { value: new THREE.Color(palette.b) },
      uColorC: { value: new THREE.Color(palette.c) },
      uRing: { value: palette.ring },
      uCenterStar: { value: palette.centerStar },
    }
  }, [visual.palette])

  return (
    <Billboard>
      <mesh frustumCulled={false}>
        <planeGeometry args={[5.6, 5.6]} />
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
