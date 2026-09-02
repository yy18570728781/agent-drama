import type { DiscoverCase } from '@/components/discover/discover.types'
import type { Ref } from 'vue'
import { getFlowCaseCarouselIds } from '@/api/flowCases'

interface UseDiscoverCaseCollectionSyncOptions {
  caseCache: Map<string, DiscoverCase>
  cases: Ref<DiscoverCase[]>
  loadShowcase: (ids: string[], isCurrent: () => boolean) => Promise<void>
  patchShowcase: (item: DiscoverCase) => void
  removeShowcase: (caseId: string) => void
  showcaseLoading: Ref<boolean>
  updateShowcase: (item: DiscoverCase, recommended: boolean) => void
}

interface UseDiscoverCaseCollectionSyncReturn {
  invalidateShowcaseRequests: () => void
  loadShowcaseSnapshot: (ids: string[]) => Promise<void>
  removeCase: (caseId: string) => void
  updateCase: (caseId: string, patch: Partial<DiscoverCase>) => void
  updateCaseRecommendation: (caseId: string, recommended: boolean) => void
}

/**
 * Synchronize case mutations between the gallery cache and recommended showcase.
 * @param options Gallery and showcase state owned by the discover page.
 * @returns Mutation actions and cancellable showcase loading.
 */
export function useDiscoverCaseCollectionSync(
  options: UseDiscoverCaseCollectionSyncOptions,
): UseDiscoverCaseCollectionSyncReturn {
  let showcaseRequestVersion = 0

  async function loadShowcaseSnapshot(ids: string[]): Promise<void> {
    const version = ++showcaseRequestVersion
    options.showcaseLoading.value = true
    try {
      await options.loadShowcase(ids, () => version === showcaseRequestVersion)
    } finally {
      if (version === showcaseRequestVersion) options.showcaseLoading.value = false
    }
  }

  async function refreshShowcase(): Promise<void> {
    try {
      await loadShowcaseSnapshot(await getFlowCaseCarouselIds())
    } catch {
      // The saved mutation remains authoritative when a background showcase refresh fails.
    }
  }

  function updateCaseRecommendation(caseId: string, recommended: boolean): void {
    const cached = options.caseCache.get(caseId)
    if (!cached) return
    const updated = { ...cached, featured: recommended }
    options.caseCache.set(caseId, updated)
    options.cases.value = options.cases.value.map((item) => item.id === caseId ? updated : item)
    options.updateShowcase(updated, recommended)
    void refreshShowcase()
  }

  function updateCase(caseId: string, patch: Partial<DiscoverCase>): void {
    const cached = options.caseCache.get(caseId)
    if (!cached) return
    const updated = { ...cached, ...patch }
    options.caseCache.set(caseId, updated)
    options.cases.value = options.cases.value.map((item) => item.id === caseId ? updated : item)
    options.patchShowcase(updated)
  }

  function removeCase(caseId: string): void {
    options.caseCache.delete(caseId)
    options.cases.value = options.cases.value.filter((item) => item.id !== caseId)
    options.removeShowcase(caseId)
  }

  function invalidateShowcaseRequests(): void {
    showcaseRequestVersion += 1
  }

  return {
    invalidateShowcaseRequests,
    loadShowcaseSnapshot,
    removeCase,
    updateCase,
    updateCaseRecommendation,
  }
}
