import type { FlowFolderNode } from '@/components/flow/library/flowLibrary.types'
import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { FlowLibraryCategory } from '@/api/flowLibrary'
import {
  findFlowRootCategoryId,
  isFlowVirtualRoot,
} from '@/services/flow/flowCategoryPath.service'

interface UseFlowLibraryTreeScopeReturn {
  folderTree: ComputedRef<FlowFolderNode[]>
  rootCategoryId: ComputedRef<string>
  setStandaloneScope: (categoryId: string) => void
}

function findFolderNode(nodes: FlowFolderNode[], categoryId: string): FlowFolderNode | undefined {
  for (const node of nodes) {
    if (node.id === categoryId) return node
    const child = findFolderNode(node.children, categoryId)
    if (child) return child
  }
  return undefined
}

/**
 * 管理普通资料库与单页模式不同的目录树根作用域。
 * @param categories 完整分类列表。
 * @param rawFolderTree 包含虚拟根节点的完整目录树。
 * @returns 当前树根、可见子目录及单页作用域初始化动作。
 */
export function useFlowLibraryTreeScope(
  categories: Ref<FlowLibraryCategory[]>,
  rawFolderTree: ComputedRef<FlowFolderNode[]>,
): UseFlowLibraryTreeScopeReturn {
  const route = useRoute()
  const standaloneScopeId = ref('')
  const isStandalone = computed(() => route.meta.standalone === true)
  const rootCategoryId = computed(() => {
    if (isStandalone.value && standaloneScopeId.value) return standaloneScopeId.value
    return findFlowRootCategoryId(categories.value)
  })
  const folderTree = computed(() => {
    if (isStandalone.value && standaloneScopeId.value) {
      return findFolderNode(rawFolderTree.value, standaloneScopeId.value)?.children || []
    }
    return rawFolderTree.value.flatMap((folder) =>
      isFlowVirtualRoot(folder) ? folder.children : [folder],
    )
  })

  function setStandaloneScope(categoryId: string): void {
    if (isStandalone.value && categoryId && !standaloneScopeId.value) {
      standaloneScopeId.value = categoryId
    }
  }

  return { folderTree, rootCategoryId, setStandaloneScope }
}
