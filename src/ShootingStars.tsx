import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCosima } from './store'

const POOL_SIZE = 3

// Meteors fly this far in front of the camera. Their size is a fraction of it,
// so they look the same no matter how far the camera has traveled.
const DISTANCE = 10
const LENGTH = DISTANCE * 0.35
const WIDTH = DISTANCE * 0.012

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// A bright head with a tail that fades away behind it.
const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform float uOpacity;
void main() {
  float along = vUv.x;
  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float a = pow(along, 2.5) * smoothstep(0.0, 0.6, across) * uOpacity;
  vec3 color = mix(vec3(0.55, 0.7, 1.0), vec3(1.0), pow(along, 4.0));
  gl_FragColor = vec4(color * a, a);
}
`

type Meteor = {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
  active: boolean
  age: number
  life: number
  start: THREE.Vector3
  velocity: THREE.Vector3
}

/** An occasional shooting star across the sky. Paused along with the rest of the motion. */
export default function ShootingStars() {
  const nextSpawn = useRef(4) // seconds until the next one

  const meteors = useMemo<Meteor[]>(() => {
    const geometry = new THREE.PlaneGeometry(1, 1)
    return Array.from({ length: POOL_SIZE }, () => {
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uOpacity: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.visible = false
      mesh.frustumCulled = false
      return {
        mesh,
        material,
        active: false,
        age: 0,
        life: 1,
        start: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
      }
    })
  }, [])

  // Reused every frame, so nothing is allocated while it runs.
  const scratch = useMemo(
    () => ({
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      back: new THREE.Vector3(),
      ray: new THREE.Vector3(),
      head: new THREE.Vector3(),
      center: new THREE.Vector3(),
      x: new THREE.Vector3(),
      y: new THREE.Vector3(),
      z: new THREE.Vector3(),
      matrix: new THREE.Matrix4(),
    }),
    [],
  )

  useEffect(
    () => () => {
      meteors[0]?.mesh.geometry.dispose()
      meteors.forEach((meteor) => meteor.material.dispose())
    },
    [meteors],
  )

  useFrame(({ camera }, delta) => {
    if (!useCosima.getState().motion) {
      for (const meteor of meteors) {
        meteor.active = false
        meteor.mesh.visible = false
      }
      return
    }

    nextSpawn.current -= delta
    if (nextSpawn.current <= 0) {
      nextSpawn.current = 5 + Math.random() * 8

      const meteor = meteors.find((m) => !m.active)
      if (meteor && camera instanceof THREE.PerspectiveCamera) {
        const { right, up, back, ray } = scratch
        camera.matrixWorld.extractBasis(right, up, back)

        // Pick a spot in the upper part of the view and fly across it.
        const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
        const ndcX = (Math.random() * 1.6 - 0.8) * camera.aspect * tanY
        const ndcY = (Math.random() * 1.0 - 0.2) * tanY
        ray.copy(back).multiplyScalar(-1).addScaledVector(right, ndcX).addScaledVector(up, ndcY).normalize()

        meteor.start.copy(camera.position).addScaledVector(ray, DISTANCE)
        const side = Math.random() < 0.5 ? -1 : 1
        meteor.velocity
          .copy(right)
          .multiplyScalar(side * 0.8)
          .addScaledVector(up, -0.45)
          .normalize()
          .multiplyScalar(DISTANCE * 0.9) // scene units per second
        meteor.life = 0.7 + Math.random() * 0.5
        meteor.age = 0
        meteor.active = true
        meteor.mesh.visible = true
      }
    }

    const { head, center, x, y, z, matrix } = scratch
    for (const meteor of meteors) {
      if (!meteor.active) continue

      meteor.age += delta
      const t = meteor.age / meteor.life
      if (t >= 1) {
        meteor.active = false
        meteor.mesh.visible = false
        continue
      }

      // The head leads; the quad trails behind it. Turn the quad to face the camera.
      head.copy(meteor.start).addScaledVector(meteor.velocity, meteor.age)
      x.copy(meteor.velocity).normalize()
      center.copy(head).addScaledVector(x, -LENGTH / 2)
      z.copy(camera.position).sub(center).normalize()
      y.crossVectors(z, x).normalize()
      z.crossVectors(x, y)
      matrix.makeBasis(x, y, z)

      meteor.mesh.position.copy(center)
      meteor.mesh.quaternion.setFromRotationMatrix(matrix)
      meteor.mesh.scale.set(LENGTH, WIDTH, 1)
      meteor.material.uniforms.uOpacity.value =
        THREE.MathUtils.smoothstep(t, 0, 0.15) * (1 - THREE.MathUtils.smoothstep(t, 0.55, 1))
    }
  })

  return (
    <group>
      {meteors.map((meteor, i) => (
        <primitive key={i} object={meteor.mesh} />
      ))}
    </group>
  )
}
