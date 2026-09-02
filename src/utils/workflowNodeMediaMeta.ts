export type WorkflowMediaMeta = {
  width: number
  height: number
  aspectRatio: number
}

function toPositiveNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : 0
}

/**
 * Normalize persisted/runtime media metadata into a stable shape for ratio repair.
 * Falls back to old top-level fields only when present at runtime.
 */
export function normalizeWorkflowMediaMeta(source: Record<string, any> | undefined): WorkflowMediaMeta | undefined {
  if (!source) return undefined
  const rawMeta = source.mediaMeta && typeof source.mediaMeta === 'object' ? source.mediaMeta : source
  const width = toPositiveNumber(rawMeta.width ?? source.width)
  const height = toPositiveNumber(rawMeta.height ?? source.height)
  if (!(width > 0) || !(height > 0)) return undefined
  const aspectRatio = toPositiveNumber(rawMeta.aspectRatio ?? rawMeta.aspect_ratio ?? source.aspect_ratio) || (width / height)
  return { width, height, aspectRatio }
}

/**
 * Build grouped media metadata from discrete metric values when callers already
 * resolved real media dimensions.
 */
export function buildWorkflowMediaMeta(
  width: unknown,
  height: unknown,
  aspectRatio?: unknown,
): WorkflowMediaMeta | undefined {
  const normalizedWidth = toPositiveNumber(width)
  const normalizedHeight = toPositiveNumber(height)
  if (!(normalizedWidth > 0) || !(normalizedHeight > 0)) return undefined
  const normalizedAspectRatio = toPositiveNumber(aspectRatio) || (normalizedWidth / normalizedHeight)
  return {
    width: normalizedWidth,
    height: normalizedHeight,
    aspectRatio: normalizedAspectRatio,
  }
}

/**
 * Persist only grouped media metadata so refreshed workflows can restore ratio
 * without re-fetching media dimensions.
 */
export function appendPersistedWorkflowMediaMeta(
  target: Record<string, any>,
  source: Record<string, any> | undefined,
): void {
  const mediaMeta = normalizeWorkflowMediaMeta(source)
  if (!mediaMeta) return
  target.mediaMeta = { ...mediaMeta }
}

/**
 * Expand persisted grouped media metadata back into runtime fields used by the
 * current flow node sizing logic.
 */
export function applyRuntimeWorkflowMediaMeta(
  target: Record<string, any>,
  source: Record<string, any> | undefined,
): void {
  const mediaMeta = normalizeWorkflowMediaMeta(source)
  if (!mediaMeta) return
  target.mediaMeta = { ...mediaMeta }
  target.width = mediaMeta.width
  target.height = mediaMeta.height
  target.aspect_ratio = mediaMeta.aspectRatio
}
