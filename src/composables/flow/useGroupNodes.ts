import { nextTick } from 'vue'
import {
  GRID_DEFAULT_GAP,
  masonryLayout,
  type MeasuredChild,
} from '@/utils/gridGridLayout'
import {
  handleGridDropOps,
  cleanupGridOrdersForDeletedNodesOps,
  registerGridChildOps,
  type GridGroupOpsCtx,
} from '@/composables/flow/useGridSplitGroup'
import type { Ref, ComputedRef } from 'vue'
import { buildGroupCreationPlan } from './flowGroupCreation'

// ── Group layout constants ───────────────────────────────────
const GROUP_PADDING_X = 16
const GROUP_PADDING_TOP = 16
const GROUP_PADDING_BOTTOM = 16
const COLLAPSED_GROUP_WIDTH = 220
const COLLAPSED_GROUP_HEIGHT = 72

// ── Dependency interface ─────────────────────────────────────
export interface GroupNodesDeps {
  nodes: Ref<any[]>
  edges: Ref<any[]>
  findNode: (id: string) => any
  getSelectedNodes: ComputedRef<any[]>
  contextMenu: Ref<{ visible: boolean; x: number; y: number; canvasX: number; canvasY: number }>
  groupToolbarDropdown: Ref<string | null>
  allowSubgraphCreate: boolean
  emit: {
    (e: 'update:modelNodes', value: any[]): void
    (e: 'update:modelEdges', value: any[]): void
    (e: 'create-subgraph', value: any): void
  }
  saveHistory: () => void
}

export function useGroupNodes(deps: GroupNodesDeps) {
  const {
    nodes,
    edges,
    findNode,
    getSelectedNodes,
    contextMenu,
    groupToolbarDropdown,
    allowSubgraphCreate,
    emit,
    saveHistory,
  } = deps

  // ==================== Helpers ====================

  function getNodeRenderedSize(node: any) {
    const width = node?.dimensions?.width
      || parseFloat(String(node?.style?.width || ''))
      || 320
    const height = node?.dimensions?.height
      || parseFloat(String(node?.style?.height || ''))
      || 100
    return { width, height }
  }

  function isDescendantOf(node: any, ancestorId: string) {
    let current = node.parentNode
    while (current) {
      if (current === ancestorId) return true
      const parent = nodes.value.find((n: any) => n.id === current)
      current = parent?.parentNode
    }
    return false
  }

  function isNodeDescendantOfSelectedAncestor(node: any, candidateAncestorId: string) {
    let currentParentId = node?.parentNode
    while (currentParentId) {
      if (currentParentId === candidateAncestorId) return true
      currentParentId = findNode(currentParentId)?.parentNode
    }
    return false
  }

  // ==================== Subgraph naming ====================

  function normalizeSubgraphName(value: string) {
    return String(value || '').trim().toLowerCase()
  }

  function buildUniquePastedSubgraphLabel(baseLabel: string, occupiedNames: Set<string> = new Set()) {
    const rootLabel = String(baseLabel || '').trim() || '子图'
    const normalizedRoot = normalizeSubgraphName(rootLabel)
    if (normalizedRoot && !occupiedNames.has(normalizedRoot)) {
      occupiedNames.add(normalizedRoot)
      return rootLabel
    }

    let counter = 1
    while (counter < 10000) {
      const candidate = `${rootLabel} 副本${counter > 1 ? ` ${counter}` : ''}`
      const normalizedCandidate = normalizeSubgraphName(candidate)
      if (!occupiedNames.has(normalizedCandidate)) {
        occupiedNames.add(normalizedCandidate)
        return candidate
      }
      counter += 1
    }
    return `${rootLabel} 副本`
  }

  // ==================== Group utilities ====================

  function getGroupDepth(groupNode: any) {
    let depth = 0
    let currentParentId = groupNode?.parentNode
    while (currentParentId) {
      depth += 1
      currentParentId = findNode(currentParentId)?.parentNode
    }
    return depth
  }

  function isGroupSelfOrAncestorOf(groupId: string, descendantGroupId: string) {
    let currentGroupId = descendantGroupId
    while (currentGroupId) {
      if (currentGroupId === groupId) return true
      currentGroupId = findNode(currentGroupId)?.parentNode
    }
    return false
  }

  function isPointInsideGroup(x: number, y: number, groupNode: any) {
    if (!groupNode || groupNode.type !== 'groupNode') return false
    const groupX = groupNode.computedPosition?.x ?? groupNode.position?.x ?? 0
    const groupY = groupNode.computedPosition?.y ?? groupNode.position?.y ?? 0
    const groupWidth = groupNode.dimensions?.width
      || parseFloat(String(groupNode.style?.width || ''))
      || 400
    const groupHeight = groupNode.dimensions?.height
      || parseFloat(String(groupNode.style?.height || ''))
      || 300

    return x >= groupX && x <= groupX + groupWidth && y >= groupY && y <= groupY + groupHeight
  }

  function getBoundedNodePositionInGroup(absX: number, absY: number, width: number, height: number, groupNode: any) {
    const groupX = groupNode?.computedPosition?.x ?? groupNode?.position?.x ?? 0
    const groupY = groupNode?.computedPosition?.y ?? groupNode?.position?.y ?? 0
    const groupWidth = groupNode?.dimensions?.width
      || parseFloat(String(groupNode?.style?.width || ''))
      || 400
    const groupHeight = groupNode?.dimensions?.height
      || parseFloat(String(groupNode?.style?.height || ''))
      || 300

    const rawX = absX - groupX
    const rawY = absY - groupY
    const minX = GROUP_PADDING_X
    const minY = GROUP_PADDING_TOP
    const maxX = Math.max(minX, groupWidth - width - GROUP_PADDING_X)
    const maxY = Math.max(minY, groupHeight - height - GROUP_PADDING_BOTTOM)

    return {
      x: Math.min(maxX, Math.max(minX, rawX)),
      y: Math.min(maxY, Math.max(minY, rawY)),
    }
  }

  function isNodeFullyInsideGroup(absX: number, absY: number, width: number, height: number, groupNode: any) {
    if (!groupNode || groupNode.type !== 'groupNode') return false
    const groupX = groupNode.computedPosition?.x ?? groupNode.position?.x ?? 0
    const groupY = groupNode.computedPosition?.y ?? groupNode.position?.y ?? 0
    const groupWidth = groupNode.dimensions?.width
      || parseFloat(String(groupNode.style?.width || ''))
      || 400
    const groupHeight = groupNode.dimensions?.height
      || parseFloat(String(groupNode.style?.height || ''))
      || 300

    return (
      absX >= groupX
      && absY >= groupY
      && absX + width <= groupX + groupWidth
      && absY + height <= groupY + groupHeight
    )
  }

  function getDirectChildNodes(groupId: string) {
    return nodes.value.filter((node: any) => node?.parentNode === groupId)
  }

  function applyCollapsedGroupFrame(groupNode: any) {
    if (!groupNode) return
    groupNode.style = {
      ...(groupNode.style || {}),
      width: `${COLLAPSED_GROUP_WIDTH}px`,
      height: `${COLLAPSED_GROUP_HEIGHT}px`,
    }
  }

  function collectDescendantNodeIds(groupNodeId: string, bucket: Set<string> = new Set()) {
    nodes.value.forEach((node: any) => {
      if (!node || node.parentNode !== groupNodeId || bucket.has(node.id)) return
      bucket.add(node.id)
      if (node.type === 'groupNode') {
        collectDescendantNodeIds(node.id, bucket)
      }
    })
    return bucket
  }

  function syncCollapsedGroupVisibility() {
    const collapsedGroupIds = nodes.value
      .filter((node: any) => node?.type === 'groupNode' && node?.data?.collapsed)
      .map((node: any) => node.id)

    const hiddenNodeIds = new Set<string>()
    collapsedGroupIds.forEach((groupId: string) => collectDescendantNodeIds(groupId, hiddenNodeIds))

    let nodesChanged = false
    nodes.value.forEach((node: any) => {
      const shouldHide = hiddenNodeIds.has(node.id)
      const prevHidden = !!node.hidden
      const prevCollapsedByGroup = !!node.data?._collapsedByGroup
      const prevClass = String(node.class || '')
      if (node.hidden) {
        node.hidden = false
        nodesChanged = true
      }
      if (!node.data) node.data = {}
      if (!!node.data._collapsedByGroup !== shouldHide) {
        node.data._collapsedByGroup = shouldHide
        nodesChanged = true
      }
      const classTokens = new Set(String(node.class || '').split(/\s+/).filter(Boolean))
      const hadCollapsedClass = classTokens.has('is-collapsed-by-group')
      if (shouldHide) {
        classTokens.add('is-collapsed-by-group')
        node.selected = false
      } else {
        classTokens.delete('is-collapsed-by-group')
      }
      const nextClass = Array.from(classTokens).join(' ')
      if (nextClass !== String(node.class || '')) {
        node.class = nextClass
        nodesChanged = true
      } else if (hadCollapsedClass !== shouldHide) {
        nodesChanged = true
      }
    })

    let edgesChanged = false
    edges.value.forEach((edge: any) => {
      const shouldHide = hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target)
      if (!!edge.hidden !== shouldHide) {
        edge.hidden = shouldHide
        edgesChanged = true
      }
    })

    if (nodesChanged) {
      nodes.value = [...nodes.value]
    }
    if (edgesChanged) {
      edges.value = [...edges.value]
    }
  }

  function captureExpandedGroupFrame(groupNode: any) {
    if (!groupNode) return
    if (!groupNode.data) groupNode.data = {}
    const width = Number(groupNode?.dimensions?.width) || parseFloat(String(groupNode?.style?.width || '')) || 200
    const height = Number(groupNode?.dimensions?.height) || parseFloat(String(groupNode?.style?.height || '')) || 120
    groupNode.data._expandedFrame = { width, height }
  }

  function restoreExpandedGroupFrame(groupNode: any) {
    const frame = groupNode?.data?._expandedFrame
    if (!frame) return false
    groupNode.style = {
      ...(groupNode.style || {}),
      width: `${Math.max(200, Number(frame.width) || 200)}px`,
      height: `${Math.max(120, Number(frame.height) || 120)}px`,
    }
    return true
  }

  /**
   * Grid 模式瀑布流布局：按子节点实际尺寸排列，列宽归一到目标宽度，行高取本行最高，
   * 组尺寸刚好包裹所有子节点 + padding。仅 layoutMode === 'grid' 时生效。
   * 尺寸优先级：dimensions > style.width/height > width/height > cellWidth/cellHeight(200)。
   */
  function layoutGridChildren(groupId: string): boolean {
    const groupNode = findNode(groupId)
    if (!groupNode || groupNode.type !== 'groupNode') return false
    if (groupNode.data?.layoutMode !== 'grid') return false

    const split = groupNode.data?.gridSplit
    if (!split || typeof split.cols !== 'number') return false

    const cols = split.cols
    const gap = typeof split.gap === 'number' ? split.gap : GRID_DEFAULT_GAP
    const fallbackCellW = typeof split.cellWidth === 'number' && split.cellWidth > 0 ? split.cellWidth : 200
    const fallbackCellH = typeof split.cellHeight === 'number' && split.cellHeight > 0 ? split.cellHeight : 200

    const gridOrder: string[] = Array.isArray(groupNode.data?.gridOrder)
      ? groupNode.data.gridOrder
      : []

    // 收集 gridOrder 中的非空子节点 + 测量实际尺寸
    const measured: MeasuredChild[] = []
    gridOrder.forEach((childId: string) => {
      if (!childId) return
      const child = findNode(childId)
      if (!child || child.parentNode !== groupId) return
      const w = child.dimensions?.width
        || parseFloat(String(child.style?.width || '')) || child.width || fallbackCellW
      const h = child.dimensions?.height
        || parseFloat(String(child.style?.height || '')) || child.height || fallbackCellH
      measured.push({ id: childId, width: w, height: h })
    })

    // rows 派生值：= ceil(子节点数 / cols)，不作为上限；拆分初始恰好填满，拖入新节点自动涨行。
    split.rows = Math.max(1, Math.ceil(measured.length / Math.max(cols, 1)))

    const { positions, groupWidth, groupHeight } = masonryLayout(
      measured,
      cols,
      gap,
      GROUP_PADDING_X,
      GROUP_PADDING_TOP,
      GROUP_PADDING_BOTTOM,
    )

    let touched = 0
    measured.forEach((m) => {
      const child = findNode(m.id)
      if (!child) return
      const pos = positions.get(m.id)
      if (!pos) return
      child.position = { x: pos.x, y: pos.y }
      touched += 1
    })

    groupNode.style = {
      ...(groupNode.style || {}),
      width: `${Math.max(groupWidth, 200)}px`,
      height: `${Math.max(groupHeight, 120)}px`,
    }

    if (touched > 0) {
      nodes.value = [...nodes.value]
    }
    return true
  }

  // Grid 拖拽/增删联动：实现已抽到 useGridSplitGroup 的 *Ops 函数，这里仅组装 ctx 并转发。
  function buildGridOpsCtx(): GridGroupOpsCtx {
    return {
      nodes,
      findNode,
      emit: () => emit('update:modelNodes', nodes.value),
      saveHistory,
      getNodeRenderedSize,
      isPointInsideGroup,
      getGroupDepth,
      layoutGridChildren,
    }
  }

  function handleGridDrop(node: any, absX: number, absY: number): boolean {
    return handleGridDropOps(node, absX, absY, buildGridOpsCtx())
  }

  function cleanupGridOrdersForDeletedNodes(deletedIds: Set<string>): void {
    cleanupGridOrdersForDeletedNodesOps(deletedIds, buildGridOpsCtx())
  }

  function registerGridChildIfNeeded(nodeId: string): boolean {
    return registerGridChildOps(nodeId, buildGridOpsCtx())
  }

  function resizeGroupToFitChildren(groupId: string, options: any = {}) {
    const { preservePosition = false, expandOnly = false } = options
    const groupNode = findNode(groupId)
    if (!groupNode || groupNode.type !== 'groupNode') return false
    if (groupNode.data?.collapsed) {
      applyCollapsedGroupFrame(groupNode)
      return true
    }
    // grid 模式：交给 layoutGridChildren 处理，不走自由布局的 child-bbox 逻辑
    if (groupNode.data?.layoutMode === 'grid') {
      return layoutGridChildren(groupId)
    }

    const childNodes = getDirectChildNodes(groupId)
    if (!childNodes.length) return false

    const groupAbsX = groupNode.computedPosition?.x ?? groupNode.position.x
    const groupAbsY = groupNode.computedPosition?.y ?? groupNode.position.y

    if (preservePosition) {
      let minRelX = Infinity
      let minRelY = Infinity
      let maxRelX = -Infinity
      let maxRelY = -Infinity

      childNodes.forEach((childNode: any) => {
        const { width, height } = getNodeRenderedSize(childNode)
        const relX = childNode.position?.x ?? 0
        const relY = childNode.position?.y ?? 0
        minRelX = Math.min(minRelX, relX)
        minRelY = Math.min(minRelY, relY)
        maxRelX = Math.max(maxRelX, relX + width)
        maxRelY = Math.max(maxRelY, relY + height)
      })

      const shiftX = minRelX < GROUP_PADDING_X ? Math.round((GROUP_PADDING_X - minRelX) / 10) * 10 : 0
      const shiftY = minRelY < GROUP_PADDING_TOP ? Math.round((GROUP_PADDING_TOP - minRelY) / 10) * 10 : 0

      if (shiftX || shiftY) {
        childNodes.forEach((childNode: any) => {
          childNode.position = {
            x: (childNode.position?.x ?? 0) + shiftX,
            y: (childNode.position?.y ?? 0) + shiftY,
          }
        })
        maxRelX += shiftX
        maxRelY += shiftY
      }

      let newWidth = Math.max(200, Math.round((maxRelX + GROUP_PADDING_X) / 10) * 10)
      let newHeight = Math.max(120, Math.round((maxRelY + GROUP_PADDING_BOTTOM) / 10) * 10)

      if (expandOnly) {
        const curW = groupNode.dimensions?.width
          || parseFloat(String(groupNode.style?.width || ''))
          || 400
        const curH = groupNode.dimensions?.height
          || parseFloat(String(groupNode.style?.height || ''))
          || 300
        newWidth = Math.max(curW, newWidth)
        newHeight = Math.max(curH, newHeight)
      }

      groupNode.style = {
        ...(groupNode.style || {}),
        width: `${newWidth}px`,
        height: `${newHeight}px`,
      }
      return true
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    childNodes.forEach((childNode: any) => {
      const { width, height } = getNodeRenderedSize(childNode)
      const x = groupAbsX + (childNode.position?.x ?? 0)
      const y = groupAbsY + (childNode.position?.y ?? 0)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + width)
      maxY = Math.max(maxY, y + height)
    })

    const nextGroupX = Math.round((minX - GROUP_PADDING_X) / 10) * 10
    const nextGroupY = Math.round((minY - GROUP_PADDING_TOP) / 10) * 10

    childNodes.forEach((childNode: any) => {
      const childAbsX = groupAbsX + (childNode.position?.x ?? 0)
      const childAbsY = groupAbsY + (childNode.position?.y ?? 0)
      childNode.position = {
        x: Math.round((childAbsX - nextGroupX) / 10) * 10,
        y: Math.round((childAbsY - nextGroupY) / 10) * 10,
      }
    })

    groupNode.position = { x: nextGroupX, y: nextGroupY }
    groupNode.style = {
      ...(groupNode.style || {}),
      width: `${Math.max(200, Math.round((maxX - minX + GROUP_PADDING_X * 2) / 10) * 10)}px`,
      height: `${Math.max(120, Math.round((maxY - minY + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM) / 10) * 10)}px`,
    }
    return true
  }

  function resizeGroupChain(groupId: string, options: any = {}) {
    let currentGroupId = groupId
    while (currentGroupId) {
      resizeGroupToFitChildren(currentGroupId, options)
      const currentGroup = findNode(currentGroupId)
      currentGroupId = currentGroup?.parentNode || ''
    }
  }

  function syncGroupBoundsForNodes(targetNodes: any[] = [], options: any = {}) {
    const groupIds = new Set(
      targetNodes
        .map((node: any) => node?.parentNode)
        .filter(Boolean)
    )
    groupIds.forEach((groupId: string) => {
      resizeGroupChain(groupId, options)
    })
  }

  function toggleGroupToolbarDropdown(key: string) {
    groupToolbarDropdown.value = groupToolbarDropdown.value === key ? null : key
  }

  function getExpandedSelectedNodes() {
    const selected = getSelectedNodes.value
    const selectedIds = new Set(selected.map((node: any) => node.id))
    selectedIds.forEach((id: string) => {
      const node = findNode(id)
      if (node?.type === 'groupNode') {
        nodes.value.forEach((childNode: any) => {
          if (isDescendantOf(childNode, id)) {
            selectedIds.add(childNode.id)
          }
        })
      }
    })

    return [...selectedIds]
      .map((id: string) => findNode(id))
      .filter(Boolean)
  }

  // ==================== Assign / Group / Ungroup ====================

  // 节点落入组内时自动分配（支持 groupNode 嵌套）；中心点判定 + 深度优先。
  function assignToGroupIfOverlapping(node: any, absX: number, absY: number) {
    // grid 模式短路：被拖节点已在 grid 组内时由 handleGridDrop 接管
    if (node?.parentNode) {
      const parentGroup = findNode(node.parentNode)
      if (parentGroup?.type === 'groupNode' && parentGroup?.data?.layoutMode === 'grid') {
        return
      }
    }
    const previousParentId = node.parentNode || ''
    const { width: nw, height: nh } = getNodeRenderedSize(node)
    const currentParentGroup = node.parentNode ? findNode(node.parentNode) : null
    const shouldKeepLockedParent = !!(currentParentGroup?.type === 'groupNode' && currentParentGroup?.data?.locked)

    // 获取所有候选组：排除自身及其后代（防止循环引用），深度优先排序
    const groups = nodes.value
      .filter((n: any) => {
        if (n.type !== 'groupNode' || n.id === node.id) return false
        // groupNode 不能成为自己后代的子节点（防止循环）
        if (node.type === 'groupNode' && isGroupSelfOrAncestorOf(node.id, n.id)) return false
        return true
      })
      .sort((a: any, b: any) => getGroupDepth(b) - getGroupDepth(a))

    // 中心点判定：优先最深层匹配组
    const centerX = absX + nw / 2
    const centerY = absY + nh / 2
    const hoveredGroup = groups.find((g: any) => isPointInsideGroup(centerX, centerY, g))

    // 确定目标组：锁定组优先 → 更深 hover 组 → 仍在当前父组内（保留）→ 否则回根级。
    let targetGroup
    if (shouldKeepLockedParent) {
      targetGroup = currentParentGroup
    } else if (hoveredGroup) {
      targetGroup = hoveredGroup
    } else if (currentParentGroup && isPointInsideGroup(centerX, centerY, currentParentGroup)) {
      targetGroup = currentParentGroup
    } else {
      targetGroup = null
    }

    const isSameLockedGroup = shouldKeepLockedParent && previousParentId === targetGroup?.id
    if (targetGroup) {
      const isNewGridChild =
        targetGroup?.data?.layoutMode === 'grid' && previousParentId !== targetGroup.id
      node.parentNode = targetGroup.id
      node.extent = undefined
      // 锁定组内拖动时不 clamp 位置，先让节点自由移动，随后 resize 组来适应
      node.position = isSameLockedGroup
        ? { x: absX - (targetGroup.computedPosition?.x ?? targetGroup.position?.x ?? 0), y: absY - (targetGroup.computedPosition?.y ?? targetGroup.position?.y ?? 0) }
        : getBoundedNodePositionInGroup(absX, absY, nw, nh, targetGroup)
      // 防御网：节点被自由分配路径塞进 grid 组时（handleGridDrop 未命中），
      // 必须登记到 gridOrder，否则 layoutGridChildren 不会排版它，会叠在落点
      if (isNewGridChild) {
        registerGridChildIfNeeded(node.id)
      }
    } else {
      // 不在任何组内，回到根级
      node.parentNode = undefined
      node.extent = undefined
      node.position = { x: absX, y: absY }
    }

    // 换组时 resize 旧组和新组
    if (previousParentId && previousParentId !== node.parentNode) {
      resizeGroupChain(previousParentId, { preservePosition: true, expandOnly: true })
    }
    if (node.parentNode && previousParentId !== node.parentNode) {
      resizeGroupChain(node.parentNode, { preservePosition: true, expandOnly: true })
    }
    // 锁定组内拖动节点时，组区域也要跟随扩大
    if (isSameLockedGroup) {
      resizeGroupChain(node.parentNode, { preservePosition: true, expandOnly: true })
    }
  }

  function handleGroupSelected() {
    const selected = getSelectedNodes.value
    if (selected.length < 2) {
      contextMenu.value.visible = false
      return
    }
    const topLevelSelected = selected.filter((node: any) => {
      return !selected.some((candidate: any) => candidate.id !== node.id && isNodeDescendantOfSelectedAncestor(node, candidate.id))
    })
    if (!topLevelSelected.length) {
      contextMenu.value.visible = false
      return
    }

    const plan = buildGroupCreationPlan(topLevelSelected)
    if (!plan) return
    nodes.value.unshift(plan.groupNode)

    // 父子关系改变后必须换算为相对坐标，否则 Vue Flow 会让节点发生视觉跳动。
    nextTick(() => {
      topLevelSelected.forEach((node: any) => {
        const targetNode = findNode(node.id)
        const relativePosition = plan.childPositions.get(node.id)
        if (!targetNode || !relativePosition) return
        targetNode.parentNode = plan.groupId
        targetNode.extent = undefined
        targetNode.position = relativePosition
      })
      emit('update:modelNodes', nodes.value)
      setTimeout(saveHistory, 50)
    })

    contextMenu.value.visible = false
  }

  function handleCreateSubgraph() {
    const selected = getSelectedNodes.value
    contextMenu.value.visible = false
    if (!allowSubgraphCreate || selected.length < 1) return
    emit('create-subgraph', {
      nodeIds: selected.map((node: any) => node.id),
    })
  }

  function handleCreateEmptySubgraph() {
    contextMenu.value.visible = false
    if (!allowSubgraphCreate) return
    emit('create-subgraph', {
      nodeIds: [],
      position: {
        x: contextMenu.value.canvasX,
        y: contextMenu.value.canvasY,
      },
    })
  }

  function handleUngroupSelected() {
    const selectedGroups = getSelectedNodes.value.filter((node: any) => node?.type === 'groupNode')
    if (!selectedGroups.length) return

    const groupIds = new Set(selectedGroups.map((group: any) => group.id))

    nodes.value.forEach((node: any) => {
      if (!node?.parentNode || !groupIds.has(node.parentNode)) return
      const parentGroup = selectedGroups.find((group: any) => group.id === node.parentNode)
      const parentAbsX = parentGroup?.computedPosition?.x ?? parentGroup?.position?.x ?? 0
      const parentAbsY = parentGroup?.computedPosition?.y ?? parentGroup?.position?.y ?? 0
      node.position = {
        x: parentAbsX + (node.position?.x ?? 0),
        y: parentAbsY + (node.position?.y ?? 0),
      }
      node.parentNode = undefined
      node.extent = undefined
    })

    nodes.value = nodes.value.filter((node: any) => !groupIds.has(node.id))
    emit('update:modelNodes', nodes.value)
    setTimeout(saveHistory, 50)
  }

  return {
    // Helpers
    getNodeRenderedSize,
    isDescendantOf,
    isNodeDescendantOfSelectedAncestor,

    // Subgraph naming
    normalizeSubgraphName,
    buildUniquePastedSubgraphLabel,

    // Group utilities
    getGroupDepth,
    isGroupSelfOrAncestorOf,
    isPointInsideGroup,
    getBoundedNodePositionInGroup,
    isNodeFullyInsideGroup,
    getDirectChildNodes,
    applyCollapsedGroupFrame,
    collectDescendantNodeIds,
    syncCollapsedGroupVisibility,
    captureExpandedGroupFrame,
    restoreExpandedGroupFrame,
    layoutGridChildren,
    resizeGroupToFitChildren,
    resizeGroupChain,
    syncGroupBoundsForNodes,
    toggleGroupToolbarDropdown,
    getExpandedSelectedNodes,

    // Assign / Group / Ungroup
    assignToGroupIfOverlapping,
    handleGridDrop,
    cleanupGridOrdersForDeletedNodes,
    registerGridChildIfNeeded,
    handleGroupSelected,
    handleCreateSubgraph,
    handleCreateEmptySubgraph,
    handleUngroupSelected,
  }
}
