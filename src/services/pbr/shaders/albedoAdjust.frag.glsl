uniform sampler2D _MainTex;
uniform float _Brightness;
uniform float _Contrast;
uniform float _Invert;
uniform float _Exposure;
uniform float _ExposureOffset;
uniform float _ExposureGamma;
uniform float _ColorBalanceR;
uniform float _ColorBalanceG;
uniform float _ColorBalanceB;
uniform float _ColorBalancePreserveLuma;
uniform float _BlackAndWhite;
uniform float _LevelsMin;
uniform float _LevelsMax;
uniform float _LevelsMid;
uniform float _LevelsOutMin;
uniform float _LevelsOutMax;
uniform float _Hue;
uniform float _Saturation;
uniform float _Lightness;
uniform float _Vibrance;
uniform float _Colorize;
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
  vec4 tex = textureLod(_MainTex, vUv, 0.0);
  vec3 c = tex.rgb;

  // 1. Invert
  if (_Invert > 0.5) {
    c = 1.0 - c;
  }

  // 2. Exposure + Offset + Gamma
  float expFactor = pow(2.0, _Exposure / 20.0);
  c = pow(max(vec3(0.0), c + vec3(_ExposureOffset)), vec3(1.0 / max(_ExposureGamma, 0.01))) * expFactor;

  // 3. Color Balance
  if (abs(_ColorBalanceR) > 0.001 || abs(_ColorBalanceG) > 0.001 || abs(_ColorBalanceB) > 0.001) {
    float lumaOrig = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
    c.r += (_ColorBalanceR / 100.0) * 0.5;
    c.g += (_ColorBalanceG / 100.0) * 0.5;
    c.b += (_ColorBalanceB / -100.0) * 0.5;
    if (_ColorBalancePreserveLuma > 0.5) {
      float lumaNew = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
      float dl = lumaOrig - lumaNew;
      c += vec3(dl);
    }
  }

  // 4. Black & White
  if (_BlackAndWhite > 0.5) {
    float grey = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
    c = vec3(grey);
  }

  // 5. Brightness / Contrast (operating in 0-255 scale)
  c *= 255.0;
  float cf = (259.0 * (_Contrast + 255.0)) / (255.0 * (259.0 - _Contrast));
  c = cf * (c - 128.0) + 128.0 + _Brightness;

  // 6. Levels
  float lRange = max(1.0, _LevelsMax - _LevelsMin);
  float outRange = _LevelsOutMax - _LevelsOutMin;
  c = clamp(c, 0.0, 255.0);
  c = (c - _LevelsMin) / lRange;
  c = clamp(c, 0.0, 1.0);
  if (abs(_LevelsMid - 1.0) > 0.001) {
    c = pow(c, vec3(1.0 / max(_LevelsMid, 0.01)));
  }
  c = c * outRange + _LevelsOutMin;

  // Clamp before HSL
  c = clamp(c, 0.0, 255.0);

  // 8. Hue / Saturation / Lightness / Vibrance / Colorize
  if (abs(_Hue) > 0.001 || abs(_Saturation) > 0.001 || abs(_Vibrance) > 0.001 || abs(_Lightness) > 0.001 || _Colorize > 0.5) {
    vec3 n = c / 255.0;
    vec3 hsl = rgbToHsl(n);

    if (_Colorize > 0.5) {
      hsl.x = (_Hue + 180.0) / 360.0;
      hsl.y = clamp((_Saturation + 100.0) / 200.0, 0.0, 1.0);
    } else {
      hsl.x = mod(hsl.x + _Hue / 360.0, 1.0);
      if (hsl.x < 0.0) hsl.x += 1.0;
      hsl.y += _Saturation / 100.0;
    }

    if (abs(_Vibrance) > 0.001) {
      float vAmt = _Vibrance / 100.0;
      hsl.y += vAmt * (1.0 - hsl.y);
    }

    hsl.z += _Lightness / 100.0;
    hsl.y = clamp(hsl.y, 0.0, 1.0);
    hsl.z = clamp(hsl.z, 0.0, 1.0);

    c = hslToRgb(hsl) * 255.0;
  }

  c = clamp(c, 0.0, 255.0);
  gl_FragColor = vec4(c / 255.0, tex.a);
}
