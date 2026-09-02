import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  normalizeDroppedUrl,
  VIDEO_EXTS,
  IMAGE_URL_EXTS,
  AUDIO_URL_EXTS,
  MODEL_URL_EXTS,
} from '@/composables/useFileDrop'

export function useClipboardPaste(options: {
  containerRef: Ref<HTMLElement | null>
  embedded: Ref<boolean> | boolean
  ensureFileUploadMode: (opts?: { warnOnFailure?: boolean; silent?: boolean; warningMessage?: string }) => Promise<boolean>
  addFiles: (files: File[] | FileList) => Promise<void>
  addRemoteReferenceUrl: (url: string, opts: { successMessage: string; failureMessage: string }) => Promise<boolean>
  getRemainingReferenceSlots: () => number
  getRefImageMaxItems: () => number
  selectedModelInfo: Ref<any>
  currentModeName: Ref<string>
  emit: {
    (e: 'clipboard-reference-pasted', payload: { files: File[] }): void
    (e: 'files-dropped', payload: { files?: File[]; urls?: string[] }): void
  }
}) {
  const {
    containerRef,
    embedded,
    ensureFileUploadMode,
    addFiles,
    addRemoteReferenceUrl,
    getRemainingReferenceSlots,
    getRefImageMaxItems,
    selectedModelInfo,
    currentModeName,
    emit,
  } = options

  const showScreenshotPanel = ref(false)

  const openScreenshot = async () => {
    if (!(await ensureFileUploadMode({
      silent: false,
      warnOnFailure: true,
      warningMessage: '当前模型没有支持文件上传的模式',
    }))) {
      return
    }
    showScreenshotPanel.value = true
  }

  const onScreenshotCapture = async (file: File) => {
    await addFiles([file])
    ElMessage.success('截图已添加为参考图')
  }

  const isElementInsideGenerator = (target: EventTarget | null | undefined) => {
    if (!(target instanceof Node)) return false
    const container = containerRef.value
    if (container?.contains(target)) return true
    return false
  }

  const shouldHandleGeneratorPaste = (e: ClipboardEvent) => {
    if ((e as any).__flowCanvasPasteHandled) return false
    if (isElementInsideGenerator(e.target)) return true
    const activeElement = document.activeElement
    return isElementInsideGenerator(activeElement)
  }

  const onPaste = async (e: ClipboardEvent) => {
    if (!shouldHandleGeneratorPaste(e)) return

    const isEmbedded = typeof embedded === 'boolean' ? embedded : embedded.value

    // 1. 优先处理粘贴的文件（截图等）
    const files = Array.from(e.clipboardData?.items || [])
      .filter(i => i.kind === 'file' && (
        i.type.startsWith('image/')
        || i.type.startsWith('video/')
        || i.type.startsWith('audio/')
        || VIDEO_EXTS.test(i.getAsFile()?.name || '')
        || /\.(glb|gltf|fbx|obj|usdz|blend)$/i.test(i.getAsFile()?.name || '')
      ))
      .map(i => i.getAsFile()!).filter(Boolean)
    if (files.length) {
      if (isEmbedded) {
        emit('clipboard-reference-pasted', { files })
        return
      }
      if (!(await ensureFileUploadMode({ warnOnFailure: true }))) {
        return
      }
      await addFiles(files)
      const screenshotFiles = files.filter(file => file.type.startsWith('image/'))
      if (screenshotFiles.length) {
        emit('clipboard-reference-pasted', { files: screenshotFiles })
      }
      return
    }

    // 2. 处理粘贴的 URL（图片/视频链接）
    const text = normalizeDroppedUrl(e.clipboardData?.getData('text/plain') || '')
    if (!text) return
    const isSupportedReferenceUrl = (text.startsWith('http://') || text.startsWith('https://')) &&
      (IMAGE_URL_EXTS.test(text) || VIDEO_EXTS.test(text) || AUDIO_URL_EXTS.test(text) || MODEL_URL_EXTS.test(text))
    if (!isSupportedReferenceUrl) return

    e.preventDefault() // 阻止 URL 作为文本插入

    if (isEmbedded) {
      if (getRemainingReferenceSlots() <= 0) {
        const maxItems = getRefImageMaxItems()
        ElMessage.warning(`当前模式最多支持 ${maxItems} 张参考图`)
      } else {
        emit('files-dropped', { urls: [text] })
      }
      return
    }

    if (!(await ensureFileUploadMode({ warnOnFailure: true }))) {
      return
    }

    await addRemoteReferenceUrl(text, {
      successMessage: '已添加粘贴的链接',
      failureMessage: '无法加载粘贴的链接',
    })
  }

  function attach() {
    document.addEventListener('paste', onPaste)
  }

  function detach() {
    document.removeEventListener('paste', onPaste)
  }

  return {
    showScreenshotPanel,
    openScreenshot,
    onScreenshotCapture,
    onPaste,
    attach,
    detach,
  }
}
