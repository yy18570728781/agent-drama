export const AMBIENT_TRAIL_UNIFORMS = [
  'uPreviousTrail', 'uPointer', 'uPreviousPointer', 'uResolution',
  'uRadius', 'uAmount', 'uBloom', 'uDecay',
] as const

export const AMBIENT_WATER_UNIFORMS = [
  'uTrailTexture', 'uResolution', 'uFlowTime',
  'uGradientPosition', 'uGradientScale', 'uGradientAngle', 'uGradientPhase',
  'uGradientRectness', 'uGradientColor0', 'uGradientColor1', 'uGradientColor2',
  'uGradientColor3', 'uGradientColor4', 'uGradientStop0', 'uGradientStop1',
  'uGradientStop2', 'uGradientStop3', 'uGradientStop4',
  'uCausticsPosition', 'uCausticsScale', 'uCausticsRefraction',
  'uCausticsAmbiance', 'uCausticsFisheye',
  'uGradientMapPosition', 'uGradientMapScale', 'uGradientMapPhase',
  'uGradientMapColor0', 'uGradientMapColor1', 'uGradientMapColor2',
  'uGradientMapColor3', 'uGradientMapStop0', 'uGradientMapStop1',
  'uGradientMapStop2', 'uGradientMapStop3',
  'uMouseBlendAmount', 'uMouseBlendActive',
] as const

export const AMBIENT_FINAL_UNIFORMS = [
  'uWaterTexture', 'uTrailTexture', 'uResolution', 'uDotPosition', 'uDotColor',
  'uDotGap', 'uDotScale', 'uGlyphGamma', 'uGlyphOpacity',
  'uChromaticAberration', 'uHoverChromaticAberration', 'uHoverDotBoost',
  'uVignette', 'uLightMode', 'uTrailActive',
] as const
