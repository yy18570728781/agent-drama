import type { UseBatchGridNodeDeps } from './useBatchGridNode'
import type { TextureMaterialItem } from '@/composables/flow/textureMaterial.types'
import type { PBRChannel } from '@/types/pbr.types'

/**
 * 判定 item 是否"持有"某 taskId（与独立节点判定口径一致：data.taskId / data._activeTaskId / data._genState）。
 */
function itemOwnsTaskId(it: TextureMaterialItem, taskId: string): boolean {
  if (!taskId) return false
  const d = it.data || {}
  const direct = String(d.taskId || d._activeTaskId || '').trim()
  if (direct === taskId) return true
  const genState = d._genState || {}
  return String(genState.task_id || genState.taskId || '').trim() === taskId
}

function patchItemData(
  items: TextureMaterialItem[],
  predicate: (it: TextureMaterialItem) => boolean,
  itemPatch: (current: TextureMaterialItem) => TextureMaterialItem,
): { items: TextureMaterialItem[]; touched: boolean } {
  let touched = false
  const next = items.map((it) => {
    if (!predicate(it)) return it
    touched = true
    return itemPatch(it)
  })
  return { items: touched ? next : items, touched }
}

function commitItems(
  tmNodeId: string,
  nextItems: TextureMaterialItem[],
  deps: UseBatchGridNodeDeps,
): void {
  const { nodes, emit, saveHistory } = deps
  const idx = nodes.value.findIndex((n: any) => n.id === tmNodeId)
  if (idx < 0) return
  const tmNode = nodes.value[idx]
  nodes.value[idx] = { ...tmNode, data: { ...tmNode.data, items: nextItems } }
  nodes.value = [...nodes.value]
  emit('update:modelNodes', nodes.value)
  saveHistory()
}

/**
 * 按 pbrChannel 定位 item 并合并 data 字段（created 事件按通道写入 taskId/recordId/prompt）。
 * dataPatch 接收当前 data，返回要合并的字段（与独立节点 deps 函数返回值对接）。
 */
export function updateItemDataByChannel(
  tmNodeId: string,
  channel: PBRChannel,
  dataPatch: (current: Record<string, any>) => Record<string, any>,
  deps: UseBatchGridNodeDeps,
): void {
  const { nodes } = deps
  const tmNode = nodes.value.find((n: any) => n.id === tmNodeId)
  const items: TextureMaterialItem[] = tmNode?.data?.items || []
  const { items: nextItems, touched } = patchItemData(
    items,
    (it) => it.pbrChannel === channel,
    (it) => ({ ...it, data: { ...(it.data || {}), ...dataPatch(it.data || {}) } }),
  )
  if (!touched) return
  commitItems(tmNodeId, nextItems, deps)
}

/**
 * 按 taskId 定位 item 并合并 data 字段（progress/complete/error 主路径）。
 */
export function updateItemDataByTaskId(
  tmNodeId: string,
  taskId: string,
  dataPatch: (current: Record<string, any>) => Record<string, any>,
  deps: UseBatchGridNodeDeps,
): void {
  if (!taskId) return
  const { nodes } = deps
  const tmNode = nodes.value.find((n: any) => n.id === tmNodeId)
  const items: TextureMaterialItem[] = tmNode?.data?.items || []
  const { items: nextItems, touched } = patchItemData(
    items,
    (it) => itemOwnsTaskId(it, taskId),
    (it) => ({ ...it, data: { ...(it.data || {}), ...dataPatch(it.data || {}) } }),
  )
  if (!touched) return
  commitItems(tmNodeId, nextItems, deps)
}

export function replaceItemByChannel(
  tmNodeId: string,
  channel: PBRChannel,
  itemPatch: (item: TextureMaterialItem) => TextureMaterialItem,
  deps: UseBatchGridNodeDeps,
): void {
  const { nodes } = deps
  const tmNode = nodes.value.find((n: any) => n.id === tmNodeId)
  const items: TextureMaterialItem[] = tmNode?.data?.items || []
  const { items: nextItems, touched } = patchItemData(items, (it) => it.pbrChannel === channel, itemPatch)
  if (!touched) return
  commitItems(tmNodeId, nextItems, deps)
}

export function upsertItemByChannel(
  tmNodeId: string,
  channel: PBRChannel,
  createItem: () => TextureMaterialItem,
  itemPatch: (item: TextureMaterialItem) => TextureMaterialItem,
  deps: UseBatchGridNodeDeps,
): void {
  const { nodes } = deps
  const tmNode = nodes.value.find((n: any) => n.id === tmNodeId)
  const items: TextureMaterialItem[] = tmNode?.data?.items || []
  const index = items.findIndex((it) => it.pbrChannel === channel)
  const nextItems = [...items]
  if (index >= 0) nextItems[index] = itemPatch(nextItems[index])
  else nextItems.push(itemPatch(createItem()))
  commitItems(tmNodeId, nextItems, deps)
}

export function replaceItemByTaskId(
  tmNodeId: string,
  taskId: string,
  itemPatch: (item: TextureMaterialItem) => TextureMaterialItem,
  deps: UseBatchGridNodeDeps,
): void {
  if (!taskId) return
  const { nodes } = deps
  const tmNode = nodes.value.find((n: any) => n.id === tmNodeId)
  const items: TextureMaterialItem[] = tmNode?.data?.items || []
  const { items: nextItems, touched } = patchItemData(items, (it) => itemOwnsTaskId(it, taskId), itemPatch)
  if (!touched) return
  commitItems(tmNodeId, nextItems, deps)
}

/** 查询某 taskId 在容器 items 里的通道（用于 finalizePbrChannel）。 */
export function findChannelByTaskId(
  tmNodeId: string,
  taskId: string,
  deps: UseBatchGridNodeDeps,
): PBRChannel | null {
  if (!taskId) return null
  const { nodes } = deps
  const tmNode = nodes.value.find((n: any) => n.id === tmNodeId)
  const items: TextureMaterialItem[] = tmNode?.data?.items || []
  return items.find((it) => itemOwnsTaskId(it, taskId))?.pbrChannel || null
}
