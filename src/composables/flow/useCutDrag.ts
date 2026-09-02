import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

export interface CutDragDeps {
  edges: Ref<any[]>
  emit: {
    (e: 'update:modelEdges', value: any[]): void
  }
  saveHistory: () => void
}

export function useCutDrag(deps: CutDragDeps) {
  const { edges, emit, saveHistory } = deps

  const isCutKeyPressed = ref(false)
  const cutDragStartPoint = ref<{ x: number; y: number } | null>(null)
  const cutPreviewEdgeIds = ref(new Set<string>())
  let _pendingCutDeleteEdgeIds = new Set<string>()
  let _cutDeleteTimer: number = 0

  function syncCutPreviewClasses() {
    const previewIds = cutPreviewEdgeIds.value
    document.querySelectorAll('.vue-flow__edge').forEach((edgeEl) => {
      if (!(edgeEl instanceof HTMLElement)) return
      const edgeId = edgeEl.dataset.id || ''
      edgeEl.classList.toggle('cut-preview', previewIds.has(edgeId))
    })
  }

  function queueCutEdgeRemoval(edgeIds: string[]) {
    for (const edgeId of edgeIds) {
      _pendingCutDeleteEdgeIds.add(edgeId)
    }
    cutPreviewEdgeIds.value = new Set([...cutPreviewEdgeIds.value, ...edgeIds])
    nextTick(syncCutPreviewClasses)

    if (_cutDeleteTimer) return
    _cutDeleteTimer = window.setTimeout(() => {
      const idsToRemove = new Set(_pendingCutDeleteEdgeIds)
      _pendingCutDeleteEdgeIds = new Set()
      _cutDeleteTimer = 0
      cutPreviewEdgeIds.value = new Set()
      syncCutPreviewClasses()
      if (idsToRemove.size === 0) return

      edges.value = edges.value.filter(edge => !idsToRemove.has(edge.id))
      emit('update:modelEdges', edges.value)
      saveHistory()
    }, 80)
  }

  function clearCutPreview() {
    cutDragStartPoint.value = null
    cutPreviewEdgeIds.value = new Set()
    syncCutPreviewClasses()
  }

  // ── Right-drag / pointer event handlers ──────────────────────

  let rightDragActive = false

  function onRightPointerDown(e: MouseEvent) {
    if (e.button === 2) rightDragActive = true
    if (e.button === 0 && isCutKeyPressed.value) {
      cutDragStartPoint.value = { x: e.clientX, y: e.clientY }
    }
  }

  function onRightPointerMove(e: MouseEvent) {
    if (rightDragActive && e.buttons === 2) {
      e.preventDefault()
    }
  }

  function onRightPointerUp() {
    rightDragActive = false
    cutDragStartPoint.value = null
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onRightPointerDown as EventListener, true)
    document.addEventListener('pointermove', onRightPointerMove as EventListener, true)
    document.addEventListener('pointerup', onRightPointerUp as EventListener, true)
  })

  onUnmounted(() => {
    if (_cutDeleteTimer) {
      window.clearTimeout(_cutDeleteTimer)
      _cutDeleteTimer = 0
    }
    document.removeEventListener('pointerdown', onRightPointerDown as EventListener, true)
    document.removeEventListener('pointermove', onRightPointerMove as EventListener, true)
    document.removeEventListener('pointerup', onRightPointerUp as EventListener, true)
  })

  return {
    isCutKeyPressed,
    cutDragStartPoint,
    cutPreviewEdgeIds,
    syncCutPreviewClasses,
    queueCutEdgeRemoval,
    clearCutPreview,
    rightDragActive,
    onRightPointerDown,
    onRightPointerMove,
    onRightPointerUp,
    get _pendingCutDeleteEdgeIds() { return _pendingCutDeleteEdgeIds },
    get _cutDeleteTimer() { return _cutDeleteTimer },
    set _cutDeleteTimer(v: number) { _cutDeleteTimer = v },
  }
}
