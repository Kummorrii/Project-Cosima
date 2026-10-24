import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { motionTime } from './motion'
import { HASH_GLSL, STAR_FRAGMENT_GLSL, TWINKLE_GLSL } from './shaders'

// Must match the layout written by scripts/build-stars.mjs:
// x, y, z, absMag, r, g, b
const STRIDE = 7

const vertexShader = /* glsl */ `
${HASH_GLSL}
${TWINKLE_GLSL}

attribute float aAbsMag;
attribute vec3 aColor;
uniform float uPixelRatio;
uniform float uTime;
varying vec3 vColor;
varying float vAlpha;
varying float vFlare;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);

  // Intrinsically brighter stars (lower absolute magnitude) get bigger points.
  // The exponent is gentle so giants stand out without swallowing everything.
  float luminosity = pow(10.0, -0.1 * (aAbsMag - 4.85));
  float size = luminosity / max(-mv.z, 0.0001);

  // Every star shimmers a little, and a few flare up now and then.
  vec2 tw = twinkle(position, uTime, 0.22);
  size *= 1.0 + 2.2 * tw.y;

  gl_PointSize = clamp(size, 1.0, 8.0) * uPixelRatio;

  // Faint, distant stars fade a little instead of becoming hard dots.
  vAlpha = clamp(size / 1.5, 0.08, 1.0) * tw.x * 0.6;
  vColor = aColor * (1.0 + 0.8 * tw.y);
  vFlare = tw.y;
  gl_Position = projectionMatrix * mv;
}
`

export default function Stars() {
  const [data, setData] = useState<Float32Array | null>(null)
  const dpr = useThree((state) => state.viewport.dpr)

  // Load the binary catalog once.
  useEffect(() => {
    let cancelled = false

    fetch('/data/stars.bin')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.arrayBuffer()
      })
      .then((buffer) => {
        if (!cancelled) setData(new Float32Array(buffer))
      })
      .catch((err) => console.error('Could not load the star catalog:', err))

    return () => {
      cancelled = true
    }
  }, [])

  // One interleaved buffer, shared by three attributes: no copying, one GPU upload.
  const geometry = useMemo(() => {
    if (!data) return null
    const buffer = new THREE.InterleavedBuffer(data, STRIDE)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0))
    geo.setAttribute('aAbsMag', new THREE.InterleavedBufferAttribute(buffer, 1, 3))
    geo.setAttribute('aColor', new THREE.InterleavedBufferAttribute(buffer, 3, 4))
    return geo
  }, [data])

  const uniforms = useMemo(() => ({ uPixelRatio: { value: dpr }, uTime: motionTime }), [dpr])

  if (!geometry) return null

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={STAR_FRAGMENT_GLSL}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
