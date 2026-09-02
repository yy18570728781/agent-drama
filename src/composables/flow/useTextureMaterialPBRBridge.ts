import { ElMessage } from 'element-plus'
import { usePBRStore } from '@/stores/pbr.store'
import { usePbrOverlayStore } from '@/stores/pbrOverlay.store'
import type { PBRChannel } from '@/types/pbr.types'
import type { TextureMaterialItem } from '@/composables/flow/textureMaterial.types'

type LoadedTexture = {
  channel: PBRChannel
  url: string
  fileName: string
  image: HTMLImageElement
  canvas: HTMLCanvasElement
}

function getItemUrl(item: TextureMaterialItem): string {
  return String(item?.data?.url || item?.data?.thumb || '').trim()
}

function getItemFileName(item: TextureMaterialItem): string {
  const label = String(item?.data?.label || item?.pbrChannel || 'texture').trim()
  const safeLabel = label.replace(/[\\/:*?"<>|]/g, '-')
  return `${safeLabel || 'texture'}.png`
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`图片加载失败: ${url}`))
    image.src = url
  })
}

function drawImageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('无法创建贴图画布')
  }
  context.drawImage(image, 0, 0)
  return canvas
}

async function loadTextureItem(item: TextureMaterialItem): Promise<LoadedTexture | null> {
  const url = getItemUrl(item)
  if (!url) return null
  const image = await loadImage(url)
  return {
    channel: item.pbrChannel,
    url,
    fileName: getItemFileName(item),
    image,
    canvas: drawImageToCanvas(image),
  }
}

async function applyTexturesToStore(items: TextureMaterialItem[], store: ReturnType<typeof usePBRStore>): Promise<void> {
  const loadedItems = (await Promise.all(items.map(loadTextureItem))).filter(Boolean) as LoadedTexture[]
  const albedo = loadedItems.find((item) => item.channel === 'albedo')
  if (!albedo) {
    throw new Error('3D材质工具至少需要一张 albedo / basecolor 贴图')
  }

  store.loadAlbedoAsSource(albedo.image, albedo.fileName, albedo.canvas)
  store.sourceImageUrl = albedo.url

  loadedItems
    .filter((item) => item.channel !== 'albedo')
    .forEach((item) => {
      store.importChannelMap(item.channel, item.canvas)
    })

  store.activeChannel = 'albedo'
}

/**
 * 将 texture_material 容器内的通道图片桥接到 PBR 工具。
 * @param items texture_material 容器内的完整 item 列表
 * @returns 打开材质工具的方法
 * @throws 当缺少 albedo/basecolor 或图片加载失败时抛错
 */
export function useTextureMaterialPBRBridge(): {
  openTextureMaterialInPBR: (items: TextureMaterialItem[]) => Promise<boolean>
} {
  const store = usePBRStore()
  const overlayStore = usePbrOverlayStore()

  async function openTextureMaterialInPBR(items: TextureMaterialItem[]): Promise<boolean> {
    const validItems = (items || []).filter((item) => !!getItemUrl(item))
    if (!validItems.length) {
      ElMessage.warning('选中的卡片里还没有可导入的贴图')
      return false
    }

    try {
      await applyTexturesToStore(validItems, store)
      overlayStore.openOverlay()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入 3D 材质工具失败'
      ElMessage.error(message)
      return false
    }
  }

  return { openTextureMaterialInPBR }
}
