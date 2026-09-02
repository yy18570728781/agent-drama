import type { ReferenceImage } from '../ReferenceMenu.vue'
import type { SubjectSelectPayload } from '@/composables/subjects/useSubjectPicker'

export interface PromptInputProps {
  modelValue: string
  refImages: ReferenceImage[]
  isTextExpanded: boolean
  ariaLabel?: string
  placeholder?: string
  multilineBatchMode: boolean
}

export interface PromptInputEmits {
  (event: 'update:modelValue', text: string): void
  (event: 'prompt-change'): void
  (event: 'multiline-batch-change', enabled: boolean): void
  (event: 'select-subject', payload: SubjectSelectPayload): void
}
