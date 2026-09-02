/**
 * 生成事件（SSE）→ 节点 data 的纯函数 patcher（独立节点与 texture_material items 共用）。
 *
 * 只写 SSE 带来的字段 + 解析出的资产 url/thumb/recordId，不调用 buildResultNodeData /
 * applyResolvedAssetToNodeData —— 那俩负责构造带 ports/inputs/outputs 的运行期节点，
 * 与 SSE 驱动的 item.data 更新无关。
 *
 * 调用方负责把返回值写回各自的位置：
 *   - 独立节点：nodes.value[idx].data = patchXxx(currentData, payload, deps, ...)
 *   - 容器 item：updateItemDataByXxx(tmNodeId, key, (cur) => patchXxx(cur, payload, deps, ...))
 */

export interface GenerationDataPatcherDeps {
  applyRecordIdToNodeData: (data: any, recordId: string) => any
  buildResultCardLabel: (recordId: string, modelName?: string) => string
  resolveNodeModelDisplayName?: (nodeId: string, data: any) => string
  extractEventRecordId?: (payload: any) => string
  extractGenerateFailReason?: (error: any) => string
  normalizeResultItems?: (result: any) => any[]
  findTeamonesAigcRecord?: (recordId: string) => Promise<any>
}

export interface GenerationDataPatcherHelpers {
  resolveCompletedResultAsset: (item: any, result: any, index: number) => Promise<any>
}

/** created：累积 recordId/taskId/model/prompt，转 running 态。 */
export function patchDataOnCreated(
  currentData: Record<string, any>,
  payload: any,
  deps: GenerationDataPatcherDeps,
  opts: { nodeId?: string } = {},
): Record<string, any> {
  const taskId = String(payload?.taskId || '').trim()
  const recordId = deps.extractEventRecordId?.(payload) || (payload?.recordId == null ? '' : String(payload.recordId))
  const displayName = (opts.nodeId && deps.resolveNodeModelDisplayName
    ? deps.resolveNodeModelDisplayName(opts.nodeId, currentData)
    : '') || String(payload?.model || payload?.modelId || payload?.modelDisplayName || '').trim()
  const slotPrompt = String(payload?.prompt || '').trim()

  const base = recordId ? deps.applyRecordIdToNodeData(currentData, recordId) : { ...currentData }
  const next: any = { ...base }
  if (displayName) {
    next.model = next.model || displayName
    if (recordId) next.label = deps.buildResultCardLabel(recordId, displayName)
  }
  if (slotPrompt) next.prompt = slotPrompt
  if (taskId) next.taskId = taskId
  next.status = 'running'
  next.isGenerating = true
  next.progress = 0
  return next
}

/** progress：按 percent 更新进度，必要时补 recordId。 */
export function patchDataOnProgress(
  currentData: Record<string, any>,
  payload: any,
  deps: GenerationDataPatcherDeps,
): Record<string, any> {
  const taskId = String(payload?.taskId || '').trim()
  const recordId = deps.extractEventRecordId?.(payload) || ''
  const percent = payload?.result?.percent
  const hadRecordId = !!String(currentData.recordId || '').trim()
  const base = recordId && !hadRecordId ? deps.applyRecordIdToNodeData(currentData, recordId) : { ...currentData }
  const next: any = { ...base, status: 'running', isGenerating: true }
  if (taskId) next.taskId = taskId
  if (typeof percent === 'number') next.progress = percent
  return next
}

/** complete 第一步：异步解析结果资产（拉 AIGC record）。与 currentData 无关，可提前执行。 */
export async function resolveCompletedAssetForPayload(
  payload: any,
  deps: GenerationDataPatcherDeps,
  helpers: GenerationDataPatcherHelpers,
): Promise<{ first: any; result: any; resolved: any }> {
  const result = payload?.result || {}
  const items = deps.normalizeResultItems?.(result) || []
  const first = items[0] || {}
  const resolved = await helpers.resolveCompletedResultAsset(first, result, 0)
  const recordId = String(resolved?.recordId || deps.extractEventRecordId?.(payload) || '').trim()
  let record = resolved?.record || null
  if (!record && recordId && deps.findTeamonesAigcRecord) {
    try {
      record = await deps.findTeamonesAigcRecord(recordId)
    } catch (error) {
      console.warn('[FlowCanvas] fetch record for completed payload failed:', error)
    }
  }
  const recordMedia = record?.media?.[0] || record?.media_info || null
  const mediaInfo = payload?.data?.media_info || payload?.result?.data?.media_info || payload?.media_info || {}
  const preview = String(resolved?.preview || recordMedia?.origin_url || record?.url || mediaInfo?.origin_url || '').trim()
  const thumb = String(resolved?.thumb || recordMedia?.thumb || recordMedia?.thumbnail_url || mediaInfo?.thumbnail_url || mediaInfo?.thumb || preview).trim()
  return {
    first,
    result,
    resolved: {
      ...resolved,
      ...(recordId ? { recordId } : {}),
      ...(record ? { record } : {}),
      ...(preview ? { preview } : {}),
      ...(thumb ? { thumb } : {}),
    },
  }
}

/**
 * complete 第二步：把解析出的 url/thumb/recordId/model 直接并入 currentData。
 * 不走 buildResultNodeData —— item.data 只承载 SSE 结果字段，ports 等运行期结构由打散时补。
 */
export function applyCompletedPatch(
  currentData: Record<string, any>,
  ctx: { first: any; result: any; resolved: any },
  deps: GenerationDataPatcherDeps,
): Record<string, any> {
  const resolved = ctx.resolved || {}
  const recordId = String(resolved.recordId || '').trim()
  const url = String(resolved.preview || '').trim()
  const thumb = String(resolved.thumb || url).trim()
  const modelName = String(currentData?.model || '').trim()
  const next: any = { ...currentData }
  if (recordId) next.recordId = recordId
  if (url) {
    next.url = url
    next.preview = url
    next.imageUrl = url
  }
  if (thumb) next.thumb = thumb
  if (modelName && recordId) next.label = deps.buildResultCardLabel(recordId, modelName)
  next.mediaType = next.mediaType || 'image'
  next.status = 'completed'
  next.isGenerating = false
  next.progress = undefined
  delete next.taskId
  delete next._activeTaskId
  delete next._genState
  delete next.request
  delete next.capability
  delete next.mode
  delete next.params
  delete next.failReason
  delete next.fail_reason
  delete next.statusText
  return next
}

/** error：标 failed，写 failReason。 */
export function patchDataOnError(
  currentData: Record<string, any>,
  payload: any,
  deps: GenerationDataPatcherDeps,
): Record<string, any> {
  const failReason = deps.extractGenerateFailReason?.(payload?.error) || '生成失败'
  return {
    ...currentData,
    status: 'failed',
    isGenerating: false,
    progress: undefined,
    failReason,
    fail_reason: failReason,
    statusText: failReason,
  }
}
