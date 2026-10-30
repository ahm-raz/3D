import { EffectComposer, FXAA, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import BlurShaderOverlay from './BlurShaderOverlay'
import { CONFIG } from '../config'

/**
 * Kept deliberately lean: (optional) Bloom + frost + tone mapping + vignette merge
 * into a single full-screen pass, FXAA is one extra cheap pass. The frost pass
 * short-circuits once the intro is over. Toggle bloom in src/config.js.
 */
export default function PostFX() {
  return (
    <EffectComposer multisampling={0} stencilBuffer={false}>
      {CONFIG.bloom && (
        <Bloom mipmapBlur levels={5} intensity={0.85} luminanceThreshold={0.85} luminanceSmoothing={0.25} radius={0.72} resolutionScale={0.5} />
      )}
      <BlurShaderOverlay strength={0.06} samples={16} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.22} darkness={0.78} />
      <FXAA />
    </EffectComposer>
  )
}
