// Builds public/data/stars.bin and public/data/stars-meta.json from the HYG star database.
// Run from the project root:  node scripts/build-stars.mjs
//
// stars.bin  : Float32 values, 7 per star -> x, y, z, absMag, r, g, b
//              (x, y, z are in scene units, with the galactic center at the origin)
// stars-meta : details for named stars, with an index into stars.bin (used for search later)

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const SOURCE =
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv'
const CACHE = 'scripts/.cache/hygdata_v41.csv'

const MAG_LIMIT = 8 // keep stars brighter than this (about 41k stars), plus every named star
const MAX_DIST_PC = 99000 // the catalog uses 100000 as a "distance unknown" placeholder

// Keep these in sync with src/constants.ts
const KPC_PER_UNIT = 1.25
const SUN_GALACTOCENTRIC_KPC = 8.18

// --- helpers ---------------------------------------------------------------

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else quoted = false
      } else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

// B-V color index -> approximate RGB (0..1). Blue-white for hot stars, orange-red for cool ones.
function bvToRgb(bv) {
  const t = Math.max(-0.4, Math.min(2.0, bv))
  let r = 0
  let g = 0
  let b = 0

  if (t < 0) r = 0.61 + 0.11 * ((t + 0.4) / 0.4) + 0.1 * ((t + 0.4) / 0.4) ** 2
  else if (t < 0.4) r = 0.83 + 0.17 * (t / 0.4)
  else r = 1

  if (t < 0) g = 0.7 + 0.07 * ((t + 0.4) / 0.4) + 0.1 * ((t + 0.4) / 0.4) ** 2
  else if (t < 0.4) g = 0.87 + 0.11 * (t / 0.4)
  else if (t < 1.6) g = 0.98 - 0.16 * ((t - 0.4) / 1.2)
  else g = 0.82 - 0.5 * ((t - 1.6) / 0.4) ** 2

  if (t < 0.4) b = 1
  else if (t < 1.5) b = 1 - 0.47 * ((t - 0.4) / 1.1) + 0.1 * ((t - 0.4) / 1.1) ** 2
  else b = 0.63 - 0.6 * ((t - 1.5) / 0.44) ** 2

  return [r, Math.max(0, g), Math.max(0, b)]
}

// Equatorial (J2000) x, y, z in parsecs -> galactic X, Y, Z in parsecs.
// X points at the galactic center, Z at the north galactic pole.
function equatorialToGalactic(x, y, z) {
  return [
    -0.0548755604 * x - 0.8734370902 * y - 0.4838350155 * z,
    0.4941094279 * x - 0.44482963 * y + 0.7469822445 * z,
    -0.867666149 * x - 0.1980763734 * y + 0.4559837762 * z,
  ]
}

async function loadCsv() {
  if (existsSync(CACHE)) {
    console.log(`Using cached ${CACHE}`)
    return readFile(CACHE, 'utf8')
  }
  console.log('Downloading HYG catalog (about 34 MB)...')
  const res = await fetch(SOURCE)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  const text = await res.text()
  await mkdir('scripts/.cache', { recursive: true })
  await writeFile(CACHE, text)
  return text
}

// --- main ------------------------------------------------------------------

const csv = await loadCsv()
const lines = csv.split('\n').filter(Boolean)
const header = parseCsvLine(lines[0])
const col = Object.fromEntries(header.map((name, i) => [name, i]))

const STRIDE = 7
const values = []
const meta = []
let count = 0

for (let i = 1; i < lines.length; i++) {
  const row = parseCsvLine(lines[i])
  const dist = parseFloat(row[col.dist])
  const mag = parseFloat(row[col.mag])
  const proper = row[col.proper]

  if (!(dist < MAX_DIST_PC)) continue
  if (!(mag <= MAG_LIMIT) && !proper) continue

  const [gx, gy, gz] = equatorialToGalactic(
    parseFloat(row[col.x]),
    parseFloat(row[col.y]),
    parseFloat(row[col.z]),
  )

  // Galactic (X, Y, Z) in parsecs -> scene (x, y, z) in units, y up.
  // Mapping (X, Z, -Y) keeps the coordinate system right-handed.
  const sceneX = (gx / 1000 - SUN_GALACTOCENTRIC_KPC) / KPC_PER_UNIT
  const sceneY = gz / 1000 / KPC_PER_UNIT
  const sceneZ = -gy / 1000 / KPC_PER_UNIT

  const absMag = parseFloat(row[col.absmag])
  const ci = parseFloat(row[col.ci])
  const [r, g, b] = bvToRgb(Number.isFinite(ci) ? ci : 0.65)

  values.push(sceneX, sceneY, sceneZ, Number.isFinite(absMag) ? absMag : 5, r, g, b)

  if (proper) {
    meta.push({
      index: count,
      name: proper,
      hip: row[col.hip] ? Number(row[col.hip]) : null,
      raDeg: Number((parseFloat(row[col.ra]) * 15).toFixed(5)), // HYG stores RA in hours
      decDeg: Number(parseFloat(row[col.dec]).toFixed(5)),
      distPc: Number(dist.toFixed(2)),
      mag,
      spect: row[col.spect] || null,
      con: row[col.con] || null,
    })
  }
  count++
}

const floats = new Float32Array(values)
await mkdir('public/data', { recursive: true })
await writeFile('public/data/stars.bin', Buffer.from(floats.buffer))
await writeFile('public/data/stars-meta.json', JSON.stringify(meta))

console.log(`Wrote ${count} stars (${(floats.byteLength / 1024).toFixed(0)} KB) and ${meta.length} named stars.`)
console.log(`Floats per star: ${STRIDE}`)
