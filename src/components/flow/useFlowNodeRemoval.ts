import { inject } from 'vue'

export function useFlowNodeRemoval(nodeId: string | undefined) {
  const flowRemoveNode = inject<((id: string) => void) | null>('flowRemoveNode', null)

  function removeNode() {
    if (!nodeId) return
    flowRemoveNode?.(nodeId)
  }

  return { removeNode }
}
