import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { VisorMaterial } from '../../shaders/visorMaterial'

/**
 * Procedural wayfarer-style sunglasses: two curved red-mirror lenses in a glossy
 * black acetate front, keyhole bridge, metal hinges and temples that hook
 * behind the ears. Built in head space (origin = head centre, +z = face).
 * Every part is merged so the whole pair costs a handful of draw calls.
 */
export const FRONT_Z = 0.98 // frame front plane at the centre line
export const WRAP_X = 0.42 // face-form wrap:  z -= WRAP_X * x²
export const WRAP_Y = 0.22 // lens base curve: z -= WRAP_Y * y²
const LENS_X = 0.42 // lens centres
const LENS_W = 0.66
const LENS_H = 0.4
const RIM = 0.085 // acetate thickness around each lens
const DEPTH = 0.045 // frame front depth

/** Squircle outline, narrower at the bottom (sporty wayfarer silhouette). */
export function lensOutline(w, h, { n = 3.2, taper = 0.16, seg = 72 } = {}) {
  const pts = []
  for (let i = 0; i < seg; i++) {
    const t = (i / seg) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * (w / 2)
    const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * (h / 2)
    x *= 1 - taper * (0.5 - y / h)
    pts.push(new THREE.Vector2(x, y))
  }
  return pts
}

const _n = new THREE.Vector3()

/** Bend a flat part onto the wrap surface; normals use the inverse-transpose Jacobian. */
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

/** z of the frame front at x (handy for placing hinges on the curve). */
const frontZ = (x, y = 0) => FRONT_Z - WRAP_X * x * x - WRAP_Y * y * y

function buildFrame() {
  const parts = []
  for (const s of [-1, 1]) {
    const outer = new THREE.Shape(lensOutline(LENS_W + RIM, LENS_H + RIM * 0.9, { n: 3.6 }))
    outer.holes.push(new THREE.Path(lensOutline(LENS_W - 0.01, LENS_H - 0.01).reverse()))
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: DEPTH,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 2,
      curveSegments: 1,
    })
    g.translate(s * LENS_X, 0, FRONT_Z - DEPTH)
    parts.push(wrap(g))
  }

  // keyhole bridge
  const bridge = new THREE.Shape()
  bridge.moveTo(-0.11, 0.05)
  bridge.lineTo(0.11, 0.05)
  bridge.lineTo(0.11, 0.12)
  bridge.quadraticCurveTo(0, 0.16, -0.11, 0.12)
  bridge.closePath()
  const b = new THREE.ExtrudeGeometry(bridge, {
    depth: DEPTH * 0.8,
    bevelEnabled: true,
    bevelSize: 0.01,
    bevelThickness: 0.01,
    bevelSegments: 2,
    curveSegments: 8,
  })
  b.translate(0, 0, FRONT_Z - DEPTH * 0.9)
  parts.push(wrap(b))

  return mergeGeometries(parts)
}

function buildLenses() {
  const totalW = 2 * (LENS_X + LENS_W / 2)
  const parts = [-1, 1].map((s) => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(lensOutline(LENS_W, LENS_H)), 24)
    g.translate(s * LENS_X, 0, FRONT_Z - DEPTH * 0.5)
    // continuous UVs across both lenses so the shader's gradient + glint sweep read as one pair
    const p = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + totalW / 2) / totalW, (p.getY(i) + LENS_H / 2) / LENS_H)
    return wrap(g)
  })
  return mergeGeometries(parts)
}

function buildTemples() {
  const parts = [-1, 1].map((s) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.875, 0.07, frontZ(0.86, 0.07) - 0.04),
      new THREE.Vector3(s * 0.89, 0.08, 0.3),
      new THREE.Vector3(s * 0.88, 0.08, -0.15),
      new THREE.Vector3(s * 0.845, 0.02, -0.42),
      new THREE.Vector3(s * 0.8, -0.13, -0.56),
    ])
    return new THREE.TubeGeometry(curve, 48, 0.019, 8)
  })
  return mergeGeometries(parts)
}

function RealGlasses({ lensRef, mat }) {
  const { frame, lenses, temples, lensMaterial, metal } = useMemo(() => {
    const lensMaterial = new VisorMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    lensMaterial.uOpacity = 0.86
    lensMaterial.uFresnelPower = 2.6
    lensMaterial.uColorA = new THREE.Color('#e0101c')
    lensMaterial.uColorB = new THREE.Color('#ff6414')
    return {
      frame: buildFrame(),
      lenses: buildLenses(),
      temples: buildTemples(),
      lensMaterial,
      metal: new THREE.MeshStandardMaterial({ color: '#4a4d55', roughness: 0.3, metalness: 1 }),
    }
  }, [])

  // GlassesModel drives uTime / uHover / uReveal through this ref
  useLayoutEffect(() => {
    lensRef.current = lensMaterial
  }, [lensRef, lensMaterial])

  useLayoutEffect(
    () => () => {
      frame.dispose()
      lenses.dispose()
      temples.dispose()
      lensMaterial.dispose()
      metal.dispose()
    },
    [frame, lenses, temples, lensMaterial, metal]
  )

  return (
    <>
      <mesh geometry={frame} material={mat.acetate} />
      <mesh geometry={lenses} material={lensMaterial} renderOrder={3} />
      <mesh geometry={temples} material={mat.acetate} />

      {[-1, 1].map((s) => (
        <group key={s}>
          {/* hinge barrel + end piece */}
          <mesh material={metal} position={[s * 0.872, 0.07, frontZ(0.86, 0.07) - 0.03]}>
            <cylinderGeometry args={[0.018, 0.018, 0.075, 12]} />
          </mesh>
          {/* signature red inlay on the temple */}
          <mesh material={mat.neon} position={[s * 0.905, 0.08, 0.36]} rotation={[0, s * 0.04, 0]}>
            <boxGeometry args={[0.004, 0.012, 0.22]} />
          </mesh>
          {/* nose pads */}
          <mesh material={mat.pad} position={[s * 0.075, -0.07, frontZ(0.075, -0.07) - 0.07]} scale={[0.022, 0.045, 0.012]}>
            <sphereGeometry args={[1, 12, 12]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export const REAL = {
  Component: RealGlasses,
  pivotZ: 0.6, // centroid of the front, so the 360° spin turns about the lenses
  grip: [0.884, 0.074, 0.45], // where the hand pinches the left temple arm, just behind the hinge
  hotspots: [
    { pos: [-LENS_X + 0.05, -0.1, frontZ(LENS_X - 0.05, -0.1) + 0.01], label: 'Nano-ceramic lens', idx: '01', normal: [0, 0, 1] },
    { pos: [-0.875, 0.07, frontZ(0.86, 0.07) - 0.03], label: 'Titanium spring hinge', idx: '02', normal: [-0.7, 0, 0.7] },
    { pos: [0, 0.12, FRONT_Z + 0.02], label: 'Keyhole bridge', idx: '03', normal: [0, 0.3, 1] },
  ],
}
