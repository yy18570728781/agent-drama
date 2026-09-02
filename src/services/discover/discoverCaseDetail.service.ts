import type { WorkflowDefinition, FlowEdge, FlowNode, WorkflowSubgraph } from '@/composables/flow/flowCore.types'
import type {
  DiscoverCase,
  DiscoverCaseDetail,
  DiscoverCategoryAccess,
} from '@/components/discover/discover.types'
import { getWorkflowAssetDetail } from '@/api/workflowAssets'
import { getFlowCaseCarouselIds, saveFlowCaseCarouselIds } from '@/api/flowCases'
import { FLOW_CATEGORY_PERMISSION } from '@/components/flow/library/flowCategoryPermission.constants'
import { hydrateStoredWorkflowDefinition } from '@/composables/flow/flowDefinitionHydration.utils'
import { listFlowCanvasCategoryOptions } from '@/services/flow/flowCanvasCategory.service'
import { loadFlowCanvasDefinition } from '@/services/flow/flowCanvasStorage.service'
import { createWorkflow, type WorkflowRecord } from '@/services/flow/workflow.service'

type UnknownRecord = Record<string, unknown>

const FLOW_CASE_ASSET_TYPE = 14

export interface DiscoverCasePreviewData {
  definition: WorkflowDefinition
  title: string
}

export interface ProductionCanvasCategoryOption {
  disabled: boolean
  id: string
  label: string
  pid: string
}

export interface CreateProductionCanvasFromCaseInput {
  caseId: string
  categoryId: string
  name: string
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function assetRecord(value: unknown): UnknownRecord {
  if (!isRecord(value)) return {}
  return isRecord(value.asset) ? value.asset : value
}

function readText(source: UnknownRecord, keys: readonly string[]): string {
  for (const key of keys) {
    const value = source[key]
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
      return String(value).trim()
    }
  }
  return ''
}

function readAssetType(asset: UnknownRecord): number {
  const value = Number(asset.type ?? asset.category_type ?? FLOW_CASE_ASSET_TYPE)
  return Number.isFinite(value) ? value : FLOW_CASE_ASSET_TYPE
}

function assertFlowCase(asset: UnknownRecord): void {
  if (readAssetType(asset) !== FLOW_CASE_ASSET_TYPE) {
    throw new Error('该资产不是画布案例，无法执行案例操作')
  }
}

function normalizeDefinition(value: UnknownRecord): WorkflowDefinition {
  const subgraphs = isRecord(value.subgraphs)
    ? value.subgraphs as Record<string, WorkflowSubgraph>
    : {}
  const viewport = isRecord(value.viewport)
    ? value.viewport as unknown as WorkflowDefinition['viewport']
    : { x: 0, y: 0, zoom: 1 }
  return {
    ...value,
    nodes: Array.isArray(value.nodes) ? value.nodes as FlowNode[] : [],
    edges: Array.isArray(value.edges) ? value.edges as FlowEdge[] : [],
    subgraphs,
    viewport,
  }
}

/**
 * 读取案例资产详情并合并所属分类的当前用户权限。
 * @param item 发现页已有的案例展示数据。
 * @param accessById type 14 分类 ID 对应的权限索引。
 * @returns 包含资产类型、分类 ID 和有效权限的案例详情。
 * @throws 详情不存在或资产并非 type 14 案例时抛出异常。
 */
export async function loadDiscoverCaseDetail(
  item: DiscoverCase,
  accessById: ReadonlyMap<string, DiscoverCategoryAccess>,
): Promise<DiscoverCaseDetail> {
  const [raw, recommendedIds] = await Promise.all([
    getWorkflowAssetDetail(item.id),
    getFlowCaseCarouselIds().catch(() => null),
  ])
  if (!raw) throw new Error('案例详情不存在')
  const asset = assetRecord(raw)
  assertFlowCase(asset)
  const categoryId = readText(asset, ['category_id', 'asset_category_id'])
  const access = accessById.get(categoryId)
  return {
    ...item,
    assetType: readAssetType(asset),
    category: access?.name || item.category,
    categoryId,
    featured: recommendedIds ? recommendedIds.includes(item.id) : item.featured,
    permission: access?.permission ?? item.permission ?? 0,
    title: readText(asset, ['name']) || item.title,
  }
}

/**
 * 只读加载 type 14 案例的画布定义，不执行资产迁移或元数据写回。
 * @param caseId 案例资产 ID。
 * @returns 可供只读 Vue Flow 画布渲染的定义。
 * @throws 案例不存在、类型错误或 COS 快照不可用时抛出异常。
 */
export async function loadDiscoverCasePreview(
  caseId: string,
): Promise<DiscoverCasePreviewData> {
  const raw = await getWorkflowAssetDetail(caseId)
  if (!raw) throw new Error('案例详情不存在')
  const asset = assetRecord(raw)
  assertFlowCase(asset)
  const code = readText(asset, ['code']) || `canvas_case_${caseId}`
  const loaded = await loadFlowCanvasDefinition(asset.content, code)
  const definition = hydrateStoredWorkflowDefinition(loaded.definition)
  return {
    definition: normalizeDefinition(definition),
    title: readText(asset, ['name']) || '画布案例',
  }
}

/**
 * 只读加载 type 14 案例的画布定义，不执行资产迁移或元数据写回。
 * @param caseId 案例资产 ID。
 * @returns 可供只读 Vue Flow 画布渲染的定义。
 * @throws 案例不存在、类型错误或 COS 快照不可用时抛出异常。
 */
export async function loadDiscoverCaseDefinition(caseId: string): Promise<WorkflowDefinition> {
  const preview = await loadDiscoverCasePreview(caseId)
  return preview.definition
}

/**
 * 读取 type 11 生产画布目录树，并标记当前用户不可写入的节点。
 * @returns 按接口顺序排列、包含父子关系和选择状态的目录选项。
 * @throws type 11 分类接口加载失败时抛出异常。
 */
export async function listProductionCanvasCategoryOptions(): Promise<ProductionCanvasCategoryOption[]> {
  return listFlowCanvasCategoryOptions()
}

/**
 * 将 type 14 案例复制为新的 type 11 生产画布。
 * @param input 案例 ID、目标 type 11 目录和新画布名称。
 * @returns 新建生产画布记录，其 ID 与原案例 ID 不同。
 * @throws 案例读取或生产画布创建失败时抛出异常。
 */
export async function createProductionCanvasFromCase(
  input: CreateProductionCanvasFromCaseInput,
): Promise<WorkflowRecord> {
  const sourceDefinition = await loadDiscoverCaseDefinition(input.caseId)
  return createWorkflow({
    categoryId: input.categoryId,
    definition: sourceDefinition,
    name: input.name,
  })
}

/**
 * 更新案例的发现页推荐状态，新推荐追加到配置末尾以保留推荐时间顺序。
 * @param detail type 14 案例详情及当前用户的分类权限。
 * @param recommended 是否加入推荐列表。
 * @returns 保存后的推荐状态。
 * @throws 非管理权限或推荐配置接口失败时抛出异常。
 */
export async function updateDiscoverCaseRecommendation(
  detail: DiscoverCaseDetail,
  recommended: boolean,
): Promise<boolean> {
  if (detail.permission < FLOW_CATEGORY_PERMISSION.MANAGE) {
    throw new Error('只有管理权限可以修改推荐状态')
  }
  const currentIds = await getFlowCaseCarouselIds()
  const nextIds = recommended
    ? [...currentIds.filter((id) => id !== detail.id), detail.id]
    : currentIds.filter((id) => id !== detail.id)
  await saveFlowCaseCarouselIds(nextIds)
  return recommended
}
