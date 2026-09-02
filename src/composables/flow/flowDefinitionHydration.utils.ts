import {
  hydrateFlattenedWorkflowDefinition,
  isFlattenedWorkflowDefinition,
  normalizePersistedSubgraphs,
  type JsonObject,
} from './flowSubgraphPersistence.utils'

interface SharedWorkflowData extends JsonObject {
  requests?: unknown[]
  strings?: unknown[]
}

function isPlainObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toArrayIndex(value: unknown): number | null {
  const index = Number(value)
  return Number.isInteger(index) && index >= 0 ? index : null
}

function hydrateNodeData(node: JsonObject, shared: SharedWorkflowData): JsonObject {
  const data = isPlainObject(node.data) ? { ...node.data } : {}
  const strings = Array.isArray(shared.strings) ? shared.strings : []
  const requests = Array.isArray(shared.requests) ? shared.requests : []
  const urlRef = toArrayIndex(data.urlRef)
  const thumbRef = toArrayIndex(data.thumbRef)
  const requestRef = toArrayIndex(data.requestRef)

  if (urlRef !== null && typeof strings[urlRef] === 'string') data.url = strings[urlRef]
  if (thumbRef !== null && typeof strings[thumbRef] === 'string') data.thumb = strings[thumbRef]
  if (requestRef !== null && requests[requestRef] !== undefined) data.request = requests[requestRef]
  delete data.urlRef
  delete data.thumbRef
  delete data.requestRef
  return { ...node, data }
}

function hydrateGraph(definition: JsonObject, rootGraphId: string): JsonObject {
  const shared = isPlainObject(definition.shared) ? definition.shared : {}
  const nodes = Array.isArray(definition.nodes)
    ? definition.nodes.filter(isPlainObject).map((node) => hydrateNodeData(node, shared))
    : []
  const hydrated: JsonObject = { ...definition, nodes }
  delete hydrated.shared

  if (isFlattenedWorkflowDefinition(hydrated)) {
    return hydrateFlattenedWorkflowDefinition(hydrated, rootGraphId)
  }

  const subgraphs = normalizePersistedSubgraphs(definition.subgraphs)
  hydrated.subgraphs = Object.fromEntries(
    Object.entries(subgraphs).map(([graphId, graph]) => [
      graphId,
      hydrateGraph(graph, graphId),
    ]),
  )
  return hydrated
}

/**
 * Restore shared node fields and flattened subgraphs from a persisted canvas snapshot.
 * @param definition Persisted workflow definition loaded from storage.
 * @param rootGraphId Identifier used by root-level nodes without an explicit graph ID.
 * @returns Runtime-shaped workflow definition suitable for canvas rendering.
 */
export function hydrateStoredWorkflowDefinition(
  definition: unknown,
  rootGraphId = 'root',
): JsonObject {
  return hydrateGraph(isPlainObject(definition) ? definition : {}, rootGraphId)
}
