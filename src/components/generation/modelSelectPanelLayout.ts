type ModelCapability = string | { name?: string; label?: string }
type ModelMode = { id?: string; name?: string; label?: string }
type ModelLike = { modes?: ModelMode[]; capabilities?: ModelCapability[] }
type ModelBadgeItem = {
  cap?: string
  key: string
  kind: 'mode' | 'capability'
  label: string
}

export const MODE_LABEL_MAP: Record<string, string> = {
  default: '默认',
  text2image: '文生图',
  image2image: '图生图',
  reference2image: '参考生图',
  inpaint: '局部重绘',
  outpaint: '扩图',
  text2video: '文生视频',
  image2video: '图生视频',
  first_last_frame: '首尾帧',
  reference2video: '参考生视频',
  video2video: '视频生视频',
  text2model: '文生模型',
  image2model: '图生模型',
  text_to_model: '文生模型',
  image_to_model: '图生模型',
  text23d: '文生3D',
  image23d: '图生3D',
  text2_3d: '文生3D',
  image2_3d: '图生3D',
  text_to_3d: '文生3D',
  image_to_3d: '图生3D',
  text2mesh: '文生模型',
  image2mesh: '图生模型',
  multi_view_to_3d: '多视图生3D',
  text2audio: '文生音频',
  audio2audio: '音频转换',
  standard: '标准',
}

export function buildModelBadgeItems(
  model: ModelLike = {},
  getCapLabel: (cap: string) => string = (cap) => cap,
): ModelBadgeItem[] {
  const modes = Array.isArray(model.modes) ? model.modes : []
  const capabilities = Array.isArray(model.capabilities) ? model.capabilities : []
  const badges: ModelBadgeItem[] = []
  modes.forEach((mode) => {
    const modeId = mode?.id || mode?.name
    if (!modeId) return
    badges.push({ key: `mode:${modeId}`, label: MODE_LABEL_MAP[modeId] || mode.label || mode.name || modeId, kind: 'mode' })
  })
  capabilities.slice(0, 2).forEach((cap) => {
    const capName = typeof cap === 'string' ? cap : (cap?.name || '')
    const capLabel = typeof cap === 'string' ? cap : (cap?.label || cap?.name || '')
    if (!capName) return
    badges.push({ key: `cap:${capName}`, label: capLabel || getCapLabel(capName), kind: 'capability', cap: capName })
  })
  return badges
}

export function resolveModelSelectPopoverLayout({
  triggerRect,
  clickPoint,
  viewport,
  preferredWidth = 640,
}: {
  triggerRect?: DOMRect | null
  clickPoint?: { x: number; y: number } | null
  viewport?: { padding?: number; width?: number; height?: number } | null
  preferredWidth?: number
} = {}) {
  const padding = viewport?.padding ?? 16
  const viewportWidth = viewport?.width ?? 1280
  const viewportHeight = viewport?.height ?? 800
  const rect = triggerRect || { top: 0, bottom: 36, left: 0, right: 100, width: 100, height: 36 }
  const point = clickPoint || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  const maxViewportWidth = Math.max(320, viewportWidth - padding * 2)
  const topSpace = rect.top - padding
  const bottomSpace = viewportHeight - rect.bottom - padding
  const horizontal = point.x + preferredWidth > viewportWidth - padding ? 'end' : 'start'
  const vertical = topSpace >= 360 || topSpace >= bottomSpace ? 'top' : 'bottom'
  const widthGap = Math.max(0, maxViewportWidth - preferredWidth)
  const availableHeight = Math.max(vertical === 'top' ? topSpace : bottomSpace, 320)
  const maxPanelHeight = Math.min(680, availableHeight)
  return {
    placement: `${vertical}-${horizontal}`,
    width: widthGap <= 48 ? maxViewportWidth : Math.min(preferredWidth, maxViewportWidth),
    maxPanelHeight,
    maxListHeight: Math.max(180, maxPanelHeight - 160),
  }
}
