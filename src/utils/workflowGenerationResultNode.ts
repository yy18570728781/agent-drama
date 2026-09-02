type WorkflowNodeRecord = Record<string, unknown>

function asRecord(value: unknown): WorkflowNodeRecord {
  return value && typeof value === 'object' ? value as WorkflowNodeRecord : {}
}

/**
 * 判断节点是否承载生成结果或生成结果占位状态。
 * @param node 待判断的工作流节点。
 * @returns 节点是否应按生成结果处理。
 */
export function isWorkflowGenerationResultNode(node: unknown): boolean {
  const nodeRecord = asRecord(node)
  const data = asRecord(nodeRecord.data)
  return nodeRecord.type === 'aigc_result'
    || data.nodeKind === 'aigc_result'
    || Boolean(data._managedGenerationSlot)
    || Boolean(data._resultPlaceholderForNodeId)
    || Boolean(data._generatedFromNodeId)
}

/**
 * 读取生成结果节点关联的 AIGC 记录编号。
 * @param node 工作流结果节点。
 * @returns 可用于查询生成记录的字符串编号；不存在时返回空字符串。
 */
export function getWorkflowGenerationRecordId(node: unknown): string {
  const nodeRecord = asRecord(node)
  const data = asRecord(nodeRecord.data)
  const recordId = data._reeditSourceAigcRecordId
    || data.aigcRecordId
    || data.recordId
    || data.queryId
  return recordId === undefined || recordId === null ? '' : String(recordId).trim()
}
