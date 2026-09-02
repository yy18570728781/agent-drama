import { computed, onBeforeUnmount, watch, type Ref } from 'vue'

import { IMAGE_UPLOAD_SIZE_LIMIT } from '@/utils/imageCompression'
import { useImageCompressWorkbench } from '@/components/common/useImageCompressWorkbench'

import type { RowCompressSettings } from '@/components/common/imageCompressWorkbench.types'

interface ImageInfo {
  width: number
  height: number
}

interface ApplyCompressionResult {
  file: File
  url: string
}

function createCompressedFileName(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, '') || 'image'
  return `${stem}_compressed.jpg`
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

function exportCanvas(bgCanvas: HTMLCanvasElement, drawCanvas: HTMLCanvasElement | null) {
  const canvas = document.createElement('canvas')
  canvas.width = bgCanvas.width
  canvas.height = bgCanvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bgCanvas, 0, 0)
  if (drawCanvas) ctx.drawImage(drawCanvas, 0, 0)
  return canvas
}

function resolveOutputSize(sourceCanvas: HTMLCanvasElement, settings: RowCompressSettings) {
  const sourceWidth = Math.max(1, sourceCanvas.width)
  const sourceHeight = Math.max(1, sourceCanvas.height)
  if (settings.useSourceWidth) {
    return { width: sourceWidth, height: sourceHeight }
  }
  const width = Math.min(sourceWidth, Math.max(1, settings.targetWidth))
  if (settings.lockRatio) {
    return {
      width,
      height: Math.max(1, Math.round((width / sourceWidth) * sourceHeight)),
    }
  }
  return {
    width,
    height: Math.max(1, settings.targetHeight),
  }
}

export function useImageReferenceCompressWorkbench(options: {
  imageFile: Ref<File>
  imageInfo: Ref<ImageInfo>
  bgCanvas: Ref<HTMLCanvasElement | null>
  drawCanvas: Ref<HTMLCanvasElement | null>
}) {
  const maxBytes = computed(() => IMAGE_UPLOAD_SIZE_LIMIT)
  const canvasReady = computed(() => Boolean(options.bgCanvas.value))
  const workbench = useImageCompressWorkbench({
    maxBytes,
    processRow: async ({ settings }) => {
      const bgCanvas = options.bgCanvas.value
      if (!bgCanvas) throw new Error('当前画布未准备好')
      const mergedCanvas = exportCanvas(bgCanvas, options.drawCanvas.value)
      if (!mergedCanvas) throw new Error('当前画布无法导出')
      const outputSize = resolveOutputSize(mergedCanvas, settings)
      const outputCanvas = document.createElement('canvas')
      outputCanvas.width = outputSize.width
      outputCanvas.height = outputSize.height
      const outputCtx = outputCanvas.getContext('2d')
      if (!outputCtx) throw new Error('压缩输出失败')
      outputCtx.drawImage(
        mergedCanvas,
        0,
        0,
        mergedCanvas.width,
        mergedCanvas.height,
        0,
        0,
        outputSize.width,
        outputSize.height,
      )
      const blob = await canvasToBlob(outputCanvas, Math.min(0.98, Math.max(0.4, settings.quality / 100)))
      if (!blob) throw new Error('压缩输出失败')
      return new File([blob], createCompressedFileName(options.imageFile.value.name), {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
    },
  })

  watch(
    () => options.imageFile.value,
    async (file) => {
      await workbench.rebuildRows(file ? [file] : [])
    },
    { immediate: true },
  )

  function canApplyCompression() {
    const row = workbench.selectedRow.value
    if (workbench.processing.value) return false
    if (!row) return false
    return Boolean(row.processedFile)
  }

  function getApplyResult(): ApplyCompressionResult | null {
    const row = workbench.selectedRow.value
    if (!row?.processedFile || !row.processedPreviewUrl) return null
    return {
      file: row.processedFile,
      url: row.processedPreviewUrl,
    }
  }

  onBeforeUnmount(workbench.dispose)

  return {
    ...workbench,
    canvasReady,
    canApplyCompression: computed(() => canApplyCompression()),
    getApplyResult,
  }
}
