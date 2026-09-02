<template>
  <FlowEditorHeader
    ref="editorHeaderRef"
    v-bind="$props"
    @add-new-tab="$emit('add-new-tab')"
    @cancel-new-wf="$emit('cancel-new-wf')"
    @confirm-new-wf="$emit('confirm-new-wf', $event)"
    @switch-tab="$emit('switch-tab', $event)"
    @tab-close-direct="$emit('tab-close-direct', $event)"
    @tab-export="$emit('tab-export')"
    @tab-import="openImportFilePicker"
    @tab-rename="$emit('tab-rename')"
    @confirm-rename="$emit('confirm-rename')"
    @update:rename-value="$emit('update:renameValue', $event)"
    @update:show-rename-modal="$emit('update:showRenameModal', $event)"
    @update:new-wf-name="$emit('update:newWfName', $event)"
  />

  <!-- 重名检测弹窗 -->
  <Transition name="fade">
    <div v-if="showDuplicateModal" class="modal-overlay" @click.self="$emit('update:showDuplicateModal', false)">
      <div class="rename-modal">
        <div class="rename-header">工作流名称冲突</div>
        <p class="duplicate-hint">已存在同名工作流 "{{ duplicateWorkflowName }}"，请选择处理方式：</p>
        <div class="rename-actions duplicate-actions">
          <button class="rename-btn cancel" @click="$emit('update:showDuplicateModal', false)">取消保存</button>
          <button class="rename-btn secondary" @click="$emit('save-with-suffix')">添加版本后缀</button>
          <button class="rename-btn confirm" @click="$emit('save-with-overwrite')">覆盖原工作流</button>
        </div>
      </div>
    </div>
  </Transition>

  <FlowTabCloseDialog
    :visible="showUnsavedModal"
    title="未保存的更改"
    message="当前工作流有未保存的更改，是否保存？"
    confirm-label="保存"
    secondary-label="不保存"
    @cancel="$emit('cancel-close')"
    @confirm="$emit('save-and-close-tab')"
    @secondary="$emit('close-without-save')"
  />

  <!-- 导出保存弹窗 -->
  <Transition name="fade">
    <div v-if="showExportSaveModal" class="modal-overlay" @click.self="$emit('cancel-export-save')">
      <div class="rename-modal">
        <div class="rename-header">导出前保存</div>
        <p class="duplicate-hint">当前工作流有未保存的更改，是否先保存再导出？</p>
        <div class="rename-actions duplicate-actions">
          <button class="rename-btn cancel" @click="$emit('cancel-export-save')">取消</button>
          <button class="rename-btn secondary" @click="$emit('export-without-save')">直接导出</button>
          <button class="rename-btn confirm" @click="$emit('confirm-export-save')">保存并导出</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- 删除子图弹窗 -->
  <Transition name="fade">
    <div v-if="showDeleteSubgraphModal" class="modal-overlay" @click.self="$emit('close-delete-subgraph-modal')">
      <div class="rename-modal">
        <div class="rename-header">删除子图</div>
        <p class="duplicate-hint">
          你正在删除{{ deleteSubgraphModalLabel }}。请选择处理方式：
          "打散子图"会把里面的节点散到当前父画布，
          "删除全部"会连同子图内部节点一起删除，
          "取消"则什么也不做。
        </p>
        <div class="rename-actions duplicate-actions">
          <button class="rename-btn cancel" @click="$emit('close-delete-subgraph-modal')">取消</button>
          <button class="rename-btn secondary" @click="$emit('confirm-delete-subgraph-remove-all')">删除全部</button>
          <button class="rename-btn confirm" @click="$emit('confirm-delete-subgraph-dissolve')">打散子图</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- 隐藏的文件输入 -->
  <input ref="importInputRef" type="file" accept=".json" @change="$emit('import-json', $event)" style="display:none" />
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { FLOW_ROUTE_TAB_REGISTER_KEY } from '@/composables/flow/flowRouteTabsBridge'
import FlowEditorHeader from './FlowEditorHeader.vue'
import FlowTabCloseDialog from './FlowTabCloseDialog.vue'

defineProps({
  hasUnsavedChanges: { type: Boolean, default: false },
  hydrateWorkflowDefinition: { type: Function, required: true },
  saveState: { type: String, default: 'saved' },
  showWorkflowsPanel: { type: Boolean, default: false },
  showDocumentTabs: { type: Boolean, default: false },
  wfSortOrder: { type: String, default: 'desc' },
  sortedWorkflows: { type: Array, default: () => [] },
  workflows: { type: Array, default: () => [] },
  activeWorkflowId: { type: String, default: '' },
  workflowTabs: { type: Array, default: () => [] },
  activeTabId: { type: String, default: '' },
  tabContextMenu: { type: Object, default: () => ({ visible: false, x: 0, y: 0, tabId: null }) },
  showRenameModal: { type: Boolean, default: false },
  renameValue: { type: String, default: '' },
  showNewWfModal: { type: Boolean, default: false },
  newWfName: { type: String, default: '' },
  newWfModalTitle: { type: String, default: '新建工作流' },
  pendingJsonImportData: { type: [Object, null], default: null },
  showDuplicateModal: { type: Boolean, default: false },
  duplicateWorkflowName: { type: String, default: '' },
  showUnsavedModal: { type: Boolean, default: false },
  showExportSaveModal: { type: Boolean, default: false },
  showDeleteSubgraphModal: { type: Boolean, default: false },
  deleteSubgraphModalLabel: { type: String, default: '' },
})

const importInputRef = ref(null)
const editorHeaderRef = ref(null)
const tabContextMenuRef = ref(null)
const newWfInputRef = computed(() => editorHeaderRef.value?.newWfInputRef ?? null)
const registerFlowRouteActions = inject(FLOW_ROUTE_TAB_REGISTER_KEY, null)

function openImportFilePicker() {
  const input = importInputRef.value
  if (!input) return
  input.value = ''
  input.click()
}

function openFlowLibrary() {
  editorHeaderRef.value?.openFlowLibrary?.()
}

defineExpose({ newWfInputRef, importInputRef, openFlowLibrary, tabContextMenuRef })

const emit = defineEmits([
  'add-new-tab',
  'update:showWorkflowsPanel',
  'update:wfSortOrder',
  'load-workflow',
  'delete-workflow',
  'switch-tab',
  'show-tab-context-menu',
  'tab-close-direct',
  'tab-export',
  'tab-import',
  'tab-rename',
  'tab-close',
  'update:showRenameModal',
  'update:renameValue',
  'confirm-rename',
  'update:showNewWfModal',
  'update:newWfName',
  'confirm-new-wf',
  'cancel-new-wf',
  'update:showDuplicateModal',
  'save-with-suffix',
  'save-with-overwrite',
  'cancel-close',
  'close-without-save',
  'save-and-close-tab',
  'cancel-export-save',
  'confirm-export-save',
  'export-without-save',
  'close-delete-subgraph-modal',
  'confirm-delete-subgraph-remove-all',
  'confirm-delete-subgraph-dissolve',
  'import-json',
])

onMounted(() => {
  registerFlowRouteActions?.({
    addTab: () => emit('add-new-tab'),
    closeTab: (tabId) => emit('tab-close-direct', tabId),
    openLibrary: openFlowLibrary,
    selectTab: (tabId) => emit('switch-tab', tabId),
  })
})

onUnmounted(() => {
  registerFlowRouteActions?.(null)
})

</script>

<style scoped src="./FlowTabBar.scss"></style>
