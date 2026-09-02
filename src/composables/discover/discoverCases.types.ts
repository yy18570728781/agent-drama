import type { ComputedRef, Ref } from 'vue'
import type {
  DiscoverCase,
  DiscoverCategory,
  DiscoverCategoryAccess,
  DiscoverShowcaseItem,
} from '@/components/discover/discover.types'

export interface UseDiscoverCasesReturn {
  activeCategory: Ref<DiscoverCategory>
  cases: Ref<DiscoverCase[]>
  categories: ComputedRef<readonly DiscoverCategory[]>
  categoryAccessById: Ref<ReadonlyMap<string, DiscoverCategoryAccess>>
  errorMessage: Ref<string>
  findCaseById: (caseId: string) => DiscoverCase | null
  hasMore: Ref<boolean>
  loadMore: () => Promise<void>
  loading: Ref<boolean>
  loadingMore: Ref<boolean>
  reload: () => Promise<void>
  removeCase: (caseId: string) => void
  searchCases: (keyword: string) => Promise<void>
  selectCategory: (category: DiscoverCategory) => Promise<void>
  showcaseItems: Ref<DiscoverShowcaseItem[]>
  showcaseLoading: Ref<boolean>
  updateCase: (caseId: string, patch: Partial<DiscoverCase>) => void
  updateCaseRecommendation: (caseId: string, recommended: boolean) => void
}
