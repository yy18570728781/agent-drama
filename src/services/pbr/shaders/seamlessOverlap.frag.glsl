uniform sampler2D _MainTex;
uniform sampler2D _HeightTex;
uniform vec2 _Overlap;
uniform float _Falloff;
uniform float _IsHeight;
uniform float _IsNormal;
uniform float _FlipY;
varying vec2 vUv;

void main() {
  vec2 overlap = _Overlap;
  vec2 invOverlap = 1.0 - overlap;
  vec2 oneOverOverlap = 1.0 / max(overlap, vec2(0.001));

  vec2 UV = vUv;
  vec2 UV2 = UV - vec2(overlap.x, 0.0);
  vec2 UV3 = UV - vec2(0.0, overlap.y);
  vec2 UV4 = UV - vec2(overlap.x, overlap.y);

  vec2 UVMask = clamp((1.0 - fract(UV) - invOverlap) * oneOverOverlap, 0.0, 1.0);

  UV = fract(UV);
  UV2 = fract(UV2);
  UV3 = fract(UV3);
  UV4 = fract(UV4);

  UV *= invOverlap;
  UV2.x += overlap.x; UV2 *= invOverlap;
  UV3.y += overlap.y; UV3 *= invOverlap;
  UV4 += overlap; UV4 *= invOverlap;

  float heightTex = textureLod(_HeightTex, UV, 0.0).x;
  float heightTex2 = textureLod(_HeightTex, UV2, 0.0).x;
  float heightTex3 = textureLod(_HeightTex, UV3, 0.0).x;
  float heightTex4 = textureLod(_HeightTex, UV4, 0.0).x;

  vec4 mainTex = textureLod(_MainTex, UV, 0.0);
  vec4 mainTex2 = textureLod(_MainTex, UV2, 0.0);
  vec4 mainTex3 = textureLod(_MainTex, UV3, 0.0);
  vec4 mainTex4 = textureLod(_MainTex, UV4, 0.0);

  float SSHigh = 0.01 + 0.5 * clamp(_Falloff, 0.0, 1.0);
  float SSLow = -0.01 - 0.5 * clamp(_Falloff, 0.0, 1.0);

  float TexBlend = smoothstep(SSLow, SSHigh, (heightTex2 + UVMask.x) - (heightTex + (1.0 - UVMask.x)));
  vec4 mainTexH = mix(mainTex, mainTex2, TexBlend);
  float heightTexH = max(heightTex + (1.0 - UVMask.x), heightTex2 + UVMask.x) - 1.0;
  heightTexH += clamp(min(UVMask.x, 1.0 - UVMask.x), 0.0, 1.0);

  TexBlend = smoothstep(SSLow, SSHigh, (heightTex4 + UVMask.x) - (heightTex3 + (1.0 - UVMask.x)));
  vec4 mainTexV = mix(mainTex3, mainTex4, TexBlend);
  float heightTexV = max(heightTex3 + (1.0 - UVMask.x), heightTex4 + UVMask.x) - 1.0;
  heightTexV += clamp(min(UVMask.x, 1.0 - UVMask.x), 0.0, 1.0);

  TexBlend = smoothstep(SSLow, SSHigh, (heightTexV + UVMask.y) - (heightTexH + (1.0 - UVMask.y)));
  vec4 result = mix(mainTexH, mainTexV, TexBlend);
  float resultH = max(heightTexH + (1.0 - UVMask.y), heightTexV + UVMask.y) - 1.0;
  resultH += clamp(min(UVMask.y, 1.0 - UVMask.y), 0.0, 1.0);

  if (_IsHeight > 0.5) {
    gl_FragColor = vec4(vec3(resultH), 1.0);
  } else {
    gl_FragColor = vec4(result.xyz, 1.0);
  }
}
