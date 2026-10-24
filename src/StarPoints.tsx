import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { motionTime } from './motion'
import { GALAXY_VERTEX_GLSL, HASH_GLSL, STAR_FRAGMENT_GLSL, TWINKLE_GLSL } from './shaders'

const vertexShader = HASH_GLSL + TWINKLE_GLSL + GALAXY_VERTEX_GLSL

type Props = {
  positions: Float32Array
  colors: Float32Array
  /** Point size in pixels, or in "pixels at distance 1" when `attenuate` is on. */
  size: number
  alpha: number
  /** Shrink with distance, like real objects. Off keeps points a fixed size on screen. */
  attenuate?: boolean
  /** Largest size on screen, in pixels. */
  maxSize?: number
  /** How much each star shimmers, from 0 to 1. */
  twinkle?: number
  /** Let a few stars flare up now and then. */
  flares?: boolean
  /** Turn with the galaxy. */
  rotate?: boolean
}

/** One layer of glowing points that rotate, twinkle and flare on the GPU. */
export default function StarPoints({
  positions,
  colors,
  size,
  alpha,
  attenuate = false,
  maxSize = 64,
  twinkle = 0.35,
  flares = true,
  rotate = true,
}: Props) {
  const dpr = useThree((state) => state.viewport.dpr)

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [positions, colors])

  useEffect(() => () => geometry.dispose(), [geometry])

  const uniforms = useMemo(
    () => ({
      uTime: motionTime, // shared, so everything moves together
      uPixelRatio: { value: dpr },
      uSize: { value: size },
      uAlpha: { value: alpha },
      uAttenuate: { value: attenuate ? 1 : 0 },
      uMaxSize: { value: maxSize },
      uTwinkle: { value: twinkle },
      uFlares: { value: flares ? 1 : 0 },
      uRotate: { value: rotate ? 1 : 0 },
    }),
    [dpr, size, alpha, attenuate, maxSize, twinkle, flares, rotate],
  )

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
