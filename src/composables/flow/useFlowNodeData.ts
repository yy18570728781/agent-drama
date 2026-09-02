import { normalizeWorkflowRequest } from '@/utils/workflowNodeData'
import { nodes, selectedNode } from './useFlowCore'
import { useFlowNodeRecordRestore } from './useFlowNodeRecordRestore'
import type { FlowNode } from './flowCore.types'

interface NodeParamUpdate {
  nodeId: string
  paramName: string
  value: unknown
}

interface NodeDataUpdatePayload {
  result?: unknown
  type: string
}

interface GenerationResultRecord {
  items?: unknown[]
  output?: unknown
  url?: unknown
}

export interface UseFlowNodeDataReturn {
  extractPreviewUrl: (item: unknown) => string | null
  extractUrl: (raw: unknown) => string
  onNodeDataUpdate: (nodeId: string, payload: NodeDataUpdatePayload) => void
  onParamUpdate: (payload: NodeParamUpdate) => void
  restoreNodesFromAigcRecordIds: () => Promise<boolean>
}

const NODE_CAPABILITIES: Record<string, string> = {
  text_generation: 'chat',
  image_generation: 'image_generation',
  video_generation: 'video_generation',
  model_generation: 'model_generation',
  audio_generation: 'audio_generation',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getDefaultNodeCapability(node: FlowNode): string {
  const explicit = String(node.data?.defaultCapability || '').trim()
  if (explicit) return explicit
  return NODE_CAPABILITIES[String(node.type || '')] || ''
}

function extractUrl(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (!isRecord(raw)) return ''
  return String(raw.origin_url || raw.url || raw.proxy_url || '')
}

function extractPreviewUrl(item: unknown): string | null {
  if (!isRecord(item)) return null
  return extractUrl(item.url) || null
}

function resolveGenerationPreview(result: unknown): string | null {
  if (typeof result === 'string') return result
  if (!isRecord(result)) return null
  const record: GenerationResultRecord = result
  if (record.items?.length) return extractPreviewUrl(record.items[0])
  if (record.url) return extractUrl(record.url) || null
  if (!record.output) return null
  return typeof record.output === 'string' ? record.output : JSON.stringify(record.output)
}

/**
 * 管理 Flow 节点参数更新、生成结果回填与记录恢复入口。
 * @returns 节点数据处理器与后端记录恢复方法。
 */
export function useFlowNodeData(): UseFlowNodeDataReturn {
  const { restoreNodesFromAigcRecordIds } = useFlowNodeRecordRestore()

  function onParamUpdate({ nodeId, paramName, value }: NodeParamUpdate): void {
    const idx = nodes.value.findIndex((node) => node.id === nodeId)
    if (idx < 0) return
    const node = nodes.value[idx]
    const currentRequest = normalizeWorkflowRequest(node.data?.request)
    const capability = currentRequest?.capability || getDefaultNodeCapability(node)
    if (!capability) return
    const nextRequest = {
      capability,
      mode: currentRequest?.mode || 'standard',
      params: { ...(currentRequest?.params || {}), [paramName]: value },
    }
    nodes.value[idx] = { ...node, data: { ...node.data, request: nextRequest } }
    nodes.value = [...nodes.value]
    if (selectedNode.value?.id === nodeId) selectedNode.value = nodes.value[idx]
  }

  function onNodeDataUpdate(nodeId: string, payload: NodeDataUpdatePayload): void {
    const idx = nodes.value.findIndex((node) => node.id === nodeId)
    if (idx < 0) return
    if (payload.type === 'start') {
      nodes.value[idx] = { ...nodes.value[idx], data: { ...nodes.value[idx].data, status: 'running' } }
      nodes.value = [...nodes.value]
      return
    }
    if (payload.type !== 'complete') return
    const preview = resolveGenerationPreview(payload.result)
    if (!preview) return
    nodes.value[idx] = {
      ...nodes.value[idx],
      data: { ...nodes.value[idx].data, preview, status: 'completed' },
    }
    nodes.value = [...nodes.value]
  }

  return {
    onParamUpdate,
    extractUrl,
    extractPreviewUrl,
    onNodeDataUpdate,
    restoreNodesFromAigcRecordIds,
  }
}
