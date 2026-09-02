uniform sampler2D _MainTex;
uniform sampler2D _HeightTex;
uniform sampler2D _BlendTex;
uniform vec2 _TexelSize;
uniform float _Progress;
uniform float _BlendAmount;
uniform float _Spread;
uniform float _SpreadBoost;
uniform float _Samples;
uniform float _FlipNormalY;
varying vec2 vUv;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 normalTex = textureLod(_MainTex, vUv, 0.0).xyz;
  normalTex = normalTex * 2.0 - 1.0;
  if (_FlipNormalY < 0.5) normalTex.y = -normalTex.y;

  float dirX = sin(_Progress * 6.28318530718);
  float dirY = cos(_Progress * 6.28318530718);

  float AO = 0.0;
  float TotalWeight = 0.0;

  for (int i = 1; i <= 100; i++) {
    if (float(i) > _Samples) break;
    float passProgress = float(i) / _Samples;
    float r = (rand(vUv + _Progress) - 0.5) * 0.2;
    float tdx = dirX * _Spread * (passProgress * _SpreadBoost) + r;
    float tdy = dirY * _Spread * (passProgress * _SpreadBoost) + r;
    vec2 offsetUV = vUv + vec2(tdx, tdy) * _TexelSize;

    if (offsetUV.x < 0.0 || offsetUV.x > 1.0 || offsetUV.y < 0.0 || offsetUV.y > 1.0) continue;

    vec3 sampleTex = textureLod(_MainTex, offsetUV, 0.0).xyz;
    sampleTex = sampleTex * 2.0 - 1.0;
    if (_FlipNormalY < 0.5) sampleTex.y = -sampleTex.y;

    float len = length(vec2(tdx, tdy));
    if (len < 0.001) continue;
    vec3 dir3 = normalize(vec3(tdx / len, tdy / len, 0.0));
    float sampleAO = dot(sampleTex, dir3);

    AO += sampleAO;
    TotalWeight += 1.0;
  }

  AO *= 1.0 / max(TotalWeight, 0.001);
  AO *= (_Samples * _SpreadBoost) / 50.0;
  AO = AO * 0.5 + 0.5;

  float blendTex = textureLod(_BlendTex, vUv, 0.0).x;
  AO = mix(blendTex, AO, _BlendAmount);

  gl_FragColor = vec4(vec3(AO), 1.0);
}
