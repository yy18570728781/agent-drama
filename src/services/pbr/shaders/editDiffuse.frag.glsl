uniform sampler2D _MainTex;
uniform sampler2D _BlurTex;
uniform sampler2D _AvgTex;
uniform float _BlurContrast;
uniform float _LightMaskPow;
uniform float _LightPow;
uniform float _DarkMaskPow;
uniform float _DarkPow;
uniform float _HotSpot;
uniform float _DarkSpot;
uniform float _FinalContrast;
uniform float _FinalBias;
uniform float _ColorLerp;
uniform float _Saturation;
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

float hueToRgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0 / 2.0) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

vec3 hslToRgb(vec3 c) {
  if (c.y == 0.0) return vec3(c.z);
  float q = c.z < 0.5 ? c.z * (1.0 + c.y) : c.z + c.y - c.z * c.y;
  float p = 2.0 * c.z - q;
  return vec3(
    hueToRgb(p, q, c.x + 1.0 / 3.0),
    hueToRgb(p, q, c.x),
    hueToRgb(p, q, c.x - 1.0 / 3.0)
  );
}

void main() {
  vec3 mainTex = textureLod(_MainTex, vUv, 0.0).xyz;
  vec3 blurTex = textureLod(_BlurTex, vUv, 0.0).xyz;
  vec3 avgColor = textureLod(_AvgTex, vUv, 0.0).xyz;

  vec3 overlay = mainTex - blurTex;
  vec3 initialHSL = rgbToHsl(mainTex);

  float avgLum = mainTex.x * 0.3 + mainTex.y * 0.5 + mainTex.z * 0.2;

  float lightMask = smoothstep(1.0 - _HotSpot, (1.0 - _HotSpot) + pow(_HotSpot, 0.5) + 0.01, avgLum);
  float darkMask = smoothstep(_DarkSpot - pow(_DarkSpot, 0.5) - 0.01, _DarkSpot, avgLum);

  mainTex = mix(mainTex, avgColor, 1.0 - (1.0 - lightMask) * darkMask);

  float lmp = clamp((_LightMaskPow - 0.5) * 2.0, 0.0, 1.0) + 1.0;
  lmp -= 1.0 - (1.0 / (clamp((_LightMaskPow - 0.5) * -2.0, 0.0, 1.0) + 1.0));
  float dmp = clamp((_DarkMaskPow - 0.5) * 2.0, 0.0, 1.0) + 1.0;
  dmp -= 1.0 - (1.0 / (clamp((_DarkMaskPow - 0.5) * -2.0, 0.0, 1.0) + 1.0));

  mainTex = mainTex - avgColor;
  float mainGrey = mainTex.x * 0.3 + mainTex.y * 0.5 + mainTex.z * 0.2;

  float highMask = pow(clamp(mainGrey * 2.0, 0.001, 0.99), lmp);
  float lowMask = pow(clamp(-mainGrey * 2.0, 0.001, 0.99), dmp);
  mainTex += 0.5;

  mainTex = mix(mainTex, mainTex * (1.0 - _LightPow), highMask);
  mainTex = mix(mainTex, 1.0 - (1.0 - mainTex) * (1.0 - _DarkPow), lowMask);

  float desaturateMask = highMask * _LightPow;
  desaturateMask += lowMask * _DarkPow * 2.0;
  desaturateMask += 1.0 - (1.0 - lightMask) * darkMask;
  desaturateMask = 1.0 - clamp(desaturateMask, 0.0, 1.0);

  float overlayMask = 1.0 - (1.0 - highMask * _LightPow) * (1.0 - lowMask * _DarkPow);
  overlayMask = clamp(overlayMask * 2.0 + 0.1, 0.0, 1.0);
  mainTex *= mix(vec3(1.0), overlay * _BlurContrast * 10.0 + 1.0, overlayMask);
  mainTex = clamp(mainTex, 0.0, 1.0);

  vec3 processedHSL = rgbToHsl(mainTex);
  processedHSL.xy = initialHSL.xy;
  vec3 originalColor = hslToRgb(processedHSL);
  mainTex = mix(mainTex, originalColor, _ColorLerp * desaturateMask);

  mainTex = clamp((mainTex - 0.5) * _FinalContrast + 0.5 + _FinalBias, 0.0, 1.0);
  float luma = mainTex.x * 0.3 + mainTex.y * 0.5 + mainTex.z * 0.2;
  mainTex = mix(vec3(luma), mainTex, _Saturation);

  gl_FragColor = vec4(mainTex, 1.0);
}
