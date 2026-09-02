import type { Ref } from 'vue'
import type {
  DiscoverCase,
  DiscoverCategoryAccess,
  DiscoverShowcaseItem,
} from '@/components/discover/discover.types'
import { ref } from 'vue'
import { loadDiscoverCases } from '@/services/discover/discoverCases.service'

interface UseDiscoverShowcaseOptions {
  categoryAccessById: Ref<ReadonlyMap<string, DiscoverCategoryAccess>>
  onCasesLoaded: (items: DiscoverCase[]) => void
}

interface UseDiscoverShowcaseReturn {
  decorateCases: (items: DiscoverCase[]) => DiscoverCase[]
  loadShowcase: (ids: string[], isCurrent: () => boolean) => Promise<void>
  patchShowcase: (item: DiscoverCase) => void
  removeShowcase: (caseId: string) => void
  resetShowcase: (ids: string[]) => void
  showcaseItems: Ref<DiscoverShowcaseItem[]>
  updateShowcase: (item: DiscoverCase, recommended: boolean) => void
}

const RECOMMENDATION_LIMIT = 6

function toShowcaseItem(item: DiscoverCase): DiscoverShowcaseItem {
  return {
    id: item.id,
    image: item.image,
    imageAlt: item.imageAlt,
    badges: item.category ? [{ label: item.category }] : [],
    title: item.title,
    description: item.description,
    prompt: '',
    video: item.video,
  }
}

/**
 * 管理发现页推荐案例加载、权限展示数据和即时推荐状态。
 * @param options type 14 分类权限索引与案例缓存回调。
 * @returns 推荐案例列表、案例展示适配及推荐状态更新动作。
 */
export function useDiscoverShowcase(
  options: UseDiscoverShowcaseOptions,
): UseDiscoverShowcaseReturn {
  const featuredIds = ref<ReadonlySet<string>>(new Set())
  const showcaseItems = ref<DiscoverShowcaseItem[]>([])

  function decorateCase(item: DiscoverCase): DiscoverCase {
    const access = options.categoryAccessById.value.get(item.categoryId || '')
    return {
      ...item,
      category: item.category || access?.name || '',
      featured: featuredIds.value.has(item.id),
      permission: access?.permission ?? item.permission,
    }
  }

  function decorateCases(items: DiscoverCase[]): DiscoverCase[] {
    return items.map(decorateCase)
  }

  function resetShowcase(ids: string[]): void {
    featuredIds.value = new Set(ids)
    showcaseItems.value = []
  }

  async function loadShowcase(ids: string[], isCurrent: () => boolean): Promise<void> {
    featuredIds.value = new Set(ids)
    const displayIds = ids.slice(-RECOMMENDATION_LIMIT).reverse()
    if (!displayIds.length) {
      if (isCurrent()) showcaseItems.value = []
      return
    }
    const result = await loadDiscoverCases({ assetIds: displayIds, pageSize: displayIds.length })
    if (!isCurrent()) return
    const casesById = new Map(result.items.map((item) => [item.id, decorateCase(item)]))
    const recommendedCases = displayIds
      .map((id) => casesById.get(id))
      .filter((item): item is DiscoverCase => !!item)
    options.onCasesLoaded(recommendedCases)
    showcaseItems.value = recommendedCases.map(toShowcaseItem)
  }

  function updateShowcase(item: DiscoverCase, recommended: boolean): void {
    const nextIds = new Set(featuredIds.value)
    if (recommended) nextIds.add(item.id)
    else nextIds.delete(item.id)
    featuredIds.value = nextIds
    if (!recommended) {
      showcaseItems.value = showcaseItems.value.filter((current) => current.id !== item.id)
      return
    }
    showcaseItems.value = [
      toShowcaseItem({ ...item, featured: true }),
      ...showcaseItems.value.filter((current) => current.id !== item.id),
    ].slice(0, RECOMMENDATION_LIMIT)
  }

  function patchShowcase(item: DiscoverCase): void {
    showcaseItems.value = showcaseItems.value.map((current) => (
      current.id === item.id ? toShowcaseItem(item) : current
    ))
  }

  function removeShowcase(caseId: string): void {
    featuredIds.value = new Set([...featuredIds.value].filter((id) => id !== caseId))
    showcaseItems.value = showcaseItems.value.filter((item) => item.id !== caseId)
  }

  return {
    decorateCases,
    loadShowcase,
    patchShowcase,
    removeShowcase,
    resetShowcase,
    showcaseItems,
    updateShowcase,
  }
}
