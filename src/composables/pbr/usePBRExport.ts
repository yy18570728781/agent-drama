import { usePBRStore } from '@/stores/pbr.store'
import type { PBRChannel, ExportConfig } from '@/types/pbr.types'
import { CHANNEL_LABELS, UE_SUFFIX, PACK_SUFFIX, ALL_CHANNELS } from '@/types/pbr.types'
import { downloadTGA, downloadBMP, downloadEXR, canvasToBlob } from '@/services/pbr/textureIO'

export type ExportFormat = 'png' | 'jpg' | 'bmp' | 'tga' | 'exr'
export type ExportMode = 'single' | 'all' | 'pack'

export interface ExportFileItem {
  canvas: HTMLCanvasElement
  fileName: string
}

export interface PackConfig {
  packR: PBRChannel | 'none'
  packG: PBRChannel | 'none'
  packB: PBRChannel | 'none'
  packA: PBRChannel | 'none'
  invertA?: boolean
}

export function usePBRExport() {
  const store = usePBRStore()

  async function downloadCanvas(canvas: HTMLCanvasElement, fileName: string, format: ExportFormat) {
    if (format === 'tga') { downloadTGA(canvas, fileName); return }
    if (format === 'bmp') { downloadBMP(canvas, fileName); return }
    if (format === 'exr') { await downloadEXR(canvas, fileName); return }
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
    const ext = '.' + format
    const url = canvas.toDataURL(mimeType, 0.95)
    const link = document.createElement('a')
    link.download = fileName + ext
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportChannel(channel: PBRChannel, format: ExportFormat = 'png') {
    const canvas = store.channels[channel].canvas
    if (!canvas) return
    const label = CHANNEL_LABELS[channel].split(' ')[0]
    const baseName = store.sourceFileName.replace(/\.[^.]+$/, '')
    downloadCanvas(canvas, `${baseName}_${label}`, format)
  }

  function exportAllChannels(format: ExportFormat = 'png') {
    for (const ch of ALL_CHANNELS) {
      if (store.channels[ch].canvas) {
        exportChannel(ch, format)
      }
    }
  }

  function packChannels(config: ExportConfig, canvasOverride?: Record<PBRChannel, HTMLCanvasElement | null>, invertA = false): HTMLCanvasElement | null {
    const getCanvas = (ch: PBRChannel | 'none'): HTMLCanvasElement | null => {
      if (ch === 'none') return null
      return canvasOverride?.[ch] ?? store.channels[ch].canvas
    }
    const rCh = getCanvas(config.packR)
    const gCh = getCanvas(config.packG)
    const bCh = getCanvas(config.packB)
    const aCh = getCanvas(config.packA)

    if (!rCh && !gCh && !bCh && !aCh) return null

    const res = config.resolution || store.targetResolution
    const canvas = document.createElement('canvas')
    canvas.width = res
    canvas.height = res
    const ctx = canvas.getContext('2d')!
    const imgData = ctx.createImageData(res, res)
    const pix = imgData.data

    const getChannelData = (ch: HTMLCanvasElement | null): Uint8ClampedArray | null => {
      if (!ch) return null
      const tmpCtx = ch.getContext('2d')!
      const tmpData = tmpCtx.getImageData(0, 0, ch.width, ch.height)
      return tmpData.data
    }

    const rData = getChannelData(rCh)
    const gData = getChannelData(gCh)
    const bData = getChannelData(bCh)
    const aData = getChannelData(aCh)

    for (let i = 0; i < res * res; i++) {
      const idx = i * 4
      pix[idx] = rData ? rData[idx] : 0
      pix[idx + 1] = gData ? gData[idx] : 0
      pix[idx + 2] = bData ? bData[idx] : 0
      pix[idx + 3] = aData ? (invertA ? 255 - aData[idx] : aData[idx]) : 255
    }

    ctx.putImageData(imgData, 0, 0)
    return canvas
  }

  function packUnitySmoothness(
    canvases: Record<PBRChannel, HTMLCanvasElement | null>,
    resolution: number,
  ): HTMLCanvasElement | null {
    const roughCanvas = canvases.roughness
    if (!roughCanvas) return null

    const canvas = document.createElement('canvas')
    canvas.width = resolution
    canvas.height = resolution
    const ctx = canvas.getContext('2d')!

    const roughCtx = roughCanvas.getContext('2d')!
    const roughData = roughCtx.getImageData(0, 0, roughCanvas.width, roughCanvas.height)
    const metalCanvas = canvases.metallic
    const metalData = metalCanvas ? metalCanvas.getContext('2d')!.getImageData(0, 0, metalCanvas.width, metalCanvas.height).data : null

    const outData = ctx.createImageData(resolution, resolution)
    const outPix = outData.data

    for (let i = 0; i < resolution * resolution; i++) {
      const idx = i * 4
      outPix[idx] = metalData ? metalData[idx] : 0
      outPix[idx + 1] = 0
      outPix[idx + 2] = 0
      outPix[idx + 3] = 255 - roughData.data[idx]
    }

    ctx.putImageData(outData, 0, 0)
    return canvas
  }

  function exportUEORMPack(format: ExportFormat = 'png') {
    const canvas = packChannels({
      format,
      resolution: store.targetResolution,
      packR: 'ao',
      packG: 'roughness',
      packB: 'metallic',
      packA: 'none',
    })
    if (canvas) {
      const baseName = store.sourceFileName.replace(/\.[^.]+$/, '')
      downloadCanvas(canvas, `${baseName}_ORM`, format)
    }
  }

  function exportUnityPack(format: ExportFormat = 'png') {
    const canvases = {} as Record<PBRChannel, HTMLCanvasElement | null>
    for (const ch of ALL_CHANNELS) canvases[ch] = store.channels[ch].canvas
    const canvas = packUnitySmoothness(canvases, store.targetResolution)
    if (canvas) {
      const baseName = store.sourceFileName.replace(/\.[^.]+$/, '')
      downloadCanvas(canvas, `${baseName}_UnityMetallicSmooth`, format)
    }
  }

  const CHANNEL_PACK_ABBR: Record<string, string> = {
    ao: 'O', roughness: 'R', metallic: 'M',
    displacement: 'H', normal: 'N', edge: 'E',
  }

  function getPackSuffix(cfg: PackConfig): string {
    const abbr = (ch: PBRChannel | 'none') => ch === 'none' ? '_' : (CHANNEL_PACK_ABBR[ch] ?? ch[0].toUpperCase())
    let suffix = abbr(cfg.packR) + abbr(cfg.packG) + abbr(cfg.packB) + abbr(cfg.packA)
    if (cfg.packA !== 'none' && cfg.invertA) suffix += '_invA'
    return suffix
  }

  function getPackFileName(baseName: string, cfg: PackConfig, format: string): string {
    return `${baseName}_PACK_${getPackSuffix(cfg)}.${format}`
  }

  function buildExportFileList(
    canvases: Record<PBRChannel, HTMLCanvasElement | null>,
    baseName: string,
    format: ExportFormat,
    mode: ExportMode,
    activeChannel?: PBRChannel,
    packConfig?: PackConfig,
  ): ExportFileItem[] {
    const result: ExportFileItem[] = []

    function add(ch: PBRChannel) {
      const c = canvases[ch]
      if (!c) return
      result.push({ canvas: c, fileName: `${baseName}_${UE_SUFFIX[ch]}.${format}` })
    }

    if (mode === 'single' && activeChannel) {
      add(activeChannel)
    } else if (mode === 'all') {
      for (const ch of ALL_CHANNELS) add(ch)
    } else if (mode === 'pack') {
      const cfg = packConfig ?? { packR: 'ao' as const, packG: 'roughness' as const, packB: 'metallic' as const, packA: 'none' as const }
      const res = canvases.albedo?.width ?? 1024
      const packCanvas = packChannels({
        format,
        resolution: res,
        packR: cfg.packR, packG: cfg.packG, packB: cfg.packB, packA: cfg.packA,
      }, canvases, cfg.invertA ?? false)
      if (packCanvas) result.push({ canvas: packCanvas, fileName: getPackFileName(baseName, cfg, format) })
      const packedChannels = new Set(
        [cfg.packR, cfg.packG, cfg.packB, cfg.packA].filter((ch): ch is PBRChannel => ch !== 'none')
      )
      for (const ch of ALL_CHANNELS) {
        if (!packedChannels.has(ch)) add(ch)
      }
    }

    return result
  }

  async function saveToDirectory(
    files: ExportFileItem[],
    dirHandle: FileSystemDirectoryHandle,
    onProgress?: (cur: number, total: number) => void,
  ): Promise<void> {
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const blob = await canvasToBlob(f.canvas, f.fileName.split('.').pop() as ExportFormat)
      const fileHandle = await dirHandle.getFileHandle(f.fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
      onProgress?.(i + 1, files.length)
    }
  }

  async function saveAsZip(files: ExportFileItem[], baseName: string): Promise<void> {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (const f of files) {
      const blob = await canvasToBlob(f.canvas, f.fileName.split('.').pop() as ExportFormat)
      zip.file(f.fileName, blob)
    }
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const link = document.createElement('a')
    link.download = `${baseName}_Textures.zip`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  return {
    exportChannel,
    exportAllChannels,
    exportUEORMPack,
    exportUnityPack,
    packChannels,
    downloadCanvas,
    buildExportFileList,
    saveToDirectory,
    saveAsZip,
  }
}
