uniform sampler2D _MainTex;
uniform vec2 _BlurDirection;
uniform float _BlurSpread;
uniform int _BlurSamples;
uniform vec2 _TexelSize;
uniform float _BlurContrast;
uniform int _Desaturate;
varying vec2 vUv;

void main() {
  int totalSamples = _BlurSamples * 2;
  vec4 mainTex = vec4(0.0);
  for (int i = -64; i <= 64; i++) {
    if (i < -_BlurSamples || i > _BlurSamples) continue;
    float weight = cos((float(i) / float(max(totalSamples, 1))) * 6.28318530718) * 0.5 + 0.5;
    vec4 sampleTex = textureLod(_MainTex, vUv + _TexelSize * _BlurDirection * float(i) * _BlurSpread, 0.0);
    if (_Desaturate > 0) {
      sampleTex.xyz = vec3(sampleTex.x * 0.3 + sampleTex.y * 0.5 + sampleTex.z * 0.2);
    }
    mainTex += vec4(sampleTex.xyz * weight, weight);
  }
  mainTex.xyz *= 1.0 / max(mainTex.w, 0.001);
  mainTex.xyz = clamp((mainTex.xyz - 0.5) * _BlurContrast + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(mainTex.xyz, 1.0);
}
