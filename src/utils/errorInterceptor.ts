/**
 * 前端错误拦截器
 * 捕获 console.error、未捕获异常、Promise rejection
 * 并通过 logger 记录到前端日志系统
 */

import { logger } from './logger'

let isInitialized = false

function isResizeObserverLoopMessage(message: unknown): boolean {
  return typeof message === 'string'
    && (
      message.includes('ResizeObserver loop completed with undelivered notifications')
      || message.includes('ResizeObserver loop limit exceeded')
    )
}

function isHandledUploadFallbackMessage(message: unknown): boolean {
  return typeof message === 'string'
    && message.includes('上传失败')
    && (
      message.includes('保留本地预览')
      || message.includes('保留本地 blob')
      || message.includes('已保留本地预览')
    )
}

/**
 * 安装错误拦截器
 */
export function setupErrorInterceptor() {
  if (isInitialized) return
  isInitialized = true

  // 拦截 console.error —— 只转发到项目日志系统，不再向 devtools 输出
  // （原始 console.error.apply 那行删掉了，避免和异步调用栈叠加产生大段 stack 噪音）
  const originalConsoleError = console.error
  console.error = (...args: any[]) => {
    try {
      const message = args.map(arg => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}`
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' ')

      logger.error('Frontend', message, args.length === 1 && args[0] instanceof Error ? args[0] : args)
    } catch (e) {
      originalConsoleError.call(console, 'Failed to log error:', e)
    }
  }

  // 拦截 console.warn —— 同上，只走项目日志面板
  const originalConsoleWarn = console.warn
  console.warn = (...args: any[]) => {
    try {
      const message = args.map(arg => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}`
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' ')

      if (isHandledUploadFallbackMessage(message)) return

      logger.warn('Frontend', message)
    } catch (e) {
      originalConsoleError.call(console, 'Failed to log warning:', e)
    }
  }

  // 捕获全局未处理异常
  window.addEventListener('error', (event) => {
    const { message, filename, lineno, colno, error } = event

    // 浏览器在 ResizeObserver 回调导致布局延迟时会抛出这个开发态噪音，避免写入错误日志。
    if (isResizeObserverLoopMessage(message)) {
      event.preventDefault()
      return
    }

    logger.error('Frontend', `Uncaught Error: ${message}`, {
      file: filename,
      line: lineno,
      column: colno,
      stack: error?.stack
    })

    // 不阻止默认行为，让错误仍然显示在控制台
  })

  // 捕获未处理的 Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason

    let message = 'Unhandled Promise Rejection'
    let detail: any = reason

    if (reason instanceof Error) {
      message = reason.message
      detail = {
        name: reason.name,
        message: reason.message,
        stack: reason.stack
      }
    } else if (typeof reason === 'object') {
      try {
        message = JSON.stringify(reason)
      } catch {
        message = String(reason)
      }
    } else {
      message = String(reason)
    }

    logger.error('Frontend', `Promise Rejection: ${message}`, detail)
  })

  // Vue 错误处理（需要在 app 创建后设置）
  logger.info('Frontend', 'Error interceptor installed')
}
