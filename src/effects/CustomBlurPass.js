import { Effect, BlendFunction } from 'postprocessing'
import { Color, Uniform, Vector2 } from 'three'

/**
 * Frosted-glass / liquid-blur screen effect.
 *
 * uProgress 0 → 1 melts the frost away: a noisy reveal front grows outward from
 * the centre, behind it the image is sharp, ahead of it the image is scattered
 * through a directional (flow-field-stretched) Gaussian blur with a milky tint.
 *
 * Built-ins provided by postprocessing's EffectMaterial: inputBuffer, resolution,
 * texelSize, aspect, time.
 */
const fragmentShader = /* glsl */ `
uniform float uProgress;
uniform float uStrength;
uniform float uTime;
uniform vec3  uTint;
uniform vec2  uCenter;  // screen-space origin of the melt (the character)

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // uniform branch: once the intro is done the pass costs ~nothing
  if (uProgress >= 0.999) { outputColor = inputColor; return; }

  vec2 asp = vec2(aspect, 1.0);

  // ---- melt mask ---------------------------------------------------------
  float n = fbm(uv * asp * 2.2 + vec2(0.0, uTime * 0.06));
  float d = length((uv - uCenter) * asp) * 0.62 + n * 0.5;      // ~0 .. 1.2
  float front = uProgress * 1.9 - 0.32;
  float frost = smoothstep(front - 0.3, front + 0.02, d);       // 1 = frosted
  frost *= 1.0 - smoothstep(0.94, 1.0, uProgress);              // fully clear at 1

  if (frost < 0.001) { outputColor = inputColor; return; }

  // ---- liquid flow field (gradient of drifting fbm) ---------------------
  vec2 q = uv * asp * 2.6 + vec2(uTime * 0.04, -uTime * 0.025);
  const float e = 0.015;
  vec2 flow = vec2(fbm(q + vec2(e, 0.0)) - fbm(q - vec2(e, 0.0)),
                   fbm(q + vec2(0.0, e)) - fbm(q - vec2(0.0, e))) / (2.0 * e);
  vec2 dir = normalize(vec2(0.9, 0.45) + flow * 0.5);

  // refraction wobble, strongest right on the melting edge
  float edge = 4.0 * frost * (1.0 - frost);
  vec2 baseUv = uv + flow * (0.006 * frost + 0.02 * edge) / asp;

  // ---- directional Gaussian frost (golden-angle spiral) -----------------
  float radius = uStrength * frost;
  // interleaved-gradient noise: fine, even dither instead of clumpy speckle
  vec2 px = floor(uv * resolution);
  float jitter = fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)))) * 6.2831853;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(SAMPLES));
    float a = fi * 2.39996323 + jitter;
    vec2 o = vec2(cos(a), sin(a)) * r;
    o += dir * dot(o, dir) * 1.4;                                // stretch along the flow
    float w = exp(-r * r * 2.2);
    acc += texture2D(inputBuffer, baseUv + o * radius / asp).rgb * w;
    wsum += w;
  }
  vec3 blurred = acc / wsum;

  // ---- milky tint, caustic sheen, bright melting rim --------------------
  float sheen = smoothstep(0.55, 0.92, fbm(uv * asp * 5.0 - uTime * 0.03));
  vec3 frosted = mix(blurred, blurred * 0.8 + uTint * 0.16, 0.6 * frost);
  frosted += uTint * (sheen * 0.04 + edge * 0.08);

  outputColor = vec4(mix(inputColor.rgb, frosted, smoothstep(0.0, 1.0, frost)), inputColor.a);
}
`

export class FrostBlurEffect extends Effect {
  constructor({ progress = 0, strength = 0.06, samples = 32, tint = '#cfd6e6' } = {}) {
    super('FrostBlurEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      defines: new Map([['SAMPLES', String(samples)]]),
      uniforms: new Map([
        ['uProgress', new Uniform(progress)],
        ['uStrength', new Uniform(strength)],
        ['uTime', new Uniform(0)],
        ['uTint', new Uniform(new Color(tint))],
        ['uCenter', new Uniform(new Vector2(0.5, 0.5))],
      ]),
    })
  }

  get progress() {
    return this.uniforms.get('uProgress').value
  }

  set progress(v) {
    this.uniforms.get('uProgress').value = v
  }

  update(_renderer, _inputBuffer, deltaTime) {
    this.uniforms.get('uTime').value += deltaTime
  }
}
