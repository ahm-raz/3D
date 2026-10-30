import { create } from 'zustand'
import * as THREE from 'three'
import gsap from 'gsap'
import { DEFAULT_FRAME } from './components/glasses'

/**
 * UI-level state (drives React re-renders).
 * phase: intro → idle → exploring → detail → returning → idle
 */
export const useHero = create((set, get) => ({
  phase: 'intro',
  hovered: false,
  frame: DEFAULT_FRAME, // active glasses style (see components/glasses/index.js)
  setPhase: (phase) => set({ phase }),
  /** Swap the glasses: shrink out → change style → pop back in with a lens flash. */
  selectFrame: (id) => {
    if (id === get().frame) return
    gsap.killTweensOf(rig.glasses, 'swap')
    gsap
      .timeline()
      .to(rig.glasses, { swap: 0, duration: 0.18, ease: 'power2.in', onComplete: () => set({ frame: id }) })
      .to(rig.glasses, { swap: 1, duration: 0.6, ease: 'back.out(1.7)' })
      .fromTo(rig.glasses, { glow: 1 }, { glow: get().phase === 'detail' ? 0.35 : 0, duration: 0.9, ease: 'power2.out' }, '<')
  },
  setHovered: (hovered) => set({ hovered }),
  explore: () => get().phase === 'idle' && set({ phase: 'exploring' }),
  back: () => get().phase === 'detail' && set({ phase: 'returning' }),
}))

/**
 * Mutable animation rig shared by the R3F scene and the GSAP controller.
 * GSAP tweens these plain values; components read them inside useFrame,
 * so the animation never triggers React renders.
 */
export const rig = {
  // filled in by components on mount
  blur: null, // FrostBlurEffect
  lights: { key: null, rim: null, rim2: null, fill: null },

  // camera
  camPos: new THREE.Vector3(0, -0.15, 7.4),
  lookAt: new THREE.Vector3(0, 0, 0),
  fov: { value: 30 },

  // character
  character: { x: 0, y: 0, z: 0 },
  // raise: hand up to the frame, grip: fingers closed on it,
  // target: world point the fingers pinch (written by GlassesModel every frame)
  arm: { raise: 0, grip: 0, target: new THREE.Vector3() },

  // glasses
  glasses: {
    detach: 0, // 0 = worn on the head, 1 = free-floating
    pull: 0, // the hand easing the frame off the face (characters with gripsGlasses)
    glow: 0, // extra fresnel / sweep intensity
    reveal: 0, // intro brightness of the lens shader
    swap: 1, // scale multiplier for the frame-swap pop
    pos: { x: 0, y: 0.12, z: 1.25 }, // free-floating transform
    rot: { x: 0, y: 0, z: 0 },
    scale: 1,
  },

  // feature display (0 = hidden, 1 = fully expanded)
  feature: { value: 0 },
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (import.meta.env.DEV) import('gsap').then(({ default: gsap }) => (window.__hero = { rig, useHero, gsap }))
