import { nextTick, ref, type Ref } from 'vue'

interface Point {
  x: number
  y: number
}

interface AssetMasonryInteractionReturn {
  onDragEnd: () => void
  onDragMove: (id: string, mouseX: number, mouseY: number) => void
  onHover: (id: string, mouseX: number, mouseY: number) => void
  onHoverEnd: () => void
  pushOffsets: Ref<Map<string, Point>>
  updateCardPositions: () => void
}

/**
 * 管理瀑布流卡片邻近推开效果，只遍历当前实际挂载的可见卡片。
 * @param flowRef 瀑布流容器。
 * @returns 卡片交互处理器和位移状态。
 */
export function useAssetMasonryInteraction(
  flowRef: Ref<HTMLElement | null>,
): AssetMasonryInteractionReturn {
  const cardPositions = ref(new Map<string, Point>())
  const pushOffsets = ref(new Map<string, Point>())
  const draggingCardId = ref<string | null>(null)

  function updateCardPositions(): void {
    if (!flowRef.value) return
    const parentRect = flowRef.value.getBoundingClientRect()
    const nextPositions = new Map<string, Point>()
    flowRef.value.querySelectorAll('.record-wrapper').forEach((card) => {
      const rect = card.getBoundingClientRect()
      const id = (card as HTMLElement).dataset.assetId
      if (!id) return
      nextPositions.set(id, {
        x: rect.left - parentRect.left + rect.width / 2,
        y: rect.top - parentRect.top + rect.height / 2,
      })
    })
    cardPositions.value = nextPositions
  }

  function calculatePushEffect(sourceId: string, x: number, y: number, factor = 1): void {
    const nextOffsets = new Map<string, Point>()
    cardPositions.value.forEach((position, id) => {
      if (id === sourceId) return
      const dx = x - position.x
      const dy = y - position.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance >= 200 || distance <= 0.001) return
      const force = Math.max(0, 1 - distance / 200) * factor * 40
      nextOffsets.set(id, { x: -(dx / distance) * force, y: -(dy / distance) * force })
    })
    pushOffsets.value = nextOffsets
  }

  function updateEffect(id: string, mouseX: number, mouseY: number, factor = 1): void {
    if (!flowRef.value) return
    const rect = flowRef.value.getBoundingClientRect()
    updateCardPositions()
    calculatePushEffect(id, mouseX - rect.left, mouseY - rect.top, factor)
  }

  function onDragMove(id: string, mouseX: number, mouseY: number): void {
    draggingCardId.value = id
    updateEffect(id, mouseX, mouseY)
  }

  function onDragEnd(): void {
    draggingCardId.value = null
    pushOffsets.value = new Map()
  }

  function onHover(id: string, mouseX: number, mouseY: number): void {
    if (!draggingCardId.value) updateEffect(id, mouseX, mouseY, 0.3)
  }

  function onHoverEnd(): void {
    if (!draggingCardId.value) pushOffsets.value = new Map()
  }

  nextTick(updateCardPositions)
  return { onDragEnd, onDragMove, onHover, onHoverEnd, pushOffsets, updateCardPositions }
}
