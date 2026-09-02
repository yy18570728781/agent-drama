import { ref, computed, type Ref } from 'vue'
import { getStorage, setStorage } from '@/utils/storage'
import {
  DEFAULT_CATEGORIES,
  DEFAULT_ITEMS,
  LEGACY_DEFAULT_ITEM_CONTENTS,
} from '@/components/generation/promptPreset.constants'
import type { PresetCategory, PresetItem } from '@/components/generation/promptPreset.types'

const CATEGORY_KEY = 'prompt_preset_categories'
const ITEM_KEY = 'prompt_preset_items'

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readCategories(): PresetCategory[] {
  return getStorage<PresetCategory[]>(CATEGORY_KEY) || []
}

function readItems(): PresetItem[] {
  return getStorage<PresetItem[]>(ITEM_KEY) || []
}

function writeCategories(list: PresetCategory[]): void {
  setStorage(CATEGORY_KEY, list)
}

function writeItems(list: PresetItem[]): void {
  setStorage(ITEM_KEY, list)
}

function patchDefaultItem(item: PresetItem, def: PresetItem | undefined): PresetItem {
  if (!def) return item
  const patch: Partial<PresetItem> = {}
  if (!item.pbrChannel && def.pbrChannel) patch.pbrChannel = def.pbrChannel
  if (item.content === LEGACY_DEFAULT_ITEM_CONTENTS[item.id]) patch.content = def.content
  return Object.keys(patch).length ? { ...item, ...patch } : item
}

function ensureDefaults(): void {
  const cats = readCategories()
  if (cats.length === 0) {
    writeCategories(DEFAULT_CATEGORIES)
    writeItems(DEFAULT_ITEMS)
    return
  }

  const hasPbrCat = cats.some((c) => c.id === 'cat_pbr_texture')
  if (!hasPbrCat) return

  const existing = readItems()
  const existingIds = new Set(existing.map((i) => i.id))
  const missing = DEFAULT_ITEMS.filter((d) => !existingIds.has(d.id))

  const defaultsById = new Map(DEFAULT_ITEMS.map((d) => [d.id, d]))
  let patched = false
  const patchedExisting = existing.map((item) => {
    const def = defaultsById.get(item.id)
    const nextItem = patchDefaultItem(item, def)
    if (nextItem !== item) patched = true
    return nextItem
  })

  if (missing.length > 0 || patched) {
    writeItems([...patchedExisting, ...missing])
  }
}

export interface UsePromptPresetsReturn {
  categories: Ref<PresetCategory[]>
  items: Ref<PresetItem[]>
  selectedCategoryId: Ref<string>
  selectedCategory: import('vue').ComputedRef<PresetCategory | undefined>
  filteredItems: import('vue').ComputedRef<PresetItem[]>
  loadPresets: () => void
  addCategory: (name: string) => void
  renameCategory: (id: string, name: string) => void
  deleteCategory: (id: string) => void
  addItem: (categoryId: string, title: string, content: string, keywords?: string[]) => void
  updateItem: (id: string, title: string, content: string, keywords?: string[]) => void
  deleteItem: (id: string) => void
}

export function usePromptPresets(): UsePromptPresetsReturn {
  const categories = ref<PresetCategory[]>([])
  const items = ref<PresetItem[]>([])
  const selectedCategoryId = ref('')

  const selectedCategory = computed(() =>
    categories.value.find((c) => c.id === selectedCategoryId.value),
  )

  const filteredItems = computed(() =>
    items.value
      .filter((item) => item.categoryId === selectedCategoryId.value)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  )

  function loadPresets(): void {
    ensureDefaults()
    categories.value = readCategories().sort((a, b) => a.sortOrder - b.sortOrder)
    items.value = readItems()
    if (!selectedCategoryId.value && categories.value.length > 0) {
      selectedCategoryId.value = categories.value[0].id
    }
  }

  function addCategory(name: string): void {
    const now = Date.now()
    const cat: PresetCategory = {
      id: createId('cat'),
      name,
      sortOrder: categories.value.length,
      createdAt: now,
      updatedAt: now,
    }
    const list = [...readCategories(), cat]
    writeCategories(list)
    categories.value = list.sort((a, b) => a.sortOrder - b.sortOrder)
    selectedCategoryId.value = cat.id
  }

  function renameCategory(id: string, name: string): void {
    const list = readCategories().map((c) =>
      c.id === id ? { ...c, name, updatedAt: Date.now() } : c,
    )
    writeCategories(list)
    categories.value = list.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function deleteCategory(id: string): void {
    const catList = readCategories().filter((c) => c.id !== id)
    const itemList = readItems().filter((item) => item.categoryId !== id)
    writeCategories(catList)
    writeItems(itemList)
    categories.value = catList.sort((a, b) => a.sortOrder - b.sortOrder)
    items.value = itemList
    if (selectedCategoryId.value === id) {
      selectedCategoryId.value = categories.value[0]?.id || ''
    }
  }

  function addItem(
    categoryId: string,
    title: string,
    content: string,
    keywords: string[] = [],
  ): void {
    const now = Date.now()
    const siblings = readItems().filter((item) => item.categoryId === categoryId)
    const item: PresetItem = {
      id: createId('preset'),
      categoryId,
      title,
      content,
      keywords,
      sortOrder: siblings.length,
      createdAt: now,
      updatedAt: now,
    }
    const list = [...readItems(), item]
    writeItems(list)
    items.value = list
  }

  function updateItem(
    id: string,
    title: string,
    content: string,
    keywords: string[] = [],
  ): void {
    const list = readItems().map((item) =>
      item.id === id ? { ...item, title, content, keywords, updatedAt: Date.now() } : item,
    )
    writeItems(list)
    items.value = list
  }

  function deleteItem(id: string): void {
    const list = readItems().filter((item) => item.id !== id)
    writeItems(list)
    items.value = list
  }

  return {
    categories,
    items,
    selectedCategoryId,
    selectedCategory,
    filteredItems,
    loadPresets,
    addCategory,
    renameCategory,
    deleteCategory,
    addItem,
    updateItem,
    deleteItem,
  }
}
