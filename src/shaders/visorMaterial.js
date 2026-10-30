import * as THREE from 'three'
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'

/**
 * Outer shell of the red visor: fresnel glow, fake studio-softbox metallic
 * reflections, ambient rim and a sweeping glint. Outputs HDR (>1) values so
 * the Bloom pass picks up the edges.
 */
const vertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewPos;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewPos = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uHover;
uniform float uReveal;
uniform float uFresnelPower;
uniform float uOpacity;
uniform vec3  uColorA;
uniform vec3  uColorB;
uniform vec3  uRimColor;

varying vec3 vNormal;
varying vec3 vViewPos;
varying vec2 vUv;

float band(float x, float c, float w) { return smoothstep(w, 0.0, abs(x - c)); }

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(vViewPos);
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - NdV, uFresnelPower);

  // neon red (top) → orange (bottom) gradient tint
  vec3 tint = mix(uColorB, uColorA, smoothstep(0.05, 0.95, vUv.y));

  // fake studio environment: horizon softbox + vertical strip light
  vec3 R = reflect(-V, N);
  float horizon = band(R.y, 0.22, 0.06) * 1.2 + band(R.y, -0.38, 0.04) * 0.5;
  float strip = band(R.x, 0.52 + 0.06 * sin(uTime * 0.5), 0.07) * smoothstep(-0.3, 0.6, R.y);
  float env = horizon + strip;
  vec3 metal = mix(vec3(1.0, 0.94, 0.92) * env, tint * env * 2.2, 0.55);

  // sweeping glint
  float sweep = band(vUv.x + vUv.y * 0.35, fract(uTime * 0.11) * 1.9 - 0.25, 0.035);

  vec3 col = tint * (0.2 + 0.5 * NdV);
  col += metal * 0.6;
  col += uRimColor * fres * (1.8 + 3.0 * uHover);
  col += vec3(1.0, 0.65, 0.55) * sweep * (0.7 + 1.5 * uHover);
  col *= mix(0.2, 1.0, uReveal);

  float alpha = clamp(uOpacity + fres * 0.35 + env * 0.25, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`

export const VisorMaterial = shaderMaterial(
  {
    uTime: 0,
    uHover: 0,
    uReveal: 0,
    uFresnelPower: 2.2,
    uOpacity: 0.55,
    uColorA: new THREE.Color('#ff1530'),
    uColorB: new THREE.Color('#ff6a12'),
    uRimColor: new THREE.Color('#ff3838'),
  },
  vertexShader,
  fragmentShader
)

extend({ VisorMaterial })
