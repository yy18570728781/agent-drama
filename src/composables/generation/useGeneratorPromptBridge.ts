import { nextTick, ref, watch, type Ref } from 'vue'
import type PromptInput from '@/components/generation/PromptInput.vue'
import type { ReferenceImage } from './useReferenceManager'

interface UseGeneratorPromptBridgeOptions {
  prompt: Ref<string>
  refImages: Ref<ReferenceImage[]>
}

interface UseGeneratorPromptBridgeReturn {
  closePromptMenu: () => void
  focusPrompt: () => void
  getPromptFromDom: () => string
  insertReference: (index: number) => void
  promptInputRef: Ref<InstanceType<typeof PromptInput> | null>
  renderPromptEditorFromState: () => void
  restorePromptSelection: () => void
  savePromptSelection: () => void
  setPromptInEditor: (text: string) => void
  syncPromptFromDom: (preserveWhenEmpty?: boolean) => void
}

function hasReferenceTokens(text: string): boolean {
  return /(图(?:片)?|视频|音频|模型)\s*\d+/.test(text)
}

function buildReferenceSignature(images: ReferenceImage[]): string {
  return images
    .map((item) => `${item.isVideo ? 'v' : 'i'}:${item.sourceUrl || item.url}`)
    .join('|')
}

/**
 * 统一 GeneratorInput 与 contenteditable 提示词组件之间的命令式桥接。
 * @param options 提示词状态和参考素材状态。
 * @returns 稳定的编辑器引用及同步操作。
 */
export function useGeneratorPromptBridge(
  options: UseGeneratorPromptBridgeOptions,
): UseGeneratorPromptBridgeReturn {
  const promptInputRef = ref<InstanceType<typeof PromptInput> | null>(null)
  const closePromptMenu = (): void => promptInputRef.value?.closeReferenceMenu()
  const focusPrompt = (): void => promptInputRef.value?.focus()
  const getPromptFromDom = (): string => promptInputRef.value?.getPrompt() || ''
  const insertReference = (index: number): void => promptInputRef.value?.insertRef(index)
  const renderPromptEditorFromState = (): void => promptInputRef.value?.renderPromptEditorFromState()
  const restorePromptSelection = (): void => promptInputRef.value?.restoreSelection()
  const savePromptSelection = (): void => promptInputRef.value?.saveSelection()
  const syncPromptFromDom = (preserveWhenEmpty = false): void => {
    promptInputRef.value?.syncPromptFromDom(preserveWhenEmpty)
  }
  const setPromptInEditor = (text: string): void => {
    options.prompt.value = text
    nextTick(() => {
      promptInputRef.value?.setPrompt(text)
      renderPromptEditorFromState()
    })
  }

  watch(
    () => buildReferenceSignature(options.refImages.value),
    () => {
      if (!options.prompt.value || !hasReferenceTokens(options.prompt.value)) return
      nextTick(renderPromptEditorFromState)
    },
  )

  return {
    closePromptMenu,
    focusPrompt,
    getPromptFromDom,
    insertReference,
    promptInputRef,
    renderPromptEditorFromState,
    restorePromptSelection,
    savePromptSelection,
    setPromptInEditor,
    syncPromptFromDom,
  }
}
