// GLSL shared by every star layer.

export const HASH_GLSL = /* glsl */ `
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
`

// Each star gets its own shimmer, and about one in sixty can flare up now and then.
// Returns (shimmer brightness, flare strength).
export const TWINKLE_GLSL = /* glsl */ `
vec2 twinkle(vec3 seed, float time, float amount) {
  // Scaling first matters: stars near each other would otherwise twinkle in step.
  vec3 s = seed * 7919.0;
  float h = hash13(s);
  float shimmer = 1.0 - amount * (0.5 + 0.5 * sin(time * (1.2 + 3.0 * h) + h * 43.0));
  float canFlare = step(0.985, hash13(s + 17.0));
  float flare = canFlare * pow(max(0.0, sin(time * (0.25 + 0.35 * h) + h * 91.0)), 40.0);
  return vec2(shimmer, flare);
}
`

// A soft round star. During a flare it also grows four spikes.
export const STAR_FRAGMENT_GLSL = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vFlare;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float glow = 1.0 - smoothstep(0.0, 0.5, length(c));
  float spikeX = (1.0 - smoothstep(0.0, 0.5, abs(c.x))) * (1.0 - smoothstep(0.0, 0.06, abs(c.y)));
  float spikeY = (1.0 - smoothstep(0.0, 0.5, abs(c.y))) * (1.0 - smoothstep(0.0, 0.06, abs(c.x)));
  float a = (glow + vFlare * (spikeX + spikeY)) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}
`

// Used by the procedural galaxy layers: rotation, twinkle and sizing.
export const GALAXY_VERTEX_GLSL = /* glsl */ `
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;
uniform float uAttenuate;
uniform float uMaxSize;
uniform float uTwinkle;
uniform float uFlares;
uniform float uRotate;
uniform float uAlpha;
varying vec3 vColor;
varying float vAlpha;
varying float vFlare;

// Radians per second. The whole pattern turns at BASE_SPIN. SHEAR_SPIN adds a little
// extra speed near the center, so inner stars drift ahead of outer ones.
const float BASE_SPIN = 0.035;
const float SHEAR_SPIN = 0.15;

void main() {
  vec3 p = position;
  float radius = length(p.xz);
  float angle = uRotate * uTime * (BASE_SPIN + SHEAR_SPIN / (radius + 3.0));
  float c = cos(angle);
  float s = sin(angle);
  p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);

  vec2 tw = twinkle(position, uTime, uTwinkle);
  float flare = tw.y * uFlares;

  float variety = 0.7 + 0.9 * hash13(position * 7919.0 + 5.0);
  float sizePx = uSize * variety;
  if (uAttenuate > 0.5) sizePx /= max(-mv.z, 0.0001);
  sizePx *= 1.0 + 2.5 * flare;

  gl_PointSize = min(sizePx, uMaxSize) * uPixelRatio;
  vColor = aColor * tw.x * (1.0 + 1.2 * flare);
  vAlpha = uAlpha;
  vFlare = flare;
  gl_Position = projectionMatrix * mv;
}
`
