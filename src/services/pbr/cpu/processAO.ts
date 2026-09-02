import { performBoxBlur, clamp } from './imageUtils'
import type { AOParams } from '@/types/pbr.types'

export function processAO(
  dispImgData: ImageData,
  params: AOParams,
  scaleRatio: number,
): ImageData {
  const w = dispImgData.width
  const h = dispImgData.height
  const hPix = dispImgData.data
  const len = hPix.length
  const v = params

  const bData = performBoxBlur(
    new ImageData(new Uint8ClampedArray(hPix), w, h),
    Math.round((v.spread || 50) * scaleRatio),
  )

  const outData = new ImageData(w, h)
  const outPix = outData.data

  for (let i = 0; i < len; i += 4) {
    const height = hPix[i]
    const blurredHeight = bData.data[i]

    const depthOcclusion = Math.max(0, blurredHeight - height) * (v.depth || 100) / 255.0
    let val = 255 - depthOcclusion * 255 * (v.aoPower || 1.0)
    val = val + (v.aoBias || 0) * 128
    if (v.invert) val = 255 - val
    outPix[i] = outPix[i + 1] = outPix[i + 2] = clamp(val, 0, 255)
    outPix[i + 3] = 255
  }

  return outData
}
