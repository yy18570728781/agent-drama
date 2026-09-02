type WorkflowTabIdentityLike = {
  id: string
  name?: unknown
  workflowId?: unknown
}

function normalizeWorkflowTabIdentityName(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase()
}

/**
 * 规范化工作流标签的远端标识。
 * @param value 待规范化的标识。
 * @returns 非空标识；无有效标识时返回 null。
 */
export function normalizeWorkflowTabId(value: unknown): string | null {
  const normalized = String(value ?? '').trim()
  return normalized ? normalized : null
}

/**
 * 按远端标识去重标签，并清理与远端标签同名的历史无标识副本。
 * @param tabs 待清理的标签集合。
 * @returns 保持原顺序的去重标签集合。
 */
export function dedupeWorkflowTabs<T extends WorkflowTabIdentityLike>(tabs: T[]): T[] {
  const seenWorkflowIds = new Set<string>()
  const remoteNames = new Set((tabs || [])
    .filter((tab) => !!normalizeWorkflowTabId(tab.workflowId))
    .map((tab) => normalizeWorkflowTabIdentityName(tab.name))
    .filter(Boolean))
  const result: T[] = []

  for (const tab of tabs || []) {
    const workflowId = normalizeWorkflowTabId(tab?.workflowId)
    if (!workflowId) {
      const tabName = normalizeWorkflowTabIdentityName(tab.name)
      if (tabName && remoteNames.has(tabName)) continue
      result.push(tab)
      continue
    }
    if (seenWorkflowIds.has(workflowId)) {
      continue
    }
    seenWorkflowIds.add(workflowId)
    result.push({
      ...tab,
      workflowId,
    })
  }

  return result
}
