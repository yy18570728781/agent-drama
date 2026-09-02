import { performBoxBlur, clamp, toLuma } from './imageUtils'
import type { MetallicParams } from '@/types/pbr.types'

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

export function processMetallic(
  imgData: ImageData,
  params: MetallicParams,
  scaleRatio: number,
): ImageData {
  const pix = imgData.data
  const len = pix.length
  const v = params
  const sample = v.sample

  const b1 = performBoxBlur(imgData, Math.round((v.blurSize || 0) * scaleRatio))
  const b2 = performBoxBlur(b1, Math.round((v.overlayBlurSize || 30) * scaleRatio))

  const sColor = sample?.color || [0.5, 0.5, 0.5]
  const sHSL = rgbToHsl(sColor[0], sColor[1], sColor[2])

  for (let i = 0; i < len; i += 4) {
    const r = pix[i] / 255, g = pix[i + 1] / 255, b = pix[i + 2] / 255
    const blurred = b2.data[i]

    const diff = (pix[i] - blurred) * (v.highPassOverlay || 1.0)
    let val = pix[i] + diff

    if (sample?.enabled) {
      const pxHSL = rgbToHsl(r, g, b)
      const mask = matchHSL(pxHSL[0], pxHSL[1], pxHSL[2], sHSL[0], sHSL[1], sHSL[2],
        sample.hueWeight, sample.satWeight, sample.lumWeight, sample.maskLow, sample.maskHigh)
      val = val * mask + (1 - mask) * 0
    }

    val = (val - 128) * (v.finalContrast || 1.0) + 128 + (v.finalBias || 0) * 128
    val = clamp(val, 0, 255)
    if (v.invert) val = 255 - val
    pix[i] = pix[i + 1] = pix[i + 2] = val
  }

  return imgData
}
