import { AMBIENT_THEME_PARAMS } from './discoverAmbientShaders.constants'
import {
  setAmbientColor,
  setAmbientPalette,
  type AmbientProgram,
} from './discoverAmbientWebgl.resources'

export type AmbientSettings = typeof AMBIENT_THEME_PARAMS.dark | typeof AMBIENT_THEME_PARAMS.light

/**
 * Uploads the water pass uniforms that only change with the resolved theme.
 * @param gl Active WebGL2 context.
 * @param program Water pass program.
 * @param settings Resolved ambient theme settings.
 */
export function applyAmbientWaterThemeSettings(
  gl: WebGL2RenderingContext,
  program: AmbientProgram,
  settings: AmbientSettings,
): void {
  const u = program.uniforms
  const centerY = 0.5 + settings.verticalOffset
  gl.uniform2f(u.uGradientPosition, 0.5, centerY)
  gl.uniform1f(u.uGradientScale, settings.gradientScale)
  gl.uniform1f(u.uGradientAngle, settings.gradientAngle)
  gl.uniform1f(u.uGradientPhase, settings.gradientPhase)
  gl.uniform1f(u.uGradientRectness, settings.gradientRectness)
  setAmbientPalette(
    gl, program, 'uGradientColor', 'uGradientStop',
    settings.gradientColors, settings.gradientStops,
  )
  gl.uniform2f(u.uCausticsPosition, 0.5, centerY)
  gl.uniform1f(u.uCausticsScale, settings.causticsScale)
  gl.uniform1f(u.uCausticsRefraction, settings.causticsRefraction)
  gl.uniform1f(u.uCausticsAmbiance, settings.causticsAmbiance)
  gl.uniform1f(u.uCausticsFisheye, settings.fisheye)
  gl.uniform2f(u.uGradientMapPosition, 0.5383275261, 0.3940766551 + settings.verticalOffset)
  gl.uniform1f(u.uGradientMapScale, settings.gradientMapScale)
  gl.uniform1f(u.uGradientMapPhase, settings.gradientMapPhase)
  setAmbientPalette(
    gl, program, 'uGradientMapColor', 'uGradientMapStop',
    settings.gradientMapColors, settings.gradientMapStops,
  )
  gl.uniform1f(u.uMouseBlendAmount, settings.mouseAmount)
}

/**
 * Uploads the final pass uniforms that only change with the resolved theme.
 * @param gl Active WebGL2 context.
 * @param program Final pass program.
 * @param settings Resolved ambient theme settings.
 */
export function applyAmbientFinalThemeSettings(
  gl: WebGL2RenderingContext,
  program: AmbientProgram,
  settings: AmbientSettings,
): void {
  const u = program.uniforms
  gl.uniform2f(u.uDotPosition, 0.5, 0.5 + settings.verticalOffset)
  setAmbientColor(gl, u.uDotColor, settings.dotColor)
  gl.uniform1f(u.uDotGap, settings.dotGap)
  gl.uniform1f(u.uDotScale, settings.dotScale)
  gl.uniform1f(u.uGlyphGamma, settings.glyphGamma)
  gl.uniform1f(u.uGlyphOpacity, settings.glyphOpacity)
  gl.uniform1f(u.uChromaticAberration, settings.chromaticAberration)
  gl.uniform1f(u.uHoverChromaticAberration, settings.hoverChromaticAberration)
  gl.uniform1f(u.uHoverDotBoost, settings.hoverDotBoost)
  gl.uniform1f(u.uVignette, settings.vignette)
  gl.uniform1f(u.uLightMode, settings.lightMode)
}
