import { ref, watch, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { updateSubject, type Subject } from '@/api/subjects'

interface UseSubjectEditingReturn {
  nameDraft: Ref<string>
  descDraft: Ref<string>
  saveName: () => Promise<void>
  saveDesc: () => Promise<void>
}

function createSaveName(subject: Ref<Subject | null>, draft: Ref<string>): () => Promise<void> {
  return async (): Promise<void> => {
    if (!subject.value) return
    const name = draft.value.trim()
    if (!name) {
      draft.value = subject.value.name
      return
    }
    if (name === subject.value.name) return
    try {
      await updateSubject(subject.value.id, { name, description: subject.value.description || '' })
      subject.value.name = name
      ElMessage.success('名称已更新')
    } catch {
      ElMessage.error('名称保存失败')
    }
  }
}

function createSaveDescription(subject: Ref<Subject | null>, draft: Ref<string>): () => Promise<void> {
  return async (): Promise<void> => {
    if (!subject.value) return
    const description = draft.value.trim()
    if (description === (subject.value.description || '')) return
    try {
      await updateSubject(subject.value.id, { name: subject.value.name, description })
      subject.value.description = description
      ElMessage.success('描述已更新')
    } catch {
      ElMessage.error('描述保存失败')
    }
  }
}

/**
 * 管理主体名称与描述的内联编辑状态。
 * @param subject 当前主体引用。
 * @returns 内联编辑状态与保存操作。
 */
export function useSubjectEditing(subject: Ref<Subject | null>): UseSubjectEditingReturn {
  const nameDraft = ref('')
  const descDraft = ref('')
  const saveName = createSaveName(subject, nameDraft)
  const saveDesc = createSaveDescription(subject, descDraft)

  watch(subject, (value) => {
    nameDraft.value = value?.name || ''
    descDraft.value = value?.description || ''
  }, { immediate: true })

  return { nameDraft, descDraft, saveName, saveDesc }
}
