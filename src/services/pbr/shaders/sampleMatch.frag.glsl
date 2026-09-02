uniform sampler2D _MainTex;
uniform sampler2D _SampleBlurTex;
uniform vec3 _SampleColor1;
uniform float _HueWeight1;
uniform float _SatWeight1;
uniform float _LumWeight1;
uniform float _MaskLow1;
uniform float _MaskHigh1;
uniform float _SampleHeight1;
uniform float _UseSample1;
uniform float _IsolateSample1;
uniform vec3 _SampleColor2;
uniform float _HueWeight2;
uniform float _SatWeight2;
uniform float _LumWeight2;
uniform float _MaskLow2;
uniform float _MaskHigh2;
uniform float _SampleHeight2;
uniform float _UseSample2;
uniform float _IsolateSample2;
uniform float _SampleBlend;
uniform float _GamaCorrection;
varying vec2 vUv;

vec3 rgbToHsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) * 0.5;
  float s = 0.0;
  float h = 0.0;
  if (maxC != minC) {
    float d = maxC - minC;
    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float matchSample(vec3 pixelHSL, vec3 sampleHSL, float hueW, float satW, float lumW, float maskLow, float maskHigh) {
  float hueDif = 1.0 - min(min(abs(pixelHSL.x - sampleHSL.x),
    abs((pixelHSL.x + 1.0) - sampleHSL.x)),
    abs((pixelHSL.x - 1.0) - sampleHSL.x)) * 2.0;
  float satDif = 1.0 - abs(pixelHSL.y - sampleHSL.y);
  float lumDif = 1.0 - abs(pixelHSL.z - sampleHSL.z);
  float totalW = hueW + satW + lumW;
  float diff = (hueDif * hueW + satDif * satW + lumDif * lumW) / max(totalW, 0.001);
  return smoothstep(maskLow, maskHigh, diff);
}

void main() {
  vec3 mainColor = textureLod(_MainTex, vUv, 0.0).rgb;
  float grey = dot(mainColor, vec3(0.3, 0.5, 0.2));

  vec3 blurColor = textureLod(_SampleBlurTex, vUv, 0.0).rgb;
  vec3 blurHSL = rgbToHsl(blurColor);

  float heightVal = grey;

  if (_UseSample1 > 0.5) {
    vec3 s1HSL = rgbToHsl(_SampleColor1);
    float mask1 = matchSample(blurHSL, s1HSL, _HueWeight1, _SatWeight1, _LumWeight1, _MaskLow1, _MaskHigh1);
    if (_IsolateSample1 > 0.5) {
      gl_FragColor = vec4(vec3(mask1), 1.0);
      return;
    }
    heightVal = mix(heightVal, _SampleHeight1, mask1 * _SampleBlend);
  }

  if (_UseSample2 > 0.5) {
    vec3 s2HSL = rgbToHsl(_SampleColor2);
    float mask2 = matchSample(blurHSL, s2HSL, _HueWeight2, _SatWeight2, _LumWeight2, _MaskLow2, _MaskHigh2);
    if (_IsolateSample2 > 0.5) {
      gl_FragColor = vec4(vec3(mask2), 1.0);
      return;
    }
    heightVal = mix(heightVal, _SampleHeight2, mask2 * _SampleBlend);
  }

  heightVal = pow(clamp(heightVal, 0.0, 1.0), _GamaCorrection);
  gl_FragColor = vec4(vec3(heightVal), 1.0);
}
