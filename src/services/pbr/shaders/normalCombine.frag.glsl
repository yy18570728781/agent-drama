uniform sampler2D _BlurTex0;
uniform sampler2D _BlurTex1;
uniform sampler2D _BlurTex2;
uniform sampler2D _BlurTex3;
uniform sampler2D _BlurTex4;
uniform sampler2D _BlurTex5;
uniform sampler2D _BlurTex6;
uniform float _Blur0Weight, _Blur1Weight, _Blur2Weight, _Blur3Weight;
uniform float _Blur4Weight, _Blur5Weight, _Blur6Weight;
uniform float _Angularity;
uniform float _AngularIntensity;
uniform float _FinalContrast;
uniform float _FlipNormalY;
varying vec2 vUv;

vec3 decodeNormal(sampler2D tex, vec2 uv) {
  return textureLod(tex, uv, 0.0).xyz * 2.0 - 1.0;
}

void main() {
  vec4 n = vec4(decodeNormal(_BlurTex0, vUv), 1.0) * _Blur0Weight;
  n += vec4(decodeNormal(_BlurTex1, vUv), 1.0) * _Blur1Weight;
  n += vec4(decodeNormal(_BlurTex2, vUv), 1.0) * _Blur2Weight;
  n += vec4(decodeNormal(_BlurTex3, vUv), 1.0) * _Blur3Weight;
  n += vec4(decodeNormal(_BlurTex4, vUv), 1.0) * _Blur4Weight;
  n += vec4(decodeNormal(_BlurTex5, vUv), 1.0) * _Blur5Weight;
  n += vec4(decodeNormal(_BlurTex6, vUv), 1.0) * _Blur6Weight;

  n *= 1.0 / max(n.w, 0.001);
  vec3 normalTex = normalize(n.xyz);

  vec3 angularDir = normalize(vec3(
    normalize(vec3(normalTex.xy, 0.001)).xy * _AngularIntensity,
    max(1.0 - _AngularIntensity, 0.001)
  ));
  normalTex = mix(normalTex, angularDir, _Angularity);

  normalTex.xy = normalTex.xy * _FinalContrast;
  normalTex.z = pow(clamp(normalTex.z, 0.0, 1.0), _FinalContrast);
  normalTex = normalize(normalTex) * 0.5 + 0.5;

  if (_FlipNormalY < 0.5) normalTex.y = 1.0 - normalTex.y;
  gl_FragColor = vec4(normalTex, 1.0);
}
