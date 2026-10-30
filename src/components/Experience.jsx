import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, Sparkles } from '@react-three/drei'
import SceneLighting from './SceneLighting'
import GlassesModel from './GlassesModel'
import FeatureDisplay from './FeatureDisplay'
import PostFX from './PostFX'
import AnimationController from './AnimationController'
import { CONFIG } from '../config'

const MAX_DPR = 1.25

export default function Experience() {
  // adaptive resolution: start at ≤1.25×, step down toward 0.75× if the GPU can't keep up
  const [dpr, setDpr] = useState(Math.min(window.devicePixelRatio, MAX_DPR))

  return (
    <Canvas
      className="!fixed inset-0"
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true }}
      camera={{ position: [0, 0.2, 7.6], fov: 30, near: 0.1, far: 30 }}
      onCreated={(state) => {
        if (import.meta.env.DEV) window.__r3f = state
      }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr(Math.min(window.devicePixelRatio, MAX_DPR))}
        onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))}
        flipflops={3}
        onFallback={() => setDpr(0.75)}
      />
      <color attach="background" args={['#050507']} />
      <fog attach="fog" args={['#050507', 10, 17]} />

      <Suspense fallback={null}>
        <SceneLighting />
        <GlassesModel />
        {CONFIG.hud && <FeatureDisplay />}
        <Sparkles count={30} scale={[9, 5, 5]} size={1.6} speed={0.25} color="#ff6a5a" opacity={0.45} />
        <PostFX />
        {/* last, so every rig ref is registered before timelines are built */}
        <AnimationController />
      </Suspense>
    </Canvas>
  )
}
