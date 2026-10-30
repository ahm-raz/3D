import { CONFIG } from '../../config'
import { REAL, lensOutline } from './RealGlasses'
import { VISOR } from './VisorGlasses'
import { makeFrame, aviatorOutline, roundOutline, catEyeOutline } from './FrameFactory'

/**
 * Frame catalogue — the selector at the bottom of the hero lists these in order.
 * Adding a style = one entry here (a spec for makeFrame, or a hand-built component).
 * `meta` feeds the product view (specs column, price, eyebrow).
 */
export const FRAMES = [
  {
    id: 'wayfarer',
    name: 'Wayfarer',
    ...REAL,
    thumb: { lensX: 0.42, outer: () => lensOutline(0.745, 0.4765, { n: 3.6 }), hinge: 0.875, hingeY: 0.07 },
    swatch: ['#e0101c', '#ff6414'],
    meta: {
      specs: [['Lens', 'Nano-ceramic, 9% VLT'], ['Field of view', '180° wrap'], ['Weight', '24 g'], ['Protection', 'UV400 / Cat. 3'], ['Frame', 'Italian acetate']],
      price: '€ 480',
    },
  },
  {
    id: 'aviator',
    name: 'Aviator',
    ...makeFrame({
      lensX: 0.4, lensW: 0.62, lensH: 0.5, outline: aviatorOutline,
      rim: 0.028, depth: 0.02, finish: 'gold', bridge: 'double',
      lens: ['#9c1f0e', '#ffb03a'], opacity: 0.84,
      labels: ['Gradient mineral lens', 'Gold-plated hinge', 'Double brow bridge'],
    }),
    swatch: ['#9c1f0e', '#ffb03a'],
    meta: {
      specs: [['Lens', 'Gradient mineral glass'], ['Field of view', '160° teardrop'], ['Weight', '28 g'], ['Protection', 'UV400 / Cat. 2'], ['Frame', '24k gold-plated titanium']],
      price: '€ 520',
    },
  },
  {
    id: 'round',
    name: 'Round',
    ...makeFrame({
      lensX: 0.37, lensW: 0.5, lensH: 0.5, outline: roundOutline,
      rim: 0.03, depth: 0.02, finish: 'gunmetal', bridge: 'arc',
      lens: ['#5a0610', '#ff2a2a'], opacity: 0.88,
      labels: ['Polarised crimson lens', 'Micro-screw hinge', 'Keyhole wire bridge'],
    }),
    swatch: ['#5a0610', '#ff2a2a'],
    meta: {
      specs: [['Lens', 'Polarised crimson'], ['Field of view', '140° panto'], ['Weight', '19 g'], ['Protection', 'UV400 / Cat. 3'], ['Frame', 'Gunmetal beta-titanium']],
      price: '€ 440',
    },
  },
  {
    id: 'cateye',
    name: 'Cat-eye',
    ...makeFrame({
      lensX: 0.41, lensW: 0.62, lensH: 0.38, outline: catEyeOutline,
      rim: 0.08, depth: 0.045, finish: 'acetate', bridge: 'keyhole',
      lens: ['#c2185b', '#ff6a3d'], opacity: 0.86,
      labels: ['Rose-mirror lens', 'Seven-barrel hinge', 'Sculpted keyhole bridge'],
    }),
    swatch: ['#c2185b', '#ff6a3d'],
    meta: {
      specs: [['Lens', 'Rose mirror, 12% VLT'], ['Field of view', '170° upswept'], ['Weight', '26 g'], ['Protection', 'UV400 / Cat. 3'], ['Frame', 'Hand-polished acetate']],
      price: '€ 495',
    },
  },
  {
    id: 'shield',
    name: 'Shield',
    ...VISOR,
    thumb: { visor: true },
    swatch: ['#ff1530', '#ff6a12'],
    meta: {
      specs: [['Lens', 'Single-piece polycarbonate'], ['Field of view', '200° wrap'], ['Weight', '31 g'], ['Protection', 'UV400 / Cat. 4'], ['Frame', 'Matte titanium brow']],
      price: '€ 560',
    },
  },
]

export const FRAME_BY_ID = Object.fromEntries(FRAMES.map((f) => [f.id, f]))

// CONFIG.glasses: 'real' (legacy name for the wayfarer), 'visor' (legacy name for the shield), or any frame id
const LEGACY = { real: 'wayfarer', visor: 'shield' }
export const DEFAULT_FRAME = FRAME_BY_ID[LEGACY[CONFIG.glasses] ?? CONFIG.glasses] ? LEGACY[CONFIG.glasses] ?? CONFIG.glasses : 'wayfarer'

/** Back-compat: the design that was active before the selector existed. */
export const GLASSES = FRAME_BY_ID[DEFAULT_FRAME]
