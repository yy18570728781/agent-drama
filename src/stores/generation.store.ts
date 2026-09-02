import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createGeneration, getTaskStatus, cancelTask, type GenerationTask, type GenerationParams } from '@/api/generation'

export interface PendingEdit {
  prompt: string
  modelId?: string
  capability?: string
  mode?: string
  generateParams?: Record<string, any>
  referenceUrls?: string[]
  autoSend?: boolean  // true = 再次生成（直接发送），false = 重新编辑（只填入）
}

export const useGenerationStore = defineStore('generation', () => {
  const currentTask = ref<GenerationTask | null>(null)
  const progress = ref(0)
  const isGenerating = ref(false)
  const results = ref<any[]>([])
  const pendingEdit = ref<PendingEdit | null>(null)

  function setPendingEdit(data: PendingEdit | null) {
    pendingEdit.value = data
  }

  async function generate(params: GenerationParams) {
    isGenerating.value = true
    progress.value = 0
    try {
      const task = await createGeneration(params)
      currentTask.value = task
      return task
    } catch (e) {
      isGenerating.value = false
      throw e
    }
  }

  async function pollStatus(taskId: string) {
    try {
      const status = await getTaskStatus(taskId)
      currentTask.value = status
      progress.value = status.progress ?? 0
      if (status.status === 'completed') {
        isGenerating.value = false
        if (status.result) results.value.unshift(status.result)
      } else if (status.status === 'failed') {
        isGenerating.value = false
      }
      return status
    } catch (e) {
      isGenerating.value = false
      throw e
    }
  }

  async function cancel() {
    if (!currentTask.value) return
    await cancelTask(currentTask.value.task_id)
    isGenerating.value = false
  }

  function updateProgress(p: number) {
    progress.value = p
  }

  function completeTask(result: any) {
    isGenerating.value = false
    progress.value = 100
    if (result) results.value.unshift(result)
  }

  return { currentTask, progress, isGenerating, results, pendingEdit, generate, pollStatus, cancel, updateProgress, completeTask, setPendingEdit }
})
