import { create } from 'zustand'
import type { Destination } from './destinations'

type Phase = 'idle' | 'flying' | 'arrived'

export type CosimaState = {
  /** Where the camera is heading, or last arrived. */
  destination: Destination | null
  /** Bumps on every flyTo call so the camera rig knows to start a new flight. */
  flightId: number
  phase: Phase
  /** The destination the detail panel shows. Only updated once the camera arrives. */
  shown: Destination | null
  panelOpen: boolean
  /** Rotation, twinkling and camera drift. Off for people who prefer reduced motion. */
  motion: boolean
  flyTo: (destination: Destination) => void
  arrive: () => void
  closePanel: () => void
  toggleMotion: () => void
}

export const useCosima = create<CosimaState>()((set) => ({
  destination: null,
  flightId: 0,
  phase: 'idle',
  shown: null,
  panelOpen: false,
  motion: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  flyTo: (destination) =>
    set((state) => ({
      destination,
      flightId: state.flightId + 1,
      phase: 'flying',
      panelOpen: true,
    })),
  arrive: () => set((state) => ({ phase: 'arrived', shown: state.destination })),
  closePanel: () => set({ panelOpen: false }),
  toggleMotion: () => set((state) => ({ motion: !state.motion })),
}))

/**
 * Focus mode: the camera has arrived, the detail panel is open, and the object has a
 * shape to show. The background blurs and the object takes center stage.
 */
export const selectFocus = (state: CosimaState): boolean =>
  state.panelOpen && state.phase === 'arrived' && !!state.shown?.visual
