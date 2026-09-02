import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { listWorkflows } from '@/services/flow/workflow.service'

type WorkflowItem = Awaited<ReturnType<typeof listWorkflows>>[number]

export interface RecentWorkflowProject {
  id: string
  title: string
  date: string
  cover: string
}

interface UseRecentWorkflowsReturn {
  isLoading: Ref<boolean>
  recentProjects: ComputedRef<RecentWorkflowProject[]>
  loadRecentProjects: () => Promise<void>
}

const DEFAULT_COVER = ''

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function getTimestamp(workflow: WorkflowItem): number {
  const source = workflow.updated_at || workflow.created_at || ''
  const timestamp = new Date(source).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function readStringField(source: unknown, keys: string[]): string {
  if (!isRecord(source)) return ''
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function findCoverInNodes(definition: unknown): string {
  const nodes = isRecord(definition) && Array.isArray(definition.nodes) ? definition.nodes : []
  for (const node of nodes) {
    const direct = readStringField(node, ['cover', 'thumb', 'preview', 'url', 'imageUrl'])
    if (direct) return direct
    const data = isRecord(node) ? node.data : null
    const dataCover = readStringField(data, ['cover', 'thumb', 'preview', 'url', 'imageUrl'])
    if (dataCover) return dataCover
  }
  return DEFAULT_COVER
}

function toRecentProject(workflow: WorkflowItem): RecentWorkflowProject {
  const dateSource = workflow.updated_at || workflow.created_at || ''
  return {
    id: workflow.id,
    title: workflow.name,
    date: formatDate(dateSource),
    cover: findCoverInNodes(workflow.definition),
  }
}

/**
 * 读取最近保存的画布列表，并转换为发现页项目卡片数据。
 * @returns 最近画布加载状态、排序后的项目列表和刷新方法
 */
export function useRecentWorkflows(): UseRecentWorkflowsReturn {
  const isLoading = ref(false)
  const workflows = ref<WorkflowItem[]>([])

  const recentProjects = computed<RecentWorkflowProject[]>(() =>
    [...workflows.value]
      .sort((left, right) => getTimestamp(right) - getTimestamp(left))
      .slice(0, 5)
      .map(toRecentProject),
  )

  async function loadRecentProjects(): Promise<void> {
    isLoading.value = true
    try {
      workflows.value = await listWorkflows()
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    recentProjects,
    loadRecentProjects,
  }
}
