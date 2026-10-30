import { useLayoutEffect, useMemo } from 'react'
import { FrostBlurEffect } from '../effects/CustomBlurPass'
import { rig } from '../store'

/**
 * Declarative wrapper so the frost pass can live inside <EffectComposer>.
 * The instance is registered on the shared rig; AnimationController tweens
 * its `uProgress` uniform with GSAP (0 = frosted, 1 = clear).
 */
export default function BlurShaderOverlay({ strength = 0.06, samples = 32, tint = '#cfd6e6' }) {
  const effect = useMemo(
    () => new FrostBlurEffect({ progress: 0, strength, samples, tint }),
    [strength, samples, tint]
  )

  useLayoutEffect(() => {
    rig.blur = effect
    return () => {
      if (rig.blur === effect) rig.blur = null
      effect.dispose()
    }
  }, [effect])

  return <primitive object={effect} dispose={null} />
}
