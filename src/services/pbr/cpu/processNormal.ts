import { performBoxBlur, performBoxBlurAsync, clamp } from './imageUtils'
import type { NormalParams } from '@/types/pbr.types'

export function processNormal(
  dispImgData: ImageData,
  params: NormalParams,
  scaleRatio: number,
): ImageData {
  const w = dispImgData.width
  const h = dispImgData.height
  const rPix = dispImgData.data
  const len = rPix.length
  const v = params

  const cloned = new ImageData(new Uint8ClampedArray(rPix), w, h)
  const b1 = performBoxBlur(cloned, Math.round(1 * scaleRatio))
  const b2 = performBoxBlur(b1, Math.round(2 * scaleRatio))
  const b3 = performBoxBlur(b2, Math.round(4 * scaleRatio))
  const b4 = performBoxBlur(b3, Math.round(8 * scaleRatio))
  const b5 = performBoxBlur(b4, Math.round(16 * scaleRatio))
  const b6 = performBoxBlur(b5, Math.round(32 * scaleRatio))

  const weights = v.weights || [0.30, 0.35, 0.50, 0.80, 1.00, 0.95, 0.80]

  const bands: Uint8ClampedArray[] = [
    rPix, b1.data, b2.data, b3.data, b4.data, b5.data, b6.data,
  ]

  const modPix = new Float32Array(len)
  for (let i = 0; i < len; i += 4) {
    let val = 0
    for (let b = 0; b < 7; b++) {
      val += bands[b][i] * (weights[b] ?? 0.5)
    }
    val = (val / 7 - 128) * ((v.preContrast || 20) / 10.0) + 128
    modPix[i] = val
  }

  const getH = (x: number, y: number): number => {
    const nx = Math.max(0, Math.min(w - 1, x))
    const ny = Math.max(0, Math.min(h - 1, y))
    return modPix[(ny * w + nx) * 4]
  }

  const outData = new ImageData(w, h)
  return processNormalSobel(w, h, getH, modPix, v, outData)
}

function processNormalSobel(
  w: number, h: number,
  getH: (x: number, y: number) => number,
  modPix: Float32Array,
  v: NormalParams,
  outData: ImageData,
): ImageData {
  const outPix = outData.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = getH(x - 1, y - 1), l = getH(x - 1, y), bl = getH(x - 1, y + 1)
      const t = getH(x, y - 1), b = getH(x, y + 1)
      const tr = getH(x + 1, y - 1), r = getH(x + 1, y), br = getH(x + 1, y + 1)

      const dX = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl)
      const dY = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr)

      let dxVal = (dX / 255.0) * (v.angularIntensity || 0.5) * (v.finalContrast || 5)
      let dyVal = (dY / 255.0) * (v.angularIntensity || 0.5) * (v.finalContrast || 5)
      if (v.invertY) dyVal = -dyVal
      if (v.invert) { dxVal = -dxVal; dyVal = -dyVal }

      let nX = -dxVal, nY = -dyVal, nZ = 1.0
      const mag = Math.sqrt(nX * nX + nY * nY + nZ * nZ)

      const idx = (y * w + x) * 4
      outPix[idx] = clamp((nX / mag * 0.5 + 0.5) * 255, 0, 255)
      outPix[idx + 1] = clamp((nY / mag * 0.5 + 0.5) * 255, 0, 255)
      outPix[idx + 2] = clamp((nZ / mag) * 255, 0, 255)
      outPix[idx + 3] = 255
    }
  }
  return outData
}

export async function processNormalAsync(
  dispImgData: ImageData,
  params: NormalParams,
  scaleRatio: number,
  onYield?: () => Promise<void>,
): Promise<ImageData> {
  const w = dispImgData.width, h = dispImgData.height
  const rPix = dispImgData.data, len = rPix.length
  const v = params

  const cloned = new ImageData(new Uint8ClampedArray(rPix), w, h)
  const b1 = await performBoxBlurAsync(cloned, Math.round(1 * scaleRatio), onYield)
  const b2 = await performBoxBlurAsync(b1, Math.round(2 * scaleRatio), onYield)
  const b3 = await performBoxBlurAsync(b2, Math.round(4 * scaleRatio), onYield)
  const b4 = await performBoxBlurAsync(b3, Math.round(8 * scaleRatio), onYield)
  const b5 = await performBoxBlurAsync(b4, Math.round(16 * scaleRatio), onYield)
  const b6 = await performBoxBlurAsync(b5, Math.round(32 * scaleRatio), onYield)

  const weights = v.weights || [0.30, 0.35, 0.50, 0.80, 1.00, 0.95, 0.80]
  const bands: Uint8ClampedArray[] = [rPix, b1.data, b2.data, b3.data, b4.data, b5.data, b6.data]

  const modPix = new Float32Array(len)
  for (let i = 0; i < len; i += 4) {
    let val = 0
    for (let b = 0; b < 7; b++) {
      val += bands[b][i] * (weights[b] ?? 0.5)
    }
    val = (val / 7 - 128) * ((v.preContrast || 20) / 10.0) + 128
    modPix[i] = val
  }

  const getH = (x: number, y: number): number => {
    const nx = Math.max(0, Math.min(w - 1, x))
    const ny = Math.max(0, Math.min(h - 1, y))
    return modPix[(ny * w + nx) * 4]
  }

  const outData = new ImageData(w, h)
  return processNormalSobel(w, h, getH, modPix, v, outData)
}
