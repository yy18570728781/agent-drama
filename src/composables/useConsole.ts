import { ref } from 'vue'

export interface ConsoleLog {
  id: string
  timestamp: Date
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  nodeId?: string
}

const logs = ref<ConsoleLog[]>([])

export function useConsole() {
  const addLog = (type: ConsoleLog['type'], message: string, nodeId?: string) => {
    logs.value.push({
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      type,
      message,
      nodeId,
    })

    // Keep only last 100 logs
    if (logs.value.length > 100) {
      logs.value.shift()
    }
  }

  const clearLogs = () => {
    logs.value = []
  }

  return {
    logs,
    addLog,
    clearLogs,
  }
}
