import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import * as THREE from 'three'
import type {
  PBRChannel, ChannelData, ChannelParams, ColorSample,
  AlbedoParams, DisplacementParams, NormalParams,
  RoughnessParams, MetallicParams, AOParams, EdgeParams,
  ViewportMode, GeometryType, TilingParams, LightingPreset,
} from '@/types/pbr.types'
import { ALL_CHANNELS, TOPOLOGICAL_ORDER, CHANNEL_DEPENDENCIES, CHANNEL_PROMPT_TEMPLATES } from '@/types/pbr.types'

function createDefaultChannelData(): Record<PBRChannel, ChannelData> {
  const result = {} as Record<PBRChannel, ChannelData>
  for (const ch of ALL_CHANNELS) {
    result[ch] = { canvas: null, thumbnail: '', dirty: false, hasCustomMap: false }
  }
  return result
}

function createDefaultParams(): Record<PBRChannel, ChannelParams> {
  return {
    albedo: {
      brightness: 0, contrast: 0, invert: false,
      exposure: 0, exposureOffset: 0, exposureGamma: 1.0,
      colorBalanceR: 0, colorBalanceG: 0, colorBalanceB: 0,
      colorBalanceShadowsR: 0, colorBalanceShadowsG: 0, colorBalanceShadowsB: 0,
      colorBalanceMidtonesR: 0, colorBalanceMidtonesG: 0, colorBalanceMidtonesB: 0,
      colorBalanceHighlightsR: 0, colorBalanceHighlightsG: 0, colorBalanceHighlightsB: 0,
      colorBalancePreserveLuma: true,
      blackAndWhite: false,
      bwReds: 40, bwYellows: 60, bwGreens: 40, bwCyans: 60, bwBlues: 20, bwMagentas: 80,
      levelsMin: 0, levelsMax: 255, levelsMid: 1.0, levelsOutMin: 0, levelsOutMax: 255,
      levelsMinR: 0, levelsMaxR: 255, levelsMidR: 1.0, levelsOutMinR: 0, levelsOutMaxR: 255,
      levelsMinG: 0, levelsMaxG: 255, levelsMidG: 1.0, levelsOutMinG: 0, levelsOutMaxG: 255,
      levelsMinB: 0, levelsMaxB: 255, levelsMidB: 1.0, levelsOutMinB: 0, levelsOutMaxB: 255,
      curvePoints: { rgb: [{x:0,y:0},{x:255,y:255}], r: [{x:0,y:0},{x:255,y:255}], g: [{x:0,y:0},{x:255,y:255}], b: [{x:0,y:0},{x:255,y:255}] },
      eq1: 0, eq2: 0, eq3: 0, eq4: 0, eq5: 0, eq6: 0,
      hue: 0, saturation: 0, lightness: 0, vibrance: 0, colorize: false,
      editDiffuse: {
        enabled: false, blurSize: 20, avgBlurSize: 50, blurContrast: 0,
        lightMaskPow: 0.5, lightPow: 0, darkMaskPow: 0.5, darkPow: 0,
        hotSpot: 0, darkSpot: 0, finalContrast: 1, finalBias: 0,
        colorLerp: 0.5, saturation: 1,
      },
    } as AlbedoParams,
    displacement: {
      reveal: 0.5,
      sourceMode: 'diffuse',
      weights: [0.15, 0.19, 0.30, 0.50, 0.70, 0.90, 1.00],
      contrasts: [1, 1, 1, 1, 1, 1, 1],
      samples: [
        { enabled: false, color: [0, 0, 0], hueWeight: 1.0, satWeight: 0.5, lumWeight: 0.2, maskLow: 0.0, maskHigh: 1.0, targetValue: 0.5, isolate: false },
        { enabled: false, color: [0, 0, 0], hueWeight: 1.0, satWeight: 0.5, lumWeight: 0.2, maskLow: 0.0, maskHigh: 1.0, targetValue: 0.3, isolate: false },
      ],
      sampleBlend: 0.5,
      finalGain: 0, finalContrast: 1.5, finalBias: 0, invert: false,
      spread: 50, spreadBoost: 1.0,
    } as DisplacementParams,
    normal: {
      reveal: 0.5, preContrast: 20,
      weights: [0.30, 0.35, 0.50, 0.80, 1.00, 0.95, 0.80],
      angularity: 0, angularIntensity: 0.5,
      finalContrast: 5, invertY: false, invert: false,
      shapeRecognition: 0, lightRotation: 0, shapeBias: 0.5, slopeBlur: 50,
    } as NormalParams,
    roughness: {
      reveal: 0.5, metalSmoothness: 0.7, baseSmoothness: 0.1,
      samples: [
        { enabled: false, color: [0, 0, 0], hueWeight: 1.0, satWeight: 0.5, lumWeight: 0.2, maskLow: 0.0, maskHigh: 1.0, targetValue: 0.5, isolate: false },
        { enabled: false, color: [0, 0, 0], hueWeight: 1.0, satWeight: 0.5, lumWeight: 0.2, maskLow: 0.0, maskHigh: 1.0, targetValue: 0.3, isolate: false },
      ],
      sampleBlend: 0.5,
      sampleBlurSize: 0, highPassBlurSize: 30, highPassOverlay: 3.0,
      finalContrast: 1.0, finalBias: 0, invert: true,
    } as RoughnessParams,
    metallic: {
      reveal: 0.5,
      sample: { enabled: false, color: [0, 0, 0], hueWeight: 1.0, satWeight: 0.5, lumWeight: 0.2, maskLow: 0.0, maskHigh: 1.0, targetValue: 0.5, isolate: false },
      blurSize: 0, overlayBlurSize: 30, highPassOverlay: 1.0,
      finalContrast: 1.0, finalBias: 0, invert: false,
    } as MetallicParams,
    ao: {
      spread: 50, depth: 100, iterations: 100, samples: 50,
      invertY: false, aoBlend: 0.5,
      aoPower: 1.0, aoBias: 0, invert: false,
    } as AOParams,
    edge: {
      preContrast: 1.0,
      weights: [0.30, 0.50, 0.70, 1.00, 0.80, 0.50, 0.30],
      edgeAmount: 1.0, creviceAmount: 1.0, pinch: 1.0, pillow: 1.0,
      invertY: false, finalContrast: 2.0, finalBias: 0, invert: false,
    } as EdgeParams,
  }
}

export const usePBRStore = defineStore('pbr', () => {
  const sourceImage = ref<HTMLImageElement | null>(null)
  const sourceFileName = ref('')
  const sourceImageUrl = ref('')
  const albedoBaseCanvas = ref<HTMLCanvasElement | null>(null)
  const channelPrompts = reactive<Record<PBRChannel, string>>({ ...CHANNEL_PROMPT_TEMPLATES })
  const channels = reactive(createDefaultChannelData())
  const renderTargets = reactive<Record<PBRChannel, THREE.WebGLRenderTarget | null>>(
    { albedo: null, displacement: null, normal: null, roughness: null, metallic: null, ao: null, edge: null },
  )
  const params = reactive<Record<PBRChannel, Record<string, any>>>(createDefaultParams() as any)
  const activeChannel = ref<PBRChannel>('albedo')
  const targetResolution = ref(1024)
  const viewportMode = ref<ViewportMode>('3d')
  const activeGeometry = ref<GeometryType>('sphere')
  const subdivisionsDetail = ref(128)
  const wireframe = ref(false)
  const hdrIntensity = ref(0.5)
  const hdrRotation = ref(0)
  const lightIntensity = ref(1.0)
  const lightingPreset = ref<import('@/types/pbr.types').LightingPreset>('studio')
  const lightAngle = ref(45)
  const showHdriBackground = ref(false)
  const hdriBlur = ref(0)
  const customHdrUrl = ref('')
  const customHdrFileName = ref('')
  const importedModelUrl = ref('')
  const importedModelName = ref('')
  const dropFileHandler = ref<((file: File) => Promise<void>) | null>(null)
  const uvTiling = ref(1.0)
  const displacementEnabled = ref(false)
  const displacementScale = ref(0.02)
  const isGenerating = ref(false)
  const generationVersion = ref(0)
  const isBakingHighRes = reactive<Record<PBRChannel, boolean>>(
    { albedo: false, displacement: false, normal: false, roughness: false, metallic: false, ao: false, edge: false },
  )
  const pickingTarget = ref<{ channel: string; index: number } | null>(null)
  const tilingParams = reactive<TilingParams>({
    technique: 'overlap',
    outputResolution: 2048,
    falloff: 0.1,
    overlapX: 0.2,
    overlapY: 0.2,
    splatRotation: 0.0,
    splatRotationRandom: 0.25,
    splatScale: 1.0,
    splatWobble: 0.2,
    splatRandomize: 0.0,
  })
  const tilingResults = reactive<Record<PBRChannel, HTMLCanvasElement | null>>({
    albedo: null, displacement: null, normal: null, roughness: null, metallic: null, ao: null, edge: null,
  })

  function loadSourceImage(img: HTMLImageElement, fileName: string) {
    sourceImage.value = img
    sourceFileName.value = fileName
    albedoBaseCanvas.value = null
    for (const ch of ALL_CHANNELS) {
      channels[ch].dirty = true
      channels[ch].hasCustomMap = false
      channels[ch].canvas = null
      renderTargets[ch] = null
      tilingResults[ch] = null
    }
    params.albedo.editDiffuse.enabled = false
    if (viewportMode.value === 'tiling') {
      viewportMode.value = '3d'
    }
    generationVersion.value++
  }

  function loadAlbedoAsSource(img: HTMLImageElement, fileName: string, canvas: HTMLCanvasElement) {
    sourceImage.value = img
    sourceFileName.value = fileName
    albedoBaseCanvas.value = null
    channels.albedo.canvas = canvas
    channels.albedo.hasCustomMap = true
    channels.albedo.dirty = false
    for (const ch of ALL_CHANNELS) {
      if (ch !== 'albedo') {
        channels[ch].dirty = true
        channels[ch].hasCustomMap = false
        channels[ch].canvas = null
        renderTargets[ch] = null
      }
      tilingResults[ch] = null
    }
    params.albedo.editDiffuse.enabled = false
    if (viewportMode.value === 'tiling') {
      viewportMode.value = '3d'
    }
    generationVersion.value++
  }

  function setChannelParam<K extends keyof ChannelParams>(
    channel: PBRChannel,
    key: K,
    value: ChannelParams[K],
  ) {
    ;(params[channel] as any)[key] = value
    markDirty([channel])
  }

  function markDirty(changedChannels: PBRChannel[]) {
    const visited = new Set<PBRChannel>()
    const queue = [...changedChannels]
    while (queue.length > 0) {
      const ch = queue.shift()!
      if (visited.has(ch)) continue
      visited.add(ch)
      channels[ch].dirty = true
      for (const [channel, deps] of Object.entries(CHANNEL_DEPENDENCIES) as [PBRChannel, PBRChannel[]][]) {
        if (deps.includes(ch) && !visited.has(channel)) {
          queue.push(channel)
        }
      }
    }
  }

  function resetChannelParams(channel: PBRChannel) {
    const defaults = createDefaultParams()
    Object.assign(params[channel], defaults[channel])
    markDirty([channel])
  }

  function importChannelMap(channel: PBRChannel, canvas: HTMLCanvasElement) {
    channels[channel].canvas = canvas
    channels[channel].hasCustomMap = true
    channels[channel].dirty = false
    renderTargets[channel] = null
    markDirty([channel])
    generationVersion.value++
  }

  function deleteChannelMap(channel: PBRChannel) {
    channels[channel].canvas = null
    channels[channel].hasCustomMap = false
    channels[channel].dirty = true
    renderTargets[channel] = null
    generationVersion.value++
  }

  function setChannelCanvas(channel: PBRChannel, canvas: HTMLCanvasElement) {
    channels[channel].canvas = canvas
    channels[channel].dirty = false
    generationVersion.value++
  }

  function setChannelRT(channel: PBRChannel, rt: THREE.WebGLRenderTarget | null) {
    renderTargets[channel] = rt
    channels[channel].canvas = null
    channels[channel].dirty = false
    generationVersion.value++
  }

  function setChannelRTsBatch(rts: Partial<Record<PBRChannel, THREE.WebGLRenderTarget | null>>) {
    for (const [ch, rt] of Object.entries(rts)) {
      renderTargets[ch as PBRChannel] = rt
      channels[ch as PBRChannel].canvas = null
      channels[ch as PBRChannel].dirty = false
    }
    generationVersion.value++
  }

  function setChannelRTAndCanvas(channel: PBRChannel, rt: THREE.WebGLRenderTarget | null, canvas: HTMLCanvasElement | null) {
    renderTargets[channel] = rt
    if (canvas) channels[channel].canvas = canvas
    channels[channel].dirty = false
    generationVersion.value++
  }

  function clearAllRTs() {
    for (const ch of ALL_CHANNELS) {
      renderTargets[ch] = null
    }
  }

  function getDirtyChannels(): PBRChannel[] {
    return TOPOLOGICAL_ORDER.filter(ch => channels[ch].dirty)
  }

  function getChannelInput(channel: PBRChannel): HTMLCanvasElement | null {
    if (channel === 'albedo') {
      return channels.albedo.canvas
    }
    const deps = CHANNEL_DEPENDENCIES[channel]
    if (deps.length === 0) return channels.albedo.canvas
    return channels[deps[0]]?.canvas ?? null
  }

  function loadCustomHdr(url: string, fileName: string) {
    if (customHdrUrl.value) URL.revokeObjectURL(customHdrUrl.value)
    customHdrUrl.value = url
    customHdrFileName.value = fileName
  }

  function clearCustomHdr() {
    if (customHdrUrl.value) URL.revokeObjectURL(customHdrUrl.value)
    customHdrUrl.value = ''
    customHdrFileName.value = ''
  }

  function clearImportedModel() {
    if (importedModelUrl.value) URL.revokeObjectURL(importedModelUrl.value)
    importedModelUrl.value = ''
    importedModelName.value = ''
  }

  function pickColorFromSource(x: number, y: number): [number, number, number] | null {
    const canvas = channels.albedo.canvas
    if (!canvas) return null
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const px = Math.min(Math.max(Math.floor(x * canvas.width), 0), canvas.width - 1)
    const py = Math.min(Math.max(Math.floor(y * canvas.height), 0), canvas.height - 1)
    const data = ctx.getImageData(px, py, 1, 1).data
    return [data[0] / 255, data[1] / 255, data[2] / 255]
  }

  function startPicking(channel: string, index: number) {
    pickingTarget.value = { channel, index }
  }

  function stopPicking() {
    pickingTarget.value = null
  }

  function applyPickedColor(x: number, y: number) {
    if (!pickingTarget.value) return
    const color = pickColorFromSource(x, y)
    if (!color) return
    const { channel, index } = pickingTarget.value
    const p = params[channel as PBRChannel] as any
    if (channel === 'metallic') {
      p.sample.color = color
    } else {
      if (p.samples && p.samples[index]) {
        p.samples[index].color = color
      }
    }
    markDirty([channel as PBRChannel])
    stopPicking()
  }

  return {
    sourceImage, sourceFileName, sourceImageUrl, albedoBaseCanvas, channelPrompts, channels, renderTargets, params, activeChannel,
    targetResolution, viewportMode, activeGeometry, subdivisionsDetail, wireframe,
    hdrIntensity, hdrRotation, lightIntensity, lightingPreset, lightAngle, showHdriBackground, hdriBlur, customHdrUrl, customHdrFileName, importedModelUrl, importedModelName,
    uvTiling, displacementEnabled, displacementScale,
    isGenerating, generationVersion, isBakingHighRes,
    loadSourceImage,     loadAlbedoAsSource, setChannelParam, markDirty, resetChannelParams,
    importChannelMap, deleteChannelMap, setChannelCanvas, setChannelRT, setChannelRTsBatch, setChannelRTAndCanvas, clearAllRTs,
    getDirtyChannels, getChannelInput, loadCustomHdr, clearCustomHdr, clearImportedModel, pickColorFromSource,
    pickingTarget, startPicking, stopPicking, applyPickedColor,
    tilingParams, tilingResults,
    dropFileHandler,
  }
})
