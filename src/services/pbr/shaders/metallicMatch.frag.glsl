uniform sampler2D _MainTex;
uniform sampler2D _BlurTex;
uniform sampler2D _OverlayBlurTex;
uniform float _BlurOverlay;
uniform float _FinalContrast;
uniform float _FinalBias;
uniform float _Invert;
uniform vec3 _MetalColor;
uniform float _HueWeight;
uniform float _SatWeight;
uniform float _LumWeight;
uniform float _MaskLow;
uniform float _MaskHigh;
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

void main() {
  vec3 mainTex = textureLod(_MainTex, vUv, 0.0).xyz;
  vec3 blurTex = textureLod(_BlurTex, vUv, 0.0).xyz;
  vec3 overlayBlurTex = textureLod(_OverlayBlurTex, vUv, 0.0).xyz;

  vec3 overlay = mainTex - overlayBlurTex;
  float overlayGrey = overlay.x * 0.3 + overlay.y * 0.5 + overlay.z * 0.2;

  vec3 blurHSL = rgbToHsl(blurTex);
  vec3 metalHSL = rgbToHsl(_MetalColor);

  float hueDif = 1.0 - min(min(abs(blurHSL.x - metalHSL.x),
    abs((blurHSL.x + 1.0) - metalHSL.x)),
    abs((blurHSL.x - 1.0) - metalHSL.x)) * 2.0;
  float satDif = 1.0 - abs(blurHSL.y - metalHSL.y);
  float lumDif = 1.0 - abs(blurHSL.z - metalHSL.z);

  float totalW = _HueWeight + _SatWeight + _LumWeight;
  float finalDiff = (hueDif * _HueWeight + satDif * _SatWeight + lumDif * _LumWeight) / max(totalW, 0.001);
  finalDiff = smoothstep(_MaskLow, _MaskHigh, finalDiff);

  finalDiff = clamp((finalDiff - 0.5) * _FinalContrast + 0.5 + _FinalBias, 0.0, 1.0);
  finalDiff *= clamp((overlayGrey * _BlurOverlay) + 1.0, 0.0, 10.0);
  finalDiff = clamp(finalDiff, 0.0, 1.0);

  if (_Invert > 0.5) finalDiff = 1.0 - finalDiff;
  gl_FragColor = vec4(vec3(finalDiff), 1.0);
}
