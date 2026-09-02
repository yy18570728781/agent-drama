import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { setAigcRecordsFavorite, toggleAigcRecordFavorite } from '@/services/assets/aigcRecord.service'

interface AssetStoreLike {
  markStale?: () => void
}

interface ResultRecordActionsDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  selectedNodes: Ref<any[]>
  emit: (event: string, ...args: any[]) => void
  saveHistory: () => void
  assetStore?: AssetStoreLike | null
}

function getNodeRecordId(node: any): string {
  return String(node?.data?.recordId || '').trim()
}

function getNodeRecordUrl(node: any): string {
  return String(
    node?.data?.url
    || node?.data?.preview
    || node?.data?.imageUrl
    || node?.data?.videoUrl
    || node?.data?.audioUrl
    || '',
  ).trim()
}

function isResultRecordNode(node: any): boolean {
  return !!(getNodeRecordId(node) && getNodeRecordUrl(node))
}

function markAssetsStale(assetStore?: AssetStoreLike | null) {
  assetStore?.markStale?.()
}

export function useFlowResultRecordActions(deps: ResultRecordActionsDeps) {
  const selectedResultRecordNodes = computed(() => (
    deps.selectedNodes.value.filter(isResultRecordNode)
  ))

  const hasSelectedResultRecords = computed(() => selectedResultRecordNodes.value.length > 0)
  const areSelectedResultRecordsFavorited = computed(() => (
    hasSelectedResultRecords.value
    && selectedResultRecordNodes.value.every(node => Boolean(node?.data?.is_favorites))
  ))

  async function toggleNodeResultFavorite(nodeId: string) {
    const node = deps.nodes.value.find(item => item.id === nodeId)
    if (!isResultRecordNode(node)) return
    const result = await toggleAigcRecordFavorite(getNodeRecordId(node), Boolean(node?.data?.is_favorites))
    node.data.is_favorites = result.is_favorites
    deps.emit('update:modelNodes', deps.nodes.value)
    markAssetsStale(deps.assetStore)
  }

  function removeResultNodes(targetNodes: any[]) {
    const nodeIds = new Set(targetNodes.map(node => node.id))
    deps.nodes.value = deps.nodes.value.filter(node => !nodeIds.has(node.id))
    deps.edges.value = deps.edges.value.filter(edge => (
      !nodeIds.has(edge.source) && !nodeIds.has(edge.target)
    ))
    deps.emit('update:modelNodes', deps.nodes.value)
    deps.emit('update:modelEdges', deps.edges.value)
    deps.saveHistory()
  }

  async function deleteResultNodes(targetNodes: any[]) {
    if (!targetNodes.length) return
    removeResultNodes(targetNodes)
  }

  async function deleteNodeResultRecord(nodeId: string) {
    const node = deps.nodes.value.find(item => item.id === nodeId)
    if (!isResultRecordNode(node)) return
    await deleteResultNodes([node])
  }

  async function setSelectedResultFavorites(isFavorite: boolean) {
    const targetNodes = selectedResultRecordNodes.value
    if (!targetNodes.length) return
    await setAigcRecordsFavorite(targetNodes.map(getNodeRecordId), isFavorite)
    targetNodes.forEach((node) => {
      node.data.is_favorites = isFavorite
    })
    deps.emit('update:modelNodes', deps.nodes.value)
    markAssetsStale(deps.assetStore)
  }

  async function deleteSelectedResultRecords() {
    const targetNodes = selectedResultRecordNodes.value
    await deleteResultNodes(targetNodes)
  }

  return {
    hasSelectedResultRecords: hasSelectedResultRecords as ComputedRef<boolean>,
    areSelectedResultRecordsFavorited: areSelectedResultRecordsFavorited as ComputedRef<boolean>,
    toggleNodeResultFavorite,
    deleteNodeResultRecord,
    setSelectedResultFavorites,
    deleteSelectedResultRecords,
  }
}
