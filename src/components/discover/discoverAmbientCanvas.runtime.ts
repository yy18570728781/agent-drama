import type { DiscoverAmbientTheme } from './discoverAmbientShaders.constants'
import {
  createDiscoverAmbientRenderer,
  type DiscoverAmbientPoint,
  type DiscoverAmbientRenderer,
} from './discoverAmbientWebgl.renderer'
import {
  calculateDiscoverAmbientBitmapSize,
  clampDiscoverAmbientUnit,
} from '@/utils/discoverAmbientCanvas'

export interface DiscoverAmbientCanvasRuntime {
  requestDraw: () => void
  dispose: () => void
}

const ACTIVE_FRAME_INTERVAL = 1000 / 24
const IDLE_FRAME_INTERVAL = 1000 / 10
const ACTIVE_POINTER_WINDOW = 1000
const POINTER_CENTER: DiscoverAmbientPoint = [0.5, 0.5]
const DESKTOP_POINTER_QUERY = '(min-width: 768px) and (hover: hover) and (pointer: fine)'

class AmbientCanvasRuntime implements DiscoverAmbientCanvasRuntime {
  private renderer: DiscoverAmbientRenderer | null = null
  private frameId: number | null = null
  private wakeTimerId: number | null = null
  private lastDrawAt = 0
  private lastPointerAt = Number.NEGATIVE_INFINITY
  private pointer: DiscoverAmbientPoint = POINTER_CENTER
  private pointerActive = false
  private canvasRect: DOMRectReadOnly | null = null
  private isIntersecting = true
  private reducedMotion = false
  private runtimeEvents: AbortController | null = null
  private resizeObserver: ResizeObserver | null = null
  private intersectionObserver: IntersectionObserver | null = null
  private readonly pointerQuery = window.matchMedia(DESKTOP_POINTER_QUERY)
  private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly getTheme: () => DiscoverAmbientTheme,
  ) {
    this.pointerQuery.addEventListener('change', this.handlePointerCapability)
    this.motionQuery.addEventListener('change', this.handleMotionPreference)
    this.handlePointerCapability()
  }

  requestDraw = (): void => {
    this.lastDrawAt = 0
    this.rescheduleFrame()
  }

  dispose = (): void => {
    this.pointerQuery.removeEventListener('change', this.handlePointerCapability)
    this.motionQuery.removeEventListener('change', this.handleMotionPreference)
    this.stopRuntime()
  }

  private stopFrame(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId)
    if (this.wakeTimerId !== null) window.clearTimeout(this.wakeTimerId)
    this.frameId = null
    this.wakeTimerId = null
  }

  private canDraw(): boolean {
    return Boolean(this.renderer && this.isIntersecting && !document.hidden)
  }

  private getFrameInterval(timestamp: number): number {
    return timestamp - this.lastPointerAt < ACTIVE_POINTER_WINDOW
      ? ACTIVE_FRAME_INTERVAL
      : IDLE_FRAME_INTERVAL
  }

  private requestNextAnimationFrame = (): void => {
    this.wakeTimerId = null
    if (!this.canDraw() || this.frameId !== null) return
    this.frameId = requestAnimationFrame(this.drawFrame)
  }

  private scheduleFrame(): void {
    if (!this.canDraw() || this.frameId !== null || this.wakeTimerId !== null) return
    const now = performance.now()
    const interval = this.getFrameInterval(now)
    const delay = this.lastDrawAt ? Math.max(0, this.lastDrawAt + interval - now) : 0
    if (delay < 1) this.requestNextAnimationFrame()
    else this.wakeTimerId = window.setTimeout(this.requestNextAnimationFrame, Math.ceil(delay))
  }

  private rescheduleFrame(): void {
    if (this.wakeTimerId !== null) window.clearTimeout(this.wakeTimerId)
    this.wakeTimerId = null
    this.scheduleFrame()
  }

  private readonly drawFrame = (timestamp: number): void => {
    this.frameId = null
    if (!this.renderer || !this.canDraw()) return
    const interval = this.getFrameInterval(timestamp)
    if (this.lastDrawAt && timestamp - this.lastDrawAt < interval) {
      this.scheduleFrame()
      return
    }
    const delta = this.lastDrawAt ? (timestamp - this.lastDrawAt) / 1000 : 1 / 24
    this.renderer.render(timestamp / 1000, this.pointer, delta, this.getTheme(), this.pointerActive)
    this.lastDrawAt = timestamp
    this.canvas.classList.add('is-ready')
    if (!this.reducedMotion) this.scheduleFrame()
  }

  private readonly updateCanvasRect = (): void => {
    if (!this.isIntersecting) return
    this.canvasRect = this.canvas.getBoundingClientRect()
  }

  private readonly resizeCanvas = (): void => {
    if (!this.renderer || !this.isIntersecting) return
    this.updateCanvasRect()
    if (!this.canvasRect || this.canvasRect.width < 1 || this.canvasRect.height < 1) return
    const bitmap = calculateDiscoverAmbientBitmapSize(this.canvasRect, window.devicePixelRatio)
    if (this.canvas.width !== bitmap.width || this.canvas.height !== bitmap.height) {
      this.canvas.width = bitmap.width
      this.canvas.height = bitmap.height
      this.lastDrawAt = 0
    }
    this.renderer.resize(bitmap.width, bitmap.height)
    this.rescheduleFrame()
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.reducedMotion || !this.isIntersecting || document.hidden) return
    if (!this.canvasRect) this.updateCanvasRect()
    if (!this.canvasRect || this.canvasRect.width < 1 || this.canvasRect.height < 1) return
    this.pointer = [
      clampDiscoverAmbientUnit((event.clientX - this.canvasRect.left) / this.canvasRect.width),
      clampDiscoverAmbientUnit(1 - (event.clientY - this.canvasRect.top) / this.canvasRect.height),
    ]
    this.pointerActive = true
    this.lastPointerAt = performance.now()
    this.rescheduleFrame()
  }

  private readonly resetPointer = (): void => {
    this.pointer = POINTER_CENTER
    this.pointerActive = false
    this.lastPointerAt = performance.now()
    this.rescheduleFrame()
  }

  private readonly handleVisibility = (): void => {
    if (document.hidden) {
      this.pointer = POINTER_CENTER
      this.pointerActive = false
      this.renderer?.resetTrail()
      this.stopFrame()
    }
    else this.scheduleFrame()
  }

  private readonly handleIntersection = (entries: IntersectionObserverEntry[]): void => {
    const entry = entries[0]
    if (!entry) return
    this.isIntersecting = entry.isIntersecting
    if (this.isIntersecting) this.resizeCanvas()
    else {
      this.pointer = POINTER_CENTER
      this.pointerActive = false
      this.renderer?.resetTrail()
      this.stopFrame()
    }
  }

  private readonly initializeRenderer = (): void => {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
      premultipliedAlpha: false,
      stencil: false,
    })
    if (!gl) return
    try {
      this.renderer = createDiscoverAmbientRenderer(gl)
      this.resizeCanvas()
    } catch {
      this.renderer = null
      this.canvas.classList.remove('is-ready')
    }
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.renderer = null
    this.canvas.classList.remove('is-ready')
    this.stopFrame()
  }

  private startRuntime(): void {
    if (this.runtimeEvents) return
    this.runtimeEvents = new AbortController()
    const signal = this.runtimeEvents.signal
    this.reducedMotion = this.motionQuery.matches
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true, signal })
    window.addEventListener('pointercancel', this.resetPointer, { signal })
    window.addEventListener('blur', this.resetPointer, { signal })
    window.addEventListener('resize', this.resizeCanvas, { passive: true, signal })
    window.addEventListener('scroll', this.updateCanvasRect, { capture: true, passive: true, signal })
    document.documentElement.addEventListener('pointerleave', this.resetPointer, { signal })
    document.addEventListener('visibilitychange', this.handleVisibility, { signal })
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, { signal })
    this.canvas.addEventListener('webglcontextrestored', this.initializeRenderer, { signal })
    this.resizeObserver = new ResizeObserver(this.resizeCanvas)
    this.resizeObserver.observe(this.canvas)
    this.intersectionObserver = new IntersectionObserver(this.handleIntersection)
    this.intersectionObserver.observe(this.canvas)
    this.initializeRenderer()
  }

  private stopRuntime(): void {
    this.runtimeEvents?.abort()
    this.runtimeEvents = null
    this.resizeObserver?.disconnect()
    this.intersectionObserver?.disconnect()
    this.resizeObserver = null
    this.intersectionObserver = null
    this.stopFrame()
    this.renderer?.dispose()
    this.renderer = null
    this.canvas.classList.remove('is-ready')
  }

  private readonly handlePointerCapability = (): void => {
    if (this.pointerQuery.matches) this.startRuntime()
    else this.stopRuntime()
  }

  private readonly handleMotionPreference = (): void => {
    this.reducedMotion = this.motionQuery.matches
    this.lastDrawAt = 0
    if (this.reducedMotion) {
      this.stopFrame()
      this.pointer = POINTER_CENTER
      this.pointerActive = false
      this.renderer?.resetTrail()
    }
    this.scheduleFrame()
  }
}

/**
 * Creates the non-Vue runtime that owns the Discover water canvas side effects.
 * @param canvas Canvas element used for WebGL output.
 * @param getTheme Reads the latest resolved application theme for each frame.
 * @returns Disposable runtime controlled by the owning composable.
 */
export function createDiscoverAmbientCanvasRuntime(
  canvas: HTMLCanvasElement,
  getTheme: () => DiscoverAmbientTheme,
): DiscoverAmbientCanvasRuntime {
  return new AmbientCanvasRuntime(canvas, getTheme)
}
