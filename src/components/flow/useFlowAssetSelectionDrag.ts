import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { inferTextureMaterialChannel } from '@/utils/textureMaterialChannelInference'

type AssetLike = Record<string, any>
type AssetSelectionId = string | number

type DropAsset = {
  id: unknown
  url: string
  thumbnail_url: string | null
  thumb: string | null
  type: unknown
  model: string
  recordId: unknown
  pbrChannel?: string
}

type DragEmitPayload = {
  asset?: DropAsset
  assets?: DropAsset[]
  clientX: number
  clientY: number
}

type UseFlowAssetSelectionDragOptions = {
  visible: Ref<boolean>
  assetTypeFilter: Ref<string>
  favoriteOnly: Ref<boolean>
  workflowOnly: Ref<boolean>
  assetPanelBodyRef: Ref<HTMLElement | null>
  getOrderedAssets: () => AssetLike[]
  resolveAssetUrl: (raw: unknown) => string | null
  emitDropAsset: (payload: DragEmitPayload) => void
}

function buildDroppedAsset(asset: AssetLike, resolveAssetUrl: (raw: unknown) => string | null): DropAsset | null {
  const originUrl = resolveAssetUrl(asset?.url)
  if (!originUrl) return null
  const pbrChannel = inferTextureMaterialChannel(asset)
  return {
    id: asset?.id,
    url: originUrl,
    thumbnail_url: resolveAssetUrl(asset?.thumbnail_url || asset?.thumb) || null,
    thumb: resolveAssetUrl(asset?.thumb || asset?.thumbnail_url) || null,
    type: asset?.type,
    model: String(asset?.model || '').trim(),
    recordId: asset?.record_id || asset?.aigcRecordId,
    ...(pbrChannel ? { pbrChannel } : {}),
  }
}

export function useFlowAssetSelectionDrag(options: UseFlowAssetSelectionDragOptions) {
  const selectedAssetIds = ref<AssetSelectionId[]>([])
  const lastSelectedAssetId = ref<AssetSelectionId | null>(null)
  const selectedAssetIdSet = computed(() => new Set(selectedAssetIds.value.map((id) => String(id))))

  let assetDragGhost: HTMLDivElement | null = null
  let assetDragAsset: AssetLike | null = null
  let assetDragStarted = false

  function clearSelection(): void {
    selectedAssetIds.value = []
    lastSelectedAssetId.value = null
  }

  function getAssetSelectionId(asset: AssetLike): AssetSelectionId {
    return String(asset?.id ?? '')
  }

  function isAssetSelected(asset: AssetLike): boolean {
    return selectedAssetIdSet.value.has(String(getAssetSelectionId(asset)))
  }

  function selectAssetRange(asset: AssetLike): void {
    const orderedAssets = options.getOrderedAssets()
    const anchorId = lastSelectedAssetId.value
    const currentId = getAssetSelectionId(asset)
    const currentIndex = orderedAssets.findIndex((item) => String(item?.id) === String(currentId))
    const anchorIndex = orderedAssets.findIndex((item) => String(item?.id) === String(anchorId))
    if (currentIndex < 0 || anchorIndex < 0) {
      selectedAssetIds.value = [currentId]
      lastSelectedAssetId.value = currentId
      return
    }
    const [start, end] = currentIndex >= anchorIndex
      ? [anchorIndex, currentIndex]
      : [currentIndex, anchorIndex]
    selectedAssetIds.value = orderedAssets.slice(start, end + 1).map((item) => getAssetSelectionId(item))
  }

  function selectAssetOnMouseDown(event: MouseEvent, asset: AssetLike): void {
    const currentId = getAssetSelectionId(asset)
    const metaKey = event.ctrlKey || event.metaKey
    if (event.shiftKey && lastSelectedAssetId.value != null) {
      selectAssetRange(asset)
      return
    }
    if (metaKey) {
      const nextIds = new Set(selectedAssetIds.value)
      if (nextIds.has(currentId)) {
        nextIds.delete(currentId)
      } else {
        nextIds.add(currentId)
        lastSelectedAssetId.value = currentId
      }
      selectedAssetIds.value = Array.from(nextIds)
      if (!selectedAssetIds.value.length) lastSelectedAssetId.value = null
      return
    }
    if (isAssetSelected(asset) && selectedAssetIds.value.length > 1) {
      lastSelectedAssetId.value = currentId
      return
    }
    selectedAssetIds.value = [currentId]
    lastSelectedAssetId.value = currentId
  }

  function getDragAssets(): AssetLike[] {
    if (!assetDragAsset) return []
    if (!isAssetSelected(assetDragAsset)) return [assetDragAsset]
    const selectedIds = selectedAssetIdSet.value
    const orderedAssets = options.getOrderedAssets()
    const selectedAssets = orderedAssets.filter((asset) => selectedIds.has(String(asset?.id ?? '')))
    return selectedAssets.length ? selectedAssets : [assetDragAsset]
  }

  function createDragGhost(assetCount: number, previewUrl: string): void {
    assetDragGhost = document.createElement('div')
    assetDragGhost.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;width:120px;height:120px;border-radius:12px;overflow:visible;opacity:0.92'
    const layers = Math.min(3, assetCount)
    for (let index = layers - 1; index >= 0; index -= 1) {
      const layer = document.createElement('div')
      layer.style.cssText = `position:absolute;inset:0;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.42);transform:translate(${index * 8}px, ${index * 6}px);background:rgba(24,24,27,0.92);border:1px solid rgba(255,255,255,0.08)`
      if (index === 0) {
        const img = document.createElement('img')
        img.src = previewUrl
        img.style.cssText = 'width:100%;height:100%;object-fit:cover'
        layer.appendChild(img)
      }
      assetDragGhost.appendChild(layer)
    }
    if (assetCount > 1) {
      const badge = document.createElement('div')
      badge.textContent = String(assetCount)
      badge.style.cssText = 'position:absolute;top:-8px;right:-8px;min-width:24px;height:24px;padding:0 7px;border-radius:999px;background:#2563eb;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(37,99,235,0.35)'
      assetDragGhost.appendChild(badge)
    }
    document.body.appendChild(assetDragGhost)
  }

  function onAssetMouseDown(event: MouseEvent, asset: AssetLike): void {
    if (event.button !== 0) return
    selectAssetOnMouseDown(event, asset)
    assetDragAsset = asset
    assetDragStarted = false
    document.addEventListener('mousemove', onAssetGlobalMove)
    document.addEventListener('mouseup', onAssetGlobalUp)
  }

  function onAssetGlobalMove(event: MouseEvent): void {
    if (!assetDragAsset) return
    if (!assetDragStarted) {
      const panelEl = options.assetPanelBodyRef.value
      if (panelEl) {
        const rect = panelEl.getBoundingClientRect()
        if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) return
      }
      const dragAssets = getDragAssets()
      const previewUrl = options.resolveAssetUrl(dragAssets[0]?.url)
      if (!previewUrl) return
      assetDragStarted = true
      createDragGhost(dragAssets.length, previewUrl)
    }
    if (assetDragGhost) {
      assetDragGhost.style.left = `${event.clientX - 60}px`
      assetDragGhost.style.top = `${event.clientY - 60}px`
    }
  }

  function onAssetGlobalUp(event: MouseEvent): void {
    document.removeEventListener('mousemove', onAssetGlobalMove)
    document.removeEventListener('mouseup', onAssetGlobalUp)
    assetDragGhost?.remove()
    assetDragGhost = null
    if (!assetDragAsset) return
    const dragAssets = getDragAssets()
    assetDragAsset = null
    if (!assetDragStarted) return

    const canvasEl = document.querySelector('.flow-canvas-wrapper')
    if (!canvasEl) return
    const rect = canvasEl.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      return
    }

    const droppedAssets = dragAssets
      .map((asset) => buildDroppedAsset(asset, options.resolveAssetUrl))
      .filter(Boolean) as DropAsset[]
    if (!droppedAssets.length) return

    options.emitDropAsset({
      ...(droppedAssets.length === 1 ? { asset: droppedAssets[0] } : {}),
      assets: droppedAssets,
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  function handleDocumentMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement | null
    if (!target) return
    if (target.closest('.slide-panel')) return
    if (target.closest('.flow-canvas-wrapper')) {
      clearSelection()
    }
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      clearSelection()
    }
  }

  onMounted(() => {
    document.addEventListener('mousedown', handleDocumentMouseDown, true)
    document.addEventListener('keydown', handleDocumentKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('mousedown', handleDocumentMouseDown, true)
    document.removeEventListener('keydown', handleDocumentKeydown)
    document.removeEventListener('mousemove', onAssetGlobalMove)
    document.removeEventListener('mouseup', onAssetGlobalUp)
    assetDragGhost?.remove()
  })

  watch(() => options.visible.value, (visible) => {
    if (!visible) clearSelection()
  })
  watch(() => options.assetTypeFilter.value, clearSelection)
  watch(() => options.favoriteOnly.value, clearSelection)
  watch(() => options.workflowOnly.value, clearSelection)

  return {
    selectedAssetIds,
    clearSelection,
    isAssetSelected,
    onAssetMouseDown,
  }
}
