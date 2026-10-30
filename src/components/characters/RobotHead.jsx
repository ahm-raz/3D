/* The original stylised balaclava head — kept intact so CONFIG.character = 'robot' restores it. */

function Head({ mat }) {
  return (
    <>
      {/* balaclava */}
      <mesh material={mat.mask} scale={[0.82, 1, 0.9]}>
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>
      {/* crown seam + face-opening ridge */}
      <mesh material={mat.maskDeep} position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.65, 0.71, 1]}>
        <torusGeometry args={[1, 0.012, 8, 96]} />
      </mesh>
      {/* nose */}
      <mesh material={mat.mask} position={[0, -0.16, 0.85]} scale={[0.1, 0.17, 0.11]}>
        <sphereGeometry args={[1, 32, 32]} />
      </mesh>
      {/* mouth vent */}
      <mesh material={mat.maskDeep} position={[0, -0.52, 0.73]} rotation={[0.45, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.05, 0.24, 8, 16]} />
      </mesh>
      {/* ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat.mask} position={[0.8 * s, -0.04, -0.05]} scale={[0.08, 0.2, 0.13]}>
          <sphereGeometry args={[1, 24, 24]} />
        </mesh>
      ))}
      {/* eyes glowing behind the lens */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat.eyes} position={[0.3 * s, 0.12, 0.8]} rotation={[0, 0.35 * s, Math.PI / 2]}>
          <capsuleGeometry args={[0.022, 0.13, 4, 12]} />
        </mesh>
      ))}
    </>
  )
}

/** Neck, collar, shoulders. */
function Body({ mat }) {
  return (
    <>
      <mesh material={mat.mask} position={[0, -1.02, -0.04]}>
        <cylinderGeometry args={[0.36, 0.42, 0.6, 48]} />
      </mesh>
      <mesh material={mat.jacket} position={[0, -1.3, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.09, 16, 64]} />
      </mesh>
      <mesh material={mat.jacket} position={[0, -1.82, -0.05]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.75]}>
        <capsuleGeometry args={[0.52, 1.5, 16, 48]} />
      </mesh>
      <mesh material={mat.neon} position={[-0.62, -1.36, 0.3]} rotation={[0.5, 0, 0.35]}>
        <boxGeometry args={[0.32, 0.012, 0.012]} />
      </mesh>
    </>
  )
}

export const ROBOT = {
  Head,
  Body,
  pivotY: 0, // head turns about the skull centre
  scale: 1,
  hideArmAtRest: false,
  // original hand-tuned arm (directions, not IK)
  arm: { shoulder: [1.02, -1.42, 0.05], upper: 1.0, fore: 0.74, rUpper: 0.17, rFore: 0.14, raised: [[0.5, 0.85, 0.2], [-0.57, 0.66, 0.1]] },
  credit: [],
}
