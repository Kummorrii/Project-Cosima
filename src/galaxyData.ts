import * as THREE from 'three'

export type StarData = { positions: Float32Array; colors: Float32Array }

const TAU = Math.PI * 2

/** A small seeded random generator, so the galaxy looks the same on every load. */
export function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type SpiralOptions = {
  count: number
  radius: number
  arms: number
  spin: number
  randomness: number
}

/** The spiral disk: warm old stars in the middle, young blue ones in the arms. */
export function buildSpiralStars(
  { count, radius, arms, spin, randomness }: SpiralOptions,
  seed = 1,
): StarData {
  const rand = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const coreColor = new THREE.Color('#ffb36b')
  const edgeColor = new THREE.Color('#5b8cff')
  const color = new THREE.Color()

  for (let i = 0; i < count; i++) {
    const r = Math.pow(rand(), 1.5) * radius
    // Mostly small, occasionally large, so the arms have a soft, dusty edge.
    const scatter = () => Math.pow(rand(), 3) * (rand() < 0.5 ? 1 : -1) * randomness * r

    let x: number
    let z: number
    if (rand() < 0.78) {
      // Most stars follow the arms.
      const angle = ((i % arms) / arms) * TAU + (r / radius) * spin * TAU
      x = Math.cos(angle) * r + scatter()
      z = Math.sin(angle) * r + scatter()
    } else {
      // The rest are spread between them.
      const angle = rand() * TAU
      x = Math.cos(angle) * r
      z = Math.sin(angle) * r
    }
    const y = scatter() * 0.35

    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z

    color.copy(coreColor).lerp(edgeColor, r / radius).multiplyScalar(0.55 + 0.45 * rand())
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  return { positions, colors }
}

/** The dense, warm ball of old stars at the center. */
export function buildBulge(count = 7000, size = 2.4, seed = 2): StarData {
  const rand = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const warm = new THREE.Color('#ffcf9a')
  const hot = new THREE.Color('#ffb36b')
  const color = new THREE.Color()

  for (let i = 0; i < count; i++) {
    const theta = rand() * TAU
    const phi = Math.acos(2 * rand() - 1)
    const r = size * Math.pow(rand(), 1.8)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.cos(phi) * 0.55 // flattened, like a lens
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)

    color.copy(warm).lerp(hot, rand()).multiplyScalar(0.5 + 0.5 * rand())
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  return { positions, colors }
}

/** Soft clouds of gas and dust drifting along the arms. */
export function buildClouds(
  { radius, arms, spin }: Pick<SpiralOptions, 'radius' | 'arms' | 'spin'>,
  count = 150,
  seed = 3,
): StarData {
  const rand = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const palette = [new THREE.Color('#ff5fa2'), new THREE.Color('#7a5cff'), new THREE.Color('#3fb6ff')]
  const color = new THREE.Color()

  for (let i = 0; i < count; i++) {
    const r = (0.12 + 0.86 * rand()) * radius
    const arm = Math.floor(rand() * arms)
    const angle = (arm / arms) * TAU + (r / radius) * spin * TAU + (rand() - 0.5) * 0.3
    positions[i * 3] = Math.cos(angle) * r + (rand() - 0.5) * 0.6
    positions[i * 3 + 1] = (rand() - 0.5) * 0.35
    positions[i * 3 + 2] = Math.sin(angle) * r + (rand() - 0.5) * 0.6

    color.copy(palette[Math.floor(rand() * palette.length)]).multiplyScalar(0.6 + 0.4 * rand())
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  return { positions, colors }
}

/** Far-off stars on a huge sphere, so the space around the galaxy is not empty. */
export function buildBackdrop(count = 5000, radius = 500, seed = 4): StarData {
  const rand = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const theta = rand() * TAU
    const phi = Math.acos(2 * rand() - 1)
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = radius * Math.cos(phi)
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)

    const brightness = 0.3 + 0.7 * Math.pow(rand(), 2)
    const kind = rand()
    const [r, g, b] = kind < 0.6 ? [0.8, 0.88, 1] : kind < 0.85 ? [1, 1, 1] : [1, 0.85, 0.7]
    colors[i * 3] = r * brightness
    colors[i * 3 + 1] = g * brightness
    colors[i * 3 + 2] = b * brightness
  }
  return { positions, colors }
}

// --- Shapes for the focus stage -------------------------------------------------

/** Turns a name into a number, so each object always gets the same random layout. */
export function seedFromString(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** A ball of stars that thins out toward the edge (a Plummer sphere). */
function plummerRadius(rand: () => number, scale: number, limit: number): number {
  // Stars past the limit are drawn again, so they thin out instead of piling up on an edge.
  for (let tries = 0; tries < 12; tries++) {
    const u = Math.min(0.995, Math.max(0.005, rand()))
    const r = scale / Math.sqrt(Math.pow(u, -2 / 3) - 1)
    if (r <= limit) return r
  }
  return rand() * scale
}

function randomDirection(rand: () => number): [number, number, number] {
  const theta = rand() * TAU
  const phi = Math.acos(2 * rand() - 1)
  return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)]
}

/** A smooth, old, golden ellipsoid. `flatten` squashes it: 1 is round. */
export function buildElliptical(count: number, radius: number, flatten: number, seed = 1): StarData {
  const rand = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const gold = new THREE.Color('#ffc78a')
  const amber = new THREE.Color('#ffa860')
  const color = new THREE.Color()

  for (let i = 0; i < count; i++) {
    const r = plummerRadius(rand, radius * 0.32, radius * 1.1)
    const [dx, dy, dz] = randomDirection(rand)
    positions[i * 3] = dx * r
    positions[i * 3 + 1] = dy * r * flatten
    positions[i * 3 + 2] = dz * r

    color.copy(gold).lerp(amber, rand()).multiplyScalar(0.45 + 0.55 * rand())
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  return { positions, colors }
}

/** A lumpy, young, bluish galaxy with no clear shape. */
export function buildIrregular(count: number, radius: number, seed = 1): StarData {
  const rand = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  const clumps = Array.from({ length: 7 }, () => ({
    x: (rand() - 0.5) * radius * 1.3,
    y: (rand() - 0.5) * radius * 0.9,
    spread: radius * (0.18 + 0.22 * rand()),
    warmth: rand(),
  }))
  const blue = new THREE.Color('#8fb4ff')
  const pink = new THREE.Color('#ff9ac8')
  const color = new THREE.Color()

  for (let i = 0; i < count; i++) {
    const clump = clumps[Math.floor(rand() * clumps.length)]
    // A rough bell curve from three random numbers.
    const bell = () => (rand() + rand() + rand() - 1.5) * 1.15
    positions[i * 3] = clump.x + bell() * clump.spread
    positions[i * 3 + 1] = clump.y + bell() * clump.spread
    positions[i * 3 + 2] = bell() * clump.spread * 0.5

    color.copy(blue).lerp(pink, clump.warmth * rand()).multiplyScalar(0.5 + 0.5 * rand())
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  return { positions, colors }
}

/** A globular cluster (a dense old ball) or an open cluster (a loose young group). */
export function buildCluster(style: 'open' | 'globular', radius: number, seed = 1): StarData {
  const rand = mulberry32(seed)
  const count = style === 'globular' ? 14000 : 450
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const color = new THREE.Color()
  const warm = new THREE.Color('#ffd9a0')
  const hot = new THREE.Color('#a9c2ff')

  for (let i = 0; i < count; i++) {
    const [dx, dy, dz] = randomDirection(rand)
    const r =
      style === 'globular'
        ? plummerRadius(rand, radius * 0.28, radius * 1.15)
        : radius * 0.85 * Math.pow(rand(), 0.7)
    positions[i * 3] = dx * r
    positions[i * 3 + 1] = dy * r
    positions[i * 3 + 2] = dz * r

    // Globulars are mostly old and golden with a few blue stragglers; open clusters are young and blue.
    const youth = style === 'globular' ? (rand() < 0.08 ? 1 : 0) : rand() < 0.85 ? 1 : 0
    color.copy(warm).lerp(hot, youth).multiplyScalar(0.45 + 0.55 * rand())
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  return { positions, colors }
}
