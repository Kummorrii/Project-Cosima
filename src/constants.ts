// Scene scale: the procedural galaxy has a radius of 12 scene units,
// which we treat as roughly 15 kiloparsecs (kpc).
export const GALAXY_RADIUS_UNITS = 12
export const KPC_PER_UNIT = 1.25

// How far the Sun is from the galactic center.
export const SUN_GALACTOCENTRIC_KPC = 8.18

// Where Sol sits in the scene. The galactic center is at the origin,
// and the Sun is on the -x side of it, so the real star catalog
// (which is measured from the Sun) lines up with the galaxy.
export type Vec3 = [number, number, number]
export const SOL_POSITION: Vec3 = [-SUN_GALACTOCENTRIC_KPC / KPC_PER_UNIT, 0, 0]
