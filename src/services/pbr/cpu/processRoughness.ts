import { performBoxBlur, clamp, toLuma } from './imageUtils'
import type { RoughnessParams, MetallicParams } from '@/types/pbr.types'

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

export function processRoughness(
  imgData: ImageData,
  params: RoughnessParams,
  scaleRatio: number,
  metalPix?: Uint8ClampedArray | null,
): ImageData {
  const pix = imgData.data
  const len = pix.length
  const v = params

  const b1 = performBoxBlur(imgData, Math.round((v.sampleBlurSize || 0) * scaleRatio))
  const b2 = performBoxBlur(b1, Math.round((v.highPassBlurSize || 30) * scaleRatio))

  const samples = v.samples || []
  const hasSamples = samples.some((s: any) => s.enabled)
  const blurForSample = hasSamples ? performBoxBlur(imgData, Math.round(2 * scaleRatio)) : null

  for (let i = 0; i < len; i += 4) {
    const r = pix[i] / 255, g = pix[i + 1] / 255, b = pix[i + 2] / 255
    let luma = toLuma(r, g, b)

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
        luma = luma * (1 - mask * (v.sampleBlend ?? 0.5)) + s.targetValue * mask * (v.sampleBlend ?? 0.5)
      }
    }

    const blurred = b2.data[i] / 255
    const diff = (luma - blurred) * (v.highPassOverlay || 3.0)
    let val = luma + diff

    if (metalPix) {
      const metalMask = metalPix[i] / 255
      const baseSmooth = v.baseSmoothness ?? 0.1
      const metalSmooth = v.metalSmoothness ?? 0.7
      const baseVal = baseSmooth + (val - baseSmooth) * 0.5
      val = baseVal * (1 - metalMask) + metalSmooth * metalMask
    }

    val = (val - 0.5) * (v.finalContrast || 1.0) + 0.5 + (v.finalBias || 0) * 0.5
    val = clamp(val, 0, 1)
    if (v.invert) val = 1 - val
    pix[i] = pix[i + 1] = pix[i + 2] = val * 255
  }

  return imgData
}
