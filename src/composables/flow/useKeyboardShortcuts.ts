import { ref, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { AlignDirection, DistributeDirection } from '@/utils/nodeLayout'
import { director3DOverlayVisible, editorKeyHandler, imageEditorVisible } from './useFlowCore'

export interface KeyboardShortcutsDeps {
  flowCanvasWrapperRef: Ref<HTMLElement | null>
  nodes: Ref<any[]>
  edges: Ref<any[]>
  clipboard: Ref<{ nodes: any[]; edges: any[]; subgraphs: any; mode: string }>
  showGrid: Ref<boolean>
  showMinimap: Ref<boolean>
  multiSelectionActive: Ref<boolean>
  selectionState: {
    _paneClickHandled: boolean
    _preShiftSelectionIds: Set<string> | null
    _preCtrlSelectionIds: Set<string> | null
  }
  emit: (event: string, ...args: any[]) => void
  props: { shortcuts?: Record<string, any>; allowSubgraphCreate?: boolean }
  getSelectedNodes: Ref<any[]>
  addSelectedNodes: (nodes: any[]) => void
  removeSelectedNodes: (nodes: any[]) => void
  getExpandedSelectedNodes: () => any[]
  removeSelection: (opts?: { reason?: string }) => boolean
  handleFitView: () => void
  handleGroupSelected: () => void
  handleUngroupSelected: () => void
  arrangeNodes: () => void
  handleAutoLayout: () => void
  handleDistribute: (dir: DistributeDirection) => void
  handleAlign: (action: AlignDirection) => void
  addAnnotationNote: (x: number, y: number, text: string) => void
  addLocationMarker: (x: number, y: number) => void
  collectSelectedClipboardPayload: () => any
  clearCutPreview: () => void
  isCutKeyPressed: Ref<boolean>
  isTextInputLike: (target: any) => boolean
  getCanvasPastePosition: (event: any) => { x: number; y: number } | null
  lastMousePosition: Ref<{ x: number; y: number }>
  fitView: (options?: any) => void
  locationMarkerNavigatorVisible: Ref<boolean>
  focusSingleOrOpenLocationMarkerNavigator: () => 'empty' | 'single' | 'list'
  moveActiveLocationMarker: (delta: number) => void
  confirmActiveLocationMarker: () => void
  closeLocationMarkerNavigator: () => void
  applyNodeHighlight: (colorIndex: number) => void
}

export function useKeyboardShortcuts(deps: KeyboardShortcutsDeps) {
  // Internal state managed by this composable
  const isShiftPressed = ref(false)
  const isCtrlPressed = ref(false)
  const isSpacePressed = ref(false)

  const {
    flowCanvasWrapperRef,
    nodes,
    edges,
    clipboard,
    showGrid,
    showMinimap,
    multiSelectionActive,
    selectionState,
    emit,
    props,
    getSelectedNodes,
    addSelectedNodes,
    removeSelectedNodes,
    getExpandedSelectedNodes,
    removeSelection,
    handleFitView,
    handleGroupSelected,
    handleUngroupSelected,
    arrangeNodes,
    handleAutoLayout,
    handleDistribute,
    handleAlign,
    addAnnotationNote,
    addLocationMarker,
    collectSelectedClipboardPayload,
    clearCutPreview,
    isCutKeyPressed,
    isTextInputLike,
    getCanvasPastePosition,
    lastMousePosition,
    fitView,
    locationMarkerNavigatorVisible,
    focusSingleOrOpenLocationMarkerNavigator,
    moveActiveLocationMarker,
    confirmActiveLocationMarker,
    closeLocationMarkerNavigator,
    applyNodeHighlight,
  } = deps

  // 默认快捷键配置
  const defaultShortcuts: Record<string, { ctrl?: boolean; shift?: boolean; alt?: boolean; key: string }> = {
    save: { ctrl: true, key: 's' },
    undo: { ctrl: true, key: 'z' },
    redo: { ctrl: true, key: 'y' },
    copy: { ctrl: true, key: 'c' },
    cut: { ctrl: true, key: 'x' },
    paste: { ctrl: true, key: 'v' },
    delete: { ctrl: false, key: 'Delete' },
    fitView: { ctrl: true, key: '0' },
    highlightColor1: { ctrl: true, key: '1' },
    highlightColor2: { ctrl: true, key: '2' },
    highlightColor3: { ctrl: true, key: '3' },
    highlightColor4: { ctrl: true, key: '4' },
    toggleGrid: { ctrl: true, key: ';' },
    toggleMinimap: { ctrl: true, alt: true, key: 'm' },
    group: { ctrl: true, key: 'g' },
    ungroup: { ctrl: true, shift: true, key: 'g' },
    arrange: { ctrl: true, key: 'p' },
    autoLayout: { ctrl: true, shift: true, key: 'p' },
    distributeH: { ctrl: false, shift: true, key: 'h' },
    distributeV: { ctrl: false, shift: true, key: 'v' },
    alignTop: { ctrl: false, shift: true, key: 'w' },
    alignLeft: { ctrl: false, shift: true, key: 'a' },
    alignBottom: { ctrl: false, shift: true, key: 's' },
    alignRight: { ctrl: false, shift: true, key: 'd' },
    annotationNote: { ctrl: false, key: 't' },
    focusSelected: { ctrl: false, key: 'f' },
    locationMarker: { ctrl: true, key: 'm' },
    locationMarkerNavigator: { ctrl: true, shift: true, key: 'm' },
  }

  function handleLocationMarkerNavigatorKey(e: KeyboardEvent): boolean {
    if (!locationMarkerNavigatorVisible.value) return false
    if (e.key === 'Escape') {
      e.preventDefault()
      closeLocationMarkerNavigator()
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActiveLocationMarker(-1)
      return true
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActiveLocationMarker(1)
      return true
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmActiveLocationMarker()
      return true
    }
    return false
  }

  function handleLocationMarkerShortcut(e: KeyboardEvent): boolean {
    if (matchesShortcut(e, getShortcut('locationMarkerNavigator'))) {
      e.preventDefault()
      focusSingleOrOpenLocationMarkerNavigator()
      return true
    }
    if (matchesShortcut(e, getShortcut('locationMarker'))) {
      e.preventDefault()
      const position = getCanvasPastePosition(e)
      if (position) addLocationMarker(position.x, position.y)
      return true
    }
    return false
  }

  // 检查按键是否匹配快捷键
  function matchesShortcut(
    e: KeyboardEvent,
    shortcutKey: { ctrl?: boolean; shift?: boolean; alt?: boolean; key?: string } | undefined
  ): boolean {
    if (!shortcutKey) return false
    const ctrl = e.ctrlKey || e.metaKey
    const ctrlMatch = shortcutKey.ctrl ? ctrl : !ctrl
    const shiftMatch = shortcutKey.shift ? e.shiftKey : !e.shiftKey
    const altMatch = shortcutKey.alt ? e.altKey : !e.altKey
    const keyMatch = (e.key || '').toLowerCase() === (shortcutKey.key || '').toLowerCase()
    return ctrlMatch && shiftMatch && altMatch && keyMatch
  }

  // 获取合并后的快捷键
  function getShortcut(action: string): { ctrl?: boolean; shift?: boolean; alt?: boolean; key?: string } | undefined {
    const custom = props.shortcuts?.[action]?.key
    return custom || defaultShortcuts[action]
  }

  function shouldIgnoreFlowShortcut(eventTarget: EventTarget | null): boolean {
    if (isTextInputLike(eventTarget)) return true
    if (document.querySelector('.ref-edit-overlay, .video-ref-editor-overlay, .ref-edit-modal')) return true
    if (!(eventTarget instanceof HTMLElement)) return false
    return !!eventTarget.closest(
      '.ref-edit-overlay, .video-ref-editor-overlay, .video-ref-editor-content, .ref-edit-modal'
    )
  }

  function isDevtoolsShortcut(e: KeyboardEvent): boolean {
    const key = String(e.key || '').toLowerCase()
    return key === 'f12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'i')
  }

  function handleGlobalKeyDown(e: KeyboardEvent): void {
    if (isDevtoolsShortcut(e)) return
    if (imageEditorVisible.value) {
      editorKeyHandler.value?.(e)
      return
    }
    if (shouldIgnoreFlowShortcut(e.target)) return
    if (e.key === 'Shift') {
      isShiftPressed.value = true
      selectionState._preShiftSelectionIds = new Set(getSelectedNodes.value.map((n: any) => n.id))
    }
    if (
      e.key?.toLowerCase() === 'x'
      && !e.ctrlKey
      && !e.metaKey
      && !e.altKey
      && !isTextInputLike(e.target)
    ) {
      isCutKeyPressed.value = true
    }
    if (e.key === 'Control' || e.key === 'Meta') {
      isCtrlPressed.value = true
      selectionState._preCtrlSelectionIds = new Set(getSelectedNodes.value.map((n: any) => n.id))
    }
    if (e.code === 'Space' && !e.repeat) {
      isSpacePressed.value = true
    }
  }

  function handleGlobalKeyUp(e: KeyboardEvent): void {
    if (shouldIgnoreFlowShortcut(e.target)) return
    if (e.key === 'Shift') {
      isShiftPressed.value = false
      selectionState._preShiftSelectionIds = null
    }
    if (e.key?.toLowerCase() === 'x') {
      isCutKeyPressed.value = false
      clearCutPreview()
    }
    if (e.key === 'Control' || e.key === 'Meta') {
      isCtrlPressed.value = false
      selectionState._preCtrlSelectionIds = null
    }
    if (e.code === 'Space') {
      isSpacePressed.value = false
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (isDevtoolsShortcut(e)) return
    if (imageEditorVisible.value) return
    if (shouldIgnoreFlowShortcut(e.target)) return
    if (handleLocationMarkerNavigatorKey(e)) return
    if (handleLocationMarkerShortcut(e)) return
    if (director3DOverlayVisible.value) return
    if (e.code === 'Space') {
      e.preventDefault()
      isSpacePressed.value = true
      return
    }


    if (matchesShortcut(e, getShortcut('save'))) {
      e.preventDefault()
      emit('save-request')
      return
    }

    const target = e.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    if (target instanceof HTMLElement && target.isContentEditable) return

    // 全选
    if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'a') {
      e.preventDefault()
      const allNodes = nodes.value.filter((node: any) => node && !node.hidden)
      const selected = getSelectedNodes.value
      if (selected.length > 0) {
        removeSelectedNodes(selected)
      }
      edges.value.forEach((edge: any) => {
        edge.selected = false
      })
      if (allNodes.length > 0) {
        addSelectedNodes(allNodes)
      }
      multiSelectionActive.value = allNodes.length > 1
      return
    }

    if (matchesShortcut(e, getShortcut('copy'))) {
      e.preventDefault()
      const payload = collectSelectedClipboardPayload()
      if (payload) clipboard.value = { ...payload, mode: 'copy' }
      return
    }

    if (matchesShortcut(e, getShortcut('cut'))) {
      e.preventDefault()
      const payload = collectSelectedClipboardPayload()
      if (!payload) return
      clipboard.value = { ...payload, mode: 'cut' }
      removeSelection({ reason: 'cut' })
      return
    }

    if (matchesShortcut(e, getShortcut('paste'))) {
      return
    }

    if (matchesShortcut(e, getShortcut('undo'))) {
      e.preventDefault()
      emit('undo-request')
      return
    }

    if (matchesShortcut(e, getShortcut('redo'))) {
      e.preventDefault()
      emit('redo-request')
      return
    }

    if (matchesShortcut(e, getShortcut('delete'))) {
      removeSelection({ reason: 'delete' })
      return
    }

    if (matchesShortcut(e, getShortcut('fitView'))) {
      e.preventDefault()
      handleFitView()
      return
    }

    const highlightActions = ['highlightColor1', 'highlightColor2', 'highlightColor3', 'highlightColor4']
    const matchedHighlight = highlightActions.findIndex(action => matchesShortcut(e, getShortcut(action)))
    if (matchedHighlight >= 0) {
      e.preventDefault()
      const selected = getSelectedNodes.value
      if (selected.length > 0) {
        applyNodeHighlight(matchedHighlight)
      }
      return
    }

    if (matchesShortcut(e, getShortcut('focusSelected'))) {
      e.preventDefault()
      const selected = getSelectedNodes.value
      if (selected.length > 0) {
        fitView({ nodes: selected.map((n: any) => n.id), padding: 0.2, duration: 300 })
      }
      return
    }

    if (matchesShortcut(e, getShortcut('group'))) {
      e.preventDefault()
      if (getSelectedNodes.value.length >= 2) {
        handleGroupSelected()
      }
      return
    }

    if (matchesShortcut(e, getShortcut('ungroup'))) {
      e.preventDefault()
      handleUngroupSelected()
      return
    }

    if (matchesShortcut(e, getShortcut('arrange'))) {
      e.preventDefault()
      arrangeNodes()
      return
    }

    if (matchesShortcut(e, getShortcut('autoLayout'))) {
      e.preventDefault()
      handleAutoLayout()
      return
    }

    if (matchesShortcut(e, getShortcut('distributeH'))) {
      e.preventDefault()
      handleDistribute('horizontal')
      return
    }
    if (matchesShortcut(e, getShortcut('distributeV'))) {
      e.preventDefault()
      handleDistribute('vertical')
      return
    }

    const alignActions: Array<{ shortcut: string; direction: AlignDirection }> = [
      { shortcut: 'alignTop', direction: 'alignTop' },
      { shortcut: 'alignLeft', direction: 'alignLeft' },
      { shortcut: 'alignBottom', direction: 'alignBottom' },
      { shortcut: 'alignRight', direction: 'alignRight' },
    ]
    const matchedAlign = alignActions.find(({ shortcut }) => matchesShortcut(e, getShortcut(shortcut)))
    if (matchedAlign) {
      e.preventDefault()
      handleAlign(matchedAlign.direction)
      return
    }

    if (matchesShortcut(e, getShortcut('toggleGrid'))) {
      e.preventDefault()
      showGrid.value = !showGrid.value
      return
    }

    if (matchesShortcut(e, getShortcut('toggleMinimap'))) {
      e.preventDefault()
      showMinimap.value = !showMinimap.value
      return
    }

    if (matchesShortcut(e, getShortcut('annotationNote'))) {
      e.preventDefault()
      const position = getCanvasPastePosition(e)
      if (position) addAnnotationNote(position.x, position.y, '')
      return
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleGlobalKeyDown, true)
    window.addEventListener('keyup', handleGlobalKeyUp, true)
    window.addEventListener('keydown', handleKeyDown as EventListener, true)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeyDown, true)
    window.removeEventListener('keyup', handleGlobalKeyUp, true)
    window.removeEventListener('keydown', handleKeyDown as EventListener, true)
  })

  return {
    defaultShortcuts,
    matchesShortcut,
    getShortcut,
    handleKeyDown,
    handleGlobalKeyDown,
    handleGlobalKeyUp,
    isShiftPressed,
    isCtrlPressed,
    isSpacePressed,
  }
}
