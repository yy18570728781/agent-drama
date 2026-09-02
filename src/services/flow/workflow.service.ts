import {
  createLocalWorkflow,
  deleteLocalWorkflow,
  getLocalWorkflow,
  listLocalWorkflows,
  updateLocalWorkflow,
} from './localFlowLibrary.service'

export type WorkflowDefinition = Record<string, unknown>
type UnknownRecord = Record<string, unknown>

export interface WorkflowRecord {
  id: string
  name: string
  code?: string
  definition: WorkflowDefinition
  source?: 'cloud' | 'local'
  updated_at?: string
  created_at?: string
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function definitionOf(payload: UnknownRecord): WorkflowDefinition {
  return isRecord(payload.definition) ? payload.definition : {}
}

/**
 * 列出本地画布资产摘要。
 * @returns 按更新时间倒序排列的画布记录。
 */
export async function listWorkflows(): Promise<WorkflowRecord[]> {
  return listLocalWorkflows()
}

/**
 * 创建本地画布资产。
 * @param payload 画布名称、目标分类和初始 definition。
 * @returns 创建完成的本地画布记录。
 */
export async function createWorkflow(payload: UnknownRecord): Promise<WorkflowRecord> {
  return createLocalWorkflow({
    categoryId: String(payload.categoryId || '').trim(),
    definition: definitionOf(payload),
    name: String(payload.name || '').trim() || '未命名工作流',
  })
}

/**
 * 保存本地画布 definition 并同步名称。
 * @param workflowId 画布资产 ID。
 * @param payload 画布名称和最新 definition。
 * @returns 更新后的本地画布记录。
 */
export async function updateWorkflow(
  workflowId: string,
  payload: UnknownRecord,
): Promise<WorkflowRecord> {
  return updateLocalWorkflow(workflowId, {
    definition: definitionOf(payload),
    name: String(payload.name || '').trim() || '未命名工作流',
  })
}

/**
 * 获取本地画布并解析 definition。
 * @param workflowId 画布资产 ID。
 * @returns 带完整 definition 的本地画布记录。
 * @throws 本地画布不存在时抛出异常。
 */
export async function getWorkflow(workflowId: string): Promise<WorkflowRecord> {
  const workflow = getLocalWorkflow(workflowId)
  if (!workflow) throw new Error('本地画布不存在')
  return workflow
}

/**
 * 删除本地画布资产记录。
 * @param workflowId 画布资产 ID。
 * @returns 无返回值。
 */
export async function deleteWorkflow(workflowId: string): Promise<void> {
  deleteLocalWorkflow(workflowId)
}
