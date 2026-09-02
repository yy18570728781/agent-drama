import { nextTick, ref, watch, type Ref } from 'vue'
import type { ReferenceImage } from '@/composables/generation/useReferenceManager'
import type { PBRChannel } from '@/types/pbr.types'

export interface MultilinePromptReferenceRow {
  id: string
  prompt: string
  references: ReferenceImage[]
  pbrChannel?: PBRChannel
}

export function useMultilinePromptReferences(options: {
  refImages: Ref<ReferenceImage[]>
  multilineBatchMode: Ref<boolean>
}) {
  const { refImages, multilineBatchMode } = options
  const multilinePromptRows = ref<MultilinePromptReferenceRow[]>([])

  watch(multilineBatchMode, (enabled) => {
    if (enabled && !multilinePromptRows.value.length) {
      multilinePromptRows.value = [createRow(refImages.value)]
    }
    if (!enabled) {
      multilinePromptRows.value = []
    }
  })

  function addRow(): void {
    multilinePromptRows.value = [...multilinePromptRows.value, createRow(refImages.value)]
  }

  function removeRow(rowId: string): void {
    multilinePromptRows.value = multilinePromptRows.value.filter((row) => row.id !== rowId)
  }

  function resetRows(): void {
    multilinePromptRows.value = []
    void nextTick(() => {
      multilinePromptRows.value = [createRow(refImages.value)]
    })
  }

  function updateRowPrompt(rowId: string, prompt: string): void {
    multilinePromptRows.value = multilinePromptRows.value.map((row) =>
      row.id === rowId ? { ...row, prompt } : row,
    )
  }

  function replaceRows(rows: Array<{ prompt: string; references?: ReferenceImage[]; pbrChannel?: PBRChannel }>): void {
    multilinePromptRows.value = rows.map((row) => ({
      id: `multiline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: row.prompt,
      references: cloneReferenceImages(row.references || refImages.value),
      ...(row.pbrChannel ? { pbrChannel: row.pbrChannel } : {}),
    }))
  }

  function applyGlobalReferencesToRow(rowId: string): void {
    multilinePromptRows.value = multilinePromptRows.value.map((row) =>
      row.id === rowId ? { ...row, references: cloneReferenceImages(refImages.value) } : row,
    )
  }

  function removeRowReference(rowId: string, imageIndex: number): void {
    multilinePromptRows.value = multilinePromptRows.value.map((row) => {
      if (row.id !== rowId) return row
      return {
        ...row,
        references: row.references.filter((_, index) => index !== imageIndex),
      }
    })
  }

  function updateRowReferences(rowId: string, references: ReferenceImage[]): void {
    multilinePromptRows.value = multilinePromptRows.value.map((row) =>
      row.id === rowId ? { ...row, references: references.map((image) => ({ ...image })) } : row,
    )
  }

  function appendReferenceToRow(rowId: string, image: ReferenceImage): void {
    multilinePromptRows.value = multilinePromptRows.value.map((row) => {
      if (row.id !== rowId) return row
      const exists = row.references.some((item) => {
        const left = item.sourceUrl || item.url
        const right = image.sourceUrl || image.url
        return left === right
      })
      if (exists) return row
      return {
        ...row,
        references: [...row.references, { ...image }],
      }
    })
  }

  function buildMultilinePromptTasks(): Array<{ prompt: string; refs: ReferenceImage[]; pbrChannel?: PBRChannel }> {
    return multilinePromptRows.value.map((row) => ({
      prompt: row.prompt,
      refs: cloneReferenceImages(row.references),
      ...(row.pbrChannel ? { pbrChannel: row.pbrChannel } : {}),
    }))
  }

  return {
    multilinePromptRows,
    addMultilinePromptRow: addRow,
    removeMultilinePromptRow: removeRow,
    resetMultilinePromptRows: resetRows,
    replaceMultilinePromptRows: replaceRows,
    updateMultilinePromptRowPrompt: updateRowPrompt,
    applyGlobalReferencesToRow,
    removeRowReference,
    updateMultilinePromptRowReferences: updateRowReferences,
    appendReferenceToRow,
    buildMultilinePromptTasks,
  }
}

function createRow(images: ReferenceImage[]): MultilinePromptReferenceRow {
  return {
    id: `multiline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: '',
    references: cloneReferenceImages(images),
  }
}

function cloneReferenceImages(images: ReferenceImage[]): ReferenceImage[] {
  return images.map((image) => ({ ...image }))
}
