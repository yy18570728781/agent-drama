uniform sampler2D _MainTex;
varying vec2 vUv;

void main() {
  vec4 c = textureLod(_MainTex, vUv, 0.0);
  gl_FragColor = vec4(c.xyz, 1.0);
}
