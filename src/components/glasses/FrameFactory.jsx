import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { VisorMaterial } from '../../shaders/visorMaterial'
import { FRONT_Z, WRAP_X, WRAP_Y } from './RealGlasses'

/**
 * Procedural frame factory. A frame is a lens outline + rim + bridge + temples,
 * bent onto the same face-form wrap as the Wayfarer so every style sits on the
 * same nose bridge and eye line of the head. Specs are plain data — see glasses/index.js.
 *
 * spec = {
 *   lensX, lensW, lensH,             lens centre offset and size (head space)
 *   outline(w, h, side) → Vector2[]  lens shape; side = ±1 so styles can be asymmetric
 *   rim, depth, finish               rim width, front depth, 'acetate' | 'gold' | 'gunmetal' | 'silver'
 *   bridge                           'keyhole' | 'double' | 'arc'
 *   lens: [topColor, bottomColor], opacity
 * }
 */
const _n = new THREE.Vector3()
const frontZ = (x, y = 0) => FRONT_Z - WRAP_X * x * x - WRAP_Y * y * y

function wrap(geo) {
  const p = geo.attributes.position
  const n = geo.attributes.normal
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    p.setZ(i, p.getZ(i) - WRAP_X * x * x - WRAP_Y * y * y)
    if (n) {
      const nz = n.getZ(i)
      _n.set(n.getX(i) + 2 * WRAP_X * x * nz, n.getY(i) + 2 * WRAP_Y * y * nz, nz).normalize()
      n.setXYZ(i, _n.x, _n.y, _n.z)
    }
  }
  p.needsUpdate = true
  geo.computeBoundingSphere()
  return geo
}

/** Tube through head-space points lifted onto the frame's front curve (for wire bridges). */
function frontTube(points, radius, zOffset = 0) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, frontZ(x, y) + zOffset)))
  return new THREE.TubeGeometry(curve, 32, radius, 8)
}

const isMetal = (spec) => spec.finish !== 'acetate'

/** Where a style's hinge sits: just outside the rim's outer edge, a little above centre. */
export const hingeOf = (spec) => {
  const x = spec.lensX + (spec.lensW + spec.rim) / 2 + (isMetal(spec) ? 0.035 : 0.02)
  const y = spec.lensH * 0.22
  return [x, y, frontZ(x, y) - 0.03]
}

function buildFront(spec) {
  const parts = []
  for (const s of [-1, 1]) {
    const outer = new THREE.Shape(spec.outline(spec.lensW + spec.rim, spec.lensH + spec.rim * 0.9, s))
    outer.holes.push(new THREE.Path(spec.outline(spec.lensW - 0.01, spec.lensH - 0.01, s)))
    const bevel = isMetal(spec) ? 0.006 : 0.012
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: spec.depth,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 2,
      curveSegments: 1,
    })
    g.translate(s * spec.lensX, 0, FRONT_Z - spec.depth)
    parts.push(wrap(g))
  }

  const inner = spec.lensX - (spec.lensW + spec.rim) / 2 // inner rim edge (x > 0 side)
  const top = spec.lensH * 0.32
  if (spec.bridge === 'keyhole') {
    const w = Math.max(inner + 0.06, 0.1)
    const bridge = new THREE.Shape()
    bridge.moveTo(-w, 0.05)
    bridge.lineTo(w, 0.05)
    bridge.lineTo(w, 0.12)
    bridge.quadraticCurveTo(0, 0.16, -w, 0.12)
    bridge.closePath()
    const b = new THREE.ExtrudeGeometry(bridge, { depth: spec.depth * 0.8, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 8 })
    b.translate(0, 0, FRONT_Z - spec.depth * 0.9)
    parts.push(wrap(b))
  } else if (spec.bridge === 'double') {
    // aviator: straight brow bar across the tops + a low curved bridge
    const bx = spec.lensX - spec.lensW * 0.3
    parts.push(frontTube([[-bx, top + 0.06], [0, top + 0.065], [bx, top + 0.06]], 0.011, -spec.depth * 0.5))
    parts.push(frontTube([[-inner - 0.01, 0.07], [-0.05, 0.11], [0, 0.115], [0.05, 0.11], [inner + 0.01, 0.07]], 0.012, -spec.depth * 0.5))
  } else {
    // round / P3: single keyhole arc in wire
    parts.push(frontTube([[-inner - 0.01, 0.05], [-0.06, 0.12], [0, 0.135], [0.06, 0.12], [inner + 0.01, 0.05]], 0.013, -spec.depth * 0.5))
  }

  // end pieces: short bar from the rim's outer edge to the hinge
  const [hx, hy] = hingeOf(spec)
  for (const s of [-1, 1]) {
    const ox = spec.lensX + (spec.lensW + spec.rim) / 2 - 0.02
    parts.push(frontTube([[s * ox, hy], [s * (ox + hx) / 2, hy], [s * hx, hy]], isMetal(spec) ? 0.012 : 0.024, -spec.depth * 0.6))
  }
  return mergeGeometries(parts.map((g) => stripToCommon(ni(g))))
}

/** Extrusions are non-indexed, tubes are indexed — mergeGeometries needs one kind. */
const ni = (g) => (g.index ? g.toNonIndexed() : g)

/** mergeGeometries needs identical attribute sets — keep position/normal/uv only. */
function stripToCommon(g) {
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
  return g
}

function buildLenses(spec) {
  const totalW = 2 * (spec.lensX + spec.lensW / 2)
  const parts = [-1, 1].map((s) => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(spec.outline(spec.lensW, spec.lensH, s)), 24)
    g.translate(s * spec.lensX, 0, FRONT_Z - spec.depth * 0.5)
    const p = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + totalW / 2) / totalW, (p.getY(i) + spec.lensH / 2) / spec.lensH)
    return wrap(g)
  })
  return mergeGeometries(parts)
}

function buildTemples(spec) {
  const [hx, hy, hz] = hingeOf(spec)
  const r = isMetal(spec) ? 0.011 : 0.019
  const arms = []
  const tips = []
  for (const s of [-1, 1]) {
    const pts = [
      new THREE.Vector3(s * hx, hy, hz - 0.01),
      new THREE.Vector3(s * 0.89, 0.08, 0.3),
      new THREE.Vector3(s * 0.88, 0.08, -0.15),
      new THREE.Vector3(s * 0.845, 0.02, -0.42),
      new THREE.Vector3(s * 0.8, -0.13, -0.56),
    ]
    arms.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 8))
    // metal frames get acetate temple tips over the ear
    if (isMetal(spec)) tips.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(2)), 24, 0.017, 8))
  }
  return { arms: mergeGeometries(arms), tips: tips.length ? mergeGeometries(tips) : null }
}

const FINISH = {
  gold: { color: '#c9a35a', roughness: 0.22, metalness: 1 },
  gunmetal: { color: '#55585f', roughness: 0.28, metalness: 1 },
  silver: { color: '#c4c7cd', roughness: 0.2, metalness: 1 },
}

export function makeFrame(spec) {
  function Frame({ lensRef, mat }) {
    const parts = useMemo(() => {
      const lensMaterial = new VisorMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
      lensMaterial.uOpacity = spec.opacity ?? 0.86
      lensMaterial.uFresnelPower = 2.6
      lensMaterial.uColorA = new THREE.Color(spec.lens[0])
      lensMaterial.uColorB = new THREE.Color(spec.lens[1])
      return {
        front: buildFront(spec),
        lenses: buildLenses(spec),
        temples: buildTemples(spec),
        lensMaterial,
        frameMaterial: isMetal(spec) ? new THREE.MeshStandardMaterial({ ...FINISH[spec.finish], envMapIntensity: 1.5 }) : null,
      }
    }, [])

    useLayoutEffect(() => {
      lensRef.current = parts.lensMaterial
    }, [lensRef, parts])

    useLayoutEffect(
      () => () => {
        parts.front.dispose()
        parts.lenses.dispose()
        parts.temples.arms.dispose()
        parts.temples.tips?.dispose()
        parts.lensMaterial.dispose()
        parts.frameMaterial?.dispose()
      },
      [parts]
    )

    const frameMat = parts.frameMaterial ?? mat.acetate
    return (
      <>
        <mesh geometry={parts.front} material={frameMat} />
        <mesh geometry={parts.lenses} material={parts.lensMaterial} renderOrder={3} />
        <mesh geometry={parts.temples.arms} material={frameMat} />
        {parts.temples.tips && <mesh geometry={parts.temples.tips} material={mat.acetate} />}
        {[-1, 1].map((s) => (
          <mesh key={s} material={mat.pad} position={[s * 0.08, -0.07, frontZ(0.08, -0.07) - 0.07]} scale={[0.022, 0.045, 0.012]}>
            <sphereGeometry args={[1, 12, 12]} />
          </mesh>
        ))}
      </>
    )
  }

  const [hx, hy, hz] = hingeOf(spec)
  return {
    Component: Frame,
    pivotZ: 0.6,
    // pinch point on the left temple arm, a little way back from the hinge
    grip: [hx + (0.89 - hx) * 0.45, hy + (0.08 - hy) * 0.45, hz + (0.3 - hz) * 0.45],
    hotspots: [
      { pos: [-spec.lensX + 0.05, -0.08, frontZ(spec.lensX - 0.05, -0.08) + 0.01], label: spec.labels[0], idx: '01', normal: [0, 0, 1] },
      { pos: [-hx, hy, hz], label: spec.labels[1], idx: '02', normal: [-0.7, 0, 0.7] },
      { pos: [0, 0.12, frontZ(0, 0.12) + 0.02], label: spec.labels[2], idx: '03', normal: [0, 0.3, 1] },
    ],
    // 2D outline for the selector thumbnail (same shape as the 3D lens rims)
    thumb: { lensX: spec.lensX, outer: (s) => spec.outline(spec.lensW + spec.rim, spec.lensH + spec.rim * 0.9, s), hinge: hx, hingeY: hy, metal: isMetal(spec) },
  }
}

/* ---------------- lens outlines ---------------- */

/** Superellipse; `n` 2 = ellipse, higher = squarer. */
function superellipse(w, h, n, seg = 72, warp = (x, y) => [x, y]) {
  const pts = []
  for (let i = 0; i < seg; i++) {
    const t = (i / seg) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * (w / 2)
    const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * (h / 2)
    pts.push(new THREE.Vector2(...warp(x, y)))
  }
  return pts
}

/** Aviator teardrop: flat brow, bottom drooping toward the nose. */
export const aviatorOutline = (w, h, side) =>
  superellipse(w, h, 2.4, 72, (x, y) => {
    if (y > 0) return [x, y * 0.78]
    const k = -y / (h / 2) // 0 at centre → 1 at the bottom
    return [x - side * 0.075 * k * k * (w / 0.62), y * 1.08]
  })

/** Panto-round lens. */
export const roundOutline = (w, h) => superellipse(w, h, 2.05, 72)

/** Cat-eye: upswept outer top corner, narrowing bottom. */
export const catEyeOutline = (w, h, side) =>
  superellipse(w, h, 2.8, 72, (x, y) => {
    const outer = Math.max(0, (side * x) / (w / 2)) // 0 inner half → 1 at the outer edge
    let yy = y
    // the "wing": outer top corner lifts and reaches outward
    if (y > 0) yy += 0.17 * Math.pow(outer, 2.4) * (h / 0.38)
    const xx = x * (1 - 0.2 * (0.5 - y / h)) + (side * 0.03 * Math.pow(outer, 3) * Math.max(y, 0)) / (h / 2)
    return [xx, yy]
  })
