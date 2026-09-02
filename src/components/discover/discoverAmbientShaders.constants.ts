export type DiscoverAmbientTheme = 'light' | 'dark'

export const AMBIENT_FULLSCREEN_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;

out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

export const AMBIENT_TRAIL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D uPreviousTrail;
uniform vec2 uPointer;
uniform vec2 uPreviousPointer;
uniform vec2 uResolution;
uniform float uRadius;
uniform float uAmount;
uniform float uBloom;
uniform float uDecay;

out vec4 outColor;

const float TAU = 6.28318530718;

vec3 toLinear(vec3 color) {
  return color * color;
}

vec3 toGamma(vec3 color) {
  return sqrt(max(color, vec3(0.0)));
}

vec3 hsvToRgb(vec3 color) {
  vec4 offsets = vec4(1.0, 0.6666666667, 0.3333333333, 3.0);
  vec3 channels = abs(fract(color.xxx + offsets.xyz) * 6.0 - offsets.www);
  return color.z * mix(offsets.xxx, clamp(channels - offsets.xxx, 0.0, 1.0), color.y);
}

vec3 rgbToHsv(vec3 color) {
  vec4 offsets = vec4(0.0, -0.3333333333, 0.6666666667, -1.0);
  vec4 pair = mix(vec4(color.bg, offsets.wz), vec4(color.gb, offsets.xy), step(color.b, color.g));
  vec4 value = mix(vec4(pair.xyw, color.r), vec4(color.r, pair.yzx), step(pair.x, color.r));
  float delta = value.x - min(value.w, value.y);
  return vec3(abs(value.z + (value.w - value.y) / (6.0 * delta + 0.0000000001)), delta / (value.x + 0.0000000001), value.x);
}

vec2 directionFromHue(float hue) {
  float angle = hue * TAU;
  return vec2(cos(angle), sin(angle));
}

float trailIntensity(
  vec2 segmentStart,
  vec2 correctedUv,
  vec2 scaledDirection,
  float segmentLength,
  float aspect,
  float radius
) {
  vec2 offset = (correctedUv - segmentStart) * vec2(aspect, 1.0);
  float projection = clamp(dot(offset, scaledDirection), 0.0, segmentLength);
  vec2 closest = segmentStart * vec2(aspect, 1.0) + scaledDirection * projection;
  float distanceToTrail = length(correctedUv - closest);
  return (1.0 + radius) / (distanceToTrail + radius) * radius;
}

vec3 sampleBlurredTrail(vec2 uv) {
  const float blurRadius = 0.005;
  vec3 previous = toLinear(texture(uPreviousTrail, uv).rgb) * 0.2;
  previous += toLinear(texture(uPreviousTrail, uv + vec2(blurRadius, 0.0)).rgb) * 0.2;
  previous += toLinear(texture(uPreviousTrail, uv - vec2(blurRadius, 0.0)).rgb) * 0.2;
  previous += toLinear(texture(uPreviousTrail, uv + vec2(0.0, blurRadius)).rgb) * 0.2;
  previous += toLinear(texture(uPreviousTrail, uv - vec2(0.0, blurRadius)).rgb) * 0.2;
  return previous;
}

vec4 createDirectionalWake(vec2 correctedUv, float aspect) {
  vec2 pointerDelta = uPointer - uPreviousPointer;
  float pointerLength = length(pointerDelta);
  vec2 screenDelta = pointerDelta * vec2(aspect, 1.0);
  float distanceMoved = length(screenDelta);
  if (distanceMoved <= 0.001 || uAmount <= 0.001) return vec4(0.0);

  vec2 direction = pointerDelta / max(pointerLength, 0.000001);
  vec2 scaledDirection = direction * vec2(aspect, 1.0);
  float angle = atan(screenDelta.y, screenDelta.x);
  if (angle < 0.0) angle += TAU;
  vec3 wakeColor = toLinear(hsvToRgb(vec3(angle / TAU, 1.0, 1.0)));
  float bloomExponent = max(abs(10.0 * (1.0 - uBloom + 0.1)), 0.1);
  int pointCount = int(max(6.0, distanceMoved * 24.0));
  int iterations = min(pointCount, 16);
  float speedFactor = clamp(distanceMoved, 0.7, 1.3);
  float radius = mix(0.1, 0.7, clamp(uRadius * speedFactor, 0.0, 1.0));
  float segmentLength = pointerLength * aspect / float(pointCount);
  float intensity = trailIntensity(uPreviousPointer, correctedUv, scaledDirection, 0.0, aspect, radius);
  for (int index = 1; index <= 16; index++) {
    if (index > iterations) break;
    float amount = float(index - 1) / float(pointCount);
    vec2 segmentStart = mix(uPreviousPointer, uPointer, amount);
    intensity += trailIntensity(segmentStart, correctedUv, scaledDirection, segmentLength, aspect, radius);
  }
  wakeColor *= intensity / float(min(pointCount, 50) + 1);
  wakeColor = pow(max(wakeColor, vec3(0.0)), vec3(bloomExponent));
  float wakeMix = clamp(length(wakeColor) * distanceMoved, 0.0, 1.0);
  return vec4(wakeColor, wakeMix);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec3 previousSample = texture(uPreviousTrail, vUv).rgb;
  vec3 previousHsv = rgbToHsv(previousSample);
  float previousStrength = previousHsv.z * previousHsv.z;
  vec2 previousDirection = directionFromHue(previousHsv.x);
  vec2 advectedUv = vUv - previousDirection * (0.03 * previousStrength);
  vec3 previous = sampleBlurredTrail(advectedUv) * pow(abs(uDecay), 0.2);
  vec4 wake = createDirectionalWake(vUv * vec2(aspect, 1.0), aspect);
  vec3 draw = mix(previous, wake.rgb, wake.a);
  draw = max(toGamma(draw) - 0.01, vec3(0.0));
  outColor = vec4(draw, 1.0);
}
`

export const AMBIENT_THEME_PARAMS = {
  dark: {
    gradientColors: [
      [0, 0, 0],
      [0, 0, 0],
      [0.9411764706, 0.9411764706, 0.9411764706],
      [0.7176470588, 0.7176470588, 0.7176470588],
      [0, 0, 0],
    ],
    gradientStops: [0, 0.603125, 0.875, 0.921875, 1],
    gradientScale: 0.83,
    gradientAngle: 0.418,
    gradientPhase: 0.6,
    gradientRectness: 1,
    causticsScale: 0.05,
    causticsRefraction: 0,
    causticsAmbiance: 1,
    causticsSpeed: 6,
    fisheye: -0.3,
    gradientMapColors: [
      [0.0705882353, 0.0705882353, 0.0705882353],
      [0.4588235294, 0.4588235294, 0.4588235294],
      [0.4588235294, 0.4588235294, 0.4588235294],
      [0.5490196078, 0.5490196078, 0.5490196078],
    ],
    gradientMapStops: [0, 0.64375, 0.81875, 1],
    gradientMapScale: 0.37,
    gradientMapPhase: 0.49,
    glyphGamma: 0.4,
    glyphOpacity: 0.34,
    dotGap: 0.59,
    dotScale: 0.25,
    dotColor: [0, 1, 1],
    verticalOffset: 0.5,
    chromaticAberration: 1.7,
    hoverChromaticAberration: 0,
    hoverDotBoost: 0,
    vignette: 0,
    lightMode: 0,
    mouseRadius: 0.64,
    mouseAmount: 0.18,
    mouseBloom: 0.8,
    mouseDecay: 1,
  },
  light: {
    gradientColors: [
      [0, 0, 0],
      [0, 0, 0],
      [0.9411764706, 0.9411764706, 0.9411764706],
      [0.7176470588, 0.7176470588, 0.7176470588],
      [0, 0, 0],
    ],
    gradientStops: [0, 0.603125, 0.875, 0.921875, 1],
    gradientScale: 1,
    gradientAngle: 0.404,
    gradientPhase: 0.57,
    gradientRectness: 0.19,
    causticsScale: 0.05,
    causticsRefraction: 1,
    causticsAmbiance: 1,
    causticsSpeed: 9.3,
    fisheye: -0.47,
    gradientMapColors: [
      [0.9607843137, 0.9607843137, 0.9607843137],
      [0.862745098, 0.9411764706, 0.9568627451],
      [0.9568627451, 0.9607843137, 0.9647058824],
      [1, 1, 1],
    ],
    gradientMapStops: [0, 0.64375, 0.81875, 1],
    gradientMapScale: 0.37,
    gradientMapPhase: 0.49,
    glyphGamma: 0.4,
    glyphOpacity: 0.04,
    dotGap: 0.64,
    dotScale: 0.17,
    dotColor: [0.78, 0.84, 0.88],
    verticalOffset: 0.5,
    chromaticAberration: 1.7,
    hoverChromaticAberration: 0.22,
    hoverDotBoost: 0,
    vignette: 0,
    lightMode: 1,
    mouseRadius: 0.5,
    mouseAmount: 0.35,
    mouseBloom: 1,
    mouseDecay: 1,
  },
} as const
