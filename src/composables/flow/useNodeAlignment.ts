import { computed, type Ref } from 'vue'
import {
  alignNodes,
  distributeNodes,
  autoLayoutNodes,
  tidyNodes,
  type AlignDirection,
  type DistributeDirection,
} from '@/utils/nodeLayout'

export interface NodeAlignmentDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  getSelectedNodes: Ref<any[]>
  findNode: (id: string) => any
  viewport: Ref<any>
  syncGroupBoundsForNodes: (targetNodes: any[], options?: any) => void
  resizeGroupToFitChildren: (groupId: string, options?: any) => void
  getDirectChildNodes: (groupId: string) => any[]
  fitView: (options?: any) => void
  emit: {
    (e: 'update:modelNodes', value: any[]): void
  }
  saveHistory: () => void
}

export function useNodeAlignment(deps: NodeAlignmentDeps) {
  const {
    nodes,
    edges,
    getSelectedNodes,
    syncGroupBoundsForNodes,
    resizeGroupToFitChildren,
    getDirectChildNodes,
    findNode,
    viewport,
    fitView,
    emit,
    saveHistory,
  } = deps

  const GROUP_PADDING_X = 16
  const GROUP_PADDING_TOP = 16
  const GROUP_PADDING_BOTTOM = 16
  const COLLAPSED_GROUP_WIDTH = 220
  const COLLAPSED_GROUP_HEIGHT = 72

  const selectedGroupNodeForToolbar = computed(() => {
    const selected = getSelectedNodes.value
    if (selected.length !== 1) return null
    return selected[0]?.type === 'groupNode' ? selected[0] : null
  })

  const selectedGroupChildNodes = computed(() => {
    const groupNode = selectedGroupNodeForToolbar.value
    if (!groupNode) return []
    if (groupNode.data?.collapsed) return []
    return getDirectChildNodes(groupNode.id).filter(node => node.type !== 'groupNode' && node.type !== 'waypoint')
  })

  const showGroupAlignmentToolbar = computed(() => !!selectedGroupNodeForToolbar.value)

  const isSelectedGroupLocked = computed(() => !!selectedGroupNodeForToolbar.value?.data?.locked)
  const isSelectedGroupCollapsed = computed(() => !!selectedGroupNodeForToolbar.value?.data?.collapsed)

  function applyAlignToNodes(targetNodes: any[], direction: AlignDirection) {
    if (targetNodes.length < 2) return
    alignNodes(targetNodes, direction)
    syncGroupBoundsForNodes(targetNodes, { preservePosition: true })
    emit('update:modelNodes', nodes.value)
    setTimeout(saveHistory, 50)
  }

  function handleAlign(direction: AlignDirection) {
    applyAlignToNodes(getSelectedNodes.value, direction)
  }

  function applyDistributeToNodes(targetNodes: any[], direction: DistributeDirection) {
    if (targetNodes.length < 3) return
    distributeNodes(targetNodes, direction)
    syncGroupBoundsForNodes(targetNodes, { preservePosition: true })
    emit('update:modelNodes', nodes.value)
    setTimeout(saveHistory, 50)
  }

  function handleDistribute(direction: DistributeDirection) {
    applyDistributeToNodes(getSelectedNodes.value, direction)
  }

  function applyAutoLayoutToNodes(targetNodes: any[]) {
    if (targetNodes.length < 2) return
    autoLayoutNodes(targetNodes, edges.value, { rankdir: 'LR', nodesep: 80, ranksep: 120 })
    syncGroupBoundsForNodes(targetNodes, { preservePosition: true })
    emit('update:modelNodes', nodes.value)
    setTimeout(() => {
      saveHistory()
      fitView({ nodes: targetNodes, padding: 0.2, duration: 300 })
    }, 50)
  }

  function handleAutoLayout() {
    if (selectedGroupNodeForToolbar.value && !isSelectedGroupCollapsed.value) {
      handleGroupAutoLayout()
    } else {
      applyAutoLayoutToNodes(getSelectedNodes.value)
    }
  }

  function applyTidyToNodes(targetNodes: any[]) {
    if (targetNodes.length < 2) return
    const sharedParentId = targetNodes.every(node => node?.parentNode && node.parentNode === targetNodes[0]?.parentNode)
      ? targetNodes[0]?.parentNode
      : ''

    if (sharedParentId) {
      const localLayoutNodes = targetNodes.map((node) => ({
        id: node.id,
        position: {
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0,
        },
        dimensions: node.dimensions,
        style: node.style,
      }))
      tidyNodes(localLayoutNodes)
      localLayoutNodes.forEach((layoutNode) => {
        const targetNode = targetNodes.find(node => node.id === layoutNode.id)
        if (!targetNode) return
        targetNode.position = {
          x: layoutNode.position.x,
          y: layoutNode.position.y,
        }
      })
    } else {
      tidyNodes(targetNodes)
    }
    syncGroupBoundsForNodes(targetNodes, { preservePosition: true })
    emit('update:modelNodes', nodes.value)
    setTimeout(saveHistory, 50)
  }

  function handleTidyNodes() {
    applyTidyToNodes(getSelectedNodes.value)
  }

  function handleTidyGroupNode(groupId: string) {
    const childNodes = getDirectChildNodes(groupId).filter(node => node.type !== 'groupNode' && node.type !== 'waypoint')
    applyTidyToNodes(childNodes)
    resizeGroupToFitChildren(groupId, { preservePosition: true })
  }

  function arrangeNodes() {
    if (selectedGroupNodeForToolbar.value && !isSelectedGroupCollapsed.value) {
      handleGroupTidyNodes()
    } else {
      handleTidyNodes()
    }
  }

  function handleGroupAlign(direction: AlignDirection) {
    applyAlignToNodes(selectedGroupChildNodes.value, direction)
  }

  function handleGroupDistribute(direction: DistributeDirection) {
    applyDistributeToNodes(selectedGroupChildNodes.value, direction)
  }

  function handleGroupAutoLayout() {
    applyAutoLayoutToNodes(selectedGroupChildNodes.value)
  }

  function handleGroupTidyNodes() {
    applyTidyToNodes(selectedGroupChildNodes.value)
  }

  function toggleSelectedGroupLock() {
    const groupNode = selectedGroupNodeForToolbar.value
    if (!groupNode) return
    if (!groupNode.data) groupNode.data = {}
    groupNode.data.locked = !groupNode.data.locked
    emit('update:modelNodes', nodes.value)
    setTimeout(saveHistory, 50)
  }

  return {
    applyAlignToNodes,
    handleAlign,
    applyDistributeToNodes,
    handleDistribute,
    applyAutoLayoutToNodes,
    handleAutoLayout,
    applyTidyToNodes,
    handleTidyNodes,
    handleTidyGroupNode,
    arrangeNodes,
    handleGroupAlign,
    handleGroupDistribute,
    handleGroupAutoLayout,
    handleGroupTidyNodes,
  toggleSelectedGroupLock,
  showGroupAlignmentToolbar,
  isSelectedGroupLocked,
  isSelectedGroupCollapsed,
  selectedGroupNodeForToolbar,
  selectedGroupChildNodes,
  }
}
