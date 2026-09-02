import { ElMessage } from 'element-plus'
import { nextTick, ref, type Ref } from 'vue'
import { extractRequestErrorMessage } from '@/utils/requestErrorMessage'
import { canvasRef } from './useFlowCore'
import {
  isWorkflowImportDefinition,
  unwrapWorkflowImportDefinition,
  type WorkflowImportPayload,
} from './flowImportDefinition'
import type { WorkflowImportDefinition } from './flowRuntime.types'

interface UseFlowJsonImportOptions {
  activeWorkflowId: Ref<string>
  loadDefinition: (definition: WorkflowImportDefinition) => Promise<void>
  saveDraft: () => Promise<void>
  saveWorkflow: () => Promise<boolean>
}

interface UseFlowJsonImportReturn {
  importInputRef: Ref<HTMLInputElement | null>
  importJSON: (event: Event) => Promise<void>
  triggerImport: () => void
}

function parseImportPayload(content: string): WorkflowImportPayload {
  const parsed: unknown = JSON.parse(content.replace(/^\uFEFF/, '').trim())
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('工作流 JSON 顶层必须是对象')
  }
  return parsed as WorkflowImportPayload
}

function restoreImportedViewport(definition: WorkflowImportDefinition): void {
  if (!definition.viewport) return
  const viewport = definition.viewport
  nextTick(() => {
    void canvasRef.value?.setViewport?.(viewport)
  })
}

/**
 * 管理画布 JSON 文件选择、导入和立即持久化。
 * @param options 导入所需的工作流状态与持久化操作。
 * @returns 文件输入引用、选择器触发器与导入处理器。
 * @throws 不向调用方抛出异常，导入或保存失败时在界面提示。
 */
export function useFlowJsonImport(options: UseFlowJsonImportOptions): UseFlowJsonImportReturn {
  const importInputRef = ref<HTMLInputElement | null>(null)

  function triggerImport(): void {
    const input = importInputRef.value
    if (!input) return
    input.value = ''
    input.click()
  }

  async function importJSON(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null
    const file = input?.files?.[0]
    if (input) input.value = ''
    if (!file) return
    const targetWorkflowId = String(options.activeWorkflowId.value || '').trim()
    if (!targetWorkflowId) {
      ElMessage.warning('请先打开需要导入数据的画布')
      return
    }

    let payload: WorkflowImportPayload
    try {
      payload = parseImportPayload(await file.text())
    } catch (error) {
      console.error('解析 JSON 失败', error)
      ElMessage.error(`JSON 解析失败：${extractRequestErrorMessage(error, '文件内容不是有效 JSON')}`)
      return
    }

    const definition = unwrapWorkflowImportDefinition(payload)
    if (!isWorkflowImportDefinition(definition)) {
      ElMessage.error('无效的工作流文件：未找到 nodes 和 edges 数组')
      return
    }

    try {
      await options.loadDefinition(definition)
      if (String(options.activeWorkflowId.value).trim() !== targetWorkflowId) {
        ElMessage.warning('画布已切换，本次导入未保存')
        return
      }
      restoreImportedViewport(definition)
      await options.saveDraft()
      const saved = await options.saveWorkflow()
      if (!saved) {
        ElMessage.error('JSON 已加载到画布，但自动保存未完成')
        return
      }
      ElMessage.success('JSON 已导入并保存到当前画布')
    } catch (error) {
      console.error('加载或保存导入工作流失败', error)
      const detail = extractRequestErrorMessage(error, '未知错误')
      ElMessage.error(`JSON 已解析，但加载或保存失败：${detail}`)
    }
  }

  return { importInputRef, importJSON, triggerImport }
}
