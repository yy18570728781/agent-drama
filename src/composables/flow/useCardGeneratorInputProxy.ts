import type { Ref } from 'vue'
import GeneratorInput from '@/components/generation/GeneratorInput.vue'

type GeneratorInputInstance = InstanceType<typeof GeneratorInput>
type ForwardedMethodName =
  | 'setPrompt'
  | 'handleSend'
  | 'toggleTextExpanded'
  | 'collapsePanel'
  | 'setModelCapability'
  | 'setCapability'
  | 'setupFromToolCall'
  | 'restoreState'
  | 'addReferenceMedia'
  | 'addReferenceMediaAt'
  | 'openReferenceEditor'
  | 'onModelSelect'
  | 'onCapabilityBarChange'
  | 'onParamChange'
  | 'enterBatchMode'
  | 'exitBatchMode'

type ForwardedMethod<Key extends ForwardedMethodName> = (
  ...args: Parameters<GeneratorInputInstance[Key]>
) => ReturnType<GeneratorInputInstance[Key]> | undefined

export type CardGeneratorInputProxy = {
  [Key in ForwardedMethodName]: ForwardedMethod<Key>
}

/**
 * 转发画布生成器对外方法，并保留底层组件的参数元组类型。
 * @param generatorRef 生成器组件实例引用。
 * @returns 可由包装组件直接暴露的方法集合。
 */
export function useCardGeneratorInputProxy(
  generatorRef: Ref<GeneratorInputInstance | null>,
): CardGeneratorInputProxy {
  return {
    setPrompt: (...args) => generatorRef.value?.setPrompt(...args),
    handleSend: (...args) => generatorRef.value?.handleSend(...args),
    toggleTextExpanded: (...args) => generatorRef.value?.toggleTextExpanded(...args),
    collapsePanel: (...args) => generatorRef.value?.collapsePanel(...args),
    setModelCapability: (...args) => generatorRef.value?.setModelCapability(...args),
    setCapability: (...args) => generatorRef.value?.setCapability(...args),
    setupFromToolCall: (...args) => generatorRef.value?.setupFromToolCall(...args),
    restoreState: (...args) => generatorRef.value?.restoreState(...args),
    addReferenceMedia: (...args) => generatorRef.value?.addReferenceMedia(...args),
    addReferenceMediaAt: (...args) => generatorRef.value?.addReferenceMediaAt(...args),
    openReferenceEditor: (...args) => generatorRef.value?.openReferenceEditor(...args),
    onModelSelect: (...args) => generatorRef.value?.onModelSelect(...args),
    onCapabilityBarChange: (...args) => generatorRef.value?.onCapabilityBarChange(...args),
    onParamChange: (...args) => generatorRef.value?.onParamChange(...args),
    enterBatchMode: (...args) => generatorRef.value?.enterBatchMode(...args),
    exitBatchMode: (...args) => generatorRef.value?.exitBatchMode(...args),
  }
}
