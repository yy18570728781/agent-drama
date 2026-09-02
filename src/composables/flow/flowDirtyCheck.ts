type WorkflowDefinition = {
  nodes?: unknown[]
  edges?: unknown[]
  subgraphs?: unknown
}

type NormalizeWorkflowDefinition = (definition: WorkflowDefinition) => unknown

function omitViewport(record: unknown): unknown {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record
  const comparable = { ...(record as Record<string, unknown>) }
  delete comparable.viewport
  return comparable
}

function canonicalizeObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeObjectKeys)
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, canonicalizeObjectKeys(record[key])]),
  )
}

function normalizeComparableNodePosition(node: unknown): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node
  const record = { ...(node as Record<string, unknown>) }
  if (!record.position || typeof record.position !== 'object' || Array.isArray(record.position)) return record
  const position = { ...(record.position as Record<string, unknown>) }
  if (typeof position.x === 'number') position.x = Math.round(position.x / 20) * 20
  if (typeof position.y === 'number') position.y = Math.round(position.y / 20) * 20
  record.position = position
  return record
}

function normalizeComparableGraph(graph: unknown): unknown {
  const comparable = omitViewport(graph)
  if (!comparable || typeof comparable !== 'object' || Array.isArray(comparable)) return comparable
  const record = { ...(comparable as Record<string, unknown>) }
  if (Array.isArray(record.nodes)) record.nodes = record.nodes.map(normalizeComparableNodePosition)
  return record
}

function buildComparableDefinition(definition: unknown): unknown {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) return definition
  const comparable = normalizeComparableGraph(definition) as Record<string, unknown>
  if (Array.isArray(comparable.subgraphs)) {
    comparable.subgraphs = comparable.subgraphs.map(normalizeComparableGraph)
  } else if (comparable.subgraphs && typeof comparable.subgraphs === 'object') {
    comparable.subgraphs = Object.fromEntries(
      Object.entries(comparable.subgraphs).map(([graphId, graph]) => [graphId, normalizeComparableGraph(graph)]),
    )
  }
  return canonicalizeObjectKeys(comparable)
}

/**
 * 统一脏检查口径，避免运行时补字段导致“未改动也提示未保存”。
 * @param normalizeWorkflowDefinition 工作流定义标准化函数
 * @param currentDefinition 当前画布内容
 * @param savedDefinition 最近保存的画布内容
 * @returns 内容是否存在需要保存的变化
 */
export function hasDefinitionChanges(
  normalizeWorkflowDefinition: NormalizeWorkflowDefinition,
  currentDefinition: WorkflowDefinition,
  savedDefinition: WorkflowDefinition,
): boolean {
  const normalizedCurrent = buildComparableDefinition(
    normalizeWorkflowDefinition({
      nodes: currentDefinition.nodes || [],
      edges: currentDefinition.edges || [],
      subgraphs: currentDefinition.subgraphs || {},
    }),
  )
  const normalizedSaved = buildComparableDefinition(
    normalizeWorkflowDefinition({
      nodes: savedDefinition.nodes || [],
      edges: savedDefinition.edges || [],
      subgraphs: savedDefinition.subgraphs || {},
    }),
  )

  return JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedSaved)
}
