import type { FlowLibraryCanvas, FlowLibraryCanvasQuery, FlowLibraryCategory } from '@/api/flowLibrary'
import type { WorkflowDefinition, WorkflowRecord } from './workflow.service'

type LocalWorkflowRecord = WorkflowRecord & {
  categoryId: string
  cover: string
  createdBy: string
  isFavorite: boolean
}

const LOCAL_CATEGORY_KEY = 'infinite_canvas_local_flow_categories'
const LOCAL_WORKFLOW_KEY = 'infinite_canvas_local_flow_workflows'
const ROOT_CATEGORY_ID = 'local_canvas_root'
const LOCAL_WORKFLOW_PREFIX = 'local_canvas_'

function nowIso(): string {
  return new Date().toISOString()
}

function readJsonArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]') as unknown
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function writeJsonArray<T>(key: string, value: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function rootCategory(): FlowLibraryCategory {
  return {
    code: ROOT_CATEGORY_ID,
    createdBy: 'local',
    id: ROOT_CATEGORY_ID,
    name: '本地画布',
    pathIds: [],
    permission: 31,
    pid: '0',
  }
}

function normalizeCategories(categories: FlowLibraryCategory[]): FlowLibraryCategory[] {
  const root = categories.find((item) => item.id === ROOT_CATEGORY_ID) || rootCategory()
  const rest = categories.filter((item) => item.id !== ROOT_CATEGORY_ID)
  return [{ ...root, permission: 31, pid: '0' }, ...rest]
}

function readCategories(): FlowLibraryCategory[] {
  return normalizeCategories(readJsonArray<FlowLibraryCategory>(LOCAL_CATEGORY_KEY))
}

function writeCategories(categories: FlowLibraryCategory[]): void {
  writeJsonArray(LOCAL_CATEGORY_KEY, normalizeCategories(categories))
}

function readWorkflows(): LocalWorkflowRecord[] {
  return readJsonArray<LocalWorkflowRecord>(LOCAL_WORKFLOW_KEY)
}

function writeWorkflows(workflows: LocalWorkflowRecord[]): void {
  writeJsonArray(LOCAL_WORKFLOW_KEY, workflows)
}

function cloneDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  return JSON.parse(JSON.stringify(definition || {})) as WorkflowDefinition
}

function createId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function categoryPathIds(categoryId: string, categories: FlowLibraryCategory[]): string[] {
  const parent = categories.find((item) => item.id === categoryId)
  return parent ? [...parent.pathIds, parent.id] : []
}

export function isLocalWorkflowId(workflowId: string): boolean {
  return workflowId.startsWith(LOCAL_WORKFLOW_PREFIX)
}

export function listLocalFlowCategories(): FlowLibraryCategory[] {
  return readCategories()
}

export function listLocalFlowLibraryCanvases(query: FlowLibraryCanvasQuery): FlowLibraryCanvas[] {
  const keyword = query.keyword?.trim().toLocaleLowerCase() || ''
  const filtered = readWorkflows()
    .filter((item) => item.categoryId === query.categoryId)
    .filter((item) => !keyword || item.name.toLocaleLowerCase().includes(keyword))
    .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)))
  const start = Math.max(0, (query.page - 1) * query.pageSize)
  return filtered.slice(start, start + query.pageSize).map((item) => ({
    categoryId: item.categoryId,
    cover: item.cover,
    createdBy: item.createdBy,
    id: item.id,
    isFavorite: item.isFavorite,
    name: item.name,
    updatedAt: item.updated_at || item.created_at || '',
  }))
}

export function createLocalFlowCategory(name: string, pid: string): string {
  const categories = readCategories()
  const parentId = pid || ROOT_CATEGORY_ID
  const id = createId('local_folder_')
  const category: FlowLibraryCategory = {
    code: id,
    createdBy: 'local',
    id,
    name: name.trim() || '未命名文件夹',
    pathIds: categoryPathIds(parentId, categories),
    permission: 31,
    pid: parentId,
  }
  writeCategories([...categories, category])
  return id
}

export function updateLocalFlowCategory(categoryId: string, name: string): void {
  writeCategories(readCategories().map((category) =>
    category.id === categoryId ? { ...category, name: name.trim() || category.name } : category,
  ))
}

export function deleteLocalFlowCategory(categoryId: string): void {
  if (categoryId === ROOT_CATEGORY_ID) return
  const categories = readCategories()
  const descendants = new Set<string>([categoryId])
  let changed = true
  while (changed) {
    changed = false
    categories.forEach((category) => {
      if (descendants.has(category.pid) && !descendants.has(category.id)) {
        descendants.add(category.id)
        changed = true
      }
    })
  }
  writeCategories(categories.filter((category) => !descendants.has(category.id)))
  writeWorkflows(readWorkflows().filter((workflow) => !descendants.has(workflow.categoryId)))
}

export function listLocalWorkflows(): WorkflowRecord[] {
  return readWorkflows().map((workflow) => ({
    ...workflow,
    definition: cloneDefinition(workflow.definition),
    source: 'local',
  }))
}

export function createLocalWorkflow(payload: {
  categoryId?: string
  definition: WorkflowDefinition
  name: string
}): WorkflowRecord {
  const timestamp = nowIso()
  const id = createId(LOCAL_WORKFLOW_PREFIX)
  const workflow: LocalWorkflowRecord = {
    categoryId: payload.categoryId || ROOT_CATEGORY_ID,
    code: id,
    cover: '',
    created_at: timestamp,
    createdBy: 'local',
    definition: cloneDefinition(payload.definition),
    id,
    isFavorite: false,
    name: payload.name.trim() || '未命名工作流',
    source: 'local',
    updated_at: timestamp,
  }
  writeWorkflows([workflow, ...readWorkflows()])
  return { ...workflow, definition: cloneDefinition(workflow.definition), source: 'local' }
}

export function getLocalWorkflow(workflowId: string): WorkflowRecord | null {
  const workflow = readWorkflows().find((item) => item.id === workflowId)
  return workflow ? { ...workflow, definition: cloneDefinition(workflow.definition), source: 'local' } : null
}

export function updateLocalWorkflow(
  workflowId: string,
  payload: { definition?: WorkflowDefinition; name?: string },
): WorkflowRecord {
  const workflows = readWorkflows()
  const index = workflows.findIndex((item) => item.id === workflowId)
  if (index < 0) throw new Error('本地画布不存在')
  const previous = workflows[index]
  const next: LocalWorkflowRecord = {
    ...previous,
    definition: payload.definition ? cloneDefinition(payload.definition) : previous.definition,
    name: String(payload.name || previous.name).trim() || '未命名工作流',
    updated_at: nowIso(),
  }
  workflows[index] = next
  writeWorkflows(workflows)
  return { ...next, definition: cloneDefinition(next.definition), source: 'local' }
}

export function deleteLocalWorkflow(workflowId: string): void {
  writeWorkflows(readWorkflows().filter((item) => item.id !== workflowId))
}

export function toggleLocalWorkflowFavorite(workflowId: string): void {
  writeWorkflows(readWorkflows().map((item) =>
    item.id === workflowId ? { ...item, isFavorite: !item.isFavorite, updated_at: nowIso() } : item,
  ))
}
