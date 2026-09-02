import type { FlowCaseCategory } from '@/api/flowCases'

export interface FlowCaseCategoryNode extends FlowCaseCategory {
  children: FlowCaseCategoryNode[]
  disabled: boolean
}

export interface FlowCasePublishDraft {
  categoryId: string
  coverFile: File | null
  name: string
}
