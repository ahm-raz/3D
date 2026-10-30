import { useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Photoreal head scan ("Infinite" by Lee Perry-Smith, CC BY 3.0 — credit shown
 * in the overlay; license in public/models/lee-perry-smith/).
 *
 * FIT maps scan units into head space so the nose bridge sits under the frame's
 * bridge and the eyes line up behind the lenses (measured from the mesh:
 * bridge y 1.85 / z 2.14, eye line y 1.75, skull half-width ≈ 1.6, centre x −0.09).
 */
const BASE = '/models/lee-perry-smith/'
const URL = BASE + 'LeePerrySmith.glb'
const FIT = { scale: 0.53, position: [0.048, -0.81, -0.2] }
const CUT_Y = -1.1 // scan-space: drop the bare shoulders, the turtleneck hides the cut

/** Keep only triangles fully above y — fewer triangles and no shoulders to hide. */
function trimBelow(source, y) {
  const geo = source.clone()
  const pos = geo.attributes.position
  const idx = geo.index.array
  const keep = []
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2]
    if (pos.getY(a) > y && pos.getY(b) > y && pos.getY(c) > y) keep.push(a, b, c)
  }
  geo.setIndex(keep)
  geo.computeBoundingSphere()
  return geo
}

export function ScanHead() {
  const { nodes } = useGLTF(URL)
  const [map, normalMap] = useTexture([BASE + 'Map-COL.jpg', BASE + 'Infinite-Level_02_Tangent_SmoothUV.jpg'])

  const { geometry, material } = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 4
    return {
      geometry: trimBelow(nodes.LeePerrySmith.geometry, CUT_Y),
      material: new THREE.MeshStandardMaterial({
        map,
        color: '#9c8f88', // pull the albedo down — the key light is tuned for black fabric
        normalMap,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughness: 0.52,
        metalness: 0,
        envMapIntensity: 0.45,
      }),
    }
  }, [nodes, map, normalMap])

  return <mesh geometry={geometry} material={material} scale={FIT.scale} position={FIT.position} />
}

/**
 * Black turtleneck bust: one lathe-turned surface from the rolled collar over
 * sloped shoulders into the chest — no seams between neck and torso.
 * Profile is (radius, y) in head space; depth is squashed per height so the
 * collar is deep enough for the real neck (half-depth 0.73) while the
 * shoulders stay flat like a torso.
 */
const BUST_PROFILE = [
  [0.7, -1.1], [0.77, -1.15], [0.75, -1.27], [0.8, -1.4], [1.02, -1.53],
  [1.32, -1.66], [1.5, -1.82], [1.6, -2.08], [1.6, -2.6], [1.52, -3.1],
]
// deep round collar (the scan's throat reaches z ≈ 0.48), easing into flat shoulders
// (smoothstep, not a linear ramp — a kink in the taper shows up as a crease across the chest)
const depthAt = (y) => 1.25 - 0.65 * THREE.MathUtils.smoothstep(-y, 1.3, 1.9)

function buildBust() {
  // lathe faces point outward when the profile runs bottom → top
  const curve = new THREE.SplineCurve(BUST_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)).reverse())
  // phiStart = π puts the lathe seam at the back
  const geo = new THREE.LatheGeometry(curve.getPoints(40), 72, Math.PI, Math.PI * 2)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * depthAt(p.getY(i)))
  geo.computeVertexNormals()
  return geo
}

function Body({ mat }) {
  const bust = useMemo(buildBust, [])
  return (
    <group position={[0, 0, -0.37]}>
      <mesh geometry={bust} material={mat.jacket} />
      {/* soft folded collar */}
      {[-1.12, -1.18].map((y, i) => (
        <mesh key={y} material={mat.jacket} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.745 + i * 0.02, 0.97 + i * 0.02, 1]}>
          <torusGeometry args={[1, 0.04, 10, 64]} />
        </mesh>
      ))}
    </group>
  )
}

export const SCAN_CREDIT = { text: 'Head scan “Infinite” — Lee Perry-Smith / Infinite-Realities, CC BY 3.0', href: 'https://creativecommons.org/licenses/by/3.0/' }

/** Head scan on a turtleneck bust (CONFIG.character = 'bust'). */
export const BUST = {
  Head: ScanHead,
  Body,
  pivotY: -0.9, // turn the head about the top of the neck, so the trimmed edge stays in the collar
  scale: 0.82, // real proportions run larger than the robot — frame them the same way
  hideArmAtRest: true, // a bust has no hanging arm; it appears as it rises to the glasses
  // shoulder sits inside the bust's shoulder line; IK puts the wrist by the hinge with the elbow out and down
  arm: { shoulder: [1.2, -1.74, -0.3], upper: 1.08, fore: 0.86, rUpper: 0.21, rFore: 0.17, target: [1.04, -0.02, 0.32], pole: [1, -0.45, -0.2] },
  credit: [SCAN_CREDIT],
}

useGLTF.preload(URL)
