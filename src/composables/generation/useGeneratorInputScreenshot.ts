import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAssetDragIframeBridge } from '@/composables/assets/useAssetDragIframeBridge'
import { getStorage, setStorage } from '@/utils/storage'

type ScreenshotMode = 'hide-window' | 'keep-window'

interface EnsureFileUploadOptions {
  silent: boolean
  warnOnFailure: boolean
  warningMessage: string
}

interface UseGeneratorInputScreenshotDeps {
  ensureFileUploadMode: (options: EnsureFileUploadOptions) => Promise<boolean>
  onScreenshotCapture: (file: File) => Promise<void> | void
}

interface UseGeneratorInputScreenshotReturn {
  isIframe: boolean
  screenshotCapturing: ReturnType<typeof ref<boolean>>
  screenshotMenuVisible: ReturnType<typeof ref<boolean>>
  requestPreferredClientScreenshot: () => Promise<void>
  requestClientScreenshotByMode: (mode: ScreenshotMode) => Promise<void>
  toggleScreenshotMenu: () => void
}

const SCREENSHOT_MODE_KEY = 'generator_input_client_screenshot_mode'
const DEFAULT_SCREENSHOT_MODE: ScreenshotMode = 'keep-window'

function getInitialScreenshotMode(): ScreenshotMode {
  const stored = getStorage<string>(SCREENSHOT_MODE_KEY)
  return stored === 'hide-window' || stored === 'keep-window'
    ? stored
    : DEFAULT_SCREENSHOT_MODE
}

async function dataUrlToScreenshotFile(dataUrl: string): Promise<File> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], `screenshot_${Date.now()}.png`, {
    type: blob.type || 'image/png',
  })
}

export function useGeneratorInputScreenshot(
  deps: UseGeneratorInputScreenshotDeps,
): UseGeneratorInputScreenshotReturn {
  const iframeBridge = useAssetDragIframeBridge()
  const screenshotCapturing = ref(false)
  const screenshotMenuVisible = ref(false)
  const preferredMode = ref<ScreenshotMode>(getInitialScreenshotMode())

  async function requestClientScreenshotByMode(mode: ScreenshotMode): Promise<void> {
    screenshotMenuVisible.value = false
    if (screenshotCapturing.value) return
    if (!iframeBridge.isIframe) {
      ElMessage.warning('当前环境不支持客户端截图')
      return
    }
    if (!(await deps.ensureFileUploadMode({
      silent: false,
      warnOnFailure: true,
      warningMessage: '当前模型没有支持文件上传的模式',
    }))) return

    screenshotCapturing.value = true
    preferredMode.value = mode
    setStorage(SCREENSHOT_MODE_KEY, mode)
    const requestId = mode === 'hide-window'
      ? iframeBridge.requestHiddenWindowScreenshot()
      : iframeBridge.requestVisibleWindowScreenshot()

    iframeBridge.onceScreenshotCallback(requestId, async (result) => {
      screenshotCapturing.value = false
      if (!result.accepted || !result.screenshotUrl) {
        if (result.error) ElMessage.warning(result.error)
        return
      }
      try {
        await deps.onScreenshotCapture(await dataUrlToScreenshotFile(result.screenshotUrl))
      } catch {
        ElMessage.warning('截图处理失败，请重试')
      }
    })
  }

  async function requestPreferredClientScreenshot(): Promise<void> {
    await requestClientScreenshotByMode(preferredMode.value)
  }

  function toggleScreenshotMenu(): void {
    screenshotMenuVisible.value = !screenshotMenuVisible.value
  }

  return {
    isIframe: iframeBridge.isIframe,
    screenshotCapturing,
    screenshotMenuVisible,
    requestPreferredClientScreenshot,
    requestClientScreenshotByMode,
    toggleScreenshotMenu,
  }
}
