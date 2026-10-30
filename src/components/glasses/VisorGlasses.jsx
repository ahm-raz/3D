import * as THREE from 'three'
import '../../shaders/visorMaterial'

/* The original wrap-around visor — kept intact so CONFIG.glasses = 'visor' restores it. */
const VISOR_ARC = THREE.MathUtils.degToRad(200) // wrap-around angle
const VISOR_H = 0.34
const VISOR_SCALE = [0.87, 1, 0.96] // squash the cylinder to hug the head ellipsoid

function VisorGlasses({ lensRef, mat }) {
  return (
    <>
      <group scale={VISOR_SCALE}>
        {/* outer lens shell — custom GLSL (fresnel, fake metallic reflections, rim) */}
        <mesh renderOrder={3}>
          <cylinderGeometry args={[1.0, 1.03, VISOR_H, 96, 1, true, -VISOR_ARC / 2, VISOR_ARC]} />
          <visorMaterial ref={lensRef} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        {/* inner lens — plain transparent glass (true transmission re-renders the scene each frame) */}
        <mesh renderOrder={2}>
          <cylinderGeometry args={[0.985, 1.015, VISOR_H * 0.96, 96, 1, true, -VISOR_ARC / 2, VISOR_ARC]} />
          <meshStandardMaterial
            color="#ff2a18"
            roughness={0.1}
            metalness={0.3}
            transparent
            opacity={0.55}
            depthWrite={false}
            envMapIntensity={1.6}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* brow bar (metal) */}
        <group position={[0, VISOR_H / 2 + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={mat.frame} rotation={[0, 0, Math.PI / 2 - VISOR_ARC / 2]}>
            <torusGeometry args={[1.0, 0.028, 8, 96, VISOR_ARC]} />
          </mesh>
        </group>
        {/* neon under-rim */}
        <group position={[0, -VISOR_H / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={mat.neon} rotation={[0, 0, Math.PI / 2 - VISOR_ARC / 2 + 0.15]}>
            <torusGeometry args={[1.03, 0.006, 4, 96, VISOR_ARC - 0.3]} />
          </mesh>
        </group>
        {/* nose bridge */}
        <mesh material={mat.frame} position={[0, -0.12, 1.0]}>
          <boxGeometry args={[0.16, 0.1, 0.035]} />
        </mesh>
      </group>

      {/* hinges + temple arms */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={mat.frame} position={[0.86 * s, 0.15, -0.17]}>
            <boxGeometry args={[0.06, 0.09, 0.08]} />
          </mesh>
          <mesh material={mat.frame} position={[0.865 * s, 0.15, -0.53]} rotation={[0, -0.04 * s, 0]}>
            <boxGeometry args={[0.028, 0.045, 0.7]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export const VISOR = {
  Component: VisorGlasses,
  pivotZ: 0.35, // pivot at the visor centroid, not the head centre
  grip: [0.88, 0.15, -0.26], // pinch point on the left temple arm, behind the hinge block
  hotspots: [
    { pos: [0.02, 0.06, 0.97], label: 'Nano-ceramic lens', idx: '01' },
    { pos: [-0.82, 0.17, -0.12], label: 'Titanium spring hinge', idx: '02' },
    { pos: [-0.45, -0.17, 0.85], label: 'Anti-fog vent channel', idx: '03' },
  ],
}
