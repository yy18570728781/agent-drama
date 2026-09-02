const MAX_DEVICE_PIXEL_RATIO = 1.75
const MAX_CANVAS_PIXELS = 420_000

/**
 * Clamps a normalized pointer coordinate to the canvas bounds.
 * @param value Coordinate that may fall outside the normalized interval.
 * @returns Value constrained to the inclusive zero-to-one interval.
 */
export function clampDiscoverAmbientUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Calculates a capped backing-store size without changing the canvas aspect ratio.
 * @param rect Current CSS bounds of the canvas.
 * @param devicePixelRatio Device scale reported by the browser.
 * @returns Integer bitmap dimensions capped for predictable GPU cost.
 */
export function calculateDiscoverAmbientBitmapSize(
  rect: DOMRectReadOnly,
  devicePixelRatio: number,
): { width: number; height: number } {
  const dpr = Math.min(devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
  const requestedWidth = Math.max(1, Math.round(rect.width * dpr))
  const requestedHeight = Math.max(1, Math.round(rect.height * dpr))
  const pixelScale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (requestedWidth * requestedHeight)))
  return {
    width: Math.max(1, Math.floor(requestedWidth * pixelScale)),
    height: Math.max(1, Math.floor(requestedHeight * pixelScale)),
  }
}
