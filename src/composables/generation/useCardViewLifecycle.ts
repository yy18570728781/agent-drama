import type { Ref } from 'vue'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { CardViewLifecycleDeps } from '@/components/generation/cardView.types'
import { useGenerationStore } from '@/stores/generation.store'
import { useUserStore } from '@/stores/auth.store'

interface UseCardViewLifecycleReturn {
  initialLoading: Ref<boolean>
}

/**
 * Coordinates CardView loading, watchers, and DOM listener lifecycles.
 *
 * @param deps Page state and behavior dependencies already created by CardView.
 * @returns Nothing; lifecycle hooks own registration and cleanup.
 */
export function useCardViewLifecycle(deps: CardViewLifecycleDeps): UseCardViewLifecycleReturn {
  const generationStore = useGenerationStore()
  const userStore = useUserStore()
  const hasLoadedAssetsAfterAuth = ref(false)
  const initialLoading = ref(true)

  async function loadAssetsAfterAuth(force = false): Promise<void> {
    if (userStore.authStatus !== 'ready') return
    if (hasLoadedAssetsAfterAuth.value && !force) return
    hasLoadedAssetsAfterAuth.value = true
    initialLoading.value = true
    try {
      deps.uiState.syncAssetStoreFilter(deps.uiState.filterConditions.value)
      await deps.assets.loadModelDisplayNameMap()
      await deps.assetStore.load()
      await deps.layout.checkLoadMore()
    } finally {
      initialLoading.value = false
    }
  }

  async function applyPendingEdit(): Promise<void> {
    const pending = generationStore.pendingEdit
    if (!pending) return
    generationStore.setPendingEdit(null)
    await nextTick()
    await deps.actions.applyPendingEditToInput(pending)
    if (pending.autoSend) window.setTimeout(() => deps.inputRef.value?.handleSend(), 300)
  }

  function onDocumentClick(event: MouseEvent): void {
    const target = event.target
    if (target instanceof HTMLElement && target.closest('.card-context-menu')) return
    deps.actions.closeCardContextMenu()
  }

  watch(() => generationStore.pendingEdit, async (pending) => {
    if (pending) await applyPendingEdit()
  })
  watch(() => deps.assetStore.stale, (isStale) => {
    if (isStale) void deps.assetStore.refreshIfStale()
  })
  watch(() => userStore.authStatus, async (status, previousStatus) => {
    if (status === 'ready') {
      await loadAssetsAfterAuth(previousStatus !== 'ready')
      return
    }
    hasLoadedAssetsAfterAuth.value = false
    initialLoading.value = status !== 'error'
  })

  onMounted(async () => {
    void deps.assets.loadModelDisplayNameMap()
    await nextTick()
    deps.resultColRef.value?.addEventListener('wheel', deps.uiState.onCtrlWheel, { passive: false })
    document.addEventListener('click', onDocumentClick)
    await loadAssetsAfterAuth()
    await applyPendingEdit()
  })

  onUnmounted(() => {
    deps.actions.cleanupCopiedPromptTimer()
    deps.layout.setContainer(null)
    deps.resultColRef.value?.removeEventListener('wheel', deps.uiState.onCtrlWheel)
    document.removeEventListener('click', onDocumentClick)
  })

  return { initialLoading }
}
