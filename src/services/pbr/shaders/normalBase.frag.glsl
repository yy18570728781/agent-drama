uniform sampler2D _MainTex;
uniform sampler2D _DiffuseTex;
uniform sampler2D _DiffuseBlurTex;
uniform float _BlurContrast;
uniform float _ShapeRecognition;
uniform float _LightRotation;
uniform float _ShapeBias;
uniform vec2 _TexelSize;
varying vec2 vUv;

void main() {
  float mainH = textureLod(_MainTex, vUv, 0.0).x;
  float mainDDX = textureLod(_MainTex, vUv + vec2(_TexelSize.x, 0.0), 0.0).x;
  float mainDDY = textureLod(_MainTex, vUv + vec2(0.0, _TexelSize.y), 0.0).x;

  float ddx = mainDDX - mainH;
  float ddy = mainDDY - mainH;

  vec3 normalTex = normalize(cross(
    normalize(vec3(1.0, 0.0, ddx * _BlurContrast)),
    normalize(vec3(0.0, 1.0, ddy * _BlurContrast))
  ));

  if (_ShapeRecognition > 0.001) {
    vec3 diffTex = textureLod(_DiffuseTex, vUv, 0.0).xyz;
    vec3 diffBlurTex = textureLod(_DiffuseBlurTex, vUv, 0.0).xyz;

    float diffLuma = dot(diffTex, vec3(0.3, 0.5, 0.2));
    float diffBlurLuma = dot(diffBlurTex, vec3(0.3, 0.5, 0.2));

    float hpHeight = (diffLuma - diffBlurLuma) + _ShapeBias;
    hpHeight = hpHeight * 2.0 - 1.0;

    vec3 lightDir = vec3(sin(_LightRotation), cos(_LightRotation), 0.0);
    vec3 lightCrossDir = cross(lightDir, vec3(0.0, 0.0, 1.0));

    vec3 shape = hpHeight * lightDir + dot(normalTex, lightCrossDir) * lightCrossDir;
    shape.z = sqrt(1.0 - clamp(dot(shape.xy, shape.xy), 0.0, 1.0));
    shape = normalize(shape);

    normalTex = normalize(mix(normalTex, shape, _ShapeRecognition));
  }

  normalTex = normalTex * 0.5 + 0.5;
  gl_FragColor = vec4(normalTex, 1.0);
}
