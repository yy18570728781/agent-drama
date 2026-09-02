import {
  AMBIENT_FULLSCREEN_VERTEX_SHADER,
  AMBIENT_THEME_PARAMS,
  AMBIENT_TRAIL_FRAGMENT_SHADER,
  type DiscoverAmbientTheme,
} from './discoverAmbientShaders.constants'
import {
  AMBIENT_FINAL_FRAGMENT_SHADER,
  AMBIENT_WATER_FRAGMENT_SHADER,
} from './discoverAmbientWaterShaders.constants'
import {
  AMBIENT_FINAL_UNIFORMS,
  AMBIENT_TRAIL_UNIFORMS,
  AMBIENT_WATER_UNIFORMS,
} from './discoverAmbientUniforms.constants'
import {
  allocateAmbientTarget,
  bindAmbientTexture,
  createAmbientGeometry,
  createAmbientProgram,
  createAmbientTarget,
  disposeAmbientTarget,
  type AmbientProgram,
  type AmbientTarget,
} from './discoverAmbientWebgl.resources'
import {
  applyAmbientFinalThemeSettings,
  applyAmbientWaterThemeSettings,
  type AmbientSettings,
} from './discoverAmbientWebgl.settings'

export type DiscoverAmbientPoint = readonly [number, number]

export interface DiscoverAmbientRenderer {
  resize: (width: number, height: number) => void
  render: (
    timeSeconds: number,
    pointer: DiscoverAmbientPoint,
    deltaSeconds: number,
    theme: DiscoverAmbientTheme,
    pointerActive: boolean,
  ) => void
  resetTrail: () => void
  dispose: () => void
}

type AmbientTrailState = 'empty' | 'live'

const TRAIL_FADE_SECONDS = 0.6
const TRAIL_CLEAR_COLOR = new Float32Array([0, 0, 0, 0])
// The two-percent guard preserves post-process samples at the mask's 40% fade edge.
const VISIBLE_RENDER_WIDTH_RATIO = 0.42

class AmbientRenderer implements DiscoverAmbientRenderer {
  private readonly trailProgram: AmbientProgram
  private readonly waterProgram: AmbientProgram
  private readonly finalProgram: AmbientProgram
  private readonly vertexArray: WebGLVertexArrayObject
  private readonly vertexBuffer: WebGLBuffer
  private readonly trailTargets: readonly [AmbientTarget, AmbientTarget]
  private readonly waterTarget: AmbientTarget
  private width = 0
  private height = 0
  private trailWidth = 1
  private trailHeight = 1
  private trailWriteIndex: 0 | 1 = 0
  private trailState: AmbientTrailState = 'empty'
  private trailFadeRemaining = 0
  private previousPointer: DiscoverAmbientPoint = [0.5, 0.5]
  private hasPointerSample = false
  private flowTime = 0
  private appliedTheme: DiscoverAmbientTheme | null = null
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.trailProgram = createAmbientProgram(
      gl, AMBIENT_FULLSCREEN_VERTEX_SHADER, AMBIENT_TRAIL_FRAGMENT_SHADER, AMBIENT_TRAIL_UNIFORMS,
    )
    this.waterProgram = createAmbientProgram(
      gl, AMBIENT_FULLSCREEN_VERTEX_SHADER, AMBIENT_WATER_FRAGMENT_SHADER, AMBIENT_WATER_UNIFORMS,
    )
    this.finalProgram = createAmbientProgram(
      gl, AMBIENT_FULLSCREEN_VERTEX_SHADER, AMBIENT_FINAL_FRAGMENT_SHADER, AMBIENT_FINAL_UNIFORMS,
    )
    const geometry = createAmbientGeometry(gl)
    this.vertexArray = geometry.vertexArray
    this.vertexBuffer = geometry.vertexBuffer
    this.trailTargets = [createAmbientTarget(gl), createAmbientTarget(gl)]
    this.waterTarget = createAmbientTarget(gl)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
  }

  resize(width: number, height: number): void {
    if (this.disposed) return
    const nextWidth = Math.max(1, Math.round(width))
    const nextHeight = Math.max(1, Math.round(height))
    if (nextWidth === this.width && nextHeight === this.height) return
    this.width = nextWidth
    this.height = nextHeight
    this.trailWidth = Math.max(1, Math.round(this.width * 0.5))
    this.trailHeight = Math.max(1, Math.round(this.height * 0.5))
    this.trailTargets.forEach((target: AmbientTarget) => {
      allocateAmbientTarget(this.gl, target, this.trailWidth, this.trailHeight)
    })
    allocateAmbientTarget(this.gl, this.waterTarget, this.width, this.height)
    this.trailWriteIndex = 0
    this.trailState = 'empty'
    this.trailFadeRemaining = 0
    this.previousPointer = [0.5, 0.5]
    this.hasPointerSample = false
  }

  render(
    timeSeconds: number,
    pointer: DiscoverAmbientPoint,
    deltaSeconds: number,
    theme: DiscoverAmbientTheme,
    pointerActive: boolean,
  ): void {
    if (this.disposed || this.gl.isContextLost() || !Number.isFinite(timeSeconds)) return
    const settings = AMBIENT_THEME_PARAMS[theme]
    const themeChanged = theme !== this.appliedTheme
    const delta = Math.min(Math.max(deltaSeconds, 0), 0.1)
    this.flowTime += settings.causticsSpeed * delta
    const aspect = this.width / Math.max(this.height, 1)
    const distance = Math.hypot(
      (pointer[0] - this.previousPointer[0]) * aspect,
      pointer[1] - this.previousPointer[1],
    )
    const isContinuousMove = distance < 0.42
    const allowInjection = pointerActive && this.hasPointerSample
    const moved = allowInjection && distance > 0.0001 && isContinuousMove
    const trailPreviousPointer = isContinuousMove ? this.previousPointer : pointer
    if (moved) {
      this.trailState = 'live'
      this.trailFadeRemaining = TRAIL_FADE_SECONDS
    }
    if (this.trailState === 'live') {
      this.renderTrail(pointer, trailPreviousPointer, delta, settings, moved)
      if (!moved) this.trailFadeRemaining = Math.max(0, this.trailFadeRemaining - delta)
      if (this.trailFadeRemaining === 0) this.clearTrailTargets()
    }
    const trailTexture = this.getCurrentTrailTexture()
    const trailActive = this.trailState === 'live'
    this.renderWater(trailTexture, settings, trailActive, themeChanged)
    this.renderFinal(trailTexture, settings, trailActive, themeChanged)
    this.appliedTheme = theme
    this.previousPointer = pointer
    this.hasPointerSample = pointerActive
  }

  resetTrail(): void {
    if (this.disposed) return
    this.clearTrailTargets()
    this.previousPointer = [0.5, 0.5]
    this.hasPointerSample = false
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.trailTargets.forEach((target: AmbientTarget) => {
      disposeAmbientTarget(this.gl, target)
    })
    disposeAmbientTarget(this.gl, this.waterTarget)
    this.gl.deleteBuffer(this.vertexBuffer)
    this.gl.deleteVertexArray(this.vertexArray)
    this.gl.deleteProgram(this.trailProgram.handle)
    this.gl.deleteProgram(this.waterProgram.handle)
    this.gl.deleteProgram(this.finalProgram.handle)
  }

  private getCurrentTrailTexture(): WebGLTexture {
    const currentIndex: 0 | 1 = this.trailWriteIndex === 0 ? 1 : 0
    return this.trailTargets[currentIndex].texture
  }

  private clearTrailTargets(): void {
    if (this.trailState === 'empty') return
    const gl = this.gl
    gl.disable(gl.SCISSOR_TEST)
    this.trailTargets.forEach((target: AmbientTarget) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
      gl.viewport(0, 0, this.trailWidth, this.trailHeight)
      gl.clearBufferfv(gl.COLOR, 0, TRAIL_CLEAR_COLOR)
    })
    this.trailWriteIndex = 0
    this.trailState = 'empty'
    this.trailFadeRemaining = 0
  }

  private applyVisibleScissor(width: number, height: number): void {
    this.gl.enable(this.gl.SCISSOR_TEST)
    this.gl.scissor(0, 0, Math.ceil(width * VISIBLE_RENDER_WIDTH_RATIO), height)
  }

  private renderTrail(
    pointer: DiscoverAmbientPoint,
    previousPointer: DiscoverAmbientPoint,
    delta: number,
    settings: AmbientSettings,
    moved: boolean,
  ): void {
    const gl = this.gl
    const readIndex: 0 | 1 = this.trailWriteIndex === 0 ? 1 : 0
    const output = this.trailTargets[this.trailWriteIndex]
    gl.bindFramebuffer(gl.FRAMEBUFFER, output.framebuffer)
    gl.viewport(0, 0, this.trailWidth, this.trailHeight)
    this.applyVisibleScissor(this.trailWidth, this.trailHeight)
    gl.useProgram(this.trailProgram.handle)
    gl.bindVertexArray(this.vertexArray)
    bindAmbientTexture(gl, 0, this.trailTargets[readIndex].texture)
    const u = this.trailProgram.uniforms
    gl.uniform1i(u.uPreviousTrail, 0)
    gl.uniform2f(u.uPointer, pointer[0], pointer[1])
    gl.uniform2f(u.uPreviousPointer, previousPointer[0], previousPointer[1])
    gl.uniform2f(u.uResolution, this.trailWidth, this.trailHeight)
    gl.uniform1f(u.uRadius, settings.mouseRadius)
    gl.uniform1f(u.uAmount, moved ? settings.mouseAmount : 0)
    gl.uniform1f(u.uBloom, settings.mouseBloom)
    const idleDecay = Math.pow(0.45, Math.max(delta, 0.0001) * 30)
    gl.uniform1f(u.uDecay, moved ? settings.mouseDecay : idleDecay)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.trailWriteIndex = readIndex
  }

  private renderWater(
    trailTexture: WebGLTexture,
    settings: AmbientSettings,
    trailActive: boolean,
    themeChanged: boolean,
  ): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.waterTarget.framebuffer)
    gl.viewport(0, 0, this.width, this.height)
    this.applyVisibleScissor(this.width, this.height)
    gl.useProgram(this.waterProgram.handle)
    gl.bindVertexArray(this.vertexArray)
    bindAmbientTexture(gl, 0, trailTexture)
    const u = this.waterProgram.uniforms
    gl.uniform1i(u.uTrailTexture, 0)
    gl.uniform2f(u.uResolution, this.width, this.height)
    gl.uniform1f(u.uFlowTime, this.flowTime)
    gl.uniform1f(u.uMouseBlendActive, trailActive ? 1 : 0)
    if (themeChanged) applyAmbientWaterThemeSettings(gl, this.waterProgram, settings)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private renderFinal(
    trailTexture: WebGLTexture,
    settings: AmbientSettings,
    trailActive: boolean,
    themeChanged: boolean,
  ): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)
    this.applyVisibleScissor(this.width, this.height)
    gl.useProgram(this.finalProgram.handle)
    gl.bindVertexArray(this.vertexArray)
    bindAmbientTexture(gl, 0, this.waterTarget.texture)
    bindAmbientTexture(gl, 1, trailTexture)
    const u = this.finalProgram.uniforms
    gl.uniform1i(u.uWaterTexture, 0)
    gl.uniform1i(u.uTrailTexture, 1)
    gl.uniform2f(u.uResolution, this.width, this.height)
    gl.uniform1f(u.uTrailActive, trailActive ? 1 : 0)
    if (themeChanged) applyAmbientFinalThemeSettings(gl, this.finalProgram, settings)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.disable(gl.SCISSOR_TEST)
  }
}

/**
 * Creates the GPU resource owner for the Discover showcase water-light layer.
 * @param gl Active WebGL2 context owned by the ambient canvas.
 * @returns Renderer that must be disposed when its canvas is unmounted.
 */
export function createDiscoverAmbientRenderer(
  gl: WebGL2RenderingContext,
): DiscoverAmbientRenderer {
  return new AmbientRenderer(gl)
}
