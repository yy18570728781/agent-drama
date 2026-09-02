uniform sampler2D _MainTex;
uniform sampler2D _Blurred;
uniform sampler2D _MetallicTex;
uniform float _Overlay;
uniform float _MetalSmoothness;
uniform float _BaseSmoothness;
uniform float _FinalContrast;
uniform float _FinalBias;
uniform float _Invert;
varying vec2 vUv;

void main() {
  float luma = dot(textureLod(_MainTex, vUv, 0.0).rgb, vec3(0.3, 0.5, 0.2));
  float blurred = dot(textureLod(_Blurred, vUv, 0.0).rgb, vec3(0.3, 0.5, 0.2));
  float diff = (luma - blurred) * _Overlay;
  float val = luma + diff;

  float metalMask = textureLod(_MetallicTex, vUv, 0.0).r;
  val = mix(mix(_BaseSmoothness, val, 0.5), _MetalSmoothness, metalMask);

  val = (val - 0.5) * _FinalContrast + 0.5 + _FinalBias * 0.5;
  val = clamp(val, 0.0, 1.0);
  if (_Invert > 0.5) val = 1.0 - val;
  gl_FragColor = vec4(vec3(val), 1.0);
}
