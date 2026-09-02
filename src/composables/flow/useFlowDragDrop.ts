import type { UseFlowTabCreationReturn } from './flowRuntime.types'
import { nextTick, ref } from 'vue'
import { isWorkflowImportDefinition, unwrapWorkflowImportDefinition } from './flowImportDefinition'
import { normalizeFlowCanvasName } from './flowNameValidation'

type FlowDragDropRefs = Pick<
  UseFlowTabCreationReturn,
  'pendingJsonImportData' | 'newWfName' | 'newWfInputRef' | 'newWfModalTitle' | 'showNewWfModal'
>

export interface UseFlowDragDropReturn {
  isJsonDragging: ReturnType<typeof ref<boolean>>
  onJsonDragOver: (event: DragEvent) => void
  onJsonDragLeave: () => void
  onJsonDrop: (event: DragEvent) => void
}

/**
 * 管理工作流 JSON 文件拖入状态和导入弹窗装配。
 * @param tabsRefs 工作流新建弹窗所需引用。
 * @returns 拖拽状态与事件处理器。
 */
export function useFlowDragDrop(tabsRefs: FlowDragDropRefs): UseFlowDragDropReturn {
  const isJsonDragging = ref(false)
  let jsonDragCounter = 0

  function onJsonDragOver(event: DragEvent): void {
    if (event.dataTransfer?.types?.includes('Files')) {
      isJsonDragging.value = true
    }
  }

  function onJsonDragLeave(): void {
    jsonDragCounter++
    window.setTimeout(() => {
      jsonDragCounter--
      if (jsonDragCounter <= 0) {
        jsonDragCounter = 0
        isJsonDragging.value = false
      }
    }, 50)
  }

  function onJsonDrop(event: DragEvent): void {
    isJsonDragging.value = false
    jsonDragCounter = 0

    const file = event.dataTransfer?.files?.[0]
    if (!file || !file.name.toLowerCase().endsWith('.json')) return

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      try {
        const rawParsed = JSON.parse(String(loadEvent.target?.result || '{}'))
        const parsed = unwrapWorkflowImportDefinition(rawParsed)
        if (!isWorkflowImportDefinition(parsed)) {
          alert('无效的工作流文件：缺少 nodes 或 edges')
          return
        }
        tabsRefs.pendingJsonImportData.value = parsed
        tabsRefs.newWfName.value = normalizeFlowCanvasName(
          parsed.name || rawParsed.name || file.name.replace(/\.json$/i, ''),
        )
        tabsRefs.newWfModalTitle.value = '导入工作流'
        tabsRefs.showNewWfModal.value = true
        nextTick(() => tabsRefs.newWfInputRef.value?.focus?.())
      } catch (error) {
        console.error('解析 JSON 失败', error)
        alert('导入失败：无效的 JSON 文件')
      }
    }
    reader.readAsText(file)
  }

  return {
    isJsonDragging,
    onJsonDragOver,
    onJsonDragLeave,
    onJsonDrop,
  }
}
