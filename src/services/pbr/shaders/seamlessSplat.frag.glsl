uniform sampler2D _MainTex;
uniform sampler2D _HeightTex;
uniform sampler2D _TargetTex;
uniform vec4 _SplatKernel;
uniform float _SplatScale;
uniform vec2 _AspectRatio;
uniform vec2 _TargetAspectRatio;
uniform float _SplatRotation;
uniform float _SplatRotationRandom;
uniform float _SplatRandomize;
uniform vec3 _Wobble;
uniform float _Falloff;
uniform float _IsHeight;
uniform float _IsNormal;
uniform float _FlipY;
varying vec2 vUv;

const vec2 OffsetKernel[9] = vec2[9](
  vec2( 1.0,  1.0),
  vec2( 0.0,  1.0),
  vec2(-1.0,  1.0),
  vec2( 1.0,  0.0),
  vec2( 0.0,  0.0),
  vec2(-1.0,  0.0),
  vec2( 1.0, -1.0),
  vec2( 0.0, -1.0),
  vec2(-1.0, -1.0)
);

void main() {
  vec4 targetTex = textureLod(_TargetTex, vUv, 0.0);
  float targetHeight = (1.0 / max(targetTex.w, 0.001)) - 1.0;
  vec3 targetColor = targetTex.xyz;

  float SSHigh = 0.01 + 0.5 * clamp(_Falloff, 0.0, 1.0);
  float SSLow = -0.01 - 0.5 * clamp(_Falloff, 0.0, 1.0);
  if (_IsHeight > 0.5) {
    SSHigh = 0.01 + 0.25;
    SSLow = -0.01 - 0.25;
  }

  float rotation = _SplatRotation * -6.28318530718
    + _SplatRotationRandom * _SplatRandomize * -6.28318530718;
  float cosR = cos(rotation);
  float sinR = sin(rotation);

  for (int i = 0; i < 9; i++) {
    vec2 localPos = (vUv - _SplatKernel.xy + OffsetKernel[i])
      * (1.0 / (_SplatScale * _SplatKernel.z)) * _TargetAspectRatio;

    vec2 tempPos = localPos;
    localPos.x = cosR * tempPos.x - sinR * tempPos.y;
    localPos.y = sinR * tempPos.x + cosR * tempPos.y;

    vec2 localMaskPos = localPos * 2.0;
    float edgeProd = (1.0 - clamp(abs(localMaskPos.x), 0.0, 1.0))
      * (1.0 - clamp(abs(localMaskPos.y), 0.0, 1.0));
    float CenterMask = pow(clamp((edgeProd - 0.1) * 2.0, 0.0, 1.0), 0.3);
    float UVMask = clamp(edgeProd * 10.0, 0.0, 1.0);

    localPos *= _AspectRatio.yx;
    localPos *= 1.0 / (_Wobble.z + 1.0);
    localPos += _Wobble.xy * _Wobble.z;
    localPos += 0.5;

    if (localPos.x < 0.0 || localPos.x > 1.0 || localPos.y < 0.0 || localPos.y > 1.0) continue;
    if (UVMask < 0.001) continue;

    float heightVal = textureLod(_HeightTex, localPos, 0.0).x;
    vec4 thisTex = textureLod(_MainTex, localPos, 0.0);

    if (_IsNormal > 0.5) {
      vec3 tn = thisTex.xyz * 2.0 - 1.0;
      float rot = rotation;
      if (_FlipY > 0.5) {
        rot *= -1.0;
      }
      float cr = cos(rot);
      float sr = sin(rot);
      thisTex.x = cr * tn.x - sr * tn.y;
      thisTex.y = sr * tn.x + cr * tn.y;
      thisTex.xy = thisTex.xy * 0.5 + 0.5;
    }

    float thisHeight = (heightVal + 0.2) * CenterMask * UVMask;
    float blend = smoothstep(SSLow, SSHigh, targetHeight - thisHeight);
    targetColor = mix(thisTex.xyz, targetColor, blend);
    targetHeight = max(targetHeight, thisHeight);
  }

  float outW = 1.0 / (targetHeight + 1.0);
  gl_FragColor = vec4(targetColor, outW);
}
