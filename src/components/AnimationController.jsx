import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import * as THREE from 'three'
import { rig, useHero, prefersReducedMotion } from '../store'
import { LIGHT_TARGETS } from './SceneLighting'
import { CHARACTER } from './characters'

const _cam = new THREE.Vector3()
const _look = new THREE.Vector3()

/** Desktop pushes the character into the right third so the type can sit left. */
function heroFraming(aspect) {
  if (CHARACTER.framing) return CHARACTER.framing(aspect)
  return aspect > 1.15
    ? { cam: [0, -0.25, 7.0], look: [-1.1, -0.3, 0] }
    : { cam: [0, -0.2, 8.2], look: [0, -0.75, 0] }
}

/**
 * Owns every timeline:
 *   intro   — frost melts, DOF sharpens, lights come up, hero copy reveals
 *   explore — hand to temple → dolly-zoom → detach + 360° orbit → HUD + UI
 *   return  — the explore timeline reversed
 * Also runs the damped camera rig every frame.
 */
export default function AnimationController() {
  const { camera, size } = useThree()
  const phase = useHero((s) => s.phase)
  const setPhase = useHero((s) => s.setPhase)
  const explore = useRef(null)
  const aspect = size.width / size.height

  /* ---------------- 1 · intro ---------------- */
  // EffectComposer mounts its effects a commit after the scene, so the intro
  // waits (in useFrame below) until the frost + DOF passes have registered.
  const intro = useRef(null)
  const waited = useRef(0)
  useEffect(() => () => intro.current?.revert(), [])

  const startIntro = () => {
    const reduce = prefersReducedMotion()
    const D = reduce ? 0.6 : 2.0
    const f = heroFraming(aspect)

    rig.lookAt.set(...f.look)
    rig.camPos.set(f.cam[0], f.cam[1] + 0.35, f.cam[2] + 1.8)
    camera.position.copy(rig.camPos)
    _look.copy(rig.lookAt)

    // melt the frost outward from wherever the face lands on screen
    if (rig.blur) {
      camera.lookAt(_look)
      camera.updateMatrixWorld()
      const p = _cam.set(0, 0.1, 0).project(camera)
      rig.blur.uniforms.get('uCenter').value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5)
    }

    intro.current = gsap.context(() => {
      const tl = gsap.timeline()

      if (rig.blur) tl.to(rig.blur.uniforms.get('uProgress'), { value: 1, duration: D, ease: 'power2.inOut' }, 0)
      tl.to(rig.camPos, { x: f.cam[0], y: f.cam[1], z: f.cam[2], duration: D * 1.5, ease: 'expo.out' }, 0)
        .to(rig.lights.key, { intensity: LIGHT_TARGETS.key, duration: D, ease: 'power2.inOut' }, 0.2)
        .to(rig.lights.fill, { intensity: LIGHT_TARGETS.fill, duration: D }, 0.2)
        .to(rig.lights.rim, { intensity: LIGHT_TARGETS.rim, duration: D * 0.9, ease: 'power3.out' }, D * 0.45)
        .to(rig.lights.rim2, { intensity: LIGHT_TARGETS.rim2, duration: D * 0.9, ease: 'power3.out' }, D * 0.55)
        .to(rig.glasses, { reveal: 1, duration: D * 0.8, ease: 'power2.out' }, D * 0.5)
        .fromTo(
          '[data-hero]',
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out' },
          D * 0.4
        )
        // interactive as soon as the copy is in, not when every light has settled
        .call(() => setPhase('idle'), null, D * 0.7)
    })
  }

  /* -------- keep the hero framing correct on resize, and after returning -------- */
  // (the reversed explore timeline lands on whatever the camera was doing when it started —
  //  e.g. mid-intro, or a different window size — so re-frame once we're idle again)
  const prevPhase = useRef(phase)
  useEffect(() => {
    const cameBack = prevPhase.current === 'returning'
    prevPhase.current = phase
    if (phase !== 'idle') return
    const f = heroFraming(aspect)
    const opts = { duration: cameBack ? 1.0 : 0.8, ease: 'power2.out', overwrite: 'auto' }
    gsap.to(rig.lookAt, { x: f.look[0], y: f.look[1], z: f.look[2], ...opts })
    gsap.to(rig.camPos, { x: f.cam[0], y: f.cam[1], z: f.cam[2], ...opts })
  }, [aspect, phase])

  /* ---------------- 2 · explore / return ---------------- */
  useEffect(() => {
    if (phase === 'exploring') {
      explore.current?.kill()
      // the page is clickable before the intro's camera ease finishes — hand the camera over
      gsap.killTweensOf([rig.camPos, rig.lookAt, rig.fov])
      explore.current = buildExplore(aspect, setPhase)
      if (import.meta.env.DEV) rig.timeline = explore.current // scrub from devtools
      if (prefersReducedMotion()) explore.current.timeScale(2.5)
      explore.current.play()
    } else if (phase === 'returning') {
      explore.current?.timeScale(1.35).reverse()
    }
  }, [phase, aspect, setPhase])

  useEffect(() => () => explore.current?.kill(), [])

  /* ---------------- camera rig ---------------- */
  useFrame((state, dt) => {
    if (!intro.current && ((rig.blur && rig.lights.key) || ++waited.current > 120)) startIntro()

    const { pointer } = state
    const p = useHero.getState().phase
    const parallax = p === 'idle' ? 1 : p === 'detail' ? 0.4 : 0
    const k = 1 - Math.pow(0.0004, dt) // frame-rate independent damping

    _cam.copy(rig.camPos)
    _cam.x += pointer.x * 0.3 * parallax
    _cam.y += pointer.y * 0.18 * parallax
    camera.position.lerp(_cam, k)
    _look.lerp(rig.lookAt, k)
    camera.lookAt(_look)

    if (Math.abs(camera.fov - rig.fov.value) > 1e-4) {
      camera.fov = rig.fov.value
      camera.updateProjectionMatrix()
    }
  })

  return null
}

function buildExplore(aspect, setPhase) {
  const s = THREE.MathUtils.clamp(aspect * 0.55, 0.45, 0.95) // how wide the visor expands
  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: 'power3.inOut' },
    onComplete: () => setPhase('detail'),
    onReverseComplete: () => setPhase('idle'),
  })

  tl.to('[data-hero]', { opacity: 0, y: -16, duration: 0.45, stagger: 0.03, ease: 'power2.in' }, 0)

    // 1 · hand rises to the temple, fingers close on the frame, lens flares
    .to(rig.arm, { raise: 1, duration: 1.0, ease: 'power2.inOut' }, 0)
    .to(rig.arm, { grip: 1, duration: 0.4, ease: 'power2.out' }, 0.65)
    .to(rig.glasses, { glow: 1, duration: 0.5, ease: 'power2.out' }, 0.55)
    // … and eases the glasses off the face (human body only — see CHARACTER.gripsGlasses)
    .to(rig.glasses, { pull: 1, duration: 0.55, ease: 'power2.inOut' }, 1.0)

    // 2 · dolly-zoom: push in while the FOV widens (vertigo warp)
    .to(rig.camPos, { x: 0, y: 0.14, z: 3.0, duration: 1.3 }, 0.35)
    .to(rig.lookAt, { x: 0, y: 0.12, z: 0.6, duration: 1.3 }, 0.35)
    .to(rig.fov, { value: 44, duration: 1.3 }, 0.35)

    // 3 · detach: glasses lift off, character sinks into the fog, 360° orbit
    // the hand lets go as the glasses float free
    .to(rig.arm, { grip: 0.3, duration: 0.35, ease: 'power2.out' }, 1.55)
    .to(rig.arm, { raise: 0, duration: 0.85 }, 1.6)
    .to(rig.glasses, { detach: 1, duration: 1.2 }, 1.5)
    .to(rig.character, { z: -14, y: -1.5, duration: 1.6 }, 1.5)
    .fromTo(rig.glasses.rot, { x: 0, y: 0, z: 0 }, { x: 0.07, y: Math.PI * 2, z: -0.03, duration: 2.0 }, 1.5)
    .to(rig.camPos, { x: 0, y: 0.12, z: 4.3, duration: 1.7 }, 1.4)
    .to(rig.lookAt, { x: 0, y: 0.12, z: rig.glasses.pos.z, duration: 1.7 }, 1.4)
    .to(rig.fov, { value: 32, duration: 1.7 }, 1.4)
    .to(rig.glasses, { scale: s, duration: 1.6 }, 1.85)
    .to(rig.glasses, { glow: 0.35, duration: 0.8, ease: 'power2.out' }, 2.6)

    // 4 · geometric feature display + HTML overlays
    .to(rig.feature, { value: 1, duration: 1.4, ease: 'power2.out' }, 2.5)
    .fromTo(
      '[data-feature]',
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out' },
      2.8
    )

  return tl
}
