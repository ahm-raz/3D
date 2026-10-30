/**
 * Feature switches — flip these to go back to earlier looks without touching code.
 *
 *   glasses: starting frame — 'wayfarer' | 'aviator' | 'round' | 'cateye' | 'shield'
 *            (legacy: 'real' = wayfarer, 'visor' = shield)
 *   character: 'human' → photoreal head scan on a full rigged body (suit, real hands)
 *              'bust'  → head scan on a black turtleneck bust
 *              'robot' → the original stylised balaclava figure
 *   frameSelector: true → row of frame styles at the bottom; pick one to swap the glasses on the face
 *   hud:     true  → geometric rings / ticks / grid around the product in the detail view
 *            false → clean product reveal
 *   bloom:   true  → glow halo on the lens edges / neon accents (one extra half-res pass)
 *            false → lightest render path
 */
export const CONFIG = {
  character: 'human',
  glasses: 'real',
  frameSelector: true,
  hud: false,
  bloom: false,
}
