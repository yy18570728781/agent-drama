import { readonly, ref, type Ref } from 'vue'
import {
  isAllowedParentMessage,
  postMessageToAllowedParent,
} from '@/app/parentWindowMessaging'

interface UseEnvironmentReturn {
  isIframe: Readonly<Ref<boolean>>
  postToParent: (message: unknown) => void
  onParentMessage: (handler: (data: unknown) => void) => () => void
}

let _isIframe: boolean
try {
  _isIframe = window.self !== window.top
} catch {
  _isIframe = true
}
const isIframe = readonly(ref(_isIframe))

function postToParent(message: unknown): void {
  postMessageToAllowedParent(message)
}

function onParentMessage(handler: (data: unknown) => void): () => void {
  const listener = (event: MessageEvent): void => {
    if (!isAllowedParentMessage(event)) return
    handler(event.data)
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}

/**
 * 提供当前嵌入环境及安全的父窗口通信能力。
 * @returns iframe 状态、发送方法和可取消的消息订阅方法。
 */
export function useEnvironment(): UseEnvironmentReturn {
  return { isIframe, postToParent, onParentMessage }
}
