import { ref, watch, inject } from 'vue'
import * as THREE from 'three'
import { usePBRStore } from '@/stores/pbr.store'
import type { PBRChannel } from '@/types/pbr.types'
import { TOPOLOGICAL_ORDER, ALL_CHANNELS, computeExportClosure } from '@/types/pbr.types'
import {
  canvasToImageData,
  imageDataToCanvas,
  cloneImageData,
  imageToCanvas,
  performBoxBlurAsync,
  processAlbedo,
  processDisplacement,
  processDisplacementAsync,
  processNormal,
  processNormalAsync,
  processRoughness,
  processMetallic,
  processAO,
  processEdge,
} from '@/services/pbr/cpu'
import { usePBRGpuPipeline } from './usePBRGpuPipeline'

const PBR_DEBUG = false
function pbrLog(...args: unknown[]): void {
  if (PBR_DEBUG) console.warn('[PBR]', ...args)
}

function isCanvasBlack(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const w = canvas.width
  const h = canvas.height
  const sampleCount = 64
  for (let i = 0; i < sampleCount; i++) {
    const x = Math.floor(Math.random() * w)
    const y = Math.floor(Math.random() * h)
    const px = ctx.getImageData(x, y, 1, 1).data
    if (px[0] > 2 || px[1] > 2 || px[2] > 2) return false
  }
  const corner = ctx.getImageData(0, 0, Math.min(16, w), Math.min(16, h)).data
  for (let i = 0; i < corner.length; i += 4) {
    if (corner[i] > 2 || corner[i + 1] > 2 || corner[i + 2] > 2) return false
  }
  return true
}

export function usePBRGenerator(renderer?: THREE.WebGLRenderer | null) {
  const store = usePBRStore()
  const isProcessing = ref(false)
  const sharedRenderer = renderer ?? inject<THREE.WebGLRenderer | null>('pbrRenderer', null)
  const gpuPipeline = usePBRGpuPipeline(sharedRenderer)
  const useGpu = gpuPipeline.isGpuAvailable

  function hasSource(): boolean {
    return !!(store.sourceImage || store.albedoBaseCanvas || store.channels.albedo.canvas)
  }

  function processChannel(channel: PBRChannel): HTMLCanvasElement | null {
    const res = store.targetResolution
    const scaleRatio = res / 512
    return processChannelAtResolution(channel, res)
  }

  function processChannelAtResolution(channel: PBRChannel, res: number, depCanvases?: Record<PBRChannel, HTMLCanvasElement | null>): HTMLCanvasElement | null {
    const scaleRatio = res / 512
    if (channel === 'albedo') return processAlbedoChannel(res, scaleRatio)
    if (channel === 'displacement') return processDisplacementChannel(res, scaleRatio)
    if (channel === 'normal') return processNormalChannel(res, scaleRatio, depCanvases)
    if (channel === 'roughness') return processRoughnessChannel(res, scaleRatio)
    if (channel === 'metallic') return processMetallicChannel(res, scaleRatio)
    if (channel === 'ao') return processAOChannel(res, scaleRatio, depCanvases)
    if (channel === 'edge') return processEdgeChannel(res, scaleRatio, depCanvases)
    return null
  }

  function rescaleCanvas(src: HTMLCanvasElement, res: number): HTMLCanvasElement {
    if (src.width === res && src.height === res) return src
    const c = document.createElement('canvas')
    c.width = res
    c.height = res
    const ctx = c.getContext('2d')!
    const scale = Math.min(res / src.width, res / src.height)
    const dw = src.width * scale
    const dh = src.height * scale
    const dx = (res - dw) / 2
    const dy = (res - dh) / 2
    ctx.drawImage(src, dx, dy, dw, dh)
    return c
  }

  function getSourceImageData(res: number): ImageData | null {
    const base = store.albedoBaseCanvas
    if (base) {
      const canvas = document.createElement('canvas')
      canvas.width = res
      canvas.height = res
      canvas.getContext('2d')!.drawImage(base, 0, 0, res, res)
      return canvasToImageData(canvas)
    }
    if (store.sourceImage) {
      const canvas = imageToCanvas(store.sourceImage, res)
      return canvasToImageData(canvas)
    }
    return null
  }

  function getCurrentAlbedoCanvas(res: number): HTMLCanvasElement | null {
    const existing = store.channels.albedo.canvas
    if (existing) {
      if (existing.width === res && existing.height === res) return existing
      const c = document.createElement('canvas')
      c.width = res; c.height = res
      c.getContext('2d')!.drawImage(existing, 0, 0, res, res)
      return c
    }
    if (store.albedoBaseCanvas) {
      const base = store.albedoBaseCanvas
      if (base.width === res && base.height === res) return base
      const c = document.createElement('canvas')
      c.width = res; c.height = res
      c.getContext('2d')!.drawImage(base, 0, 0, res, res)
      return c
    }
    return store.sourceImage ? imageToCanvas(store.sourceImage, res) : null
  }

  function processAlbedoChannel(res: number, scaleRatio: number): HTMLCanvasElement | null {
    const ed = store.params.albedo.editDiffuse
    if (ed.enabled && useGpu.value) {
      const edCanvas = gpuPipeline.applyEditDiffuse()
      if (edCanvas) {
        const imgData = canvasToImageData(edCanvas)
        const result = processAlbedo(imgData, store.params.albedo as any, scaleRatio)
        return imageDataToCanvas(result)
      }
    }
    const imgData = getSourceImageData(res)
    if (!imgData) return null
    const result = processAlbedo(cloneImageData(imgData), store.params.albedo as any, scaleRatio)
    return imageDataToCanvas(result)
  }

  function processDisplacementChannel(res: number, scaleRatio: number): HTMLCanvasElement | null {
    const imgData = getSourceImageData(res)
    if (!imgData) return null
    const result = processDisplacement(cloneImageData(imgData), store.params.displacement as any, scaleRatio)
    return imageDataToCanvas(result)
  }

  function processNormalChannel(res: number, scaleRatio: number, depCanvases?: Record<PBRChannel, HTMLCanvasElement | null>): HTMLCanvasElement | null {
    const dispCanvas = depCanvases?.displacement ?? store.channels.displacement.canvas
    if (!dispCanvas) return null
    const dispData = canvasToImageData(rescaleCanvas(dispCanvas, res))
    const result = processNormal(dispData, store.params.normal as any, scaleRatio)
    return imageDataToCanvas(result)
  }

  function processRoughnessChannel(res: number, scaleRatio: number): HTMLCanvasElement | null {
    const imgData = getSourceImageData(res)
    if (!imgData) return null
    const result = processRoughness(cloneImageData(imgData), store.params.roughness as any, scaleRatio)
    return imageDataToCanvas(result)
  }

  function processMetallicChannel(res: number, scaleRatio: number): HTMLCanvasElement | null {
    const imgData = getSourceImageData(res)
    if (!imgData) return null
    const result = processMetallic(cloneImageData(imgData), store.params.metallic as any, scaleRatio)
    return imageDataToCanvas(result)
  }

  function processAOChannel(res: number, scaleRatio: number, depCanvases?: Record<PBRChannel, HTMLCanvasElement | null>): HTMLCanvasElement | null {
    const dispCanvas = depCanvases?.displacement ?? store.channels.displacement.canvas
    if (!dispCanvas) return null
    const dispData = canvasToImageData(rescaleCanvas(dispCanvas, res))
    const result = processAO(dispData, store.params.ao as any, scaleRatio)
    return imageDataToCanvas(result)
  }

  function processEdgeChannel(res: number, scaleRatio: number, depCanvases?: Record<PBRChannel, HTMLCanvasElement | null>): HTMLCanvasElement | null {
    const normCanvas = depCanvases?.normal ?? store.channels.normal.canvas
    if (!normCanvas) return null
    const normData = canvasToImageData(rescaleCanvas(normCanvas, res))
    const result = processEdge(normData, store.params.edge as any, scaleRatio)
    return imageDataToCanvas(result)
  }

  async function processDisplacementChannelAsync(
    res: number, scaleRatio: number,
    depCanvases: Record<PBRChannel, HTMLCanvasElement | null>,
    onYield?: () => Promise<void>,
  ): Promise<HTMLCanvasElement | null> {
    const imgData = getSourceImageData(res)
    if (!imgData) return null
    const result = await processDisplacementAsync(cloneImageData(imgData), store.params.displacement as any, scaleRatio, onYield)
    return imageDataToCanvas(result)
  }

  async function processNormalChannelAsync(
    res: number, scaleRatio: number,
    depCanvases: Record<PBRChannel, HTMLCanvasElement | null>,
    onYield?: () => Promise<void>,
  ): Promise<HTMLCanvasElement | null> {
    const dispCanvas = depCanvases.displacement
    if (!dispCanvas) return null
    const dispData = canvasToImageData(rescaleCanvas(dispCanvas, res))
    const result = await processNormalAsync(dispData, store.params.normal as any, scaleRatio, onYield)
    return imageDataToCanvas(result)
  }

  function yieldToBrowser(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0))
  }

  async function generateAll() {
    if (!hasSource()) { console.warn('[PBR] generateAll() no source'); return }
    isProcessing.value = true
    store.isGenerating = true
    pbrLog('generateAll() start', { useGpu: useGpu.value, hasSourceImage: !!store.sourceImage, hasAlbedoCanvas: !!store.channels.albedo.canvas })

    try {
      if (useGpu.value && hasSource()) {
        try {
          const channels = ['displacement', 'normal', 'metallic', 'roughness', 'ao', 'edge'] as PBRChannel[]
          for (const ch of channels) {
            pbrLog('generateAll() GPU generating:', ch)
            const rt = gpuPipeline.generateSingle(ch)
            if (rt) {
              store.channels[ch].dirty = false
              pbrLog('generateAll() GPU done:', ch, `${rt.width}x${rt.height}`)
            } else {
              console.warn('[PBR] generateAll() GPU returned null for:', ch)
            }
            await yieldToBrowser()
          }
          store.isGenerating = false
          isProcessing.value = false
          return
        } catch (err) {
          console.warn('[PBR] generateAll() GPU failed, falling back to CPU:', err)
          useGpu.value = false
          store.clearAllRTs()
        }
      }

      for (const channel of TOPOLOGICAL_ORDER) {
        const canvas = processChannel(channel)
        if (canvas) {
          store.setChannelCanvas(channel, canvas)
          store.channels[channel].dirty = false
        }
        await yieldToBrowser()
      }
    } finally {
      isProcessing.value = false
      store.isGenerating = false
    }
  }

  async function exportGenerateAtResolution(
    res: number,
    neededChannels: PBRChannel[],
    onProgress?: (current: number, total: number, channel: PBRChannel) => void,
  ): Promise<Record<PBRChannel, HTMLCanvasElement | null>> {
    if (!hasSource()) return {} as Record<PBRChannel, HTMLCanvasElement | null>

    const toGenerate = computeExportClosure(neededChannels)

    if (res === store.targetResolution) {
      const results: Record<PBRChannel, HTMLCanvasElement | null> = {
        albedo: null, displacement: null, normal: null,
        roughness: null, metallic: null, ao: null, edge: null,
      }
      for (const ch of toGenerate) {
        results[ch] = readbackForDisplay(ch)
      }
      return results
    }

    isProcessing.value = true
    store.isGenerating = true
    suppressResWatch = true
    store.targetResolution = res

    try {
      onProgress?.(0, toGenerate.length + 1, 'albedo' as PBRChannel)
      const albedoCanvas = processAlbedoChannel(res, res / 512)
      if (albedoCanvas) {
        store.channels.albedo.canvas = albedoCanvas
        store.channels.albedo.dirty = false
      }

      if (useGpu.value && hasSource()) {
        try {
          const gpuChannels = toGenerate.filter(ch => ch !== 'albedo')
          for (let i = 0; i < gpuChannels.length; i++) {
            const ch = gpuChannels[i]
            onProgress?.(i + 1, toGenerate.length + 1, ch)
            gpuPipeline.getPipeline()?.invalidateHeightCache()
            const rt = gpuPipeline.generateSingle(ch)
            if (rt) {
              store.channels[ch].dirty = false
            }
            await yieldToBrowser()
          }
        } catch {
          useGpu.value = false
          store.clearAllRTs()
        }
      }

      if (!useGpu.value || !hasSource()) {
        const cpuChannels = toGenerate.filter(ch => ch !== 'albedo')
        for (let i = 0; i < cpuChannels.length; i++) {
          const ch = cpuChannels[i]
          onProgress?.(i + 1, toGenerate.length + 1, ch)
          const canvas = processChannel(ch)
          if (canvas) {
            store.setChannelCanvas(ch, canvas)
          }
          await yieldToBrowser()
        }
      }

      const results: Record<PBRChannel, HTMLCanvasElement | null> = {
        albedo: null, displacement: null, normal: null,
        roughness: null, metallic: null, ao: null, edge: null,
      }
      for (const ch of toGenerate) {
        results[ch] = readbackForDisplay(ch)
      }
      return results
    } finally {
      store.targetResolution = res
      for (const ch of toGenerate) {
        store.channels[ch].dirty = false
      }
      store.generationVersion++
      suppressResWatch = false
      isProcessing.value = false
      store.isGenerating = false
    }
  }

  async function generateSingle(channel: PBRChannel) {
    if (!hasSource()) { console.warn('[PBR] generateSingle() no source:', channel); return }
    pbrLog('generateSingle() start:', channel, { useGpu: useGpu.value, hasSourceImage: !!store.sourceImage })

    if (channel === 'albedo') {
      pbrLog('generateSingle(albedo) → CPU path')
      const canvas = processAlbedoChannel(store.targetResolution, store.targetResolution / 512)
      if (canvas) {
        store.setChannelCanvas('albedo', canvas)
        store.channels.albedo.dirty = false
        pbrLog('generateSingle(albedo) CPU done:', `${canvas.width}x${canvas.height}`)
      } else {
        console.warn('[PBR] generateSingle(albedo) CPU returned null')
      }
      return
    }

    if (useGpu.value && hasSource()) {
      try {
        if (channel === 'displacement') {
          const pl = gpuPipeline.getPipeline()
          if (pl) pl.invalidateHeightCache()
        }
        const deps = getDepsForChannel(channel)
        pbrLog('generateSingle() GPU attempt:', channel, 'deps:', deps)
        const rt = gpuPipeline.generateSingle(channel)
        if (rt) {
          store.channels[channel].dirty = false
          for (const dep of deps) {
            store.channels[dep].dirty = false
          }
          pbrLog('generateSingle() GPU success:', channel, `${rt.width}x${rt.height}`)
          return
        } else {
          console.warn('[PBR] generateSingle() GPU returned null for:', channel, '→ falling back to CPU')
        }
      } catch (err) {
        console.warn('[PBR] generateSingle() GPU error for:', channel, err, '→ falling back to CPU')
      }
    }

    pbrLog('generateSingle() CPU path for:', channel)
    const deps = getDepsForChannel(channel)
    for (const dep of deps) {
      if (store.channels[dep].dirty || !store.channels[dep].canvas) {
        pbrLog('generateSingle() CPU generating dep:', dep)
        const canvas = processChannel(dep)
        if (canvas) {
          store.setChannelCanvas(dep, canvas)
          store.channels[dep].dirty = false
        }
      }
    }

    const canvas = processChannel(channel)
    if (canvas) {
      store.setChannelCanvas(channel, canvas)
      store.channels[channel].dirty = false
      pbrLog('generateSingle() CPU done:', channel, `${canvas.width}x${canvas.height}`)
    } else {
      console.warn('[PBR] generateSingle() CPU returned null for:', channel)
    }
  }

  function getDepsForChannel(channel: PBRChannel): PBRChannel[] {
    if (channel === 'normal') return ['displacement']
    if (channel === 'ao') return ['displacement', 'normal']
    if (channel === 'edge') return ['displacement', 'normal']
    return []
  }

  let rafPending = false
  let lastParamsJson = ''
  const highResTimers: Record<string, ReturnType<typeof setTimeout> | null> = {}
  let suppressResWatch = false

  function generateAtResolution(channel: PBRChannel, res: number): THREE.WebGLRenderTarget | null {
    if (!useGpu.value || !hasSource()) {
      console.warn('[PBR] generateAtResolution() no GPU/source:', channel, res)
      return null
    }
    const pipeline = gpuPipeline.getPipeline()
    if (!pipeline) {
      console.warn('[PBR] generateAtResolution() no pipeline:', channel, res)
      return null
    }

    if (channel === 'displacement') pipeline.invalidateHeightCache()

    suppressResWatch = true
    const savedRes = store.targetResolution
    store.targetResolution = res
    try {
      const rt = gpuPipeline.generateSingle(channel)
      pbrLog('generateAtResolution()', channel, `${res}px`, rt ? 'OK' : 'null')
      return rt
    } finally {
      store.targetResolution = savedRes
      suppressResWatch = false
    }
  }

  function runRegenerate() {
    rafPending = false
    if (!hasSource() || isProcessing.value) {
      console.warn('[PBR] runRegenerate() skipped:', { channel: store.activeChannel, hasSource: hasSource(), isProcessing: isProcessing.value })
      return
    }
    const channel = store.activeChannel

    if (channel === 'albedo') {
      const canvas = processAlbedoChannel(store.targetResolution, 1)
      if (canvas) {
        store.setChannelCanvas('albedo', canvas)
        store.channels.albedo.dirty = false
      }
      return
    }

    const cheapRT = gpuPipeline.generateSingleCheap(channel)
    if (cheapRT) {
      const pl = gpuPipeline.getPipeline()
      if (pl) {
        const canvas = pl.renderTargetToCanvas(cheapRT)
        store.setChannelRTAndCanvas(channel, cheapRT, canvas)
      } else {
        store.setChannelRT(channel, cheapRT)
      }
      store.channels[channel].dirty = false
      return
    }

    if (useGpu.value && hasSource() && store.targetResolution > 512) {
      pbrLog('runRegenerate() progressive path:', channel, `res=${store.targetResolution}`)
      const pipeline = gpuPipeline.getPipeline()
      if (!pipeline) { generateSingle(channel); return }

      try {
        const savedRes = store.targetResolution

        const draftRT = generateAtResolution(channel, 512)
        if (draftRT) {
          const pl = gpuPipeline.getPipeline()
          if (pl) {
            store.setChannelRTAndCanvas(channel, draftRT, pl.renderTargetToCanvas(draftRT))
          } else {
            store.setChannelRT(channel, draftRT)
          }
          store.channels[channel].dirty = false
        }

        store.isBakingHighRes[channel] = true
        if (highResTimers[channel]) clearTimeout(highResTimers[channel]!)
        highResTimers[channel] = setTimeout(() => {
          highResTimers[channel] = null
          try {
            const fullRT = generateAtResolution(channel, savedRes)
            if (fullRT) {
              const pl2 = gpuPipeline.getPipeline()
              if (pl2) {
                store.setChannelRTAndCanvas(channel, fullRT, pl2.renderTargetToCanvas(fullRT))
              } else {
                store.setChannelRT(channel, fullRT)
              }
              store.channels[channel].dirty = false
            }
          } catch {
    console.warn('[PBR] runRegenerate() fallback generateSingle:', channel)
    generateSingle(channel)
          }
          store.isBakingHighRes[channel] = false
        }, 350)
        return
      } catch {
        generateSingle(channel)
        return
      }
    }

    generateSingle(channel)
  }

  function scheduleRegenerate() {
    if (rafPending) {
      pbrLog('scheduleRegenerate() rafPending, skipping')
      return
    }
    rafPending = true
    pbrLog('scheduleRegenerate() scheduled:', store.activeChannel, `res=${store.targetResolution}`)
    requestAnimationFrame(runRegenerate)
  }

  watch(
    () => store.params,
    () => {
      if (!hasSource() || isProcessing.value) {
        pbrLog('param watch skipped:', { hasSource: hasSource(), isProcessing: isProcessing.value })
        return
      }
      const snapshot = JSON.stringify(store.params[store.activeChannel as keyof typeof store.params])
      if (snapshot === lastParamsJson) {
        pbrLog('param watch snapshot unchanged for:', store.activeChannel)
        return
      }
      lastParamsJson = snapshot
      pbrLog('param watch detected change for:', store.activeChannel, 'snapshot changed')
      scheduleRegenerate()
    },
    { deep: true },
  )

  watch(() => store.activeChannel, () => {
    rafPending = false
    for (const key of Object.keys(highResTimers)) {
      if (highResTimers[key]) {
        clearTimeout(highResTimers[key]!)
        highResTimers[key] = null
        store.isBakingHighRes[key as PBRChannel] = false
      }
    }
  })

  watch(() => store.sourceImage, () => {
    gpuPipeline.clearPool()
  })

  watch(() => store.targetResolution, (newRes, oldRes) => {
    if (!suppressResWatch && newRes !== oldRes) {
      gpuPipeline.getPipeline()?.getPool().clearNamed()
    }
  })

  async function generateTiling() {
    if (!hasSource() || isProcessing.value) return
    const pipeline = gpuPipeline.getPipeline()
    if (!pipeline) return
    isProcessing.value = true
    store.isGenerating = true
    try {
      const tp = store.tilingParams
      const w = tp.outputResolution
      const h = tp.outputResolution
      const params = tp as any

      for (const ch of ALL_CHANNELS) {
        if (ch === 'albedo') {
          const albedoCanvas = getCurrentAlbedoCanvas(store.targetResolution)
          if (!albedoCanvas) continue
          const albedoTex = pipeline.canvasToTex(albedoCanvas)
          const heightRT = pipeline.getPool().getNamed('height')
          const heightTex = heightRT ? heightRT.texture : albedoTex

          const rt = tp.technique === 'overlap'
            ? pipeline.generateSeamlessOverlap(albedoTex, heightTex, params, w, h, false, false)
            : pipeline.generateSeamlessSplat(albedoTex, heightTex, params, w, h, false, false)
          store.tilingResults[ch] = pipeline.renderTargetToCanvas(rt)
          pipeline.getPool().release(rt)
          albedoTex.dispose()
        } else {
          const chRT = store.renderTargets[ch]
          const chCanvas = store.channels[ch]?.canvas
          let tex: THREE.Texture
          if (chRT) {
            tex = chRT.texture
          } else if (chCanvas) {
            tex = pipeline.canvasToTex(chCanvas)
          } else {
            continue
          }
          const heightRT = pipeline.getPool().getNamed('height')
          const heightTex = heightRT ? heightRT.texture : tex
          const isHeight = ch === 'displacement'
          const isNormal = ch === 'normal'

          const rt = tp.technique === 'overlap'
            ? pipeline.generateSeamlessOverlap(tex, heightTex, params, w, h, isHeight, isNormal)
            : pipeline.generateSeamlessSplat(tex, heightTex, params, w, h, isHeight, isNormal)
          store.tilingResults[ch] = pipeline.renderTargetToCanvas(rt)
          pipeline.getPool().release(rt)
          if (tex instanceof THREE.CanvasTexture) tex.dispose()
        }
      }

      for (const ch of ALL_CHANNELS) {
        store.renderTargets[ch] = null
      }
      gpuPipeline.getPipeline()?.getPool().clearNamed()
    } finally {
      isProcessing.value = false
      store.isGenerating = false
    }
  }

  async function applyTiling() {
    for (const ch of ALL_CHANNELS) {
      const canvas = store.tilingResults[ch]
      if (canvas) {
        store.channels[ch].canvas = canvas
        store.channels[ch].hasCustomMap = true
        store.channels[ch].dirty = false
      }
    }
    const albedoResult = store.tilingResults.albedo
    if (albedoResult) {
      store.albedoBaseCanvas = albedoResult
    }
    store.generationVersion++
  }

  async function generateTilingPreview(): Promise<HTMLCanvasElement | null> {
    if (!hasSource() || isProcessing.value) return null
    const pipeline = gpuPipeline.getPipeline()
    if (!pipeline) return null
    isProcessing.value = true
    store.isGenerating = true
    try {
      const tp = store.tilingParams
      const w = 512
      const h = 512
      const params = tp as any

      const albedoCanvas = getCurrentAlbedoCanvas(store.targetResolution)
      if (!albedoCanvas) return null
      const albedoTex = pipeline.canvasToTex(albedoCanvas)
      const heightRT = pipeline.getPool().getNamed('height')
      const heightTex = heightRT ? heightRT.texture : albedoTex

      const rt = tp.technique === 'overlap'
        ? pipeline.generateSeamlessOverlap(albedoTex, heightTex, params, w, h, false, false)
        : pipeline.generateSeamlessSplat(albedoTex, heightTex, params, w, h, false, false)
      const canvas = pipeline.renderTargetToCanvas(rt)
      pipeline.getPool().release(rt)
      albedoTex.dispose()

      store.tilingResults.albedo = canvas
      return canvas
    } finally {
      isProcessing.value = false
      store.isGenerating = false
    }
  }

  async function applyTilingCurrentChannel(): Promise<boolean> {
    if (!hasSource() || isProcessing.value) return false
    const pipeline = gpuPipeline.getPipeline()
    if (!pipeline) return false
    isProcessing.value = true
    store.isGenerating = true
    try {
      const tp = store.tilingParams
      const ch = store.activeChannel
      const w = tp.outputResolution
      const h = tp.outputResolution
      const params = tp as any

      if (ch === 'albedo') {
        const albedoCanvas = getCurrentAlbedoCanvas(store.targetResolution)
        if (!albedoCanvas) return false
        const albedoTex = pipeline.canvasToTex(albedoCanvas)
        const heightRT = pipeline.getPool().getNamed('height')
        const heightTex = heightRT ? heightRT.texture : albedoTex

        const rt = tp.technique === 'overlap'
          ? pipeline.generateSeamlessOverlap(albedoTex, heightTex, params, w, h, false, false)
          : pipeline.generateSeamlessSplat(albedoTex, heightTex, params, w, h, false, false)
        const canvas = pipeline.renderTargetToCanvas(rt)
        pipeline.getPool().release(rt)
        albedoTex.dispose()
        store.channels[ch].canvas = canvas
        store.channels[ch].hasCustomMap = true
        store.channels[ch].dirty = false
        store.albedoBaseCanvas = canvas
        store.renderTargets[ch] = null
        store.generationVersion++
        return true
      }

      const chRT = store.renderTargets[ch]
      const chCanvas = store.channels[ch]?.canvas
      let tex: THREE.Texture
      if (chRT) {
        tex = chRT.texture
      } else if (chCanvas) {
        tex = pipeline.canvasToTex(chCanvas)
      } else {
        return false
      }
      const heightRT = pipeline.getPool().getNamed('height')
      const heightTex = heightRT ? heightRT.texture : tex
      const isHeight = ch === 'displacement'
      const isNormal = ch === 'normal'

      const rt = tp.technique === 'overlap'
        ? pipeline.generateSeamlessOverlap(tex, heightTex, params, w, h, isHeight, isNormal)
        : pipeline.generateSeamlessSplat(tex, heightTex, params, w, h, isHeight, isNormal)
      const canvas = pipeline.renderTargetToCanvas(rt)
      pipeline.getPool().release(rt)
      if (tex instanceof THREE.CanvasTexture) tex.dispose()

      store.channels[ch].canvas = canvas
      store.channels[ch].hasCustomMap = true
      store.channels[ch].dirty = false
      store.renderTargets[ch] = null
      store.generationVersion++
      return true
    } finally {
      isProcessing.value = false
      store.isGenerating = false
    }
  }

  function readbackForDisplay(channel: PBRChannel): HTMLCanvasElement | null {
    const existingCanvas = store.channels[channel]?.canvas
    if (existingCanvas && !store.channels[channel].dirty) {
      pbrLog('readbackForDisplay() existing canvas:', channel, `${existingCanvas.width}x${existingCanvas.height}`)
      return existingCanvas
    }
    const rt = store.renderTargets[channel]
    if (rt && useGpu.value) {
      pbrLog('readbackForDisplay() GPU readback:', channel, `${rt.width}x${rt.height}`)
      const canvas = gpuPipeline.readbackRT(rt)
      store.channels[channel].canvas = canvas
      return canvas
    }
    pbrLog('readbackForDisplay() fallback canvas:', channel, existingCanvas ? `${existingCanvas.width}x${existingCanvas.height}` : 'null')
    return existingCanvas ?? null
  }

  type AIGenerateFn = (params: {
    prompt: string
    channel: PBRChannel
    imageUrl?: string
  }) => Promise<string | null>
  let aiGenerateCallback: AIGenerateFn | null = null

  function setAIGenerateCallback(cb: AIGenerateFn) {
    aiGenerateCallback = cb
  }

  function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const tryLoad = (useCors: boolean) => new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image()
        if (useCors) img.crossOrigin = 'anonymous'
        img.onload = () => res(img)
        img.onerror = () => rej(new Error('Failed to load image: ' + url))
        img.src = url
      })
      tryLoad(true).then(resolve).catch(() => {
        tryLoad(false).then(resolve).catch(reject)
      })
    })
  }

  async function generateChannelFromAI(
    channel: PBRChannel,
    options?: { prompt?: string },
  ): Promise<string | null> {
    if (!aiGenerateCallback) {
      console.warn('[PBR] generateChannelFromAI() no AI callback registered')
      return null
    }

    const prompt = options?.prompt ?? store.channelPrompts[channel]
    if (!prompt) {
      console.warn('[PBR] generateChannelFromAI() no prompt for channel:', channel)
      return null
    }

    const imageUrl = channel === 'albedo' ? undefined : store.sourceImageUrl || undefined

    isProcessing.value = true
    store.isGenerating = true

    try {
      const resultUrl = await aiGenerateCallback({ prompt, channel, imageUrl })
      if (!resultUrl) {
        console.warn('[PBR] generateChannelFromAI() AI returned null')
        return null
      }

      const img = await loadImageFromUrl(resultUrl)

      if (channel === 'albedo') {
        store.sourceImage = img
        store.sourceImageUrl = resultUrl
        store.sourceFileName = 'ai_generated_basecolor'
        const canvas = imageToCanvas(img, store.targetResolution)
        store.setChannelCanvas('albedo', canvas)
        store.albedoBaseCanvas = canvas
        store.channels.albedo.dirty = false
        for (const ch of ALL_CHANNELS) {
          if (ch !== 'albedo') store.channels[ch].dirty = true
        }
      } else {
        const canvas = imageToCanvas(img, store.targetResolution)
        store.setChannelCanvas(channel, canvas)
        store.channels[channel].dirty = false
      }

      store.generationVersion++
      console.warn('[PBR] generateChannelFromAI() success:', channel)
      return resultUrl
    } catch (err) {
      console.warn('[PBR] generateChannelFromAI() error:', channel, err)
      return null
    } finally {
      isProcessing.value = false
      store.isGenerating = false
    }
  }

  return {
    isProcessing,
    useGpu,
    generateAll,
    generateSingle,
    processChannel,
    scheduleRegenerate,
    generateTiling,
    applyTiling,
    generateTilingPreview,
    applyTilingCurrentChannel,
    readbackForDisplay,
    exportGenerateAtResolution,
    generateChannelFromAI,
    setAIGenerateCallback,
  }
}
