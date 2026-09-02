uniform sampler2D _MainTex;
uniform float _BlurContrast;
uniform float _FlipNormalY;
uniform vec2 _TexelSize;
varying vec2 vUv;

void main() {
  vec2 ps = _TexelSize * 0.5;

  vec4 nX  = textureLod(_MainTex, vUv + vec2( ps.x, 0.0), 0.0) * 2.0 - 1.0;
  vec4 nX2 = textureLod(_MainTex, vUv + vec2(-ps.x, 0.0), 0.0) * 2.0 - 1.0;
  vec4 nY  = textureLod(_MainTex, vUv + vec2(0.0,  ps.y), 0.0) * 2.0 - 1.0;
  vec4 nY2 = textureLod(_MainTex, vUv + vec2(0.0, -ps.y), 0.0) * 2.0 - 1.0;

  float diffX = (nX.x - nX2.x) * _BlurContrast;
  float diffY = (nY.y - nY2.y) * _BlurContrast;

  if (_FlipNormalY < 0.5) diffY *= -1.0;

  float diff = (diffX + 0.5) * (diffY + 0.5) * 2.0;
  gl_FragColor = vec4(vec3(diff), 1.0);
}
