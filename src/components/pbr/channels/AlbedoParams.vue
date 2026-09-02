<script setup lang="ts">
import { ref, computed, inject, watch, nextTick } from 'vue'
import { usePBRStore } from '@/stores/pbr.store'
import { Icon } from '@iconify/vue'

type AdjustGroup = 'brightnessContrast' | 'levels' | 'curves' | 'exposure' | 'vibrance' | 'hueSaturation' | 'colorBalance' | 'blackWhiteInvert'
type CurveChannel = 'rgb' | 'r' | 'g' | 'b'
type LevelDrag = 'min' | 'mid' | 'max' | 'outMin' | 'outMax' | null
type LevelsChannel = 'rgb' | 'r' | 'g' | 'b'

const store = usePBRStore()
const generator: any = inject('pbrGenerator')
const p = store.params.albedo
const ed = p.editDiffuse
const activeGroup = ref<AdjustGroup>('brightnessContrast')

function scheduleProcess() { if (generator) generator.scheduleRegenerate('albedo') }
function resetSingleParam(key: string, defaultVal: number | boolean) { (p as any)[key] = defaultVal; scheduleProcess() }

function resetGroup(key: AdjustGroup) {
  switch (key) {
    case 'brightnessContrast': p.brightness = 0; p.contrast = 0; break
    case 'levels':
      p.levelsMin = 0; p.levelsMax = 255; p.levelsMid = 1.0; p.levelsOutMin = 0; p.levelsOutMax = 255
      p.levelsMinR = 0; p.levelsMaxR = 255; p.levelsMidR = 1.0; p.levelsOutMinR = 0; p.levelsOutMaxR = 255
      p.levelsMinG = 0; p.levelsMaxG = 255; p.levelsMidG = 1.0; p.levelsOutMinG = 0; p.levelsOutMaxG = 255
      p.levelsMinB = 0; p.levelsMaxB = 255; p.levelsMidB = 1.0; p.levelsOutMinB = 0; p.levelsOutMaxB = 255
      break
    case 'curves': p.curvePoints = { rgb: [{x:0,y:0},{x:255,y:255}], r: [{x:0,y:0},{x:255,y:255}], g: [{x:0,y:0},{x:255,y:255}], b: [{x:0,y:0},{x:255,y:255}] }; selectedPointIndex.value = 0; break
    case 'exposure': p.exposure = 0; p.exposureOffset = 0; p.exposureGamma = 1.0; break
    case 'vibrance': p.vibrance = 0; break
    case 'hueSaturation': p.hue = 0; p.saturation = 0; p.lightness = 0; p.colorize = false; break
    case 'colorBalance':
      p.colorBalanceR = 0; p.colorBalanceG = 0; p.colorBalanceB = 0
      p.colorBalanceShadowsR = 0; p.colorBalanceShadowsG = 0; p.colorBalanceShadowsB = 0
      p.colorBalanceMidtonesR = 0; p.colorBalanceMidtonesG = 0; p.colorBalanceMidtonesB = 0
      p.colorBalanceHighlightsR = 0; p.colorBalanceHighlightsG = 0; p.colorBalanceHighlightsB = 0
      p.colorBalancePreserveLuma = true; break
    case 'blackWhiteInvert':
      p.blackAndWhite = false; p.invert = false
      p.bwReds = 40; p.bwYellows = 60; p.bwGreens = 40; p.bwCyans = 60; p.bwBlues = 20; p.bwMagentas = 80
      bwPresetSelected.value = 'default'
      break
  }
  scheduleProcess()
}

const isEditDiffuseOpen = ref(false)

function resetEditDiffuse() {
  ed.blurSize = 20; ed.avgBlurSize = 50; ed.blurContrast = 0
  ed.lightMaskPow = 0.5; ed.lightPow = 0; ed.darkMaskPow = 0.5; ed.darkPow = 0
  ed.hotSpot = 0; ed.darkSpot = 0
  ed.finalContrast = 1; ed.finalBias = 0; ed.colorLerp = 0.5; ed.saturation = 1
  scheduleProcess()
}

const groups: { key: AdjustGroup; icon: string; label: string; title: string }[] = [
  { key: 'brightnessContrast', icon: 'lucide:sun', label: '亮度对比', title: '亮度 / 对比度 (Brightness & Contrast)' },
  { key: 'levels', icon: 'lucide:sliders-horizontal', label: '精细色阶', title: '直方图与色阶 (Histogram & Levels)' },
  { key: 'curves', icon: 'lucide:trending-up', label: '反射曲线', title: '高级曲线 (Advanced Curves)' },
  { key: 'exposure', icon: 'lucide:zap', label: '曝光控制', title: '曝光度 (Exposure)' },
  { key: 'vibrance', icon: 'lucide:zap', label: '自然饱和', title: '自然饱和度 (Vibrance)' },
  { key: 'hueSaturation', icon: 'lucide:palette', label: '色相饱和', title: '色相 / 饱和度 (Hue & Saturation)' },
  { key: 'colorBalance', icon: 'lucide:scale', label: '色彩平衡', title: '色彩平衡 (Color Balance)' },
  { key: 'blackWhiteInvert', icon: 'lucide:contrast', label: '黑白反转', title: '黑白 & 反转 (Black & White & Invert)' },
]

const activeGroupData = computed(() => groups.find(g => g.key === activeGroup.value)!)

// ---- Levels (Histogram + channel tabs + drag triangles) ----
const activeLevelsChannel = ref<LevelsChannel>('rgb')
const levelTrackRef = ref<HTMLElement | null>(null)
const outLevelTrackRef = ref<HTMLElement | null>(null)
const isDraggingLevel = ref<LevelDrag>(null)
const histogramData = ref<number[]>(Array(256).fill(0))
const histogramDataR = ref<number[]>(Array(256).fill(0))
const histogramDataG = ref<number[]>(Array(256).fill(0))
const histogramDataB = ref<number[]>(Array(256).fill(0))

const levelsChannelStroke = computed(() => {
  const ch = activeLevelsChannel.value
  if (ch === 'r') return '#ef4444'; if (ch === 'g') return '#10b981'; if (ch === 'b') return '#3b82f6'
  return '#6366f1'
})
const levelsChannelFill = computed(() => {
  const ch = activeLevelsChannel.value
  if (ch === 'r') return 'rgba(239,68,68,0.12)'; if (ch === 'g') return 'rgba(16,185,129,0.12)'; if (ch === 'b') return 'rgba(59,130,246,0.12)'
  return 'rgba(99,102,241,0.12)'
})

function levelsVal(key: string, def: number): number {
  const ch = activeLevelsChannel.value
  if (ch === 'r') return (p as any)[key + 'R'] ?? def
  if (ch === 'g') return (p as any)[key + 'G'] ?? def
  if (ch === 'b') return (p as any)[key + 'B'] ?? def
  return (p as any)[key] ?? def
}
function levelsSetVal(key: string, val: number) {
  const ch = activeLevelsChannel.value
  if (ch === 'r') (p as any)[key + 'R'] = val
  else if (ch === 'g') (p as any)[key + 'G'] = val
  else if (ch === 'b') (p as any)[key + 'B'] = val
  else (p as any)[key] = val
}

const currentLevelsMin = computed({ get: () => levelsVal('levelsMin', 0), set: v => levelsSetVal('levelsMin', v) })
const currentLevelsMax = computed({ get: () => levelsVal('levelsMax', 255), set: v => levelsSetVal('levelsMax', v) })
const currentLevelsMid = computed({ get: () => levelsVal('levelsMid', 1.0), set: v => levelsSetVal('levelsMid', v) })
const currentLevelsOutMin = computed({ get: () => levelsVal('levelsOutMin', 0), set: v => levelsSetVal('levelsOutMin', v) })
const currentLevelsOutMax = computed({ get: () => levelsVal('levelsOutMax', 255), set: v => levelsSetVal('levelsOutMax', v) })

const levelsMinPercent = computed(() => (currentLevelsMin.value / 255) * 100)
const levelsMaxPercent = computed(() => (currentLevelsMax.value / 255) * 100)
const levelsMidPercent = computed(() => {
  const min = currentLevelsMin.value; const max = currentLevelsMax.value; const g = currentLevelsMid.value
  const r = 1.0 / (1.0 + g); const val = min + (max - min) * r
  return (val / 255) * 100
})
const levelsGammaIndicatorX = computed(() =>
  currentLevelsMin.value + (currentLevelsMax.value - currentLevelsMin.value) * (1.0 / (1.0 + currentLevelsMid.value))
)
const levelsOutMinPercent = computed(() => (currentLevelsOutMin.value / 255) * 100)
const levelsOutMaxPercent = computed(() => (currentLevelsOutMax.value / 255) * 100)

function getPathDForData(data: number[], height: number): string {
  if (!data.length) return ''
  let d = `M 0 ${height}`
  for (let i = 0; i < 256; i++) {
    const v = data[i] || 0
    d += ` L ${i} ${height - (v * (height * 0.92))}`
  }
  d += ` L ${height === 100 ? 255 : height - 1} ${height} Z`
  return d
}

const histogramPathD = computed(() => getPathDForData(histogramData.value, 100))

const histogramPathR = computed(() => getPathDForData(histogramDataR.value, 100))
const histogramPathG = computed(() => getPathDForData(histogramDataG.value, 100))
const histogramPathB = computed(() => getPathDForData(histogramDataB.value, 100))

const curvesHistogramPathRGB = computed(() => getPathDForData(histogramData.value, 256))
const curvesHistogramPathR = computed(() => getPathDForData(histogramDataR.value, 256))
const curvesHistogramPathG = computed(() => getPathDForData(histogramDataG.value, 256))
const curvesHistogramPathB = computed(() => getPathDForData(histogramDataB.value, 256))

function updateHistogram() {
  const src = store.sourceImage
  if (!src) {
    histogramData.value = histogramDataR.value = histogramDataG.value = histogramDataB.value = Array(256).fill(0)
    return
  }
  const w = src.naturalWidth || src.width || 128
  const h = src.naturalHeight || src.height || 128
  const tmp = document.createElement('canvas')
  const scale = Math.min(1, 128 / Math.max(w, h))
  tmp.width = Math.round(w * scale)
  tmp.height = Math.round(h * scale)
  const ctx = tmp.getContext('2d')!
  ctx.drawImage(src, 0, 0, tmp.width, tmp.height)
  const id = ctx.getImageData(0, 0, tmp.width, tmp.height)
  const binsLuma = Array(256).fill(0)
  const binsR = Array(256).fill(0)
  const binsG = Array(256).fill(0)
  const binsB = Array(256).fill(0)
  for (let i = 0; i < id.data.length; i += 4) {
    const r = id.data[i], g = id.data[i + 1], b = id.data[i + 2]
    const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    binsLuma[Math.min(255, Math.max(0, luma))]++
    binsR[Math.min(255, Math.max(0, r))]++
    binsG[Math.min(255, Math.max(0, g))]++
    binsB[Math.min(255, Math.max(0, b))]++
  }
  const maxLuma = Math.max(...binsLuma, 1)
  const maxR = Math.max(...binsR, 1)
  const maxG = Math.max(...binsG, 1)
  const maxB = Math.max(...binsB, 1)
  histogramData.value = binsLuma.map(v => v / maxLuma)
  histogramDataR.value = binsR.map(v => v / maxR)
  histogramDataG.value = binsG.map(v => v / maxG)
  histogramDataB.value = binsB.map(v => v / maxB)
}

watch(() => store.activeChannel, () => nextTick(updateHistogram))
watch(() => store.sourceImage, () => nextTick(updateHistogram))

function handleLevelDragStart(type: 'min' | 'mid' | 'max' | 'outMin' | 'outMax', event: MouseEvent) {
  event.preventDefault()
  isDraggingLevel.value = type
  const isInput = ['min', 'mid', 'max'].includes(type)

  function onMove(e: MouseEvent) {
    if (!isDraggingLevel.value) return
    const track = isInput ? levelTrackRef.value : outLevelTrackRef.value
    if (!track) return
    const rect = track.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const val = Math.min(255, Math.max(0, Math.round(relX * 255)))

    if (isDraggingLevel.value === 'min') {
      currentLevelsMin.value = Math.min(val, currentLevelsMax.value - 1)
    } else if (isDraggingLevel.value === 'max') {
      currentLevelsMax.value = Math.max(val, currentLevelsMin.value + 1)
    } else if (isDraggingLevel.value === 'mid') {
      const clamped = Math.min(currentLevelsMax.value - 1, Math.max(currentLevelsMin.value + 1, val))
      const r = (clamped - currentLevelsMin.value) / (currentLevelsMax.value - currentLevelsMin.value)
      const safeR = Math.max(0.01, Math.min(0.99, r))
      currentLevelsMid.value = Math.min(9.9, Math.max(0.1, Number((((1 - safeR) / safeR)).toFixed(2))))
    } else if (isDraggingLevel.value === 'outMin') {
      currentLevelsOutMin.value = Math.min(val, currentLevelsOutMax.value - 1)
    } else if (isDraggingLevel.value === 'outMax') {
      currentLevelsOutMax.value = Math.max(val, currentLevelsOutMin.value + 1)
    }
    scheduleProcess()
  }
  function onUp() { isDraggingLevel.value = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// ---- Curves (SVG editor) ----
const activeCurveChannel = ref<CurveChannel>('rgb')
const selectedPointIndex = ref<number | null>(0)
const svgRef = ref<SVGSVGElement | null>(null)
const isDragging = ref(false)

import type { CurvePoint } from '@/types/pbr.types'

const activePoints = computed<CurvePoint[]>({
  get() {
    const ch = activeCurveChannel.value
    if (ch === 'r') return p.curvePoints.r ?? [{ x: 0, y: 0 }, { x: 255, y: 255 }]
    if (ch === 'g') return p.curvePoints.g ?? [{ x: 0, y: 0 }, { x: 255, y: 255 }]
    if (ch === 'b') return p.curvePoints.b ?? [{ x: 0, y: 0 }, { x: 255, y: 255 }]
    return p.curvePoints.rgb ?? [{ x: 0, y: 0 }, { x: 255, y: 255 }]
  },
  set(val: CurvePoint[]) {
    const ch = activeCurveChannel.value
    if (ch === 'r') p.curvePoints.r = val
    else if (ch === 'g') p.curvePoints.g = val
    else if (ch === 'b') p.curvePoints.b = val
    else p.curvePoints.rgb = val
  }
})

const selectedPoint = computed(() => {
  const idx = selectedPointIndex.value; const pts = activePoints.value
  return idx !== null && idx < pts.length ? pts[idx] : null
})

function getMouseCoords(e: MouseEvent) {
  if (!svgRef.value) return { x: 0, y: 0 }
  const r = svgRef.value.getBoundingClientRect()
  const x = Math.min(255, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * 255)))
  const y = Math.min(255, Math.max(0, Math.round(((r.bottom - e.clientY) / r.height) * 255)))
  return { x, y }
}

function handleCurveMouseDown(e: MouseEvent) {
  e.preventDefault()
  const { x, y } = getMouseCoords(e)
  const pts = activePoints.value
  let found = -1
  for (let i = 0; i < pts.length; i++) {
    if (Math.hypot(pts[i].x - x, pts[i].y - y) < 10) { found = i; break }
  }
  if (found !== -1) {
    selectedPointIndex.value = found
  } else if (x > 0 && x < 255) {
    const newPts = [...pts, { x, y }].sort((a, b) => a.x - b.x)
    activePoints.value = newPts
    selectedPointIndex.value = newPts.findIndex(p => p.x === x && p.y === y)
    scheduleProcess()
  }
  isDragging.value = true
  window.addEventListener('mousemove', handleCurveMouseMove)
  window.addEventListener('mouseup', handleCurveMouseUp)
}

function handleCurveMouseMove(e: MouseEvent) {
  if (!isDragging.value || selectedPointIndex.value === null) return
  const { x, y } = getMouseCoords(e)
  const pts = [...activePoints.value]; const idx = selectedPointIndex.value
  if (idx === 0) pts[idx].y = y
  else if (idx === pts.length - 1) pts[idx].y = y
  else {
    pts[idx].x = Math.max(pts[idx - 1].x + 1, Math.min(pts[idx + 1].x - 1, x))
    pts[idx].y = y
  }
  activePoints.value = pts; scheduleProcess()
}

function handleCurveMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', handleCurveMouseMove)
  window.removeEventListener('mouseup', handleCurveMouseUp)
}

function handleCurveDblClick(e: MouseEvent) {
  const { x, y } = getMouseCoords(e)
  const pts = activePoints.value
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && i < pts.length - 1 && Math.hypot(pts[i].x - x, pts[i].y - y) < 10) {
      selectedPointIndex.value = i
      deleteSelectedPoint()
      return
    }
  }
}

function deleteSelectedPoint() {
  const idx = selectedPointIndex.value; const pts = activePoints.value
  if (idx === null || idx === 0 || idx === pts.length - 1) return
  activePoints.value = pts.filter((_, i) => i !== idx)
  selectedPointIndex.value = Math.min(idx, activePoints.value.length - 1)
  scheduleProcess()
}

function resetActiveCurve() {
  activePoints.value = [{ x: 0, y: 0 }, { x: 255, y: 255 }]
  selectedPointIndex.value = 0; scheduleProcess()
}

function resetAllCurves() {
  p.curvePoints = { rgb: [{x:0,y:0},{x:255,y:255}], r: [{x:0,y:0},{x:255,y:255}], g: [{x:0,y:0},{x:255,y:255}], b: [{x:0,y:0},{x:255,y:255}] }
  selectedPointIndex.value = 0; scheduleProcess()
}

function curvePathD(pts: CurvePoint[]): string {
  const lut = computeSplineLut(pts); let path = `M 0 ${255 - lut[0]}`
  for (let x = 1; x <= 255; x++) path += ` L ${x} ${255 - lut[x]}`
  return path
}

function computeSplineLut(sorted: CurvePoint[]): Uint8Array {
  const pts = [...sorted].sort((a, b) => a.x - b.x); const n = pts.length
  const x = pts.map(p => p.x); const y = pts.map(p => p.y); const lut = new Uint8Array(256)
  if (n < 2) { lut.fill(n === 1 ? Math.min(255, Math.max(0, Math.round(y[0]))) : 0); return lut }
  if (n === 2) {
    const m = (y[1] - y[0]) / (x[1] - x[0] || 0.0001)
    for (let i = 0; i < 256; i++) lut[i] = Math.min(255, Math.max(0, Math.round(y[0] + m * (i - x[0]))))
    return lut
  }
  const h = new Array(n - 1); for (let i = 0; i < n - 1; i++) h[i] = x[i + 1] - x[i]
  const alpha = new Array(n - 1); for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / (h[i] || 0.0001)) * (y[i + 1] - y[i]) - (3 / (h[i - 1] || 0.0001)) * (y[i] - y[i - 1])
  }
  const l = new Array(n), mu = new Array(n), z = new Array(n)
  l[0] = 1; mu[0] = 0; z[0] = 0
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1]
    mu[i] = h[i] / (l[i] || 0.0001); z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / (l[i] || 0.0001)
  }
  l[n - 1] = 1; z[n - 1] = 0
  const c = new Array(n).fill(0), b = new Array(n).fill(0), d = new Array(n).fill(0)
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1]
    b[j] = (y[j + 1] - y[j]) / (h[j] || 0.0001) - h[j] * (c[j + 1] + 2 * c[j]) / 3
    d[j] = (c[j + 1] - c[j]) / (3 * h[j] || 0.0001)
  }
  for (let i = 0; i < 256; i++) {
    let idx = 0; while (idx < n - 1 && i > x[idx + 1]) idx++
    lut[i] = Math.min(255, Math.max(0, Math.round(y[idx] + b[idx] * (i - x[idx]) + c[idx] * (i - x[idx]) * (i - x[idx]) + d[idx] * (i - x[idx]) * (i - x[idx]) * (i - x[idx]))))
  }
  return lut
}

function updateSelectedPoint(coord: 'x' | 'y', val: number) {
  const idx = selectedPointIndex.value; const pts = [...activePoints.value]; if (idx === null) return
  const cv = Math.min(255, Math.max(0, Math.round(val)))
  if (idx === 0 || idx === pts.length - 1) { if (coord === 'y') pts[idx].y = cv }
  else { if (coord === 'x') pts[idx].x = Math.max(pts[idx - 1].x + 1, Math.min(pts[idx + 1].x - 1, cv)); else pts[idx].y = cv }
  activePoints.value = pts; scheduleProcess()
}

const curveTabs: { key: CurveChannel; label: string; cls: string; stroke: string }[] = [
  { key: 'rgb', label: 'Composite', cls: 'bg-zinc-800 text-white font-bold', stroke: '#818cf8' },
  { key: 'r', label: 'Red', cls: 'bg-red-950/20 text-red-400 font-bold', stroke: '#ef4444' },
  { key: 'g', label: 'Green', cls: 'bg-emerald-950/20 text-emerald-400 font-bold', stroke: '#10b981' },
  { key: 'b', label: 'Blue', cls: 'bg-blue-950/20 text-blue-400 font-bold', stroke: '#3b82f6' },
]

// ---- Black & White presets ----
const bwPresetSelected = ref('default')
const bwPresets: Record<string, { name: string; values: number[] | null }> = {
  custom: { name: '自定 (Custom)', values: null },
  default: { name: '默认 (Default)', values: [40, 60, 40, 60, 20, 80] },
  blueFilter: { name: '蓝色滤镜 (Blue Filter)', values: [-31, -24, 1, 216, 128, -10] },
  greenFilter: { name: '绿色滤镜 (Green Filter)', values: [-30, 60, 110, 50, -30, -15] },
  redFilter: { name: '红色滤镜 (Red Filter)', values: [120, 70, -15, -60, -20, 30] },
  yellowFilter: { name: '黄色滤镜 (Yellow Filter)', values: [40, 130, -10, -50, -20, 30] },
  highContrastRed: { name: '高对比度红色 (High Contrast Red)', values: [150, 100, -10, -80, -30, 20] },
  infrared: { name: '红外线 (Infrared)', values: [-70, 200, 50, -50, -30, 150] },
}
function applyBWPreset(key: string) {
  bwPresetSelected.value = key
  const pr = bwPresets[key]
  if (pr && pr.values) {
    p.bwReds = pr.values[0]; p.bwYellows = pr.values[1]; p.bwGreens = pr.values[2]
    p.bwCyans = pr.values[3]; p.bwBlues = pr.values[4]; p.bwMagentas = pr.values[5]
    scheduleProcess()
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="border-b border-zinc-800/50 pb-2">
      <span class="text-xs font-bold text-indigo-400 tracking-wider font-mono">Base Color</span>
    </div>

    <div class="grid grid-cols-4 gap-1.5">
      <button v-for="g in groups" :key="g.key" @click="activeGroup = g.key"
        class="flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer group"
        :class="activeGroup === g.key ? 'bg-indigo-600/20 border-indigo-500/80 text-indigo-400 font-bold shadow-md shadow-indigo-500/10' : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'">
        <Icon :icon="g.icon" class="w-3.5 h-3.5 mb-1 transition-transform group-hover:scale-110" />
        <span class="text-[9px] truncate w-full">{{ g.label }}</span>
      </button>
    </div>

    <div class="bg-[#18181b] border border-zinc-800 rounded-lg overflow-hidden">
      <div class="w-full flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800/50">
        <div class="flex items-center gap-1.5 font-bold text-zinc-300 text-[11px]">
          <Icon :icon="activeGroupData.icon" class="w-3.5 h-3.5 text-indigo-400" />
          <span>{{ activeGroupData.title }}</span>
        </div>
        <button @click.stop="resetGroup(activeGroup)" class="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-indigo-400 rounded-md transition-all cursor-pointer" title="重置该组所有参数">↺</button>
      </div>
      <div class="p-3 space-y-3">

        <!-- brightnessContrast -->
        <template v-if="activeGroup === 'brightnessContrast'">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>亮度 (Brightness)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.brightness" min="-150" max="150" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('brightness', 0)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div>
            <input type="range" v-model.number="p.brightness" min="-150" max="150" class="flex-1 accent-indigo-500" @input="scheduleProcess" />
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>对比度 (Contrast)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.contrast" min="-150" max="150" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('contrast', 0)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div>
            <input type="range" v-model.number="p.contrast" min="-150" max="150" class="flex-1 accent-indigo-500" @input="scheduleProcess" />
          </div>
        </template>

        <!-- levels -->
        <template v-if="activeGroup === 'levels'">
          <div class="flex items-center gap-1 bg-zinc-950 p-1 rounded-md border border-zinc-900 select-none">
            <button @click="activeLevelsChannel = 'rgb'"
              :class="activeLevelsChannel === 'rgb' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'"
              class="flex-1 py-1 text-center text-[10px] rounded transition-all cursor-pointer">Composite</button>
            <button @click="activeLevelsChannel = 'r'"
              :class="activeLevelsChannel === 'r' ? 'bg-red-950/20 text-red-400 font-bold' : 'text-zinc-400 hover:text-red-400'"
              class="flex-1 py-1 text-center text-[10px] rounded transition-all cursor-pointer">Red</button>
            <button @click="activeLevelsChannel = 'g'"
              :class="activeLevelsChannel === 'g' ? 'bg-emerald-950/20 text-emerald-400 font-bold' : 'text-zinc-400 hover:text-emerald-400'"
              class="flex-1 py-1 text-center text-[10px] rounded transition-all cursor-pointer">Green</button>
            <button @click="activeLevelsChannel = 'b'"
              :class="activeLevelsChannel === 'b' ? 'bg-blue-950/20 text-blue-400 font-bold' : 'text-zinc-400 hover:text-blue-400'"
              class="flex-1 py-1 text-center text-[10px] rounded transition-all cursor-pointer">Blue</button>
          </div>
          <div class="space-y-1">
            <div class="relative w-full h-24 bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden select-none">
              <svg viewBox="0 0 255 100" preserveAspectRatio="none" class="w-full h-full absolute inset-0">
                <line x1="63.75" y1="0" x2="63.75" y2="100" stroke="#27272a" stroke-width="0.5" stroke-dasharray="2,2" />
                <line x1="127.5" y1="0" x2="127.5" y2="100" stroke="#27272a" stroke-width="0.5" stroke-dasharray="2,2" />
                <line x1="191.25" y1="0" x2="191.25" y2="100" stroke="#27272a" stroke-width="0.5" stroke-dasharray="2,2" />
                <path :d="histogramPathD" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.1)" stroke-width="0.6" />
                <path :d="histogramPathR" fill="rgba(239,68,68,0.01)" stroke="rgba(239,68,68,0.1)" stroke-width="0.6" />
                <path :d="histogramPathG" fill="rgba(16,185,129,0.01)" stroke="rgba(16,185,129,0.1)" stroke-width="0.6" />
                <path :d="histogramPathB" fill="rgba(59,130,246,0.01)" stroke="rgba(59,130,246,0.1)" stroke-width="0.6" />
                <path :d="histogramPathD" :fill="levelsChannelFill" :stroke="levelsChannelStroke" stroke-width="1.2" stroke-linecap="round" />
                <line :x1="currentLevelsMin" y1="0" :x2="currentLevelsMin" y2="100" :stroke="activeLevelsChannel === 'rgb' ? '#ef4444' : (activeLevelsChannel === 'r' ? '#f87171' : '#71717a')" stroke-width="0.8" stroke-dasharray="1,1" />
                <line :x1="currentLevelsMax" y1="0" :x2="currentLevelsMax" y2="100" :stroke="activeLevelsChannel === 'rgb' ? '#10b981' : (activeLevelsChannel === 'g' ? '#34d399' : '#71717a')" stroke-width="0.8" stroke-dasharray="1,1" />
                <line :x1="levelsGammaIndicatorX" y1="0" :x2="levelsGammaIndicatorX" y2="100" stroke="#71717a" stroke-width="0.8" stroke-dasharray="1,1" />
              </svg>
            </div>
            <div ref="levelTrackRef" class="h-6 relative bg-zinc-900 rounded-md border border-zinc-800/80 select-none">
              <div class="absolute top-[3px] -ml-2.5 w-5 h-5 cursor-ew-resize flex flex-col items-center group transition-transform hover:scale-110 active:scale-95" :style="{ left: levelsMinPercent + '%' }" @mousedown="handleLevelDragStart('min', $event)"><div class="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[11px] border-b-black drop-shadow" /></div>
              <div class="absolute top-[3px] -ml-2.5 w-5 h-5 cursor-ew-resize flex flex-col items-center group transition-transform hover:scale-110 active:scale-95" :style="{ left: levelsMidPercent + '%' }" @mousedown="handleLevelDragStart('mid', $event)"><div class="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[11px] border-b-zinc-400 drop-shadow" /></div>
              <div class="absolute top-[3px] -ml-2.5 w-5 h-5 cursor-ew-resize flex flex-col items-center group transition-transform hover:scale-110 active:scale-95" :style="{ left: levelsMaxPercent + '%' }" @mousedown="handleLevelDragStart('max', $event)"><div class="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[11px] border-b-white drop-shadow" /></div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2 mt-1">
            <div class="flex flex-col gap-1 text-center font-mono">
              <span class="text-[9px] text-zinc-500 font-bold tracking-tight">输入黑色</span>
              <input type="number" v-model.number="currentLevelsMin" :min="0" :max="currentLevelsMax - 1" class="w-full bg-zinc-950 border border-zinc-800 rounded px-1 py-1 text-center text-red-400 font-mono text-xs outline-none focus:border-red-500" @input="scheduleProcess" />
            </div>
            <div class="flex flex-col gap-1 text-center font-mono">
              <span class="text-[9px] text-zinc-500 font-bold tracking-tight">灰度系数</span>
              <input type="number" v-model.number="currentLevelsMid" min="0.10" max="9.90" step="0.05" class="w-full bg-zinc-950 border border-zinc-800 rounded px-1 py-1 text-center text-zinc-300 font-mono text-xs outline-none focus:border-zinc-500" @input="scheduleProcess" />
            </div>
            <div class="flex flex-col gap-1 text-center font-mono">
              <span class="text-[9px] text-zinc-500 font-bold tracking-tight">输入白色</span>
              <input type="number" v-model.number="currentLevelsMax" :min="currentLevelsMin + 1" max="255" class="w-full bg-zinc-950 border border-zinc-800 rounded px-1 py-1 text-center text-emerald-400 font-mono text-xs outline-none focus:border-emerald-500" @input="scheduleProcess" />
            </div>
          </div>
          <div class="border-t border-zinc-800/60 pt-3 flex flex-col gap-2">
            <div class="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wide"><span>输出色阶 (Output Levels)</span></div>
            <div ref="outLevelTrackRef" style="background: linear-gradient(to right, rgb(0,0,0), rgb(255,255,255))" class="h-6 relative rounded-md border border-zinc-800/80 select-none">
              <div class="absolute top-[3px] -ml-2.5 w-5 h-5 cursor-ew-resize flex flex-col items-center group transition-transform hover:scale-110 active:scale-95" :style="{ left: levelsOutMinPercent + '%' }" @mousedown="handleLevelDragStart('outMin', $event)"><div class="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[11px] border-b-black drop-shadow" /></div>
              <div class="absolute top-[3px] -ml-2.5 w-5 h-5 cursor-ew-resize flex flex-col items-center group transition-transform hover:scale-110 active:scale-95" :style="{ left: levelsOutMaxPercent + '%' }" @mousedown="handleLevelDragStart('outMax', $event)"><div class="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[11px] border-b-white drop-shadow" /></div>
            </div>
            <div class="grid grid-cols-2 gap-3 mt-1.5 font-mono">
              <div class="flex flex-col gap-1 text-center font-mono">
                <span class="text-[9px] text-zinc-500 font-bold tracking-tight">输出黑色 (Min)</span>
                <input type="number" v-model.number="currentLevelsOutMin" :min="0" :max="currentLevelsOutMax - 1" class="w-full bg-zinc-950 border border-zinc-800 rounded px-1 py-1 text-center text-indigo-300 font-mono text-xs outline-none focus:border-indigo-500" @input="scheduleProcess" />
              </div>
              <div class="flex flex-col gap-1 text-center font-mono">
                <span class="text-[9px] text-zinc-500 font-bold tracking-tight">输出白色 (Max)</span>
                <input type="number" v-model.number="currentLevelsOutMax" :min="currentLevelsOutMin + 1" max="255" class="w-full bg-zinc-950 border border-zinc-800 rounded px-1 py-1 text-center text-slate-100 font-mono text-xs outline-none focus:border-indigo-500" @input="scheduleProcess" />
              </div>
            </div>
          </div>
        </template>

        <!-- curves -->
        <template v-if="activeGroup === 'curves'">
          <div class="flex items-center gap-1 bg-zinc-950 p-1 rounded-md border border-zinc-900">
            <button v-for="t in curveTabs" :key="t.key" @click="activeCurveChannel = t.key; selectedPointIndex = 0"
              class="flex-1 py-1 text-center text-[10px] rounded transition-all cursor-pointer"
              :class="activeCurveChannel === t.key ? t.cls : 'text-zinc-400 hover:text-zinc-200'">{{ t.label }}</button>
          </div>
          <div class="flex justify-center select-none">
            <div class="relative w-[220px] h-[220px] bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
              <svg ref="svgRef" viewBox="0 0 256 256" class="w-full h-full cursor-crosshair" @mousedown="handleCurveMouseDown" @dblclick.stop="handleCurveDblClick">
                <line x1="64" y1="0" x2="64" y2="256" stroke="#27272a" stroke-dasharray="2,2" stroke-width="1" />
                <line x1="128" y1="0" x2="128" y2="256" stroke="#27272a" stroke-width="1" />
                <line x1="192" y1="0" x2="192" y2="256" stroke="#27272a" stroke-dasharray="2,2" stroke-width="1" />
                <line x1="0" y1="64" x2="256" y2="64" stroke="#27272a" stroke-dasharray="2,2" stroke-width="1" />
                <line x1="0" y1="128" x2="256" y2="128" stroke="#27272a" stroke-width="1" />
                <line x1="0" y1="192" x2="256" y2="192" stroke="#27272a" stroke-dasharray="2,2" stroke-width="1" />
                <line x1="0" y1="256" x2="256" y2="0" stroke="#3f3f46" stroke-dasharray="3,4" stroke-width="1" />
                <path :d="curvesHistogramPathRGB" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.08)" stroke-width="0.7" stroke-linecap="round" />
                <path :d="curvesHistogramPathR" fill="rgba(239,68,68,0.005)" stroke="rgba(239,68,68,0.06)" stroke-width="0.7" stroke-linecap="round" />
                <path :d="curvesHistogramPathG" fill="rgba(16,185,129,0.005)" stroke="rgba(16,185,129,0.06)" stroke-width="0.7" stroke-linecap="round" />
                <path :d="curvesHistogramPathB" fill="rgba(59,130,246,0.005)" stroke="rgba(59,130,246,0.06)" stroke-width="0.7" stroke-linecap="round" />
                <path v-if="activeCurveChannel === 'rgb'" :d="curvesHistogramPathRGB" fill="rgba(129,140,248,0.08)" stroke="rgba(129,140,248,0.25)" stroke-width="1.2" stroke-linecap="round" />
                <path v-else-if="activeCurveChannel === 'r'" :d="curvesHistogramPathR" fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.25)" stroke-width="1.2" stroke-linecap="round" />
                <path v-else-if="activeCurveChannel === 'g'" :d="curvesHistogramPathG" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.25)" stroke-width="1.2" stroke-linecap="round" />
                <path v-else-if="activeCurveChannel === 'b'" :d="curvesHistogramPathB" fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.25)" stroke-width="1.2" stroke-linecap="round" />
                <path v-if="activeCurveChannel !== 'rgb'" :d="curvePathD(p.curvePoints.rgb)" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
                <path v-if="activeCurveChannel !== 'r'" :d="curvePathD(p.curvePoints.r)" fill="none" stroke="rgba(239,68,68,0.15)" stroke-width="1" />
                <path v-if="activeCurveChannel !== 'g'" :d="curvePathD(p.curvePoints.g)" fill="none" stroke="rgba(16,185,129,0.15)" stroke-width="1" />
                <path v-if="activeCurveChannel !== 'b'" :d="curvePathD(p.curvePoints.b)" fill="none" stroke="rgba(59,130,246,0.15)" stroke-width="1" />
                <path :d="curvePathD(activePoints)" fill="none"
                  :stroke="curveTabs.find(t => t.key === activeCurveChannel)?.stroke ?? '#818cf8'" stroke-width="2" />
                <circle v-for="(pt, i) in activePoints" :key="i" :cx="pt.x" :cy="255 - pt.y" :r="selectedPointIndex === i ? 5.5 : 4"
                  :fill="selectedPointIndex === i ? '#fff' : curveTabs.find(t => t.key === activeCurveChannel)?.stroke ?? '#818cf8'"
                  :stroke="selectedPointIndex === i ? curveTabs.find(t => t.key === activeCurveChannel)?.stroke ?? '#818cf8' : 'transparent'"
                  stroke-width="2" style="pointer-events: none" />
              </svg>
            </div>
          </div>
          <div class="flex items-center gap-2 text-[10px] text-zinc-400">
            <span class="font-bold">输入 (X):</span>
            <input type="number" :value="selectedPoint?.x ?? 0" @input="updateSelectedPoint('x', parseInt(($event.target as any).value) || 0)" min="0" max="255"
              :disabled="selectedPointIndex === 0 || selectedPointIndex === activePoints.length - 1"
              class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50 disabled:opacity-40" />
            <span class="font-bold">输出 (Y):</span>
            <input type="number" :value="selectedPoint?.y ?? 0" @input="updateSelectedPoint('y', parseInt(($event.target as any).value) || 0)" min="0" max="255"
              class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-zinc-300 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" />
            <button @click="deleteSelectedPoint" :disabled="selectedPointIndex === null || selectedPointIndex === 0 || selectedPointIndex === activePoints.length - 1"
              class="ml-auto text-[10px] px-2 py-0.5 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all">删除控制点</button>
          </div>
          <button @click="resetAllCurves" class="w-full text-[10px] py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-indigo-400 rounded cursor-pointer transition-all">重置所有曲线</button>
        </template>

        <!-- exposure -->
        <template v-if="activeGroup === 'exposure'">
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>曝光度 (Exposure)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.exposure" min="-100" max="100" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('exposure', 0)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="p.exposure" min="-100" max="100" class="flex-1 accent-indigo-500" @input="scheduleProcess" /></div>
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>偏移 (Offset)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.exposureOffset" min="-0.5" max="0.5" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('exposureOffset', 0)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="p.exposureOffset" min="-0.5" max="0.5" step="0.01" class="flex-1 accent-indigo-500" @input="scheduleProcess" /></div>
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>伽马 (Gamma)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.exposureGamma" min="0.1" max="3.0" step="0.05" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('exposureGamma', 1.0)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="p.exposureGamma" min="0.1" max="3.0" step="0.05" class="flex-1 accent-indigo-500" @input="scheduleProcess" /></div>
        </template>

        <!-- vibrance -->
        <template v-if="activeGroup === 'vibrance'">
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>自然饱和度 (Vibrance)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.vibrance" min="-100" max="100" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('vibrance', 0)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="p.vibrance" min="-100" max="100" class="flex-1 accent-indigo-500" @input="scheduleProcess" /></div>
        </template>

        <!-- hueSaturation -->
        <template v-if="activeGroup === 'hueSaturation'">
          <div class="flex items-center justify-between text-xs text-zinc-400 font-bold"><span>着色 (Colorize)</span><div class="flex items-center gap-1.5"><input type="checkbox" v-model="p.colorize" class="accent-indigo-500 cursor-pointer w-4 h-4" @change="scheduleProcess" /><button @click="resetSingleParam('colorize', false)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div>
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>色相 (Hue)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.hue" min="-180" max="180" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('hue', 0)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="p.hue" min="-180" max="180" class="flex-1 accent-indigo-500" @input="scheduleProcess" /></div>
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>饱和度 (Saturation)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.saturation" min="-100" max="100" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('saturation', 0)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="p.saturation" min="-100" max="100" class="flex-1 accent-indigo-500" @input="scheduleProcess" /></div>
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>明度 (Lightness)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.lightness" min="-100" max="100" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('lightness', 0)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="p.lightness" min="-100" max="100" class="flex-1 accent-indigo-500" @input="scheduleProcess" /></div>
        </template>

        <!-- colorBalance -->
        <template v-if="activeGroup === 'colorBalance'">
          <div class="flex items-center justify-between text-xs text-zinc-400 font-bold"><span>保持亮度 (Preserve Luma)</span><div class="flex items-center gap-1.5"><input type="checkbox" v-model="p.colorBalancePreserveLuma" class="accent-indigo-500 cursor-pointer w-4 h-4" @change="scheduleProcess" /><button @click="resetSingleParam('colorBalancePreserveLuma', true)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div>
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span class="text-red-400">青 — 红 (Cyan-Red)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.colorBalanceR" min="-100" max="100" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-red-400 font-mono text-[10px] focus:outline-none focus:border-red-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('colorBalanceR', 0)" class="text-zinc-600 hover:text-red-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="p.colorBalanceR" min="-100" max="100" class="flex-1 accent-red-500" @input="scheduleProcess" /></div>
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span class="text-emerald-400">洋红 — 绿 (Magenta-Green)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.colorBalanceG" min="-100" max="100" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-emerald-400 font-mono text-[10px] focus:outline-none focus:border-emerald-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('colorBalanceG', 0)" class="text-zinc-600 hover:text-emerald-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="p.colorBalanceG" min="-100" max="100" class="flex-1 accent-emerald-500" @input="scheduleProcess" /></div>
          <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span class="text-blue-400">黄 — 蓝 (Yellow-Blue)</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="p.colorBalanceB" min="-100" max="100" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-blue-400 font-mono text-[10px] focus:outline-none focus:border-blue-500/50" @input="scheduleProcess" /><button @click="resetSingleParam('colorBalanceB', 0)" class="text-zinc-600 hover:text-blue-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="p.colorBalanceB" min="-100" max="100" class="flex-1 accent-blue-500" @input="scheduleProcess" /></div>
        </template>

        <!-- blackWhiteInvert -->
        <template v-if="activeGroup === 'blackWhiteInvert'">
          <div class="space-y-4">
            <div class="flex items-center justify-between text-xs text-zinc-400 font-bold"><span>黑白过滤 (Black &amp; White)</span><div class="flex items-center gap-1.5"><input type="checkbox" v-model="p.blackAndWhite" class="accent-indigo-500 cursor-pointer w-4 h-4" @change="scheduleProcess" /><button @click="resetSingleParam('blackAndWhite', false)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div>
            <div class="flex items-center justify-between text-xs text-zinc-400 font-bold"><span>反转图像颜色 (Invert colors)</span><div class="flex items-center gap-1.5"><input type="checkbox" v-model="p.invert" class="accent-indigo-500 cursor-pointer w-4 h-4" @change="scheduleProcess" /><button @click="resetSingleParam('invert', false)" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div>
            <div v-if="p.blackAndWhite" class="border-t border-zinc-800/60 pt-4 space-y-3">
              <div class="flex items-center justify-between text-xs text-zinc-400 font-bold mb-1">
                <span>预设 (Preset)</span>
                <select :value="bwPresetSelected" @change="applyBWPreset(($event.target as HTMLSelectElement).value)"
                  class="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-indigo-400 font-medium text-xs outline-none focus:border-indigo-500 cursor-pointer">
                  <option v-for="(pr, key) in bwPresets" :key="key" :value="key">{{ pr.name }}</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between text-xs text-zinc-400">
                  <span class="flex items-center gap-1.5 font-bold"><span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>红色 (Reds)</span>
                  <div class="flex items-center gap-1.5">
                    <input type="number" v-model.number="p.bwReds" min="-200" max="300" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-red-400 font-mono text-[10px] focus:outline-none focus:border-red-500/50" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
                    <button @click="p.bwReds = 40; bwPresetSelected = 'custom'; scheduleProcess()" class="text-zinc-600 hover:text-red-400 p-0.5 cursor-pointer" title="回到默认值">↺</button>
                  </div>
                </div>
                <input type="range" v-model.number="p.bwReds" min="-200" max="300" class="flex-1 accent-red-500" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between text-xs text-zinc-400">
                  <span class="flex items-center gap-1.5 font-bold"><span class="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>黄色 (Yellows)</span>
                  <div class="flex items-center gap-1.5">
                    <input type="number" v-model.number="p.bwYellows" min="-200" max="300" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-yellow-400 font-mono text-[10px] focus:outline-none focus:border-yellow-500/50" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
                    <button @click="p.bwYellows = 60; bwPresetSelected = 'custom'; scheduleProcess()" class="text-zinc-600 hover:text-yellow-400 p-0.5 cursor-pointer" title="回到默认值">↺</button>
                  </div>
                </div>
                <input type="range" v-model.number="p.bwYellows" min="-200" max="300" class="flex-1 accent-yellow-400" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between text-xs text-zinc-400">
                  <span class="flex items-center gap-1.5 font-bold"><span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>绿色 (Greens)</span>
                  <div class="flex items-center gap-1.5">
                    <input type="number" v-model.number="p.bwGreens" min="-200" max="300" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-green-400 font-mono text-[10px] focus:outline-none focus:border-green-500/50" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
                    <button @click="p.bwGreens = 40; bwPresetSelected = 'custom'; scheduleProcess()" class="text-zinc-600 hover:text-green-400 p-0.5 cursor-pointer" title="回到默认值">↺</button>
                  </div>
                </div>
                <input type="range" v-model.number="p.bwGreens" min="-200" max="300" class="flex-1 accent-green-500" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between text-xs text-zinc-400">
                  <span class="flex items-center gap-1.5 font-bold"><span class="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>青色 (Cyans)</span>
                  <div class="flex items-center gap-1.5">
                    <input type="number" v-model.number="p.bwCyans" min="-200" max="300" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-cyan-400 font-mono text-[10px] focus:outline-none focus:border-cyan-500/50" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
                    <button @click="p.bwCyans = 60; bwPresetSelected = 'custom'; scheduleProcess()" class="text-zinc-600 hover:text-cyan-400 p-0.5 cursor-pointer" title="回到默认值">↺</button>
                  </div>
                </div>
                <input type="range" v-model.number="p.bwCyans" min="-200" max="300" class="flex-1 accent-cyan-400" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between text-xs text-zinc-400">
                  <span class="flex items-center gap-1.5 font-bold"><span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>蓝色 (Blues)</span>
                  <div class="flex items-center gap-1.5">
                    <input type="number" v-model.number="p.bwBlues" min="-200" max="300" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-blue-400 font-mono text-[10px] focus:outline-none focus:border-blue-500/50" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
                    <button @click="p.bwBlues = 20; bwPresetSelected = 'custom'; scheduleProcess()" class="text-zinc-600 hover:text-blue-400 p-0.5 cursor-pointer" title="回到默认值">↺</button>
                  </div>
                </div>
                <input type="range" v-model.number="p.bwBlues" min="-200" max="300" class="flex-1 accent-blue-500" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between text-xs text-zinc-400">
                  <span class="flex items-center gap-1.5 font-bold"><span class="w-2.5 h-2.5 rounded-full bg-fuchsia-500"></span>洋红 (Magentas)</span>
                  <div class="flex items-center gap-1.5">
                    <input type="number" v-model.number="p.bwMagentas" min="-200" max="300" class="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-fuchsia-400 font-mono text-[10px] focus:outline-none focus:border-fuchsia-500/50" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
                    <button @click="p.bwMagentas = 80; bwPresetSelected = 'custom'; scheduleProcess()" class="text-zinc-600 hover:text-fuchsia-400 p-0.5 cursor-pointer" title="回到默认值">↺</button>
                  </div>
                </div>
                <input type="range" v-model.number="p.bwMagentas" min="-200" max="300" class="flex-1 accent-fuchsia-500" @input="bwPresetSelected = 'custom'; scheduleProcess()" />
              </div>
            </div>
          </div>
        </template>

      </div>
    </div>

    <!-- Edit Diffuse -->
    <button @click="isEditDiffuseOpen = !isEditDiffuseOpen"
      class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer border"
      :class="isEditDiffuseOpen ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-400 hover:text-zinc-300'">
      <span>Edit Base Color (Remove Lighting)</span>
      <span class="text-[10px]" :class="isEditDiffuseOpen ? 'rotate-180' : ''">▼</span>
    </button>
    <div v-if="isEditDiffuseOpen" class="mt-3 p-3 space-y-2">
        <div class="text-[9px] text-zinc-500">Remove baked lighting and shadow info from Base Color</div>
        <div class="flex items-center justify-between text-xs text-zinc-400 font-bold"><span>启用</span><input type="checkbox" v-model="ed.enabled" class="accent-indigo-500 cursor-pointer w-4 h-4" /></div>
        <div :class="{ 'opacity-40 pointer-events-none': !ed.enabled }">
          <div class="space-y-2">
            <div class="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1">模糊</div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>叠加模糊</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.blurSize" min="5" max="100" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.blurSize = 20" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.blurSize" min="5" max="100" class="flex-1 accent-indigo-500" /></div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>平均颜色模糊</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.avgBlurSize" min="5" max="100" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.avgBlurSize = 50" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.avgBlurSize" min="5" max="100" class="flex-1 accent-indigo-500" /></div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>叠加对比度</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.blurContrast" min="-1" max="1" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.blurContrast = 0" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.blurContrast" min="-1" max="1" step="0.01" class="flex-1 accent-indigo-500" /></div>
            <div class="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1 mt-3">光照去除</div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>光照遮罩</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.lightMaskPow" min="0" max="1" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.lightMaskPow = 0.5" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.lightMaskPow" min="0" max="1" step="0.01" class="flex-1 accent-indigo-500" /></div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>光照强度</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.lightPow" min="0" max="1" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.lightPow = 0" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.lightPow" min="0" max="1" step="0.01" class="flex-1 accent-indigo-500" /></div>
            <div class="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1 mt-3">阴影去除</div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>阴影遮罩</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.darkMaskPow" min="0" max="1" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.darkMaskPow = 0.5" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.darkMaskPow" min="0" max="1" step="0.01" class="flex-1 accent-indigo-500" /></div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>阴影强度</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.darkPow" min="0" max="1" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.darkPow = 0" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.darkPow" min="0" max="1" step="0.01" class="flex-1 accent-indigo-500" /></div>
            <div class="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1 mt-3">斑点去除</div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>亮点阈值</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.hotSpot" min="0" max="1" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.hotSpot = 0" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.hotSpot" min="0" max="1" step="0.01" class="flex-1 accent-indigo-500" /></div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>暗点阈值</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.darkSpot" min="0" max="1" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.darkSpot = 0" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.darkSpot" min="0" max="1" step="0.01" class="flex-1 accent-indigo-500" /></div>
            <div class="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1 mt-3">输出</div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>对比度</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.finalContrast" min="-2" max="2" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.finalContrast = 1" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.finalContrast" min="-2" max="2" step="0.01" class="flex-1 accent-indigo-500" /></div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>偏移</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.finalBias" min="-0.5" max="0.5" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.finalBias = 0" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.finalBias" min="-0.5" max="0.5" step="0.01" class="flex-1 accent-indigo-500" /></div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>颜色保留</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.colorLerp" min="0" max="1" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.colorLerp = 0.5" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.colorLerp" min="0" max="1" step="0.01" class="flex-1 accent-indigo-500" /></div>
            <div class="flex flex-col gap-1.5"><div class="flex items-center justify-between text-xs text-zinc-500 font-bold"><span>饱和度</span><div class="flex items-center gap-1.5"><input type="number" v-model.number="ed.saturation" min="0" max="1" step="0.01" class="w-14 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center text-indigo-400 font-mono text-[10px] focus:outline-none focus:border-indigo-500/50" /><button @click="ed.saturation = 1" class="text-zinc-600 hover:text-indigo-400 p-0.5 cursor-pointer" title="回到默认值">↺</button></div></div><input type="range" v-model.number="ed.saturation" min="0" max="1" step="0.01" class="flex-1 accent-indigo-500" /></div>
          </div>
        </div>
      </div>
    </div>
</template>
