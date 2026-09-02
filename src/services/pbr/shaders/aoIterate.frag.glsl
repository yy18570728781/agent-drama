uniform sampler2D _MainTex;
uniform sampler2D _HeightTex;
uniform sampler2D _BlendTex;
uniform vec2 _TexelSize;
uniform float _Progress;
uniform float _BlendAmount;
uniform float _Spread;
uniform float _Depth;
uniform float _FlipNormalY;
uniform int _Samples;
varying vec2 vUv;

float rand(vec3 co) {
  return fract(sin(dot(co.xyz, vec3(12.9898, 78.233, 137.9462))) * 43758.5453);
}

void main() {
  vec3 flipTex = vec3(1.0);
  if (_FlipNormalY < 0.5) flipTex = vec3(1.0, -1.0, 1.0);

  vec3 mainNrm = textureLod(_MainTex, vUv, 0.0).xyz;
  mainNrm = normalize(mainNrm * 2.0 - 1.0) * flipTex;
  float mainHeight = textureLod(_HeightTex, vUv, 0.0).x;

  vec2 direction;
  direction.x = sin(_Progress * 6.28318530718);
  direction.y = cos(_Progress * 6.28318530718);

  vec2 AO = vec2(0.0);
  float AOAccum = 0.0;

  for (int i = 1; i <= 64; i++) {
    if (i > _Samples) break;
    float progress = float(i) / float(max(_Samples, 1));
    vec2 randomizer = vec2(rand(vec3(vUv, float(i))), rand(vec3(vUv.yx, float(i)))) * progress * 0.1;
    vec2 uvOffset = direction * _Spread * progress + randomizer;
    vec2 trueDir = normalize(uvOffset);
    vec2 sampleUV = vUv + _TexelSize * uvOffset;

    vec3 sampleNrm = textureLod(_MainTex, sampleUV, 0.0).xyz;
    float sampleHeight = textureLod(_HeightTex, sampleUV, 0.0).x;
    sampleNrm = sampleNrm * 2.0 - 1.0;
    sampleNrm *= flipTex;

    float sampleImportance = sqrt(1.0 - progress);
    AO.x += dot(sampleNrm.xyz, vec3(trueDir, 0.0)) * sampleImportance;
    AOAccum += sampleImportance;

    vec3 samplePos = vec3(trueDir * _Spread * progress, (sampleHeight - mainHeight) * _Depth);
    float sampleDist = clamp(length(samplePos) * 0.1, 0.0, 1.0);
    float sampleAO = clamp(dot(vec3(0.0, 0.0, 1.0), normalize(samplePos)), 0.0, 1.0);
    AO.y = max(sampleAO * sampleDist, AO.y);
  }

  AO.x *= 1.0 / max(AOAccum, 0.001);
  float AOX1 = clamp(AO.x + 1.0, 0.0, 1.0);
  float AOX2 = clamp(AO.x + 0.5, 0.0, 1.0);
  AO.x = pow(AOX1, 5.0) * pow(AOX2, 0.2);
  AO.x = sqrt(AO.x);
  AO.y = 1.0 - AO.y;

  vec2 blendTex = textureLod(_BlendTex, vUv, 0.0).xy;
  AO = mix(blendTex.xy, AO, _BlendAmount);

  gl_FragColor = vec4(AO.xy, 1.0, 1.0);
}
