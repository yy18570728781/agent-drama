uniform sampler2D _MainTex;
uniform float _AOBlend;
uniform float _FinalContrast;
uniform float _FinalBias;
varying vec2 vUv;

void main() {
  vec2 mainTex = textureLod(_MainTex, vUv, 0.0).xy;
  float ao = mix(mainTex.x, mainTex.y, _AOBlend);
  ao += _FinalBias;
  ao = pow(clamp(ao, 0.0, 1.0), _FinalContrast);
  gl_FragColor = vec4(vec3(ao), 1.0);
}
