import { useRouter } from 'vue-router'

interface UseDiscoverCreationReturn {
  startNewCreation: () => void
}

/**
 * 从发现页返回原有的生成页面入口。
 * @returns 跳转到生成页面的方法。
 */
export function useDiscoverCreation(): UseDiscoverCreationReturn {
  const router = useRouter()

  function startNewCreation(): void {
    void router.push({ name: 'card' })
  }

  return { startNewCreation }
}
