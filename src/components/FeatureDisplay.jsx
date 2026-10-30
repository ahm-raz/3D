import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from '../store'

/**
 * Geometric HUD that unfolds around the detached glasses: orbit rings, a tick
 * dial, a scanning line and a dot field. Everything fades with rig.feature.
 */
const RED = new THREE.Color('#ff2a2a').multiplyScalar(2)
const WHITE = new THREE.Color('#ecebe6')

function hudMaterial(color, base) {
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  })
  m.userData.base = base
  return m
}

export default function FeatureDisplay() {
  const group = useRef()
  const ringA = useRef()
  const ringC = useRef()
  const dial = useRef()
  const arc = useRef()
  const scan = useRef()

  const { mats, tickGeo, dotGeo, tickMat, dotMat } = useMemo(() => {
    const mats = {
      ringA: hudMaterial(RED, 0.9),
      ringB: hudMaterial(WHITE, 0.3),
      ringC: hudMaterial(RED, 0.3),
      arc: hudMaterial(RED, 1),
      scan: hudMaterial(RED, 0.7),
      cross: hudMaterial(WHITE, 0.25),
    }

    // tick dial
    const ticks = []
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2
      const r1 = 1.5
      const r2 = i % 10 === 0 ? 1.66 : i % 5 === 0 ? 1.59 : 1.55
      ticks.push(Math.cos(a) * r1, Math.sin(a) * r1, 0, Math.cos(a) * r2, Math.sin(a) * r2, 0)
    }
    const tickGeo = new THREE.BufferGeometry()
    tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3))
    const tickMat = new THREE.LineBasicMaterial({
      color: WHITE,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    tickMat.userData.base = 0.3

    // dot field
    const dots = []
    for (let x = -24; x <= 24; x++) for (let y = -12; y <= 12; y++) dots.push(x * 0.28, y * 0.28, 0)
    const dotGeo = new THREE.BufferGeometry()
    dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3))
    const dotMat = new THREE.PointsMaterial({
      color: WHITE,
      size: 0.022,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    dotMat.userData.base = 0.12

    return { mats, tickGeo, dotGeo, tickMat, dotMat }
  }, [])

  const all = useMemo(() => [...Object.values(mats), tickMat, dotMat], [mats, tickMat, dotMat])

  useFrame((state, dt) => {
    const f = rig.feature.value
    const g = group.current
    g.visible = f > 0.002
    if (!g.visible) return

    const t = state.clock.elapsedTime
    const ease = 1 - Math.pow(1 - f, 3)
    g.position.set(rig.glasses.pos.x, rig.glasses.pos.y, rig.glasses.pos.z - 0.5)
    g.scale.setScalar((0.6 + 0.4 * ease) * 0.62 * THREE.MathUtils.clamp(rig.glasses.scale, 0.6, 1))
    all.forEach((m) => (m.opacity = m.userData.base * f))

    ringA.current.rotation.x = Math.sin(t * 0.4) * 0.5
    ringA.current.rotation.y += dt * 0.25
    ringC.current.rotation.y -= dt * 0.12
    ringC.current.rotation.x = 1.1 + Math.sin(t * 0.3) * 0.2
    dial.current.rotation.z -= dt * 0.05
    arc.current.rotation.z += dt * 0.6
    scan.current.position.y = Math.sin(t * 0.9) * 1.1
  })

  return (
    <group ref={group} visible={false}>
      <mesh ref={ringA} material={mats.ringA}>
        <torusGeometry args={[1.1, 0.003, 6, 200]} />
      </mesh>
      <mesh material={mats.ringB}>
        <ringGeometry args={[1.3, 1.306, 200]} />
      </mesh>
      <mesh ref={ringC} material={mats.ringC}>
        <torusGeometry args={[1.9, 0.0025, 6, 220]} />
      </mesh>
      <lineSegments ref={dial} geometry={tickGeo} material={tickMat} />
      <mesh ref={arc} material={mats.arc}>
        <torusGeometry args={[1.53, 0.009, 6, 120, Math.PI / 3]} />
      </mesh>
      <mesh ref={scan} material={mats.scan} position={[0, 0, 0.2]}>
        <planeGeometry args={[4.5, 0.004]} />
      </mesh>
      <mesh material={mats.cross}>
        <planeGeometry args={[9, 0.002]} />
      </mesh>
      <mesh material={mats.cross}>
        <planeGeometry args={[0.002, 5]} />
      </mesh>
      <points geometry={dotGeo} material={dotMat} position={[0, 0, -1.4]} />
    </group>
  )
}
