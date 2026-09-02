export async function performBoxBlurAsync(
  srcData: ImageData,
  radius: number,
  onYield?: () => Promise<void>,
  yieldInterval = 200,
): Promise<ImageData> {
  if (radius <= 0) return srcData
  const w = srcData.width
  const h = srcData.height
  const src = srcData.data
  const dest = new Uint8ClampedArray(src.length)
  const r = Math.min(Math.round(radius), 15)

  for (let y = 0; y < h; y++) {
    if (y % yieldInterval === 0 && onYield) await onYield()
    for (let x = 0; x < w; x++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx
        if (nx >= 0 && nx < w) {
          const idx = (y * w + nx) * 4
          sumR += src[idx]; sumG += src[idx + 1]; sumB += src[idx + 2]; sumA += src[idx + 3]
          count++
        }
      }
      const outIdx = (y * w + x) * 4
      dest[outIdx] = sumR / count; dest[outIdx + 1] = sumG / count
      dest[outIdx + 2] = sumB / count; dest[outIdx + 3] = sumA / count
    }
  }

  const finalDest = new Uint8ClampedArray(src.length)
  for (let x = 0; x < w; x++) {
    if (x % yieldInterval === 0 && onYield) await onYield()
    for (let y = 0; y < h; y++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy
        if (ny >= 0 && ny < h) {
          const idx = (ny * w + x) * 4
          sumR += dest[idx]; sumG += dest[idx + 1]; sumB += dest[idx + 2]; sumA += dest[idx + 3]
          count++
        }
      }
      const outIdx = (y * w + x) * 4
      finalDest[outIdx] = sumR / count; finalDest[outIdx + 1] = sumG / count
      finalDest[outIdx + 2] = sumB / count; finalDest[outIdx + 3] = sumA / count
    }
  }

  return new ImageData(finalDest, w, h)
}

export function performBoxBlur(srcData: ImageData, radius: number): ImageData {
  if (radius <= 0) return srcData
  const w = srcData.width
  const h = srcData.height
  const src = srcData.data
  const dest = new Uint8ClampedArray(src.length)
  const r = Math.min(Math.round(radius), 15)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx
        if (nx >= 0 && nx < w) {
          const idx = (y * w + nx) * 4
          sumR += src[idx]
          sumG += src[idx + 1]
          sumB += src[idx + 2]
          sumA += src[idx + 3]
          count++
        }
      }
      const outIdx = (y * w + x) * 4
      dest[outIdx] = sumR / count
      dest[outIdx + 1] = sumG / count
      dest[outIdx + 2] = sumB / count
      dest[outIdx + 3] = sumA / count
    }
  }

  const finalDest = new Uint8ClampedArray(src.length)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy
        if (ny >= 0 && ny < h) {
          const idx = (ny * w + x) * 4
          sumR += dest[idx]
          sumG += dest[idx + 1]
          sumB += dest[idx + 2]
          sumA += dest[idx + 3]
          count++
        }
      }
      const outIdx = (y * w + x) * 4
      finalDest[outIdx] = sumR / count
      finalDest[outIdx + 1] = sumG / count
      finalDest[outIdx + 2] = sumB / count
      finalDest[outIdx + 3] = sumA / count
    }
  }

  return new ImageData(finalDest, w, h)
}

export function imageToCanvas(img: HTMLImageElement | HTMLCanvasElement, res: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = res
  canvas.height = res
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const srcW = 'width' in img ? img.width : (img as HTMLCanvasElement).width
  const srcH = 'height' in img ? img.height : (img as HTMLCanvasElement).height
  const scale = Math.min(res / srcW, res / srcH)
  const dw = srcW * scale
  const dh = srcH * scale
  const dx = (res - dw) / 2
  const dy = (res - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
  return canvas
}

export function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function imageDataToCanvas(imgData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = imgData.width
  canvas.height = imgData.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.putImageData(imgData, 0, 0)
  return canvas
}

export function cloneImageData(src: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height)
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function toLuma(r: number, g: number, b: number): number {
  return 0.3 * r + 0.5 * g + 0.2 * b
}
