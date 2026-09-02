import { performBoxBlur, performBoxBlurAsync, clamp, toLuma } from './imageUtils'
import type { DisplacementParams } from '@/types/pbr.types'

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h, s, l]
}

function matchHSL(pxH: number, pxS: number, pxL: number, sH: number, sS: number, sL: number, hueW: number, satW: number, lumW: number, maskLow: number, maskHigh: number): number {
  const hueDif = 1 - Math.min(Math.abs(pxH - sH), Math.abs(pxH + 1 - sH), Math.abs(pxH - 1 - sH)) * 2
  const satDif = 1 - Math.abs(pxS - sS)
  const lumDif = 1 - Math.abs(pxL - sL)
  const totalW = hueW + satW + lumW
  const diff = (hueDif * hueW + satDif * satW + lumDif * lumW) / Math.max(totalW, 0.001)
  return diff >= maskHigh ? 1 : diff <= maskLow ? 0 : (diff - maskLow) / (maskHigh - maskLow)
}

export function processDisplacement(
  imgData: ImageData,
  params: DisplacementParams,
  scaleRatio: number,
): ImageData {
  const pix = imgData.data
  const w = imgData.width
  const h = imgData.height
  const len = pix.length
  const v = params

  const b1 = performBoxBlur(imgData, Math.round(1 * scaleRatio))
  const b2 = performBoxBlur(b1, Math.round(2 * scaleRatio))
  const b3 = performBoxBlur(b2, Math.round(4 * scaleRatio))
  const b4 = performBoxBlur(b3, Math.round(8 * scaleRatio))
  const b5 = performBoxBlur(b4, Math.round(16 * scaleRatio))
  const b6 = performBoxBlur(b5, Math.round(32 * scaleRatio))

  const weights = v.weights || [0.15, 0.19, 0.30, 0.50, 0.70, 0.90, 1.00]
  const contrasts = v.contrasts || [1, 1, 1, 1, 1, 1, 1]
  const bands: Uint8ClampedArray[] = [pix, b1.data, b2.data, b3.data, b4.data, b5.data, b6.data]

  let avgR = 0, avgG = 0, avgB = 0, count = 0
  for (let i = 0; i < len; i += 4) {
    avgR += b6.data[i]; avgG += b6.data[i + 1]; avgB += b6.data[i + 2]; count++
  }
  const avgLuma = toLuma(avgR / count / 255, avgG / count / 255, avgB / count / 255)
  const avgEncoded = Math.pow(avgLuma, 0.45)

  const samples = v.samples || []
  const hasSamples = samples.some((s: any) => s.enabled)
  const blurForSample = hasSamples ? performBoxBlur(imgData, Math.round(2 * scaleRatio)) : null

  for (let i = 0; i < len; i += 4) {
    const r = pix[i] / 255, g = pix[i + 1] / 255, b = pix[i + 2] / 255
    let grey = toLuma(r, g, b)

    if (hasSamples && blurForSample) {
      const br = blurForSample.data[i] / 255
      const bg = blurForSample.data[i + 1] / 255
      const bb = blurForSample.data[i + 2] / 255
      const blurHSL = rgbToHsl(br, bg, bb)
      for (const s of samples) {
        if (!s.enabled) continue
        const sHSL = rgbToHsl(s.color[0], s.color[1], s.color[2])
        const mask = matchHSL(blurHSL[0], blurHSL[1], blurHSL[2], sHSL[0], sHSL[1], sHSL[2],
          s.hueWeight, s.satWeight, s.lumWeight, s.maskLow, s.maskHigh)
        grey = grey * (1 - mask * (v.sampleBlend ?? 0.5)) + s.targetValue * mask * (v.sampleBlend ?? 0.5)
      }
    }

    let val = 0
    let totalWeight = 0
    for (let bi = 0; bi < 7; bi++) {
      const bandLuma = toLuma(bands[bi][i] / 255, bands[bi][i + 1] / 255, bands[bi][i + 2] / 255)
      const encoded = Math.pow(bandLuma, 0.45)
      const diff = (encoded - avgEncoded) * (contrasts[bi] ?? 1.0) + 0.5
      val += diff * (weights[bi] ?? 0.5)
      totalWeight += weights[bi] ?? 0.5
    }
    val /= Math.max(totalWeight, 0.001)

    val = (val - 0.5) * (v.finalContrast || 1.5) + 0.5 + (v.finalBias || 0) * 0.5

    const rawGain = v.finalGain || 0
    let realGain: number
    if (rawGain < 0) realGain = Math.abs(1.0 / (rawGain - 1.0))
    else realGain = rawGain + 1.0
    if (realGain !== 1.0) {
      if (val > 0.5) val = Math.pow(val * 2 - 1, realGain) * 0.5 + 0.5
      else val = 1 - (Math.pow((1 - val) * 2 - 1, realGain) * 0.5 + 0.5)
    }

    if (v.invert) val = 1 - val
    val = clamp(val * 255, 0, 255)
    pix[i] = pix[i + 1] = pix[i + 2] = val
  }

  return imgData
}

export async function processDisplacementAsync(
  imgData: ImageData,
  params: DisplacementParams,
  scaleRatio: number,
  onYield?: () => Promise<void>,
): Promise<ImageData> {
  const pix = imgData.data
  const w = imgData.width, h = imgData.height, len = pix.length
  const v = params

  const b1 = await performBoxBlurAsync(imgData, Math.round(1 * scaleRatio), onYield)
  const b2 = await performBoxBlurAsync(b1, Math.round(2 * scaleRatio), onYield)
  const b3 = await performBoxBlurAsync(b2, Math.round(4 * scaleRatio), onYield)
  const b4 = await performBoxBlurAsync(b3, Math.round(8 * scaleRatio), onYield)
  const b5 = await performBoxBlurAsync(b4, Math.round(16 * scaleRatio), onYield)
  const b6 = await performBoxBlurAsync(b5, Math.round(32 * scaleRatio), onYield)

  const weights = v.weights || [0.15, 0.19, 0.30, 0.50, 0.70, 0.90, 1.00]
  const contrasts = v.contrasts || [1, 1, 1, 1, 1, 1, 1]
  const bands: Uint8ClampedArray[] = [pix, b1.data, b2.data, b3.data, b4.data, b5.data, b6.data]

  let avgR = 0, avgG = 0, avgB = 0, count = 0
  for (let i = 0; i < len; i += 4) {
    avgR += b6.data[i]; avgG += b6.data[i + 1]; avgB += b6.data[i + 2]; count++
  }
  const avgLuma = toLuma(avgR / count / 255, avgG / count / 255, avgB / count / 255)
  const avgEncoded = Math.pow(avgLuma, 0.45)

  const samples = v.samples || []
  const hasSamples = samples.some((s: any) => s.enabled)
  const blurForSample = hasSamples ? await performBoxBlurAsync(imgData, Math.round(2 * scaleRatio), onYield) : null

  for (let i = 0; i < len; i += 4) {
    const r = pix[i] / 255, g = pix[i + 1] / 255, b = pix[i + 2] / 255
    let grey = toLuma(r, g, b)

    if (hasSamples && blurForSample) {
      const br = blurForSample.data[i] / 255
      const bg = blurForSample.data[i + 1] / 255
      const bb = blurForSample.data[i + 2] / 255
      const blurHSL = rgbToHsl(br, bg, bb)
      for (const s of samples) {
        if (!s.enabled) continue
        const sHSL = rgbToHsl(s.color[0], s.color[1], s.color[2])
        const mask = matchHSL(blurHSL[0], blurHSL[1], blurHSL[2], sHSL[0], sHSL[1], sHSL[2],
          s.hueWeight, s.satWeight, s.lumWeight, s.maskLow, s.maskHigh)
        grey = grey * (1 - mask * (v.sampleBlend ?? 0.5)) + s.targetValue * mask * (v.sampleBlend ?? 0.5)
      }
    }

    let val = 0
    let totalWeight = 0
    for (let bi = 0; bi < 7; bi++) {
      const bandLuma = toLuma(bands[bi][i] / 255, bands[bi][i + 1] / 255, bands[bi][i + 2] / 255)
      const encoded = Math.pow(bandLuma, 0.45)
      const diff = (encoded - avgEncoded) * (contrasts[bi] ?? 1.0) + 0.5
      val += diff * (weights[bi] ?? 0.5)
      totalWeight += weights[bi] ?? 0.5
    }
    val /= Math.max(totalWeight, 0.001)

    val = (val - 0.5) * (v.finalContrast || 1.5) + 0.5 + (v.finalBias || 0) * 0.5

    const rawGain = v.finalGain || 0
    let realGain: number
    if (rawGain < 0) realGain = Math.abs(1.0 / (rawGain - 1.0))
    else realGain = rawGain + 1.0
    if (realGain !== 1.0) {
      if (val > 0.5) val = Math.pow(val * 2 - 1, realGain) * 0.5 + 0.5
      else val = 1 - (Math.pow((1 - val) * 2 - 1, realGain) * 0.5 + 0.5)
    }

    if (v.invert) val = 1 - val
    val = clamp(val * 255, 0, 255)
    pix[i] = pix[i + 1] = pix[i + 2] = val
  }

  return imgData
}
