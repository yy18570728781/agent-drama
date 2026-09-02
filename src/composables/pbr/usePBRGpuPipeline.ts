import { ref, onBeforeUnmount } from 'vue'
import { usePBRStore } from '@/stores/pbr.store'
import { GPUPipeline } from '@/services/pbr/GPUPipeline'
import { imageToCanvas } from '@/services/pbr/cpu/imageUtils'
import type { PBRChannel } from '@/types/pbr.types'
import { TOPOLOGICAL_ORDER } from '@/types/pbr.types'
import * as THREE from 'three'

const PBR_DEBUG = false
function pbrLog(...args: unknown[]): void {
  if (PBR_DEBUG) console.warn('[PBR]', ...args)
}

const HEIGHT_CHEAP = new Set(['weights', 'contrasts', 'finalGain', 'finalContrast', 'finalBias', 'invert', 'reveal'])
const NORMAL_CHEAP = new Set(['weights', 'finalContrast', 'angularity', 'angularIntensity', 'invertY', 'invert', 'reveal'])
const AO_CHEAP = new Set(['aoBlend', 'aoPower', 'aoBias', 'invert'])
const EDGE_CHEAP = new Set(['weights', 'edgeAmount', 'creviceAmount', 'pinch', 'pillow', 'finalContrast', 'finalBias', 'invert'])
const METALLIC_CHEAP = new Set(['highPassOverlay', 'finalContrast', 'finalBias', 'invert', 'reveal'])
const ROUGHNESS_CHEAP = new Set(['metalSmoothness', 'baseSmoothness', 'highPassOverlay', 'finalContrast', 'finalBias', 'invert', 'reveal', 'sampleBlend'])

function isCheapChange(channel: PBRChannel, key: string): boolean {
  switch (channel) {
    case 'displacement': return HEIGHT_CHEAP.has(key)
    case 'normal': return NORMAL_CHEAP.has(key)
    case 'ao': return AO_CHEAP.has(key)
    case 'edge': return EDGE_CHEAP.has(key)
    case 'metallic': return METALLIC_CHEAP.has(key)
    case 'roughness': return ROUGHNESS_CHEAP.has(key)
    default: return false
  }
}

function hasCachedHeightBlur(pool: any): boolean {
  for (let i = 0; i <= 6; i++) {
    if (!pool.getNamed(`heightBlur${i}`)) return false
  }
  return !!pool.getNamed('heightAvg')
}

export function usePBRGpuPipeline(renderer: THREE.WebGLRenderer | null) {
  const store = usePBRStore()
  const isGpuAvailable = ref(false)
  let pipeline: GPUPipeline | null = null

  if (renderer) {
    try {
      pipeline = new GPUPipeline(renderer)
      isGpuAvailable.value = true
    } catch {
      isGpuAvailable.value = false
    }
  }

  function getAlbedoBaseCanvas(res: number): HTMLCanvasElement | null {
    if (store.albedoBaseCanvas) {
      const base = store.albedoBaseCanvas
      if (base.width === res && base.height === res) return base
      const c = document.createElement('canvas')
      c.width = res; c.height = res
      c.getContext('2d')!.drawImage(base, 0, 0, res, res)
      return c
    }
    if (store.sourceImage) return imageToCanvas(store.sourceImage, res)
    return null
  }

  function getAlbedoTex(): THREE.CanvasTexture | null {
    if (!pipeline) {
      pbrLog('getAlbedoTex() null: no pipeline')
      return null
    }
    const albedoCanvas = getAlbedoBaseCanvas(store.targetResolution)
    if (!albedoCanvas) {
      pbrLog('getAlbedoTex() null: no base canvas')
      return null
    }
    pbrLog('getAlbedoTex() ok:', `${albedoCanvas.width}x${albedoCanvas.height}`)
    return pipeline.canvasToTex(albedoCanvas)
  }

  function getProcessedAlbedoTex(): THREE.Texture | null {
    if (!pipeline) {
      pbrLog('getProcessedAlbedoTex() no pipeline')
      return null
    }
    const albedoCanvas = store.channels.albedo.canvas
    if (albedoCanvas) {
      pbrLog('getProcessedAlbedoTex() from store canvas:', `${albedoCanvas.width}x${albedoCanvas.height}`)
      return pipeline.canvasToTex(albedoCanvas)
    }
    return getAlbedoTex()
  }

  function ensureHeightRT(): THREE.WebGLRenderTarget | null {
    if (!pipeline) return null
    const pool = pipeline.getPool()
    const cached = pool.getNamed('height')
    if (cached && !store.channels.displacement.dirty && cached.width === store.targetResolution) return cached

    const albedoTex = getProcessedAlbedoTex()
    if (!albedoTex) return null
    const rt = pipeline.generateHeight(albedoTex, store.params.displacement, store.targetResolution, store.targetResolution)
    pool.setNamed('height', rt)
    storeWithReadback('displacement', rt)
    if (albedoTex instanceof THREE.CanvasTexture) albedoTex.dispose()
    return rt
  }

  function ensureNormalRT(): THREE.WebGLRenderTarget | null {
    if (!pipeline) return null
    const pool = pipeline.getPool()
    const cached = pool.getNamed('normal')
    if (cached && !store.channels.normal.dirty && cached.width === store.targetResolution) return cached

    const heightRT = ensureHeightRT()
    if (!heightRT) return null
    const albedoTex = getProcessedAlbedoTex()
    const rt = pipeline.generateNormal(heightRT, store.params.normal, store.targetResolution, store.targetResolution, albedoTex)
    pool.setNamed('normal', rt)
    storeWithReadback('normal', rt)
    if (albedoTex && albedoTex instanceof THREE.CanvasTexture) albedoTex.dispose()
    return rt
  }

  function generateAll(): Record<PBRChannel, THREE.WebGLRenderTarget | null> | null {
    if (!pipeline) return null
    const albedoCanvas = getAlbedoBaseCanvas(store.targetResolution)
    if (!albedoCanvas) return null
    const results = pipeline.generateAllRT(albedoCanvas, store.params as any, store.targetResolution)

    const pool = pipeline.getPool()
    pool.setNamed('height', results.displacement!)
    pool.setNamed('normal', results.normal!)

    const batch: Partial<Record<PBRChannel, THREE.WebGLRenderTarget | null>> = {}
    for (const ch of TOPOLOGICAL_ORDER) {
      if (results[ch]) {
        batch[ch] = results[ch]
      }
    }
    store.setChannelRTsBatch(batch)

    return results
  }

  function storeWithReadback(channel: PBRChannel, rt: THREE.WebGLRenderTarget | null): THREE.WebGLRenderTarget | null {
    if (!rt || !pipeline) return rt
    const canvas = pipeline.renderTargetToCanvas(rt)
    store.setChannelRTAndCanvas(channel, rt, canvas)
    pbrLog('storeWithReadback:', channel, `rt=${rt.width}x${rt.height}`, `canvas=${canvas.width}x${canvas.height}`)
    return rt
  }

  function generateSingle(channel: PBRChannel): THREE.WebGLRenderTarget | null {
    if (!pipeline) {
      pbrLog('GPU generateSingle() early exit:', { channel, hasPipeline: !!pipeline })
      return null
    }
    const res = store.targetResolution
    const pool = pipeline.getPool()
    pbrLog('GPU generateSingle() start:', channel, `res=${res}`)

    if (channel === 'albedo') {
      pbrLog('GPU generateSingle(albedo) → null (CPU path)')
      return null
    }

    if (channel === 'displacement') {
      pool.deleteNamed('height')
      pool.deleteNamed('normal')
      const dp = store.params.displacement as any
      if (dp.sourceMode === 'normal') {
        const tmpAlbedo = getProcessedAlbedoTex()
        if (!tmpAlbedo) { console.warn('[PBR] GPU displacement(normal) no albedo tex'); return null }
        const tmpHeightRT = pipeline.generateHeight(tmpAlbedo, dp, res, res)
        const normalRT = pipeline.generateNormal(tmpHeightRT, store.params.normal, res, res, tmpAlbedo)
        pool.setNamed('normal', normalRT)
        store.setChannelRT('normal', normalRT)
        store.channels.normal.dirty = false
        const rt = pipeline.generateHeightFromNormal(normalRT, dp, res, res)
        pool.setNamed('height', rt)
        pool.release(tmpHeightRT)
        if (tmpAlbedo instanceof THREE.CanvasTexture) tmpAlbedo.dispose()
        return storeWithReadback(channel, rt)
      }
      const albedoTex = getProcessedAlbedoTex()
      if (!albedoTex) { console.warn('[PBR] GPU displacement(diffuse) no albedo tex'); return null }
      const rt = pipeline.generateHeight(albedoTex, dp, res, res)
      pool.setNamed('height', rt)
      if (albedoTex instanceof THREE.CanvasTexture) albedoTex.dispose()
      return storeWithReadback(channel, rt)
    }

    if (channel === 'normal') {
      pool.deleteNamed('normal')
      const heightRT = ensureHeightRT()
      if (!heightRT) { console.warn('[PBR] GPU normal no heightRT'); return null }
      const albedoTex = getProcessedAlbedoTex()
      const rt = pipeline.generateNormal(heightRT, store.params.normal, res, res, albedoTex)
      pool.setNamed('normal', rt)
      if (albedoTex && albedoTex instanceof THREE.CanvasTexture) albedoTex.dispose()
      return storeWithReadback(channel, rt)
    }

    if (channel === 'roughness') {
      const albedoTex = getProcessedAlbedoTex()
      if (!albedoTex) { console.warn('[PBR] GPU roughness no albedoTex'); return null }
      let metallicRT: THREE.WebGLRenderTarget | null = store.renderTargets.metallic
      if (!metallicRT || metallicRT.width !== res || store.channels.metallic.dirty) {
        metallicRT = pipeline.generateMetallic(albedoTex, store.params.metallic, res, res)
        store.channels.metallic.dirty = false
      }
      const rt = pipeline.generateRoughness(albedoTex, store.params.roughness, res, res, metallicRT)
      if (albedoTex instanceof THREE.CanvasTexture) albedoTex.dispose()
      return storeWithReadback(channel, rt)
    }

    if (channel === 'metallic') {
      const albedoTex = getProcessedAlbedoTex()
      if (!albedoTex) { console.warn('[PBR] GPU metallic no albedoTex'); return null }
      const rt = pipeline.generateMetallic(albedoTex, store.params.metallic, res, res)
      if (albedoTex instanceof THREE.CanvasTexture) albedoTex.dispose()
      return storeWithReadback(channel, rt)
    }

    if (channel === 'ao') {
      const heightRT = ensureHeightRT()
      const normalRT = ensureNormalRT()
      if (!heightRT || !normalRT) { console.warn('[PBR] GPU ao no deps:', { hasHeight: !!heightRT, hasNormal: !!normalRT }); return null }
      const rt = pipeline.generateAO(normalRT, heightRT, store.params.ao, res, res)
      return storeWithReadback(channel, rt)
    }

    if (channel === 'edge') {
      const normalRT = ensureNormalRT()
      if (!normalRT) { console.warn('[PBR] GPU edge no normalRT'); return null }
      const rt = pipeline.generateEdge(normalRT, store.params.edge, res, res)
      return storeWithReadback(channel, rt)
    }

    pbrLog('GPU generateSingle() unknown channel:', channel)
    return null
  }

  function applyEditDiffuse(): HTMLCanvasElement | null {
    if (!pipeline) return null
    const ed = store.params.albedo.editDiffuse
    if (!ed.enabled) return null

    const res = store.targetResolution
    const albedoCanvas = getAlbedoBaseCanvas(res)
    if (!albedoCanvas) return null

    const albedoTex = pipeline.canvasToTex(albedoCanvas)
    const rt = pipeline.generateEditDiffuse(albedoTex, ed, res, res)
    const canvas = pipeline.renderTargetToCanvas(rt)
    pipeline.getPool().release(rt)
    albedoTex.dispose()
    return canvas
  }

  function readbackRT(rt: THREE.WebGLRenderTarget): HTMLCanvasElement {
    return pipeline!.renderTargetToCanvas(rt)
  }

  function readbackToCanvas(channel: PBRChannel): HTMLCanvasElement | null {
    if (!pipeline) return null
    const rt = store.renderTargets[channel]
    if (!rt) {
      return store.channels[channel].canvas
    }
    const canvas = pipeline.renderTargetToCanvas(rt)
    store.channels[channel].canvas = canvas
    return canvas
  }

  function generateSingleCheap(channel: PBRChannel): THREE.WebGLRenderTarget | null {
    if (!pipeline) return null
    const res = store.targetResolution
    const pool = pipeline.getPool()

    if (channel === 'displacement') {
      if (!hasCachedHeightBlur(pool)) return null
      return pipeline.recombineHeight(store.params.displacement as any, res, res)
    }

    return null
  }

  function clearPool() {
    if (pipeline) pipeline.getPool().clearNamed()
  }

  onBeforeUnmount(() => {
    pipeline?.dispose()
    pipeline = null
  })

  return {
    isGpuAvailable,
    generateAll,
    generateSingle,
    generateSingleCheap,
    readbackRT,
    readbackToCanvas,
    applyEditDiffuse,
    getPipeline: () => pipeline,
    isCheapChange,
    clearPool,
  }
}
