type TabLike = {
  id: string
  workflowId?: unknown
}

type NamedTabLike = TabLike & {
  isDraft: boolean
  name?: unknown
  nodes?: unknown[]
  edges?: unknown[]
  subgraphs?: unknown
}

const LEGACY_PLACEHOLDER_TAB_NAMES = new Set(['未命名工作流', '工作流'])

function normalizeWorkflowId(value: unknown): string {
  return String(value ?? '').trim()
}

/**
 * 从打开的标签中选择当前标签，当前标识失效时回退到第一个标签。
 * @param tabs 已打开的工作流标签
 * @param activeTabId 当前标签标识
 * @returns 匹配的标签；列表为空时返回 null
 */
export function pickWorkflowTab<T extends TabLike>(tabs: T[], activeTabId: string): T | null {
  if (!Array.isArray(tabs) || !tabs.length) return null
  return tabs.find((tab) => tab.id === activeTabId) || tabs[0] || null
}

/**
 * 统一草稿标签名称，避免恢复历史占位名称。
 * @param name 原标签名称
 * @param workflowId 远端工作流标识
 * @param isDraft 是否为草稿
 * @returns 可展示的标签名称
 */
export function normalizeWorkflowTabName(name: unknown, workflowId: unknown, isDraft: boolean): string {
  const nextName = String(name || '').trim()
  if (!isDraft || normalizeWorkflowId(workflowId)) return nextName
  return !nextName || LEGACY_PLACEHOLDER_TAB_NAMES.has(nextName) ? '未命名' : nextName
}

/**
 * 判断标签是否为没有名称与内容的临时占位草稿。
 * @param tab 待检查标签
 * @returns 是否应从打开标签集合中移除
 */
export function isPlaceholderWorkflowTab(tab: NamedTabLike): boolean {
  if (!tab?.isDraft || normalizeWorkflowId(tab.workflowId)) return false
  const subgraphCount = tab.subgraphs && typeof tab.subgraphs === 'object' && !Array.isArray(tab.subgraphs)
    ? Object.keys(tab.subgraphs).length
    : 0
  return !(tab.nodes?.length || tab.edges?.length || subgraphCount || String(tab.name || '').trim())
}

/**
 * 将工作流标签加入集合，相同工作流或相同标签标识只保留最新实例。
 * @param tabs 当前标签集合
 * @param nextTab 待加入的标签
 * @returns 保持原有顺序且追加最新标签的新集合
 */
export function upsertWorkflowTab<T extends NamedTabLike>(tabs: T[], nextTab: T): T[] {
  const nextWorkflowId = normalizeWorkflowId(nextTab.workflowId)
  const nextName = String(nextTab.name || '').trim().toLocaleLowerCase()
  const remainingTabs = (tabs || []).filter((tab) => {
    if (tab.id === nextTab.id) return false
    if (!nextWorkflowId) return true
    const tabWorkflowId = normalizeWorkflowId(tab.workflowId)
    if (tabWorkflowId === nextWorkflowId) return false
    const tabName = String(tab.name || '').trim().toLocaleLowerCase()
    return !!tabWorkflowId || !nextName || tabName !== nextName
  })
  return [...remainingTabs, nextTab]
}
