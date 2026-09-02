uniform sampler2D _MainTex;
uniform sampler2D _AvgTex;
uniform sampler2D _BlurTex0;
uniform sampler2D _BlurTex1;
uniform sampler2D _BlurTex2;
uniform sampler2D _BlurTex3;
uniform sampler2D _BlurTex4;
uniform sampler2D _BlurTex5;
uniform sampler2D _BlurTex6;
uniform float _Blur0Weight, _Blur1Weight, _Blur2Weight, _Blur3Weight;
uniform float _Blur4Weight, _Blur5Weight, _Blur6Weight;
uniform float _Blur0Contrast, _Blur1Contrast, _Blur2Contrast, _Blur3Contrast;
uniform float _Blur4Contrast, _Blur5Contrast, _Blur6Contrast;
uniform float _FinalContrast;
uniform float _FinalBias;
uniform float _FinalGain;
uniform float _Invert;
varying vec2 vUv;

void main() {
  float avgColor = pow(textureLod(_AvgTex, vUv, 0.0).x, 0.45);

  vec4 h = vec4((pow(textureLod(_BlurTex0, vUv, 0.0).xyz, vec3(0.45)) - avgColor) * _Blur0Contrast + 0.5, 1.0) * _Blur0Weight;
  h += vec4((pow(textureLod(_BlurTex1, vUv, 0.0).xyz, vec3(0.45)) - avgColor) * _Blur1Contrast + 0.5, 1.0) * _Blur1Weight;
  h += vec4((pow(textureLod(_BlurTex2, vUv, 0.0).xyz, vec3(0.45)) - avgColor) * _Blur2Contrast + 0.5, 1.0) * _Blur2Weight;
  h += vec4((pow(textureLod(_BlurTex3, vUv, 0.0).xyz, vec3(0.45)) - avgColor) * _Blur3Contrast + 0.5, 1.0) * _Blur3Weight;
  h += vec4((pow(textureLod(_BlurTex4, vUv, 0.0).xyz, vec3(0.45)) - avgColor) * _Blur4Contrast + 0.5, 1.0) * _Blur4Weight;
  h += vec4((pow(textureLod(_BlurTex5, vUv, 0.0).xyz, vec3(0.45)) - avgColor) * _Blur5Contrast + 0.5, 1.0) * _Blur5Weight;
  h += vec4((pow(textureLod(_BlurTex6, vUv, 0.0).xyz, vec3(0.45)) - avgColor) * _Blur6Contrast + 0.5, 1.0) * _Blur6Weight;

  h *= 1.0 / max(h.w, 0.001);

  float val = clamp((h.x - 0.5) * _FinalContrast + 0.5 + _FinalBias, 0.0, 1.0);

  if (val > 0.5) {
    val = pow(clamp(val * 2.0 - 1.0, 0.0, 1.0), _FinalGain) * 0.5 + 0.5;
  } else {
    val = 1.0 - (pow(clamp((1.0 - val) * 2.0 - 1.0, 0.0, 1.0), _FinalGain) * 0.5 + 0.5);
  }

  if (_Invert > 0.5) val = 1.0 - val;
  gl_FragColor = vec4(vec3(val), 1.0);
}
