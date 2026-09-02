import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { findTeamonesAigcRecord, type AssetItem } from '@/api/assets'
import { useTextureMaterialPBRBridge } from '@/composables/flow/useTextureMaterialPBRBridge'
import type { TextureMaterialItem } from '@/composables/flow/textureMaterial.types'
import type { PBRChannel } from '@/types/pbr.types'
import { inferTextureMaterialChannel } from '@/utils/textureMaterialChannelInference'

type SelectionNodeData = Record<string, unknown>

type SelectionNode = {
  id?: string
  type?: string
  data?: SelectionNodeData
}

type UseSelectionTextureMaterialToolOptions = {
  nodes: ComputedRef<unknown[]> | Ref<unknown[]>
}

const CHANNELS = new Set<PBRChannel>([
  'albedo',
  'displacement',
  'normal',
  'roughness',
  'metallic',
  'ao',
  'edge',
])

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value || '').trim()
}

function getNodeData(node: unknown): SelectionNodeData {
  return node && typeof node === 'object' && 'data' in node
    ? ((node as SelectionNode).data || {})
    : {}
}

function getNodeUrl(data: SelectionNodeData): string {
  return readText(data.url)
}

function getNodeThumb(data: SelectionNodeData): string {
  return readText(data.thumb)
}

function getRecordId(data: SelectionNodeData): string {
  return readText(data.recordId)
}

function getRecordUrl(record: AssetItem | null): string {
  if (!record) return ''
  if (typeof record.url === 'string') return record.url.trim()
  return readText(record.url?.origin_url || record.url?.proxy_url)
}

function getRecordThumb(record: AssetItem | null): string {
  if (!record) return ''
  if (typeof record.thumbnail_url === 'string') return record.thumbnail_url.trim()
  return readText(record.thumbnail_url?.origin_url || record.thumbnail_url?.proxy_url)
}

function getRecordSourceAlbedoUrl(record: AssetItem | null): string {
  const fileUrls = record?.param?.params?.file_urls
  if (!Array.isArray(fileUrls)) return ''
  return readText(fileUrls[0])
}

function resolveChannel(node: SelectionNode, fallback: PBRChannel): PBRChannel {
  const data = node.data || {}
  const explicit = readText(data.pbrChannel)
  if (CHANNELS.has(explicit as PBRChannel)) return explicit as PBRChannel
  return inferTextureMaterialChannel(data) || fallback
}

async function loadRecord(data: SelectionNodeData): Promise<AssetItem | null> {
  const recordId = getRecordId(data)
  return recordId ? findTeamonesAigcRecord(recordId).catch(() => null) : null
}

async function buildItem(node: SelectionNode, channel: PBRChannel): Promise<TextureMaterialItem | null> {
  const data = node.data || {}
  const record = getNodeUrl(data) ? null : await loadRecord(data)
  const url = getNodeUrl(data) || getRecordUrl(record)
  if (!url) return null
  const thumb = getNodeThumb(data) || getRecordThumb(record)
  return {
    id: readText(node.id) || `selection-${channel}`,
    type: readText(node.type) || 'aigc_result',
    pbrChannel: channel,
    data: {
      label: readText(data.label) || channel,
      mediaType: readText(data.mediaType) || 'image',
      url,
      ...(thumb ? { thumb } : {}),
      ...(readText(data.recordId) ? { recordId: readText(data.recordId) } : {}),
      ...(readText(data.prompt) ? { prompt: readText(data.prompt) } : {}),
      ...(readText(data.modelDisplayName) ? { modelDisplayName: readText(data.modelDisplayName) } : {}),
    },
  }
}

async function buildSourceAlbedoItem(nodes: unknown[]): Promise<TextureMaterialItem | null> {
  const sourceNode = nodes.find((node) => !!getRecordId(getNodeData(node))) as SelectionNode | undefined
  if (!sourceNode) return null
  const record = await loadRecord(sourceNode.data || {})
  const url = getRecordSourceAlbedoUrl(record)
  if (!url) return null
  return {
    id: `${readText(sourceNode.id) || 'selection'}-source-albedo`,
    type: 'file_input',
    pbrChannel: 'albedo',
    data: {
      label: 'BaseColor',
      mediaType: 'image',
      url,
      ...(getRecordThumb(record) ? { thumb: getRecordThumb(record) } : {}),
    },
  }
}

async function buildItems(nodes: unknown[]): Promise<TextureMaterialItem[]> {
  const used = new Set<PBRChannel>()
  const items: TextureMaterialItem[] = []
  for (const [index, rawNode] of nodes.entries()) {
    const node = rawNode as SelectionNode
    const fallback = 'albedo'
    const channel = resolveChannel(node, fallback)
    if (used.has(channel)) continue
    const item = await buildItem(node, channel)
    if (!item) continue
    used.add(channel)
    items.push(item)
  }
  if (!used.has('albedo')) {
    const albedo = await buildSourceAlbedoItem(nodes)
    if (albedo) items.unshift(albedo)
  }
  return items
}

/**
 * Opens the selected image result cards directly in the 3D texture material tool.
 * @param options Selection source used by the toolbar.
 * @returns State and action for the selection toolbar button.
 * @throws Never throws; errors are surfaced through Element Plus messages.
 */
export function useSelectionTextureMaterialTool(options: UseSelectionTextureMaterialToolOptions): {
  openingTextureMaterialTool: Ref<boolean>
  canOpenTextureMaterialTool: ComputedRef<boolean>
  openTextureMaterialTool: () => Promise<void>
} {
  const { openTextureMaterialInPBR } = useTextureMaterialPBRBridge()
  const openingTextureMaterialTool = ref(false)
  const canOpenTextureMaterialTool = computed(() =>
    options.nodes.value.some((node) => {
      const data = getNodeData(node)
      return !!getNodeUrl(data) || !!getRecordId(data)
    }),
  )

  async function openTextureMaterialTool(): Promise<void> {
    if (openingTextureMaterialTool.value) return
    const items = await buildItems(options.nodes.value)
    if (!items.length) {
      ElMessage.warning('选中的卡片里没有可用的 url 或 recordId')
      return
    }
    openingTextureMaterialTool.value = true
    try {
      await openTextureMaterialInPBR(items)
    } finally {
      openingTextureMaterialTool.value = false
    }
  }

  return {
    openingTextureMaterialTool,
    canOpenTextureMaterialTool,
    openTextureMaterialTool,
  }
}
