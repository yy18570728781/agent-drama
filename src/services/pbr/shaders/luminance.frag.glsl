uniform sampler2D _MainTex;
varying vec2 vUv;

void main() {
  vec4 c = textureLod(_MainTex, vUv, 0.0);
  float luma = dot(c.rgb, vec3(0.3, 0.5, 0.2));
  gl_FragColor = vec4(vec3(luma), 1.0);
}
