<script setup lang="ts">
import type { FlowCanvasCreateDraft } from './library/flowLibrary.types'
import type { WorkflowDefinition } from '@/composables/flow/flowCore.types'
import { computed, ref, toRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Layout, Send } from 'lucide-vue-next'
import { useFlowEditorCategory } from '@/composables/flow/useFlowEditorCategory'
import { useFlowCanvasCategoryOptions } from '@/composables/flow/useFlowCanvasCategoryOptions'
import { useFlowCasePublisher } from '@/composables/flow/useFlowCasePublisher'
import { useFlowHistory } from '@/composables/flow/useFlowHistory'
import FlowDocumentTabs from './FlowDocumentTabs.vue'
import FlowCanvasCreateDialog from './library/FlowCanvasCreateDialog.vue'
import FlowCasePublishDialog from './FlowCasePublishDialog.vue'
import FlowEditorMoreMenu from './FlowEditorMoreMenu.vue'
import FlowHistoryDrawer from './FlowHistoryDrawer.vue'
import FlowHistoryPreview from './FlowHistoryPreview.vue'
import FlowTitleEmojiEditor from './FlowTitleEmojiEditor.vue'
import FlowWorkflowActions from './FlowWorkflowActions.vue'
import './FlowEditorHeader.scss'

defineOptions({ name: 'FlowEditorHeader', inheritAttrs: false })

interface WorkflowTabSummary {
  id: string
  name?: string
  workflowId?: string | null
}

interface FlowEditorHeaderProps {
  activeTabId: string
  activeWorkflowId: string
  hasUnsavedChanges: boolean
  hydrateWorkflowDefinition: (definition: unknown) => WorkflowDefinition
  saveState: 'error' | 'idle' | 'saving' | 'saved'
  newWfModalTitle: string
  newWfName: string
  pendingJsonImportData: Record<string, unknown> | null
  renameValue: string
  showNewWfModal: boolean
  showRenameModal: boolean
  showDocumentTabs?: boolean
  showWorkflowsPanel: boolean
  sortedWorkflows: Array<{ id: string; name: string; updated_at?: string | null }>
  wfSortOrder: string
  workflows: Array<{ id: string; name: string; updated_at?: string | null }>
  workflowTabs: WorkflowTabSummary[]
}

const props = defineProps<FlowEditorHeaderProps>()
const emit = defineEmits<{
  (event: 'add-new-tab'): void
  (event: 'cancel-new-wf'): void
  (event: 'confirm-new-wf', draft?: FlowCanvasCreateDraft): void
  (event: 'confirm-rename'): void
  (event: 'switch-tab', tabId: string): void
  (event: 'tab-close-direct', tabId: string): void
  (event: 'tab-export'): void
  (event: 'tab-import'): void
  (event: 'tab-rename'): void
  (event: 'update:newWfName', value: string): void
  (event: 'update:renameValue', value: string): void
  (event: 'update:showRenameModal', value: boolean): void
}>()

const router = useRouter()
const workflowActionsRef = ref<InstanceType<typeof FlowWorkflowActions> | null>(null)
const newWfInputRef = computed(() => workflowActionsRef.value?.newWfInputRef ?? null)
const activeTabName = computed(() => {
  const activeTab = props.workflowTabs.find((tab) => tab.id === props.activeTabId)
  return String(activeTab?.name || '').trim() || '未命名画布'
})
const saveStateText = computed(() => {
  if (props.saveState === 'saving') return '正在保存…'
  if (props.saveState === 'error') return '保存失败'
  return props.hasUnsavedChanges ? '有未保存更改' : '已保存'
})
const { categoryId: activeCategoryId } = useFlowEditorCategory(toRef(props, 'activeWorkflowId'))
const needsCategorySelection = computed(() => !activeCategoryId.value)
const {
  categoryError,
  categoryLoading,
  categoryOptions,
  loadCategoryOptions,
} = useFlowCanvasCategoryOptions()
const {
  canPublishCase,
  caseCategories,
  caseDialogVisible,
  hasPublishPermission,
  isCaseCategoryLoading,
  isCasePublishing,
  openCasePublisher,
  publishCase,
} = useFlowCasePublisher({
  activeWorkflowId: toRef(props, 'activeWorkflowId'),
  hasUnsavedChanges: toRef(props, 'hasUnsavedChanges'),
})
const {
  closeHistory,
  historyLoading,
  historyVersions,
  historyVisible,
  openHistory,
  restoreHistory,
  restoringRevision,
  selectedRevision,
  previewDefinition,
  previewError,
  previewLoading,
  previewVersion,
  selectHistory,
} = useFlowHistory({
  activeWorkflowId: toRef(props, 'activeWorkflowId'),
  activeWorkflowName: activeTabName,
  hasUnsavedChanges: toRef(props, 'hasUnsavedChanges'),
  hydrateWorkflowDefinition: props.hydrateWorkflowDefinition,
})

function openFlowLibrary(): void {
  void router.push({
    name: 'flow',
    query: activeCategoryId.value ? { categoryId: activeCategoryId.value } : {},
  })
}

function confirmCanvasCreation(draft: FlowCanvasCreateDraft): void {
  emit('confirm-new-wf', {
    ...draft,
    categoryId: activeCategoryId.value || draft.categoryId,
  })
}

function handleTitleClick(): void {
  if (props.showRenameModal) emit('confirm-rename')
  else emit('tab-rename')
}

watch(
  [() => props.showNewWfModal, () => props.pendingJsonImportData, needsCategorySelection],
  ([isVisible, pendingImport, needsSelection]) => {
    if (isVisible && !pendingImport && needsSelection) void loadCategoryOptions()
  },
  { immediate: true },
)

defineExpose({ newWfInputRef, openFlowLibrary })
</script>

<template>
  <header class="flow-editor-header" :class="{ 'has-document-tabs': showDocumentTabs }">
    <div v-if="showDocumentTabs" class="flow-editor-header__tabs">
      <FlowDocumentTabs
        :active-tab-id="activeTabId"
        :tabs="workflowTabs"
        closable
        show-create
        @close-tab="emit('tab-close-direct', $event)"
        @create="emit('add-new-tab')"
        @open-library="openFlowLibrary"
        @select-tab="emit('switch-tab', $event)"
      />

      <FlowWorkflowActions
        ref="workflowActionsRef"
        :new-wf-modal-title="newWfModalTitle"
        :new-wf-name="newWfName"
        :pending-json-import-data="pendingJsonImportData"
        :show-new-wf-modal="showNewWfModal && !!pendingJsonImportData"
        @cancel-new-wf="emit('cancel-new-wf')"
        @confirm-new-wf="emit('confirm-new-wf')"
        @update:new-wf-name="emit('update:newWfName', $event)"
      />

      <FlowCanvasCreateDialog
        v-if="!pendingJsonImportData"
        :category-error="categoryError"
        :category-loading="categoryLoading"
        :category-options="needsCategorySelection ? categoryOptions : []"
        :visible="showNewWfModal"
        :loading="false"
        :require-category="needsCategorySelection"
        @confirm="confirmCanvasCreation"
        @update:visible="!$event && emit('cancel-new-wf')"
      />
    </div>

    <div class="flow-editor-header__main">
      <div class="flow-editor-header__identity">
        <span class="flow-editor-header__file-icon" aria-hidden="true">
          <Layout :size="14" />
        </span>
        <div class="flow-editor-header__title-editor" :class="{ 'is-open': showRenameModal }">
          <button
            class="flow-editor-header__name"
            :disabled="!activeTabId"
            title="修改画布名称"
            type="button"
            @click="handleTitleClick"
          >
            {{ activeTabName }}
          </button>
          <div
            v-if="showRenameModal"
            class="flow-editor-header__title-popover"
            @mousedown.stop
            @pointerdown.stop
          >
            <FlowTitleEmojiEditor
              :model-value="renameValue"
              @cancel="emit('update:showRenameModal', false)"
              @commit="emit('confirm-rename')"
              @update:model-value="emit('update:renameValue', $event)"
            />
          </div>
        </div>
      </div>

      <div class="flow-editor-header__right">
        <button
          class="flow-editor-header__save-state"
          :data-state="saveState"
          :disabled="!activeWorkflowId"
          :aria-label="`${saveStateText}，查看历史记录`"
          title="查看历史记录"
          type="button"
          @click="openHistory"
        >
          {{ saveStateText }}
        </button>
        <button
          v-if="hasPublishPermission"
          class="flow-editor-header__publish"
          type="button"
          :disabled="!canPublishCase"
          title="将已保存画布发布到案例库"
          @click="openCasePublisher"
        >
          <Send :size="14" />
          <span>{{ isCasePublishing ? '发布中' : '发布案例' }}</span>
        </button>
        <FlowEditorMoreMenu
          :has-active-canvas="!!activeTabId"
          @export-json="emit('tab-export')"
          @history="openHistory"
          @import-json="emit('tab-import')"
        />
      </div>
    </div>

    <FlowCasePublishDialog
      v-model:visible="caseDialogVisible"
      :categories="caseCategories"
      :default-name="activeTabName"
      :loading="isCaseCategoryLoading"
      :publishing="isCasePublishing"
      @confirm="publishCase"
    />
    <FlowHistoryDrawer
      :loading="historyLoading"
      :preview-error="previewError"
      :preview-loading="previewLoading"
      :restoring-revision="restoringRevision"
      :selected-revision="selectedRevision"
      :versions="historyVersions"
      :visible="historyVisible"
      @close="closeHistory"
      @restore="restoreHistory"
      @select="selectHistory"
    />
    <Teleport v-if="previewDefinition && previewVersion" to=".flow-workspace">
      <FlowHistoryPreview
        :key="previewVersion.revision"
        :definition="previewDefinition"
        :version="previewVersion"
      />
    </Teleport>
  </header>
</template>
