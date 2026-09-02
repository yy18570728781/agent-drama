import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { IMAGE_UPLOAD_SIZE_LIMIT, compressImageFileToLimit } from '@/utils/imageCompression'
import { useThemeStore } from '@/styles/theme/store/theme'

type Resolver = ((files: File[] | null) => void) | null

/**
 * 弹窗的响应式状态。由 ImageCompressDialogHost（常驻 App.vue）消费，
 * 用 v-model 控制 el-dialog 显隐。不再用 createVNode/render 命令式挂载，
 * 避免在 iframe / 桌面壳等复杂 stacking context 里脱离主组件树导致弹不出来。
 */
export const dialogState = reactive({
  visible: false,
  files: [] as File[],
})

let resolver: Resolver = null

/** 由 Host 组件在 confirm/cancel/visible=false 时调用，兑现 openImageCompressDialog 的 Promise */
export function resolveDialog(files: File[] | null) {
  if (resolver) {
    resolver(files)
    resolver = null
  }
  dialogState.visible = false
  dialogState.files = []
}

export async function openImageCompressDialog(
  files: File[],
  _context?: unknown,
  options?: { allowEmpty?: boolean },
) {
  const imageFiles = Array.isArray(files) ? files.filter((file) => file instanceof File && file.type?.startsWith('image/')) : []
  if (!imageFiles.length && !options?.allowEmpty) return []
  dialogState.files = imageFiles
  dialogState.visible = true
  return await new Promise<File[] | null>((resolve) => {
    resolver = resolve
  })
}

export async function maybeCompressImageFilesBeforeUpload(files: File[]) {
  const themeStore = useThemeStore()
  const maxBytes = themeStore.compressThresholdMb * 1024 * 1024
  const originalFiles = Array.isArray(files) ? files.filter((file) => file instanceof File) : []
  const oversizeImages = originalFiles.filter((file) => file.type?.startsWith('image/') && file.size > maxBytes)
  if (!oversizeImages.length) return originalFiles

  const imageFiles = originalFiles.filter((file) => file.type?.startsWith('image/'))

  let processedImages: File[] | null
  try {
    if (themeStore.autoCompressOriginalRatio) {
      const loadingMessage = ElMessage({
        message: `正在自动原比例压缩 ${imageFiles.length} 张图片...`,
        type: 'info',
        duration: 0,
      })
      try {
        processedImages = await Promise.all(
          imageFiles.map((file) => compressImageFileToLimit(file, { lockRatio: true, maxBytes })),
        )
      } finally {
        loadingMessage.close()
      }
    } else {
      processedImages = await openImageCompressDialog(imageFiles)
    }
  } catch {
    processedImages = null
  }
  if (!processedImages) return null

  let imageIndex = 0
  return originalFiles.map((file) => {
    if (!file.type?.startsWith('image/')) return file
    const replacement = processedImages[imageIndex]
    imageIndex += 1
    return replacement instanceof File ? replacement : file
  })
}
