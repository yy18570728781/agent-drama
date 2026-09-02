import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import type { FlowFolderNode } from '@/components/flow/library/flowLibrary.types'

interface UseFlowFolderSearchReturn {
  folderSearchKeyword: Ref<string>
  visibleFolderTree: ComputedRef<FlowFolderNode[]>
}

function matchesKeyword(node: FlowFolderNode, keyword: string): boolean {
  return [node.name, node.code].some((value) =>
    String(value || '').toLocaleLowerCase().includes(keyword),
  )
}

function filterFolderNodes(nodes: FlowFolderNode[], keyword: string): FlowFolderNode[] {
  return nodes.reduce<FlowFolderNode[]>((result, node) => {
    if (node.id.startsWith('add_')) return result
    const children = filterFolderNodes(node.children, keyword)
    if (!matchesKeyword(node, keyword) && !children.length) return result
    result.push({
      ...node,
      children: children.length ? children : node.children,
    })
    return result
  }, [])
}

/**
 * 管理文件夹树的本地搜索，并保留命中节点的祖先层级。
 * @param folderTree 已移除虚拟根节点的文件夹树。
 * @returns 搜索关键词与过滤后的文件夹树。
 */
export function useFlowFolderSearch(
  folderTree: ComputedRef<FlowFolderNode[]>,
): UseFlowFolderSearchReturn {
  const folderSearchKeyword = ref('')
  const visibleFolderTree = computed(() => {
    const keyword = folderSearchKeyword.value.trim().toLocaleLowerCase()
    return keyword ? filterFolderNodes(folderTree.value, keyword) : folderTree.value
  })
  return { folderSearchKeyword, visibleFolderTree }
}
