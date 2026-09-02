type AssetLike = { id?: string | number | null }
type ResultGroup = AssetLike[]
type GroupSummary = {
  groupKey: string
  assetIds: string[]
  lastAssetId: string
}

function normalizeGroup(group: unknown): ResultGroup {
  return Array.isArray(group) ? group.filter(Boolean) : []
}

export function getGroupKey(group: unknown): string {
  const items = normalizeGroup(group)
  const firstId = items[0]?.id
  return firstId == null ? '' : String(firstId)
}

export function summarizeGroups(groups: unknown[] = []): GroupSummary[] {
  return groups
    .map((group) => {
      const items = normalizeGroup(group)
      const assetIds = items.map((item) => String(item?.id)).filter(Boolean)
      if (!assetIds.length) return null
      return { groupKey: getGroupKey(items), assetIds, lastAssetId: assetIds[assetIds.length - 1] }
    })
    .filter((group): group is GroupSummary => Boolean(group))
}

export function detectNewResultEffects(previousGroups: unknown[] = [], nextGroups: unknown[] = []) {
  const previous = summarizeGroups(previousGroups)
  const next = summarizeGroups(nextGroups)
  const previousMap = new Map(previous.map((group) => [group.groupKey, group]))
  const highlightGroupKeys: string[] = []
  const selectLatestGroupKeys: string[] = []
  const selectLatestIndices: Record<string, number> = {}
  for (const group of next) {
    const previousGroup = previousMap.get(group.groupKey)
    const isNew = !previousGroup
      || previousGroup.assetIds.length !== group.assetIds.length
      || previousGroup.lastAssetId !== group.lastAssetId
    if (!isNew) continue
    highlightGroupKeys.push(group.groupKey)
    selectLatestGroupKeys.push(group.groupKey)
    selectLatestIndices[group.groupKey] = Math.max(0, group.assetIds.length - 1)
  }
  return {
    hasNewResults: highlightGroupKeys.length > 0,
    highlightGroupKeys,
    selectLatestGroupKeys,
    selectLatestIndices,
    shouldScrollToBottom: highlightGroupKeys.length > 0,
  }
}
