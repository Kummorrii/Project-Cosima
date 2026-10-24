import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { computeShape, easeInOut } from './introShape'

// Timeline, in seconds. The title's fade-in, the skip button and the star's spin are
// timed in CSS (see index.css), so keep those delays in step with these numbers.
const STAR_IN = 1.2 // the star and its light appear at the bottom
const RISE_START = 1.9 // the star starts to rise and the curtain lifts
const RISE_DURATION = 2.8
const END = RISE_START + RISE_DURATION
const FADE_OUT = END - 0.5 // the star's light fades as it reaches the top

type Phase = 'playing' | 'leaving' | 'done'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

// Plays on every page load. Visitors who ask their system for less motion skip it.
function shouldPlay(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function Intro() {
  const [phase, setPhase] = useState<Phase>(() => (shouldPlay() ? 'playing' : 'done'))

  const svgRef = useRef<SVGSVGElement>(null)
  const gradientRef = useRef<SVGLinearGradientElement>(null)
  const coverRef = useRef<SVGPathElement>(null)
  const glowRef = useRef<SVGGElement>(null)
  const foldsRef = useRef<SVGPathElement>(null)
  const hemRef = useRef<SVGPathElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const starRef = useRef<HTMLDivElement>(null)

  const skip = () => setPhase((current) => (current === 'playing' ? 'leaving' : current))

  // Draw the curtain every frame. The shape is written straight to the DOM instead of
  // going through React state, so it stays smooth.
  useLayoutEffect(() => {
    if (phase !== 'playing') return
    const svg = svgRef.current
    const gradient = gradientRef.current
    const cover = coverRef.current
    const glow = glowRef.current
    const folds = foldsRef.current
    const hem = hemRef.current
    const title = titleRef.current
    const star = starRef.current
    if (!svg || !gradient || !cover || !glow || !folds || !hem || !title || !star) return

    let width = 0
    let height = 0

    const draw = (seconds: number) => {
      if (svg.clientWidth !== width || svg.clientHeight !== height) {
        width = svg.clientWidth
        height = svg.clientHeight
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
        gradient.setAttribute('x2', String(width))
      }

      const e = easeInOut(clamp01((seconds - RISE_START) / RISE_DURATION))
      const shape = computeShape(width, height, e)

      cover.setAttribute('d', shape.cover)
      hem.setAttribute('d', shape.hem)
      folds.setAttribute('d', shape.folds)

      // The star and its light fade in at the bottom and fade out at the top.
      const light = clamp01((seconds - STAR_IN) / 0.7) * (1 - clamp01((seconds - FADE_OUT) / 0.5))
      glow.style.opacity = String(light)
      star.style.opacity = String(light)
      star.style.transform = `translate3d(${width / 2}px, ${shape.yStar}px, 0)`

      // The title is gone by the time the star reaches it.
      title.style.opacity = String(1 - clamp01((e - 0.04) / 0.42))
    }

    const start = performance.now()
    draw(0) // paint the first frame before the browser shows anything
    let frame = 0
    const tick = (now: number) => {
      const seconds = (now - start) / 1000
      if (seconds >= END) {
        setPhase('done')
        return
      }
      draw(seconds)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase])

  // Any key skips the intro.
  useEffect(() => {
    if (phase !== 'playing') return
    const onKey = () => setPhase((current) => (current === 'playing' ? 'leaving' : current))
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  // After a skip, let the quick fade-out finish, then remove the overlay.
  useEffect(() => {
    if (phase !== 'leaving') return
    const timer = window.setTimeout(() => setPhase('done'), 550)
    return () => window.clearTimeout(timer)
  }, [phase])

  if (phase === 'done') return null

  return (
    <div className="intro" data-leaving={phase === 'leaving'} onClick={skip}>
      <svg ref={svgRef} className="intro-svg" aria-hidden="true">
        <defs>
          <linearGradient
            ref={gradientRef}
            id="intro-hem-gradient"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop offset="0" stopColor="#6aa8ff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#e6f0ff" stopOpacity="1" />
            <stop offset="1" stopColor="#6aa8ff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* The black curtain. It starts as a huge rectangle so nothing shows before the first frame. */}
        <path ref={coverRef} fill="#000" d="M0 0H20000V20000H0Z" />

        <g ref={glowRef} className="intro-glow-group">
          <path ref={foldsRef} className="intro-folds" fill="none" />
          <path ref={hemRef} className="intro-hem" fill="none" stroke="url(#intro-hem-gradient)" />
        </g>
      </svg>

      <div ref={titleRef} className="intro-title-wrap">
        <p className="intro-title">
          <span>Project Cosima</span>
        </p>
      </div>

      <div ref={starRef} className="intro-star-wrap" aria-hidden="true">
        <div className="intro-bloom" />
        <div className="intro-star">
          <svg viewBox="-50 -50 100 100">
            <path
              d="M0 -48 C4 -12 12 -4 48 0 C12 4 4 12 0 48 C-4 12 -12 4 -48 0 C-12 -4 -4 -12 0 -48 Z"
              fill="#fff"
            />
          </svg>
        </div>
      </div>

      <button
        type="button"
        className="intro-skip"
        onClick={(event) => {
          event.stopPropagation()
          skip()
        }}
      >
        Skip intro
      </button>
    </div>
  )
}
