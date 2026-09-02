export const MODE_LABEL_MAP: Record<string, string> = {
  standard: '标准',
  default: '默认',

  text2image: '文生图',
  image2image: '图生图',
  reference2image: '参考生图',
  inpaint: '局部重绘',
  outpaint: '扩图',

  text2video: '文生视频',
  image2video: '图生视频',
  reference2video: '参考生视频',
  first_last_frame: '首尾帧',
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
}

export function normalizeModeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function getModeId(mode: any): string {
  if (!mode) return ''
  if (typeof mode === 'string') return mode
  return String(mode.name || mode.id || mode.value || '').trim()
}

function isUsefulLabel(label: string, modeId: string): boolean {
  if (!label) return false
  const normalizedLabel = normalizeModeKey(label)
  const normalizedId = normalizeModeKey(modeId)
  return normalizedLabel !== normalizedId && !MODE_LABEL_MAP[normalizedLabel]
}

export function getModeLabel(mode: any, fallback = '标准'): string {
  const modeId = getModeId(mode)
  const explicitLabel = typeof mode === 'object'
    ? String(mode.label || mode.display_name || '').trim()
    : ''

  if (isUsefulLabel(explicitLabel, modeId)) return explicitLabel

  const normalizedId = normalizeModeKey(modeId)
  const directLabel = MODE_LABEL_MAP[modeId] || MODE_LABEL_MAP[normalizedId]
  if (directLabel) return directLabel

  if (explicitLabel) return explicitLabel
  return modeId || fallback
}
