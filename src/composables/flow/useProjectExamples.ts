import { ref, type Ref } from 'vue'
import { getStorage, setStorage } from '@/utils/storage'
import type { ProjectExample } from '@/composables/flow/projectExample.types'

const STORAGE_KEY = 'project_examples'

type UseProjectExamplesReturn = {
  examples: Ref<ProjectExample[]>
  loadExamples: () => void
  saveExample: (
    name: string,
    definition: Record<string, unknown>,
    nodeCount: number,
  ) => ProjectExample
  updateExample: (
    id: string,
    definition: Record<string, unknown>,
    nodeCount: number,
  ) => void
  deleteExample: (id: string) => void
  renameExample: (id: string, name: string) => void
}

function readFromStorage(): ProjectExample[] {
  return getStorage<ProjectExample[]>(STORAGE_KEY) || []
}

function writeToStorage(list: ProjectExample[]): void {
  setStorage(STORAGE_KEY, list)
}

function createId(): string {
  return `example_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 项目示例的 IndexedDB CRUD，支持跨账号持久化。
 * @returns 示例列表响应式引用及增删改查方法
 */
export function useProjectExamples(): UseProjectExamplesReturn {
  const examples = ref<ProjectExample[]>([])

  function loadExamples(): void {
    examples.value = readFromStorage()
  }

  function saveExample(
    name: string,
    definition: Record<string, unknown>,
    nodeCount: number,
  ): ProjectExample {
    const now = Date.now()
    const example: ProjectExample = {
      id: createId(),
      name,
      definition,
      nodeCount,
      createdAt: now,
      updatedAt: now,
    }
    const list = [example, ...readFromStorage()]
    writeToStorage(list)
    examples.value = list
    return example
  }

  function updateExample(
    id: string,
    definition: Record<string, unknown>,
    nodeCount: number,
  ): void {
    const list = readFromStorage().map((ex) =>
      ex.id === id
        ? { ...ex, definition, nodeCount, updatedAt: Date.now() }
        : ex,
    )
    writeToStorage(list)
    examples.value = list
  }

  function deleteExample(id: string): void {
    const list = readFromStorage().filter((ex) => ex.id !== id)
    writeToStorage(list)
    examples.value = list
  }

  function renameExample(id: string, name: string): void {
    const list = readFromStorage().map((ex) =>
      ex.id === id ? { ...ex, name, updatedAt: Date.now() } : ex,
    )
    writeToStorage(list)
    examples.value = list
  }

  return {
    examples,
    loadExamples,
    saveExample,
    updateExample,
    deleteExample,
    renameExample,
  }
}
