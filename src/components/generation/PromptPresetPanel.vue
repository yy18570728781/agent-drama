<template>
  <div class="preset-panel">
    <div class="preset-panel-body">
      <div class="preset-sidebar">
        <div
          v-for="cat in categories"
          :key="cat.id"
          class="preset-sidebar-item"
          :class="{ active: selectedCategoryId === cat.id }"
          @click="selectedCategoryId = cat.id"
        >
          <span v-if="editingCatId !== cat.id" class="preset-sidebar-label" @dblclick.stop="startRenameCat(cat)">{{ cat.name }}</span>
          <input
            v-else
            v-model="editingCatName"
            class="preset-sidebar-input"
            @blur="confirmRenameCat"
            @keydown.enter="confirmRenameCat"
            @keydown.escape="cancelRenameCat"
          />
          <div v-if="editingCatId !== cat.id" class="preset-sidebar-actions">
            <button class="preset-icon-btn" title="重命名" @click.stop="startRenameCat(cat)">
              <Pencil :size="11" />
            </button>
            <button class="preset-icon-btn danger" title="删除" @click.stop="deleteCategory(cat.id)">
              <Trash2 :size="11" />
            </button>
          </div>
        </div>
        <button class="preset-sidebar-add" @click="onAddCategory">
          <Plus :size="12" />
          <span>新增分类</span>
        </button>
      </div>

      <div class="preset-content">
        <div class="preset-card-list">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="preset-card"
            :class="{ selected: selectedItemId === item.id }"
            @click="selectItem(item.id)"
          >
            <div class="preset-card-header">
              <span class="preset-card-title">{{ item.title }}</span>
              <div class="preset-card-actions">
                <button class="preset-icon-btn" title="编辑" @click.stop="startEditItem(item)">
                  <Pencil :size="11" />
                </button>
                <button class="preset-icon-btn danger" title="删除" @click.stop="deleteItem(item.id)">
                  <Trash2 :size="11" />
                </button>
              </div>
            </div>
            <p class="preset-card-content">{{ item.content }}</p>
            <div v-if="item.keywords.length > 0" class="preset-card-tags">
              <span v-for="kw in item.keywords" :key="kw" class="preset-card-tag">{{ kw }}</span>
            </div>
          </div>

          <button class="preset-card-add" @click="startAddItem">
            <Plus :size="16" />
            <span>新增提示词</span>
          </button>
        </div>
      </div>
    </div>

    <div class="preset-panel-footer">
      <button
        class="preset-apply-btn batch"
        :disabled="filteredItems.length === 0"
        @click="applyBatch"
      >
        整套应用
      </button>
      <button
        class="preset-apply-btn"
        :disabled="!selectedItem"
        @click="applySelected"
      >
        应用提示词
      </button>
    </div>

    <div v-if="showItemEditor" class="preset-item-editor-overlay" @click.self="showItemEditor = false">
      <div class="preset-item-editor">
        <h3 class="preset-item-editor-title">{{ editingItemId ? '编辑提示词' : '新增提示词' }}</h3>
        <input v-model="itemForm.title" class="preset-item-editor-input" placeholder="标题（如：高度图）" />
        <textarea v-model="itemForm.content" class="preset-item-editor-textarea" placeholder="提示词内容" rows="4" />
        <input v-model="itemForm.keywordsStr" class="preset-item-editor-input" placeholder="关键词（逗号分隔，如：height, displacement, 高度）" />
        <div class="preset-item-editor-actions">
          <button class="preset-item-editor-btn cancel" @click="showItemEditor = false">取消</button>
          <button class="preset-item-editor-btn confirm" @click="confirmItemEditor">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Pencil, Trash2 } from '@/components/common/icon/lucide'
import { usePromptPresets } from '@/composables/generation/usePromptPresets'
import { inferTextureMaterialChannel } from '@/utils/textureMaterialChannelInference'
import type { PresetItem } from '@/components/generation/promptPreset.types'
import type { PBRChannel } from '@/types/pbr.types'

const emit = defineEmits<{
  (e: 'apply', payload: { content: string; channel?: PBRChannel }): void
  (e: 'applyBatch', texts: string[], channels?: PBRChannel[]): void
  (e: 'close'): void
}>()

const {
  categories,
  selectedCategoryId,
  filteredItems,
  loadPresets,
  addCategory,
  renameCategory,
  deleteCategory,
  addItem,
  updateItem,
  deleteItem,
} = usePromptPresets()

const selectedItemId = ref('')
const selectedItem = computed(() =>
  filteredItems.value.find((i) => i.id === selectedItemId.value),
)

const editingCatId = ref('')
const editingCatName = ref('')

const showItemEditor = ref(false)
const editingItemId = ref('')
const itemForm = ref({ title: '', content: '', keywordsStr: '' })

onMounted(() => {
  loadPresets()
})

function selectItem(id: string): void {
  selectedItemId.value = id
}

function onAddCategory(): void {
  const name = window.prompt('输入分类名称')
  if (name?.trim()) addCategory(name.trim())
}

function startRenameCat(cat: { id: string; name: string }): void {
  editingCatId.value = cat.id
  editingCatName.value = cat.name
}

function confirmRenameCat(): void {
  if (editingCatName.value.trim()) {
    renameCategory(editingCatId.value, editingCatName.value.trim())
  }
  editingCatId.value = ''
}

function cancelRenameCat(): void {
  editingCatId.value = ''
}

function startAddItem(): void {
  editingItemId.value = ''
  itemForm.value = { title: '', content: '', keywordsStr: '' }
  showItemEditor.value = true
}

function startEditItem(item: PresetItem): void {
  editingItemId.value = item.id
  itemForm.value = {
    title: item.title,
    content: item.content,
    keywordsStr: item.keywords.join(', '),
  }
  showItemEditor.value = true
}

function confirmItemEditor(): void {
  const { title, content, keywordsStr } = itemForm.value
  if (!title.trim() || !content.trim()) return
  const keywords = keywordsStr.split(',').map((s) => s.trim()).filter(Boolean)
  if (editingItemId.value) {
    updateItem(editingItemId.value, title.trim(), content.trim(), keywords)
  } else {
    addItem(selectedCategoryId.value, title.trim(), content.trim(), keywords)
  }
  showItemEditor.value = false
}

function resolvePresetChannel(item: PresetItem): PBRChannel | undefined {
  return item.pbrChannel || inferTextureMaterialChannel({
    prompt: item.content,
    label: item.title,
    keywords: item.keywords.join(' '),
  }) || undefined
}

function applySelected(): void {
  if (selectedItem.value) {
    const channel = resolvePresetChannel(selectedItem.value)
    emit('apply', {
      content: selectedItem.value.content,
      ...(channel ? { channel } : {}),
    })
    emit('close')
  }
}

function applyBatch(): void {
  const items = filteredItems.value.filter((item) => resolvePresetChannel(item) !== 'albedo')
  const texts = items.map((item) => item.content)
  const channels = items
    .map(resolvePresetChannel)
    .filter((ch): ch is PBRChannel => ch != null)
  if (texts.length > 0) {
    emit('applyBatch', texts, channels)
    emit('close')
  }
}
</script>

<style scoped src="./PromptPresetPanel.css"></style>
