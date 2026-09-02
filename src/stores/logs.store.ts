import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger, type LogEntry, type LogLevel } from '@/utils/logger'
import { getApiBase, authFetch } from '@/api/client'

export const useLogsStore = defineStore('logs', () => {
  const entries = ref<LogEntry[]>([])
  const serverEntries = ref<LogEntry[]>([])
  const maxEntries = ref(1000)
  const filterLevel = ref<LogLevel | 'all'>('all')
  const filterModule = ref<string>('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const showServerLogs = ref(true)

  // 订阅本地 logger
  logger.onLog((entry) => {
    entries.value.unshift(entry)
    if (entries.value.length > maxEntries.value) {
      entries.value = entries.value.slice(0, maxEntries.value)
    }
  })

  // 合并本地日志和服务器日志， source: 'frontend' | 'backend'
  // 合并本地日志和服务器日志， source: 'frontend' | 'backend'
  const allEntries = computed(() => {
    const local = entries.value.map(e => ({ ...e, source: 'frontend' as const }))
    const server = serverEntries.value.map(e => ({ ...e, source: 'backend' as const }))
    const merged = [...local, ...server]
    // 按时间倒序排列
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return merged.slice(0, 1000)
  })

  const filteredEntries = computed(() => {
    let result = allEntries.value

    if (filterLevel.value !== 'all') {
      result = result.filter(e => e.level === filterLevel.value)
    }

    if (filterModule.value) {
      const search = filterModule.value.toLowerCase()
      result = result.filter(e => e.module.toLowerCase().includes(search))
    }

    return result
  })

  const modules = computed(() => {
    const set = new Set(allEntries.value.map(e => e.module))
    return Array.from(set).sort()
  })

  const stats = computed(() => {
    const counts = { debug: 0, info: 0, warn: 0, error: 0 }
    allEntries.value.forEach(e => counts[e.level]++)
    return counts
  })

  // 从服务器获取日志
  async function fetchServerLogs() {
    if (!showServerLogs.value) return
    
    isLoading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (filterLevel.value !== 'all') {
        params.append('level', filterLevel.value)
      }
      if (filterModule.value) {
        params.append('module', filterModule.value)
      }
      params.append('limit', '500')
      
      const response = await authFetch(`${getApiBase()}/api/logs?${params}`)
      if (!response.ok) throw new Error('Failed to fetch logs')
      
      const data = await response.json()
      serverEntries.value = data.entries || []
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch logs'
      console.error('Failed to fetch server logs:', e)
    } finally {
      isLoading.value = false
    }
  }

  // 清空所有日志
  async function clear() {
    entries.value = []
    serverEntries.value = []
    
    // 同时清空服务器日志
    try {
      const response = await authFetch(`${getApiBase()}/api/logs`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to clear server logs')
      const data = await response.json()
      logger.info('Logs', `Cleared ${data.count} server log entries`)
    } catch (e) {
      console.error('Failed to clear server logs:', e)
    }
  }

  // 导出日志
  async function exportLogs() {
    try {
      // 尝试从服务器导出
      const response = await authFetch(`${getApiBase()}/api/logs/export`)
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
        a.click()
        URL.revokeObjectURL(url)
        return
      }
    } catch (e) {
      console.error('Failed to export from server, using local:', e)
    }
    
    // 降级到本地导出
    const data = JSON.stringify(allEntries.value, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 刷新日志
  async function refresh() {
    await fetchServerLogs()
  }

  // SSE 实时日志订阅（使用 fetch 流式读取并携带 Teamones access_token）
  let sseAbortController: AbortController | null = null

  function subscribeToLogs() {
    if (sseAbortController) return

    sseAbortController = new AbortController()
    const signal = sseAbortController.signal

    ;(async () => {
      try {
        const response = await authFetch(`${getApiBase()}/api/logs/stream`, { signal })
        if (!response.ok || !response.body) return

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue
            try {
              const entry = JSON.parse(trimmed.slice(6))
              if (entry.error) continue
              const exists = serverEntries.value.some(e => e.id === entry.id)
              if (!exists) {
                serverEntries.value.unshift(entry)
                if (serverEntries.value.length > maxEntries.value) {
                  serverEntries.value = serverEntries.value.slice(0, maxEntries.value)
                }
              }
            } catch (e) {
              console.error('Failed to parse log entry:', e)
            }
          }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('SSE connection error')
          sseAbortController = null
          // 5秒后重连
          setTimeout(subscribeToLogs, 5000)
        }
      }
    })()
  }

  function unsubscribeFromLogs() {
    if (sseAbortController) {
      sseAbortController.abort()
      sseAbortController = null
    }
  }

  return {
    entries,
    serverEntries,
    allEntries,
    filteredEntries,
    modules,
    stats,
    filterLevel,
    filterModule,
    maxEntries,
    isLoading,
    error,
    showServerLogs,
    clear,
    exportLogs,
    fetchServerLogs,
    refresh,
    subscribeToLogs,
    unsubscribeFromLogs,
  }
}, {
  persist: {
    paths: ['maxEntries', 'showServerLogs'],
  },
})
