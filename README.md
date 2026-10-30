# VANTA — 3D interactive hero

React + React Three Fiber + GSAP hero section: frosted-glass intro, procedural masked character,
hand-to-temple gesture, dolly-zoom, detachable visor with a geometric feature display.
Everything is procedural except the human character: a photoreal head scan (≈0.7 MB) on a rigged
avatar body (≈1.8 MB) — see Credits. No HDRs or CDN assets. In the product view the glasses can be
dragged to spin 360° (with inertia and a slow auto-turntable).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Structure

| File | Role |
| --- | --- |
| `src/effects/CustomBlurPass.js` | `FrostBlurEffect` — postprocessing `Effect` with a GLSL melt mask, flow-field directional Gaussian blur, milky tint. `uProgress` 0 → 1 clears it. |
| `src/components/BlurShaderOverlay.jsx` | Declarative wrapper for the frost pass; registers it on the shared rig. |
| `src/shaders/visorMaterial.js` | Custom lens shader: fresnel glow, fake studio-softbox metallic reflections, rim, sweeping glint (layered over a cheap transparent inner lens — no transmission pass). |
| `src/components/GlassesModel.jsx` | Procedural head/mask, two-bone arm (slerped rest ↔ raised pose), visor (shader shell + transparent inner lens), cursor-follow lerp, hover/click, worn ↔ free transform blend. |
| `src/components/SceneLighting.jsx` | Cyan-white key, blue/purple fill, red + ember rim spots, Lightformer environment. |
| `src/components/AnimationController.jsx` | GSAP intro / explore timelines (reversed for return) and the damped camera rig. |
| `src/components/FeatureDisplay.jsx` | HUD rings, tick dial, scan line, dot field around the detached visor. |
| `src/components/PostFX.jsx` | Bloom (half-res) → Frost → ACES → Vignette, merged into one pass, + FXAA. |
| `src/components/Overlay.jsx` | Tailwind UI: nav, hero copy, CTA, feature-mode specs, projected hotspot labels. |
| `src/store.js` | Zustand phase state + the mutable `rig` object GSAP tweens and `useFrame` reads. |

## Swapping in a real GLTF

Replace the meshes inside `GlassesModel.jsx` with `useGLTF` nodes. Keep the refs
(`head`, `anchor`, `upper`/`fore`/`hand`, `glasses`, `visor`) — the timeline only talks to those via `rig`.

## Switching looks / going back

All looks stay in the code — flip `src/config.js`:

```js
export const CONFIG = {
  character: 'human', // 'human' = head scan on a full rigged body · 'bust' = head scan in a turtleneck · 'robot' = original figure
  glasses: 'real', // starting frame: 'wayfarer' | 'aviator' | 'round' | 'cateye' | 'shield' ('real'/'visor' = legacy names)
  frameSelector: true, // row of frames at the bottom (Wayfarer · Aviator · Round · Cat-eye · Shield)
  hud: false,      // true = geometric rings / ticks / grid around the product view
  bloom: false,    // true = glow halo (one extra half-res pass)
}
```

Characters live in `src/components/characters/` (`HumanBody.jsx`, `HumanHead.jsx`, `RobotHead.jsx`): each
exports its head, body, neck pivot, scale, framing and arm rig. The full human poses the avatar's real
skeleton (2-bone IK + hand aim/roll, computed once at load); bust/robot use the procedural arm.
Designs live in `src/components/glasses/` (`RealGlasses.jsx`, `VisorGlasses.jsx`); each exports its
component, pivot and hotspot list, so adding another style is one file plus a line in `glasses/index.js`.

Git: `main` holds the previous version; this work is on `feature/real-glasses`.

## Credits

Head scan "Infinite" by Lee Perry-Smith (Infinite-Realities, via triplegangers.com), licensed
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) — files and license in
`public/models/lee-perry-smith/`. The attribution line on the page is required by the license;
keep it if you ship the human character.

Body: Ready Player Me sample avatar ("copyright: Ready Player Me" in the file), as distributed with the
three.js examples — `public/models/rpm-avatar/`. **Check Ready Player Me's terms before commercial use.**

## Frames

`src/components/glasses/index.js` is the catalogue. Styles are data for `makeFrame()` (lens outline,
rim, bridge, finish, tint, labels) and all share the Wayfarer's face-form wrap, so every frame sits on the
same nose bridge and eye line. Thumbnails in the selector are drawn from the same outlines.
