export type JsonObject = Record<string, unknown>

export type FlatGraphRecord = JsonObject & {
  edges?: JsonObject[]
  nodes?: JsonObject[]
  subgraphs?: Record<string, JsonObject> | JsonObject[]
  viewport?: { x?: number; y?: number; zoom?: number }
}

type FlatSubgraphMeta = JsonObject & {
  cardPosition?: { x?: number; y?: number }
  id?: string
  name?: string
  parentGraphId?: string
  viewport?: { x?: number; y?: number; zoom?: number }
}

function isPlainObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeGraphId(value: unknown, rootGraphId: string): string {
  return String(value || '').trim() || rootGraphId
}

function cloneWithoutGraphId(record: JsonObject): JsonObject {
  const nextRecord = { ...record }
  delete nextRecord.graphId
  return nextRecord
}

function attachGraphId(records: unknown[], graphId: string, rootGraphId: string): JsonObject[] {
  return records
    .filter(isPlainObject)
    .map((record) => ({
      ...record,
      graphId: normalizeGraphId(record.graphId, graphId || rootGraphId),
    }))
}

function buildSubgraphMeta(subgraphId: string, graphDef: unknown): FlatSubgraphMeta {
  const source = isPlainObject(graphDef) ? graphDef : {}
  const meta: FlatSubgraphMeta = { ...source }
  delete meta.nodes
  delete meta.edges
  delete meta.subgraphs
  meta.id = String(meta.id || subgraphId).trim() || subgraphId
  if (typeof meta.name === 'string') {
    meta.name = meta.name.trim() || '子图'
  }
  if (typeof meta.parentGraphId === 'string') {
    meta.parentGraphId = meta.parentGraphId.trim() || undefined
  }
  return meta
}

export function normalizePersistedSubgraphs(value: unknown): Record<string, JsonObject> {
  if (Array.isArray(value)) {
    return value
      .filter(isPlainObject)
      .reduce<Record<string, JsonObject>>((acc, item) => {
        const subgraphId = String(item.id || '').trim()
        if (!subgraphId) return acc
        acc[subgraphId] = { ...item }
        return acc
      }, {})
  }
  if (!isPlainObject(value)) return {}
  return Object.entries(value).reduce<Record<string, JsonObject>>((acc, [subgraphId, graphDef]) => {
    const normalizedId = String(subgraphId || '').trim()
    if (!normalizedId || !isPlainObject(graphDef)) return acc
    acc[normalizedId] = { ...graphDef }
    return acc
  }, {})
}

export function serializePersistedSubgraphs(subgraphs: Record<string, JsonObject>): JsonObject[] {
  return Object.entries(subgraphs).map(([subgraphId, graphDef]) => ({
    ...graphDef,
    id: String((graphDef as FlatSubgraphMeta).id || subgraphId).trim() || subgraphId,
  }))
}

/**
 * 判断工作流定义是否已经是持久化用的展平结构。
 * @param definition 工作流定义
 * @returns `true` 表示 `subgraphs` 中只保存元数据，节点和边已平铺到顶层
 */
export function isFlattenedWorkflowDefinition(definition: unknown): boolean {
  if (!isPlainObject(definition)) return false
  const subgraphs = normalizePersistedSubgraphs(definition.subgraphs)
  if (!Object.keys(subgraphs).length) return Array.isArray(definition.subgraphs)
  return Object.values(subgraphs).every((graphDef) => {
    if (!isPlainObject(graphDef)) return false
    return !Array.isArray(graphDef.nodes) && !Array.isArray(graphDef.edges)
  })
}

/**
 * 将运行时子图结构转换为保存用的展平结构。
 * @param definition 工作流定义
 * @param rootGraphId 根画布 id
 * @returns 顶层平铺了所有节点和边的工作流定义
 */
export function flattenWorkflowDefinition(
  definition: unknown,
  rootGraphId: string,
): FlatGraphRecord {
  const source = isPlainObject(definition) ? definition as FlatGraphRecord : {}
  const rawSubgraphs = normalizePersistedSubgraphs(source.subgraphs)
  const flatNodes = attachGraphId(Array.isArray(source.nodes) ? source.nodes : [], rootGraphId, rootGraphId)
  const flatEdges = attachGraphId(Array.isArray(source.edges) ? source.edges : [], rootGraphId, rootGraphId)
  const flatSubgraphs: Record<string, FlatSubgraphMeta> = {}

  Object.entries(rawSubgraphs).forEach(([subgraphId, graphDef]) => {
    const normalizedId = String(subgraphId || '').trim()
    if (!normalizedId) return
    const graphRecord = isPlainObject(graphDef) ? graphDef : {}
    flatSubgraphs[normalizedId] = buildSubgraphMeta(normalizedId, graphRecord)
    flatNodes.push(...attachGraphId(Array.isArray(graphRecord.nodes) ? graphRecord.nodes : [], normalizedId, rootGraphId))
    flatEdges.push(...attachGraphId(Array.isArray(graphRecord.edges) ? graphRecord.edges : [], normalizedId, rootGraphId))
  })

  const extras: FlatGraphRecord = { ...source }
  delete extras.nodes
  delete extras.edges
  delete extras.subgraphs

  return {
    ...extras,
    nodes: flatNodes,
    edges: flatEdges,
    viewport: source.viewport || { zoom: 1, x: 0, y: 0 },
    ...(Object.keys(flatSubgraphs).length ? { subgraphs: serializePersistedSubgraphs(flatSubgraphs as Record<string, JsonObject>) } : {}),
  }
}

/**
 * 将保存用的展平结构还原为运行时使用的子图结构。
 * @param definition 工作流定义
 * @param rootGraphId 根画布 id
 * @returns 包含 `subgraphs[id].nodes/edges` 的运行时工作流定义
 */
export function hydrateFlattenedWorkflowDefinition(
  definition: unknown,
  rootGraphId: string,
): FlatGraphRecord {
  const flattened = flattenWorkflowDefinition(definition, rootGraphId)
  const rawSubgraphs = normalizePersistedSubgraphs(flattened.subgraphs)
  const hydratedSubgraphs = Object.fromEntries(
    Object.entries(rawSubgraphs).map(([subgraphId, meta]) => [
      subgraphId,
      {
        ...buildSubgraphMeta(subgraphId, meta),
        nodes: [],
        edges: [],
        viewport: (isPlainObject(meta) && isPlainObject(meta.viewport)) ? meta.viewport : { zoom: 1, x: 0, y: 0 },
      },
    ]),
  ) as Record<string, FlatSubgraphMeta & { nodes: JsonObject[]; edges: JsonObject[] }>

  const rootNodes: JsonObject[] = []
  const rootEdges: JsonObject[] = []
  const allNodes = Array.isArray(flattened.nodes) ? flattened.nodes : []
  const allEdges = Array.isArray(flattened.edges) ? flattened.edges : []

  allNodes.filter(isPlainObject).forEach((node) => {
    const graphId = normalizeGraphId(node.graphId, rootGraphId)
    if (graphId === rootGraphId || !hydratedSubgraphs[graphId]) {
      rootNodes.push(cloneWithoutGraphId(node))
      return
    }
    hydratedSubgraphs[graphId].nodes.push(cloneWithoutGraphId(node))
  })

  allEdges.filter(isPlainObject).forEach((edge) => {
    const graphId = normalizeGraphId(edge.graphId, rootGraphId)
    if (graphId === rootGraphId || !hydratedSubgraphs[graphId]) {
      rootEdges.push(cloneWithoutGraphId(edge))
      return
    }
    hydratedSubgraphs[graphId].edges.push(cloneWithoutGraphId(edge))
  })

  const extras: FlatGraphRecord = { ...flattened }
  delete extras.nodes
  delete extras.edges
  delete extras.subgraphs

  return {
    ...extras,
    nodes: rootNodes,
    edges: rootEdges,
    viewport: flattened.viewport || { zoom: 1, x: 0, y: 0 },
    ...(Object.keys(hydratedSubgraphs).length ? { subgraphs: hydratedSubgraphs } : {}),
  }
}
