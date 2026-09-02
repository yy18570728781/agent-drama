import { idbGet, idbSet } from '@/utils/indexedDBStorage'
import type { PersistedWorkflowTabs } from '@/composables/flow/flowCore.types'

interface FlowTabIdentity {
  id: string
  name?: unknown
  workflowId?: unknown
}

const TABS_STORAGE_KEY = 'workflow_tabs'

function normalizeId(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeName(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase()
}

function isSameTabIdentity(candidate: FlowTabIdentity, target: FlowTabIdentity): boolean {
  if (candidate.id === target.id) return true
  const targetWorkflowId = normalizeId(target.workflowId)
  if (!targetWorkflowId) return false
  const candidateWorkflowId = normalizeId(candidate.workflowId)
  if (candidateWorkflowId) return candidateWorkflowId === targetWorkflowId
  return !!normalizeName(target.name) && normalizeName(candidate.name) === normalizeName(target.name)
}

/**
 * 从本地会话中最终移除已关闭标签，防止并发保存恢复旧标签。
 * @param target 已关闭标签的身份信息。
 * @param nextActiveTabId 关闭后的活动标签标识。
 * @returns 持久化完成后的 Promise。
 */
export async function removePersistedFlowTab(
  target: FlowTabIdentity,
  nextActiveTabId: string,
): Promise<void> {
  const stored = await idbGet<PersistedWorkflowTabs>(TABS_STORAGE_KEY)
  if (!stored?.tabs?.length) return
  await idbSet(TABS_STORAGE_KEY, {
    ...stored,
    activeTabId: nextActiveTabId,
    tabs: stored.tabs.filter((tab) => !isSameTabIdentity(tab, target)),
  })
}
