export type CanvasAssetDisplayMode = 'list' | 'detail'
export type CanvasAssetTypeFilter = 'all' | 'image' | 'video' | 'audio' | 'model' | 'text' | 'other'

export interface FlowCanvasAssetItem {
  id: string
  label: string
  type: Exclude<CanvasAssetTypeFilter, 'all'>
  url: string
  thumbnailUrl: string
  prompt: string
}

export interface FlowCanvasAssetGroup {
  id: string
  label: string
  items: FlowCanvasAssetItem[]
}

interface FlowCanvasNodeLike {
  id?: unknown
  type?: unknown
  label?: unknown
  parentNode?: unknown
  data?: Record<string, unknown>
}

export const CANVAS_ASSET_TYPE_OPTIONS: ReadonlyArray<{ label: string; value: CanvasAssetTypeFilter }> = [
  { label: '全部', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '音频', value: 'audio' },
  { label: '模型', value: 'model' },
  { label: '文本', value: 'text' },
  { label: '其他', value: 'other' },
]

const TYPE_LABELS: Record<Exclude<CanvasAssetTypeFilter, 'all'>, string> = {
  image: '图片节点',
  video: '视频节点',
  audio: '音频节点',
  model: '模型节点',
  text: '文本节点',
  other: '画布元素',
}

function getStringValue(...values: unknown[]): string {
  const found = values.find(value => typeof value === 'string' && value.trim())
  return typeof found === 'string' ? found.trim() : ''
}

function normalizeCanvasAssetType(raw: unknown, nodeType: unknown): Exclude<CanvasAssetTypeFilter, 'all'> {
  const value = String(raw || nodeType || '').toLowerCase()
  if (value.includes('video')) return 'video'
  if (value.includes('audio')) return 'audio'
  if (value.includes('model') || value.includes('3d')) return 'model'
  if (value.includes('text') || value.includes('annotation')) return 'text'
  if (value.includes('image') || value.includes('file') || value.includes('aigc')) return 'image'
  return 'other'
}

function isGeneratedCanvasNode(node: FlowCanvasNodeLike): boolean {
  const data = node.data || {}
  const nodeType = String(node.type || '').trim()
  return nodeType === 'aigc_result'
    || String(data.nodeKind || '').trim() === 'aigc_result'
    || Boolean(data._multiResultForNodeId)
    || Boolean(data._generatedFromNodeId)
}

function toCanvasAssetItem(node: FlowCanvasNodeLike, index: number): FlowCanvasAssetItem | null {
  const data = node.data || {}
  const url = getStringValue(data.url, data.imageUrl, data.videoUrl, data.audioUrl, data.preview, data.thumb, data.thumbnail_url)
  const content = getStringValue(data.content, data.prompt)
  if (!url && !content) return null

  const type = normalizeCanvasAssetType(data.mediaType, node.type)
  return {
    id: String(node.id || `canvas-asset-${index}`),
    label: getStringValue(data.label, node.label) || TYPE_LABELS[type],
    type,
    url,
    thumbnailUrl: getStringValue(data.thumb, data.thumbnail_url, data.preview, data.poster, data.imageUrl, data.url),
    prompt: content,
  }
}

function resolveGroup(node: FlowCanvasNodeLike, groupNodes: Map<string, FlowCanvasNodeLike>): { id: string; label: string } {
  const groupId = String(node.parentNode || '')
  const group = groupNodes.get(groupId)
  if (!group) return { id: 'ungrouped', label: '未分组' }
  return {
    id: groupId,
    label: getStringValue(group.data?.label, group.label) || '未命名分组',
  }
}

/**
 * 按画布中的节点组构建资产分区，媒体类型仅作为筛选条件。
 * @param nodes 当前画布节点
 * @param typeFilter 媒体类型筛选
 * @param resultOnly 是否只保留生成结果
 * @returns 按 Ctrl+G 分组关系组织的资产列表
 */
export function buildCanvasAssetGroups(
  nodes: unknown[],
  typeFilter: CanvasAssetTypeFilter,
  resultOnly: boolean,
): FlowCanvasAssetGroup[] {
  const canvasNodes = nodes.filter((node): node is FlowCanvasNodeLike => Boolean(node && typeof node === 'object'))
  const groupNodes = new Map(
    canvasNodes
      .filter(node => node.type === 'groupNode' && node.id)
      .map(node => [String(node.id), node]),
  )
  const groups = new Map<string, FlowCanvasAssetGroup>()

  canvasNodes.forEach((node, index) => {
    if (resultOnly && !isGeneratedCanvasNode(node)) return
    const item = toCanvasAssetItem(node, index)
    if (!item || (typeFilter !== 'all' && item.type !== typeFilter)) return
    const groupMeta = resolveGroup(node, groupNodes)
    const group = groups.get(groupMeta.id) || { ...groupMeta, items: [] }
    group.items.push(item)
    groups.set(groupMeta.id, group)
  })

  return Array.from(groups.values())
}

/** 返回画布媒体类型的显示名称。 */
export function getCanvasTypeLabel(type: string): string {
  return TYPE_LABELS[type as Exclude<CanvasAssetTypeFilter, 'all'>] || TYPE_LABELS.other
}

/** 返回画布媒体类型的紧凑图标文字。 */
export function getCanvasTypeIcon(type: string): string {
  return ({ image: '图', video: '播', audio: '音', model: '3D', text: '文' } as Record<string, string>)[type] || '项'
}
