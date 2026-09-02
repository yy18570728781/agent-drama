import type { FlowLibraryCanvas } from '@/api/flowLibrary'
import type { ComputedRef, Ref } from 'vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { listFlowLibraryCanvases } from '@/api/flowLibrary'

interface UseFlowCanvasListReturn {
  canvases: ComputedRef<FlowLibraryCanvas[]>
  errorMessage: Ref<string>
  hasMore: Ref<boolean>
  insertCanvas: (canvas: FlowLibraryCanvas) => void
  isInitialLoading: Ref<boolean>
  isLoadingMore: Ref<boolean>
  loadMore: () => Promise<void>
  patchCanvas: (canvasId: string, patch: Partial<FlowLibraryCanvas>) => void
  reload: () => Promise<void>
  removeCanvas: (canvasId: string) => void
  searchKeyword: Ref<string>
}

interface FlowCanvasListState {
  errorMessage: Ref<string>
  hasMore: Ref<boolean>
  isInitialLoading: Ref<boolean>
  isLoadingMore: Ref<boolean>
  nextPage: number
  requestVersion: number
  searchKeyword: Ref<string>
  searchTimer?: ReturnType<typeof setTimeout>
  sourceCanvases: Ref<FlowLibraryCanvas[]>
}

const PAGE_SIZE = 30
const SEARCH_DEBOUNCE_MS = 250

function createListState(): FlowCanvasListState {
  return {
    errorMessage: ref(''),
    hasMore: ref(true),
    isInitialLoading: ref(false),
    isLoadingMore: ref(false),
    nextPage: 1,
    requestVersion: 0,
    searchKeyword: ref(''),
    sourceCanvases: ref<FlowLibraryCanvas[]>([]),
  }
}

function mergeCanvasPages(
  current: FlowLibraryCanvas[],
  incoming: FlowLibraryCanvas[],
): FlowLibraryCanvas[] {
  const itemById = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => itemById.set(item.id, item))
  return [...itemById.values()]
}

function getTimestamp(value: string): number {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function clearSearchTimer(state: FlowCanvasListState): void {
  if (state.searchTimer) clearTimeout(state.searchTimer)
  state.searchTimer = undefined
}

async function fetchCanvasPage(
  state: FlowCanvasListState,
  categoryId: Ref<string>,
  page: number,
  replace: boolean,
  version: number,
): Promise<void> {
  const requestedCategoryId = categoryId.value
  try {
    const items = await listFlowLibraryCanvases({
      categoryId: requestedCategoryId,
      keyword: state.searchKeyword.value,
      page,
      pageSize: PAGE_SIZE,
    })
    if (version !== state.requestVersion || requestedCategoryId !== categoryId.value) return
    state.sourceCanvases.value = replace
      ? items
      : mergeCanvasPages(state.sourceCanvases.value, items)
    state.nextPage = page + 1
    state.hasMore.value = items.length === PAGE_SIZE
  } catch (error) {
    if (version !== state.requestVersion) return
    if (replace) {
      state.errorMessage.value = error instanceof Error ? error.message : '画布列表加载失败'
    }
    state.hasMore.value = false
  } finally {
    if (version === state.requestVersion) {
      state.isInitialLoading.value = false
      state.isLoadingMore.value = false
    }
  }
}

async function reloadCanvasList(
  state: FlowCanvasListState,
  categoryId: Ref<string>,
): Promise<void> {
  clearSearchTimer(state)
  const version = ++state.requestVersion
  state.nextPage = 1
  state.sourceCanvases.value = []
  state.errorMessage.value = ''
  state.hasMore.value = !!categoryId.value
  state.isInitialLoading.value = !!categoryId.value
  state.isLoadingMore.value = false
  if (!categoryId.value) return
  await fetchCanvasPage(state, categoryId, 1, true, version)
}

async function loadMoreCanvases(
  state: FlowCanvasListState,
  categoryId: Ref<string>,
): Promise<void> {
  if (!categoryId.value || !state.hasMore.value) return
  if (state.isInitialLoading.value || state.isLoadingMore.value) return
  state.isLoadingMore.value = true
  await fetchCanvasPage(state, categoryId, state.nextPage, false, state.requestVersion)
}

function scheduleSearchReload(state: FlowCanvasListState, categoryId: Ref<string>): void {
  state.requestVersion += 1
  clearSearchTimer(state)
  state.sourceCanvases.value = []
  state.errorMessage.value = ''
  state.hasMore.value = !!categoryId.value
  state.isInitialLoading.value = !!categoryId.value
  state.isLoadingMore.value = false
  state.searchTimer = setTimeout(() => {
    void reloadCanvasList(state, categoryId)
  }, SEARCH_DEBOUNCE_MS)
}

function patchCanvas(
  state: FlowCanvasListState,
  canvasId: string,
  patch: Partial<FlowLibraryCanvas>,
): void {
  state.sourceCanvases.value = state.sourceCanvases.value.map((canvas) =>
    canvas.id === canvasId ? { ...canvas, ...patch } : canvas,
  )
}

function removeCanvas(state: FlowCanvasListState, canvasId: string): void {
  state.sourceCanvases.value = state.sourceCanvases.value.filter((canvas) => canvas.id !== canvasId)
}

function insertCanvas(state: FlowCanvasListState, canvas: FlowLibraryCanvas): void {
  state.sourceCanvases.value = [
    canvas,
    ...state.sourceCanvases.value.filter((item) => item.id !== canvas.id),
  ]
}

/**
 * 管理画布列表的分页、搜索和过期请求隔离。
 * @param categoryId 当前选中的文件夹 ID。
 * @returns 画布列表状态以及重新加载、加载下一页动作。
 */
export function useFlowCanvasList(categoryId: Ref<string>): UseFlowCanvasListReturn {
  const state = createListState()
  const canvases = computed(() => [...state.sourceCanvases.value].sort(
    (left, right) => getTimestamp(right.updatedAt) - getTimestamp(left.updatedAt),
  ))
  watch(
    state.searchKeyword,
    () => scheduleSearchReload(state, categoryId),
    { flush: 'sync' },
  )
  onBeforeUnmount(() => {
    state.requestVersion += 1
    clearSearchTimer(state)
  })
  return {
    canvases,
    errorMessage: state.errorMessage,
    hasMore: state.hasMore,
    insertCanvas: (canvas) => insertCanvas(state, canvas),
    isInitialLoading: state.isInitialLoading,
    isLoadingMore: state.isLoadingMore,
    loadMore: () => loadMoreCanvases(state, categoryId),
    patchCanvas: (canvasId, patch) => patchCanvas(state, canvasId, patch),
    reload: () => reloadCanvasList(state, categoryId),
    removeCanvas: (canvasId) => removeCanvas(state, canvasId),
    searchKeyword: state.searchKeyword,
  }
}
