uniform sampler2D _BlurTex0;
uniform sampler2D _BlurTex1;
uniform sampler2D _BlurTex2;
uniform sampler2D _BlurTex3;
uniform sampler2D _BlurTex4;
uniform sampler2D _BlurTex5;
uniform sampler2D _BlurTex6;
uniform float _Blur0Weight, _Blur1Weight, _Blur2Weight, _Blur3Weight;
uniform float _Blur4Weight, _Blur5Weight, _Blur6Weight;
uniform float _EdgeAmount;
uniform float _CreviceAmount;
uniform float _Pinch;
uniform float _Pillow;
uniform float _FinalContrast;
uniform float _FinalBias;
uniform float _Invert;
varying vec2 vUv;

void main() {
  float w = _Blur0Weight * _Blur0Weight * _Blur0Weight;
  float val = textureLod(_BlurTex0, vUv, 0.0).x * w;
  float w1 = _Blur1Weight * _Blur1Weight * _Blur1Weight; val += textureLod(_BlurTex1, vUv, 0.0).x * w1; w += w1;
  float w2 = _Blur2Weight * _Blur2Weight * _Blur2Weight; val += textureLod(_BlurTex2, vUv, 0.0).x * w2; w += w2;
  float w3 = _Blur3Weight * _Blur3Weight * _Blur3Weight; val += textureLod(_BlurTex3, vUv, 0.0).x * w3; w += w3;
  float w4 = _Blur4Weight * _Blur4Weight * _Blur4Weight; val += textureLod(_BlurTex4, vUv, 0.0).x * w4; w += w4;
  float w5 = _Blur5Weight * _Blur5Weight * _Blur5Weight; val += textureLod(_BlurTex5, vUv, 0.0).x * w5; w += w5;
  float w6 = _Blur6Weight * _Blur6Weight * _Blur6Weight; val += textureLod(_BlurTex6, vUv, 0.0).x * w6; w += w6;

  val *= 1.0 / max(w, 0.001);

  if (val > 0.5) {
    val = max(val * 2.0 - 1.0, 0.0);
    val = pow(val, _Pinch);
    val *= _EdgeAmount;
    val = val * 0.5 + 0.5;
  } else {
    val = max(-(val * 2.0 - 1.0), 0.0);
    val = pow(val, _Pinch);
    val *= _CreviceAmount;
    val = -val * 0.5 + 0.5;
  }

  val = (val - 0.5) * _FinalContrast + 0.5;
  val = pow(clamp(val, 0.0, 1.0), _Pillow);
  val = clamp(val + _FinalBias, 0.0, 1.0);

  if (_Invert > 0.5) val = 1.0 - val;
  gl_FragColor = vec4(vec3(val), 1.0);
}
