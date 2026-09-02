<script setup lang="ts">
import { Folder, Home, Plus, X } from 'lucide-vue-next'
import './FlowDocumentTabs.scss'

defineOptions({ name: 'FlowDocumentTabs' })

interface FlowDocumentTab {
  id: string
  name?: string
  workflowId?: string | null
}

withDefaults(defineProps<{
  activeTabId?: string
  closable?: boolean
  libraryActive?: boolean
  showCreate?: boolean
  tabs: FlowDocumentTab[]
}>(), {
  activeTabId: '',
  closable: false,
  libraryActive: false,
  showCreate: false,
})

const emit = defineEmits<{
  closeTab: [tabId: string]
  create: []
  openLibrary: []
  selectTab: [tabId: string]
}>()

function formatTabName(tab: FlowDocumentTab): string {
  return String(tab.name || '').trim() || '未命名画布'
}
</script>

<template>
  <nav class="flow-document-tabs" aria-label="画布标签">
    <button
      class="flow-document-tab flow-library-tab"
      :class="{ active: libraryActive }"
      role="tab"
      type="button"
      :aria-selected="libraryActive"
      @click="emit('openLibrary')"
    >
      <Home :size="15" />
      <span class="flow-document-tab__name">画布列表</span>
    </button>

    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="flow-document-tab"
      :class="{ active: !libraryActive && tab.id === activeTabId }"
      role="tab"
      :aria-selected="!libraryActive && tab.id === activeTabId"
      :tabindex="0"
      @click="emit('selectTab', tab.id)"
      @keydown.enter.prevent="emit('selectTab', tab.id)"
      @keydown.space.prevent="emit('selectTab', tab.id)"
      @contextmenu.prevent
    >
      <Folder :size="15" />
      <span class="flow-document-tab__name">{{ formatTabName(tab) }}</span>
      <button
        v-if="closable"
        class="flow-document-tab__close"
        :aria-label="`关闭${formatTabName(tab)}`"
        type="button"
        @click.stop="emit('closeTab', tab.id)"
      >
        <X :size="14" />
      </button>
    </div>

    <button
      v-if="showCreate"
      class="flow-document-tabs__create"
      title="新建画布"
      type="button"
      @click="emit('create')"
    >
      <Plus :size="17" />
    </button>

  </nav>
</template>
