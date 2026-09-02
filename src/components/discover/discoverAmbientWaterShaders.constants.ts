export const AMBIENT_WATER_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;

uniform sampler2D uTrailTexture;
uniform vec2 uResolution;
uniform float uFlowTime;

uniform vec2 uGradientPosition;
uniform float uGradientScale;
uniform float uGradientAngle;
uniform float uGradientPhase;
uniform float uGradientRectness;
uniform vec3 uGradientColor0;
uniform vec3 uGradientColor1;
uniform vec3 uGradientColor2;
uniform vec3 uGradientColor3;
uniform vec3 uGradientColor4;
uniform float uGradientStop0;
uniform float uGradientStop1;
uniform float uGradientStop2;
uniform float uGradientStop3;
uniform float uGradientStop4;

uniform vec2 uCausticsPosition;
uniform float uCausticsScale;
uniform float uCausticsRefraction;
uniform float uCausticsAmbiance;
uniform float uCausticsFisheye;

uniform vec2 uGradientMapPosition;
uniform float uGradientMapScale;
uniform float uGradientMapPhase;
uniform vec3 uGradientMapColor0;
uniform vec3 uGradientMapColor1;
uniform vec3 uGradientMapColor2;
uniform vec3 uGradientMapColor3;
uniform float uGradientMapStop0;
uniform float uGradientMapStop1;
uniform float uGradientMapStop2;
uniform float uGradientMapStop3;

uniform float uMouseBlendAmount;
uniform float uMouseBlendActive;

out vec4 outColor;

const float TAU = 6.28318530718;

uvec2 pcg2d(uvec2 value) {
  value = value * 1664525u + 1013904223u;
  value.x += value.y * value.y * 1664525u + 1013904223u;
  value.y += value.x * value.x * 1664525u + 1013904223u;
  value ^= value >> 16;
  value.x += value.y * value.y * 1664525u + 1013904223u;
  value.y += value.x * value.x * 1664525u + 1013904223u;
  return value;
}

float deband() {
  uvec2 value = pcg2d(floatBitsToUint(gl_FragCoord.xy));
  return (float(value.x ^ value.y) / float(0xffffffffu) - 0.5) / 255.0;
}

vec3 linearFromSrgb(vec3 color) {
  return pow(max(color, vec3(0.0)), vec3(2.2));
}

vec3 srgbFromLinear(vec3 color) {
  return pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
}

vec3 safeCbrt(vec3 value) {
  return sign(value) * pow(abs(value), vec3(1.0 / 3.0));
}

vec3 oklabMix(vec3 colorA, vec3 colorB, float amount, float chromaLift) {
  const mat3 coneToLms = mat3(
    0.4121656120, 0.2118591070, 0.0883097947,
    0.5362752080, 0.6807189584, 0.2818474174,
    0.0514575653, 0.1074065790, 0.6302613616
  );
  const mat3 lmsToCone = mat3(
    4.0767245293, -1.2681437731, -0.0041119885,
    -3.3072168827, 2.6093323231, -0.7034763098,
    0.2307590544, -0.3411344290, 1.7068625689
  );
  vec3 lmsA = safeCbrt(coneToLms * linearFromSrgb(colorA));
  vec3 lmsB = safeCbrt(coneToLms * linearFromSrgb(colorB));
  vec3 lms = mix(lmsA, lmsB, amount);
  lms *= 1.0 + chromaLift * amount * (1.0 - amount);
  return srgbFromLinear(lmsToCone * (lms * lms * lms));
}

vec3 gradientSegment(
  float position,
  float start,
  float end,
  vec3 colorA,
  vec3 colorB,
  float chromaLift
) {
  float amount = clamp((position - start) / max(end - start, 0.00001), 0.0, 1.0);
  return oklabMix(colorA, colorB, amount, chromaLift);
}

vec3 sampleBaseGradient(float position) {
  position = clamp(position, 0.0, 1.0);
  if (position <= uGradientStop1) {
    return gradientSegment(position, uGradientStop0, uGradientStop1, uGradientColor0, uGradientColor1, 0.025);
  }
  if (position <= uGradientStop2) {
    return gradientSegment(position, uGradientStop1, uGradientStop2, uGradientColor1, uGradientColor2, 0.025);
  }
  if (position <= uGradientStop3) {
    return gradientSegment(position, uGradientStop2, uGradientStop3, uGradientColor2, uGradientColor3, 0.025);
  }
  return gradientSegment(position, uGradientStop3, uGradientStop4, uGradientColor3, uGradientColor4, 0.025);
}

vec3 sampleMappedGradient(float position) {
  position = clamp(position, 0.0, 1.0);
  if (position <= uGradientMapStop1) {
    return gradientSegment(position, uGradientMapStop0, uGradientMapStop1, uGradientMapColor0, uGradientMapColor1, 0.02);
  }
  if (position <= uGradientMapStop2) {
    return gradientSegment(position, uGradientMapStop1, uGradientMapStop2, uGradientMapColor1, uGradientMapColor2, 0.02);
  }
  return gradientSegment(position, uGradientMapStop2, uGradientMapStop3, uGradientMapColor2, uGradientMapColor3, 0.02);
}

mat2 rotate2d(float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, sine, -sine, cosine);
}

float baseGradientPosition(vec2 uv) {
  vec2 point = uv - uGradientPosition;
  point /= max(uGradientScale * 2.0, 0.00001);
  point = rotate2d((uGradientAngle - 0.5) * TAU) * point;
  float exponent = mix(2.0, 20.0, uGradientRectness);
  float radial = pow(
    pow(abs(point.x), exponent) + pow(abs(point.y), exponent),
    1.0 / exponent
  );
  return fract(radial - uGradientPhase);
}

// CC0 BCC derivative noise based on Stefan Gustavson's lattice-noise work.
vec4 permute(vec4 value) {
  return value * (value * 34.0 + 133.0);
}

vec3 gradientDirection(float hash) {
  vec3 cube = mod(floor(hash / vec3(1.0, 2.0, 4.0)), 2.0) * 2.0 - 1.0;
  vec3 cuboct = cube;
  float index0 = step(0.0, 1.0 - floor(hash / 16.0));
  float index1 = step(0.0, floor(hash / 16.0) - 1.0);
  cuboct.x *= 1.0 - index0;
  cuboct.y *= 1.0 - index1;
  cuboct.z *= index0 + index1;
  float type = mod(floor(hash / 8.0), 2.0);
  vec3 rhomb = mix(cube, cuboct + cross(cube, cuboct), type);
  vec3 direction = cuboct * 1.22474487139 + rhomb;
  return direction * (1.0 - 0.042942436724648037 * type) * 3.5946317686139184;
}

vec4 bccNoiseDerivativesPart(vec3 point) {
  vec3 base = floor(point);
  vec4 offset = vec4(point - base, 2.5);
  vec3 vertex1 = base + floor(dot(offset, vec4(0.25)));
  vec3 vertex2 = base + vec3(1.0, 0.0, 0.0)
    + vec3(-1.0, 1.0, 1.0) * floor(dot(offset, vec4(-0.25, 0.25, 0.25, 0.35)));
  vec3 vertex3 = base + vec3(0.0, 1.0, 0.0)
    + vec3(1.0, -1.0, 1.0) * floor(dot(offset, vec4(0.25, -0.25, 0.25, 0.35)));
  vec3 vertex4 = base + vec3(0.0, 0.0, 1.0)
    + vec3(1.0, 1.0, -1.0) * floor(dot(offset, vec4(0.25, 0.25, -0.25, 0.35)));

  vec4 hashes = permute(mod(vec4(vertex1.x, vertex2.x, vertex3.x, vertex4.x), 289.0));
  hashes = permute(mod(hashes + vec4(vertex1.y, vertex2.y, vertex3.y, vertex4.y), 289.0));
  hashes = mod(
    permute(mod(hashes + vec4(vertex1.z, vertex2.z, vertex3.z, vertex4.z), 289.0)),
    48.0
  );

  vec3 delta1 = point - vertex1;
  vec3 delta2 = point - vertex2;
  vec3 delta3 = point - vertex3;
  vec3 delta4 = point - vertex4;
  vec4 kernel = max(
    0.75 - vec4(dot(delta1, delta1), dot(delta2, delta2), dot(delta3, delta3), dot(delta4, delta4)),
    0.0
  );
  vec4 kernel2 = kernel * kernel;
  vec4 kernel4 = kernel2 * kernel2;
  vec3 gradient1 = gradientDirection(hashes.x);
  vec3 gradient2 = gradientDirection(hashes.y);
  vec3 gradient3 = gradientDirection(hashes.z);
  vec3 gradient4 = gradientDirection(hashes.w);
  vec4 extrapolation = vec4(
    dot(delta1, gradient1),
    dot(delta2, gradient2),
    dot(delta3, gradient3),
    dot(delta4, gradient4)
  );
  vec3 derivative = -8.0 * mat4x3(delta1, delta2, delta3, delta4)
    * (kernel2 * kernel * extrapolation)
    + mat4x3(gradient1, gradient2, gradient3, gradient4) * kernel4;
  return vec4(derivative, dot(kernel4, extrapolation));
}

vec4 bccNoiseDerivativesXyBeforeZ(vec3 point) {
  const mat3 orthonormalMap = mat3(
    0.788675134594813, -0.211324865405187, -0.577350269189626,
    -0.211324865405187, 0.788675134594813, -0.577350269189626,
    0.577350269189626, 0.577350269189626, 0.577350269189626
  );
  vec3 mapped = orthonormalMap * point;
  vec4 result = bccNoiseDerivativesPart(mapped)
    + bccNoiseDerivativesPart(mapped + 144.5);
  return vec4(result.xyz * orthonormalMap, result.w);
}

vec4 getCausticsNoise(vec3 point) {
  vec4 noise = bccNoiseDerivativesXyBeforeZ(point);
  return mix(noise, (noise + 0.5) * 0.5, uCausticsAmbiance);
}

float causticsField(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 point = (uv - uCausticsPosition) * vec2(aspect, 1.0);
  point *= 16.0 * uCausticsScale;
  vec2 fisheyePoint = point - 0.5;
  float fisheyeScale = 1.0 - uCausticsFisheye * dot(fisheyePoint, fisheyePoint) * 0.85;
  point = 0.5 + fisheyePoint * fisheyeScale;

  vec3 domain = vec3(point, uFlowTime * 0.05);
  float refraction = mix(0.25, 1.3, uCausticsRefraction);
  vec4 noise = getCausticsNoise(domain);
  vec4 balance = getCausticsNoise(domain - vec3(noise.xyz / 32.0) * refraction);
  noise = getCausticsNoise(domain - vec3(balance.xyz / 16.0) * refraction);
  float normalized = pow(0.5 + 0.5 * noise.w, 2.0);
  return (0.5 + 0.5 * balance.w) * (0.2 + 0.8 * normalized);
}

float mouseTrailStrength(vec2 uv) {
  vec3 trail = texture(uTrailTexture, uv).rgb;
  return max(max(trail.r, trail.g), trail.b);
}

vec3 applyMouseTrail(vec3 water, float trail, float noise) {
  if (uMouseBlendActive <= 0.5 || trail <= 0.0) return water;
  float strength = trail * uMouseBlendAmount * 5.0;
  vec3 reflectedLight = vec3(strength * 0.9333333333 + noise);
  vec3 screened = 1.0 - (1.0 - reflectedLight) * (1.0 - water);
  return mix(water, screened, trail);
}

vec3 applyGradientMap(vec3 water, float noise) {
  float luminance = dot(water, vec3(0.299, 0.587, 0.114));
  float position = smoothstep(0.0, 1.0, luminance) * (uGradientMapScale * 2.0);
  float offset = (uGradientMapPosition.x * uGradientMapPosition.y + uGradientMapPhase + 0.0001) * 2.0;
  return sampleMappedGradient(clamp(fract(position - offset), 0.0, 1.0)) + noise;
}

void main() {
  float noise = deband();
  vec3 base = clamp(sampleBaseGradient(baseGradientPosition(vUv)) + noise, 0.0, 1.0);
  vec3 water = clamp(base - vec3(causticsField(vUv)), 0.0, 1.0);
  if (uMouseBlendActive > 0.5) {
    water = applyMouseTrail(water, mouseTrailStrength(vUv), noise);
  }
  outColor = vec4(clamp(applyGradientMap(water, noise), 0.0, 1.0), 1.0);
}
`

export const AMBIENT_FINAL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D uWaterTexture;
uniform sampler2D uTrailTexture;
uniform vec2 uResolution;
uniform vec2 uDotPosition;
uniform vec3 uDotColor;
uniform float uDotGap;
uniform float uDotScale;
uniform float uGlyphGamma;
uniform float uGlyphOpacity;
uniform float uChromaticAberration;
uniform float uHoverChromaticAberration;
uniform float uHoverDotBoost;
uniform float uVignette;
uniform float uLightMode;
uniform float uTrailActive;

out vec4 outColor;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec2 mirrorUv(vec2 uv) {
  return 1.0 - abs(mod(uv, 2.0) - 1.0);
}

float trailStrength() {
  if (uTrailActive <= 0.5) return 0.0;
  vec3 trail = texture(uTrailTexture, vUv).rgb;
  return smoothstep(0.02, 0.45, max(max(trail.r, trail.g), trail.b));
}

vec3 sampleChromatic(vec2 uv, float hoverStrength) {
  vec2 centered = uv - 0.5;
  float edgeStrength = 1.0 + dot(centered, centered) * 8.0;
  float amount = uChromaticAberration + uHoverChromaticAberration * hoverStrength;
  vec2 offset = vec2(amount * 3.0 * edgeStrength / max(uResolution.x, 1.0), 0.0);
  vec3 center = texture(uWaterTexture, uv).rgb;
  return vec3(
    texture(uWaterTexture, mirrorUv(uv + offset)).r,
    center.g,
    texture(uWaterTexture, mirrorUv(uv - offset)).b
  );
}

vec2 dotCellSize() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float aspectCorrection = mix(aspect, 1.0 / aspect, 0.5);
  float gridSize = mix(0.05, 0.005, 1.0 - uDotGap);
  return vec2(gridSize / aspect, gridSize) * aspectCorrection;
}

float dotMask(vec2 uv, vec2 cellSize, float luminance, float hoverStrength) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 cellIndex = floor((uv - uDotPosition) / cellSize);
  vec2 cellCenter = (cellIndex + 0.5) * cellSize + uDotPosition;
  vec2 delta = uv - cellCenter;
  vec2 screenDelta = vec2(delta.x * aspect, delta.y);
  float exponent = mix(0.4, 1.5, uGlyphGamma);
  float dotsLuma = pow(clamp(luminance, 0.0, 1.0), exponent);
  dotsLuma = clamp(mix(dotsLuma, 1.0, hoverStrength * uHoverDotBoost), 0.0, 1.0);
  float cellLimit = min(cellSize.x * aspect, cellSize.y) * 0.5;
  float radius = mix(0.12, 0.92, dotsLuma) * clamp(uDotScale, 0.05, 2.0) * cellLimit;
  return 1.0 - smoothstep(max(radius * 0.82, 0.0), radius, length(screenDelta));
}

vec3 blendDots(vec3 background, vec3 pixelColor, float mask) {
  vec3 darkDots = pixelColor * 1.4 * mask;
  vec3 lightDots = uDotColor * mask;
  vec3 dotLayer = mix(darkDots, lightDots, uLightMode);
  vec3 screenBlend = 1.0 - (1.0 - dotLayer) * (1.0 - background);
  vec3 differenceBlend = abs(background - dotLayer);
  vec3 blended = mix(screenBlend, differenceBlend, uLightMode);
  return mix(background, blended, uGlyphOpacity);
}

void main() {
  float hoverStrength = trailStrength();
  vec2 cellSize = dotCellSize();
  vec2 cellIndex = floor((vUv - uDotPosition) / cellSize);
  vec2 pixelUv = (cellIndex + 0.5) * cellSize + uDotPosition;
  vec3 background = sampleChromatic(vUv, hoverStrength);
  vec3 pixelColor = sampleChromatic(pixelUv, hoverStrength);
  float mask = dotMask(vUv, cellSize, dot(pixelColor, LUMA), hoverStrength);
  float minCellPixels = min(cellSize.x * uResolution.x, cellSize.y * uResolution.y);
  mask = mix(mask, smoothstep(0.0, 1.0, mask), smoothstep(6.0, 10.0, minCellPixels));
  vec3 color = blendDots(background, pixelColor, mask);
  vec2 centered = vUv - 0.5;
  float vignetteFactor = 1.0 - smoothstep(0.35, 1.05, length(centered) * 1.41421356);
  color *= mix(1.0, vignetteFactor, uVignette);
  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`
