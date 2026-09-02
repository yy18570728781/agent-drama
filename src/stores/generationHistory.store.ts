import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface HistoryRecord {
  id: number
  layout: 'single' | 'grid'
  type?: string
  tag?: string
  prompt: string
  modelInfo?: string
  model_info?: { id: string; name: string; publisher?: any } | null
  modelDisplayName?: string
  vendor?: string
  media?: string[]
  images?: string[]
  reference_urls?: string[]
  params_display?: { label: string; key: string; value: any }[]
  date: string
  genType: 'image' | 'video' | 'avatar' | 'audio' | 'action' | 'agent' | 'model'
  opType: 'normal' | 'favorite' | 'upscaled'
  isGenerating?: boolean
  status?: 'error' | 'completed' | string
  progress?: number
  statusText?: string
  // 后端真实任务 ID（用于取消任务）
  taskId?: string
  // 计时相关
  _startTime?: number
  elapsed?: string
}

export interface FilterState {
  search: string
  time: string
  startDate: string
  endDate: string
  genType: string
  opType: string
}

// 暂时不使用 mock 数据，等数据库功能完成
const mockRecords: HistoryRecord[] = []

export const useGenerationHistoryStore = defineStore('generationHistory', () => {
  const historyRecords = ref<HistoryRecord[]>([])

  const currentFilters = ref<FilterState>({
    search: '',
    time: 'week',
    startDate: '',
    endDate: '',
    genType: 'all',
    opType: 'all',
  })

  const isFiltering = computed(() => {
    const f = currentFilters.value
    return f.search !== '' || f.genType !== 'all' || f.opType !== 'all' || f.time !== 'all'
  })

  const filteredRecords = computed(() => {
    const f = currentFilters.value
    return historyRecords.value.filter(r => {
      if (f.search && !r.prompt.toLowerCase().includes(f.search.toLowerCase())) return false
      if (f.genType !== 'all' && r.genType !== f.genType) return false
      if (f.opType !== 'all' && r.opType !== f.opType) return false
      if (f.time !== 'all') {
        const d = new Date(r.date)
        const now = new Date()
        if (f.time === 'week' && d < new Date(now.getTime() - 7 * 86400000)) return false
        if (f.time === 'month' && d < new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())) return false
        if (f.time === '3months' && d < new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())) return false
        if (f.time === 'custom') {
          if (f.startDate && d < new Date(f.startDate)) return false
          if (f.endDate && d > new Date(f.endDate)) return false
        }
      }
      return true
    })
  })

  function setFilters(f: FilterState) {
    currentFilters.value = f
  }

  function deleteRecord(id: number) {
    historyRecords.value = historyRecords.value.filter(r => r.id !== id)
  }

  function addRecord(record: HistoryRecord) {
    historyRecords.value.push(record)
  }

  function updateRecord(id: number, patch: Partial<HistoryRecord>) {
    const idx = historyRecords.value.findIndex(r => r.id === id)
    if (idx !== -1) {
      historyRecords.value[idx] = { ...historyRecords.value[idx], ...patch }
    }
  }

  return {
    historyRecords,
    currentFilters,
    isFiltering,
    filteredRecords,
    setFilters,
    deleteRecord,
    addRecord,
    updateRecord,
  }
})
