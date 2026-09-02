import { clamp } from './imageUtils'
import type { AlbedoParams, CurvePoint } from '@/types/pbr.types'

function computeCubicSpline(points: CurvePoint[]): Uint8Array {
  const n = points.length
  const sorted = [...points].sort((a, b) => a.x - b.x)
  const x = sorted.map(p => p.x)
  const y = sorted.map(p => p.y)
  const lut = new Uint8Array(256)

  if (n < 2) {
    const val = n === 1 ? y[0] : 0
    lut.fill(clamp(Math.round(val), 0, 255))
    return lut
  }
  if (n === 2) {
    const m = (y[1] - y[0]) / (x[1] - x[0] || 0.0001)
    for (let i = 0; i < 256; i++) {
      lut[i] = clamp(Math.round(y[0] + m * (i - x[0])), 0, 255)
    }
    return lut
  }

  const h = new Array(n - 1)
  for (let i = 0; i < n - 1; i++) h[i] = x[i + 1] - x[i]
  const alpha = new Array(n - 1)
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / (h[i] || 0.0001)) * (y[i + 1] - y[i]) - (3 / (h[i - 1] || 0.0001)) * (y[i] - y[i - 1])
  }
  const l = new Array(n), mu = new Array(n), z = new Array(n)
  l[0] = 1; mu[0] = 0; z[0] = 0
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1]
    mu[i] = h[i] / (l[i] || 0.0001)
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / (l[i] || 0.0001)
  }
  l[n - 1] = 1; z[n - 1] = 0
  const c = new Array(n).fill(0), b = new Array(n).fill(0), d = new Array(n).fill(0)
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1]
    b[j] = (y[j + 1] - y[j]) / (h[j] || 0.0001) - h[j] * (c[j + 1] + 2 * c[j]) / 3
    d[j] = (c[j + 1] - c[j]) / (3 * h[j] || 0.0001)
  }
  for (let i = 0; i < 256; i++) {
    let idx = 0
    while (idx < n - 1 && i > x[idx + 1]) idx++
    const dx = i - x[idx]
    lut[i] = clamp(Math.round(y[idx] + b[idx] * dx + c[idx] * dx * dx + d[idx] * dx * dx * dx), 0, 255)
  }
  return lut
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h, s, l]
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

export function processAlbedo(imgData: ImageData, params: AlbedoParams, _scaleRatio: number): ImageData {
  const pix = imgData.data
  const len = pix.length
  const {
    invert: isInvert, exposure, exposureOffset, exposureGamma,
    brightness: b, contrast: cont,
    blackAndWhite: isBW,
    bwReds: bwr, bwYellows: bwy, bwGreens: bwg, bwCyans: bwc, bwBlues: bwb, bwMagentas: bwm,
    colorBalanceR: cbR, colorBalanceG: cbG, colorBalanceB: cbB,
    colorBalanceShadowsR: cbSR, colorBalanceShadowsG: cbSG, colorBalanceShadowsB: cbSB,
    colorBalanceMidtonesR: cbMR, colorBalanceMidtonesG: cbMG, colorBalanceMidtonesB: cbMB,
    colorBalanceHighlightsR: cbHR, colorBalanceHighlightsG: cbHG, colorBalanceHighlightsB: cbHB,
    colorBalancePreserveLuma: cbLuma,
    levelsMin: lMin, levelsMax: lMax, levelsMid: lMid,
    levelsOutMin: outMin, levelsOutMax: outMax,
    levelsMinR: lMinR, levelsMaxR: lMaxR, levelsMidR: lMidR,
    levelsOutMinR: outMinR, levelsOutMaxR: outMaxR,
    levelsMinG: lMinG, levelsMaxG: lMaxG, levelsMidG: lMidG,
    levelsOutMinG: outMinG, levelsOutMaxG: outMaxG,
    levelsMinB: lMinB, levelsMaxB: lMaxB, levelsMidB: lMidB,
    levelsOutMinB: outMinB, levelsOutMaxB: outMaxB,
    curvePoints: cp,
    eq1, eq2, eq3, eq4, eq5, eq6,
    hue: hueShift, saturation: satValue, lightness: lightValue, vibrance: vibValue, colorize,
  } = params

  const expFactor = Math.pow(2, exposure / 20)
  const expGammaInv = 1.0 / Math.max(exposureGamma, 0.01)

  const lutRGB = computeCubicSpline(cp.rgb)
  const lutR = computeCubicSpline(cp.r)
  const lutG = computeCubicSpline(cp.g)
  const lutB = computeCubicSpline(cp.b)

  const hasColorBalance = cbR !== 0 || cbG !== 0 || cbB !== 0 ||
    cbSR !== 0 || cbSG !== 0 || cbSB !== 0 ||
    cbMR !== 0 || cbMG !== 0 || cbMB !== 0 ||
    cbHR !== 0 || cbHG !== 0 || cbHB !== 0
  const hasEqualizer = eq1 !== 0 || eq2 !== 0 || eq3 !== 0 || eq4 !== 0 || eq5 !== 0 || eq6 !== 0

  for (let i = 0; i < len; i += 4) {
    let r = pix[i] / 255, g = pix[i + 1] / 255, bVal = pix[i + 2] / 255

    // 1. Invert
    if (isInvert) { r = 1 - r; g = 1 - g; bVal = 1 - bVal }

    // 2. Exposure + Offset + Gamma
    r = Math.pow(Math.max(0, r + exposureOffset), expGammaInv) * expFactor
    g = Math.pow(Math.max(0, g + exposureOffset), expGammaInv) * expFactor
    bVal = Math.pow(Math.max(0, bVal + exposureOffset), expGammaInv) * expFactor

    // 3. Color Balance (single + three-tier shadows/midtones/highlights with sigmoidal weights)
    if (hasColorBalance) {
      const lumaOrig = 0.3 * r + 0.59 * g + 0.11 * bVal
      const s = Math.max(0, Math.min(1, (1.075 / (1 + Math.exp((lumaOrig - 0.25) / 0.12))) - 0.075))
      const h = Math.max(0, Math.min(1, (1.075 / (1 + Math.exp((0.75 - lumaOrig) / 0.12))) - 0.075))
      const m = Math.max(0, 1 - s - h)
      const rShift = (cbR * m + cbSR * s + cbMR * m + cbHR * h) / 100 * 0.5
      const gShift = (cbG * m + cbSG * s + cbMG * m + cbHG * h) / 100 * 0.5
      const bShift = (cbB * m + cbSB * s + cbMB * m + cbHB * h) / 100 * 0.5
      r += rShift; g += gShift; bVal += bShift
      if (cbLuma) {
        const lumaNew = 0.3 * r + 0.59 * g + 0.11 * bVal
        const dl = lumaOrig - lumaNew
        r += dl; g += dl; bVal += dl
      }
    }

    // 4. Black & White (6-case hue-based per-channel weights)
    if (isBW) {
      const bwRFactor = (bwr ?? 40) / 100
      const bwYFactor = (bwy ?? 60) / 100
      const bwGFactor = (bwg ?? 40) / 100
      const bwCFactor = (bwc ?? 60) / 100
      const bwBFactor = (bwb ?? 20) / 100
      const bwMFactor = (bwm ?? 80) / 100
      const maxVal = Math.max(r, g, bVal), minVal = Math.min(r, g, bVal), diff = maxVal - minVal
      let grey = 0
      if (diff === 0) grey = r
      else if (r >= g && g >= bVal) grey = bVal + (g - bVal) * bwYFactor + (r - g) * bwRFactor
      else if (g > r && r >= bVal) grey = bVal + (r - bVal) * bwYFactor + (g - r) * bwGFactor
      else if (g >= bVal && bVal > r) grey = r + (bVal - r) * bwCFactor + (g - bVal) * bwGFactor
      else if (bVal > g && g >= r) grey = r + (g - r) * bwCFactor + (bVal - g) * bwBFactor
      else if (bVal >= r && r > g) grey = g + (r - g) * bwMFactor + (bVal - r) * bwBFactor
      else grey = g + (bVal - g) * bwMFactor + (r - bVal) * bwRFactor
      r = g = bVal = Math.min(1, Math.max(0, grey))
    }

    // 5. Non-linear Brightness & Contrast (preserves hue/saturation)
    const luma = 0.299 * r + 0.587 * g + 0.114 * bVal
    let newLuma = luma
    const bNorm = b / 150
    const cNorm = cont / 150

    if (bNorm > 0) { newLuma = luma + (1 - luma) * bNorm * 0.8 }
    else if (bNorm < 0) { newLuma = luma + luma * bNorm * 0.8 }

    if (cNorm > 0) {
      const factor = 1 + cNorm * 1.5
      const xn = newLuma - 0.5
      newLuma = 0.5 + Math.sign(xn) * 0.5 * (1 - Math.pow(1 - 2 * Math.abs(xn), factor))
    } else if (cNorm < 0) {
      newLuma = 0.5 + (newLuma - 0.5) * (1 + cNorm)
    }

    if (luma > 0.001) {
      const ratio = newLuma / luma
      r *= ratio; g *= ratio; bVal *= ratio
    } else {
      r = g = bVal = newLuma
    }
    r = clamp(r, 0, 1); g = clamp(g, 0, 1); bVal = clamp(bVal, 0, 1)

    // Scale to 0-255 for levels/curves processing
    r *= 255; g *= 255; bVal *= 255

    // 6. Levels (per-channel then composite)
    const applyLevel = (v: number, lMn: number, lMx: number, lMd: number, oMn: number, oMx: number): number => {
      const lRng = Math.max(1, lMx - lMn)
      let vn = (v - lMn) / lRng
      vn = clamp(vn, 0, 1)
      if (lMd !== 1) vn = Math.pow(vn, 1 / lMd)
      return vn * (oMx - oMn) + oMn
    }
    r = applyLevel(r, lMinR ?? lMin, lMaxR ?? lMax, lMidR ?? lMid, outMinR ?? outMin, outMaxR ?? outMax)
    g = applyLevel(g, lMinG ?? lMin, lMaxG ?? lMax, lMidG ?? lMid, outMinG ?? outMin, outMaxG ?? outMax)
    bVal = applyLevel(bVal, lMinB ?? lMin, lMaxB ?? lMax, lMidB ?? lMid, outMinB ?? outMin, outMaxB ?? outMax)
    r = applyLevel(r, lMin, lMax, lMid, outMin, outMax)
    g = applyLevel(g, lMin, lMax, lMid, outMin, outMax)
    bVal = applyLevel(bVal, lMin, lMax, lMid, outMin, outMax)

    // 7. Curves (per-channel spline + composite spline)
    r = lutRGB[lutR[clamp(Math.round(r), 0, 255)]]
    g = lutRGB[lutG[clamp(Math.round(g), 0, 255)]]
    bVal = lutRGB[lutB[clamp(Math.round(bVal), 0, 255)]]

    // 8. Equalizer (6-band luma frequency)
    if (hasEqualizer) {
      const eqLuma = (0.3 * r + 0.59 * g + 0.11 * bVal) / 255
      let bandAmount = 0
      if (eqLuma < 0.16) bandAmount = eq1
      else if (eqLuma < 0.33) bandAmount = eq2
      else if (eqLuma < 0.5) bandAmount = eq3
      else if (eqLuma < 0.66) bandAmount = eq4
      else if (eqLuma < 0.83) bandAmount = eq5
      else bandAmount = eq6
      const multiplier = 1 + bandAmount / 100
      r *= multiplier; g *= multiplier; bVal *= multiplier
    }

    // Clamp to 0-255 before HSL
    r = clamp(r, 0, 255); g = clamp(g, 0, 255); bVal = clamp(bVal, 0, 255)

    // 9. Hue / Saturation / Vibrance / Lightness / Colorize
    if (hueShift !== 0 || satValue !== 0 || vibValue !== 0 || lightValue !== 0 || colorize) {
      let [h, s, l] = rgbToHsl(r / 255, g / 255, bVal / 255)
      if (colorize) {
        h = ((hueShift + 180) % 360) / 360
        s = clamp((satValue + 100) / 200, 0, 1)
      } else {
        h = ((h + hueShift / 360) % 1 + 1) % 1
        s += satValue / 100
      }
      if (vibValue !== 0) s += (vibValue / 100) * (1 - s)
      l += lightValue / 100
      s = clamp(s, 0, 1); l = clamp(l, 0, 1)

      if (s === 0) { r = g = bVal = l * 255 }
      else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        r = hue2rgb(p, q, h + 1 / 3) * 255
        g = hue2rgb(p, q, h) * 255
        bVal = hue2rgb(p, q, h - 1 / 3) * 255
      }
    }

    pix[i] = Math.round(r)
    pix[i + 1] = Math.round(g)
    pix[i + 2] = Math.round(bVal)
  }
  return imgData
}
