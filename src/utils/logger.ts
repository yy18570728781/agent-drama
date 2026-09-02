export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  level: LogLevel
  module: string
  message: string
  detail?: any
  timestamp: string
}

type LogListener = (entry: LogEntry) => void

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

class Logger {
  private minLevel: LogLevel = 'debug'
  private listeners: LogListener[] = []

  setLevel(level: LogLevel) {
    this.minLevel = level
  }

  onLog(fn: LogListener) {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn)
    }
  }

  private emit(level: LogLevel, module: string, message: string, detail?: any) {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) return

    // 处理 Error 对象，提取堆栈信息
    let processedDetail = detail
    if (detail instanceof Error) {
      processedDetail = {
        name: detail.name,
        message: detail.message,
        stack: detail.stack
      }
    }

    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level,
      module,
      message,
      detail: processedDetail,
      timestamp: new Date().toISOString(),
    }

    // 不向 console 输出——errorInterceptor 已经把 console.warn/error 转发到这里，
    // 再打一次只会和原始调用形成重复。日志全部走 in-app 日志面板（listeners）。
    this.listeners.forEach(fn => fn(entry))
  }

  debug(module: string, message: string, detail?: any) { this.emit('debug', module, message, detail) }
  info(module: string, message: string, detail?: any) { this.emit('info', module, message, detail) }
  warn(module: string, message: string, detail?: any) { this.emit('warn', module, message, detail) }
  error(module: string, message: string, detail?: any) { this.emit('error', module, message, detail) }
}

export const logger = new Logger()
