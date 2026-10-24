import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { motionTime } from './motion'
import type { StarVisual } from './objectVisual'
import StageCorona from './StageCorona'

const vertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vObject;
void main() {
  vObject = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

// A boiling surface: churning cells, darker toward the edge like a real star.
const fragmentShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vObject;
uniform float uTime;
uniform vec3 uColor;

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise3(p);
    p = p * 2.02 + vec3(3.1, 1.7, 5.3);
    a *= 0.5;
  }
  return v;
}

void main() {
  float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
  vec3 p = normalize(vObject) * 2.4;
  float n = fbm3(p + vec3(0.0, uTime * 0.04, 0.0));
  float cells = fbm3(p * 2.6 - vec3(uTime * 0.03));

  float limb = pow(facing, 0.45);
  vec3 hot = uColor * 1.35 + 0.15;
  vec3 cool = uColor * 0.55;
  vec3 surface = mix(cool, hot, smoothstep(0.25, 0.8, n * 0.7 + cells * 0.5));
  surface *= mix(0.45, 1.15, limb);

  gl_FragColor = vec4(surface, 1.0);
}
`

const CAMERA_Z = 7.5
const CORONA_DEPTH = 1.4 // the glow sits this far behind the star
const CORONA_SIZE = 9

/** A glowing, churning sphere with a corona. Giants are drawn larger. */
export default function StageStar({ visual }: { visual: StarVisual }) {
  const group = useRef<THREE.Group>(null)
  const radius = visual.giant ? 1.15 : 0.85

  const uniforms = useMemo(
    () => ({ uTime: motionTime, uColor: { value: new THREE.Color(visual.color) } }),
    [visual.color],
  )

  // Spin slowly so the surface drifts.
  useFrame(() => {
    if (group.current) group.current.rotation.y = motionTime.value * 0.05
  })

  // How big the star looks from the camera, as a fraction of the glow's half-width.
  const inner = (radius * ((CAMERA_Z + CORONA_DEPTH) / CAMERA_Z)) / (CORONA_SIZE / 2)

  return (
    <>
      <group position={[0, 0, -CORONA_DEPTH]}>
        <StageCorona color={visual.color} size={CORONA_SIZE} inner={inner} />
      </group>
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[radius, 96, 96]} />
          <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} />
        </mesh>
      </group>
    </>
  )
}
