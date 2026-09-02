import { computed } from 'vue'
import type { Ref } from 'vue'
import type { FlowCreationMenuItem } from '@/utils/flowCreationMenu'
import { pendingToolboxFiles } from './flowToolboxState'

interface ContextMenuParam {
  default?: unknown
  name: string
}

export interface SelectionState {
  _paneClickHandled: boolean
  _preShiftSelectionIds: Set<string> | null
  _preCtrlSelectionIds: Set<string> | null
}

export interface FlowContextMenuDeps {
  contextMenu: Ref<{ visible: boolean; x: number; y: number; canvasX: number; canvasY: number }>
  ctxSubmenu: Ref<any>
  connectionPopup: Ref<{ visible: boolean; x: number; y: number; sourceNodeId: string; sourceHandleId: string; sourceMode: string; sourceNodeIds: string[] }>
  vueFlowRef: Ref<HTMLElement | null>
  nodes: Ref<any[]>
  findNode: (id: string) => any
  addSelectedNodes: (nodes: any[]) => void
  multiSelectionActive: Ref<boolean>
  isShiftPressed: Ref<boolean>
  isCtrlPressed: Ref<boolean>
  generationStore: { isGenerating: boolean }
  hideGenerationPanel: () => void
  revealManualGenerationPanel: (nodeId: string) => void
  saveHistory: () => void
  emit: (event: string, ...args: any[]) => void
  project: (point: { x: number; y: number }) => { x: number; y: number }
  props: { nodeTypes: any[] }
  defaultMediaNodes: any[]
  HIDDEN_NODE_TYPES: Set<string>
  getNodeIcon: (type: string) => any
  getNodeIconColor: (type: string) => string
  getNodeTypeDef: (type: string) => any
  applyWorkflowRememberedRequest: (data: any, item: any) => any
  applyPresetData: (data: any, item: any) => any
  createRuntimeId: (prefix: string) => string
  buildBaseNodeRuntimeData: (data: any) => any
  getDefaultCapabilityByNodeType: (type: string) => string
  fixedSizeTypes: Record<string, { width?: string; height?: string }>
  assignToGroupIfOverlapping: (node: any, x: number, y: number) => void
  selectionState: SelectionState
  createUploadNodesFromFiles: (files: File[], position: { x: number; y: number }) => Promise<any[]>
}

function normalizeContextNodeType(type: unknown): string {
  if (!type) return ''
  if (type === 'imageCompareNode') return 'image_compare'
  return String(type)
}

export function useFlowContextMenu(deps: FlowContextMenuDeps) {
  const {
    contextMenu,
    ctxSubmenu,
    connectionPopup,
    vueFlowRef,
    nodes,
    findNode,
    addSelectedNodes,
    multiSelectionActive,
    isShiftPressed,
    isCtrlPressed,
    generationStore,
    hideGenerationPanel,
    revealManualGenerationPanel,
    saveHistory,
    emit,
    project,
    props,
    defaultMediaNodes,
    HIDDEN_NODE_TYPES,
    getNodeIcon,
    getNodeIconColor,
    getNodeTypeDef,
    applyWorkflowRememberedRequest,
    applyPresetData,
    createRuntimeId,
    buildBaseNodeRuntimeData,
    getDefaultCapabilityByNodeType,
    fixedSizeTypes,
    assignToGroupIfOverlapping,
    selectionState,
    createUploadNodesFromFiles,
  } = deps

  function closeContextMenu() {
    contextMenu.value.visible = false
    ctxSubmenu.value = null
  }

  function clampContextMenu(clientX: number, clientY: number): { x: number; y: number } {
    const menuWidth = 216
    const menuHeight = 420
    const submenuWidth = 184
    const margin = 8
    const viewportWidth = window.innerWidth || 0
    const viewportHeight = window.innerHeight || 0
    let x = clientX
    let y = clientY
    if (x + menuWidth + submenuWidth + margin > viewportWidth) {
      x = clientX - menuWidth - submenuWidth - margin
    }
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - margin
    }
    return {
      x: Math.max(margin, Math.min(x, Math.max(margin, viewportWidth - menuWidth - margin))),
      y: Math.max(margin, Math.min(y, Math.max(margin, viewportHeight - menuHeight - margin))),
    }
  }

  // 右键菜单节点选项（合并默认媒体节点和 props.nodeTypes，双向补齐）
  const contextMenuNodes = computed(() => {
    const result: FlowCreationMenuItem[] = defaultMediaNodes.map(node => ({
      ...node,
      type: normalizeContextNodeType(node.type),
    }))
    const existingTypes = new Set(result.map(n => n.type))
    const existingLabels = new Set(result.map(n => String(n.label || '').trim()))

    // 添加 props.nodeTypes 中不存在的节点
    if (props.nodeTypes && props.nodeTypes.length > 0) {
      props.nodeTypes.forEach(nodeType => {
        const normalizedType = normalizeContextNodeType(nodeType.type)
        const normalizedLabel = String(nodeType.label || '').trim()
        if (
          normalizedType &&
          !existingTypes.has(normalizedType) &&
          !HIDDEN_NODE_TYPES.has(normalizedType) &&
          !(normalizedLabel && existingLabels.has(normalizedLabel))
        ) {
          result.push({
            type: normalizedType,
            label: nodeType.label || normalizedType,
            icon: getNodeIcon(normalizedType),
            color: getNodeIconColor(normalizedType),
          })
          existingTypes.add(normalizedType)
          if (normalizedLabel) existingLabels.add(normalizedLabel)
        }
      })
    }

    const deduped: FlowCreationMenuItem[] = []
    const seenKeys = new Set<string>()
    result.forEach((item) => {
      const t = normalizeContextNodeType(item.type)
      const label = String(item.label || '').trim()
      const key = `${t}__${label}`
      if (seenKeys.has(key)) return
      seenKeys.add(key)
      deduped.push({ ...item, type: t || item.type })
    })

    const ensureBaseNode = (type: string, label: string) => {
      if (deduped.some((item) => normalizeContextNodeType(item.type) === type)) return
      deduped.unshift({
        type,
        label,
        icon: getNodeIcon(type),
        color: getNodeIconColor(type),
      })
    }

    ensureBaseNode('annotation_note', '文字标注')
    ensureBaseNode('camera_input', '摄影机参数')
    ensureBaseNode('director_3d', '3D导演台')

    return deduped
  })

  const contextMenuCreationNodes = computed(() => ([
    {
      type: 'annotation_note',
      label: '文字标注',
      icon: getNodeIcon('annotation_note'),
      color: getNodeIconColor('annotation_note'),
    },
    {
      type: 'camera_input',
      label: '摄影机参数',
      icon: getNodeIcon('camera_input'),
      color: getNodeIconColor('camera_input'),
    },
    {
      type: 'director_3d',
      label: '3D导演台',
      icon: getNodeIcon('director_3d'),
      color: getNodeIconColor('director_3d'),
    },
  ]))
  const contextMenuPrimaryNodes = contextMenuCreationNodes
  const contextMenuGenerationNodes = computed(() =>
    contextMenuNodes.value.filter((item) => String(item.label || '').trim().endsWith('生成')),
  )
  const contextMenuOtherNodes = computed(() =>
    contextMenuNodes.value.filter((item) => {
      const label = String(item.label || '').trim()
      return !label.endsWith('生成')
        && item.type !== 'annotation_note'
        && item.type !== 'camera_input'
        && item.type !== 'director_3d'
    }),
  )

  function onPaneContextMenu(event: MouseEvent): void {
    event.preventDefault()
    closeContextMenu()

    const flowEl = vueFlowRef.value
    if (!flowEl) return

    const bounds = flowEl.getBoundingClientRect()
    const relativeX = event.clientX - bounds.left
    const relativeY = event.clientY - bounds.top
    const position = project({ x: relativeX, y: relativeY })
    const clamped = clampContextMenu(event.clientX, event.clientY)

    contextMenu.value = {
      visible: true,
      x: clamped.x,
      y: clamped.y,
      canvasX: position.x,
      canvasY: position.y,
    }

    connectionPopup.value.visible = false
  }

  // 节点右键菜单（支持在组内右键）
  function onNodeContextMenu(event: { event: MouseEvent; node: { type?: string } }): void {
    // 只有 GroupNode 才处理，允许在组内右键添加节点
    if (event.node.type !== 'groupNode') return

    event.event.preventDefault()
    closeContextMenu()

    const flowEl = vueFlowRef.value
    if (!flowEl) return

    const bounds = flowEl.getBoundingClientRect()
    const relativeX = event.event.clientX - bounds.left
    const relativeY = event.event.clientY - bounds.top
    const position = project({ x: relativeX, y: relativeY })
    const clamped = clampContextMenu(event.event.clientX, event.event.clientY)

    contextMenu.value = {
      visible: true,
      x: clamped.x,
      y: clamped.y,
      canvasX: position.x,
      canvasY: position.y,
    }

    connectionPopup.value.visible = false
  }

  function handleAddNodeFromContext(item: FlowCreationMenuItem): void {
    const type = String(item.type || '').trim()
    if (!type) return
    const label = item.label
    const typeDef = getNodeTypeDef(type)
    const newNode = applyWorkflowRememberedRequest(applyPresetData({
      id: createRuntimeId('node'),
      type,
      position: { x: contextMenu.value.canvasX, y: contextMenu.value.canvasY },
      data: buildBaseNodeRuntimeData({
        nodeType: type,
        label,
        paramDefs: typeDef.params || [],
        mediaType: item.mediaType,
      }),
    }, item), item.defaultCapability || getDefaultCapabilityByNodeType(type))

    if (fixedSizeTypes[type]) {
      newNode.style = fixedSizeTypes[type]
    }

    const params = Array.isArray(typeDef.params) ? typeDef.params as ContextMenuParam[] : []
    if (params.length) {
      params.forEach((p) => {
        if (
          p.default !== undefined
          && p.default !== null
          && newNode.data.request?.params?.[p.name] === undefined
        ) {
          newNode.data.request.params[p.name] = p.default
        }
      })
    }

    // 检查是否落入某个组内
    assignToGroupIfOverlapping(newNode, contextMenu.value.canvasX, contextMenu.value.canvasY)

    nodes.value = [...nodes.value, newNode]
    emit('update:modelNodes', nodes.value)
    contextMenu.value.visible = false
    revealManualGenerationPanel(newNode.id)
    setTimeout(saveHistory, 50)
  }

  function onPaneClick(event: MouseEvent): void {
    if (pendingToolboxFiles.value.length > 0) {
      const files = pendingToolboxFiles.value.slice()
      pendingToolboxFiles.value = []
      const rect = vueFlowRef.value?.getBoundingClientRect?.()
      const relativeX = rect ? event.clientX - rect.left : event.clientX
      const relativeY = rect ? event.clientY - rect.top : event.clientY
      const position = project({ x: relativeX, y: relativeY })
      createUploadNodesFromFiles(files, position)
      return
    }
    if (isShiftPressed.value && selectionState._preShiftSelectionIds && selectionState._preShiftSelectionIds.size > 0) {
      multiSelectionActive.value = true
      for (const id of selectionState._preShiftSelectionIds) {
        const node = findNode(id)
        if (node && !node.selected) addSelectedNodes([node])
      }
      selectionState._preShiftSelectionIds = null
      selectionState._paneClickHandled = true
      return
    }

    if (isCtrlPressed.value && selectionState._preCtrlSelectionIds && selectionState._preCtrlSelectionIds.size > 0) {
      multiSelectionActive.value = true
      for (const id of selectionState._preCtrlSelectionIds) {
        const node = findNode(id)
        if (node && !node.selected) addSelectedNodes([node])
      }
      selectionState._preCtrlSelectionIds = null
      selectionState._paneClickHandled = true
      return
    }
    // 如果有弹出层（如模型选择面板、下拉菜单）打开，不关闭生成面板
    // 检查各种 Element Plus 弹出层类型
    const popperSelectors = [
      '.el-select-dropdown:not([style*="display: none"])',
      '.el-popover.el-popper:not([style*="display: none"])',
      '.el-picker-panel:not([style*="display: none"])',
      '.el-cascader__dropdown:not([style*="display: none"])',
      '.el-popper.is-pure:not([style*="display: none"])',
      // 检查 el-popper 是否有 is-visible 类或 aria-hidden 不为 true
      '.el-popper.is-visible',
      '.el-popper:not([aria-hidden="true"]):not([style*="display: none"])'
    ]

    for (const selector of popperSelectors) {
      if (document.querySelector(selector)) return
    }

    if (document.querySelector('.ref-edit-overlay, .video-ref-editor-overlay')) return

    // 检查点击目标是否在弹出层内部（某些弹出层可能在点击时关闭但事件还在传播）
    const target = event.target
    if (target instanceof Element) {
      if (target.closest('.el-select-dropdown, .el-popover, .el-popper, .el-picker-panel, .ref-edit-overlay, .video-ref-editor-overlay')) return
    }

    // 生成进行中时不关闭面板，否则会中断 SSE 连接导致结果丢失
    if (generationStore.isGenerating) return

    hideGenerationPanel()
    contextMenu.value.visible = false
    connectionPopup.value.visible = false
    emit('pane-click')
  }

  return {
    closeContextMenu,
    clampContextMenu,
    contextMenuNodes,
    contextMenuGenerationNodes,
    contextMenuCreationNodes,
    contextMenuPrimaryNodes,
    contextMenuOtherNodes,
    onPaneContextMenu,
    onNodeContextMenu,
    handleAddNodeFromContext,
    onPaneClick,
  }
}
