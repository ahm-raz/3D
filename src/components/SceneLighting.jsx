import { useLayoutEffect, useRef } from 'react'
import { Environment, Lightformer } from '@react-three/drei'
import { rig } from '../store'

/**
 * Dramatic three-point setup. Lights start dim; AnimationController brings
 * them up to `userData.target` as the frost melts so the light "sharpens".
 */
export const LIGHT_TARGETS = { key: 3.4, rim: 150, rim2: 85, fill: 0.55 }

export default function SceneLighting() {
  const key = useRef()
  const rim = useRef()
  const rim2 = useRef()
  const fill = useRef()

  useLayoutEffect(() => {
    rig.lights = { key: key.current, rim: rim.current, rim2: rim2.current, fill: fill.current }
  }, [])

  return (
    <>
      {/* fill: deep blue / purple ambience */}
      <ambientLight ref={fill} color="#2b1d6b" intensity={0.15} />
      <hemisphereLight args={['#3a2c9a', '#050208', 0.35]} />

      {/* key: hard top-left white/cyan */}
      <directionalLight ref={key} position={[-4, 5, 4.5]} color="#dff6ff" intensity={0.3} />

      {/* rim: vibrant red from behind-right, plus an ember kicker from behind-left */}
      <spotLight ref={rim} position={[3.2, 1.6, -2.6]} angle={0.6} penumbra={0.8} decay={2} color="#ff1a2a" intensity={0} />
      <spotLight ref={rim2} position={[-3.4, 0.8, -2.2]} angle={0.6} penumbra={1} decay={2} color="#ff4d1a" intensity={0} />

      {/* red spill from the visor onto the face */}
      <pointLight position={[0, 0.05, 1.5]} color="#ff2a2a" intensity={1.2} distance={3} decay={2} />

      {/* procedural studio environment — no HDR download needed */}
      <Environment resolution={128} frames={1} environmentIntensity={0.6}>
        <Lightformer form="rect" intensity={3} color="#e8f6ff" position={[-3, 4, 3]} scale={[6, 2, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={6} color="#ff2030" position={[5, 0.5, -3]} scale={[1.5, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={2} color="#7b5cff" position={[-4, -1, -4]} scale={3} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 0, 6]} scale={[10, 1, 1]} target={[0, 0, 0]} />
      </Environment>
    </>
  )
}
