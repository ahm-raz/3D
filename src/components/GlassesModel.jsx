import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { rig, useHero } from '../store'
import { FRAME_BY_ID } from './glasses'
import { CHARACTER } from './characters'

const { lerp, clamp, damp } = THREE.MathUtils


/* ------------------------------------------------------------------ */
/* Arm rig: two bones posed by direction vectors, blended by slerp    */
/* (per character: CHARACTER.arm — robot uses hand-tuned directions,  */
/*  human solves 2-bone IK so the hand still lands on the hinge)      */
/* ------------------------------------------------------------------ */
const ARM = CHARACTER.arm // null when the character's own skeleton performs the gesture
const SHOULDER = ARM?.shoulder
const UPPER = ARM?.upper
const FORE = ARM?.fore
const DOWN = new THREE.Vector3(0, -1, 0)

/** Analytic two-bone IK: elbow on the side of `pole`, wrist on `target`. */
function solveArm(shoulder, target, l1, l2, pole) {
  const S = new THREE.Vector3(...shoulder)
  const T = new THREE.Vector3(...target)
  const dir = T.clone().sub(S)
  const d = Math.min(dir.length(), (l1 + l2) * 0.999)
  dir.normalize()
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0))
  const p = new THREE.Vector3(...pole)
  const ortho = p.sub(dir.clone().multiplyScalar(p.dot(dir))).normalize()
  const E = S.clone().addScaledVector(dir, a).addScaledVector(ortho, h)
  return [E.clone().sub(S), T.clone().sub(E)]
}

function armPose(upperDir, foreDir) {
  const upper = new THREE.Quaternion().setFromUnitVectors(DOWN, upperDir.normalize())
  const foreWorld = new THREE.Quaternion().setFromUnitVectors(DOWN, foreDir.normalize())
  // forearm is parented to the upper arm → store it in upper-arm space
  const fore = upper.clone().invert().multiply(foreWorld)
  return { upper, fore }
}

const REST = armPose(new THREE.Vector3(0.14, -1, 0.04), new THREE.Vector3(0.06, -1, 0.22))
// elbow out to the side, forearm up so the fingertips land on the glasses' temple
const RAISED = !ARM
  ? null
  : ARM.raised
    ? armPose(new THREE.Vector3(...ARM.raised[0]), new THREE.Vector3(...ARM.raised[1]))
    : armPose(...solveArm(SHOULDER, ARM.target, UPPER, FORE, ARM.pole))

/* scratch objects (no per-frame allocation) */
const _pA = new THREE.Vector3()
const _qA = new THREE.Quaternion()
const _sA = new THREE.Vector3()
const _pF = new THREE.Vector3()
const _qSpin = new THREE.Quaternion()
const _qId = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _c = new THREE.Vector3()
const _n = new THREE.Vector3()
const _qw = new THREE.Quaternion()
const _qPull = new THREE.Quaternion()
const _ePull = new THREE.Euler()
const _pull = new THREE.Vector3()
const TAU = Math.PI * 2

/** Callouts of the currently selected frame (Overlay renders the DOM labels). */
export const useHotspots = () => FRAME_BY_ID[useHero((s) => s.frame)].hotspots

export default function GlassesModel() {
  const character = useRef()
  const head = useRef()
  const anchor = useRef()
  const upper = useRef()
  const fore = useRef()
  const hand = useRef()
  const glasses = useRef()
  const tilt = useRef()
  const visor = useRef()
  const hotspotEls = useRef([])
  const hotspotAnchors = useRef([])
  const hover = useRef(0)
  // product turntable: drag to spin 360°, with inertia and a gentle auto-rotate
  const spin = useRef({ yaw: 0, pitch: 0, vYaw: 0, dragging: false, x: 0, y: 0, idle: 0 })

  useEffect(() => {
    const sp = spin.current
    const inDetail = () => useHero.getState().phase === 'detail'
    const down = (e) => {
      if (!inDetail() || e.target.tagName !== 'CANVAS') return
      Object.assign(sp, { dragging: true, x: e.clientX, y: e.clientY, vYaw: 0, idle: 0 })
      document.body.style.cursor = 'grabbing'
    }
    const move = (e) => {
      if (!sp.dragging) return
      const dx = e.clientX - sp.x
      const dy = e.clientY - sp.y
      sp.x = e.clientX
      sp.y = e.clientY
      sp.yaw += dx * 0.009
      sp.vYaw = dx * 0.009
      sp.pitch = clamp(sp.pitch + dy * 0.005, -0.6, 0.6)
    }
    const up = () => {
      if (!sp.dragging) return
      sp.dragging = false
      document.body.style.cursor = inDetail() ? 'grab' : ''
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    const unsub = useHero.subscribe((st, prev) => {
      if (st.phase === prev.phase) return
      if (st.phase === 'detail') document.body.style.cursor = 'grab'
      else if (prev.phase === 'detail') document.body.style.cursor = ''
    })
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      unsub()
    }
  }, [])

  // selected frame: its component, pivot (the spin turns about its lenses) and callouts
  const frame = FRAME_BY_ID[useHero((s) => s.frame)]
  const PIVOT_Z = frame.pivotZ
  const HOTSPOTS = frame.hotspots
  const setHovered = useHero((s) => s.setHovered)
  const explore = useHero((s) => s.explore)

  const mat = useMemo(
    () => ({
      mask: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.8, metalness: 0.1 }),
      maskDeep: new THREE.MeshStandardMaterial({ color: '#08080a', roughness: 0.95, metalness: 0.05 }),
      jacket: new THREE.MeshStandardMaterial({ color: '#0d0d10', roughness: 0.62, metalness: 0.18 }),
      glove: new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.45, metalness: 0.25 }),
      frame: new THREE.MeshStandardMaterial({ color: '#0b0b0d', roughness: 0.22, metalness: 1 }),
      acetate: new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.16, metalness: 0.15, envMapIntensity: 1.4 }),
      pad: new THREE.MeshStandardMaterial({ color: '#2a2224', roughness: 0.25, transparent: true, opacity: 0.55 }),
      neon: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a2a').multiplyScalar(4), toneMapped: false }),
      eyes: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd2c4').multiplyScalar(2.2), toneMapped: false }),
    }),
    []
  )

  useFrame((state, dt) => {
    const { pointer, clock } = state
    const t = clock.elapsedTime
    const phase = useHero.getState().phase
    const idle = phase === 'idle' || phase === 'intro' ? 1 : 0
    const g = rig.glasses

    // body placement (GSAP pushes the character back into the fog on detach)
    character.current.position.set(rig.character.x, rig.character.y + Math.sin(t * 0.8) * 0.015, rig.character.z)

    // cursor-follow head tilt — smooth lerp, disabled during the sequence
    const h = head.current
    h.rotation.y = lerp(h.rotation.y, pointer.x * 0.38 * idle, 0.06)
    h.rotation.x = lerp(h.rotation.x, -pointer.y * 0.16 * idle, 0.06)
    h.rotation.z = lerp(h.rotation.z, -pointer.x * 0.04 * idle, 0.06)

    // arm: rest ↔ hand-on-temple
    const a = rig.arm.raise
    if (upper.current) {
      upper.current.visible = !CHARACTER.hideArmAtRest || a > 0.002
      upper.current.quaternion.slerpQuaternions(REST.upper, RAISED.upper, a)
      fore.current.quaternion.slerpQuaternions(REST.fore, RAISED.fore, a)
      hand.current.rotation.set(-0.35 * a, 0.4 * a, 0)
    }

    // glasses: blend the head-mounted transform with the free-floating one
    anchor.current.updateWorldMatrix(true, false)
    anchor.current.matrixWorld.decompose(_pA, _qA, _sA)
    // the hand eases the frame forward off the face (swinging its gripped side out a little) before letting go
    const pull = CHARACTER.gripsGlasses ? g.pull : 0
    if (pull > 0) {
      _qA.premultiply(_qPull.setFromEuler(_ePull.set(0.06 * pull, -0.2 * pull, 0.05 * pull)))
      _pA.addScaledVector(_pull.set(0.06, -0.05, 0.55), pull * CHARACTER.scale)
    }
    // where the fingers pinch the frame; the body's arm IK reaches for it
    if (frame.grip) rig.arm.target.set(frame.grip[0], frame.grip[1], frame.grip[2] - PIVOT_Z).multiplyScalar(_sA.x).applyQuaternion(_qA).add(_pA)
    const d = g.detach
    _pF.set(g.pos.x, g.pos.y + Math.sin(t * 1.1) * 0.03 * d, g.pos.z)
    glasses.current.position.lerpVectors(_pA, _pF, d)
    glasses.current.quaternion.slerpQuaternions(_qA, _qId, d)
    // spin applied on top so a 360° turn never takes the "short way" back
    glasses.current.quaternion.multiply(_qSpin.setFromEuler(_e.set(g.rot.x, g.rot.y, g.rot.z)))
    glasses.current.scale.setScalar(lerp(_sA.x, g.scale, d) * Math.max(g.swap, 0.001))

    // product turntable (detail view): drag → spin with inertia; idle → slow auto-rotate
    const sp = spin.current
    if (phase === 'detail') {
      if (!sp.dragging) {
        sp.yaw += sp.vYaw
        sp.vYaw *= 0.94
        sp.idle += dt
        if (sp.idle > 1.2) sp.yaw += dt * 0.35 * Math.min((sp.idle - 1.2) / 1.5, 1)
        sp.pitch = damp(sp.pitch, 0.08, 1.5, dt)
      }
    } else {
      // leaving the detail view: settle on the nearest full turn so the glasses land back square
      sp.dragging = false
      sp.vYaw = 0
      sp.idle = 0
      // time-based damping: settles in ~0.6 s at any frame rate
      sp.yaw = damp(sp.yaw, Math.round(sp.yaw / TAU) * TAU, 7, dt)
      sp.pitch = damp(sp.pitch, 0, 7, dt)
    }
    tilt.current.rotation.y = sp.yaw
    tilt.current.rotation.x = sp.pitch

    // shader uniforms
    hover.current = lerp(hover.current, useHero.getState().hovered ? 1 : 0, 0.08)
    if (visor.current) {
      const u = visor.current.uniforms
      u.uTime.value = t
      u.uHover.value = Math.max(hover.current, g.glow)
      u.uReveal.value = g.reveal
    }

    // floating hotspot labels: project 3D anchors → screen, move the DOM labels
    const f = rig.feature.value
    // re-query after a frame swap re-renders the labels
    if (!hotspotEls.current.length || !hotspotEls.current[0].isConnected) hotspotEls.current = [...document.querySelectorAll('[data-hotspot]')]
    if (f > 0.001) glasses.current.updateMatrixWorld(true)
    hotspotEls.current.forEach((el, i) => {
      if (!hotspotAnchors.current[i] || !HOTSPOTS[i]) return
      let o = clamp(f * 1.6 - i * 0.2, 0, 1)
      if (o > 0 && HOTSPOTS[i].normal) {
        // hide a callout while its part faces away during the spin
        const anchorObj = hotspotAnchors.current[i]
        anchorObj.getWorldPosition(_v)
        _n.set(...HOTSPOTS[i].normal).applyQuaternion(anchorObj.getWorldQuaternion(_qw))
        o *= THREE.MathUtils.smoothstep(_n.dot(_c.copy(state.camera.position).sub(_v).normalize()), -0.05, 0.35)
      }
      el.style.opacity = o
      if (f <= 0.001) return
      hotspotAnchors.current[i].getWorldPosition(_v).project(state.camera)
      const sx = (_v.x * 0.5 + 0.5) * state.size.width
      el.style.transform = `translate(${sx}px, ${(-_v.y * 0.5 + 0.5) * state.size.height}px)`
      // labels on the right of the screen read leftwards so they never run into the spec column
      el.classList.toggle('flip', sx > state.size.width * 0.55)
    })
  })

  const onOver = (e) => {
    e.stopPropagation()
    if (useHero.getState().phase !== 'idle') return
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    setHovered(false)
    document.body.style.cursor = ''
  }
  const onClick = (e) => {
    e.stopPropagation()
    onOut()
    explore()
  }

  return (
    <>
      {/* ============================ CHARACTER ============================ */}
      <group ref={character} scale={CHARACTER.scale}>
        <group ref={head} position={[0, CHARACTER.pivotY, 0]}>
          <group position={[0, -CHARACTER.pivotY, 0]}>
            <CHARACTER.Head mat={mat} />
            {/* mount point the glasses follow while worn */}
            <object3D ref={anchor} position={[0, 0.12, PIVOT_Z]} />
          </group>
        </group>

        <CHARACTER.Body mat={mat} />

        {/* arm: shoulder → elbow → hand (procedural characters only) */}
        {ARM && (
          <group ref={upper} position={SHOULDER}>
            <mesh material={mat.jacket} position={[0, -UPPER / 2, 0]}>
              <capsuleGeometry args={[ARM.rUpper, UPPER - 0.2, 8, 24]} />
            </mesh>
            <group ref={fore} position={[0, -UPPER, 0]}>
              <mesh material={mat.jacket} scale={ARM.rUpper * 1.02}>
                <sphereGeometry args={[1, 20, 16]} />
              </mesh>
              <mesh material={mat.jacket} position={[0, -FORE / 2, 0]}>
                <capsuleGeometry args={[ARM.rFore, FORE - 0.16, 8, 24]} />
              </mesh>
              <group ref={hand} position={[0, -FORE, 0]}>
                <RoundedBox args={[0.27, 0.3, 0.12]} radius={0.05} position={[0, -0.13, 0]} material={mat.glove} />
                {[-0.09, -0.03, 0.03, 0.09].map((x, i) => (
                  <mesh key={x} material={mat.glove} position={[x, -0.37 + Math.abs(i - 1.5) * 0.025, 0.015]}>
                    <capsuleGeometry args={[0.034, 0.17, 4, 12]} />
                  </mesh>
                ))}
                <mesh material={mat.glove} position={[0.16, -0.16, 0.04]} rotation={[0, 0, 0.7]}>
                  <capsuleGeometry args={[0.036, 0.13, 4, 12]} />
                </mesh>
                <mesh material={mat.neon} position={[0, -0.04, 0.062]}>
                  <boxGeometry args={[0.2, 0.01, 0.004]} />
                </mesh>
              </group>
            </group>
          </group>
        )}
      </group>

      {/* ============================ GLASSES ============================== */}
      <group ref={glasses} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <group ref={tilt}>
          <group position={[0, 0, -PIVOT_Z]}>
            {/* key: remount on swap so each style builds (and later disposes) its own geometry */}
            <frame.Component key={frame.id} lensRef={visor} mat={mat} />

            {/* floating spec callouts (visible in feature mode) */}
            {/* (anchors only — the DOM labels live in Overlay and are positioned in useFrame) */}
            {HOTSPOTS.map((h, i) => (
              <object3D key={h.idx} ref={(o) => (hotspotAnchors.current[i] = o)} position={h.pos} />
            ))}
          </group>
        </group>
      </group>
    </>
  )
}
