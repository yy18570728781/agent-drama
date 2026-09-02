import { performBoxBlur, clamp } from './imageUtils'
import type { EdgeParams } from '@/types/pbr.types'

export function processEdge(
  normalImgData: ImageData,
  params: EdgeParams,
  scaleRatio: number,
): ImageData {
  const w = normalImgData.width
  const h = normalImgData.height
  const nPix = normalImgData.data
  const len = nPix.length
  const v = params

  const nData = new ImageData(new Uint8ClampedArray(nPix), w, h)
  const b1 = performBoxBlur(nData, Math.round(2 * scaleRatio))
  const b2 = performBoxBlur(b1, Math.round(6 * scaleRatio))

  const outData = new ImageData(w, h)
  const outPix = outData.data

  for (let i = 0; i < len; i += 4) {
    const nx = (nPix[i] / 255.0 - 0.5) * 2.0
    const bnx = (b2.data[i] / 255.0 - 0.5) * 2.0
    const ny = (nPix[i + 1] / 255.0 - 0.5) * 2.0
    const bny = (b2.data[i + 1] / 255.0 - 0.5) * 2.0

    const diff = ((nx - bnx) + (ny - bny)) * 0.5
    const edge = diff * (v.edgeAmount || 1.0) * (v.preContrast || 1.0)
    const crevice = -diff * (v.creviceAmount || 1.0) * (v.preContrast || 1.0)
    let val = Math.max(edge, crevice) * 128 * (v.finalContrast || 1.0) + 128 + (v.finalBias || 0) * 128

    if (v.invert) val = 255 - val
    outPix[i] = outPix[i + 1] = outPix[i + 2] = clamp(val, 0, 255)
    outPix[i + 3] = 255
  }

  return outData
}
