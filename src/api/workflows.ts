import { getPublishedLocalVersion } from './workflowLocalStore'

type UnknownRecord = Record<string, unknown>
export type WorkflowNodeType = { type: string; [key: string]: unknown }

export async function getNodeTypes(): Promise<{ nodeTypes: WorkflowNodeType[]; capabilityPorts: UnknownRecord }> {
  return { nodeTypes: [], capabilityPorts: {} }
}

export async function listWorkflowCapabilities(): Promise<unknown[]> {
  return []
}

export async function listWorkflowTemplates(): Promise<unknown[]> {
  return []
}

export async function instantiateWorkflowTemplate(_templateId: string, payload: UnknownRecord = {}): Promise<UnknownRecord> {
  return payload
}

export function getPublishedWorkflowVersion(workflowId: string) {
  return getPublishedLocalVersion(workflowId)
}

export async function runWorkflow(_workflowId: string): Promise<never> {
  throw new Error('工作流由前端编排生成任务，不再使用 Sidecar 执行接口')
}

export async function getWorkflowExecutionArtifacts(_executionId: string): Promise<unknown[]> {
  return []
}

type ExecutionEventHandlers = {
  onConnected?: (event: unknown) => void
  onStatus?: (event: unknown) => void
  onProgress?: (event: unknown) => void
  onNodeStarted?: (event: unknown) => void
  onNodeCompleted?: (event: unknown) => void
  onCompleted?: (event: unknown) => void
  onFailed?: (event: unknown) => void
  onError?: (message: string, event?: unknown) => void
}

export function subscribeExecution(_executionId: string, handlers: ExecutionEventHandlers = {}): () => void {
  queueMicrotask(() => handlers.onError?.('工作流 Sidecar 执行接口已移除'))
  return () => undefined
}
